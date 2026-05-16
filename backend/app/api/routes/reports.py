## reports.py
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.models.scan import Scan
from app.schemas import ReportCreate, ReportResponse
from app.services.report_generator import ReportGenerator
from typing import List

router = APIRouter()


@router.post("/generate", response_model=ReportResponse, status_code=201)
def generate_report(payload: ReportCreate, db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == payload.scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    existing = db.query(Report).filter(Report.scan_id == payload.scan_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    
    generator = ReportGenerator(db)
    report = generator.generate(scan, title=payload.title)
    return report


@router.get("/", response_model=List[ReportResponse])
def list_reports(db: Session = Depends(get_db)):
    return db.query(Report).order_by(Report.generated_at.desc()).all()


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    return r


@router.get("/{report_id}/html", response_class=Response)
def get_report_html(report_id: str, db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r or not r.html_path:
        raise HTTPException(status_code=404, detail="HTML report not found")
    try:
        with open(r.html_path, "r") as f:
            content = f.read()
        return Response(content=content, media_type="text/html")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report file not found on disk")
