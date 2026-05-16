from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.vulnerability import Vulnerability, Severity, VulnStatus
from app.schemas import VulnerabilityResponse, VulnerabilityCreate

router = APIRouter()


@router.get("/", response_model=List[VulnerabilityResponse])
def list_vulnerabilities(
    scan_id: Optional[str] = Query(None),
    device_id: Optional[str] = Query(None),
    severity: Optional[Severity] = Query(None),
    status: Optional[VulnStatus] = Query(None),
    skip: int = 0, limit: int = 500,
    db: Session = Depends(get_db)
):
    q = db.query(Vulnerability)
    if scan_id:   q = q.filter(Vulnerability.scan_id == scan_id)
    if device_id: q = q.filter(Vulnerability.device_id == device_id)
    if severity:  q = q.filter(Vulnerability.severity == severity)
    if status:    q = q.filter(Vulnerability.status == status)
    return q.order_by(Vulnerability.risk_score.desc()).offset(skip).limit(limit).all()


@router.get("/{vuln_id}", response_model=VulnerabilityResponse)
def get_vulnerability(vuln_id: str, db: Session = Depends(get_db)):
    v = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    return v


@router.patch("/{vuln_id}/status")
def update_vuln_status(vuln_id: str, status: VulnStatus, db: Session = Depends(get_db)):
    v = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    v.status = status
    db.commit()
    return {"id": vuln_id, "status": status}


@router.post("/import", response_model=List[VulnerabilityResponse], status_code=201)
def import_vulnerabilities(vulns: List[VulnerabilityCreate], db: Session = Depends(get_db)):
    """Bulk import vulnerabilities from external tools (Nmap XML, Nikto, etc.)."""
    created = []
    for v_data in vulns:
        v = Vulnerability(**v_data.model_dump())
        db.add(v)
        created.append(v)
    db.commit()
    for v in created:
        db.refresh(v)
    return created
