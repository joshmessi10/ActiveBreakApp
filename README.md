# Active Break

**Real-Time Posture Detection and Active Break Reminders for Desktop**

ActiveBreak is a cross-platform Electron desktop application that helps users maintain healthy posture and stay active during computer work. Powered by TensorFlow.js and the MoveNet Lightning model, it performs real-time posture analysis, active break management, challenge progression, and event tracking — all executed locally for full privacy. The system includes break timers, guided micro-exercises, reward progression, persistent per-user settings, and a complete history of posture, alerts, breaks, and challenge achievements.

The application includes a built-in rewards and challenges system that tracks the user’s posture consistency, break compliance, and daily activity. Challenge progress is computed from posture_events and break_events, and users can review their active challenges, historical completions, and progress percentage for each period.


---

## ✨ Key Features

### 🔐 **Secure Authentication System**

- Role-based access control (Admin/Client)
- SQLite3 database with bcrypt password hashing (10 salt rounds)
- Admin dashboard for user management
- Session-based authentication with route protection
- The authentication system includes a persistent session layer and an AuthGuard that validates every IPC request based on user role and active session. All privileged routes (stats, events, settings, rewards, breaks) are protected, and the renderer has no direct database access other than through the sanitized API exposed in preload.js.


### 🎥 **Real-Time Posture Detection**

- AI-powered pose detection using MoveNet Lightning (TensorFlow.js)
- Military-grade classification algorithm with 3 strict rules:
  - Horizontal centering (15% tolerance)
  - Upright spine analysis (50% height requirement)
  - Shoulder symmetry (10% tilt tolerance)
- Visual skeleton overlay (17 keypoints)
- Intelligent feedback with specific correction messages
- Internally, the posture engine stabilizes predictions by consolidating classification once per second, applying confidence filters to each of the 17 keypoints, and requiring consecutive frames of consistent misalignment before triggering a state change.
- Notifications use a cooldown system that prevents repeated alerts during sustained bad posture periods, and posture_events are logged once per second to enable precise analytics and challenge tracking.




### 📊 **Comprehensive Analytics**

- Cumulative statistics tracking (correct/incorrect posture time)
- Interactive Chart.js visualizations (daily posture breakdown)
- Event history with timestamps (session start/end, posture changes)
- Date-range filtering for historical data analysis
- Trend analysis with period-over-period comparison
- CSV export functionality
- Analytics are powered by four event streams stored in the database: posture_events, alert_events, break_events, and challenge_events. Each event is timestamped and normalized to daily, weekly, and monthly aggregates, enabling comparative analytics across multiple periods. The engine supports period-type queries (day/week/month) and returns both absolute metrics and deltas for trend analysis.


### 🔔 **Smart Notifications & Break Reminders**

- Native OS desktop notifications with sound
- Configurable alert threshold (1-60 seconds of bad posture)
- Automatic break reminders with countdown timer (5-120 minutes)
- Random stretching exercise suggestions
- Spam prevention logic
- The break reminder system includes a dedicated timer that tracks the remaining time until the next active break. When triggered, the app displays a guided micro-exercise suggestion and records a break_event for analytics and reward progression. Break reminders include their own cooldown to avoid repeated prompts when the user is switching windows or temporarily inactive.
 
ActiveBreak includes a full active-break module that schedules guided micro-exercises, tracks the duration and completion of each break, and records break events for progress analytics. The system manages countdowns, exercise suggestions, cooldown periods, and streak preservation. These breaks contribute directly to the challenge and reward progression system.


### ⚙️ **Customizable Settings**

- Detection sensitivity adjustment (1-10 scale)
- Toggle notifications on/off
- Configurable alert threshold and break intervals
- Persistent settings across sessions
- Accessible to both admin and client users
- Each user manages their own personal settings
- Each setting is applied immediately to the detection engine without restarting the application. Sensitivity maps directly to the minimum keypoint confidence for MoveNet, and alert/break thresholds update the internal timers and cooldown logic in real time.


### 🎨 **Professional UI/UX**

- Modern dark theme with Inter font and Feather Icons
- CSS variable design system
- Smooth micro-interactions and hover effects
- Responsive layout with gradient backgrounds

---

## 📦 Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Webcam access

### Setup

1. Clone the repository and navigate to the project folder:

```bash
cd ActiveBreakApp
```

2. Install dependencies:

```bash
npm install
```

3. Start the application:

```bash
npm start
```

The application will automatically load the camera, AI model (MoveNet Lightning), and begin real-time posture detection.

### Build for Distribution

To package the application for your current platform:

```bash
npm run build
```

Distributable files (`.exe`, `.dmg`, or `.AppImage`) will be located in the `dist/` folder.

**Supported Platforms**:

- Windows (NSIS Installer + Portable EXE)
- macOS (DMG)
- Linux (AppImage)

**Known Build Notes**:

- The build process may show symbolic link errors on Windows during code-signing tool extraction. This is cosmetic and does not affect functionality.
- Executable size: ~210MB (includes Electron + TensorFlow.js + dependencies)

---

## 🏗️ Architecture & Database

For detailed technical documentation, see:

- **[AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)**: Comprehensive technical guide for AI agents and developers (IPC API, business logic, authentication flow)
- **[architecture.mmd](./architecture.mmd)**: Mermaid diagram showing application architecture and data flow
- **[database.mmd](./database.mmd)**: Entity-relationship diagram (ERD) for SQLite3 database schema
- **[tree.txt](./tree.txt)**: Complete project file structure

**Quick Architecture Overview**:

- **Main Process** (`main.js`): Database operations, IPC handlers, window management
- **Renderer Processes**: Posture detection (`script.js`), admin dashboard, settings
- **IPC Bridge** (`preload.js`): Secure communication via contextBridge
- **Database**: SQLite3 with 5 tables (users, user_settings, user_stats, posture_events, alert_events)
- **Security**: bcrypt password hashing, role-based access control, context isolation

---

## 🛠️ Technology Stack

- **Electron** 38.4.0 - Cross-platform desktop framework
- **TensorFlow.js** 4.22.0 - Machine learning inference
- **MoveNet Lightning** - Ultra-fast pose detection model
- **SQLite3** 5.1.7 - Embedded database
- **bcrypt** 6.0.0 - Password hashing
- **Chart.js** - Data visualization
- **ES6 Modules** - Modern JavaScript
- **Inter Font** - Professional typography
- **Feather Icons** - Modern iconography

---

## 🎮 How It Works

### Authentication Flow

1. **Landing Page**: Choose between Admin or Client access
2. **Login/Registration**:
   - **Admins**: Can self-register from the landing page
   - **Clients**: Login only (accounts created by admins)
3. **Security**: Passwords hashed with bcrypt (10 salt rounds)
4. **Database**: Users stored in `data/users.sqlite`
5. **Role-Based Access**:
   - Admins: Full access (posture detection, settings, user management)
   - Clients: Access to posture detection and personal settings

### Admin Dashboard

- **Navigation bar** with quick access to:
  - Dashboard home
  - Client registration
  - Settings
  - Logout
- View all registered users (email, role, creation date)
- Create new client accounts
- Delete user accounts with confirmation
- Self-deletion detection with automatic logout

### Settings Page

- Accessible to **both admin and client** users
- Each user manages their own personal settings
- Dynamic navigation: Home button adapts based on role
  - Admins: Returns to admin dashboard
  - Clients: Returns to main app
- Settings include sensitivity, notifications, thresholds, and break intervals

### Posture Detection Process

1. **Camera Initialization**: Requests webcam access
2. **AI Model Loading**: Loads MoveNet Lightning model
3. **Real-Time Detection**: Analyzes each video frame for 17 body keypoints
4. **Posture Classification**: Applies 3 strict rules simultaneously:
   - **Rule 1**: Horizontal centering (15% tolerance)
   - **Rule 2**: Upright spine angle (±15° from vertical using Math.atan2)
   - **Rule 3**: Shoulder symmetry (10% tilt tolerance)
5. **Intelligent Feedback**: Displays specific correction messages:
   - ✅ Green: "Postura Correcta"
   - ⚠️ Red: "Centra tu cabeza" / "Endereza tu espalda" / "Nivela tus hombros"
6. **Desktop Notifications**: Triggers after configurable threshold (default: 3 seconds of bad posture)
7. **Automatic Tracking**: Records time in each posture state (1-second intervals)
8. **Session Management**: Logs session start/end events, cumulative statistics
9. **Break Reminders**: Periodic notifications with exercise suggestions

### Statistics & Analytics

- **Cumulative Stats**: Total time in correct/incorrect posture across all sessions
- **Interactive Charts**: Daily posture breakdown with Chart.js visualizations
- **Event History**: Timestamped log of posture changes, sessions, alerts (pagination: 20 events per page)
- **Date Filtering**: Analyze specific time ranges
- **Trend Analysis**: Period-over-period comparison with percentage changes
- **CSV Export**: Download historical data for external analysis
- **Rewards System**: 

### Settings Configuration

- **Sensitivity** (1-10): Adjusts AI confidence threshold
- **Notifications**: Toggle on/off
- **Alert Threshold** (1-60 seconds): Time before bad posture notification
- **Break Interval** (5-120 minutes): Time between break reminders
- **Persistence**: All settings saved to database

---

## 📸 Screenshots

### Authentication Flow

**Login**

<img width="1218" height="762" alt="Login" src="https://github.com/user-attachments/assets/cd995e5e-4b58-4885-82ba-6f9182d5951f" />


### Core Application

**Posture Detection**

<img width="1248" height="916" alt="GoodPosture" src="https://github.com/user-attachments/assets/4a060916-d655-4255-9756-0303b6b49463" />

<img width="1248" height="896" alt="BadPosture" src="https://github.com/user-attachments/assets/7cfca3c4-b373-4b5b-8b12-2cd63e273af9" />

<img width="1243" height="902" alt="BadPosture2" src="https://github.com/user-attachments/assets/fe936dd2-11d0-4864-82ad-30fd88b5bd65" />

**Active Break**

<img width="1217" height="906" alt="ActiveBreak" src="https://github.com/user-attachments/assets/b110b45c-82cc-43df-b7c9-e562682cfa8f" />


**Statistics**

<img width="1165" height="735" alt="Stats" src="https://github.com/user-attachments/assets/67cbc6ce-9226-46ad-98f7-44a598831b73" />


**Rewards System**

<img width="1225" height="902" alt="Rewards" src="https://github.com/user-attachments/assets/4532984b-94a8-4e08-a475-78a04eef6d91" />


**Settings Panel**

<img width="1257" height="942" alt="Config" src="https://github.com/user-attachments/assets/a4a4885b-9831-43f6-8c96-6dde73ed9cf1" />


---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**For AI agents**: Please review [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md) for technical context and development guidelines.

---

## 📄 License

This project is open-source and available under the MIT License.

Josh Sebastián López Murcia
Franklin Julián González Pérez

---

## 🔮 Roadmap

### ✅ Completed Features

- [x] Real-time posture detection with military-grade classification
- [x] Production authentication system (SQLite3 + bcrypt)
- [x] Role-based access control (admin/client)
- [x] Admin dashboard with user management
- [x] Statistics tracking with persistence
- [x] Interactive charts and analytics
- [x] Desktop notifications and break reminders
- [x] Date-range filtering and trend analysis
- [x] CSV export functionality
- [x] Visual posture correction guides
- [x] Build and distribution configuration

### 🚧 Future Enhancements

- [ ] Multi-user session management with JWT tokens
- [ ] Cloud backup for statistics
- [ ] Mobile companion app
- [ ] Posture calibration for different body types
- [ ] Weekly/monthly progress reports via email
- [ ] Integration with fitness trackers

---

## 📧 Contact & Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

**Project Status**: Production Ready 🎉  
**Version**: 12.0  
**Last Updated**: January 2025

---

**Note**: This application requires webcam access to function. All posture detection happens locally on your device - no data is sent to external servers.
