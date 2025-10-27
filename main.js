// main.js
import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, "public", "assets", "One.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "public", "landing.html"));
  // Open dev tools to check for errors
  mainWindow.webContents.openDevTools();
};

// 🔔 IPC Listener - Handle notification requests from renderer
ipcMain.on("notify:posture", (event, message) => {
  console.log("📬 IPC received: notify:posture -", message);

  // Check if notifications are supported
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: "ActiveBreak Alert",
      body: message || "Please check your posture!",
      silent: false, // Enable sound
    });

    notification.show();
    console.log("✅ Notification sent:", message);
  } else {
    console.log("❌ Notifications not supported on this system");
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
