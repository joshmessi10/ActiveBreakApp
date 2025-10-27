// script.js

// 🎯 A. Imports - Access global poseDetection from CDN
const { SupportedModels, createDetector } = window.poseDetection;

// 🎨 DOM Elements
const video = document.getElementById("video");
const canvas = document.getElementById("output");
const toggleBtn = document.getElementById("toggle-btn");
const postureStatus = document.getElementById("posture-status");
const sessionTime = document.getElementById("session-time");
const alertsCount = document.getElementById("alerts-count");
const postureCard = document.getElementById("posture-card");
const postureDetail = document.getElementById("posture-detail");
const alertsCard = document.getElementById("alerts-card");

// 🧠 B. Globals - AI and Canvas
let detector = null;
let ctx = null;
let stream = null;
let timerInterval = null;
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

function setPosture(isGood) {
  if (isGood) {
    postureCard.classList.add("correct");
    postureCard.classList.remove("incorrect");
  } else {
    postureCard.classList.add("incorrect");
    postureCard.classList.remove("correct");
  }
}

function registerAlert() {
  const current = parseInt(alertsCount.textContent || "0", 10) + 1;
  alertsCount.textContent = String(current);
  localStorage.setItem("alertsCount", String(current));

  // opcional: historial de timestamps si lo usas en otro sitio
  try {
    const key = "alertsHistory";
    const arr = JSON.parse(localStorage.getItem(key)) || [];
    arr.unshift(Date.now());
    if (arr.length > 1000) arr.length = 1000;
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}

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
    statusText.textContent = "✅ Buena Postura";
    statusText.style.color = "#2ea043";
    setPosture(true); // PATCH ✔

    // Reset bad posture tracking
    if (badPostureStartTime !== null) {
    }
    badPostureStartTime = null;
    notificationSent = false;
  } else {
    setPosture(false);

    let feedback = "⚠️ ";
    if (!isHorizontallyCentered) feedback += "Centra tu cabeza";
    else if (!isVerticallyAligned) feedback += "Endereza tu espalda";
    else if (!shouldersAreLevel) feedback += "Nivela tus hombros";

    statusText.textContent = feedback;
    statusText.style.color = "#e11d48";

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

// �📊 H. Data Collection - Track time in each posture state
function startDataCollection() {
  if (dataInterval) return;
  dataInterval = setInterval(() => {
    const isPostureBad = badPostureStartTime !== null;

    if (detector && running && !paused) {
      if (isPostureBad) {
        let incorrectSeconds = parseInt(
          localStorage.getItem("incorrectSeconds") || "0",
          10
        );
        localStorage.setItem("incorrectSeconds", String(++incorrectSeconds));
      } else {
        let correctSeconds = parseInt(
          localStorage.getItem("correctSeconds") || "0",
          10
        );
        localStorage.setItem("correctSeconds", String(++correctSeconds));
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
      window.api.sendNotification(
        "¡Hora de descansar! Tómate un breve descanso y estírate."
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
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    stream = null;
  }
  paused = true;
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
  }, 1000);
  console.log("⏱️ Session timer started");
}

function stopTimer() {
  clearInterval(timerInterval);
}

(function adminGate() {
  const settingsLink = document.getElementById("nav-settings");
  const modal = document.getElementById("admin-gate");
  if (!settingsLink || !modal) return;

  const form = document.getElementById("adminGateForm");
  const emailEl = document.getElementById("gateEmail");
  const passEl = document.getElementById("gatePass");
  const msgEl = document.getElementById("gateMsg");

  const LS_ACCOUNTS_KEY = "ab_org_accounts";

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  function loadAccounts() {
    try {
      return JSON.parse(localStorage.getItem(LS_ACCOUNTS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function open() {
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => emailEl?.focus(), 50);
  }
  function close() {
    modal.setAttribute("aria-hidden", "true");
    form.reset();
    msgEl.textContent = "";
  }

  // abrir modal en vez de navegar
  settingsLink.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });

  // cerrar si clic en backdrop o botón ✕
  modal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) close();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "Verificando…";

    const email = emailEl.value.trim().toLowerCase();
    const pass = passEl.value;

    const accs = loadAccounts();
    const acc = accs.find((a) => a.email.toLowerCase() === email);
    if (!acc) {
      msgEl.textContent = "No existe una cuenta con ese correo.";
      return;
    }

    const hash = await sha256(pass);
    if (hash !== acc.passHash) {
      msgEl.textContent = "Contraseña incorrecta.";
      return;
    }

    // OK → navega a Ajustes
    msgEl.textContent = "Acceso concedido. Abriendo Ajustes…";
    setTimeout(() => {
      window.location.href = "settings.html";
    }, 250);
  });
})();

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

  // Inicio de sesión (una sola vez por ejecución)
  if (!window.__AB_SESSION_T0) window.__AB_SESSION_T0 = Date.now();

  let refreshTimer = null;

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
  function computeSessionDurations() {
    const t0 = window.__AB_SESSION_T0;
    const t1 = Date.now();

    // postureHistory está guardado NEWEST FIRST ⇒ lo invertimos
    const hist = loadHistory().slice().reverse();

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
      };
    });

    return {
      correct: Math.max(0, Math.floor(correct)),
      incorrect: Math.max(0, Math.floor(incorrect)),
      rows,
    };
  }

  function render() {
    const { correct, incorrect, rows } = computeSessionDurations();
    const alerts = parseInt(localStorage.getItem("alertsCount") || "0", 10);

    kpiCorrect.textContent = hhmmss(correct);
    kpiIncorrect.textContent = hhmmss(incorrect);
    kpiAlerts.textContent = String(alerts);

    tbody.innerHTML = "";
    // más recientes arriba:
    rows
      .slice()
      .reverse()
      .forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.time}</td><td>${r.type}</td>`;
        tbody.appendChild(tr);
      });
  }

  function open() {
    modal.setAttribute("aria-hidden", "false");
    render();
    refreshTimer = setInterval(render, 1000);
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
