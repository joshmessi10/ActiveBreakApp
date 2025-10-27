// main.js
import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let db;

// Initialize SQLite database
function initDatabase() {
  return new Promise((resolve, reject) => {
    const dataDir = path.join(__dirname, "data");

    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, "users.sqlite");
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("❌ Database connection error:", err);
        reject(err);
        return;
      }
      console.log("✅ Connected to SQLite database");

      // Create users table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'client')),
          full_name TEXT,
          org_name TEXT,
          created_at INTEGER NOT NULL
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Table creation error:", err);
            reject(err);
          } else {
            console.log("✅ Users table ready");
            resolve();
          }
        }
      );
    });
  });
}

// IPC Handler: Register new user
ipcMain.handle(
  "auth:register",
  async (event, email, password, role, additionalData = {}) => {
    try {
      console.log("📝 Registration attempt:", email, role);

      // Hash password with bcrypt
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
        INSERT INTO users (email, password_hash, role, full_name, org_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

        const now = Date.now();
        stmt.run(
          email.toLowerCase(),
          passwordHash,
          role,
          additionalData.fullName || null,
          additionalData.orgName || null,
          now,
          function (err) {
            if (err) {
              if (err.message.includes("UNIQUE constraint failed")) {
                console.log("⚠️ Email already exists:", email);
                resolve({
                  success: false,
                  message: "Ya existe una cuenta con ese correo.",
                });
              } else {
                console.error("❌ Registration error:", err);
                resolve({
                  success: false,
                  message: "Error al crear la cuenta. Intenta de nuevo.",
                });
              }
            } else {
              console.log("✅ User registered successfully:", email);
              resolve({
                success: true,
                message: "Cuenta creada exitosamente.",
              });
            }
          }
        );
        stmt.finalize();
      });
    } catch (error) {
      console.error("❌ Registration exception:", error);
      return { success: false, message: "Error al crear la cuenta." };
    }
  }
);

// IPC Handler: Login user
ipcMain.handle("auth:login", async (event, email, password) => {
  try {
    console.log("🔐 Login attempt:", email);

    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE email = ?",
        [email.toLowerCase()],
        async (err, user) => {
          if (err) {
            console.error("❌ Database error:", err);
            resolve({
              success: false,
              message: "Error al verificar credenciales.",
            });
            return;
          }

          if (!user) {
            console.log("⚠️ User not found:", email);
            resolve({
              success: false,
              message: "No existe una cuenta con ese correo.",
            });
            return;
          }

          // Compare password with bcrypt
          const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
          );

          if (!passwordMatch) {
            console.log("⚠️ Invalid password for:", email);
            resolve({ success: false, message: "Contraseña incorrecta." });
            return;
          }

          console.log("✅ Login successful:", email, "- Role:", user.role);
          resolve({
            success: true,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              fullName: user.full_name,
              orgName: user.org_name,
            },
          });
        }
      );
    });
  } catch (error) {
    console.error("❌ Login exception:", error);
    return { success: false, message: "Error al iniciar sesión." };
  }
});

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

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
