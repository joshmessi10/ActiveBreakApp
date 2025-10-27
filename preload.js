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
});
