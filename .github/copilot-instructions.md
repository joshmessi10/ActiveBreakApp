# GitHub Copilot Instructions - ActiveBreakApp

## Project Architecture

**ActiveBreakApp** is an Electron-based desktop app for real-time posture detection using MediaPipe Pose. The architecture follows a strict **process separation** model:

- **Main Process** (`main.js`): ES6 module handling database (SQLite3), IPC, window management
- **Preload Script** (`preload.js`): CommonJS module (required by Electron) exposing secure IPC bridge via `contextBridge`
- **Renderer Processes** (`public/*.html`): Vanilla JS clients consuming `window.api` methods

### Critical: Module System Split

```javascript
// main.js uses ES6 imports
import { app, BrowserWindow } from "electron";

// preload.js MUST use CommonJS (Electron requirement)
const { contextBridge } = require("electron");
```

## Database Schema (SQLite3)

5 tables with **cascading deletes** via `FOREIGN KEY`:

- `users` (auth + roles: 'admin'|'client')
- `user_settings` (1:1, 4 fields: sensitivity, notificationsEnabled, alertThreshold, breakInterval)
- `user_stats` (1:1, cumulative: correctSeconds, incorrectSeconds, alertsCount)
- `posture_events` (1:N, logs: 'Correcta'|'Incorrecta'|'Session Start'|'Session End')
- `alert_events` (1:N, timestamp-only logs)

**Always use parameterized queries**: `db.run(sql, [param1, param2], callback)`

## Authentication & Session Management

### Dual Session Model

```javascript
// localStorage keys distinguish roles:
localStorage.setItem(
  "ab_current_user",
  JSON.stringify({ id, email, role: "admin" })
); // Admin
localStorage.setItem(
  "ab_current_client",
  JSON.stringify({ id, email, role: "client" })
); // Client
```

### Route Protection (auth-guard.js)

- `checkAdminSession()`: Admin-only pages (admin-welcome.html)
- `checkClientSession()`: Client-only pages (index.html - AI posture detection)
- `checkAnySession()`: Shared pages (settings.html)

**Pattern**: Always load auth-guard.js FIRST in HTML:

```html
<script src="auth-guard.js"></script>
<script>
  checkClientSession();
</script>
```

## IPC API Reference

All IPC handlers follow `namespace:action` pattern:

### Authentication

- `auth:register` - bcrypt hash (10 rounds), auto-creates default settings/stats
- `auth:login` - bcrypt compare, returns user object

### Settings (Role-Agnostic)

- `settings:get` - Load user settings by userId
- `settings:save` - Update settings, returns success boolean

### Statistics

- `stats:get-total` - Cumulative correctSeconds/incorrectSeconds
- `stats:log-session` - Increments totals, called on session end
- `stats:get-modal-data` - Returns {stats, postureEvents[], chartData} with date filtering

### Events

- `event:log-posture` - Logs posture changes with timestamp
- `event:log-alert` - Logs alert events

**Pattern in renderer**: Always use `await window.api.methodName(userId, ...args)`

## Key Business Logic

### Posture Classification (script.js)

"Military-grade" 3-rule algorithm with strict tolerances:

```javascript
const horizontalOK = Math.abs(noseX - centerX) / canvas.width <= 0.15; // 15% horizontal tolerance
const uprightOK = avgHipY - noseY >= 0.5; // 50% spine height
const shouldersOK = Math.abs(leftShoulderY - rightShoulderY) <= 0.1; // 10% shoulder tilt
const isCorrectPosture = horizontalOK && uprightOK && shouldersOK;
```

### Session Lifecycle

1. **Start**: `logPostureEvent(userId, {type: "Session Start"})` → reset session timers
2. **Tracking**: Increment `sessionCorrectTime` or `sessionIncorrectTime` every second
3. **End**: `logSessionStats(userId, correct, incorrect)` → `logPostureEvent(userId, {type: "Session End"})`

**Critical**: Always save stats BEFORE logging session end event.

## Settings: Role-Agnostic Access Pattern

Both admin and client can edit their own settings. Use helper function:

```javascript
function getActiveUserSession() {
  const clientJson = localStorage.getItem("ab_current_client");
  if (clientJson) return JSON.parse(clientJson);
  const adminJson = localStorage.getItem("ab_current_user");
  if (adminJson) return JSON.parse(adminJson);
  return null;
}
```

**Dynamic Navigation**: `settings.js` adapts nav based on role:

```javascript
if (user.role === "admin") {
  navHomeButton.href = "admin/admin-welcome.html";
} else {
  navHomeButton.href = "index.html"; // Client app
}
```

## Development Workflow

### Running the App

```bash
npm start  # Launches Electron in dev mode
```

### Building Distributables

```bash
npm run build  # Outputs to dist/ (NSIS installer + portable EXE for Windows)
```

**Known Issue**: Symbolic link errors on Windows during build are cosmetic (code-signing tools). Build succeeds despite warnings.

### Database Location

- Dev: `data/users.sqlite` (auto-created, gitignored)
- Production: Same path, relative to app root

## Common Pitfalls

1. **Chart.js Data Format**: Backend MUST return `{labels: [], datasets: []}` not plain objects
2. **Logout**: Always clear BOTH session keys (`ab_current_user` AND `ab_current_client`)
3. **Foreign Keys**: Database MUST enable `PRAGMA foreign_keys = ON` on connection
4. **Event Types**: SQL CHECK constraints enforce exact strings ('Correcta', not 'correct')
5. **Time Units**: Database stores seconds, frontend displays minutes (convert in backend)

## File Responsibilities

- `main.js` (940 lines): Database init, 11 IPC handlers, window management
- `preload.js` (35 lines): Exposes 13 `window.api` methods via contextBridge
- `script.js` (1136 lines): AI posture detection, session tracking, statistics modal
- `settings.js` (137 lines): Settings CRUD with role-agnostic logic
- `admin-dashboard.js` (190 lines): User management, self-deletion detection
- `auth-guard.js` (98 lines): 3 session validation functions

## Documentation

- **AI_AGENT_GUIDE.md**: Technical deep-dive (IPC API, business logic, auth flow)
- **architecture.mmd**: Mermaid diagram of data flows and component interactions
- **database.mmd**: ERD showing 5 tables and relationships
- **README.md**: Human-facing docs (features, installation, usage)

---

**When modifying this codebase**: Check AI_AGENT_GUIDE.md first for technical patterns, then reference architecture.mmd for component relationships.
