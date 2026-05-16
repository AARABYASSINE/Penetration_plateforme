from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.api.routes import scans, devices, vulnerabilities, reports, topology

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PenTest Platform API...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created.")
    yield
    logger.info("Shutting down PenTest Platform API...")


app = FastAPI(
    title="PenTest Automation Platform",
    description="Intelligent web-based penetration testing automation platform for controlled lab environments.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scans.router, prefix="/api/v1/scans", tags=["Scans"])
app.include_router(devices.router, prefix="/api/v1/devices", tags=["Devices"])
app.include_router(vulnerabilities.router, prefix="/api/v1/vulnerabilities", tags=["Vulnerabilities"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(topology.router, prefix="/api/v1/topology", tags=["Topology"])


@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {"status": "operational", "version": "1.0.0", "platform": "PenTest Automation Platform"}
