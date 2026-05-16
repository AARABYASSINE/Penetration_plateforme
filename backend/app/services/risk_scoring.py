"""
Risk Scoring Service
Enhanced risk formula:
  RiskScore = (w1 * CVSS_normalized) + (w2 * Centrality) + (w3 * AttackPathProbability)

Where:
  - CVSS_normalized  : cvss_score / 10
  - Centrality       : device's graph centrality (0–1)
  - AttackPathProb   : probability that this vulnerability is on an attack path (0–1)
  - w1=0.4, w2=0.3, w3=0.3 (configurable in settings)
"""

import logging
from sqlalchemy.orm import Session
from app.models.scan import Scan
from app.models.device import Device
from app.models.vulnerability import Vulnerability
from app.core.config import settings

logger = logging.getLogger(__name__)


class RiskScorer:

    def score_all(self, scan: Scan, db: Session):
        devices = db.query(Device).filter(Device.scan_id == scan.id).all()
        
        # Max centrality for normalization
        max_c = max((d.network_centrality for d in devices), default=1.0) or 1.0

        total_risk = 0.0
        vuln_count = 0

        for device in devices:
            # Update centrality from topology_data if available
            if scan.topology_data and "nodes" in scan.topology_data:
                for node in scan.topology_data["nodes"]:
                    if node.get("id") == device.id:
                        device.network_centrality = node.get("centrality", 0.0)

            vulns = db.query(Vulnerability).filter(Vulnerability.device_id == device.id).all()
            
            for vuln in vulns:
                risk = self._compute_risk(vuln, device, max_c)
                vuln.risk_score = round(risk, 2)
                vuln.centrality_factor = round(device.network_centrality / max_c, 4)
                vuln.attack_path_probability = round(self._estimate_attack_path(vuln, device), 4)
                total_risk += risk
                vuln_count += 1

        if vuln_count > 0:
            scan.overall_risk_score = round(total_risk / vuln_count, 2)
        
        db.commit()
        logger.info(f"Risk scoring complete for scan {scan.id}. Overall: {scan.overall_risk_score}")

    def _compute_risk(self, vuln: Vulnerability, device: Device, max_centrality: float) -> float:
        w1 = settings.CVSS_WEIGHT
        w2 = settings.CENTRALITY_WEIGHT
        w3 = settings.ATTACK_PATH_WEIGHT

        cvss_norm = (vuln.cvss_score or 0.0) / 10.0
        centrality_norm = (device.network_centrality or 0.0) / max(max_centrality, 1e-6)
        attack_path = self._estimate_attack_path(vuln, device)

        raw = (w1 * cvss_norm) + (w2 * centrality_norm) + (w3 * attack_path)
        # Scale to 0-10
        return min(raw * 10, 10.0)

    def _estimate_attack_path(self, vuln: Vulnerability, device: Device) -> float:
        """
        Heuristic attack path probability based on:
        - Exploit availability
        - Exposure (device type, network position)
        - Port accessibility
        """
        score = 0.0

        if vuln.exploit_available:
            score += 0.4

        if vuln.cvss_score and vuln.cvss_score >= 9.0:
            score += 0.3
        elif vuln.cvss_score and vuln.cvss_score >= 7.0:
            score += 0.2
        elif vuln.cvss_score and vuln.cvss_score >= 5.0:
            score += 0.1

        # Internet-facing services (common exposed ports)
        exposed_ports = {21, 22, 23, 80, 443, 445, 3389, 8080, 8443}
        if vuln.affected_port in exposed_ports:
            score += 0.15

        # High-value targets
        if device.device_type and device.device_type.value in ("server", "router", "firewall"):
            score += 0.15

        return min(score, 1.0)
