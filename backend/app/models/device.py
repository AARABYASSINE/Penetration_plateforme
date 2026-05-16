from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid
from app.core.database import Base


class DeviceType(str, enum.Enum):
    ROUTER = "router"
    SWITCH = "switch"
    SERVER = "server"
    WORKSTATION = "workstation"
    FIREWALL = "firewall"
    IOT = "iot"
    UNKNOWN = "unknown"


class Device(Base):
    __tablename__ = "devices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id = Column(String, ForeignKey("scans.id"), nullable=False)

    # Network identity
    ip_address = Column(String(45), nullable=False)
    mac_address = Column(String(17))
    hostname = Column(String(255))

    # Classification
    device_type = Column(Enum(DeviceType), default=DeviceType.UNKNOWN)
    os_name = Column(String(255))
    os_version = Column(String(100))
    os_accuracy = Column(Integer)

    # Technical details
    open_ports = Column(JSON, default=list)       # [{port, protocol, service, version, state}]
    running_services = Column(JSON, default=list) # [{name, version, product, extra_info}]
    
    # Network topology metadata
    network_layer = Column(Integer, default=3)    # OSI layer position
    network_centrality = Column(Float, default=0.0)  # Graph centrality score
    is_gateway = Column(Integer, default=0)
    vendor = Column(String(255))

    # Timestamps
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    vulnerabilities = relationship("Vulnerability", back_populates="device", cascade="all, delete-orphan")
    scan = relationship("Scan", back_populates="devices")

    def __repr__(self):
        return f"<Device {self.ip_address} ({self.device_type})>"
