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

// 🧠 B. Globals - AI and Canvas
let detector = null;
let ctx = null;
let stream = null;
let timerInterval = null;
let seconds = 0;
let running = false;

// 🔔 Alert Threshold Globals
let badPostureStartTime = null;
let notificationSent = false;

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
    statusText.textContent = "Cargando modelo de IA... ⏳";

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
    detectPose();

    // 5. Start data collection interval (every 1 second)
    startDataCollection();
  } catch (err) {
    statusText.textContent = "Error al cargar el modelo ❌";
    console.error("Error initializing pose detection:", err);
  }
}

// 🔄 E. Detection Loop - Continuous pose estimation
async function detectPose() {
  if (!detector) return;

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

// 📊 F. Classification - Simple posture rule
function classifyPose(pose) {
  if (!pose.keypoints) return;

  // Get key body points
  const nose = pose.keypoints.find((kp) => kp.name === "nose");
  const leftShoulder = pose.keypoints.find((kp) => kp.name === "left_shoulder");
  const rightShoulder = pose.keypoints.find(
    (kp) => kp.name === "right_shoulder"
  );

  // Check if all keypoints are detected with sufficient confidence
  if (!nose || !leftShoulder || !rightShoulder) return;
  if (nose.score < 0.3 || leftShoulder.score < 0.3 || rightShoulder.score < 0.3)
    return;

  // Simple rule: nose should be horizontally between shoulders for good posture
  const noseX = nose.x;
  const leftShoulderX = leftShoulder.x;
  const rightShoulderX = rightShoulder.x;

  const minX = Math.min(leftShoulderX, rightShoulderX);
  const maxX = Math.max(leftShoulderX, rightShoulderX);

  // Check if nose is centered between shoulders
  const isCentered = noseX >= minX && noseX <= maxX;

  if (isCentered) {
    // ✅ Good posture - Reset alert state
    statusText.textContent = "✅ Postura Correcta";
    statusText.style.color = "#2ea043";

    // Reset bad posture tracking
    if (badPostureStartTime !== null) {
      console.log("✅ Posture corrected - resetting timer");
    }
    badPostureStartTime = null;
    notificationSent = false;
  } else {
    // ⚠️ Bad posture detected
    statusText.textContent = "⚠️ Postura Incorrecta - Centra tu cabeza";
    statusText.style.color = "#f85149";

    // Start tracking bad posture duration
    if (badPostureStartTime === null) {
      badPostureStartTime = Date.now();
      console.log("⚠️ Bad posture detected - starting timer");
    }

    // Check if bad posture has lasted 3+ seconds
    const badPostureDuration = Date.now() - badPostureStartTime;

    if (badPostureDuration > 3000 && !notificationSent) {
      console.log(
        `🔔 Bad posture for ${Math.round(
          badPostureDuration / 1000
        )}s - triggering notification`
      );

      // Send notification via IPC
      if (window.api && window.api.sendNotification) {
        console.log("✅ window.api.sendNotification is available");
        window.api.sendNotification(
          "¡Corrige tu postura! Has estado en mala posición por más de 3 segundos."
        );
        notificationSent = true;
        console.log("📨 Notification sent via IPC");
      } else {
        console.error("❌ IPC API not available - window.api:", window.api);
      }
    } else if (badPostureDuration <= 3000) {
      console.log(
        `⏱️ Bad posture for ${Math.round(
          badPostureDuration / 1000
        )}s (waiting for 3s threshold)`
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

// 📊 H. Data Collection - Track time in each posture state
function startDataCollection() {
  console.log("📊 Data collection started - tracking posture time");

  setInterval(() => {
    // Check current posture state
    const isPostureBad = badPostureStartTime !== null;

    if (isPostureBad) {
      // Increment incorrect posture time
      let incorrectSeconds = parseInt(
        localStorage.getItem("incorrectSeconds") || "0",
        10
      );
      incorrectSeconds++;
      localStorage.setItem("incorrectSeconds", incorrectSeconds.toString());
    } else {
      // Increment correct posture time (only if detector is active)
      if (detector) {
        let correctSeconds = parseInt(
          localStorage.getItem("correctSeconds") || "0",
          10
        );
        correctSeconds++;
        localStorage.setItem("correctSeconds", correctSeconds.toString());
      }
    }
  }, 1000); // Run every 1 second
}

startCamera();

// ⏱️ Temporizador de sesión
function startTimer() {
  seconds = 0;
  stopTimer();
  timerInterval = setInterval(() => {
    seconds++;
    sessionTime.textContent = formatTime(seconds);
  }, 1000);
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
