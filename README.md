# Incident Management Platform

A real-time incident management platform built with WebSocket-powered live updates, when an incident fires, every connected browser sees it appear instantly without polling. Engineers can simulate P1, P2, and P3 incidents directly from the dashboard or create custom incidents with a specific title, service, and severity. Incidents are routed by severity with different SQS delay-timer escalation chains, an on-call schedule with weekly rotation and override capability determines who gets paged, and the incident lifecycle flows through TRIGGERED → ACKNOWLEDGED → RESOLVED with a post-mortem editor at resolution. The Incidents page tracks MTTD and MTTR metrics across all incidents with severity and status filters. The Next.js frontend is hosted on Vercel with automatic HTTPS and redeployment on every push. The entire AWS backend is provisioned via Terraform with a GitHub Actions CI/CD pipeline.

---
## Live Demo

**[Open Incident Management Platform →](https://incident-management-platform.vercel.app/)**

Click **P1**, **P2**, or **P3** on the dashboard to simulate an incident and watch it appear in real time via WebSocket. Or click **+ Custom** to create an incident with a specific title, service, and severity.

---

## What It Does

- **Real-time incident feed** — AWS API Gateway WebSocket API pushes incident events to all connected browsers instantly — no polling
- **Severity-based routing** — P1 pages immediately and escalates after 5 minutes, P2 escalates after 10 minutes, P3 goes to feed only
- **SQS escalation timers** — unacknowledged incidents automatically escalate to the secondary on-call engineer via SQS message delay timers
- **Incident state machine** — explicit TRIGGERED → ACKNOWLEDGED → RESOLVED transitions with timestamps, acknowledged-by tracking, and immutable event log
- **On-call schedule** — weekly rotation with override capability, week navigation to view future rotations, and full contact details per engineer
- **Post-mortem editor** — structured root cause analysis written and saved at resolution time, persisted in DynamoDB
- **MTTD / MTTR metrics** — Mean Time To Acknowledge and Mean Time To Resolve calculated across all resolved incidents
- **Incident filters** — filter by severity (P1/P2/P3) and status (TRIGGERED/ACKNOWLEDGED/RESOLVED)
- **Simulate incidents** — trigger realistic P1/P2/P3 incidents with randomized titles and services, or create custom incidents with a specific title, service, and severity
- **WebSocket reconnection** — automatic reconnect with 3-second backoff if the connection drops

---

## Architecture

```
                    ┌──────────────────────────────────────────────────────┐
                    │                       AWS                            │
                    │                                                      │
  Browser ──────────► REST API Gateway → Lambda — incident_api            │
                    │  POST /incidents → incident_handler Lambda           │
                    │  PUT /incidents/{id}/acknowledge                     │
                    │  PUT /incidents/{id}/resolve                         │
                    │  GET /incidents, /dashboard, /oncall                 │
                    │         │                                            │
                    │         ▼                                            │
                    │  Lambda — incident_handler                           │
                    │  ├── Creates incident record (TRIGGERED state)       │
                    │  ├── Determines on-call engineer via rotation        │
                    │  ├── Schedules escalation via SQS delay timer        │
                    │  └── Invokes broadcaster Lambda (async)              │
                    │         │                                            │
                    │         ├── SQS Escalation Queue (delay timer)       │
                    │         │        │                                   │
                    │         │        ▼ (after 5/10 min delay)            │
                    │         │   Lambda — escalation_handler              │
                    │         │   Checks if still TRIGGERED                │
                    │         │   Updates to next on-call engineer         │
                    │         │   Invokes broadcaster Lambda               │
                    │         │                                            │
                    │         └── Lambda — broadcaster                     │
                    │              Scans DynamoDB for active connections   │
                    │              Posts to all via WebSocket API          │
                    │              Cleans up stale GoneException conns     │
                    │                                                      │
  Browser ──────────► WebSocket API Gateway                               │
  (persistent        ├── $connect → websocket_handler Lambda              │
   connection)       ├── $disconnect → websocket_handler Lambda           │
                    │  └── Stores connection IDs in DynamoDB with TTL     │
                    │                                                      │
                    │  DynamoDB (incident-mgmt-data)                      │
                    │  INCIDENT#{id} METADATA — full incident record       │
                    │  CONN#{id} CONNECTION — active WebSocket connections │
                    │                                                      │
                    │  CloudWatch Alarm — API error rate                  │
                    │  Terraform State → S3 Backend                        │
                    └──────────────────────────────────────────────────────┘

GitHub push → GitHub Actions (Terraform backend deploy)
           → Vercel (Next.js frontend auto-deploy on every push)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query |
| Hosting | Vercel (automatic HTTPS, global CDN, auto-deploy on push) |
| Real-time | AWS API Gateway WebSocket API |
| Queue | AWS SQS (escalation delay timers) |
| Compute | AWS Lambda (Python 3.11) — incident handler, escalation handler, API, WebSocket handler, broadcaster |
| Database | AWS DynamoDB (PAY_PER_REQUEST) |
| REST API | AWS API Gateway (REST) |
| Observability | AWS CloudWatch Alarms |
| Infrastructure as Code | Terraform (S3 remote state) |
| CI/CD | GitHub Actions (backend) + Vercel (frontend) |

---

## Project Structure

```
incident-management-platform/
├── .github/
│   └── workflows/
│       └── deploy.yml                  # CI/CD — Terraform backend deploy
├── frontend/
│   ├── app/
│   │   ├── components/
│   │   │   ├── EscalationTimer.tsx     # Countdown timer with auto-escalation display
│   │   │   ├── IncidentCard.tsx        # Incident summary with severity + escalation timer
│   │   │   ├── SeverityBadge.tsx       # P1/P2/P3 colored severity badge
│   │   │   └── StatusBadge.tsx         # TRIGGERED/ACKNOWLEDGED/RESOLVED with pulsing dot
│   │   ├── incidents/
│   │   │   ├── page.tsx                # All incidents with MTTD/MTTR + severity/status filters
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Incident detail — actions, timeline, post-mortem
│   │   ├── oncall/
│   │   │   └── page.tsx                # On-call schedule with override + week navigation
│   │   ├── layout.tsx                  # Dark theme nav + React Query provider
│   │   ├── page.tsx                    # Dashboard — stats, simulate + custom incident, live feed
│   │   └── providers.tsx
│   └── .env.production                 # NEXT_PUBLIC_API_URL + NEXT_PUBLIC_WS_URL (set in Vercel)
├── lambda/
│   ├── incident_handler.py             # Create incident, determine on-call, schedule escalation
│   ├── escalation_handler.py           # SQS-triggered, escalates unacknowledged incidents
│   ├── incident_api.py                 # REST handler — CRUD, acknowledge, resolve, postmortem
│   ├── websocket_handler.py            # Manage WebSocket connect/disconnect, store in DynamoDB
│   └── broadcaster.py                  # Push events to all active WebSocket connections
├── terraform/
│   ├── main.tf                         # DynamoDB, SQS, Lambda x5, REST + WebSocket API Gateway, IAM
│   ├── variables.tf
│   └── outputs.tf                      # REST API URL, WebSocket URL, queue URL
├── .gitignore
└── README.md
```

---

## Incident Lifecycle

```
1. TRIGGERED
   ├── Incident created in DynamoDB
   ├── Primary on-call engineer identified via weekly rotation
   ├── Escalation job enqueued in SQS with delay timer (P1: 5min, P2: 10min)
   └── All connected browsers notified via WebSocket instantly

2. ESCALATION (if unacknowledged)
   ├── SQS delay timer fires after 5 or 10 minutes
   ├── escalation_handler checks if still TRIGGERED
   ├── If yes → updates incident with secondary on-call engineer
   └── Broadcasts INCIDENT_ESCALATED event via WebSocket

3. ACKNOWLEDGED
   ├── Engineer clicks acknowledge with their name
   ├── Status transitions to ACKNOWLEDGED — escalation stops
   ├── acknowledged_by and acknowledged_at recorded
   └── MTTD calculated from created_at to acknowledged_at

4. RESOLVED
   ├── Engineer clicks resolve after fixing the issue
   ├── Post-mortem written and saved to DynamoDB
   ├── Status transitions to RESOLVED
   └── MTTR calculated from created_at to resolved_at
```

---

## Severity Routing

| Severity | Description | Escalation |
|---|---|---|
| P1 | Critical — complete outage or data loss | Immediate page + escalate after 5 min |
| P2 | High — major feature degraded | Immediate page + escalate after 10 min |
| P3 | Low — minor issue, non-critical | Feed notification only — no escalation |

---

## On-Call Schedule

Weekly rotation across three engineers with automatic handoff every Monday:

| Engineer | Timezone | Contact |
|---|---|---|
| Ahnaf Hyder | EST | +1 (716) 555-0142 |
| Alex Chen | PST | +1 (415) 555-0198 |
| Sarah Kim | CST | +1 (312) 555-0167 |

Features:
- **Week navigation** — view who is on-call next week or any future week
- **Override** — temporarily set a different primary on-call without changing the rotation
- **Contact details** — name, email, phone, and timezone per engineer

---

## Key Metrics

**MTTA — Mean Time To Acknowledge**
Average time between incident creation and first acknowledgment. Indicates how responsive the on-call team is to alerts.

**MTTR — Mean Time To Resolve**
Average time between incident creation and full resolution. The most important SRE metric tracked by engineering teams to measure incident response maturity.

---

## API Reference

### POST /incidents
Creates a new incident and triggers the full pipeline.
```json
{
  "action": "create",
  "title": "Database connection pool exhausted",
  "severity": "P1",
  "service": "RDS",
  "source": "simulation"
}
```

### GET /incidents
Returns all incidents ordered by most recent.

### GET /incidents/{id}
Returns full incident detail including timeline, on-call engineers, and post-mortem.

### PUT /incidents/{id}/acknowledge
```json
{"acknowledged_by": "Ahnaf Hyder"}
```

### PUT /incidents/{id}/resolve
```json
{"postmortem": "Root cause was a connection leak introduced in v2.4.1..."}
```

### GET /dashboard
Returns aggregate stats — total, triggered, acknowledged, resolved, recent incidents.

### GET /oncall
Returns current weekly rotation with primary, secondary, and tertiary engineers.

### WebSocket — wss://your-endpoint/prod
Connect to receive real-time push events:
- `INCIDENT_CREATED` — new incident fired
- `INCIDENT_ACKNOWLEDGED` — engineer acknowledged
- `INCIDENT_ESCALATED` — escalated to secondary on-call
- `INCIDENT_RESOLVED` — incident resolved

---

## How to Deploy

### Prerequisites
- AWS account with CLI configured
- Terraform installed
- Node.js 20+ installed
- Vercel account and CLI (`npm install -g vercel`)

### Steps

**1. Create Terraform state bucket**
```bash
aws s3 mb s3://imp-tfstate-ahnaf --region us-east-1
```

**2. Update bucket name in terraform/main.tf**

**3. Create GitHub repo and add secrets**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**4. Initialize Terraform**
```bash
cd terraform && terraform init && cd ..
```

**5. Push to GitHub — CI/CD deploys the backend**
```bash
git add . && git commit -m "Initial commit" && git push origin master
```

**6. Deploy frontend to Vercel**
```bash
cd frontend && vercel --prod
```

**7. Add environment variables in Vercel**
- `NEXT_PUBLIC_API_URL` — REST API URL from GitHub Actions output
- `NEXT_PUBLIC_WS_URL` — WebSocket URL from GitHub Actions output (starts with wss://)

**8. Redeploy Vercel**
```bash
vercel --prod
```

---

## Screenshots

**Dashboard — WebSocket connected, simulate buttons, live event feed:**

<img width="1208" height="740" alt="Dashboard" src="https://github.com/user-attachments/assets/759aed2e-b315-446d-a763-502f89476655" />

**P1 incident detail — escalation timer, on-call rotation, acknowledge action:**

<img width="1178" height="806" alt="P1 Incident" src="https://github.com/user-attachments/assets/8fbd28fa-f37c-465e-9ccb-b0fb716ad15b" />

**Post-mortem editor — structured root cause analysis:**

<img width="729" height="891" alt="Post mortem edit" src="https://github.com/user-attachments/assets/b003dd38-b579-49dd-bce8-be4c27a7a351" />

**On-call schedule — weekly rotation with override and week navigation:**

<img width="1197" height="750" alt="On call page" src="https://github.com/user-attachments/assets/fd1148ed-d1e9-4bc3-9665-1af9b1746b54" />

**Incidents list — MTTD/MTTR metrics and severity/status filters:**

<img width="1226" height="911" alt="Incident detail page" src="https://github.com/user-attachments/assets/3259b1a4-55f2-4cce-9ac8-5a9adfc16bcb" />




---

## Key Concepts Demonstrated

- **WebSocket API** — AWS API Gateway WebSocket API with persistent connections, connection management in DynamoDB with TTL-based cleanup, and a broadcaster Lambda that fans out to all active connections with automatic stale connection removal on `GoneException`
- **SQS delay timers** — escalation jobs enqueued with `DelaySeconds` matching severity-based SLA, automatically firing if the incident remains unacknowledged — no cron jobs or polling required
- **Incident state machine** — atomic TRIGGERED → ACKNOWLEDGED → RESOLVED transitions with immutable event log preserving the full incident timeline and all engineer actions
- **On-call rotation** — week-number-based rotation algorithm with temporary override capability and full contact detail management
- **MTTD / MTTR** — industry-standard SRE metrics calculated client-side from incident timestamps across all resolved incidents
- **Broadcast pattern** — broadcaster Lambda scans active WebSocket connections and posts to each via `apigatewaymanagementapi`, cleaning up stale connections automatically
- **WebSocket reconnection** — client-side automatic reconnect with 3-second backoff ensuring the live feed recovers from dropped connections without manual refresh
- **CI/CD split deployment** — GitHub Actions owns Terraform backend, Vercel owns Next.js frontend with automatic redeploy on every push to master
- **Infrastructure as code** — all AWS resources including the WebSocket API Gateway provisioned via Terraform with S3 remote state
- **Dark theme ops aesthetic** — consistent with real-world monitoring tools (PagerDuty, Datadog, Grafana) where dark theme is the industry standard for incident response interfaces
