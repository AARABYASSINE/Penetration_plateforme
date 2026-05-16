from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.scan import Scan

router = APIRouter()


@router.get("/{scan_id}")
def get_topology(scan_id: str, db: Session = Depends(get_db)):
    """Return topology graph data for a scan (nodes + edges for 3D visualization)."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not scan.topology_data:
        raise HTTPException(status_code=404, detail="Topology data not yet available")
    return scan.topology_data
