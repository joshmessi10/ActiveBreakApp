// /public/script.js
const video = document.getElementById('video');
const statusText = document.getElementById('status');

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

document.getElementById('start-btn').addEventListener('click', startCamera);
