from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ── Enums ────────────────────────────────────────────────────────────
class DeviceType(str, Enum):
    ROUTER = "router"; SWITCH = "switch"; SERVER = "server"
    WORKSTATION = "workstation"; FIREWALL = "firewall"
    IOT = "iot"; UNKNOWN = "unknown"

class Severity(str, Enum):
    CRITICAL = "critical"; HIGH = "high"; MEDIUM = "medium"
    LOW = "low"; INFO = "info"

class ScanStatus(str, Enum):
    PENDING = "pending"; DISCOVERY = "discovery"; SCANNING = "scanning"
    ANALYZING = "analyzing"; COMPLETED = "completed"
    FAILED = "failed"; CANCELLED = "cancelled"

class ScanType(str, Enum):
    QUICK = "quick"; STANDARD = "standard"; DEEP = "deep"; STEALTH = "stealth"

class VulnStatus(str, Enum):
    OPEN = "open"; CONFIRMED = "confirmed"
    FALSE_POSITIVE = "false_positive"; REMEDIATED = "remediated"


# ── Device Schemas ────────────────────────────────────────────────────
class DeviceBase(BaseModel):
    ip_address: str
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    device_type: DeviceType = DeviceType.UNKNOWN
    os_name: Optional[str] = None
    os_version: Optional[str] = None
    os_accuracy: Optional[int] = None
    open_ports: List[Dict[str, Any]] = []
    running_services: List[Dict[str, Any]] = []
    vendor: Optional[str] = None
    is_gateway: int = 0
    network_centrality: float = 0.0

class DeviceCreate(DeviceBase):
    scan_id: str

class DeviceResponse(DeviceBase):
    id: str
    scan_id: str
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    vulnerabilities: List["VulnerabilityBrief"] = []
    class Config:
        from_attributes = True

class DeviceBrief(BaseModel):
    id: str; ip_address: str; hostname: Optional[str] = None
    device_type: DeviceType; os_name: Optional[str] = None
    open_ports: List[Dict[str, Any]] = []; vulnerability_count: int = 0
    class Config:
        from_attributes = True


# ── Vulnerability Schemas ─────────────────────────────────────────────
class VulnerabilityBase(BaseModel):
    cve_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    cvss_score: float = 0.0
    cvss_vector: Optional[str] = None
    severity: Severity = Severity.INFO
    affected_port: Optional[int] = None
    affected_service: Optional[str] = None
    proof_of_concept: Optional[str] = None
    exploit_available: int = 0
    exploitation_guidance: Optional[str] = None
    remediation: Optional[str] = None
    references: List[Dict[str, str]] = []
    detected_by: Optional[str] = None

class VulnerabilityCreate(VulnerabilityBase):
    device_id: str; scan_id: str

class VulnerabilityResponse(VulnerabilityBase):
    id: str; device_id: str; scan_id: str
    risk_score: float = 0.0; centrality_factor: float = 0.0
    attack_path_probability: float = 0.0
    status: VulnStatus = VulnStatus.OPEN
    discovered_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class VulnerabilityBrief(BaseModel):
    id: str; title: str; severity: Severity
    cvss_score: float = 0.0; risk_score: float = 0.0
    status: VulnStatus = VulnStatus.OPEN
    class Config:
        from_attributes = True


# ── Scan Schemas ──────────────────────────────────────────────────────
class ScanCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    target_network: str = Field(..., example="192.168.1.0/24")
    target_hosts: List[str] = []
    scan_type: ScanType = ScanType.STANDARD
    scan_options: Dict[str, Any] = {}

class ScanUpdate(BaseModel):
    status: Optional[ScanStatus] = None
    progress: Optional[int] = None
    current_phase: Optional[str] = None
    error_message: Optional[str] = None

class ScanResponse(BaseModel):
    id: str; name: str; description: Optional[str] = None
    target_network: str; scan_type: ScanType; status: ScanStatus
    progress: int = 0; current_phase: Optional[str] = None
    hosts_discovered: int = 0; vulnerabilities_found: int = 0
    critical_count: int = 0; high_count: int = 0
    medium_count: int = 0; low_count: int = 0
    overall_risk_score: float = 0.0
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class ScanDetail(ScanResponse):
    devices: List[DeviceBrief] = []
    topology_data: Dict[str, Any] = {}
    class Config:
        from_attributes = True


# ── Report Schemas ────────────────────────────────────────────────────
class ReportCreate(BaseModel):
    scan_id: str
    title: Optional[str] = None

class ReportResponse(BaseModel):
    id: str; scan_id: str; title: str
    executive_summary: Optional[str] = None
    findings_summary: Dict[str, Any] = {}
    recommendations: List[str] = []
    generated_at: Optional[datetime] = None
    pdf_path: Optional[str] = None
    html_path: Optional[str] = None
    class Config:
        from_attributes = True


# Rebuild for forward references
DeviceResponse.model_rebuild()
