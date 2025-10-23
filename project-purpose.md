# ActiveBreakApp - Project Purpose Document

## 📋 Project Overview

**ActiveBreakApp** is a desktop health and wellness application built with Electron that aims to promote better posture and encourage active breaks during prolonged computer use. The application uses real-time computer vision and AI-powered pose detection to monitor user posture and provide timely feedback to prevent ergonomic issues.

## 🎯 Intended Purpose

The primary purpose of this application is to:

1. **Monitor User Posture**: Use webcam-based computer vision to detect and analyze user sitting posture in real-time
2. **Promote Healthy Habits**: Alert users when poor posture is detected and encourage periodic active breaks
3. **Track Progress**: Maintain statistics on posture quality over time to help users improve their ergonomic habits
4. **Provide Actionable Insights**: Offer historical data and analytics to help users understand their posture patterns

### Target Audience

- Office workers and remote professionals who spend extended hours at their computers
- Students engaged in long study sessions
- Anyone concerned about preventing musculoskeletal issues related to poor posture

## 🏗️ Organizational Structure

### Technical Architecture

**Platform**: Cross-platform desktop application (Electron-based)

**Technology Stack**:

- **Frontend Framework**: Electron (v38.4.0) for desktop app shell
- **AI/ML Libraries**:
  - TensorFlow.js (v4.22.0) for machine learning inference
  - MediaPipe Pose (v0.5) for human pose detection
- **Module System**: ES6 Modules
- **Build Tool**: Electron Builder (v26.0.12)

### Project File Structure

```
ActiveBreakApp/
├── main.js              # Electron main process (window management, app lifecycle)
├── preload.js           # Secure bridge between main and renderer processes
├── package.json         # Project configuration and dependencies
├── README.md            # Setup and execution instructions
└── public/              # Frontend assets
    ├── index.html       # Main view with camera feed and pose detection
    ├── stats.html       # Statistics dashboard
    ├── settings.html    # Configuration interface
    ├── script.js        # Frontend logic and camera management
    └── style.css        # Application styling (dark theme)
```

### Application Components

1. **Main Process (`main.js`)**

   - Creates application window (1000x700px)
   - Manages application lifecycle
   - Implements security through context isolation and preload scripts

2. **User Interface (HTML Pages)**

   - **Home/Detection View**: Real-time camera feed with pose detection overlay
   - **Statistics View**: Historical data on correct vs. incorrect posture counts
   - **Settings View**: Configurable detection sensitivity and notification preferences

3. **Frontend Logic (`script.js`)**

   - Camera access and stream management
   - Session timer functionality
   - User feedback and status updates

4. **Styling (`style.css`)**
   - Modern dark theme (GitHub-inspired color scheme)
   - Responsive layout with clear visual hierarchy
   - Distinct color coding for correct (green) and incorrect (red) postures

## 🔄 Current Stage of Implementation

### ✅ Completed Features

1. **Application Foundation**

   - Electron app structure with proper ES module configuration
   - Multi-page navigation system (Home, Stats, Settings)
   - Responsive dark-themed UI with modern design
   - Application can successfully launch and run

2. **User Interface**

   - Complete HTML structure for all three views
   - Professional styling with consistent branding
   - Navigation system between different sections
   - Video feed container (640x360, 16:9 aspect ratio)

3. **Basic Camera Integration**

   - Camera access request and initialization
   - Video stream rendering to HTML5 video element
   - Error handling for camera access failures
   - Status feedback to user

4. **AI/Computer Vision Core** ✨

   - MoveNet Lightning model integration (TensorFlow.js)
   - Real-time pose landmark detection (17 keypoints)
   - Posture classification algorithm (nose-shoulder alignment)
   - Professional skeleton overlay rendering on canvas
   - Continuous inference loop with requestAnimationFrame

5. **Desktop Notification System** ✨

   - Secure IPC bridge between renderer and main process
   - 3-second bad posture threshold detection
   - Native OS notifications with sound
   - Smart notification logic (prevents spam, auto-resets)
   - Real-time posture feedback with color coding

6. **Data Persistence System** ✨ _NEW_

   - localStorage implementation for posture time tracking
   - Real-time data collection (every 1 second)
   - Separate tracking for correct vs. incorrect posture time
   - Statistics dashboard with mm:ss time format display
   - Persistent data across app restarts

7. **Supporting Features**
   - Session timer with mm:ss formatting
   - Settings interface with sensitivity slider
   - Interactive statistics dashboard with real data
   - History table structure for posture tracking (prepared for future use)

### 🚧 In Progress / Partially Implemented

1. **Real-time Feedback System**

   - Status text elements with color-coded feedback (green/red)
   - Basic posture classification (nose-shoulder alignment)
   - Desktop notifications with 3-second threshold
   - **Missing**: Advanced posture analysis (spine angle, shoulder slope)
   - **Missing**: Configurable alert thresholds in settings
   - **Missing**: Break timer and reminders

2. **Data Persistence & Analytics**
   - localStorage tracking of posture times (correct/incorrect)
   - Real-time statistics display in dashboard
   - **Missing**: Historical event logging (timestamp-based records)
   - **Missing**: Data export functionality (CSV/JSON)
   - **Missing**: Date-range filtering and analytics
   - **Missing**: Session-based tracking

### ❌ Not Yet Implemented

4. **Advanced Features**
   - Posture correction suggestions
   - Break exercise recommendations
   - Daily/weekly progress reports
   - Calibration for different body types

## 🎯 Next Steps for Development

### ✅ Priority 1: Core Functionality - COMPLETED!

1. ✅ Implement MoveNet model loading and initialization
2. ✅ Create pose landmark detection on video stream
3. ✅ Develop posture classification logic (nose-shoulder alignment)
4. ✅ Draw pose skeleton overlay on canvas

### ✅ Priority 2: Enhanced User Feedback - COMPLETED!

1. ✅ Create Electron desktop notification system for poor posture
2. ✅ Implement 3-second bad posture threshold
3. ✅ Add native OS notifications with sound
4. ✅ Secure IPC communication (contextBridge)
5. 🚧 Improve posture analysis with advanced algorithms (spine angles, shoulder slope)
6. 🚧 Add break timer and reminders with configurable intervals

### ✅ Priority 3: Data Persistence - COMPLETED!

1. ✅ Implement local data storage (localStorage)
2. ✅ Connect real pose data to statistics dashboard
3. ✅ Real-time data collection (1-second intervals)
4. ✅ Display cumulative time in mm:ss format
5. 🚧 Create data export functionality (CSV/JSON)
6. 🚧 Add historical event logging with timestamps

### Priority 4: Polish and Optimization

1. Performance optimization for continuous video processing
2. Error handling and recovery mechanisms
3. User onboarding and help documentation
4. Package and distribute application

## 🌟 Success Criteria

The project will be considered successfully implemented when:

- Real-time pose detection accurately identifies user posture
- Users receive timely alerts for poor posture
- Statistics accurately reflect actual usage patterns
- The application runs smoothly without impacting system performance
- Settings persist across application restarts
- The app can be packaged and distributed to end users

---

**Document Version**: 4.0  
**Last Updated**: October 23, 2025  
**Project Status**: Core Features Complete! 🎉 AI Detection + Notifications + Data Tracking Active
