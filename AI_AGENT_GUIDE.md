# AI Agent Guide - ActiveBreakApp

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Target Audience**: AI Coding Assistants and Automated Development Tools

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Database](#architecture--database)
3. [File Responsibilities](#file-responsibilities)
4. [IPC API Reference](#ipc-api-reference)
5. [Key Business Logic](#key-business-logic)
6. [Authentication Flow](#authentication-flow)
7. [Development Guidelines](#development-guidelines)

---

## Project Overview

**ActiveBreakApp** is a cross-platform Electron desktop application that monitors user posture in real-time using computer vision (MediaPipe Pose/TensorFlow.js) and provides actionable feedback through desktop notifications and analytics dashboards. The application features role-based authentication (admin/client) with SQLite3 database and bcrypt password hashing.

**Technology Stack**:

- **Platform**: Electron 38.4.0
- **AI/ML**: TensorFlow.js 4.22.0, MediaPipe Pose 0.5 (MoveNet SINGLEPOSE_LIGHTNING)
- **Database**: SQLite3 5.1.7 with bcrypt 6.0.0 password hashing (10 salt rounds)
- **Frontend**: Vanilla JavaScript (ES6), Chart.js for visualizations
- **Build**: Electron Builder 26.0.12

**Project Status**: Production-ready. All core features (posture detection, authentication, statistics, notifications) are fully functional.

---

## Architecture & Database

### Application Architecture

```
Entry Point Flow:
main.js → landing.html → [Admin/Client Selection] → Auth → Dashboard

IPC Communication:
Renderer Process ←→ contextBridge (preload.js) ←→ Main Process (main.js)
```

**Detailed Architecture Diagram**: See `architecture.mmd`  
**Database Schema Diagram**: See `database.mmd`

### Database Schema (SQLite3)

**Location**: `data/users.sqlite`

**Tables**:

1. **users** (Authentication)

   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `email` TEXT UNIQUE NOT NULL
   - `password` TEXT NOT NULL (bcrypt hashed, 10 salt rounds)
   - `role` TEXT CHECK(role IN ('admin', 'client'))
   - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

2. **user_settings** (1:1 with users)

   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `user_id` INTEGER UNIQUE (FOREIGN KEY → users.id, ON DELETE CASCADE)
   - `sensitivity` INTEGER DEFAULT 5 (1-10 scale)
   - `notifications_enabled` INTEGER DEFAULT 1 (boolean)
   - `alert_threshold` INTEGER DEFAULT 3 (seconds)
   - `break_interval` INTEGER DEFAULT 30 (minutes)
   - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

3. **user_stats** (1:1 with users)

   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `user_id` INTEGER UNIQUE (FOREIGN KEY → users.id, ON DELETE CASCADE)
   - `total_correct_time` INTEGER DEFAULT 0 (seconds)
   - `total_incorrect_time` INTEGER DEFAULT 0 (seconds)
   - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

4. **posture_events** (1:N with users)

   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `user_id` INTEGER (FOREIGN KEY → users.id, ON DELETE CASCADE)
   - `event_type` TEXT CHECK(event_type IN ('correct', 'incorrect', 'session_start', 'session_end'))
   - `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
   - INDEX on `user_id`, `timestamp`, `event_type`

5. **alert_events** (1:N with users)
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `user_id` INTEGER (FOREIGN KEY → users.id, ON DELETE CASCADE)
   - `alert_type` TEXT CHECK(alert_type IN ('posture', 'break'))
   - `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
   - INDEX on `user_id`, `timestamp`

**Key Database Features**:

- PRAGMA foreign_keys = ON (enforced cascading deletes)
- Automatic default record creation for `user_settings` and `user_stats` on user registration
- bcrypt password hashing with 10 salt rounds
- Indexed timestamp queries for performance

---

## File Responsibilities

**Complete Project Structure**: See `tree.txt`

### Core Application Files

#### 1. **main.js** (Electron Main Process)

**Purpose**: Application lifecycle, window management, database operations, IPC handlers

**Key Responsibilities**:

- Database initialization and connection (`initDatabase()`)
- 8 IPC handlers for authentication, settings, statistics, events, modal data
- Native OS notifications
- Window management (1000x700px, centered)
- Security: context isolation enabled, preload script injection

**Critical Sections**:

- Database initialization with 5 tables and FOREIGN KEY constraints
- Authentication handlers with bcrypt hashing/comparison
- Settings CRUD operations with SQL
- Statistics aggregation queries
- Chart data generation (Chart.js format: `{labels: [], datasets: []}`)
- Event logging (posture changes, alerts)

#### 2. **preload.js** (IPC Bridge)

**Purpose**: Secure communication bridge between renderer and main process via contextBridge

**Exposed API** (8 methods via `window.api`):

1. `getSettings()` → Promise<Settings Object>
2. `saveSettings(settings)` → Promise<boolean>
3. `getTotalStats()` → Promise<Stats Object>
4. `logSessionStats(correctTime, incorrectTime)` → Promise<boolean>
5. `logPostureEvent(eventType)` → Promise<boolean>
6. `logAlertEvent(alertType)` → Promise<boolean>
7. `getModalData(startDate, endDate)` → Promise<Modal Data Object>
8. `sendNotification(title, body)` → Promise<void>

**Security**: Uses `contextBridge.exposeInMainWorld` for secure IPC exposure

#### 3. **script.js** (Core AI Logic - Renderer Process)

**Purpose**: Real-time posture detection, classification, session tracking, statistics modal

**Key Responsibilities**:

- MediaPipe Pose initialization (MoveNet SINGLEPOSE_LIGHTNING model)
- Continuous pose detection loop
- **Military-grade posture classification** (3-rule algorithm)
- Session timing and statistics aggregation
- Desktop notification triggers
- Break reminder system
- Canvas skeleton rendering
- Statistics modal with Chart.js visualization
- CSV export functionality

**Critical Logic**:

- Posture classification: 3 strict rules (horizontal alignment, upright spine, shoulder symmetry)
- Session state management (camera start/pause/resume)
- Event logging triggers (posture changes, alerts, session start/end)
- Chart.js integration for trend visualization

#### 4. **settings.js** (Settings Management - Renderer Process)

**Purpose**: User settings interface and persistence

**Key Responsibilities**:

- Load settings from database via IPC
- Save settings to database via IPC
- Form validation and user feedback
- Sensitivity, notifications, alert threshold, break interval configuration

#### 5. **admin-dashboard.js** (Admin Panel - Renderer Process)

**Purpose**: Admin user management dashboard

**Key Responsibilities**:

- Fetch all users via IPC (`admin:get-all-users`)
- Delete users via IPC (`admin:delete-user`)
- Self-deletion detection (warns if admin deletes own account)
- Automatic logout on self-deletion
- Dynamic table rendering

#### 6. **auth-guard.js** (Session Validation)

**Purpose**: Route protection based on authentication state

**Key Responsibilities**:

- Check localStorage for `currentUser` session
- Redirect to landing page if not authenticated
- Used on protected pages (index.html, settings.html, admin-welcome.html)

---

## IPC API Reference

All IPC communication uses secure contextBridge exposure via `preload.js`. Renderer processes access APIs through `window.api.*` methods.

### 1. **window.api.getSettings()**

**IPC Handler**: `ipcMain.handle('get-settings')`  
**Parameters**: None  
**Returns**: Promise<Settings Object>

```javascript
{
  sensitivity: 5,           // 1-10 scale
  notifications_enabled: 1, // boolean (1 or 0)
  alert_threshold: 3,       // seconds
  break_interval: 30        // minutes
}
```

**SQL Query**: `SELECT * FROM user_settings WHERE user_id = ?`

### 2. **window.api.saveSettings(settings)**

**IPC Handler**: `ipcMain.handle('save-settings', (event, settings))`  
**Parameters**:

- `settings` (Object): Settings object with sensitivity, notifications_enabled, alert_threshold, break_interval
  **Returns**: Promise<boolean>  
  **SQL Query**: `UPDATE user_settings SET ... WHERE user_id = ?`

### 3. **window.api.getTotalStats()**

**IPC Handler**: `ipcMain.handle('get-total-stats')`  
**Parameters**: None  
**Returns**: Promise<Stats Object>

```javascript
{
  total_correct_time: 3600,   // seconds
  total_incorrect_time: 1200  // seconds
}
```

**SQL Query**: `SELECT total_correct_time, total_incorrect_time FROM user_stats WHERE user_id = ?`

### 4. **window.api.logSessionStats(correctTime, incorrectTime)**

**IPC Handler**: `ipcMain.handle('log-session-stats', (event, correctTime, incorrectTime))`  
**Parameters**:

- `correctTime` (Number): Session correct posture time in seconds
- `incorrectTime` (Number): Session incorrect posture time in seconds
  **Returns**: Promise<boolean>  
  **SQL Query**: `UPDATE user_stats SET total_correct_time = total_correct_time + ?, total_incorrect_time = total_incorrect_time + ? WHERE user_id = ?`

### 5. **window.api.logPostureEvent(eventType)**

**IPC Handler**: `ipcMain.handle('log-posture-event', (event, eventType))`  
**Parameters**:

- `eventType` (String): 'correct', 'incorrect', 'session_start', or 'session_end'
  **Returns**: Promise<boolean>  
  **SQL Query**: `INSERT INTO posture_events (user_id, event_type, timestamp) VALUES (?, ?, datetime('now', 'localtime'))`

### 6. **window.api.logAlertEvent(alertType)**

**IPC Handler**: `ipcMain.handle('log-alert-event', (event, alertType))`  
**Parameters**:

- `alertType` (String): 'posture' or 'break'
  **Returns**: Promise<boolean>  
  **SQL Query**: `INSERT INTO alert_events (user_id, alert_type, timestamp) VALUES (?, ?, datetime('now', 'localtime'))`

### 7. **window.api.getModalData(startDate, endDate)**

**IPC Handler**: `ipcMain.handle('get-modal-data', (event, startDate, endDate))`  
**Parameters**:

- `startDate` (String|null): ISO date string (YYYY-MM-DD) or null for no filter
- `endDate` (String|null): ISO date string (YYYY-MM-DD) or null for no filter
  **Returns**: Promise<Modal Data Object>

```javascript
{
  stats: {
    total_correct_time: 3600,   // seconds
    total_incorrect_time: 1200  // seconds
  },
  postureEvents: [
    { event_type: 'correct', timestamp: '2025-01-15 14:30:00' },
    { event_type: 'incorrect', timestamp: '2025-01-15 14:35:00' }
    // ... up to 1000 most recent events
  ],
  chartData: {
    labels: ['2025-01-15', '2025-01-16'],  // dates
    datasets: [
      {
        label: 'Postura Correcta',
        data: [60, 45],  // minutes
        backgroundColor: 'rgba(46, 160, 67, 0.8)',
        borderColor: 'rgba(46, 160, 67, 1)',
        borderWidth: 1
      },
      {
        label: 'Postura Incorrecta',
        data: [20, 15],  // minutes
        backgroundColor: 'rgba(225, 29, 72, 0.8)',
        borderColor: 'rgba(225, 29, 72, 1)',
        borderWidth: 1
      }
    ]
  }
}
```

**SQL Queries**:

- User stats: `SELECT total_correct_time, total_incorrect_time FROM user_stats WHERE user_id = ?`
- Posture events: `SELECT event_type, timestamp FROM posture_events WHERE user_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT 1000`
- Chart data: Complex aggregation query grouping posture events by date

**Note**: Chart data is in Chart.js format. Returned data is in **minutes** (converted from seconds).

### 8. **window.api.sendNotification(title, body)**

**IPC Handler**: `ipcMain.handle('notify:posture', (event, title, body))`  
**Parameters**:

- `title` (String): Notification title
- `body` (String): Notification body text
  **Returns**: Promise<void>  
  **Action**: Displays native OS notification with sound

---

## Key Business Logic

### Posture Classification Algorithm ("Military-Grade Classification")

**Location**: `script.js` (posture detection loop)

**Algorithm**: 3-rule strict validation system

```javascript
// Rule 1: Horizontal Alignment (15% tolerance)
const horizontalCenter = canvas.width / 2;
const noseX = landmarks[0].x * canvas.width;
const horizontalDeviation = Math.abs(noseX - horizontalCenter) / canvas.width;
const horizontalOK = horizontalDeviation <= 0.15; // 15% tolerance

// Rule 2: Upright Spine (50% height requirement)
const noseY = landmarks[0].y;
const leftHipY = landmarks[23].y;
const rightHipY = landmarks[24].y;
const avgHipY = (leftHipY + rightHipY) / 2;
const spineHeight = avgHipY - noseY;
const uprightOK = spineHeight >= 0.5; // Must be at least 50% of frame height

// Rule 3: Shoulder Symmetry (10% tolerance)
const leftShoulderY = landmarks[11].y;
const rightShoulderY = landmarks[12].y;
const shoulderTilt = Math.abs(leftShoulderY - rightShoulderY);
const shouldersOK = shoulderTilt <= 0.1; // 10% tilt tolerance

// Final Classification
const isCorrectPosture = horizontalOK && uprightOK && shouldersOK;
```

**Landmark Indices** (MediaPipe Pose):

- 0: Nose
- 11: Left shoulder
- 12: Right shoulder
- 23: Left hip
- 24: Right hip

**State Machine**:

- `currentPosture`: 'correct' | 'incorrect' | null
- State changes trigger event logging via `window.api.logPostureEvent()`
- 3-second consecutive bad posture triggers desktop notification (configurable via `alert_threshold`)

### Session Tracking Logic

**Session Start**:

- Triggered when camera starts (`startCameraBtn` click)
- Logs `session_start` event via `window.api.logPostureEvent('session_start')`
- Initializes session timer
- Resets session statistics (`sessionCorrectTime = 0`, `sessionIncorrectTime = 0`)

**Session End**:

- Triggered on:
  - Camera pause (`pauseCameraBtn` click)
  - User logout
  - Window close event
- Logs `session_end` event via `window.api.logPostureEvent('session_end')`
- Saves cumulative session stats via `window.api.logSessionStats(sessionCorrectTime, sessionIncorrectTime)`

**Statistics Accumulation**:

- Every 1 second: increment `sessionCorrectTime` or `sessionIncorrectTime` based on current posture
- On session end: persist to database (cumulative totals)

### Break Reminder System

**Logic**:

- User configures `break_interval` in settings (5-120 minutes)
- Timer starts on session start
- When timer reaches `break_interval`, display desktop notification with random exercise suggestion
- Notification includes one of 4 exercises: "Giro de Cuello", "Estiramiento de Hombros", "Estiramiento de Muñeca", "Mirada Lejana"
- Timer resets after notification
- Countdown displayed in real-time in statistics modal ("Próximo descanso" card)

---

## Authentication Flow

### User Roles

- **Admin**: Full access (settings, admin dashboard, user management, posture detection)
- **Client**: Limited access (posture detection only, no settings, no user management)

### Registration Flow

**Admin Registration**:

1. User fills form at `admin/admin-register.html`
2. Form submits to `ipcMain.handle('auth:register')`
3. Backend validates email uniqueness
4. Password hashed with `bcrypt.hash(password, 10)` (10 salt rounds)
5. User record inserted into `users` table with role='admin'
6. Default `user_settings` and `user_stats` records auto-created
7. Success: redirect to `admin/admin-login.html`

**Client Registration**:

1. **Admin-only**: Admins click "Registrar Cliente" button on `admin/admin-welcome.html`
2. Form at `client/client-register.html` (accessible only from admin dashboard)
3. Same backend logic as admin registration, but role='client'
4. **Note**: Clients cannot self-register

### Login Flow

**Admin Login**:

1. User fills form at `admin/admin-login.html`
2. Form submits to `ipcMain.handle('auth:login')`
3. Backend fetches user by email
4. Password validated with `bcrypt.compare(password, hashedPassword)`
5. Role validated (`role === 'admin'`)
6. Success:
   - `localStorage.setItem('currentUser', JSON.stringify({id, email, role}))`
   - Redirect to `admin/admin-welcome.html` (admin dashboard)

**Client Login**:

1. User fills form at `client/client-login.html`
2. Same backend logic, but role validated as 'client'
3. Success:
   - `localStorage.setItem('currentUser', JSON.stringify({id, email, role}))`
   - Redirect to `index.html` (posture detection page)

### Session Management

**Session Storage**:

- `localStorage.currentUser`: `{id, email, role}` (stringified JSON)

**Session Validation**:

- `auth-guard.js` runs on protected pages (index.html, settings.html, admin-welcome.html)
- Checks `localStorage.currentUser` existence
- If missing: redirect to `landing.html`

**Logout**:

- `localStorage.removeItem('currentUser')`
- `window.location.replace('landing.html')` (prevents back-button cache access)

### Authorization Rules

**Settings Page** (`settings.html`):

- **Admin-only**: Verified by `auth-guard.js` checking `role === 'admin'`
- Clients redirected to index.html if they attempt direct access

**Admin Dashboard** (`admin/admin-welcome.html`):

- **Admin-only**: Verified by `auth-guard.js`
- Features:
  - View all users (`admin:get-all-users` IPC)
  - Delete users (`admin:delete-user` IPC)
  - Self-deletion detection with warning and automatic logout

**Posture Detection** (`index.html`):

- Both admin and client can access
- No role-based restrictions

---

## Development Guidelines

### Critical Rules for AI Agents

1. **Never Bypass Authentication**: All protected routes must use `auth-guard.js`. Never remove session validation.

2. **Database Operations**: All persistent data operations (settings, stats, events) must go through IPC handlers in `main.js`. Never use localStorage for user data.

3. **Password Security**: Always use bcrypt for password hashing. Never store plain-text passwords. Never reduce salt rounds below 10.

4. **IPC Security**: Never expose database connection or bcrypt functions directly to renderer. Always use preload.js contextBridge.

5. **Chart.js Format**: When modifying chart data, always return Chart.js format: `{labels: [], datasets: []}`. Never return plain objects or raw SQL results.

6. **Foreign Keys**: Always ensure `PRAGMA foreign_keys = ON` is executed on database connection. This enforces cascading deletes.

7. **Session End Logic**: Always call `window.api.logSessionStats()` before `window.api.logPostureEvent('session_end')` to ensure cumulative stats are saved.

8. **Role Validation**: Always validate user role on backend (main.js IPC handlers) for admin-only operations. Never rely solely on frontend role checks.

### Common Pitfalls

1. **Chart Data Format**: Backend returns Chart.js format, not plain object. Do not destructure incorrectly.

2. **Date Filtering**: SQL queries use `datetime('now', 'localtime')` for timestamps. Ensure date filters match this format (YYYY-MM-DD HH:MM:SS).

3. **Session Start/End**: Must be explicitly logged. Do not assume automatic tracking.

4. **Break Interval**: Stored in minutes in database, but used in milliseconds in frontend (`breakInterval * 60 * 1000`).

5. **Event Type Constraints**: SQL CHECK constraints enforce valid event types. Do not insert arbitrary strings.

### Testing Checklist

When modifying the application, verify:

- [ ] Authentication flow (registration, login, logout)
- [ ] Settings persistence (save, load, validate)
- [ ] Posture detection accuracy (3-rule algorithm)
- [ ] Desktop notifications (posture alerts, break reminders)
- [ ] Statistics modal (chart display, event history, CSV export)
- [ ] Session tracking (start/end events, cumulative stats)
- [ ] Admin dashboard (user list, delete user, self-deletion detection)
- [ ] Role-based access (admin vs client permissions)
- [ ] Database cascading deletes (user deletion removes related records)

### File Modification Guidelines

**main.js**:

- When adding IPC handlers, follow existing pattern: `ipcMain.handle('namespace:action', async (event, ...args) => {...})`
- Always use parameterized SQL queries (`db.run(sql, [param1, param2])`) to prevent SQL injection
- Always wrap database operations in try-catch and return meaningful error messages

**script.js**:

- When modifying posture classification, ensure all 3 rules remain strict (do not loosen tolerances without user approval)
- Always log state changes (posture change, session start/end) via IPC
- Always update session statistics before ending session

**preload.js**:

- When exposing new IPC methods, always use `ipcRenderer.invoke()` (async/await pattern)
- Never expose raw `ipcRenderer` to renderer
- Always document return types in code comments

**Database Schema**:

- Never modify schema without migration strategy
- Always preserve `FOREIGN KEY` constraints and `CHECK` constraints
- Always use `ON DELETE CASCADE` for user-related tables

---

## Summary

**ActiveBreakApp** is a production-ready Electron application with:

- Real-time posture detection using MediaPipe Pose
- Secure authentication (SQLite3 + bcrypt)
- Role-based access control (admin/client)
- Comprehensive statistics tracking with Chart.js visualizations
- Desktop notifications and break reminders
- Session-based tracking with event logging

**Key Technical Highlights**:

- Military-grade 3-rule posture classification (15%, 50%, 10% tolerances)
- Secure IPC bridge via contextBridge
- Foreign key constraints with cascading deletes
- Chart.js format compliance for backend data
- Session guards for route protection

For architecture diagrams, see `architecture.mmd` and `database.mmd`.  
For complete file structure, see `tree.txt`.

---

**Document End**
