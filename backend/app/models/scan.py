from sqlalchemy import Column, String, Integer, DateTime, JSON, Text, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid
from app.core.database import Base


class ScanStatus(str, enum.Enum):
    PENDING = "pending"
    DISCOVERY = "discovery"
    SCANNING = "scanning"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanType(str, enum.Enum):
    QUICK = "quick"         # Fast ping sweep + top ports
    STANDARD = "standard"   # Full port scan + service detection
    DEEP = "deep"           # Full scan + vuln detection + scripts
    STEALTH = "stealth"     # SYN scan, slower, less noisy


class Scan(Base):
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Target
    target_network = Column(String(50), nullable=False)  # e.g. 192.168.1.0/24
    target_hosts = Column(JSON, default=list)  # specific hosts if any

    # Configuration
    scan_type = Column(Enum(ScanType), default=ScanType.STANDARD)
    scan_options = Column(JSON, default=dict)  # additional flags/options

    # Status & progress
    status = Column(Enum(ScanStatus), default=ScanStatus.PENDING)
    progress = Column(Integer, default=0)  # 0-100
    current_phase = Column(String(100))
    error_message = Column(Text)

    # Results summary
    hosts_discovered = Column(Integer, default=0)
    vulnerabilities_found = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)

    # Topology data (graph JSON for visualization)
    topology_data = Column(JSON, default=dict)

    # Risk summary
    overall_risk_score = Column(Float, default=0.0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    devices = relationship("Device", back_populates="scan", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="scan", uselist=False)

    def __repr__(self):
        return f"<Scan {self.name} [{self.status}]>"
