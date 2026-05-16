from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid
from app.core.database import Base


class ReportFormat(str, enum.Enum):
    JSON = "json"
    PDF = "pdf"
    HTML = "html"
    MARKDOWN = "markdown"


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id = Column(String, ForeignKey("scans.id"), unique=True, nullable=False)

    title = Column(String(500), nullable=False)
    executive_summary = Column(Text)
    methodology = Column(Text)
    scope = Column(Text)
    findings_summary = Column(JSON, default=dict)
    recommendations = Column(JSON, default=list)

    # File paths
    pdf_path = Column(String(500))
    html_path = Column(String(500))
    json_path = Column(String(500))

    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(String(100), default="system")

    # Relationships
    scan = relationship("Scan", back_populates="report")

    def __repr__(self):
        return f"<Report for Scan {self.scan_id}>"
