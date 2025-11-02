// script.js

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
let lastIncrementTime = null;

// 💪 Exercise Suggestions for Break Reminders
const breakExercises = [
  {
    name: "Giro de Cuello",
    desc: "Gira tu cabeza lentamente de lado a lado durante 15 segundos.",
  },
  {
    name: "Estiramiento de Hombros",
    desc: "Encoge tus hombros hacia tus orejas, mantén 5s y relaja.",
  },
  {
    name: "Estiramiento de Muñeca",
    desc: "Extiende tu brazo y flexiona tu muñeca hacia arriba y abajo (10s).",
  },
  {
    name: "Mirada Lejana",
    desc: "Enfoca tu vista en un objeto lejano (20m+) durante 20 segundos.",
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
  const current = sessionAlertsCount;
  alertsCount.textContent = String(current);

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
    lastIncrementTime = sessionStartTime;

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
      classifyPose(pose);
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

  // ⚙️ Load sensitivity setting (1-10, default: 5)
  // Map sensitivity: 1 (strict, 0.46) to 10 (lenient, 0.06)
  const sensitivitySetting = parseInt(
    localStorage.getItem("settings_sensitivity") || "5",
    10
  );
  const confidenceThreshold = 0.5 - sensitivitySetting * 0.04;

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

  // 🎖️ RULE 2: ADVANCED Neck/Upper Spine Angle Analysis (NEW!)
  // Calculate the angle of the vector from shoulder midpoint to nose
  // In this coordinate system, -90° (-PI/2) is perfectly vertical (upright)
  // We allow +/- 15° tolerance (between -75° and -105°)
  const deltaX = noseX - shoulderMidX;
  const deltaY = noseY - shoulderMidY;
  const angleRadians = Math.atan2(deltaY, deltaX);
  const angleDegrees = (angleRadians * 180) / Math.PI;

  // Vertical is -90°. Check if angle is within +/- 15° of vertical
  // This means: -105° <= angle <= -75°
  const minAngle = -105;
  const maxAngle = -75;
  const isUpright = angleDegrees >= minAngle && angleDegrees <= maxAngle;

  // 🎖️ RULE 3: Shoulder symmetry - shoulders must be level (no tilting)
  const shoulderHeightDiff = Math.abs(leftShoulderY - rightShoulderY);
  const maxShoulderTilt = shoulderWidth * 0.1; // Max 10% tilt allowed
  const shouldersAreLevel = shoulderHeightDiff <= maxShoulderTilt;

  // ⚠️ MILITARY STANDARD: ALL conditions must pass (no exceptions!)
  const isCentered = isHorizontallyCentered && isUpright && shouldersAreLevel;
  const currentState = isCentered ? "correct" : "incorrect";

  // 📝 Log state changes to database
  if (currentState !== lastPostureState) {
    const eventType = currentState === "correct" ? "Correcta" : "Incorrecta";
    if (userId) {
      window.api.logPostureEvent(userId, {
        timestamp: Date.now(),
        type: eventType,
      }).catch(err => console.error("Error logging posture event:", err));
    }
    lastPostureState = currentState;
  }

  if (isCentered) {
    // ✅ Good posture - Reset alert state
    statusText.textContent = "✅ Buena Postura";
    statusText.style.color = "#2ea043";
    setPosture(true); // PATCH ✔

    // Show visual guide for correct posture
    showVisualGuide("none");

    // Reset bad posture tracking
    if (badPostureStartTime !== null) {
    }
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

    // Show visual guide for the specific error
    showVisualGuide(errorType);

    if (badPostureStartTime === null) {
      badPostureStartTime = Date.now();
    }

    const alertThreshold = parseInt(
      localStorage.getItem("settings_alertThreshold") || "3",
      10
    );
    const badPostureDuration = Date.now() - badPostureStartTime;

    if (badPostureDuration > alertThreshold * 1000 && !notificationSent) {
      // ⚠️ Se disparó una alerta: cuenta SIEMPRE
      registerAlert();
      notificationSent = true;

      // luego, si las notificaciones están habilitadas, avisa
      const notificationsEnabled =
        localStorage.getItem("settings_notifications") !== "false";
      if (notificationsEnabled && window.api && window.api.sendNotification) {
        window.api.sendNotification(
          "¡Alerta de Postura!",
          `¡Corrige tu postura! Llevas más de ${alertThreshold}s en mala posición.`
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

// 📝 I. Event Logging - Log posture state changes
function logPostureEvent(state) {
  try {
    // 1. Read existing events from localStorage
    const historyJSON = localStorage.getItem("postureHistory");
    let history = historyJSON ? JSON.parse(historyJSON) : [];

    // 2. Create new event object
    // State can be: "correct", "incorrect", "Session Start", "Session End"
    let eventType;
    if (state === "correct") {
      eventType = "Correcta";
    } else if (state === "incorrect") {
      eventType = "Incorrecta";
    } else {
      // For session events, use state directly (e.g., "Session Start", "Session End")
      eventType = state;
    }

    const event = {
      timestamp: Date.now(),
      type: eventType,
    };

    // 3. Add to beginning of array (newest first)
    history.unshift(event);

    // 4. Cap at 100 events (remove oldest if needed)
    if (history.length > 100) {
      history.pop();
    }

    // 5. Save back to localStorage
    localStorage.setItem("postureHistory", JSON.stringify(history));

    console.log(
      `📝 Event logged: ${event.type} at ${new Date(
        event.timestamp
      ).toLocaleTimeString()}`
    );
  } catch (err) {
    console.error("Error logging posture event:", err);
  }
}

// �📊 H. Data Collection - Track time in each posture state
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

    // recordatorios de pausa (sin cambios)
    const elapsedSeconds = seconds;
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
      window.api.sendNotification &&
      localStorage.getItem("settings_notifications") !== "false"
    ) {
      // Pick a random exercise
      const exercise =
        breakExercises[Math.floor(Math.random() * breakExercises.length)];
      // Send the new notification
      window.api.sendNotification(
        `¡Hora de un Descanso! (Ejercicio)`,
        `Sugerencia: ${exercise.name} - ${exercise.desc}`
      );
      lastBreakNotificationTime = elapsedSeconds;
    }
  }, 1000);
}

startCamera();

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
function stopCamera() {
  // Log session end event before stopping camera
  logPostureEvent("Session End");

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    stream = null;
  }
  running = false;
  paused = true;
  stopTimer(); // Stop the session timer when camera is stopped
  if (dataInterval) {
    clearInterval(dataInterval);
    dataInterval = null;
  }
  // Reset break countdown display
  if (breakTime) {
    breakTime.textContent = "--:--";
  }
  statusText.textContent = "Cámara pausada ⏸️";
  setToggleUIPaused();
}

if (toggleBtn) {
  setToggleUIRunning(); // arranca en "Pausar"
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

(function initAlertsCount() {
  const stored = parseInt(localStorage.getItem("alertsCount") || "0", 10);
  alertsCount.textContent = String(stored);
})();

// ⏱️ Temporizador de sesión
function startTimer() {
  seconds = 0;
  stopTimer();
  timerInterval = setInterval(() => {
    seconds++;
    // Only update UI if element exists
    if (sessionTime) {
      sessionTime.textContent = formatTime(seconds);
    }
    // Update break countdown
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

  const breakIntervalSeconds =
    parseInt(localStorage.getItem("settings_breakInterval") || "20", 10) * 60;

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

// ===== DEPRECATED: Admin Gate Modal removed =====
// Authentication is now handled by SQLite3 database with bcrypt encryption.
// Session validation is enforced via auth-guard.js on protected pages.
// See admin-welcome.html for the new admin dashboard with user management.

// ===== Reset de sesión al iniciar la app (cada ejecución empieza en cero)
/*
(function resetSession() {
  try {
    localStorage.setItem("correctSeconds", "0");
    localStorage.setItem("incorrectSeconds", "0");
    localStorage.setItem("alertsCount", "0");
    localStorage.setItem("postureHistory", "[]");
    localStorage.setItem("alertsHistory", "[]"); // si usas historial de alertas
  } catch (e) {
    console.warn("No se pudo resetear la sesión:", e);
  }
})();
*/

// ===== Modal de Estadísticas (en vivo, calculado desde eventos de la sesión) =====
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

  // Inicio de sesión (una sola vez por ejecución)
  if (!window.__AB_SESSION_T0) window.__AB_SESSION_T0 = Date.now();

  let refreshTimer = null;
  let currentPage = 1;
  const rowsPerPage = 20;

  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function hhmmss(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem("postureHistory")) || [];
    } catch {
      return [];
    }
  }

  // Reconstruye tiempos de la SESIÓN a partir de eventos (desde __AB_SESSION_T0)
  // Ahora acepta parámetros de filtrado de fecha opcionales
  function computeSessionDurations(startDate = null, endDate = null) {
    const t0 = window.__AB_SESSION_T0;
    let t1 = Date.now();

    // Si se proporciona endDate, usarlo como límite superior
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999); // Fin del día
      t1 = Math.min(t1, endDateTime.getTime());
    }

    // postureHistory está guardado NEWEST FIRST ⇒ lo invertimos
    let hist = loadHistory().slice().reverse();

    // Aplicar filtro de fecha de inicio si se proporciona
    if (startDate) {
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0); // Inicio del día
      hist = hist.filter((ev) => ev.timestamp >= startDateTime.getTime());
    }

    // Aplicar filtro de fecha de fin si se proporciona
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999); // Fin del día
      hist = hist.filter((ev) => ev.timestamp <= endDateTime.getTime());
    }

    // Estado al inicio de la sesión: si hay eventos previos a t0, tomamos el último;
    // si no, asumimos "Correcta" por defecto.
    let currentState = "Correcta";
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].timestamp < t0) {
        currentState = hist[i].type;
        break;
      }
    }

    let lastTime = t0;
    let correct = 0,
      incorrect = 0;

    for (const ev of hist) {
      if (ev.timestamp < t0) continue;
      if (ev.timestamp > t1) break;
      const dt = (ev.timestamp - lastTime) / 1000;
      if (currentState === "Correcta") correct += dt;
      else incorrect += dt;
      currentState = ev.type;
      lastTime = ev.timestamp;
    }

    // Tramo final hasta ahora
    const dtLast = (t1 - lastTime) / 1000;
    if (currentState === "Correcta") correct += dtLast;
    else incorrect += dtLast;

    // Filas de la tabla (solo sesión)
    const todays = hist.filter(
      (ev) => ev.timestamp >= t0 && ev.timestamp <= t1
    );
    const rows = todays.map((ev, i) => {
      const next = i < todays.length - 1 ? todays[i + 1].timestamp : t1;
      return {
        time: new Date(ev.timestamp).toLocaleTimeString(),
        type: ev.type,
        duration: hhmmss(Math.max(0, Math.floor((next - ev.timestamp) / 1000))),
        timestamp: ev.timestamp, // Include timestamp for chart processing
      };
    });

    return {
      correct: Math.max(0, Math.floor(correct)),
      incorrect: Math.max(0, Math.floor(incorrect)),
      rows,
    };
  }

  // 📊 Process history data for Chart.js visualization
  function processHistoryForChart(rows) {
    // Group events by day and calculate total minutes for each posture type
    const dailyData = {};

    rows.forEach((row) => {
      // Extract date from timestamp
      const date = new Date(row.timestamp).toLocaleDateString("es-ES", {
        month: "short",
        day: "numeric",
      });

      if (!dailyData[date]) {
        dailyData[date] = { correcta: 0, incorrecta: 0 };
      }

      // Parse duration (format: HH:MM:SS)
      const [hours, minutes, seconds] = row.duration.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + seconds / 60;

      if (row.type === "Correcta") {
        dailyData[date].correcta += totalMinutes;
      } else {
        dailyData[date].incorrecta += totalMinutes;
      }
    });

    // Convert to Chart.js format
    const labels = Object.keys(dailyData);
    const correctData = labels.map((label) =>
      Math.round(dailyData[label].correcta)
    );
    const incorrectData = labels.map((label) =>
      Math.round(dailyData[label].incorrecta)
    );

    return {
      labels,
      datasets: [
        {
          label: "Postura Correcta",
          data: correctData,
          backgroundColor: "rgba(46, 160, 67, 0.8)",
          borderColor: "rgba(46, 160, 67, 1)",
          borderWidth: 1,
        },
        {
          label: "Postura Incorrecta",
          data: incorrectData,
          backgroundColor: "rgba(225, 29, 72, 0.8)",
          borderColor: "rgba(225, 29, 72, 1)",
          borderWidth: 1,
        },
      ],
    };
  }

  // 📈 Calculate percentage change for trend analysis
  function calculatePercentageChange(current, previous) {
    if (previous === 0) {
      if (current === 0) return "0.0%";
      return "+100.0%";
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  }

  function render(startDate = null, endDate = null) {
    const { correct, incorrect, rows } = computeSessionDurations(
      startDate,
      endDate
    );
    const alerts = parseInt(localStorage.getItem("alertsCount") || "0", 10);

    kpiCorrect.textContent = hhmmss(correct);
    kpiIncorrect.textContent = hhmmss(incorrect);
    kpiAlerts.textContent = String(alerts);

    // � Trend Analysis - Calculate comparison with previous period
    const trendContainer = document.getElementById("trend-analysis-container");
    if (startDate && endDate && trendContainer) {
      // Parse dates
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999); // End of day

      // Calculate duration in milliseconds
      const duration = e.getTime() - s.getTime();

      // Calculate previous period dates
      const prevEndDate = new Date(s.getTime() - 24 * 60 * 60 * 1000); // One day before start
      const prevStartDate = new Date(prevEndDate.getTime() - duration);

      // Format dates for computeSessionDurations (YYYY-MM-DD)
      const prevStartStr = prevStartDate.toISOString().split("T")[0];
      const prevEndStr = prevEndDate.toISOString().split("T")[0];

      // Get previous period stats
      const previousStats = computeSessionDurations(prevStartStr, prevEndStr);

      // Calculate percentage changes
      const correctTrend = calculatePercentageChange(
        correct,
        previousStats.correct
      );
      const incorrectTrend = calculatePercentageChange(
        incorrect,
        previousStats.incorrect
      );

      // Determine if trends are positive or negative for styling
      const correctClass = correctTrend.startsWith("+")
        ? "trend-positive"
        : correctTrend.startsWith("-")
        ? "trend-negative"
        : "";
      const incorrectClass = incorrectTrend.startsWith("-")
        ? "trend-positive"
        : incorrectTrend.startsWith("+")
        ? "trend-negative"
        : "";

      // Display trend analysis
      trendContainer.innerHTML = `
        <strong>📊 Comparación con período anterior:</strong><br>
        Postura Correcta: <span class="${correctClass}">${correctTrend}</span> | 
        Postura Incorrecta: <span class="${incorrectClass}">${incorrectTrend}</span>
      `;
      trendContainer.style.display = "block";
    } else if (trendContainer) {
      trendContainer.style.display = "none";
    }

    // �📊 Update Chart
    const chartData = processHistoryForChart(rows);

    const ctx = document.getElementById("postureChart");
    if (ctx && typeof Chart !== "undefined") {
      // If chart exists, just update its data (no animation)
      if (myPostureChart) {
        myPostureChart.data.labels = chartData.labels;
        myPostureChart.data.datasets = chartData.datasets;
        myPostureChart.update("none"); // 'none' disables animation
      } else {
        // Create chart only once
        myPostureChart = new Chart(ctx.getContext("2d"), {
          type: "bar",
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
              duration: 750, // Only animate on initial creation
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

    tbody.innerHTML = "";

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="2" style="text-align: center; color: #888;">No hay eventos en el rango seleccionado</td>';
      tbody.appendChild(tr);
      // Hide pagination when no data
      if (prevPageBtn) prevPageBtn.style.display = "none";
      if (nextPageBtn) nextPageBtn.style.display = "none";
      if (pageInfo) pageInfo.style.display = "none";
    } else {
      // más recientes arriba:
      const reversedRows = rows.slice().reverse();
      const totalPages = Math.ceil(reversedRows.length / rowsPerPage);

      // Ensure currentPage is within bounds
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const startIdx = (currentPage - 1) * rowsPerPage;
      const endIdx = startIdx + rowsPerPage;
      const pageRows = reversedRows.slice(startIdx, endIdx);

      pageRows.forEach((r) => {
        const tr = document.createElement("tr");

        // Check if this is a session event or posture event
        if (r.type === "Session Start" || r.type === "Session End") {
          // Session events span both columns
          tr.innerHTML = `<td colspan="2" class="event-session">🔔 ${r.type} - ${r.time}</td>`;
        } else {
          // Regular posture events
          tr.innerHTML = `<td>${r.time}</td><td>${r.type}</td>`;
        }

        tbody.appendChild(tr);
      });

      // Update pagination controls
      if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages} (${reversedRows.length} eventos)`;
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
  }

  function open() {
    modal.setAttribute("aria-hidden", "false");
    currentPage = 1; // Reset to first page when opening modal
    // Hide trend analysis when modal opens (no filter applied yet)
    const trendContainer = document.getElementById("trend-analysis-container");
    if (trendContainer) {
      trendContainer.style.display = "none";
    }
    render(null, null); // Render with no filters initially
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

  // Filter button event listener
  if (filterButton) {
    filterButton.addEventListener("click", () => {
      currentPage = 1; // Reset to first page when applying filters
      const startDate = startDateInput.value || null;
      const endDate = endDateInput.value || null;
      render(startDate, endDate);
    });
  }

  // Reset button event listener
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      startDateInput.value = "";
      endDateInput.value = "";
      currentPage = 1; // Reset to first page
      // Hide trend analysis when resetting
      const trendContainer = document.getElementById(
        "trend-analysis-container"
      );
      if (trendContainer) {
        trendContainer.style.display = "none";
      }
      render(null, null);
    });
  }

  // Pagination button event listeners
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

  btnExport.addEventListener("click", () => {
    const hist = loadHistory().filter(
      (ev) => ev.timestamp >= window.__AB_SESSION_T0
    );
    const rows = [["timestamp", "hora_local", "evento"]];
    hist.forEach((ev) =>
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
  });
})();

// 🧠 Mensaje de bienvenida animado
window.addEventListener("DOMContentLoaded", () => {
  statusText.textContent = "Bienvenido a ActiveBreak ✨";

  // Test IPC bridge
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

// Logout function for user dashboard
function logout() {
  try {
    // Log session end before logout
    logPostureEvent("Session End");

    localStorage.removeItem("ab_current_client");
    // Use replace() to prevent back button issues
    window.location.replace("landing.html");
  } catch (e) {
    console.error("Error during logout:", e);
    window.location.replace("landing.html");
  }
}

// Log session end when window/tab is closed
window.addEventListener("beforeunload", () => {
  logPostureEvent("Session End");
});
