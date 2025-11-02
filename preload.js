// preload.js (CommonJS - Required for Electron preload scripts)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  sendNotification: (title, body) =>
    ipcRenderer.send("notify:posture", title, body),
  authRegister: (email, password, role, additionalData) =>
    ipcRenderer.invoke("auth:register", email, password, role, additionalData),
  authLogin: (email, password) =>
    ipcRenderer.invoke("auth:login", email, password),
  adminGetAllUsers: () => ipcRenderer.invoke("admin:get-all-users"),
  adminDeleteUser: (userId) => ipcRenderer.invoke("admin:delete-user", userId),

  // Settings APIs
  getSettings: (userId) => ipcRenderer.invoke("settings:get", userId),
  saveSettings: (userId, settingsData) =>
    ipcRenderer.invoke("settings:save", userId, settingsData),

  // Stats APIs
  getTotalStats: (userId) => ipcRenderer.invoke("stats:get-total", userId),
  logSessionStats: (userId, correct, incorrect, alerts) =>
    ipcRenderer.invoke("stats:log-session", userId, correct, incorrect, alerts),

  // Event logging APIs
  logPostureEvent: (userId, eventData) =>
    ipcRenderer.invoke("event:log-posture", userId, eventData),
  logAlertEvent: (userId, timestamp) =>
    ipcRenderer.invoke("event:log-alert", userId, timestamp),

  // Modal data API
  getModalData: (userId, startDate, endDate) =>
    ipcRenderer.invoke("stats:get-modal-data", userId, startDate, endDate),
});
