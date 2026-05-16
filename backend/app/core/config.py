from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "PenTest Automation Platform"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-strong-random-key"

    # Database
    DATABASE_URL: str = "postgresql://pentest:pentest123@localhost:5432/pentestdb"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Scanning
    NMAP_PATH: str = "/usr/bin/nmap"
    SCAN_TIMEOUT: int = 300  # seconds
    MAX_CONCURRENT_SCANS: int = 3

    # Reports
    REPORTS_DIR: str = "./reports"

    # Risk Scoring
    CVSS_WEIGHT: float = 0.4
    CENTRALITY_WEIGHT: float = 0.3
    ATTACK_PATH_WEIGHT: float = 0.3

    class Config:
        env_file = ".env"


settings = Settings()
