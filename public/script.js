// script.js

const video = document.getElementById('video');
const statusText = document.getElementById('status');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const postureStatus = document.getElementById('posture-status');
const sessionTime = document.getElementById('session-time');
const alertsCount = document.getElementById('alerts-count');

let stream = null;
let timerInterval = null;
let seconds = 0;
let running = false;

// 🕒 Formatea tiempo tipo mm:ss
function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    statusText.textContent = "Cámara activa ✅";
  } catch (err) {
    statusText.textContent = "Error al acceder a la cámara ❌";
    console.error(err);
  }
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

// 🎮 Eventos de botones
startBtn.addEventListener('click', startCamera);
pauseBtn.addEventListener('click', pauseCamera);

// 🧠 Mensaje de bienvenida animado
window.addEventListener('DOMContentLoaded', () => {
  statusText.textContent = "Bienvenido a ActiveBreak ✨";
});
