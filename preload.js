// preload.js (ESM)
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  notify: (message) => ipcRenderer.invoke("notify", message),
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (partial) => ipcRenderer.invoke("settings:set", partial),
  },
  stats: {
    add: (entry) => ipcRenderer.invoke("stats:add", entry),
    all: () => ipcRenderer.invoke("stats:all"),
  },
});
