// script.js - Database-backed version

// 🎯 A. Imports - Access global poseDetection from CDN
const { SupportedModels, createDetector } = window.poseDetection;

// 🆔 Get userId from localStorage session
let userId = null;
try {
  const userJson = localStorage.getItem("ab_current_client");
  if (userJson) {
    const user = JSON.parse(userJson);
    userId = user.id;
  }
} catch (e) {
  console.error("Error getting userId from session:", e);
}

// 📊 Session Tracking Variables (in-memory, saved on session end)
let sessionCorrectSeconds = 0;
let sessionIncorrectSeconds = 0;
let sessionAlertsCount = 0;
let sessionStartTime = null;

// --- New Break Mode State ---
let isInBreakMode = false;
let currentExerciseIndex = 0;
let poseHoldTimer = null; // Will be an interval
let poseHoldTime = 0; // Milliseconds

// --- New Guided Exercise Definitions ---
const guidedBreakExercises = [
  {
    name: "Brazos Arriba",
    desc: "Párate derecho y levanta ambos brazos rectos sobre tu cabeza.",
    validationRule: "ARMS_UP",
  },
  {
    name: "Sentadillas",
    desc: "Baja tu cuerpo doblando las rodillas, mantén la espalda recta y los brazos al frente.",
    validationRule: "SQUAT",
  },
  {
    name: "Manos en las Rodillas",
    desc: "Inclínate y coloca ambas manos sobre tus rodillas.",
    validationRule: "HANDS_ON_KNEES",
  },
  {
    name: "Toque de Pies",
    desc: "Inclínate hacia adelante y trata de tocar tus pies o tobillos con las manos.",
    validationRule: "TOUCH_TOES",
  },
];

// 🎨 DOM Elements
const video = document.getElementById("video");
const canvas = document.getElementById("output");
const toggleBtn = document.getElementById("toggle-btn");
const postureStatus = document.getElementById("posture-status");
const sessionTime = document.getElementById("session-time");
const breakTime = document.getElementById("break-time");
const alertsCount = document.getElementById("alerts-count");
const postureCard = document.getElementById("posture-card");
const postureDetail = document.getElementById("posture-detail");
const alertsCard = document.getElementById("alerts-card");

// 🎯 Break Mode DOM Elements
const breakOverlay = document.getElementById("break-overlay");
const breakTitle = document.getElementById("break-title");
const breakProgress = document.getElementById("break-progress");
const breakCard = document.getElementById("break-card");
const breakExerciseName = document.getElementById("break-exercise-name");
const breakExerciseDesc = document.getElementById("break-exercise-desc");
const breakStatusText = document.getElementById("break-status-text");
const breakTimerBar = document.getElementById("break-timer-bar");
const breakSkipBtn = document.getElementById("break-skip-btn");
const breakCountdown = document.getElementById("break-countdown");

// Create the timer bar fill element (it's not in HTML)
const breakTimerFill = document.createElement("div");
breakTimerFill.className = "break-timer-bar-fill";
breakTimerBar.appendChild(breakTimerFill);

// 🧠 B. Globals - AI and Canvas
let detector = null;
let ctx = null;
let stream = null;
let timerInterval = null;
let dataInterval = null; // Data collection interval
let seconds = 0;
let running = false;
let paused = false;

// 🔔 Alert Threshold Globals
let badPostureStartTime = null;
let notificationSent = false;

// ⏰ Break Timer Globals
let lastBreakNotificationTime = 0;

// 📝 Event Logging Globals
let lastPostureState = "correct"; // Track previous state to detect changes
const statusText = postureDetail;

// 📊 Chart.js Global
let myPostureChart = null;

// ⚙️ Settings cache (loaded once at startup)
let userSettings = {
  sensitivity: 5,
  notificationsEnabled: true,
  alertThreshold: 3,
  breakInterval: 30,
};

function setPosture(isGood) {
  if (isGood) {
    postureCard.classList.add("correct");
    postureCard.classList.remove("incorrect");
  } else {
    postureCard.classList.add("incorrect");
    postureCard.classList.remove("correct");
  }
}

async function registerAlert() {
  // Increment session counter in memory
  sessionAlertsCount++;

  // Update UI
  alertsCount.textContent = String(sessionAlertsCount);

  // Log alert event to database
  if (userId) {
    try {
      await window.api.logAlertEvent(userId, Date.now());
      console.log("✅ Alert event logged to database");
    } catch (err) {
      console.error("Error logging alert event:", err);
    }
  }

  // Visual feedback
  alertsCard.classList.remove("blink");
  void alertsCard.offsetWidth;
  alertsCard.classList.add("blink");
}

// 🕒 Formatea tiempo tipo mm:ss
function formatTime(s) {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// 🕒 Format time as HH:MM:SS
function hhmmss(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

// 🎥 D. Hook into startCamera - Start camera and init pose detection
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    statusText.textContent = "Cámara activa ✅";

    // Initialize session tracking
    sessionStartTime = Date.now();
    sessionCorrectSeconds = 0;
    sessionIncorrectSeconds = 0;
    sessionAlertsCount = 0;

    // Log session start event to database
    if (userId) {
      try {
        await window.api.logPostureEvent(userId, {
          timestamp: sessionStartTime,
          type: "Session Start",
        });
        console.log("✅ Session start logged to database");
      } catch (err) {
        console.error("Error logging session start:", err);
      }
    }

    // Wait for video to be ready, then initialize pose detection
    video.onloadedmetadata = () => {
      initPoseDetection();
    };
  } catch (err) {
    statusText.textContent = "Error al acceder a la cámara ❌";
    console.error(err);
  }
}

// 🤖 C. Init Function - Load MediaPipe Pose model
async function initPoseDetection() {
  try {
    statusText.textContent = "Cargando... ⏳";

    // 1. Get canvas and context
    ctx = canvas.getContext("2d");

    // 2. Set canvas dimensions to match video (640x360 as per project-purpose.md)
    canvas.width = 640;
    canvas.height = 360;

    // 3. Load the lite MediaPipe Pose model
    detector = await createDetector(SupportedModels.MoveNet, {
      modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });

    statusText.textContent = "Modelo cargado ✅ - Detectando postura...";

    // 4. Start the detection loop
    running = true;
    detectPose();

    // 5. Start data collection interval (every 1 second)
    startDataCollection();

    // 6. Start session timer for break reminders
    startTimer();
  } catch (err) {
    statusText.textContent = "Error al cargar el modelo ❌";
    console.error("Error initializing pose detection:", err);
  }
}

// 🔄 E. Detection Loop - Continuous pose estimation
async function detectPose() {
  if (!detector) return;
  if (paused) {
    requestAnimationFrame(detectPose);
    return;
  }
  try {
    // Get pose estimations from video
    const poses = await detector.estimatePoses(video);

    // Clear canvas for fresh frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If poses detected, process them
    if (poses && poses.length > 0) {
      const pose = poses[0];
      drawPose(pose);

      // --- AI Logic Switch ---
      if (isInBreakMode) {
        // We are in a break, check exercise pose
        const rule = guidedBreakExercises[currentExerciseIndex].validationRule;
        classifyBreakPose(pose, rule);
      } else {
        // Not in a break, check sitting posture
        classifyPose(pose);
      }
      // --- End of Logic Switch ---
    }
  } catch (err) {
    console.error("Detection error:", err);
  }

  // Continue loop
  requestAnimationFrame(detectPose);
}

// 🎨 Visual Posture Correction Guides
function showVisualGuide(errorType) {
  const guideContainer = document.getElementById("visual-guide-container");
  if (!guideContainer) return;

  let svgContent = "";

  switch (errorType) {
    case "horizontal":
      // Head not centered horizontally - show figure moving sideways
      svgContent = `
        <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
          <!-- Background -->
          <rect width="200" height="150" fill="#eef6ff"/>
          
          <!-- Center line reference -->
          <line x1="100" y1="10" x2="100" y2="140" stroke="#c8dcff" stroke-width="2" stroke-dasharray="5,5"/>
          
          <!-- Incorrect position (left side, faded) -->
          <g opacity="0.3">
            <circle cx="70" cy="40" r="15" fill="#fecaca" stroke="#e11d48" stroke-width="2"/>
            <line x1="70" y1="55" x2="70" y2="90" stroke="#e11d48" stroke-width="3"/>
            <line x1="70" y1="65" x2="55" y2="80" stroke="#e11d48" stroke-width="3"/>
            <line x1="70" y1="65" x2="85" y2="80" stroke="#e11d48" stroke-width="3"/>
            <line x1="70" y1="90" x2="55" y2="120" stroke="#e11d48" stroke-width="3"/>
            <line x1="70" y1="90" x2="85" y2="120" stroke="#e11d48" stroke-width="3"/>
          </g>
          
          <!-- Arrow indicating movement -->
          <path d="M 80 75 L 95 75" stroke="#60a5fa" stroke-width="3" fill="none" marker-end="url(#arrowhead)"/>
          
          <!-- Correct position (centered, bright) -->
          <g>
            <circle cx="100" cy="40" r="15" fill="#a7f3d0" stroke="#16a34a" stroke-width="2"/>
            <line x1="100" y1="55" x2="100" y2="90" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="65" x2="85" y2="80" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="65" x2="115" y2="80" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="90" x2="85" y2="120" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="90" x2="115" y2="120" stroke="#16a34a" stroke-width="3"/>
          </g>
          
          <!-- Arrow marker definition -->
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#60a5fa"/>
            </marker>
          </defs>
          
          <!-- Text -->
          <text x="100" y="145" text-anchor="middle" fill="#334155" font-size="12" font-weight="bold">Centra tu cabeza</text>
        </svg>
      `;
      break;

    case "upright":
      // Spine angle wrong - show figure straightening back
      svgContent = `
        <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
          <!-- Background -->
          <rect width="200" height="150" fill="#eef6ff"/>
          
          <!-- Vertical reference line -->
          <line x1="100" y1="10" x2="100" y2="130" stroke="#c8dcff" stroke-width="2" stroke-dasharray="5,5"/>
          
          <!-- Incorrect posture (slouched, left side, faded) -->
          <g opacity="0.3">
            <circle cx="65" cy="35" r="15" fill="#fecaca" stroke="#e11d48" stroke-width="2"/>
            <path d="M 70 50 Q 85 70, 80 95" stroke="#e11d48" stroke-width="3" fill="none"/>
            <line x1="70" y1="60" x2="55" y2="75" stroke="#e11d48" stroke-width="3"/>
            <line x1="70" y1="60" x2="85" y2="75" stroke="#e11d48" stroke-width="3"/>
            <line x1="80" y1="95" x2="70" y2="120" stroke="#e11d48" stroke-width="3"/>
            <line x1="80" y1="95" x2="90" y2="120" stroke="#e11d48" stroke-width="3"/>
          </g>
          
          <!-- Arrow indicating movement -->
          <path d="M 85 60 Q 95 55, 102 50" stroke="#60a5fa" stroke-width="3" fill="none" marker-end="url(#arrowhead2)"/>
          
          <!-- Correct posture (upright, centered, bright) -->
          <g>
            <circle cx="100" cy="35" r="15" fill="#a7f3d0" stroke="#16a34a" stroke-width="2"/>
            <line x1="100" y1="50" x2="100" y2="95" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="60" x2="85" y2="75" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="60" x2="115" y2="75" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="95" x2="85" y2="120" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="95" x2="115" y2="120" stroke="#16a34a" stroke-width="3"/>
          </g>
          
          <!-- Arrow marker definition -->
          <defs>
            <marker id="arrowhead2" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#60a5fa"/>
            </marker>
          </defs>
          
          <!-- Text -->
          <text x="100" y="145" text-anchor="middle" fill="#334155" font-size="12" font-weight="bold">Endereza tu espalda</text>
        </svg>
      `;
      break;

    case "shoulders":
      // Shoulders not level - show figure leveling shoulders
      svgContent = `
        <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
          <!-- Background -->
          <rect width="200" height="150" fill="#eef6ff"/>
          
          <!-- Horizontal reference line -->
          <line x1="30" y1="70" x2="170" y2="70" stroke="#c8dcff" stroke-width="2" stroke-dasharray="5,5"/>
          
          <!-- Incorrect posture (tilted shoulders, faded) -->
          <g opacity="0.3">
            <circle cx="100" cy="35" r="15" fill="#fecaca" stroke="#e11d48" stroke-width="2"/>
            <line x1="100" y1="50" x2="100" y2="95" stroke="#e11d48" stroke-width="3"/>
            <line x1="100" y1="60" x2="75" y2="80" stroke="#e11d48" stroke-width="3"/>
            <line x1="100" y1="60" x2="125" y2="70" stroke="#e11d48" stroke-width="3"/>
            <line x1="100" y1="95" x2="85" y2="120" stroke="#e11d48" stroke-width="3"/>
            <line x1="100" y1="95" x2="115" y2="120" stroke="#e11d48" stroke-width="3"/>
          </g>
          
          <!-- Rotation arrow -->
          <path d="M 110 55 Q 115 60, 112 67" stroke="#60a5fa" stroke-width="2.5" fill="none" marker-end="url(#arrowhead3)"/>
          <path d="M 90 65 Q 85 60, 88 53" stroke="#60a5fa" stroke-width="2.5" fill="none" marker-end="url(#arrowhead3)"/>
          
          <!-- Correct posture (level shoulders, bright) -->
          <g transform="translate(0, -20)">
            <circle cx="100" cy="115" r="15" fill="#a7f3d0" stroke="#16a34a" stroke-width="2"/>
            <line x1="100" y1="130" x2="100" y2="175" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="140" x2="75" y2="150" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="140" x2="125" y2="150" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="175" x2="85" y2="200" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="175" x2="115" y2="200" stroke="#16a34a" stroke-width="3"/>
          </g>
          
          <!-- Arrow marker definition -->
          <defs>
            <marker id="arrowhead3" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#60a5fa"/>
            </marker>
          </defs>
          
          <!-- Text -->
          <text x="100" y="145" text-anchor="middle" fill="#334155" font-size="12" font-weight="bold">Nivela tus hombros</text>
        </svg>
      `;
      break;

    case "none":
    default:
      // Good posture - show checkmark
      svgContent = `
        <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
          <!-- Background -->
          <rect width="200" height="150" fill="#eef6ff"/>
          
          <!-- Perfect posture figure -->
          <g>
            <circle cx="100" cy="40" r="15" fill="#a7f3d0" stroke="#16a34a" stroke-width="2"/>
            <line x1="100" y1="55" x2="100" y2="90" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="65" x2="85" y2="80" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="65" x2="115" y2="80" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="90" x2="85" y2="120" stroke="#16a34a" stroke-width="3"/>
            <line x1="100" y1="90" x2="115" y2="120" stroke="#16a34a" stroke-width="3"/>
          </g>
          
          <!-- Large checkmark -->
          <path d="M 60 75 L 85 100 L 140 50" stroke="#16a34a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          
          <!-- Text -->
          <text x="100" y="145" text-anchor="middle" fill="#16a34a" font-size="14" font-weight="bold">¡Postura Perfecta!</text>
        </svg>
      `;
      break;
  }

  guideContainer.innerHTML = svgContent;
}

// 📊 F. Classification - Simple posture rule
function classifyPose(pose) {
  if (!pose.keypoints) return;

  // Get key body points
  const nose = pose.keypoints.find((kp) => kp.name === "nose");
  const leftShoulder = pose.keypoints.find((kp) => kp.name === "left_shoulder");
  const rightShoulder = pose.keypoints.find(
    (kp) => kp.name === "right_shoulder"
  );

  // ⚙️ Use cached sensitivity setting
  const confidenceThreshold = 0.5 - userSettings.sensitivity * 0.04;

  // Check if all keypoints are detected with sufficient confidence
  if (!nose || !leftShoulder || !rightShoulder) return;
  if (
    nose.score < confidenceThreshold ||
    leftShoulder.score < confidenceThreshold ||
    rightShoulder.score < confidenceThreshold
  )
    return;

  // MILITARY-GRADE POSTURE: Head must be straight up, no slouching, no leaning
  const noseX = nose.x;
  const noseY = nose.y;
  const leftShoulderX = leftShoulder.x;
  const leftShoulderY = leftShoulder.y;
  const rightShoulderX = rightShoulder.x;
  const rightShoulderY = rightShoulder.y;

  // Calculate shoulder midpoint and width
  const shoulderMidX = (leftShoulderX + rightShoulderX) / 2;
  const shoulderMidY = (leftShoulderY + rightShoulderY) / 2;
  const shoulderWidth = Math.abs(rightShoulderX - leftShoulderX);

  // 🎖️ RULE 1: STRICT Horizontal alignment - head must be PERFECTLY centered
  // Allow only 15% deviation from center (very strict!)
  const horizontalDeviation = Math.abs(noseX - shoulderMidX);
  const maxHorizontalDeviation = shoulderWidth * 0.15;
  const isHorizontallyCentered = horizontalDeviation <= maxHorizontalDeviation;

  // 🎖️ RULE 2: ADVANCED Neck/Upper Spine Angle Analysis
  const deltaX = noseX - shoulderMidX;
  const deltaY = noseY - shoulderMidY;
  const angleRadians = Math.atan2(deltaY, deltaX);
  const angleDegrees = (angleRadians * 180) / Math.PI;

  const minAngle = -105;
  const maxAngle = -75;
  const isUpright = angleDegrees >= minAngle && angleDegrees <= maxAngle;

  // 🎖️ RULE 3: Shoulder symmetry - shoulders must be level (no tilting)
  const shoulderHeightDiff = Math.abs(leftShoulderY - rightShoulderY);
  const maxShoulderTilt = shoulderWidth * 0.1;
  const shouldersAreLevel = shoulderHeightDiff <= maxShoulderTilt;

  // ⚠️ MILITARY STANDARD: ALL conditions must pass
  const isCentered = isHorizontallyCentered && isUpright && shouldersAreLevel;
  const currentState = isCentered ? "correct" : "incorrect";

  // 📝 Log state changes to database
  if (currentState !== lastPostureState) {
    const eventType = currentState === "correct" ? "Correcta" : "Incorrecta";
    if (userId) {
      window.api
        .logPostureEvent(userId, {
          timestamp: Date.now(),
          type: eventType,
        })
        .catch((err) => console.error("Error logging posture event:", err));
    }
    lastPostureState = currentState;
  }

  if (isCentered) {
    // ✅ Good posture - Reset alert state
    statusText.textContent = "✅ Buena Postura";
    statusText.style.color = "#2ea043";
    setPosture(true);

    showVisualGuide("none");

    badPostureStartTime = null;
    notificationSent = false;
  } else {
    setPosture(false);

    let feedback = "⚠️ ";
    let errorType = "none";

    if (!isHorizontallyCentered) {
      feedback += "Centra tu cabeza";
      errorType = "horizontal";
    } else if (!isUpright) {
      feedback += "Endereza tu espalda";
      errorType = "upright";
    } else if (!shouldersAreLevel) {
      feedback += "Nivela tus hombros";
      errorType = "shoulders";
    }

    statusText.textContent = feedback;
    statusText.style.color = "#e11d48";

    showVisualGuide(errorType);

    if (badPostureStartTime === null) {
      badPostureStartTime = Date.now();
    }

    const badPostureDuration = Date.now() - badPostureStartTime;

    if (
      badPostureDuration > userSettings.alertThreshold * 1000 &&
      !notificationSent
    ) {
      registerAlert();
      notificationSent = true;

      if (
        userSettings.notificationsEnabled &&
        window.api &&
        window.api.sendNotification
      ) {
        window.api.sendNotification(
          "¡Alerta de Postura!",
          `¡Corrige tu postura! Llevas más de ${userSettings.alertThreshold}s en mala posición.`
        );
      }
    }
  }
}

// 🎨 G. Drawing - Render skeleton and keypoints
function drawPose(pose) {
  if (!pose.keypoints) return;

  const keypoints = pose.keypoints;

  // Define skeleton connections
  const connections = [
    ["nose", "left_eye"],
    ["nose", "right_eye"],
    ["left_eye", "left_ear"],
    ["right_eye", "right_ear"],
    ["left_shoulder", "right_shoulder"],
    ["left_shoulder", "left_elbow"],
    ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"],
    ["right_elbow", "right_wrist"],
    ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"],
    ["left_hip", "left_knee"],
    ["left_knee", "left_ankle"],
    ["right_hip", "right_knee"],
    ["right_knee", "right_ankle"],
  ];

  // Draw skeleton lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;

  connections.forEach(([startName, endName]) => {
    const start = keypoints.find((kp) => kp.name === startName);
    const end = keypoints.find((kp) => kp.name === endName);

    if (start && end && start.score > 0.3 && end.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  });

  // Draw keypoints (dots)
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  keypoints.forEach((kp) => {
    if (kp.score > 0.3) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

// 📊 H. Data Collection - Track time in each posture state (in-memory)
function startDataCollection() {
  if (dataInterval) return;
  dataInterval = setInterval(() => {
    const isPostureBad = badPostureStartTime !== null;

    if (detector && running && !paused) {
      if (isPostureBad) {
        sessionIncorrectSeconds++;
      } else {
        sessionCorrectSeconds++;
      }
    }

    // recordatorios de pausa
    const elapsedSeconds = seconds;
    const breakIntervalSeconds = userSettings.breakInterval * 60;

    if (
      running &&
      !paused &&
      elapsedSeconds > 0 &&
      elapsedSeconds % breakIntervalSeconds === 0 &&
      elapsedSeconds !== lastBreakNotificationTime &&
      !isInBreakMode
    ) {
      console.log("⏰ Break time reached! Starting guided break sequence.");
      startBreakSequence();
      lastBreakNotificationTime = elapsedSeconds;
    }
  }, 1000);
}

// 💾 Save session stats to database
async function saveSessionStats() {
  if (!userId) return;

  try {
    const result = await window.api.logSessionStats(
      userId,
      sessionCorrectSeconds,
      sessionIncorrectSeconds,
      sessionAlertsCount
    );

    if (result.success) {
      console.log("✅ Session stats saved to database");
    } else {
      console.error("Error saving session stats:", result.message);
    }
  } catch (err) {
    console.error("Error saving session stats:", err);
  }
}

// 📥 Load user settings from database
async function loadUserSettings() {
  if (!userId) return;

  try {
    const result = await window.api.getSettings(userId);
    if (result.success) {
      userSettings = {
        sensitivity: result.settings.sensitivity,
        notificationsEnabled: result.settings.notificationsEnabled === 1,
        alertThreshold: result.settings.alertThreshold,
        breakInterval: result.settings.breakInterval,
      };
      console.log("✅ User settings loaded from database:", userSettings);
    } else {
      console.error("Error loading settings:", result.message);
    }
  } catch (err) {
    console.error("Error loading settings:", err);
  }
}

// Initialize - Load settings before starting camera
(async function init() {
  await loadUserSettings();
  startCamera();
})();

// --- refs y estado ---
function setToggleUIRunning() {
  if (!toggleBtn) return;
  toggleBtn.textContent = "Pausar";
  toggleBtn.classList.remove("ab-toggle--green");
  toggleBtn.classList.add("ab-toggle--red");
}

function setToggleUIPaused() {
  if (!toggleBtn) return;
  toggleBtn.textContent = "Reanudar";
  toggleBtn.classList.remove("ab-toggle--red");
  toggleBtn.classList.add("ab-toggle--green");
}

// Detener y reanudar cámara
async function stopCamera() {
  // Save session stats before stopping
  await saveSessionStats();

  // Log session end event
  if (userId) {
    try {
      await window.api.logPostureEvent(userId, {
        timestamp: Date.now(),
        type: "Session End",
      });
      console.log("✅ Session end logged to database");
    } catch (err) {
      console.error("Error logging session end:", err);
    }
  }

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    stream = null;
  }
  running = false;
  paused = true;
  stopTimer();
  if (dataInterval) {
    clearInterval(dataInterval);
    dataInterval = null;
  }
  if (breakTime) {
    breakTime.textContent = "--:--";
  }
  statusText.textContent = "Cámara pausada ⏸️";
  setToggleUIPaused();
}

if (toggleBtn) {
  setToggleUIRunning();
  toggleBtn.addEventListener("click", () => {
    if (!paused) {
      stopCamera();
    } else {
      startCamera();
      paused = false;
      setToggleUIRunning();
    }
  });
}

// ⏱️ Temporizador de sesión
function startTimer() {
  seconds = 0;
  stopTimer();
  timerInterval = setInterval(() => {
    seconds++;
    if (sessionTime) {
      sessionTime.textContent = formatTime(seconds);
    }
    updateBreakCountdown();
  }, 1000);
  console.log("⏱️ Session timer started");
}

function stopTimer() {
  clearInterval(timerInterval);
}

// ⏰ Update break countdown display
function updateBreakCountdown() {
  if (!breakTime) return;

  const breakIntervalSeconds = userSettings.breakInterval * 60;
  const elapsedSeconds = seconds;
  const nextBreakAt =
    Math.ceil((elapsedSeconds + 1) / breakIntervalSeconds) *
    breakIntervalSeconds;
  const remainingSeconds = nextBreakAt - elapsedSeconds;

  if (running && !paused) {
    breakTime.textContent = formatTime(remainingSeconds);
  } else {
    breakTime.textContent = "--:--";
  }
}

// ===== Modal de Estadísticas (database-backed) =====
(function statsModalSession() {
  const link = document.getElementById("nav-stats");
  const modal = document.getElementById("stats-modal");
  if (!link || !modal) return;

  const tbody = modal.querySelector("#stats-table tbody");
  const kpiCorrect = modal.querySelector("#kpi-correct");
  const kpiIncorrect = modal.querySelector("#kpi-incorrect");
  const kpiAlerts = modal.querySelector("#kpi-alerts");
  const btnExport = modal.querySelector("#stats-export");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const filterButton = document.getElementById("filterButton");
  const resetButton = document.getElementById("resetButton");
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  const pageInfo = document.getElementById("pageInfo");

  let refreshTimer = null;
  let currentPage = 1;
  const rowsPerPage = 20;

  // Render function - fetches data from database
  async function render(startDate = null, endDate = null) {
    if (!userId) {
      console.error("No userId available");
      return;
    }

    try {
      // Get all data from database in one call
      const result = await window.api.getModalData(userId, startDate, endDate);

      if (!result.success) {
        console.error("Error loading modal data:", result.message);
        return;
      }

      const { kpis, totalAlerts, eventList, chartData, trendData } =
        result.data;

      console.log("📊 Chart data received:", chartData);
      console.log("📊 Chart labels:", chartData?.labels);
      console.log("📊 Chart datasets:", chartData?.datasets);

      // Update KPIs
      kpiCorrect.textContent = hhmmss(kpis.correct);
      kpiIncorrect.textContent = hhmmss(kpis.incorrect);
      kpiAlerts.textContent = String(totalAlerts);

      // Update trend analysis
      const trendContainer = document.getElementById(
        "trend-analysis-container"
      );
      if (trendData && trendContainer) {
        const correctClass = trendData.correctTrend.startsWith("+")
          ? "trend-positive"
          : trendData.correctTrend.startsWith("-")
          ? "trend-negative"
          : "";
        const incorrectClass = trendData.incorrectTrend.startsWith("-")
          ? "trend-positive"
          : trendData.incorrectTrend.startsWith("+")
          ? "trend-negative"
          : "";

        trendContainer.innerHTML = `
          <strong>📊 Comparación con período anterior:</strong><br>
          Postura Correcta: <span class="${correctClass}">${trendData.correctTrend}</span> | 
          Postura Incorrecta: <span class="${incorrectClass}">${trendData.incorrectTrend}</span>
        `;
        trendContainer.style.display = "block";
      } else if (trendContainer) {
        trendContainer.style.display = "none";
      }

      // Update chart
      const ctx = document.getElementById("postureChart");
      if (ctx && typeof Chart !== "undefined") {
        if (myPostureChart) {
          myPostureChart.data.labels = chartData.labels;
          myPostureChart.data.datasets = chartData.datasets;
          myPostureChart.update("none");
        } else {
          myPostureChart = new Chart(ctx.getContext("2d"), {
            type: "bar",
            data: chartData,
            options: {
              responsive: true,
              maintainAspectRatio: true,
              animation: {
                duration: 750,
              },
              plugins: {
                title: {
                  display: true,
                  text: "Tiempo por Postura (Minutos)",
                  font: { size: 16, weight: "bold" },
                },
                legend: {
                  display: true,
                  position: "top",
                },
              },
              scales: {
                x: {
                  stacked: true,
                  title: {
                    display: true,
                    text: "Fecha",
                  },
                },
                y: {
                  stacked: true,
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: "Tiempo (minutos)",
                  },
                  ticks: {
                    callback: (value) => `${value} min`,
                  },
                },
              },
            },
          });
        }
      }

      // Update table with pagination
      tbody.innerHTML = "";

      if (eventList.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td colspan="2" style="text-align: center; color: #888;">No hay eventos en el rango seleccionado</td>';
        tbody.appendChild(tr);
        if (prevPageBtn) prevPageBtn.style.display = "none";
        if (nextPageBtn) nextPageBtn.style.display = "none";
        if (pageInfo) pageInfo.style.display = "none";
      } else {
        // eventList comes newest first from database
        const totalPages = Math.ceil(eventList.length / rowsPerPage);

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        const pageRows = eventList.slice(startIdx, endIdx);

        pageRows.forEach((r) => {
          const tr = document.createElement("tr");
          const time = new Date(r.timestamp).toLocaleTimeString();

          if (r.type === "Session Start" || r.type === "Session End") {
            tr.innerHTML = `<td colspan="2" class="event-session">🔔 ${r.type} - ${time}</td>`;
          } else {
            tr.innerHTML = `<td>${time}</td><td>${r.type}</td>`;
          }

          tbody.appendChild(tr);
        });

        if (pageInfo) {
          pageInfo.textContent = `Página ${currentPage} de ${totalPages} (${eventList.length} eventos)`;
          pageInfo.style.display = "inline";
        }
        if (prevPageBtn) {
          prevPageBtn.disabled = currentPage === 1;
          prevPageBtn.style.display = "inline-block";
        }
        if (nextPageBtn) {
          nextPageBtn.disabled = currentPage === totalPages;
          nextPageBtn.style.display = "inline-block";
        }
      }
    } catch (err) {
      console.error("Error rendering modal:", err);
    }
  }

  function open() {
    modal.setAttribute("aria-hidden", "false");
    currentPage = 1;
    const trendContainer = document.getElementById("trend-analysis-container");
    if (trendContainer) {
      trendContainer.style.display = "none";
    }
    render(null, null);
    refreshTimer = setInterval(() => {
      const startDate = startDateInput.value || null;
      const endDate = endDateInput.value || null;
      render(startDate, endDate);
    }, 1000);
  }

  function close() {
    modal.setAttribute("aria-hidden", "true");
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });

  modal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) close();
  });

  if (filterButton) {
    filterButton.addEventListener("click", () => {
      currentPage = 1;
      const startDate = startDateInput.value || null;
      const endDate = endDateInput.value || null;
      render(startDate, endDate);
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      startDateInput.value = "";
      endDateInput.value = "";
      currentPage = 1;
      const trendContainer = document.getElementById(
        "trend-analysis-container"
      );
      if (trendContainer) {
        trendContainer.style.display = "none";
      }
      render(null, null);
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        const startDate = startDateInput.value || null;
        const endDate = endDateInput.value || null;
        render(startDate, endDate);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      currentPage++;
      const startDate = startDateInput.value || null;
      const endDate = endDateInput.value || null;
      render(startDate, endDate);
    });
  }

  btnExport.addEventListener("click", async () => {
    try {
      const result = await window.api.getModalData(userId, null, null);
      if (!result.success) return;

      const rows = [["timestamp", "hora_local", "evento"]];
      result.data.eventList.forEach((ev) =>
        rows.push([
          ev.timestamp,
          new Date(ev.timestamp).toLocaleString(),
          ev.type,
        ])
      );

      const csv = rows
        .map((r) =>
          r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")
        )
        .join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `activebreak_sesion_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting data:", err);
    }
  });
})();

// 🧠 Mensaje de bienvenida animado
window.addEventListener("DOMContentLoaded", () => {
  statusText.textContent = "Bienvenido a ActiveBreak ✨";

  console.log("🔍 Checking IPC bridge...");
  console.log("window.api exists:", !!window.api);
  console.log(
    "window.api.sendNotification exists:",
    !!(window.api && window.api.sendNotification)
  );

  if (window.api && window.api.sendNotification) {
    console.log("✅ IPC bridge is ready!");
  } else {
    console.error("❌ IPC bridge NOT available! Notifications will not work.");
  }
});

// ==================================
// === NEW GUIDED BREAK FUNCTIONS ===
// ==================================

/**
 * Starts the guided break sequence.
 */
function startBreakSequence() {
  isInBreakMode = true;
  currentExerciseIndex = 0;
  resetPoseHoldTimer();
  loadExercise(currentExerciseIndex);

  // Move camera elements to break overlay
  const breakCameraContainer = document.getElementById(
    "break-camera-container"
  );
  const originalCameraContainer = document.getElementById("camera-container");

  // Store the original parent for restoration later
  if (!window.originalCameraParent) {
    window.originalCameraParent = originalCameraContainer;
  }

  // Move video and canvas to break container
  breakCameraContainer.appendChild(video);
  breakCameraContainer.appendChild(canvas);

  breakOverlay.style.display = "flex";
}

/**
 * Loads a specific exercise into the UI.
 */
function loadExercise(index) {
  if (index >= guidedBreakExercises.length) {
    endBreakSequence();
    return;
  }

  const exercise = guidedBreakExercises[index];
  breakProgress.textContent = `Ejercicio ${index + 1} de ${
    guidedBreakExercises.length
  }`;
  breakExerciseName.textContent = exercise.name;
  breakExerciseDesc.textContent = exercise.desc;

  // Reset UI state
  breakCard.classList.remove("pose-detected");
  breakStatusText.textContent = "Colócate en posición...";
  breakTimerFill.style.transform = "scaleX(0)";

  // Update skip button
  if (index === guidedBreakExercises.length - 1) {
    breakSkipBtn.textContent = "¡Terminar!";
  } else {
    breakSkipBtn.textContent = "Saltar Ejercicio";
  }
}

/**
 * Ends the guided break sequence and resumes the app.
 */
function endBreakSequence() {
  isInBreakMode = false;
  resetPoseHoldTimer();

  // Restore camera elements to original position
  if (window.originalCameraParent) {
    window.originalCameraParent.appendChild(video);
    window.originalCameraParent.appendChild(canvas);
  }

  breakOverlay.style.display = "none";
}

/**
 * Resets the 10-second pose hold timer.
 */
function resetPoseHoldTimer() {
  if (poseHoldTimer) {
    clearInterval(poseHoldTimer);
    poseHoldTimer = null;
  }
  poseHoldTime = 0;

  // Reset UI
  breakCard.classList.remove("pose-detected");
  breakStatusText.textContent = "Colócate en posición...";
  breakTimerFill.style.transform = "scaleX(0)";
  breakCountdown.textContent = "10s";
}

/**
 * Called when a pose is successfully held for 10 seconds.
 */
function completeExercise() {
  resetPoseHoldTimer();
  currentExerciseIndex++;
  loadExercise(currentExerciseIndex);
}

/**
 * Handles clicks on the 'Skip' button.
 */
breakSkipBtn.addEventListener("click", () => {
  // If on last exercise, button text is "Terminar!"
  if (currentExerciseIndex >= guidedBreakExercises.length - 1) {
    endBreakSequence();
  } else {
    // Skip to next
    completeExercise();
  }
});

/**
 * NEW CLASSIFIER: Checks for guided break poses.
 * Called 10x per second by detectPose.
 */
function classifyBreakPose(pose, rule) {
  if (!pose || !pose.keypoints) {
    resetPoseHoldTimer();
    return;
  }

  // Extract keypoints by name
  const getKp = (name) => pose.keypoints.find((kp) => kp.name === name);

  const l_s = getKp("left_shoulder");
  const r_s = getKp("right_shoulder");
  const l_w = getKp("left_wrist");
  const r_w = getKp("right_wrist");
  const l_k = getKp("left_knee");
  const r_k = getKp("right_knee");
  const l_h = getKp("left_hip");
  const r_h = getKp("right_hip");

  let isPoseCorrect = false;
  const conf = 0.3; // Confidence threshold

  try {
    switch (rule) {
      case "ARMS_UP":
        // Wrists must be above shoulders
        if (
          l_s &&
          l_w &&
          r_s &&
          r_w &&
          l_s.score > conf &&
          l_w.score > conf &&
          r_s.score > conf &&
          r_w.score > conf
        ) {
          isPoseCorrect = l_w.y < l_s.y && r_w.y < r_s.y;
        }
        break;

      case "SQUAT":
        // Knees must be bent significantly (knees higher than hips)
        // Hips lowered (hips below shoulders)
        if (
          l_s &&
          r_s &&
          l_h &&
          r_h &&
          l_k &&
          r_k &&
          l_s.score > conf &&
          r_s.score > conf &&
          l_h.score > conf &&
          r_h.score > conf &&
          l_k.score > conf &&
          r_k.score > conf
        ) {
          const avgShoulderY = (l_s.y + r_s.y) / 2;
          const avgHipY = (l_h.y + r_h.y) / 2;
          const avgKneeY = (l_k.y + r_k.y) / 2;

          // Check if hips are lowered (hips should be below shoulders)
          const hipsLowered = avgHipY > avgShoulderY + 0.15; // 15% below shoulders

          // Check if knees are bent (knees should be visible and lower than hips)
          const kneesBent = avgKneeY > avgHipY;

          isPoseCorrect = hipsLowered && kneesBent;
        }
        break;

      case "HANDS_ON_KNEES":
        // Wrists must be near knees (y)
        if (
          l_w &&
          r_w &&
          l_k &&
          r_k &&
          l_w.score > conf &&
          r_w.score > conf &&
          l_k.score > conf &&
          r_k.score > conf
        ) {
          const yRange = Math.abs(l_k.y - r_k.y) + l_k.y * 0.2; // 20% Y-tolerance
          isPoseCorrect =
            Math.abs(l_w.y - l_k.y) < yRange &&
            Math.abs(r_w.y - r_k.y) < yRange;
        }
        break;

      case "TOUCH_TOES":
        // Wrists must be near ankles/feet (below knees)
        // Body bent forward
        const l_a = getKp("left_ankle");
        const r_a = getKp("right_ankle");

        if (
          l_w &&
          r_w &&
          l_k &&
          r_k &&
          l_a &&
          r_a &&
          l_s &&
          r_s &&
          l_h &&
          r_h &&
          l_w.score > conf &&
          r_w.score > conf &&
          l_k.score > conf &&
          r_k.score > conf
        ) {
          // Check if wrists are below knees (reaching down)
          const wristsLow = (l_w.y + r_w.y) / 2 > (l_k.y + r_k.y) / 2;

          // Check if body is bent forward (hips higher than shoulders)
          const avgShoulderY = (l_s.y + r_s.y) / 2;
          const avgHipY = (l_h.y + r_h.y) / 2;
          const bentForward = avgShoulderY > avgHipY - 0.1;

          isPoseCorrect = wristsLow && bentForward;
        }
        break;
    }
  } catch (e) {
    // If any keypoint is missing, score is too low, etc.
    console.error("Error in classifyBreakPose:", e);
    isPoseCorrect = false;
  }

  // --- Handle Timer Logic ---
  if (isPoseCorrect) {
    breakCard.classList.add("pose-detected");
    breakStatusText.textContent = "¡Excelente, mantén la pose!";

    if (poseHoldTimer === null) {
      // This is the first frame the pose is correct, start the timer.
      poseHoldTimer = setInterval(() => {
        poseHoldTime += 1000; // Add 1 second

        // Update timer bar (e.g., 2000ms / 10000ms = 0.2 = 20%)
        let percent = poseHoldTime / 10000;
        breakTimerFill.style.transform = `scaleX(${percent})`;

        // Update countdown display
        const secondsRemaining = Math.ceil((10000 - poseHoldTime) / 1000);
        breakCountdown.textContent = `${secondsRemaining}s`;

        if (poseHoldTime >= 10000) {
          completeExercise();
        }
      }, 1000);
    }
  } else {
    // Pose is incorrect, reset everything
    resetPoseHoldTimer();
  }
}

// Logout function for user dashboard
async function logout() {
  try {
    // Save session stats
    await saveSessionStats();

    // Log session end
    if (userId) {
      await window.api.logPostureEvent(userId, {
        timestamp: Date.now(),
        type: "Session End",
      });
    }

    localStorage.removeItem("ab_current_client");
    localStorage.removeItem("ab_current_user"); // Also clear admin session
    window.location.replace("landing.html");
  } catch (e) {
    console.error("Error during logout:", e);
    window.location.replace("landing.html");
  }
}

// Log session end when window/tab is closed
window.addEventListener("beforeunload", async () => {
  if (userId) {
    // Save session stats
    await saveSessionStats();

    // Log session end
    await window.api.logPostureEvent(userId, {
      timestamp: Date.now(),
      type: "Session End",
    });
  }
});
