"""
Report Generator Service
Generates HTML and JSON structured vulnerability assessment reports.
"""

import os
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.scan import Scan
from app.models.device import Device
from app.models.vulnerability import Vulnerability, Severity
from app.models.report import Report
from app.core.config import settings

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3, Severity.INFO: 4}
SEVERITY_COLOR = {"critical": "#ff3366", "high": "#ff6600", "medium": "#ffaa00", "low": "#00aaff", "info": "#888888"}


class ReportGenerator:
    def __init__(self, db: Session):
        self.db = db

    def generate(self, scan: Scan, title: str = None) -> Report:
        os.makedirs(settings.REPORTS_DIR, exist_ok=True)

        devices = self.db.query(Device).filter(Device.scan_id == scan.id).all()
        vulns = self.db.query(Vulnerability).filter(Vulnerability.scan_id == scan.id)\
                       .order_by(Vulnerability.risk_score.desc()).all()

        report_title = title or f"Security Assessment Report — {scan.name}"
        
        findings = self._build_findings(devices, vulns)
        recommendations = self._build_recommendations(vulns)
        executive_summary = self._build_executive_summary(scan, vulns)

        # Generate HTML
        html_content = self._render_html(scan, devices, vulns, report_title)
        html_path = os.path.join(settings.REPORTS_DIR, f"report_{scan.id}.html")
        with open(html_path, "w") as f:
            f.write(html_content)

        # Generate JSON
        json_data = {
            "title": report_title,
            "generated_at": datetime.utcnow().isoformat(),
            "scan": {"id": scan.id, "name": scan.name, "target": scan.target_network},
            "findings": findings,
            "devices": [self._device_to_dict(d) for d in devices],
            "vulnerabilities": [self._vuln_to_dict(v) for v in vulns],
            "recommendations": recommendations,
        }
        json_path = os.path.join(settings.REPORTS_DIR, f"report_{scan.id}.json")
        with open(json_path, "w") as f:
            json.dump(json_data, f, indent=2, default=str)

        report = Report(
            scan_id=scan.id,
            title=report_title,
            executive_summary=executive_summary,
            findings_summary=findings,
            recommendations=recommendations,
            html_path=html_path,
            json_path=json_path,
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        logger.info(f"Report generated for scan {scan.id}")
        return report

    def _build_findings(self, devices, vulns) -> dict:
        return {
            "total_devices": len(devices),
            "total_vulnerabilities": len(vulns),
            "by_severity": {
                "critical": sum(1 for v in vulns if v.severity == Severity.CRITICAL),
                "high": sum(1 for v in vulns if v.severity == Severity.HIGH),
                "medium": sum(1 for v in vulns if v.severity == Severity.MEDIUM),
                "low": sum(1 for v in vulns if v.severity == Severity.LOW),
                "info": sum(1 for v in vulns if v.severity == Severity.INFO),
            },
            "exploitable": sum(1 for v in vulns if v.exploit_available),
            "devices_by_type": self._count_by_attr(devices, "device_type"),
        }

    def _build_recommendations(self, vulns) -> list:
        recs = []
        if any(v.severity == Severity.CRITICAL for v in vulns):
            recs.append("Immediately patch or isolate all assets with CRITICAL vulnerabilities.")
        if any(v.affected_port == 23 for v in vulns):
            recs.append("Disable Telnet on all network devices. Replace with SSH.")
        if any(v.affected_port == 21 for v in vulns):
            recs.append("Disable FTP anonymous access. Use SFTP or SCP instead.")
        if any(v.cve_id == "CVE-2017-0144" for v in vulns):
            recs.append("Apply MS17-010 patch immediately. Disable SMBv1 across all Windows hosts.")
        if any(v.affected_port == 3389 for v in vulns):
            recs.append("Restrict RDP access behind VPN. Patch for BlueKeep (CVE-2019-0708).")
        if any(v.affected_port in [3306, 5432, 6379] for v in vulns):
            recs.append("Bind all database services to localhost. Never expose DB ports to the network.")
        recs.append("Conduct regular penetration testing (quarterly recommended).")
        recs.append("Implement network segmentation to reduce lateral movement risk.")
        return recs

    def _build_executive_summary(self, scan, vulns) -> str:
        c = sum(1 for v in vulns if v.severity == Severity.CRITICAL)
        h = sum(1 for v in vulns if v.severity == Severity.HIGH)
        return (
            f"An automated security assessment was performed against {scan.target_network}. "
            f"The scan identified {len(vulns)} vulnerability findings across the target network, "
            f"including {c} critical and {h} high severity issues. "
            f"Immediate remediation is recommended for all critical and high severity findings."
        )

    def _render_html(self, scan, devices, vulns, title) -> str:
        vuln_rows = ""
        for v in vulns:
            color = SEVERITY_COLOR.get(v.severity.value if hasattr(v.severity, 'value') else str(v.severity), "#888")
            vuln_rows += f"""
            <tr>
              <td><code style="color:#00ff9d">{v.cve_id or "—"}</code></td>
              <td>{v.title}</td>
              <td><span style="color:{color};font-weight:bold;text-transform:uppercase">{v.severity.value if hasattr(v.severity,'value') else v.severity}</span></td>
              <td>{v.cvss_score}</td>
              <td style="color:#ff9900;font-weight:bold">{v.risk_score}</td>
              <td>{v.affected_service or "—"}:{v.affected_port or "—"}</td>
              <td>{"✓ YES" if v.exploit_available else "No"}</td>
            </tr>"""

        device_rows = ""
        for d in devices:
            ports = ", ".join(str(p["port"]) for p in (d.open_ports or [])[:10])
            device_rows += f"""
            <tr>
              <td><code style="color:#00ff9d">{d.ip_address}</code></td>
              <td>{d.hostname or "—"}</td>
              <td>{d.device_type.value if hasattr(d.device_type,'value') else d.device_type}</td>
              <td>{d.os_name or "Unknown"}</td>
              <td>{d.mac_address or "—"}</td>
              <td>{ports}</td>
            </tr>"""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@400;600;700&display=swap');
  :root {{--bg:#0a0e1a;--surface:#111827;--border:#1f2d3d;--primary:#00ff9d;--danger:#ff3366;--warn:#ffaa00;--text:#c8d6e5;}}
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:'Rajdhani',sans-serif;background:var(--bg);color:var(--text);padding:40px;}}
  h1{{font-size:2.2em;color:var(--primary);border-bottom:2px solid var(--primary);padding-bottom:16px;margin-bottom:32px;letter-spacing:2px;}}
  h2{{color:var(--primary);font-size:1.4em;margin:32px 0 16px;letter-spacing:1px;}}
  .meta{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;}}
  .card{{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:20px;text-align:center;}}
  .card .num{{font-size:2.5em;font-weight:700;font-family:'JetBrains Mono',monospace;}}
  .card .lbl{{font-size:0.85em;opacity:0.6;margin-top:4px;}}
  .critical{{color:#ff3366}}.high{{color:#ff6600}}.medium{{color:#ffaa00}}.low{{color:#00aaff}}
  table{{width:100%;border-collapse:collapse;margin-bottom:24px;font-family:'JetBrains Mono',monospace;font-size:0.85em;}}
  th{{background:var(--surface);color:var(--primary);padding:12px;text-align:left;border-bottom:2px solid var(--primary);}}
  td{{padding:10px 12px;border-bottom:1px solid var(--border);}}
  tr:hover td{{background:rgba(0,255,157,0.03);}}
  .summary{{background:var(--surface);border-left:4px solid var(--primary);padding:20px;border-radius:4px;margin-bottom:24px;line-height:1.8;}}
  .rec{{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px 16px;margin-bottom:8px;}}
  .rec::before{{content:"▶ ";color:var(--primary);}}
  footer{{margin-top:48px;opacity:0.4;font-size:0.8em;text-align:center;font-family:'JetBrains Mono',monospace;}}
</style>
</head>
<body>
<h1>⬡ {title}</h1>
<div class="meta">
  <div class="card"><div class="num" style="color:var(--primary)">{scan.hosts_discovered}</div><div class="lbl">Hosts Discovered</div></div>
  <div class="card"><div class="num critical">{scan.critical_count}</div><div class="lbl">Critical</div></div>
  <div class="card"><div class="num" style="color:#ff6600">{scan.high_count}</div><div class="lbl">High</div></div>
  <div class="card"><div class="num" style="color:#ffaa00">{scan.overall_risk_score:.1f}</div><div class="lbl">Risk Score /10</div></div>
</div>
<h2>Executive Summary</h2>
<div class="summary">An automated security assessment was performed against <strong style="color:var(--primary)">{scan.target_network}</strong>. {len(vulns)} vulnerability findings were identified across the target network, including <span class="critical">{scan.critical_count} CRITICAL</span> and <span class="high">{scan.high_count} HIGH</span> severity issues.</div>
<h2>Discovered Devices</h2>
<table><thead><tr><th>IP Address</th><th>Hostname</th><th>Type</th><th>OS</th><th>MAC</th><th>Open Ports</th></tr></thead><tbody>{device_rows}</tbody></table>
<h2>Vulnerability Findings</h2>
<table><thead><tr><th>CVE</th><th>Title</th><th>Severity</th><th>CVSS</th><th>Risk Score</th><th>Service:Port</th><th>Exploit</th></tr></thead><tbody>{vuln_rows}</tbody></table>
<h2>Recommendations</h2>
{''.join(f'<div class="rec">{r}</div>' for r in self._build_recommendations(vulns))}
<footer>Generated by PenTest Automation Platform v1.0 | {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")} | For authorized lab use only</footer>
</body></html>"""

    def _device_to_dict(self, d):
        return {"id": d.id, "ip": d.ip_address, "hostname": d.hostname, "type": str(d.device_type), "os": d.os_name, "mac": d.mac_address}

    def _vuln_to_dict(self, v):
        return {"id": v.id, "cve": v.cve_id, "title": v.title, "severity": str(v.severity), "cvss": v.cvss_score, "risk": v.risk_score, "port": v.affected_port, "service": v.affected_service, "exploit": bool(v.exploit_available)}

    def _count_by_attr(self, items, attr):
        result = {}
        for item in items:
            val = str(getattr(item, attr, "unknown"))
            result[val] = result.get(val, 0) + 1
        return result
