# ActiveBreakApp

**Real-Time Posture Detection and Active Break Reminders for Desktop**

ActiveBreakApp is a cross-platform Electron desktop application that helps users maintain healthy posture during computer work. Using AI-powered computer vision (MediaPipe Pose), the app monitors your sitting posture in real-time and provides intelligent feedback through desktop notifications, statistics tracking, and actionable insights.

---

## ✨ Key Features

### 🔐 **Secure Authentication System**

- Role-based access control (Admin/Client)
- SQLite3 database with bcrypt password hashing (10 salt rounds)
- Admin dashboard for user management
- Session-based authentication with route protection

### 🎥 **Real-Time Posture Detection**

- AI-powered pose detection using MoveNet Lightning (TensorFlow.js)
- Military-grade classification algorithm with 3 strict rules:
  - Horizontal centering (15% tolerance)
  - Upright spine analysis (50% height requirement)
  - Shoulder symmetry (10% tilt tolerance)
- Visual skeleton overlay (17 keypoints)
- Intelligent feedback with specific correction messages

### 📊 **Comprehensive Analytics**

- Cumulative statistics tracking (correct/incorrect posture time)
- Interactive Chart.js visualizations (daily posture breakdown)
- Event history with timestamps (session start/end, posture changes)
- Date-range filtering for historical data analysis
- Trend analysis with period-over-period comparison
- CSV export functionality

### 🔔 **Smart Notifications & Break Reminders**

- Native OS desktop notifications with sound
- Configurable alert threshold (1-60 seconds of bad posture)
- Automatic break reminders with countdown timer (5-120 minutes)
- Random stretching exercise suggestions
- Spam prevention logic

### ⚙️ **Customizable Settings**

- Detection sensitivity adjustment (1-10 scale)
- Toggle notifications on/off
- Configurable alert threshold and break intervals
- Persistent settings across sessions
- Accessible to both admin and client users
- Each user manages their own personal settings

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

### Settings Configuration

- **Sensitivity** (1-10): Adjusts AI confidence threshold
- **Notifications**: Toggle on/off
- **Alert Threshold** (1-60 seconds): Time before bad posture notification
- **Break Interval** (5-120 minutes): Time between break reminders
- **Persistence**: All settings saved to database

---

## 📸 Screenshots

### Authentication Flow

**Admin Login**

<img width="640" alt="Admin Login" src="https://github.com/user-attachments/assets/63916f27-5460-4090-82c3-9a8d4efef5bd" />

**Admin Dashboard**

<img width="640" alt="Admin Dashboard" src="https://github.com/user-attachments/assets/f51a04d1-3e48-4c04-a091-b02a3175aad3" />

**Client Login**

<img width="640" alt="Client Login" src="https://github.com/user-attachments/assets/33cb3901-c60e-40c8-8672-e3dc80d9c6f3" />

### Core Application

**Posture Detection**

<img width="640" alt="Posture Detection" src="https://github.com/user-attachments/assets/e11347a8-c9bb-4eb8-9517-b667e33eeb60" />

**Statistics Modal with Charts**

<img width="640" alt="Statistics" src="https://github.com/user-attachments/assets/2ace1ca2-d70f-486e-86c2-39aa6329cd61" />

**Settings Panel**

<img width="640" alt="Settings" src="https://github.com/user-attachments/assets/b82b930b-ed71-4daf-a926-abb8701b7cef" />

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
- [ ] Gamification (achievements, streaks, challenges)

---

## 📧 Contact & Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

**Project Status**: Production Ready 🎉  
**Version**: 12.0  
**Last Updated**: January 2025

---

**Note**: This application requires webcam access to function. All posture detection happens locally on your device - no data is sent to external servers.
