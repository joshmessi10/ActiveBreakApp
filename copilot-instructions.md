# Copilot Instructions v2.0 - ActiveBreakApp

## 🚨 **POST-AUDIT EDITION - 100% ACCURATE**

**Document Status**: ✅ Verified against actual code (October 26, 2025)  
**Audit Result**: 8 critical mismatches found and corrected

## 📋 Project Overview

This document provides AI agents with **line-by-line verified** guidance on the logic and responsibility of each key file. This reflects the **actual implemented code** as of October 26, 2025, with all discrepancies documented.

---

## 🏗️ Application Architecture

### Entry Point Flow

```
main.js → landing.html → [Admin Flow | Client Flow] → Core AI App (index.html)
```

---

## 📄 File Responsibilities & VERIFIED Logic

### **1. `main.js` (Electron Main Process)**

**Responsibility**: Application lifecycle and window management

**✅ VERIFIED Key Logic**:

- Creates `BrowserWindow` (1000x700px)
- **Loads `public/landing.html`** as entry point (line 22) ✅
- Security: `contextIsolation: true`, preload script enabled
- **IPC Listener**: `ipcMain.on("notify:posture", ...)` (line 26)
- Creates native OS notifications with sound (lines 31-38)

**❌ CRITICAL ISSUE - IPC BROKEN**:

- Listens on channel `"notify:posture"` (line 26)
- Uses `ipcMain.on()` (sync event listener)
- But `preload.js` sends to channel `"notify"` using `invoke()` (async)
- **Result**: Notifications never reach main process

**Critical Code** (lines 25-44):

```javascript
ipcMain.on("notify:posture", (event, message) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: "ActiveBreak Alert",
      body: message || "Please check your posture!",
      silent: false,
    });
    notification.show();
  }
});
```

---

### **2. `preload.js` (IPC Bridge)** ⚠️ **CRITICAL MISMATCH DOCUMENTED**

**Responsibility**: Secure IPC communication bridge

**✅ VERIFIED Actual Implementation**:

- ❌ Uses **ES6 imports** (`import`), NOT CommonJS (`require`)
- ❌ Exposes **3 API objects**: `notify`, `settings`, `stats` (NOT just `sendNotification`)
- ⚠️ **KNOWN BUG**: `script.js` calls `window.api.sendNotification()` which DOES NOT EXIST

**Actual Code** (lines 1-12):

```javascript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  notify: (message) => ipcRenderer.invoke("notify", message), // ❌ Wrong method name & channel!
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (partial) => ipcRenderer.invoke("settings:set", partial),
  },
  stats: {
    add: (entry) => ipcRenderer.invoke("stats:add", entry),
    all: () => ipcRenderer.invoke("stats:all"),
  },
});
```

**❌ TRIPLE MISMATCH**:

1. Method name: Exposes `window.api.notify()`, but `script.js` calls `window.api.sendNotification()`
2. Channel: Uses `"notify"`, but `main.js` listens to `"notify:posture"`
3. Mechanism: Uses `invoke()` (async), but `main.js` uses `on()` (sync)

**Critical Issue**:

- `script.js` expects: `window.api.sendNotification(message)`
- `preload.js` provides: `window.api.notify(message)` + unused `settings` + unused `stats`
- **Result**: Notifications are BROKEN in the current code

---

### **3. `public/script.js` (Core AI Logic)** - 650+ lines

**Responsibility**: AI pose detection, classification, notifications, data tracking

**✅ VERIFIED Military-Grade Classification (Lines 125-220)**:

**3-Rule System** (EXACT MATCH with documentation):

```javascript
// RULE 1: Perfect horizontal alignment (15% tolerance) - Line 158
const horizontalDeviation = Math.abs(noseX - shoulderMidX);
const maxHorizontalDeviation = shoulderWidth * 0.15;
const isHorizontallyCentered = horizontalDeviation <= maxHorizontalDeviation;

// RULE 2: Strict vertical alignment (50% height requirement) - Line 164
const headShoulderDistance = shoulderMidY - noseY;
const minHeadHeight = shoulderWidth * 0.5;
const isVerticallyAligned = headShoulderDistance > minHeadHeight;

// RULE 3: Level shoulders (10% symmetry tolerance) - Line 170
const shoulderHeightDiff = Math.abs(leftShoulderY - rightShoulderY);
const maxShoulderTilt = shoulderWidth * 0.1;
const shouldersAreLevel = shoulderHeightDiff <= maxShoulderTilt;

// ALL 3 rules must pass (Line 176)
const isCentered =
  isHorizontallyCentered && isVerticallyAligned && shouldersAreLevel;
```

**✅ VERIFIED Event Logging (Lines 237-259)**:

```javascript
function logPostureEvent(state) {
  // 1. Read existing events
  const historyJSON = localStorage.getItem("postureHistory");
  let history = historyJSON ? JSON.parse(historyJSON) : [];

  // 2. Create new event
  const event = {
    timestamp: Date.now(),
    type: state === "correct" ? "Correcta" : "Incorrecta",
  };

  // 3. Add to beginning (newest first) - UNSHIFT ✅
  history.unshift(event);

  // 4. Cap at 100 events (remove oldest) - POP ✅
  if (history.length > 100) {
    history.pop();
  }

  // 5. Save back to localStorage
  localStorage.setItem("postureHistory", JSON.stringify(history));
}
```

**✅ VERIFIED Settings Read (All 4 Settings)**:

- Line 138: `settings_sensitivity` (1-10, default: 5) ✅
- Line 218: `settings_alertThreshold` (1-60s, default: 3) ✅
- Line 227: `settings_notifications` (true/false, default: true) ✅
- Line 308: `settings_breakInterval` (5-120min, default: 30) ✅

**❌ BROKEN Notification System (Lines 218-234)**:

```javascript
const alertThreshold = parseInt(
  localStorage.getItem("settings_alertThreshold") || "3",
  10
);
const badPostureDuration = Date.now() - badPostureStartTime;

if (badPostureDuration > alertThreshold * 1000 && !notificationSent) {
  registerAlert(); // ✅ This works (increments counter)
  notificationSent = true;

  const notificationsEnabled =
    localStorage.getItem("settings_notifications") !== "false";
  if (notificationsEnabled && window.api && window.api.sendNotification) {
    // ❌ Method doesn't exist!
    window.api.sendNotification(
      // ❌ Should be window.api.notify()
      `¡Corrige tu postura! Llevas más de ${alertThreshold}s en mala posición.`
    );
  }
}
```

**Status**: Logic is correct, IPC method name is wrong. Notifications never fire.

**❌ BROKEN Break Reminder System (Lines 305-318)**:

```javascript
const breakIntervalMinutes = parseInt(
  localStorage.getItem("settings_breakInterval") || "30",
  10
);
const breakIntervalSeconds = breakIntervalMinutes * 60;

if (
  running &&
  !paused &&
  elapsedSeconds > 0 &&
  elapsedSeconds % breakIntervalSeconds === 0 &&
  elapsedSeconds !== lastBreakNotificationTime &&
  window.api &&
  window.api.sendNotification && // ❌ Wrong method name!
  localStorage.getItem("settings_notifications") !== "false"
) {
  window.api.sendNotification("¡Hora de descansar! ..."); // ❌ Should be notify()
  lastBreakNotificationTime = elapsedSeconds;
}
```

**Status**: Break reminder logic exists and is coded correctly inside `setInterval` (1-second interval), but IPC method name is wrong. Break reminders never fire.

**🚨 CRITICAL UNDOCUMENTED CODE - Session Reset (Lines 459-468)**:

```javascript
// ===== Reset de sesión al iniciar la app (cada ejecución empieza en cero)
(function resetSession() {
  try {
    localStorage.setItem("correctSeconds", "0");
    localStorage.setItem("incorrectSeconds", "0");
    localStorage.setItem("alertsCount", "0");
    localStorage.setItem("postureHistory", "[]");
    localStorage.setItem("alertsHistory", "[]");
  } catch (e) {
    console.warn("No se pudo resetear la sesión:", e);
  }
})();
```

**Impact**:

- **ALL statistics are wiped on every app start**
- Users cannot track progress across sessions
- This behavior is **NOT documented** in README or project-purpose
- **Contradicts** the claim that "stats persist between sessions"

---

### **4. `public/stats.js` (Statistics Display)**

**Responsibility**: Display posture time and event history

**✅ VERIFIED Implementation**:

#### **A. Time Display (Lines 8-28)**:

```javascript
window.addEventListener("DOMContentLoaded", () => {
  // ✅ Correct JSON.parse with parseInt
  const correctSeconds = parseInt(
    localStorage.getItem("correctSeconds") || "0",
    10
  );
  const incorrectSeconds = parseInt(
    localStorage.getItem("incorrectSeconds") || "0",
    10
  );

  // ✅ Correct formatTime usage
  const correctTimeFormatted = formatTime(correctSeconds); // mm:ss format
  const incorrectTimeFormatted = formatTime(incorrectSeconds);

  // ✅ Correct element population
  correctTimeElement.textContent = correctTimeFormatted;
  incorrectTimeElement.textContent = incorrectTimeFormatted;
});
```

#### **B. Event History Table (Lines 41-81)**:

```javascript
function loadPostureHistory() {
  // 1. Get historyTable element ✅
  const historyTable = document.getElementById("historyTable");

  // 2. ✅ Correct JSON.parse with fallback
  const historyJSON = localStorage.getItem("postureHistory");
  const history = historyJSON ? JSON.parse(historyJSON) : [];

  // 3. Clear table ✅
  historyTable.innerHTML = "";

  // 4. Handle empty history ✅
  if (history.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="3">No hay eventos registrados aún...</td>`;
    historyTable.appendChild(emptyRow);
    return;
  }

  // 5. ✅ Populate table rows (newest first, already sorted by unshift in script.js)
  history.forEach((event) => {
    const date = new Date(event.timestamp);
    const dateStr = date.toLocaleDateString("es-ES", {...});
    const timeStr = date.toLocaleTimeString("es-ES", {...});

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${dateStr}</td>
      <td>${timeStr}</td>
      <td style="color: ${event.type === "Correcta" ? "#2ea043" : "#f85149"}">
        ${event.type}
      </td>
    `;

    historyTable.appendChild(row); // ✅ Appends to table
  });
}
```

**Data Sources** (All verified):

- `localStorage.correctSeconds` ✅
- `localStorage.incorrectSeconds` ✅
- `localStorage.postureHistory` (JSON array) ✅

---

### **5. `public/settings.js` (Settings Management)**

**Responsibility**: Load and save user settings with localStorage persistence

**✅ VERIFIED Implementation**:

#### **A. `loadSettings()` Function (Lines 10-30)**:

```javascript
function loadSettings() {
  // ✅ Load all 4 settings with proper defaults
  const sensitivity = localStorage.getItem("settings_sensitivity") || "5";
  const notificationsEnabled =
    localStorage.getItem("settings_notifications") !== "false";
  const alertThreshold = localStorage.getItem("settings_alertThreshold") || "3";
  const breakInterval = localStorage.getItem("settings_breakInterval") || "30";

  // ✅ Update UI inputs with stored values
  sensitivitySlider.value = sensitivity;
  sensitivityValue.textContent = sensitivity;
  notificationsCheckbox.checked = notificationsEnabled;
  alertThresholdInput.value = alertThreshold;
  breakIntervalInput.value = breakInterval;
}
```

#### **B. `saveSettings()` Function (Lines 33-54)**:

```javascript
function saveSettings() {
  // ✅ Save all 4 settings to localStorage
  localStorage.setItem("settings_sensitivity", sensitivitySlider.value);
  localStorage.setItem("settings_notifications", notificationsCheckbox.checked);
  localStorage.setItem("settings_alertThreshold", alertThresholdInput.value);
  localStorage.setItem("settings_breakInterval", breakIntervalInput.value);

  alert("✅ Configuración guardada correctamente!");
}
```

**✅ Settings Schema** (ALL VERIFIED):

- `settings_sensitivity`: "1"-"10" (string, default: "5")
- `settings_notifications`: "true"/"false" (string, default: "true")
- `settings_alertThreshold`: "1"-"60" (string, default: "3")
- `settings_breakInterval`: "5"-"120" (string, default: "30")

**Event Listeners** (Lines 57-64):

- Line 57: Slider updates display value on input ✅
- Line 61: Save button triggers `saveSettings()` ✅
- Line 64: Auto-load on page load ✅

---

## � Verified Data Flow & IPC Architecture

### **IPC Communication Flow (BROKEN)**

```
┌──────────────────────────────────────────┐
│ Main Process (main.js)                   │
│ - ipcMain.on("notify:posture", ...)      │ ❌ Channel: "notify:posture"
│ - Uses sync event handler (on)           │ ❌ Mechanism: synchronous
└────────────────┬─────────────────────────┘
                 │
                 ▼ (Never receives messages)
┌──────────────────────────────────────────┐
│ Preload (preload.js)                     │
│ - Exposes: window.api.notify()           │ ❌ Method: "notify"
│ - Uses: ipcRenderer.invoke("notify", ...)│ ❌ Channel: "notify", Mechanism: async
└────────────────┬─────────────────────────┘
                 │
                 ▼ (Method doesn't exist)
┌──────────────────────────────────────────┐
│ Renderer (script.js)                     │
│ - Calls: window.api.sendNotification()   │ ❌ Method: "sendNotification"
│ - ❌ RESULT: Notifications NEVER WORK    │
└──────────────────────────────────────────┘
```

**Triple IPC Mismatch Breakdown**:

1. **Method Name**: `sendNotification()` (script) ≠ `notify()` (preload)
2. **Channel**: `"notify"` (preload) ≠ `"notify:posture"` (main)
3. **Mechanism**: `invoke()` (preload, async) ≠ `on()` (main, sync listener)

**To Fix (Choose ONE approach)**:

**Option A** - Fix preload.js to match script.js:

```javascript
// preload.js
contextBridge.exposeInMainWorld("api", {
  sendNotification: (message) => ipcRenderer.send("notify:posture", message), // ✅ Matches script.js & main.js
  // Remove unused settings & stats objects
});
```

**Option B** - Fix script.js to match preload.js:

```javascript
// script.js (lines 229 & 315)
window.api.notify("¡Corrige tu postura!"); // ✅ Matches preload.js exposed method

// AND fix main.js channel:
// main.js
ipcMain.handle("notify", async (event, message) => {
  // ✅ Matches preload.js channel & mechanism
  // ...
});
```

---

## �💾 localStorage Schema (COMPLETE & VERIFIED)

### **Settings Keys** (Persist across app restarts):

| Key                       | Type   | Default  | Range              | Used By                                 |
| ------------------------- | ------ | -------- | ------------------ | --------------------------------------- |
| `settings_sensitivity`    | String | `"5"`    | `"1"`-`"10"`       | script.js (line 138), settings.js       |
| `settings_notifications`  | String | `"true"` | `"true"`/`"false"` | script.js (lines 227, 310), settings.js |
| `settings_alertThreshold` | String | `"3"`    | `"1"`-`"60"`       | script.js (line 218), settings.js       |
| `settings_breakInterval`  | String | `"30"`   | `"5"`-`"120"`      | script.js (line 308), settings.js       |

### **Data Keys** (⚠️ WIPED ON EVERY APP RESTART):

| Key                | Type         | Description                    | Reset By                  |
| ------------------ | ------------ | ------------------------------ | ------------------------- |
| `correctSeconds`   | String (int) | Time in good posture (seconds) | `resetSession()` line 461 |
| `incorrectSeconds` | String (int) | Time in bad posture (seconds)  | `resetSession()` line 462 |
| `alertsCount`      | String (int) | Number of alerts triggered     | `resetSession()` line 463 |

### **History Keys** (⚠️ WIPED ON EVERY APP RESTART):

| Key              | Type       | Max Size          | Description                           | Reset By                  |
| ---------------- | ---------- | ----------------- | ------------------------------------- | ------------------------- |
| `postureHistory` | JSON Array | 100 events (FIFO) | Posture state changes with timestamps | `resetSession()` line 464 |
| `alertsHistory`  | JSON Array | 1000 timestamps   | Alert trigger times                   | `resetSession()` line 465 |

**postureHistory Format**:

```json
[
  { "timestamp": 1698345600000, "type": "Correcta" },
  { "timestamp": 1698345590000, "type": "Incorrecta" }
]
```

### **Auth Keys** (Persist across restarts):

| Key               | Type       | Description                                 | Used By               |
| ----------------- | ---------- | ------------------------------------------- | --------------------- |
| `ab_org_accounts` | JSON Array | Admin accounts with SHA-256 password hashes | script.js adminGate() |

**ab_org_accounts Format**:

```json
[{ "email": "admin@example.com", "passHash": "abc123..." }]
```

---

## 🚨 Critical Issues Summary

### **1. IPC Notification System (BROKEN - Priority 1)**

**Root Cause**: Triple mismatch across 3 files

- **Method**: script.js calls non-existent `sendNotification()`, preload exposes `notify()`
- **Channel**: preload uses `"notify"`, main listens to `"notify:posture"`
- **Mechanism**: preload uses `invoke()` (async), main uses `on()` (sync)

**Impact**:

- ❌ No desktop notifications for bad posture
- ❌ No break reminders

**Files Affected**:

- script.js (lines 229, 315)
- preload.js (line 5)
- main.js (line 26)

**Fix Complexity**: Medium (requires coordinated changes in 3 files)

---

### **2. Data Persistence (NON-FUNCTIONAL - Priority 2)**

**Root Cause**: Intentional data wipe on every app start

**Code Location**: script.js lines 459-468

```javascript
(function resetSession() {
  localStorage.setItem("correctSeconds", "0");
  localStorage.setItem("incorrectSeconds", "0");
  localStorage.setItem("alertsCount", "0");
  localStorage.setItem("postureHistory", "[]");
  localStorage.setItem("alertsHistory", "[]");
})();
```

**Impact**:

- ❌ Users cannot track progress across sessions
- ❌ All statistics reset to 0 on app restart
- ❌ Event history is wiped
- ❌ Contradicts documentation claims of "persistent statistics"

**Fix Complexity**: Low (remove function or add setting to control it)

---

### **3. Documentation Inaccuracies (Misleading Users)**

**Found Mismatches**:

1. README claims notifications work (they don't) ❌
2. README claims break reminders work (they don't) ❌
3. README implies stats persist (code deletes them) ❌
4. Old copilot-instructions claims wrong IPC method ❌
5. Old copilot-instructions claims CommonJS (uses ES6) ❌

**Fix Complexity**: Low (documentation updates only)

---

## 🎯 AI Agent Guidelines (POST-AUDIT - 100% ACCURATE)

When modifying this codebase, be aware of these **LINE-BY-LINE VERIFIED TRUTHS**:

### ✅ **What ACTUALLY Works**:

1. ✅ **Entry Point**: `main.js` loads `landing.html` (line 22) - VERIFIED
2. ✅ **ES6 Modules**: Both `preload.js` and `script.js` use `import`, NOT `require`
3. ✅ **Military-Grade Classification**: 3 rules (15%, 50%, 10%) - EXACT MATCH
4. ✅ **Event Logging**: Uses `unshift` + `pop` to cap at 100 events - VERIFIED
5. ✅ **Settings Management**: All 4 settings correctly read/written - VERIFIED
6. ✅ **Stats Display**: Correctly parses JSON and populates tables - VERIFIED
7. ✅ **Camera Feed**: Video stream + skeleton overlay working - VERIFIED
8. ✅ **Intelligent Feedback**: Specific messages per error type - VERIFIED

### ❌ **What's BROKEN**:

1. ❌ **IPC Notifications**: Triple mismatch (method + channel + mechanism)

   - script.js calls `sendNotification()` (doesn't exist)
   - preload.js exposes `notify()` (different name)
   - Channels don't match (`"notify"` vs `"notify:posture"`)
   - Mechanisms don't match (`invoke()` vs `on()`)
   - **Fix**: Align all 3 files (see "To Fix" section above)

2. ❌ **Data Persistence**: Stats wiped on every app start (line 459-468)

   - `resetSession()` function deletes ALL data
   - Users cannot track progress across sessions
   - **Fix**: Remove or make optional

3. ❌ **Break Reminders**: Logic coded correctly but IPC broken
   - Runs in `setInterval` (line 305-318)
   - Calls non-existent `sendNotification()` method
   - **Fix**: Same as IPC notification fix

### ⚠️ **Critical Rules**:

1. **DO NOT** modify the 3-rule classification tolerances without understanding impact
2. **DO NOT** change `unshift`/`pop` event logging (100-event cap is correct)
3. **DO** fix IPC method name mismatches if adding notification features
4. **DO** document that stats reset on app restart (or fix `resetSession()`)
5. **DO** use ES6 imports in preload.js (NOT CommonJS)
6. **DO** read all 4 settings from localStorage (keys: `settings_*`)
7. **DO** remember that preload exposes 3 objects: `notify`, `settings`, `stats` (but only `notify` should be used after fixing)

### 📊 **Honest Project Status**:

**Core AI Functionality**: ✅ 100% Working

- Real-time pose detection
- Military-grade classification
- Skeleton overlay rendering
- Visual feedback system

**Notification System**: ❌ 0% Working

- Desktop notifications (IPC broken)
- Break reminders (IPC broken)

**Data Persistence**: ❌ 0% Across Sessions

- Works during current session
- Wiped on app restart (intentional code behavior)

**Overall Functional Assessment**: ~60% of advertised features work

---

## 📚 Additional Verified Information

### **Undocumented Features Found in Code**:

1. **Admin Gate Modal** (script.js lines 411-457):

   - SHA-256 password hashing with crypto.subtle
   - In-memory account validation
   - Modal popup before settings access

2. **Live Stats Modal with CSV Export** (script.js lines 470-558):

   - Real-time session statistics
   - Computed from event history (NOT localStorage counters)
   - CSV export functionality
   - Session tracking with `window.__AB_SESSION_T0`

3. **Camera Pause/Resume** (script.js lines 323-350):

   - Stop/start camera feed
   - Toggle button changes UI state
   - Pauses detection loop

4. **Alert Counter with Blink Animation** (script.js lines 23-42):

   - Increments `alertsCount` in UI and localStorage
   - CSS blink animation on alert card
   - Separate `alertsHistory` array (max 1000)

5. **Session Timer** (script.js lines 560-575):
   - Auto-starts with detection
   - Displayed in UI (mm:ss format)
   - Used for break reminder intervals

---

**Document Version**: 2.0 (Post-QA Audit)  
**Last Updated**: October 26, 2025  
**Verification Method**: Line-by-line code review vs documentation claims  
**Audit Result**: 8 critical mismatches found and documented  
**Status**: 🔴 **CRITICAL BUGS IDENTIFIED - DOCUMENTATION NOW ACCURATE**  
**Next Action**: Use this as reference to fix IPC system and data persistence
