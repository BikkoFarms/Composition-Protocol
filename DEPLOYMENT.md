# Deployment Guide — Settleflow

This document provides complete, step-by-step deployment instructions for the **Settleflow** across all supported operational topologies:
1. **LocalNet / Demo Mode** (Zero external dependencies; in-memory Daml ACS simulation)
2. **Docker Compose Multi-Service Topology** (Containerized Backend, Frontend, and Oracle)
3. **Local Canton Participant Node / DevKit Sandbox** (Daml SDK 3.3.x on `:7575`)
4. **Shared HackCanton DevNet** (Remote Participant Node via JSON Ledger API v2 + Keycloak OIDC)

---

## 1. System Architecture & Component Ports

```
                          ┌──────────────────────────┐
                          │   Frontend Web App (UI)  │
                          │   Next.js 15 / React 19  │
                          │        Port: 3000        │
                          └────────────┬─────────────┘
                                       │ HTTP / JSON
                                       ▼
                          ┌──────────────────────────┐
                          │  Backend API Gateway     │
                          │  Express 4 / Node.js 22  │
                          │        Port: 4000        │
                          └──────┬────────────┬──────┘
                                 │            │
            HTTP Price Feeds /   │            │ Canton JSON Ledger API v2
            Asset Attestations   │            │ /v2/commands/submit-and-wait
                                 ▼            ▼
             ┌─────────────────────────┐  ┌─────────────────────────────────┐
             │ External Oracle Service │  │ Canton Participant Node         │
             │ Mock Feed (Port: 4002)  │  │ LocalNet: :7575                 │
             └─────────────────────────┘  │ DevNet: naas.noders.services     │
                                          └─────────────────────────────────┘
```

| Service | Technology | Default Port | Internal / Container Port |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript | `3000` (or `3100` dev) | `3000` |
| **Backend** | Express 4, TypeScript, tsx, Node.js 22 | `4000` | `4000` |
| **External Oracle** | Node.js HTTP Service | `4002` | `4002` |
| **Canton Ledger API** | Canton Participant JSON API v2 | `7575` (LocalNet) / Remote (DevNet) | `7575` |

---

## 2. Environment Variables Reference

Create a `.env` file in the `backend/` directory or export these variables in your shell environment:

| Variable | Required In | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | All modes | `4000` | Backend HTTP listening port |
| `LEDGER_MODE` | DevNet / LocalNet | `demo` | Set to `ledger` to enforce Canton participant connectivity |
| `LEDGER_API_URL` | DevNet / LocalNet | *None (demo store)* | HTTP endpoint for Canton JSON Ledger API v2 |
| `LEDGER_API_TOKEN` | DevNet / LocalNet | *None* | Pre-issued JWT Bearer token for participant commands |
| `DAML_PACKAGE_ID` | DevNet / LocalNet | `composition-local` | Package hash ID of uploaded `composition-0.1.0.dar` |
| `DAML_PACKAGE_NAME` | DevNet / LocalNet | `composition` | Package name defined in `daml/daml.yaml` |
| `OIDC_TOKEN_URL` | DevNet (OIDC) | `https://keycloak.naas.noders.services/...` | Keycloak OpenID Connect token URL |
| `OIDC_AUDIENCE` | DevNet (OIDC) | `https://hackcanton-01.devnet.naas...` | Target Canton ledger audience |
| `OIDC_CLIENT_ID` | DevNet (OIDC) | *None* | OAuth2 client identifier |
| `OIDC_CLIENT_SECRET` | DevNet (OIDC) | *None* | Client secret (if confidential client) |
| `OIDC_USERNAME` | DevNet (OIDC) | *None* | Username for Direct Grant flow |
| `OIDC_PASSWORD` | DevNet (OIDC) | *None* | Password for Direct Grant flow |
| `NEXT_PUBLIC_API_URL` | Frontend | `http://localhost:4000` | URL of backend API accessible by browser client |

---

## 3. Topology 1: Quickstart Local Demo Mode (Zero Dependencies)

This mode runs the entire stack locally without requiring an active Canton participant node or Docker daemon. The backend utilizes its high-fidelity in-memory Daml ACS simulation engine to enforce `R-ATOM-1/2` (atomicity), `R-PRIV-1/2/3` (sub-transaction privacy), and `R-GOV-1/2` (M-of-N governance).

### Step 1: Install Dependencies
```bash
# From workspace root:
npm run install:all
```

### Step 2: Launch All Services
Open three terminal windows (or run in background):

```bash
# Terminal 1: Backend API Gateway (Port 4000)
npm run dev:api

# Terminal 2: External Oracle Service (Port 4002)
npm run dev:oracle

# Terminal 3: Frontend Web Dashboard (Port 3000/3100)
npm run dev:web
```

### Step 3: Verify Health
Query the backend health check endpoint:
```bash
curl http://localhost:4000/health
```
**Expected Response:**
```json
{
  "ok": true,
  "mode": "demo",
  "ledgerConfigured": false,
  "ledgerReachable": null,
  "package": "composition-protocol",
  "design": "lattice"
}
```

### Step 4: Open Browser
Navigate to:
- Interactive Demo & Presentation: [http://localhost:3000/demo](http://localhost:3000/demo) (or port `:3100`)
- Multi-party Desks: `/proposer`, `/counterparty`, `/governance`, `/observer`, `/admin`, `/metrics`

---

## 4. Topology 2: Docker Compose Multi-Container Deployment

To deploy the backend, frontend, and oracle in isolated container environments:

### Step 1: Build & Launch Containers
```bash
docker compose up --build -d
```

### Step 2: Inspect Container Status
```bash
docker compose ps
```
All three services should show `Up`:
- `composition-protocol-backend-1` -> `0.0.0.0:4000->4000/tcp`
- `composition-protocol-frontend-1` -> `0.0.0.0:3000->3000/tcp`
- `composition-protocol-oracle-1` -> `0.0.0.0:4002->4002/tcp`

### Step 3: Monitor Logs
```bash
docker compose logs -f
```

### Step 4: Tear Down
```bash
docker compose down
```

---

## 5. Topology 3: Local Canton Sandbox / LocalNet Deployment

When developing with a local Canton participant instance (via Daml SDK 3.3.x or Canton DevKit):

### Step 1: Compile Daml Package (`.dar`)
Ensure the Daml SDK is installed ([DAML_SETUP.md](./docs/DAML_SETUP.md)):
```bash
cd daml
daml build
```
The compiled archive will be generated at: `daml/.daml/dist/composition-0.1.0.dar`.

### Step 2: Run Canton Participant Node
Start your local Canton node or sandbox:
```bash
daml sandbox --port 7575
# Or via canton standalone runner:
# canton -c canton.conf
```

### Step 3: Upload the DAR Package
Upload the compiled package using the Canton console or ledger CLI:
```bash
# Using daml ledger command:
daml ledger upload-dar --host localhost --port 7575 .daml/dist/composition-0.1.0.dar
```
Note the package ID emitted by the upload command (e.g., `8f4b23c...`).

### Step 4: Configure & Start Backend
In `backend/.env`:
```ini
PORT=4000
LEDGER_MODE=ledger
LEDGER_API_URL=http://localhost:7575
DAML_PACKAGE_ID=<your-dar-package-id>
DAML_PACKAGE_NAME=composition
```
Start the backend:
```bash
cd backend
npm run dev
```

### Step 5: Verify Ledger Connectivity
```bash
curl http://localhost:4000/health
```
**Expected Response:**
```json
{
  "ok": true,
  "mode": "ledger",
  "ledgerConfigured": true,
  "ledgerReachable": true,
  "ledgerUrl": "http://localhost:7575"
}
```

---

## 6. Topology 4: Shared HackCanton DevNet Deployment

For submission to the HackCanton Season 3 evaluation environment, point the backend at the shared Canton DevNet participant.

### Step 1: DevNet Network Endpoints
- **Participant JSON Ledger API v2:**  
  `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services`
- **Keycloak OIDC Token Endpoint:**  
  `https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token`
- **Audience:**  
  `https://hackcanton-01.devnet.naas.noders.services`

### Step 2: Upload DAR to DevNet Participant
Upload the `composition-0.1.0.dar` using the HackCanton participant administration console or authorized deployment endpoint. Record the resulting package ID.

### Step 3: Obtain OIDC Access Token
Set your team credentials in your shell or `.env`:
```bash
export OIDC_CLIENT_ID="hackcanton-participant-client"
export OIDC_USERNAME="<your-devnet-username>"
export OIDC_PASSWORD="<your-devnet-password>"
# Optional if confidential client:
export OIDC_CLIENT_SECRET="<your-secret>"

# Generate token using helper:
node scripts/oidc-token.mjs
```

### Step 4: Configure Backend Environment
Set the following environment variables:
```bash
export LEDGER_MODE=ledger
export LEDGER_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services
export OIDC_CLIENT_ID="<your-client-id>"
export OIDC_USERNAME="<your-username>"
export OIDC_PASSWORD="<your-password>"
export DAML_PACKAGE_ID="<uploaded-dar-package-id>"
export DAML_PACKAGE_NAME="composition"
```

The backend automatically acquires and refreshes tokens before submitting ledger commands via `acquireOidcToken()`.

### Step 5: Launch Backend and Web Client
```bash
npm run dev:api
npm run dev:web
```

---

## 7. Topology 5: Cloud Deployment on Render via Blueprint (`render.yaml`)

The repository includes a production-ready **Render Blueprint** ([`render.yaml`](../render.yaml)) that automatically configures and orchestrates all three services as free-tier or production web services with automated SSL, continuous deployment, and zero-downtime health-checked rollouts.

### Step 1: Push Code to GitHub
Ensure all code and the `render.yaml` file are committed and pushed to your GitHub repository (e.g. `BikkoFarms/Composition-Protocol` or your fork).

### Step 2: One-Click Blueprint Deployment on Render
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Connect your GitHub account and select the **`Composition-Protocol`** repository.
4. Render will parse `render.yaml` and display the 3 services to be created:
   - **`settleflow-frontend`**: Next.js 15 Web Service (`rootDir: frontend`, `npm install && npm run build`, `npm start`)
   - **`settleflow-backend`**: Express REST API & Canton Gateway (`rootDir: backend`, `npm install && npm run build`, `npm start`)
   - **`settleflow-oracle`**: Commodity Price & Attestation Service (`rootDir: .`, `node mocks/oracle/server.mjs`)
5. Click **Apply**. Render will automatically provision build environments, build all three applications, and deploy them.

### Step 3: Wire Frontend to Backend URL
By default, the client-side Next.js browser views require the public HTTPS address of your deployed backend:
1. In the Render Dashboard, open the **`settleflow-backend`** service and copy its public URL: `https://settleflow-backend-zcp7.onrender.com`.
2. Open the **`settleflow-frontend`** service -> **Environment** tab.
3. Verify or set the environment variables:
   ```env
   NEXT_PUBLIC_API_URL=https://settleflow-backend-zcp7.onrender.com
   NEXT_PUBLIC_ORACLE_URL=https://settleflow-oracle.onrender.com
   ```
4. Save and trigger a redeploy of the frontend (or let `render.yaml` apply them automatically).

### Live Production Endpoints
The live Settle Flow deployment is hosted at:
- **Frontend App**: [https://settleflow-frontend.onrender.com](https://settleflow-frontend.onrender.com)
- **Backend API Gateway**: [https://settleflow-backend-zcp7.onrender.com](https://settleflow-backend-zcp7.onrender.com)
- **Commodity Oracle**: [https://settleflow-oracle.onrender.com](https://settleflow-oracle.onrender.com)

### Step 4: Connecting Render to HackCanton Live DevNet (Optional)
If you wish to switch the backend on Render from high-fidelity demo mode to the shared HackCanton DevNet node:
1. In Render Dashboard, open **`settleflow-backend`** -> **Environment**.
2. Add the following variables:
   ```env
   LEDGER_MODE=ledger
   LEDGER_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services
   OIDC_TOKEN_URL=https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token
   OIDC_AUDIENCE=https://hackcanton-01.devnet.naas.noders.services
   OIDC_CLIENT_ID=<your-client-id>
   OIDC_CLIENT_SECRET=<your-client-secret>
   OIDC_USERNAME=<your-username>
   OIDC_PASSWORD=<your-password>
   DAML_PACKAGE_ID=<your-dar-package-id>
   DAML_PACKAGE_NAME=composition
   ```
3. Save changes. Render will automatically perform a rolling restart and connect directly to the live Canton DevNet participant.

---

## 8. Production Build & Optimization

For production grade deployments (e.g. AWS ECS, GCP Cloud Run, Kubernetes, or VPS):

### 1. Build Backend Production Artifact
```bash
cd backend
npm run build
```
Compiles TypeScript into pure JavaScript in `backend/dist/`. Run via:
```bash
NODE_ENV=production node dist/index.js
```

### 2. Build Frontend Production Bundle
```bash
cd frontend
npm run build
```
Generates optimized static pages and standalone server assets. Run via:
```bash
NODE_ENV=production npm start -- -p 3000
```

### 3. Process Supervision (systemd / PM2)
Example `ecosystem.config.cjs` for PM2:
```javascript
module.exports = {
  apps: [
    {
      name: "composition-backend",
      cwd: "./backend",
      script: "dist/index.js",
      env: {
        PORT: 4000,
        NODE_ENV: "production"
      }
    },
    {
      name: "composition-frontend",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://api.yourdomain.com"
      }
    },
    {
      name: "composition-oracle",
      cwd: "./",
      script: "mocks/oracle/server.mjs",
      env: {
        PORT: 4002
      }
    }
  ]
};
```

---

## 8. Security & Operational Hardening

1. **Party Authorization (`actAs`) Enforcement:**  
   Every ledger command submitted by `LedgerClient` explicitly scopes `actAs: [party]`. Signatory and controller rules in Daml smart contracts enforce that no party can execute choices on behalf of another party.
2. **Sub-Transaction Privacy:**  
   Canton privacy domains ensure that counterparties only receive contract projections for legs in which they participate. Non-participating parties or observers receive receipts where `visibleTokens: []`.
3. **Emergency Circuit Breaker:**  
   In the event of an oracle feed deviation, market disruption, or operational anomaly, invoke:
   ```bash
   curl -X POST http://localhost:4000/compositions/circuit-breaker/toggle \
     -H "Content-Type: application/json" \
     -d '{"caller":"Operator","reason":"Institutional emergency halt triggered"}'
   ```
   This immediately halts settlement execution protocol-wide until cleared.
4. **Institutional Governance Veto:**  
   Named governors can abort pending proposals before settlement occurs using:
   ```bash
   curl -X POST http://localhost:4000/compositions/governance/<composition-id>/veto \
     -H "Content-Type: application/json" \
     -d '{"governor":"Gov1","reason":"Risk limit exceeded"}'
   ```
