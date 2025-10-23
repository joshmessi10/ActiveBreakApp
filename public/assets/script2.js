// script.js

// 🎯 A. Imports - Access global poseDetection from CDN
const { SupportedModels, createDetector } = window.poseDetection;

// 🎨 DOM Elements
const video = document.getElementById("video");
const canvas = document.getElementById("output");
const statusText = document.getElementById("status");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const postureStatus = document.getElementById("posture-status");
const sessionTime = document.getElementById("session-time");
const alertsCount = document.getElementById("alerts-count");
const postureIcon = document.getElementById('posture-icon');
const postureText = document.getElementById('posture-text');
// Referencia al botón único
const toggleBtn = document.getElementById("toggle-btn");

// Estado de ejecución
let running = false;          // ¿cámara+detección activas?
let paused = false;           // flag lógico para UI
let dataInterval = null;      // handle de startDataCollection()
let rafStarted = false;       // evita lanzar detectPose() múltiples veces

// 🧠 B. Globals - AI and Canvas
let detector = null;
let ctx = null;
let stream = null;
let timerInterval = null;
let seconds = 0;

// 🔔 Alert Threshold Globals
let badPostureStartTime = null;
let notificationSent = false;

// ⏰ Break Timer Globals
let lastBreakNotificationTime = 0;

// 📝 Event Logging Globals
let lastPostureState = "correct"; // Track previous state to detect changes

function setPosture(isGood) {
  if (isGood) {
    postureIcon.textContent = '✔';    // check
    postureIcon.style.color = '#16a34a'; // verde
    postureText.textContent = 'Correcta';
    postureText.classList.remove('muted');
  } else {
    postureIcon.textContent = '✖';    // equis
    postureIcon.style.color = '#dc2626'; // rojo
    postureText.textContent = 'Incorrecta';
    postureText.classList.remove('muted');
  }
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
    if (running) return; // ya está corriendo
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
    video.srcObject = stream;
    statusText.textContent = "Cámara activa ✅";
    running = true;
    paused = false;

    // Si el detector ya existe, no lo recrees: solo (re)inicia loops
    video.onloadedmetadata = async () => {
      if (detector) {
        statusText.textContent = "Modelo cargado ✅ - Detectando postura...";
        ensureLoops();
      } else {
        await initPoseDetection(); // crea detector y arranca loops
      }
      setToggleUIRunning(); // pinta el botón en rojo "Pausar"
    };
  } catch (err) {
    statusText.textContent = "Error al acceder a la cámara ❌";
    console.error(err);
  }
}

function stopCamera() {
  if (!running) return;
  // Detén el stream
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    stream = null;
  }
  running = false;
  paused = true;

  // Detén temporizador y recolección
  stopTimer();
  stopDataCollection();

  statusText.textContent = "Cámara pausada ⏸️";
  setToggleUIPaused(); // pinta el botón en verde "Reanudar"
}

function ensureLoops() {
  // Lanzar el bucle de pose si aún no arrancó
  if (!rafStarted) {
    rafStarted = true;
    requestAnimationFrame(detectPose);
  }
  // Iniciar data collection si no existe
  if (!dataInterval) {
    startDataCollection();
  }
  // Iniciar temporizador de sesión
  startTimer();
}

function stopDataCollection() {
  if (dataInterval) {
    clearInterval(dataInterval);
    dataInterval = null;
  }
}

// 🤖 C. Init Function - Load MediaPipe Pose model
async function initPoseDetection() {
  try {
    statusText.textContent = "Cargando modelo de IA... ⏳";

    ctx = canvas.getContext("2d");
    canvas.width = 640;
    canvas.height = 360;

    if (!detector) {
      detector = await createDetector(SupportedModels.MoveNet, {
        modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      });
    }

    statusText.textContent = "Modelo cargado ✅ - Detectando postura...";
    ensureLoops();
  } catch (err) {
    statusText.textContent = "Error al cargar el modelo ❌";
    console.error("Error initializing pose detection:", err);
  }
}

// 🔄 E. Detection Loop - Continuous pose estimation
async function detectPose() {
  // Si está en pausa, no infiere, pero mantiene el RAF vivo
  if (!running || paused || !detector) {
    requestAnimationFrame(detectPose);
    return;
  }

  try {
    const poses = await detector.estimatePoses(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (poses && poses.length > 0) {
      const pose = poses[0];
      drawPose(pose);
      classifyPose(pose);
    }
  } catch (err) {
    console.error("Detection error:", err);
  }

  requestAnimationFrame(detectPose);
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

  // 🎖️ RULE 2: STRICT Vertical alignment - head must be TALL and UPRIGHT
  // Military posture: head well above shoulders, no forward lean
  const headShoulderDistance = shoulderMidY - noseY;
  const minHeadHeight = shoulderWidth * 0.5; // 50% of shoulder width (STRICT!)
  const isVerticallyAligned = headShoulderDistance > minHeadHeight;

  // 🎖️ RULE 3: Shoulder symmetry - shoulders must be level (no tilting)
  const shoulderHeightDiff = Math.abs(leftShoulderY - rightShoulderY);
  const maxShoulderTilt = shoulderWidth * 0.1; // Max 10% tilt allowed
  const shouldersAreLevel = shoulderHeightDiff <= maxShoulderTilt;

  // ⚠️ MILITARY STANDARD: ALL conditions must pass (no exceptions!)
  const isCentered =
    isHorizontallyCentered && isVerticallyAligned && shouldersAreLevel;
  const currentState = isCentered ? "correct" : "incorrect";

  // 📝 Log state changes
  if (currentState !== lastPostureState) {
    logPostureEvent(currentState);
    lastPostureState = currentState;
  }

  if (isCentered) {
      // ✅ Good posture - Reset alert state
      statusText.textContent = "✅ Postura Correcta";
      statusText.style.color = "#2ea043";
      setPosture(true); // PATCH ✔

      // Reset bad posture tracking
      if (badPostureStartTime !== null) {
        console.log("✅ Posture corrected - resetting timer");
      }
      badPostureStartTime = null;
      notificationSent = false;

    } else {
      // ⚠️ Bad posture detected - Provide specific feedback
      let feedback = "⚠️ Postura Incorrecta - ";
      if (!isHorizontallyCentered) {
        feedback += "Centra tu cabeza";
      } else if (!isVerticallyAligned) {
        feedback += "Endereza tu espalda, siéntate erguido";
      } else if (!shouldersAreLevel) {
        feedback += "Nivela tus hombros";
      }
      statusText.textContent = feedback;
      statusText.style.color = "#f85149";
      setPosture(false); // PATCH ✖

      // Start tracking bad posture duration
      if (badPostureStartTime === null) {
        badPostureStartTime = Date.now();
        console.log("⚠️ Bad posture detected - starting timer");
      }

    // ⚙️ Load alert threshold setting (default: 3 seconds)
    const alertThreshold = parseInt(
      localStorage.getItem("settings_alertThreshold") || "3",
      10
    );
    const alertThresholdMs = alertThreshold * 1000;

    // Check if bad posture has lasted longer than threshold
    const badPostureDuration = Date.now() - badPostureStartTime;

    if (badPostureDuration > alertThresholdMs && !notificationSent) {
      console.log(
        `🔔 Bad posture for ${Math.round(
          badPostureDuration / 1000
        )}s - triggering notification`
      );

      // ⚙️ Check if notifications are enabled (default: true)
      const notificationsEnabled =
        localStorage.getItem("settings_notifications") !== "false";

      // Send notification via IPC (only if enabled)
      if (notificationsEnabled && window.api && window.api.sendNotification) {
        window.api.sendNotification(
          `¡Corrige tu postura! Has estado en mala posición por más de ${alertThreshold} segundos.`
        );
        notificationSent = true;

        // PATCH: incrementa el contador visual de alertas si el nodo existe
        if (alertsCount) {
          const prev = parseInt(alertsCount.textContent || "0", 10);
          alertsCount.textContent = String(prev + 1);
        }
      } else if (!notificationsEnabled) {
        console.log("🔕 Notifications disabled in settings");
        notificationSent = true; // Prevent repeated checks
      } else {
        console.error("❌ IPC API not available - window.api:", window.api);
      }
    } else if (badPostureDuration <= alertThresholdMs) {
      console.log(
        `⏱️ Bad posture for ${Math.round(
          badPostureDuration / 1000
        )}s (waiting for ${alertThreshold}s threshold)`
      );
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

// � I. Event Logging - Log posture state changes
function logPostureEvent(state) {
  try {
    // 1. Read existing events from localStorage
    const historyJSON = localStorage.getItem("postureHistory");
    let history = historyJSON ? JSON.parse(historyJSON) : [];

    // 2. Create new event object
    const event = {
      timestamp: Date.now(),
      type: state === "correct" ? "Correcta" : "Incorrecta",
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

function startDataCollection() {
  if (dataInterval) return; // ya existe
  console.log("📊 Data collection started - tracking posture time");

  dataInterval = setInterval(() => {
    const isPostureBad = badPostureStartTime !== null;

    if (isPostureBad) {
      let incorrectSeconds = parseInt(localStorage.getItem("incorrectSeconds") || "0", 10);
      localStorage.setItem("incorrectSeconds", String(++incorrectSeconds));
    } else if (detector && running && !paused) {
      let correctSeconds = parseInt(localStorage.getItem("correctSeconds") || "0", 10);
      localStorage.setItem("correctSeconds", String(++correctSeconds));
    }

    // Recordatorio de pausa activa
    const elapsedSeconds = seconds;
    const breakIntervalMinutes = parseInt(localStorage.getItem("settings_breakInterval") || "30", 10);
    const breakIntervalSeconds = breakIntervalMinutes * 60;

    if (
      running && !paused &&
      elapsedSeconds > 0 &&
      elapsedSeconds % breakIntervalSeconds === 0 &&
      elapsedSeconds !== lastBreakNotificationTime &&
      window.api && window.api.sendNotification &&
      (localStorage.getItem("settings_notifications") !== "false")
    ) {
      window.api.sendNotification("¡Hora de descansar! Tómate un breve descanso y estírate.");
      lastBreakNotificationTime = elapsedSeconds;
    }
  }, 1000);
}

startCamera();

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
  }, 1000);
  console.log("⏱️ Session timer started");
}

function stopTimer() {
  clearInterval(timerInterval);
}

// 🎮 Eventos de botones (only if elements exist)
if (startBtn) startBtn.addEventListener("click", startCamera);
if (pauseBtn)
  pauseBtn.addEventListener("click", () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      statusText.textContent = "Cámara pausada ⏸️";
    }
  });

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

// Inicializa el botón (si existe)
if (toggleBtn) {
  // Arranca en estado "grabando" (porque la cámara inicia por defecto)
  setToggleUIRunning();

  toggleBtn.addEventListener("click", () => {
    if (running && !paused) {
      // pasar a pausado
      stopCamera();
    } else {
      // reanudar
      startCamera();
    }
  });
}