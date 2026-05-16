from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.models.scan import Scan, ScanStatus
from app.schemas import ScanCreate, ScanResponse, ScanDetail, ScanUpdate
from app.services.scanner import ScannerService

router = APIRouter()


@router.post("/", response_model=ScanResponse, status_code=201)
async def create_scan(
    payload: ScanCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create and launch a new network scan."""
    scan = Scan(
        name=payload.name,
        description=payload.description,
        target_network=payload.target_network,
        target_hosts=payload.target_hosts,
        scan_type=payload.scan_type,
        scan_options=payload.scan_options,
        status=ScanStatus.PENDING,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Launch scan in background
    background_tasks.add_task(_run_scan_task, scan.id)
    return scan


@router.get("/", response_model=List[ScanResponse])
def list_scans(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """List all scans ordered by creation date."""
    return db.query(Scan).order_by(Scan.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{scan_id}", response_model=ScanDetail)
def get_scan(scan_id: str, db: Session = Depends(get_db)):
    """Get detailed information about a specific scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.patch("/{scan_id}", response_model=ScanResponse)
def update_scan(scan_id: str, payload: ScanUpdate, db: Session = Depends(get_db)):
    """Update scan status (for external scanner integration)."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(scan, field, value)

    if payload.status == ScanStatus.COMPLETED and not scan.completed_at:
        scan.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(scan)
    return scan


@router.delete("/{scan_id}", status_code=204)
def delete_scan(scan_id: str, db: Session = Depends(get_db)):
    """Delete a scan and all associated data."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan.status in (ScanStatus.SCANNING, ScanStatus.DISCOVERY, ScanStatus.ANALYZING):
        raise HTTPException(status_code=409, detail="Cannot delete an active scan")
    db.delete(scan)
    db.commit()


@router.post("/{scan_id}/cancel", response_model=ScanResponse)
def cancel_scan(scan_id: str, db: Session = Depends(get_db)):
    """Cancel a running scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    scan.status = ScanStatus.CANCELLED
    db.commit()
    db.refresh(scan)
    return scan


# Background task runner (synchronous wrapper)
def _run_scan_task(scan_id: str):
    import asyncio
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        service = ScannerService(db)
        asyncio.run(service.run_scan(scan_id))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Background scan {scan_id} error: {e}")
    finally:
        db.close()
