## devices.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.device import Device
from app.schemas import DeviceResponse, DeviceBrief

router = APIRouter()


@router.get("/", response_model=List[DeviceBrief])
def list_devices(
    scan_id: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    skip: int = 0, limit: int = 200,
    db: Session = Depends(get_db)
):
    q = db.query(Device)
    if scan_id:
        q = q.filter(Device.scan_id == scan_id)
    if device_type:
        q = q.filter(Device.device_type == device_type)
    return q.offset(skip).limit(limit).all()


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device
