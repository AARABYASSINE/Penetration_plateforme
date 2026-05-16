<<<<<<< HEAD
# ⬡ PenTest Automation Platform v1.0

> Intelligent web-based penetration testing automation platform for controlled lab environments.

** WARNING: For authorized lab environments only. Unauthorized scanning is illegal.**

---

##  Architecture

```
pentest-platform/
├── backend/                   # FastAPI + Python
│   ├── app/
│   │   ├── main.py            # FastAPI app + CORS + lifespan
│   │   ├── core/
│   │   │   ├── config.py      # Settings (pydantic-settings)
│   │   │   └── database.py    # SQLAlchemy engine + session
│   │   ├── models/            # SQLAlchemy ORM models
│   │   │   ├── device.py      # Device, DeviceType
│   │   │   ├── vulnerability.py # Vulnerability, Severity
│   │   │   ├── scan.py        # Scan, ScanStatus, ScanType
│   │   │   └── report.py      # Report, ReportFormat
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── api/routes/        # REST API endpoints
│   │   │   ├── scans.py       # POST/GET/DELETE /scans
│   │   │   ├── devices.py     # GET /devices
│   │   │   ├── vulnerabilities.py
│   │   │   ├── reports.py
│   │   │   └── topology.py
│   │   └── services/
│   │       ├── scanner.py     # Nmap integration + vuln detection
│   │       ├── topology.py    # NetworkX graph + centrality
│   │       ├── risk_scoring.py # Custom CVSS + centrality formula
│   │       └── report_generator.py # HTML + JSON reports
│   ├── scripts/
│   │   └── scapy_discovery.py # Standalone ARP sweep
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                  # React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       # Overview + charts
│       │   ├── ScansPage.jsx       # Scan management
│       │   ├── TopologyView.jsx    # 3D network graph
│       │   ├── DevicesPage.jsx     # Device inventory
│       │   ├── VulnerabilitiesPage.jsx
│       │   └── ReportsPage.jsx
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── TopBar.jsx
│       │   └── ScanModal.jsx
│       └── services/api.js    # Axios API client
│
├── docker-compose.yml
└── README.md
```

---

##  Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone and launch
git clone https://github.com/yourname/pentest-platform.git
cd pentest-platform

# Copy env file
cp backend/.env.example backend/.env

# Launch all services
docker-compose up --build

# Access:
# Frontend → http://localhost:3000
# API Docs → http://localhost:8000/api/docs
```

### Option 2: Manual Setup

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Set up PostgreSQL
createdb pentestdb
psql pentestdb -c "CREATE USER pentest WITH PASSWORD 'pentest123';"
psql pentestdb -c "GRANT ALL ON DATABASE pentestdb TO pentest;"

# Configure .env
cp .env.example .env
# Edit DATABASE_URL if needed

# Start backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/scans` | Launch a new scan |
| `GET`  | `/api/v1/scans` | List all scans |
| `GET`  | `/api/v1/scans/{id}` | Get scan details |
| `DELETE` | `/api/v1/scans/{id}` | Delete scan |
| `GET`  | `/api/v1/devices` | List devices (filter: scan_id, device_type) |
| `GET`  | `/api/v1/devices/{id}` | Get device details |
| `GET`  | `/api/v1/vulnerabilities` | List vulns (filter: severity, status) |
| `PATCH` | `/api/v1/vulnerabilities/{id}/status` | Update vuln status |
| `POST` | `/api/v1/vulnerabilities/import` | Bulk import vulns |
| `POST` | `/api/v1/reports/generate` | Generate report |
| `GET`  | `/api/v1/reports/{id}/html` | View HTML report |
| `GET`  | `/api/v1/topology/{scan_id}` | Get topology graph data |

Full interactive docs: `http://localhost:8000/api/docs`

---

##  Risk Scoring Formula

Enhanced risk formula beyond standard CVSS:

```
RiskScore = (w1 × CVSS_norm) + (w2 × Centrality) + (w3 × AttackPathProbability)

Where:
  CVSS_norm           = cvss_score / 10
  Centrality          = device graph centrality (betweenness + degree), 0–1
  AttackPathProbability = heuristic: exploit availability + exposure + device criticality
  
  Default weights: w1=0.4, w2=0.3, w3=0.3  (configurable in .env)

Final score: 0–10
```

---

##  Scan Types

| Type | Description | Duration |
|------|-------------|----------|
| `quick` | Ping sweep + top 100 ports | ~2 min |
| `standard` | Full port scan + service/OS detection | ~10 min |
| `deep` | Full scan + NSE vulnerability scripts | ~30 min |
| `stealth` | SYN scan, low noise | ~15 min |

---

## Database Schema

```
scans          (id, name, target_network, scan_type, status, progress, topology_data, ...)
  └── devices  (id, scan_id, ip, mac, hostname, device_type, os_name, open_ports, ...)
        └── vulnerabilities (id, device_id, scan_id, cve_id, title, severity, cvss_score, risk_score, ...)
  └── reports  (id, scan_id, title, executive_summary, findings_summary, html_path, ...)
```

---

##  Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query |
| Visualization | react-force-graph-3d (Three.js), Recharts |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 16 |
| Scanning | python-nmap, Scapy |
| Graph Analysis | NetworkX |
| Deployment | Docker, Docker Compose |

---

##  Roadmap (v2.0)

- [ ] OpenVAS / Nikto integration
- [ ] Real-time scan progress via WebSockets
- [ ] CVE database sync (NVD API)
- [ ] Attack path visualization in topology
- [ ] Multi-user authentication (JWT)
- [ ] Scheduled scans (cron)
- [ ] Nmap XML / Nikto CSV import
- [ ] PDF report export
- [ ] Asset criticality tagging

---

##  Legal Disclaimer

This tool is designed **exclusively for authorized penetration testing in controlled lab environments**. 
Users are solely responsible for ensuring they have explicit written authorization before scanning any network.
Unauthorized network scanning may violate laws including the Computer Fraud and Abuse Act (CFAA) and similar legislation worldwide.

---

*PenTest Automation Platform v1.0 — Academic cybersecurity project*
=======
# penetration_plateforme
>>>>>>> 31a5d54c9c075875f623dbe4631a66dc25445111
