// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// 🔒 Secure IPC Bridge - Expose API to renderer process
contextBridge.exposeInMainWorld("api", {
  // Send notification request to main process
  sendNotification: (message) => {
    ipcRenderer.send("notify:posture", message);
    console.log("📤 Sending notification via IPC:", message);
  },
});

window.addEventListener("DOMContentLoaded", () => {
  console.log("Frontend cargado correctamente");
  console.log("IPC Bridge initialized ✅");
});
