// preload.js (CommonJS - Required for Electron preload scripts)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  sendNotification: (message) => ipcRenderer.send("notify:posture", message),
});
