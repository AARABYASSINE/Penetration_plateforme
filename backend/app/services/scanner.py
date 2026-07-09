"""
Scanner Service
Integrates Nmap (python-nmap) and Scapy for network discovery and vulnerability scanning.
For use in authorized lab environments only.
"""
import subprocess
import asyncio
import logging
import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
import nmap
from sqlalchemy.orm import Session

from app.models.scan import Scan, ScanStatus
from app.models.device import Device, DeviceType
from app.models.vulnerability import Vulnerability, Severity
from app.core.config import settings
from app.services.topology import TopologyBuilder
from app.services.risk_scoring import RiskScorer

logger = logging.getLogger(__name__)


# ── Device classification heuristics ─────────────────────────────────
DEVICE_SIGNATURES = {
    DeviceType.ROUTER: {
        "ports": [179, 520, 521, 179],
        "os_patterns": ["ios", "junos", "routeros", "vyos"],
        "services": ["bgp", "ospf", "rip"]
    },
    DeviceType.FIREWALL: {
        "ports": [443, 8443, 4444],
        "os_patterns": ["pfsense", "opnsense", "fortigate", "checkpoint", "asa"],
        "services": ["ipsec", "openvpn"]
    },
    DeviceType.SERVER: {
        "ports": [22, 80, 443, 3306, 5432, 8080, 8443, 3389],
        "os_patterns": ["ubuntu server", "centos", "debian", "windows server", "red hat"],
        "services": ["http", "https", "ssh", "mysql", "postgresql"]
    },
    DeviceType.IOT: {
        "ports": [1883, 8883, 5683],
        "os_patterns": ["embedded", "vxworks", "rtos"],
        "services": ["mqtt", "coap"]
    },
}


class ScannerService:
    def __init__(self, db: Session):
        self.db = db
        self.nm = nmap.PortScanner()
        self.topology_builder = TopologyBuilder()
        self.risk_scorer = RiskScorer()

    # ── Main entry point ──────────────────────────────────────────────
    async def run_scan(self, scan_id: str):
        scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            raise ValueError(f"Scan {scan_id} not found")

        try:
            self._update_scan(scan, ScanStatus.DISCOVERY, 5, "Network Discovery")
            devices_data = await self._discover_hosts(scan)

            self._update_scan(scan, ScanStatus.SCANNING, 30, "Port & Service Scanning")
            detailed_devices = await self._scan_devices(scan, devices_data)

            self._update_scan(scan, ScanStatus.ANALYZING, 70, "Vulnerability Analysis")
            await self._analyze_vulnerabilities(scan, detailed_devices)
            
            self._update_scan(scan, ScanStatus.ANALYZING, 75, "SMB Enumeration")
            await self._run_smbmap(scan, detailed_devices)

            self._update_scan(scan, ScanStatus.ANALYZING, 85, "Topology Reconstruction")
            topology_data = self.topology_builder.build(detailed_devices)
            
            self._update_scan(scan, ScanStatus.ANALYZING, 90, "Risk Scoring")
            self.risk_scorer.score_all(scan, self.db)

            # Final summary
            scan.topology_data = topology_data
            scan.hosts_discovered = len(detailed_devices)
            scan.status = ScanStatus.COMPLETED
            scan.progress = 100
            scan.completed_at = datetime.utcnow()
            self._count_vulns(scan)
            self.db.commit()
            logger.info(f"Scan {scan_id} completed successfully.")

        except Exception as e:
            logger.error(f"Scan {scan_id} failed: {e}", exc_info=True)
            scan.status = ScanStatus.FAILED
            scan.error_message = str(e)
            self.db.commit()
            raise

    # ── Discovery phase ───────────────────────────────────────────────
    async def _discover_hosts(self, scan: Scan) -> List[Dict]:
        logger.info(f"Starting host discovery on {scan.target_network}")
        
        # Ping sweep
        self.nm.scan(
            hosts=scan.target_network,
            arguments="-sn -PE -PP -PM --host-timeout 5s"
        )
        
        live_hosts = [
            host for host in self.nm.all_hosts()
            if self.nm[host].state() == "up"
        ]
        logger.info(f"Discovered {len(live_hosts)} live hosts")
        
        return [{"ip": host, "mac": self._get_mac(host)} for host in live_hosts]

    # ── Port scanning phase ───────────────────────────────────────────
    async def _scan_devices(self, scan: Scan, hosts_data: List[Dict]) -> List[Dict]:
        detailed = []
        scan_args = self._build_scan_args(scan.scan_type.value)

        for i, host_info in enumerate(hosts_data):
            ip = host_info["ip"]
            progress = 30 + int((i / max(len(hosts_data), 1)) * 35)
            self._update_scan(scan, ScanStatus.SCANNING, progress, f"Scanning {ip}")

            try:
                self.nm.scan(hosts=ip, arguments=scan_args)
                host_detail = self._parse_nmap_host(ip, host_info.get("mac"))
                
                device = self._save_device(scan.id, host_detail)
                host_detail["device_id"] = device.id
                detailed.append(host_detail)
            except Exception as e:
                logger.warning(f"Failed to scan {ip}: {e}")

        return detailed

    # ── Vulnerability analysis phase ──────────────────────────────────
    async def _analyze_vulnerabilities(self, scan: Scan, devices: List[Dict]):
        for device_data in devices:
            device_id = device_data.get("device_id")
            if not device_id:
                continue

            vulns = []
            vulns.extend(self._detect_service_vulns(device_data))
            vulns.extend(self._detect_misconfigs(device_data))
            
            for vuln_data in vulns:
                vuln = Vulnerability(
                    device_id=device_id,
                    scan_id=scan.id,
                    **vuln_data
                )
                self.db.add(vuln)
        
        self.db.commit()

    # ── Nmap argument builder ─────────────────────────────────────────
   def _build_scan_args(self, scan_type: str) -> str:
    base = {
        "quick": (
            "-sV -sC -T4 --top-ports 100 -O --host-timeout 30s "
            "--script=banner,http-title,ssh-hostkey,smb-os-discovery"
        ),
        "standard": (
            "-sV -sC -T3 --top-ports 1000 -O --host-timeout 120s "
            "--script=banner,http-title,http-headers,ssh-hostkey,"
            "smb-os-discovery,ftp-anon,telnet-info,"
            "mysql-info,rdp-info,snmp-info"
        ),
        "deep": (
            "-sV -sC -A -T3 -p- --host-timeout 300s "
            "--script=vuln,exploit,auth,default,discovery,safe,"
            "http-shellshock,http-sql-injection,http-csrf,"
            "smb-vuln-ms17-010,smb-vuln-ms08-067,"
            "rdp-vuln-ms12-020,ftp-vsftpd-backdoor,"
            "ssh-brute,ftp-brute,http-brute"
        ),
        "stealth": (
            "-sS -sV -T2 --top-ports 1000 -O --host-timeout 60s "
            "--script=banner,http-title,ssh-hostkey"
        ),
    }
    return base.get(scan_type, base["standard"])

    # ── Parse Nmap results ────────────────────────────────────────────
    def _parse_nmap_host(self, ip: str, mac: Optional[str]) -> Dict:
        if ip not in self.nm.all_hosts():
            return {"ip": ip, "mac": mac}

        host = self.nm[ip]
        ports = []
        services = []

        for proto in host.all_protocols():
            for port in host[proto].keys():
                port_data = host[proto][port]
                if port_data["state"] == "open":
                    port_entry = {
                        "port": port,
                        "protocol": proto,
                        "service": port_data.get("name", "unknown"),
                        "product": port_data.get("product", ""),
                        "version": port_data.get("version", ""),
                        "extra_info": port_data.get("extrainfo", ""),
                        "cpe": port_data.get("cpe", ""),
                        "state": "open"
                    }
                    ports.append(port_entry)
                    if port_data.get("product"):
                        services.append({
                            "name": port_data.get("name"),
                            "product": port_data.get("product"),
                            "version": port_data.get("version"),
                            "port": port
                        })

        # OS detection
        os_name, os_version, os_accuracy = None, None, 0
        if "osmatch" in host and host["osmatch"]:
            best = host["osmatch"][0]
            os_name = best.get("name", "")
            os_accuracy = int(best.get("accuracy", 0))
            if "osclass" in best and best["osclass"]:
                os_version = best["osclass"][0].get("osgen", "")

        # MAC & vendor
        detected_mac = mac
        vendor = None
        if "addresses" in host:
            detected_mac = host["addresses"].get("mac", mac)
            vendor = host["vendor"].get(detected_mac, None) if host.get("vendor") else None

        hostname = None
        if host.get("hostnames") and host["hostnames"][0].get("name"):
            hostname = host["hostnames"][0]["name"]

        device_type = self._classify_device(os_name or "", ports, services)

        return {
            "ip": ip,
            "mac": detected_mac,
            "hostname": hostname,
            "os_name": os_name,
            "os_version": os_version,
            "os_accuracy": os_accuracy,
            "vendor": vendor,
            "ports": ports,
            "services": services,
            "device_type": device_type,
        }

    # ── Device classification ─────────────────────────────────────────
    def _classify_device(self, os_name: str, ports: List, services: List) -> DeviceType:
        os_lower = os_name.lower()
        port_nums = {p["port"] for p in ports}
        svc_names = {s.get("name", "").lower() for s in services}

        for device_type, sig in DEVICE_SIGNATURES.items():
            os_match = any(p in os_lower for p in sig.get("os_patterns", []))
            port_match = bool(port_nums & set(sig.get("ports", [])))
            svc_match = bool(svc_names & set(sig.get("services", [])))
            if os_match or (port_match and svc_match):
                return device_type

        if port_nums & {22, 80, 443, 3306, 5432, 8080}:
            return DeviceType.SERVER
        if port_nums & {135, 139, 445, 3389}:
            return DeviceType.WORKSTATION

        return DeviceType.UNKNOWN

    # ── Common vulnerability detection ───────────────────────────────
    def _detect_service_vulns(self, device: Dict) -> List[Dict]:
        vulns = []
        for port_info in device.get("ports", []):
            port = port_info["port"]
            service = port_info.get("service", "")
            product = port_info.get("product", "")
            version = port_info.get("version", "")

            # Anonymous FTP
            if port == 21 and "anonymous" in port_info.get("extra_info", "").lower():
                vulns.append({
                    "title": "Anonymous FTP Access Enabled",
                    "description": f"FTP server on port {port} allows anonymous login.",
                    "cvss_score": 7.5, "severity": Severity.HIGH,
                    "affected_port": port, "affected_service": "ftp",
                    "cve_id": None,
                    "remediation": "Disable anonymous FTP access.",
                    "detected_by": "nmap"
                })

            # Telnet
            if port == 23:
                vulns.append({
                    "title": "Telnet Service Exposed (Cleartext Protocol)",
                    "description": "Telnet transmits credentials in cleartext.",
                    "cvss_score": 8.0, "severity": Severity.HIGH,
                    "affected_port": port, "affected_service": "telnet",
                    "cve_id": None,
                    "remediation": "Disable Telnet. Use SSH instead.",
                    "detected_by": "nmap"
                })

            # SMBv1
            if port in [445, 139] and "smb" in service.lower():
                vulns.append({
                    "title": "SMB Service Exposed (Potential EternalBlue Vector)",
                    "description": "SMB exposed. Check for MS17-010 / EternalBlue.",
                    "cvss_score": 9.8, "severity": Severity.CRITICAL,
                    "affected_port": port, "affected_service": "smb",
                    "cve_id": "CVE-2017-0144",
                    "exploit_available": 1,
                    "exploitation_guidance": "Use Metasploit module exploit/windows/smb/ms17_010_eternalblue (lab only).",
                    "remediation": "Apply MS17-010 patch. Disable SMBv1.",
                    "detected_by": "nmap"
                })

            # HTTP with no HTTPS
            if port == 80:
                vulns.append({
                    "title": "HTTP Service Without Encryption",
                    "description": "Plain HTTP service detected. Traffic is transmitted in cleartext.",
                    "cvss_score": 5.3, "severity": Severity.MEDIUM,
                    "affected_port": port, "affected_service": "http",
                    "cve_id": None,
                    "remediation": "Enable HTTPS with a valid TLS certificate.",
                    "detected_by": "nmap"
                })

            # Default SSH
            if port == 22:
                vulns.append({
                    "title": "SSH Service Detected",
                    "description": f"SSH service running: {product} {version}. Verify configuration.",
                    "cvss_score": 2.0, "severity": Severity.INFO,
                    "affected_port": port, "affected_service": "ssh",
                    "cve_id": None,
                    "remediation": "Ensure password auth is disabled; use key-based auth only.",
                    "detected_by": "nmap"
                })

            # RDP
            if port == 3389:
                vulns.append({
                    "title": "RDP Exposed to Network (BlueKeep Risk)",
                    "description": "Remote Desktop Protocol exposed. Risk of BlueKeep (CVE-2019-0708).",
                    "cvss_score": 9.8, "severity": Severity.CRITICAL,
                    "affected_port": port, "affected_service": "rdp",
                    "cve_id": "CVE-2019-0708",
                    "exploit_available": 1,
                    "exploitation_guidance": "Metasploit: exploit/windows/rdp/cve_2019_0708_bluekeep_rce (lab only).",
                    "remediation": "Patch Windows, restrict RDP via VPN/firewall.",
                    "detected_by": "nmap"
                })

        return vulns

    def _detect_misconfigs(self, device: Dict) -> List[Dict]:
        vulns = []
        ports = {p["port"] for p in device.get("ports", [])}
        
        if 3306 in ports:
            vulns.append({
                "title": "MySQL Database Port Exposed to Network",
                "description": "MySQL (3306) is accessible from the network.",
                "cvss_score": 7.2, "severity": Severity.HIGH,
                "affected_port": 3306, "affected_service": "mysql",
                "remediation": "Bind MySQL to localhost. Use SSH tunnels for remote access.",
                "detected_by": "nmap"
            })
        
        if 5432 in ports:
            vulns.append({
                "title": "PostgreSQL Database Port Exposed to Network",
                "description": "PostgreSQL (5432) is accessible from the network.",
                "cvss_score": 7.2, "severity": Severity.HIGH,
                "affected_port": 5432, "affected_service": "postgresql",
                "remediation": "Bind PostgreSQL to localhost. Use pg_hba.conf to restrict access.",
                "detected_by": "nmap"
            })

        if 6379 in ports:
            vulns.append({
                "title": "Redis Database Port Exposed (No Auth Default)",
                "description": "Redis (6379) often has no authentication by default.",
                "cvss_score": 9.1, "severity": Severity.CRITICAL,
                "affected_port": 6379, "affected_service": "redis",
                "cve_id": None,
                "remediation": "Enable requirepass in redis.conf. Bind to localhost.",
                "detected_by": "nmap"
            })
        
        return vulns

    # ── Helpers ───────────────────────────────────────────────────────
    def _get_mac(self, ip: str) -> Optional[str]:
        try:
            if ip in self.nm.all_hosts():
                return self.nm[ip].get("addresses", {}).get("mac")
        except Exception:
            pass
        return None

    def _save_device(self, scan_id: str, data: Dict) -> Device:
        device = Device(
            scan_id=scan_id,
            ip_address=data["ip"],
            mac_address=data.get("mac"),
            hostname=data.get("hostname"),
            device_type=data.get("device_type", DeviceType.UNKNOWN),
            os_name=data.get("os_name"),
            os_version=data.get("os_version"),
            os_accuracy=data.get("os_accuracy"),
            open_ports=data.get("ports", []),
            running_services=data.get("services", []),
            vendor=data.get("vendor"),
        )
        self.db.add(device)
        self.db.flush()
        return device

    def _update_scan(self, scan: Scan, status: ScanStatus, progress: int, phase: str):
        scan.status = status
        scan.progress = progress
        scan.current_phase = phase
        if status == ScanStatus.DISCOVERY and not scan.started_at:
            scan.started_at = datetime.utcnow()
        self.db.commit()
        logger.info(f"[Scan {scan.id}] {phase} ({progress}%)")

    def _count_vulns(self, scan: Scan):
        from sqlalchemy import func as sqlfunc
        from app.models.vulnerability import Vulnerability as VulnModel
        
        vulns = self.db.query(VulnModel).filter(VulnModel.scan_id == scan.id).all()
        scan.vulnerabilities_found = len(vulns)
        scan.critical_count = sum(1 for v in vulns if v.severity == Severity.CRITICAL)
        scan.high_count = sum(1 for v in vulns if v.severity == Severity.HIGH)
        scan.medium_count = sum(1 for v in vulns if v.severity == Severity.MEDIUM)
        scan.low_count = sum(1 for v in vulns if v.severity == Severity.LOW)


# mon ajout de SMB

# ── SMBMap Integration ────────────────────────────────────────────
    async def _run_smbmap(self, scan: Scan, devices: List[Dict]):
        """Run SMBMap on devices with port 445 open."""
        for device in devices:
            port_nums = {p["port"] for p in device.get("ports", [])}
            if 445 not in port_nums:
                continue

            ip = device["ip"]
            device_id = device.get("device_id")
            if not device_id:
                continue

            logger.info(f"Running SMBMap on {ip}")
            try:
                result = subprocess.run(
                    ["smbmap", "-H", ip, "--no-banner"],
                    capture_output=True, text=True, timeout=30
                )
                output = result.stdout + result.stderr
                vulns = self._parse_smbmap_output(output, ip, device_id, scan.id)
                for v in vulns:
                    self.db.add(v)
                self.db.commit()

            except Exception as e:
                logger.warning(f"SMBMap failed on {ip}: {e}")

    def _parse_smbmap_output(self, output: str, ip: str, device_id: str, scan_id: str) -> List:
        vulns = []

        if "READ" in output or "WRITE" in output:
            vuln = Vulnerability(
                device_id=device_id,
                scan_id=scan_id,
                title=f"SMB Share Accessible on {ip}",
                description=f"SMBMap found accessible shares on {ip}.\n\n{output[:500]}",
                cvss_score=7.5,
                severity=Severity.HIGH,
                affected_port=445,
                affected_service="smb",
                remediation="Restrict SMB share permissions. Disable anonymous access.",
                detected_by="smbmap"
            )
            vulns.append(vuln)

        if "Anonymous" in output or "null session" in output.lower():
            vuln = Vulnerability(
                device_id=device_id,
                scan_id=scan_id,
                title=f"SMB Anonymous Login Allowed on {ip}",
                description="SMB allows anonymous/null session login.",
                cvss_score=9.0,
                severity=Severity.CRITICAL,
                affected_port=445,
                affected_service="smb",
                remediation="Disable null sessions. Require authentication for all SMB access.",
                detected_by="smbmap"
            )
            vulns.append(vuln)

        return vulns
