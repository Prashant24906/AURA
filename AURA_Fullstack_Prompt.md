# AURA — Full-Stack Build Prompt
## Automated Urban Response Analytics

---

## PROJECT OVERVIEW

Build a complete, production-ready full-stack web application called **AURA** (Automated Urban Response Analytics). AURA is a smart city AI platform that uses computer vision models to detect and respond to urban issues in real time — fire, garbage, potholes, illegal parking, and traffic congestion. The platform receives feeds from city cameras, runs inference through 5 Python ML models, and presents actionable dashboards to city administrators and responders.

Think of the aesthetic as: **clean government-tech meets modern SaaS** — like Vercel's dashboard crossed with a high-stakes operations center. Dark navy + electric cyan accent. Monospace headings. Tight grid. Confident, no-nonsense. No gradients on backgrounds. No purple gradients. No generic AI look.

---

## TECH STACK

**Frontend:**
- React 18 + Vite
- React Router v6 (multi-page SPA)
- TailwindCSS (utility-first styling)
- Recharts (for data visualizations)
- Socket.IO client (real-time alerts)
- Axios (HTTP requests)

**Backend:**
- Node.js + Express.js (REST API)
- MongoDB Atlas + Mongoose (database)
- Socket.IO server (real-time push)
- JWT (authentication — access + refresh tokens)
- Multer (image/video upload)
- Python subprocess bridge (calls ML inference scripts)

**ML Models (Python — already exist, just integrate):**
- `Fire_Detection_Model/` — detects fire/smoke in images
- `Garbage_Detection_Model/` — detects garbage dumping
- `PotHole_Detection_Model/` — detects road potholes
- `Parking_Detection_Model/parking_module/` — detects illegal parking
- `Traffic_Detection_Model/` — classifies traffic congestion level

Each model accepts an image path as input and returns a JSON with `{ detected: bool, confidence: float, label: string, bbox: [x,y,w,h] }`.

---

## DESIGN SYSTEM (MANDATORY — follow exactly)

```
Font:        "Space Mono" (headings, stats, labels) + "DM Sans" (body, UI text)
Background:  #0A0E1A (deep navy)
Surface:     #111827 (card bg), #1C2333 (raised card)
Border:      #1E2D45 (subtle), #2A3F5F (visible)
Accent:      #00D4FF (electric cyan) — used for active states, key metrics, CTA buttons
Alert red:   #FF4757
Alert amber: #FFA502
Alert green: #2ED573
Text:        #E8EAF0 (primary), #8892A4 (muted), #4A5568 (disabled)
```

Font loading (add to index.html):
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
```

Global CSS rules:
- `border-radius` default: `6px` for inputs/badges, `10px` for cards, `14px` for panels
- All cards have `border: 1px solid #1E2D45` and `background: #111827`
- Active nav items get `border-left: 3px solid #00D4FF`
- Metric numbers use `font-family: 'Space Mono'`
- Status badges: small pill with colored dot + label, no filled background

---

## FILE & FOLDER STRUCTURE

```
AURA/
├── client/                        ← React frontend
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Topbar.jsx
│   │   │   │   └── PageWrapper.jsx
│   │   │   ├── ui/
│   │   │   │   ├── AlertCard.jsx
│   │   │   │   ├── StatCard.jsx
│   │   │   │   ├── DetectionBadge.jsx
│   │   │   │   ├── LiveFeedCard.jsx
│   │   │   │   └── ConfidenceBar.jsx
│   │   │   └── charts/
│   │   │       ├── IncidentTrendChart.jsx
│   │   │       ├── ModelPerformanceChart.jsx
│   │   │       └── HeatmapPlaceholder.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── LiveFeed.jsx
│   │   │   ├── Incidents.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Upload.jsx
│   │   │   └── Settings.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── AlertContext.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   ├── api.js              ← Axios instance
│   │   │   ├── authService.js
│   │   │   └── incidentService.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                        ← Node/Express backend
│   ├── config/
│   │   ├── db.js                  ← MongoDB connection
│   │   └── constants.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── incidentController.js
│   │   ├── uploadController.js
│   │   └── analyticsController.js
│   ├── middleware/
│   │   ├── auth.js                ← JWT verify middleware
│   │   ├── upload.js              ← Multer config
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Incident.js
│   │   └── Alert.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── incidents.js
│   │   ├── upload.js
│   │   └── analytics.js
│   ├── services/
│   │   ├── mlBridge.js            ← Python subprocess runner
│   │   └── socketService.js
│   ├── uploads/                   ← Stored uploaded images
│   ├── app.js
│   ├── server.js
│   └── package.json
│
├── Fire_Detection_Model/
├── Garbage_Detection_Model/
├── PotHole_Detection_Model/
├── Parking_Detection_Model/
├── Traffic_Detection_Model/
├── .env.example
├── .gitignore
└── README.md
```

---

## DATABASE MODELS (MongoDB / Mongoose)

### User Model (`server/models/User.js`)
```js
{
  name: String (required),
  email: String (required, unique, lowercase),
  password: String (hashed, bcrypt),
  role: { type: String, enum: ['admin', 'operator', 'viewer'], default: 'operator' },
  department: String,
  lastLogin: Date,
  isActive: { type: Boolean, default: true },
  createdAt: Date (auto),
}
```

### Incident Model (`server/models/Incident.js`)
```js
{
  type: { type: String, enum: ['fire', 'garbage', 'pothole', 'parking', 'traffic'], required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'dismissed'], default: 'open' },
  location: {
    address: String,
    zone: String,
    coordinates: { lat: Number, lng: Number },
  },
  detectionData: {
    confidence: Number,          // 0.0 – 1.0
    label: String,
    bbox: [Number],              // [x, y, w, h]
    modelName: String,
  },
  imageUrl: String,              // path to stored image
  reportedBy: { type: ObjectId, ref: 'User' },
  assignedTo: { type: ObjectId, ref: 'User' },
  resolvedAt: Date,
  notes: String,
  createdAt: Date (auto),
  updatedAt: Date (auto),
}
```

### Alert Model (`server/models/Alert.js`)
```js
{
  incidentId: { type: ObjectId, ref: 'Incident' },
  message: String,
  type: { type: String, enum: ['fire', 'garbage', 'pothole', 'parking', 'traffic'] },
  severity: String,
  isRead: { type: Boolean, default: false },
  sentTo: [{ type: ObjectId, ref: 'User' }],
  createdAt: Date (auto),
}
```

---

## BACKEND API ROUTES

### Auth Routes (`/api/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Create new user account | No |
| POST | `/login` | Login, return JWT access + refresh token | No |
| POST | `/logout` | Invalidate refresh token | Yes |
| POST | `/refresh` | Get new access token via refresh token | No |
| GET | `/me` | Get current user profile | Yes |

### Incidents Routes (`/api/incidents`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all incidents (with filters: type, status, severity, date range, zone) | Yes |
| GET | `/:id` | Get single incident details | Yes |
| POST | `/` | Create incident manually | Yes |
| PATCH | `/:id/status` | Update incident status | Yes |
| PATCH | `/:id/assign` | Assign incident to user | Yes |
| DELETE | `/:id` | Delete incident (admin only) | Yes (admin) |

### Upload Routes (`/api/upload`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/analyze` | Upload image → run all 5 models → return detections + create incidents | Yes |
| POST | `/analyze/:modelType` | Upload image → run specific model only | Yes |

### Analytics Routes (`/api/analytics`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/summary` | Total counts by type and severity | Yes |
| GET | `/trends` | Incidents per day (last 30 days) | Yes |
| GET | `/by-zone` | Incidents grouped by zone/area | Yes |
| GET | `/model-performance` | Avg confidence per model | Yes |
| GET | `/resolution-time` | Avg time to resolve per type | Yes |

---

## BACKEND LOGIC DETAILS

### ML Bridge (`server/services/mlBridge.js`)
- Use Node.js `child_process.spawn` to run Python inference scripts
- Call each model's `predict.py` with image path as argument
- Parse stdout JSON response: `{ detected: bool, confidence: float, label: string, bbox: [x,y,w,h] }`
- If `detected: true`, automatically create an Incident in MongoDB
- Severity mapping: confidence > 0.85 → "critical", 0.65–0.85 → "high", 0.45–0.65 → "medium", <0.45 → "low"
- After creating incident, emit a Socket.IO event `new_alert` to all connected clients
- Handle Python script errors gracefully — if model fails, log and skip (don't crash)

```js
// Example mlBridge.js structure
async function runModel(modelName, imagePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../', modelName, 'predict.py');
    const process = spawn('python3', [scriptPath, imagePath]);
    let output = '';
    process.stdout.on('data', (data) => output += data.toString());
    process.stderr.on('data', (err) => console.error(`[${modelName}] stderr:`, err.toString()));
    process.on('close', (code) => {
      if (code !== 0) return resolve({ detected: false, error: `Exit code ${code}` });
      try { resolve(JSON.parse(output.trim())); }
      catch (e) { resolve({ detected: false, error: 'Parse error' }); }
    });
  });
}

async function analyzeImage(imagePath) {
  const models = [
    'Fire_Detection_Model',
    'Garbage_Detection_Model',
    'PotHole_Detection_Model',
    'Parking_Detection_Model/parking_module',
    'Traffic_Detection_Model'
  ];
  const results = await Promise.allSettled(models.map(m => runModel(m, imagePath)));
  return results.map((r, i) => ({
    model: models[i],
    ...(r.status === 'fulfilled' ? r.value : { detected: false })
  }));
}
```

### JWT Middleware (`server/middleware/auth.js`)
- Verify `Authorization: Bearer <token>` header
- Decode user `{ id, role }` and attach to `req.user`
- Reject with 401 if token missing or invalid

### Socket.IO Setup (`server/services/socketService.js`)
- On connection, authenticate via JWT passed in socket handshake `auth.token`
- Emit `new_alert` with incident data whenever a new incident is created
- Emit `incident_updated` when status changes
- Rooms: `admin`, `operator` — broadcast to relevant rooms based on role

---

## FRONTEND PAGES — FULL SPECS

### 1. Login Page (`/login`)

**Layout:** Full-screen centered, dark navy background. Left half: AURA logo (text-based, Space Mono, large) + tagline "Urban Intelligence, Automated." + small description. Right half on desktop: login card.

**Login Card:**
- `border: 1px solid #2A3F5F`, `background: #111827`, `border-radius: 14px`, `padding: 40px`
- "Welcome back" heading (DM Sans 24px medium)
- Email input + Password input (styled with dark background, cyan focus ring: `outline: 1px solid #00D4FF`)
- "Sign In" button: full width, `background: #00D4FF`, `color: #0A0E1A`, `font-family: Space Mono`, bold
- "Forgot password" link (muted)
- Show/hide password toggle
- On error: red inline message below the button

**Behavior:**
- POST to `/api/auth/login`
- Store access token in memory (React Context), refresh token in httpOnly cookie
- On success: redirect to `/dashboard`
- Show loading spinner on button while waiting

---

### 2. Sidebar Layout (`components/layout/Sidebar.jsx`)

Used on all authenticated pages. Fixed left sidebar, 240px wide.

**Top:** AURA logo + "v1.0" chip
**Nav items** (with icons from lucide-react):
- Dashboard → `/dashboard`
- Live Feed → `/live`
- Incidents → `/incidents`
- Analytics → `/analytics`
- Upload & Analyze → `/upload`
- Settings → `/settings`

**Bottom:** User avatar (initials circle), name, role badge. Logout button.

Active item styling: `background: rgba(0, 212, 255, 0.08)`, `border-left: 3px solid #00D4FF`, text `#00D4FF`.

**Topbar:** Shows page title, live clock (updates every second), and a bell icon with unread alert count badge driven by AlertContext.

---

### 3. Dashboard (`/dashboard`)

**Top row — 5 Stat Cards (one per detection type):**

| Card | Color | Shows |
|------|-------|-------|
| Fire Incidents | #FF4757 | Count today |
| Garbage Dumps | #FFA502 | Count today |
| Potholes Found | #FFA502 | Count today |
| Illegal Parking | #2ED573 | Count today |
| Traffic Alerts | #00D4FF | Count today |

Each StatCard: dark card, metric number in Space Mono 36px, label in DM Sans 13px muted, small % change vs yesterday below in green/red with arrow.

**Middle left (60% width) — Incident Trend Chart:**
- Line chart using Recharts, last 7 days
- 5 lines, one per detection type, each in its type color
- Custom dark tooltip, responsive container

**Middle right (40% width) — Recent Alerts Feed:**
- Scrollable list, max 8 visible items
- Each item: colored dot + type label + location + time ago + status badge
- New items animate in from the right via Socket.IO `new_alert` event
- Click to open full incident detail modal

**Bottom row — 3 equal-width cards:**
- **Model Confidence Average:** Horizontal bar per model, cyan fill, label + percentage right-aligned
- **Zone Activity:** Table of top 5 zones with incident counts and severity breakdown
- **Resolution Rate:** Big circular SVG progress ring showing % resolved today

---

### 4. Live Feed Page (`/live`)

**Layout:** 3-column CSS grid of camera feed cards.

**Each LiveFeedCard:**
- Dark card header: Zone name + Camera ID + green pulsing dot ("LIVE")
- Body: placeholder image area (grey rectangle with camera icon centered, or actual uploaded image)
- Below image: last detection result badge (e.g., "Fire detected — 94.2% confidence")
- Footer: timestamp of last scan + "Scan Now" button

**"Scan Now" button behavior:**
- Triggers POST `/api/upload/analyze/:modelType` with the zone's test image
- Shows loading spinner overlay on the card
- On result: updates the detection badge, pulse-animates the card border if detected

**Live alerts sidebar (right, 300px):**
- Real-time alerts from Socket.IO
- Each alert: type icon + message + time
- Auto-scrolls to latest item

---

### 5. Incidents Page (`/incidents`)

**Top bar:** Search input + filter dropdowns (Type, Status, Severity, Zone, Date Range) + Export CSV button.

**Main content:** Table with columns:
`ID | Type | Severity | Location | Status | Confidence | Reported At | Assigned To | Actions`

**Table rows:**
- Severity shown as colored badge: critical=red, high=amber, medium=yellow, low=gray
- Status badge: open=red, in_progress=amber, resolved=green, dismissed=gray
- Type shown as icon + label
- Actions: "View" button opens detail modal, "Update Status" dropdown inline

**Incident Detail Modal:**
- Full overlay, `background: rgba(0,0,0,0.7)` backdrop
- Left: uploaded image with detection bounding box drawn on HTML5 Canvas element
- Right: all metadata fields, status update dropdown, notes textarea, assign-to-user dropdown, Save button
- Close with X button or Escape key

**Pagination:** 20 per page, prev/next + page number buttons.

---

### 6. Analytics Page (`/analytics`)

**Top:** Date range selector — buttons for "Last 7 days", "Last 30 days", "Last 90 days", and a custom date picker. Selecting any option refetches all charts.

**Layout:** 2-column grid of chart panels.

**Charts (all using Recharts, dark-themed, cyan primary):**
1. **Incidents Over Time** — Area chart, stacked by type
2. **Type Distribution** — Donut/pie chart with custom legend
3. **Severity Breakdown** — Grouped bar chart by type and severity
4. **Model Confidence** — Radar chart showing average confidence per model
5. **Avg Resolution Time** — Horizontal bar chart per type (in hours)
6. **Zone Heatmap** — Custom SVG grid (10x10 cells), colored by incident density (darker = more incidents, use cyan scale)

Each chart panel: card with title, subtitle, and top-right export icon button.

---

### 7. Upload & Analyze Page (`/upload`)

**Layout:** Two equal panels side by side.

**Left Panel — Upload:**
- Large drag-and-drop zone with dashed border, cyan on drag-over
- Accepts: `.jpg`, `.jpeg`, `.png`
- Shows thumbnail preview after file selection with filename + file size
- "Select Model" group of toggle buttons: All Models / Fire / Garbage / Pothole / Parking / Traffic
- "Analyze Image" submit button (full width, cyan background)
- Progress bar during upload + analysis with percentage label

**Right Panel — Results:**
- Initially: placeholder "Awaiting analysis..." with subtle icon
- After analysis: for each model that detected something:
  - Model name header + detection type icon
  - ConfidenceBar component (animated fill)
  - Detection label + bbox coordinates
  - "Create Incident Report" button (creates incident via API)
- If nothing detected: "No threats detected" message in green

---

### 8. Settings Page (`/settings`)

**Tabs:** Profile | Team | Notifications | API Keys

**Profile tab:** Editable fields for name, email, department. Avatar showing initials. Save Changes button.

**Team tab (admin only):** Table of all users. Columns: Name, Email, Role, Last Login, Status (active/inactive). Actions: Edit Role (dropdown), Deactivate User.

**Notifications tab:** Toggle switches for which alert types send in-app notifications and email notifications.

**API Keys tab:** Masked API key display, Copy button (copies to clipboard), Regenerate button with confirmation dialog.

---

## FRONTEND COMPONENT SPECS

### StatCard (`components/ui/StatCard.jsx`)
```jsx
// Props: title, value, change (number, %), color, icon (React component)
// Layout: icon top-left with color tint, metric center in Space Mono 36px
// change > 0 = green with up arrow, change < 0 = red with down arrow
// Hover: slight border color lift to #2A3F5F
```

### AlertCard (`components/ui/AlertCard.jsx`)
```jsx
// Props: type, message, location, time, status, onClick
// Left: colored left border (3px, type color) + type icon
// Body: bold message, muted location below, time right-aligned
// Right: status badge (pill with dot)
// Hover: background lifts to #1C2333
```

### ConfidenceBar (`components/ui/ConfidenceBar.jsx`)
```jsx
// Props: value (0–1), color, label
// Bar fill animates from 0 to value on mount via CSS transition (duration 1s)
// Color: value > 0.8 = #00D4FF, value 0.5–0.8 = #FFA502, value < 0.5 = #FF4757
// Percentage label shown right-aligned next to bar
```

### DetectionBadge (`components/ui/DetectionBadge.jsx`)
```jsx
// Props: type ('fire'|'garbage'|'pothole'|'parking'|'traffic'), confidence
// Pill: colored dot + type label + confidence %
// Colors: fire=#FF4757, garbage=#FFA502, pothole=#FFA502, parking=#2ED573, traffic=#00D4FF
```

---

## SOCKET.IO EVENTS

**Server emits:**
- `new_alert` → `{ incident: IncidentObject, message: String }` — new incident created
- `incident_updated` → `{ id, status, updatedBy }` — status change
- `model_processing` → `{ imageId, progress: 0-100 }` — during multi-model analysis

**Client listens:**
- `new_alert` → push to AlertContext, show toast notification, increment topbar badge
- `incident_updated` → update incident in local state if currently displayed
- `model_processing` → update progress bar on Upload page

---

## AUTHENTICATION FLOW

1. User logs in → backend returns `accessToken` (15min expiry) + sets `refreshToken` in httpOnly cookie (7d)
2. Axios instance has a request interceptor: attaches `Authorization: Bearer <accessToken>` header
3. Axios response interceptor: on 401 → call `/api/auth/refresh` with cookie → get new access token → retry original request
4. On refresh failure (cookie expired): clear AuthContext → redirect to `/login`
5. AuthContext stores: `{ user, accessToken, isLoading, login(), logout() }`
6. Protected routes: wrap with `<PrivateRoute>` component that checks `AuthContext.user` — redirects to `/login` if null

---

## ENV VARIABLES (`.env.example`)
```
# Server
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/aura
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
PYTHON_PATH=python3

# Client (Vite — all prefixed VITE_)
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## PACKAGE.JSON FILES

**Root `package.json` (monorepo runner):**
```json
{
  "name": "aura-platform",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "cd server && npm run dev",
    "client": "cd client && npm run dev",
    "install:all": "npm install && cd client && npm install && cd ../server && npm install"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

**`server/package.json`:**
```json
{
  "name": "aura-server",
  "main": "server.js",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "socket.io": "^4.6.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "multer": "^1.4.5",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "cookie-parser": "^1.4.6",
    "express-validator": "^7.0.1",
    "express-rate-limit": "^7.1.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**`client/package.json`:**
```json
{
  "name": "aura-client",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "socket.io-client": "^4.6.0",
    "recharts": "^2.9.0",
    "lucide-react": "^0.294.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.5",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31"
  }
}
```

---

## CRITICAL IMPLEMENTATION RULES

1. **Never use `localStorage` for tokens** — access token lives in React state/context only; refresh token in httpOnly cookie.

2. **All API responses follow this consistent shape:**
   ```json
   { "success": true, "data": { ... }, "message": "Operation successful" }
   { "success": false, "error": "Error type", "message": "Human-readable message" }
   ```

3. **Express error handling:** All controllers use `try/catch` + `next(error)`. Global `errorHandler.js` middleware handles all errors and returns proper HTTP status codes (400, 401, 403, 404, 500).

4. **CORS:** `cors({ origin: process.env.CLIENT_URL, credentials: true })` — credentials must be true for cookies to work.

5. **Tailwind dark theme:** Entire app is dark by default. In `tailwind.config.js` set `darkMode: 'class'`. In `index.html` add `class="dark"` to `<html>`. Use Tailwind's `dark:` variants throughout.

6. **Image storage:** Upload images to `server/uploads/`. Serve as static files: `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))`.

7. **Python model call convention:** Each model's `predict.py` is called as:
   ```bash
   python3 Fire_Detection_Model/predict.py /absolute/path/to/image.jpg
   ```
   It prints a single JSON line to stdout. If `predict.py` does not yet exist for a model, create a placeholder that prints:
   ```json
   {"detected": false, "confidence": 0.0, "label": "no_detection", "bbox": []}
   ```

8. **Canvas bounding box:** In the Incident Detail Modal, after the image loads, use a `<canvas>` element overlaid on the image. Draw a colored rectangle using `detectionData.bbox` coordinates scaled to the displayed image size. Color matches the incident type.

9. **Rate limiting:** Apply `express-rate-limit` to all `/api/auth/*` routes — max 10 requests per 15 minutes per IP.

10. **Responsive breakpoints:**
    - Sidebar collapses to hamburger on `< 768px`
    - Dashboard stat cards: 5 columns on desktop, 2 on tablet, 1 on mobile
    - Incident table: horizontal scroll on mobile
    - LiveFeed grid: 3 columns desktop, 2 tablet, 1 mobile

---

## SEED SCRIPT (`server/seed.js`)

Create a runnable seed script (`node seed.js`) that:
1. Connects to MongoDB
2. Clears existing data
3. Creates admin user: `admin@aura.city / Admin@123`
4. Creates 2 operator users: `operator1@aura.city / Operator@1`, `operator2@aura.city / Operator@2`
5. Creates 50 mock incidents distributed across the last 30 days, all 5 types, random severities, random zones from: ["Zone A - North", "Zone B - South", "Zone C - East", "Zone D - West", "Zone E - Central"]
6. Creates 20 alerts linked to those incidents
7. Logs completion summary

---

## README.md CONTENTS

Write a complete `README.md` with:
- Project name + AURA acronym expansion
- One-paragraph description of the platform
- ASCII architecture diagram showing: React Client → Express API → MongoDB, with ML Bridge → Python Models as a side branch
- Prerequisites: Node.js 18+, Python 3.9+, MongoDB Atlas account
- Installation: clone → `npm run install:all` → configure `.env` → `npm run dev`
- Seed data: `cd server && node seed.js`
- API documentation summary table (all routes)
- ML model integration guide (how predict.py should be structured)
- Environment variables reference table
- Screenshots section (placeholder text "Coming soon")
- License: MIT

---

**Build the entire application exactly as specified above. Every file listed in the folder structure must be created with complete, working, production-quality code. The UI must precisely match the design system: dark navy background (#0A0E1A), Space Mono for headings and metrics, DM Sans for body text, electric cyan (#00D4FF) for accents and CTAs, tight card grid with #111827 card backgrounds and #1E2D45 borders. No placeholder lorem ipsum text anywhere — use realistic urban analytics content. No purple gradients, no generic AI-looking design.**
