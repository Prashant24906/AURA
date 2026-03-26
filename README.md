# AURA — Automated Urban Response Analytics

> **Urban Intelligence, Automated.** A full-stack AI-powered smart city platform for real-time detection and management of urban incidents — fire, garbage, potholes, illegal parking, and traffic congestion.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Client (Vite)                     │
│  Dashboard │ Live Feed │ Incidents │ Analytics │ Upload      │
│  Socket.IO Client (real-time alerts)  │  Axios HTTP          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP + WebSocket
┌────────────────────▼────────────────────────────────────────┐
│                   Express API (Node.js)                      │
│  /api/auth │ /api/incidents │ /api/upload │ /api/analytics   │
│  JWT Auth   │  Rate Limiting │  Multer     │  Socket.IO       │
└──────────┬────────────────────────────┬───────────────────  ┘
           │                            │
┌──────────▼──────────┐    ┌───────────▼───────────────────  ┐
│   MongoDB Atlas      │    │        ML Bridge                 │
│   (Mongoose ODM)     │    │  Python subprocess → predict.py  │
│  User │ Incident     │    │  ├── Fire_Detection_Model         │
│  Alert               │    │  ├── Garbage_Detection_Model      │
└─────────────────────┘    │  ├── PotHole_Detection_Model      │
                            │  ├── Parking_Detection_Model      │
                            │  └── Traffic_Detection_Model      │
                            └──────────────────────────────────┘
```

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Python 3.9+** — [python.org](https://python.org)
- **MongoDB Atlas** account — [mongodb.com/atlas](https://mongodb.com/atlas)
- **npm 9+**

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/aura.git
cd aura

# 2. Install all dependencies (root + client + server)
npm run install:all

# 3. Configure environment
cp .env.example server/.env
# Edit server/.env — set your MONGODB_URI from MongoDB Atlas

# 4. Start development servers
npm run dev
```

The app will be available at:
- **Client:** http://localhost:5173
- **API:** http://localhost:5000/api

---

## Seed Data

Populate the database with demo users and 50 mock incidents:

```bash
cd server
node seed.js
```

**Demo Credentials:**
| User | Email | Password |
|------|-------|----------|
| Admin | admin@aura.city | Admin@123 |
| Operator 1 | operator1@aura.city | Operator@1 |
| Operator 2 | operator2@aura.city | Operator@2 |

---

## API Documentation

### Auth Routes (`/api/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Create new user account | No |
| POST | `/login` | Login → JWT access + refresh token | No |
| POST | `/logout` | Invalidate refresh token | Yes |
| POST | `/refresh` | Get new access token via cookie | No |
| GET | `/me` | Get current user profile | Yes |
| PATCH | `/profile` | Update user profile | Yes |

### Incidents Routes (`/api/incidents`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List incidents (filter: type, status, severity, zone) | Yes |
| GET | `/:id` | Get single incident | Yes |
| POST | `/` | Create incident manually | Yes |
| PATCH | `/:id/status` | Update incident status | Yes |
| PATCH | `/:id/assign` | Assign incident to user | Yes |
| DELETE | `/:id` | Delete incident (admin only) | Yes |

### Upload Routes (`/api/upload`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/analyze` | Upload → all 5 models → create incidents | Yes |
| POST | `/analyze/:modelType` | Upload → single model | Yes |

### Analytics Routes (`/api/analytics`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/summary` | Counts by type and severity | Yes |
| GET | `/trends` | Incidents per day (last N days) | Yes |
| GET | `/by-zone` | Incidents grouped by zone | Yes |
| GET | `/model-performance` | Avg confidence per model | Yes |
| GET | `/resolution-time` | Avg resolution time per type | Yes |

---

## ML Model Integration

Each model must expose a `predict.py` at its root directory.

**Calling convention:**
```bash
python Fire_Detection_Model/predict.py /absolute/path/to/image.jpg
```

**Expected stdout (single JSON line):**
```json
{"detected": true, "confidence": 0.923, "label": "fire_detected", "bbox": [120, 80, 340, 260]}
```

**Severity mapping:**
- `confidence >= 0.85` → **critical**
- `0.65 – 0.85` → **high**
- `0.45 – 0.65` → **medium**
- `< 0.45` → **low**

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB Atlas connection string | — |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | — |
| `JWT_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `CLIENT_URL` | CORS allowed origin | `http://localhost:5173` |
| `PYTHON_PATH` | Python binary path | `python3` |
| `VITE_API_URL` | API base URL (client) | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Socket.IO URL (client) | `http://localhost:5000` |

---

## Screenshots

> Coming soon

---

## License

MIT — Copyright © 2025 AURA Platform
