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
            return;
          }
          console.log("✅ Users table ready");

          // Create user_settings table
          db.run(
            `
            CREATE TABLE IF NOT EXISTS user_settings (
              user_id INTEGER UNIQUE NOT NULL,
              sensitivity INTEGER DEFAULT 5,
              notificationsEnabled INTEGER DEFAULT 1,
              alertThreshold INTEGER DEFAULT 3,
              breakInterval INTEGER DEFAULT 30,
              characterTheme TEXT DEFAULT 'female',
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
          `,
            (err) => {
              if (err) {
                console.error("❌ user_settings table creation error:", err);
                reject(err);
                return;
              }
              console.log("✅ user_settings table ready");
              db.run(
                `ALTER TABLE user_settings ADD COLUMN characterTheme TEXT DEFAULT 'female'`,
                (alterErr) => {
                  if (alterErr && !String(alterErr).includes("duplicate column")) {
                    console.error("⚠️ Error adding characterTheme column:", alterErr);
                  }
                }
              );

              // Create user_stats table
              db.run(
                `
                CREATE TABLE IF NOT EXISTS user_stats (
                  user_id INTEGER UNIQUE NOT NULL,
                  correctSeconds INTEGER DEFAULT 0,
                  incorrectSeconds INTEGER DEFAULT 0,
                  alertsCount INTEGER DEFAULT 0,
                  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
              `,
                (err) => {
                  if (err) {
                    console.error("❌ user_stats table creation error:", err);
                    reject(err);
                    return;
                  }
                  console.log("✅ user_stats table ready");

                  // Create posture_events table
                  db.run(
                    `
                    CREATE TABLE IF NOT EXISTS posture_events (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id INTEGER NOT NULL,
                      timestamp INTEGER NOT NULL,
                      type TEXT NOT NULL CHECK(type IN ('Correcta', 'Incorrecta', 'Session Start', 'Session End')),
                      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                  `,
                    (err) => {
                      if (err) {
                        console.error(
                          "❌ posture_events table creation error:",
                          err
                        );
                        reject(err);
                        return;
                      }
                      console.log("✅ posture_events table ready");

                      // Create alert_events table
                      db.run(
                        `
                        CREATE TABLE IF NOT EXISTS alert_events (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          user_id INTEGER NOT NULL,
                          timestamp INTEGER NOT NULL,
                          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                      `,
                        (err) => {
                          if (err) {
                            console.error(
                              "❌ alert_events table creation error:",
                              err
                            );
                            reject(err);
                          } else {
                            console.log("✅ alert_events table ready");
                            resolve();
                          }
                        }
                      );
                    }
                  );
                }
              );
            }
          );
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
              const newUserId = this.lastID;
              console.log(
                "✅ User registered successfully:",
                email,
                "ID:",
                newUserId
              );

              // Create default settings for new user
              db.run(
                `INSERT INTO user_settings (user_id, sensitivity, notificationsEnabled, alertThreshold, breakInterval)
                 VALUES (?, 5, 1, 3, 30, 'female')`,
                [newUserId],
                (err) => {
                  if (err) {
                    console.error("❌ Error creating default settings:", err);
                  } else {
                    console.log(
                      "✅ Default settings created for user:",
                      newUserId
                    );
                  }
                }
              );

              // Create default stats for new user
              db.run(
                `INSERT INTO user_stats (user_id, correctSeconds, incorrectSeconds, alertsCount)
                 VALUES (?, 0, 0, 0)`,
                [newUserId],
                (err) => {
                  if (err) {
                    console.error("❌ Error creating default stats:", err);
                  } else {
                    console.log(
                      "✅ Default stats created for user:",
                      newUserId
                    );
                  }
                }
              );

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

// IPC Handler: Get all users (Admin only)
ipcMain.handle("admin:get-all-users", async (event) => {
  try {
    console.log("📋 Fetching all users for admin dashboard");

    return new Promise((resolve, reject) => {
      db.all(
        "SELECT id, email, role, full_name, org_name, created_at FROM users ORDER BY created_at DESC",
        [],
        (err, users) => {
          if (err) {
            console.error("❌ Error fetching users:", err);
            resolve({ success: false, message: "Error al obtener usuarios." });
            return;
          }

          console.log(`✅ Retrieved ${users.length} users`);
          resolve({ success: true, users });
        }
      );
    });
  } catch (error) {
    console.error("❌ Exception fetching users:", error);
    return { success: false, message: "Error al obtener usuarios." };
  }
});

// IPC Handler: Delete user by ID (Admin only)
ipcMain.handle("admin:delete-user", async (event, userId) => {
  try {
    console.log("🗑️ Deleting user with ID:", userId);

    return new Promise((resolve, reject) => {
      db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
        if (err) {
          console.error("❌ Error deleting user:", err);
          resolve({ success: false, message: "Error al eliminar usuario." });
          return;
        }

        if (this.changes === 0) {
          console.log("⚠️ No user found with ID:", userId);
          resolve({ success: false, message: "Usuario no encontrado." });
          return;
        }

        console.log(`✅ User deleted successfully (ID: ${userId})`);
        resolve({ success: true, message: "Usuario eliminado exitosamente." });
      });
    });
  } catch (error) {
    console.error("❌ Exception deleting user:", error);
    return { success: false, message: "Error al eliminar usuario." };
  }
});

// IPC Handler: Get user settings
ipcMain.handle("settings:get", async (event, userId) => {
  try {
    return new Promise((resolve) => {
      db.get(
        `SELECT * FROM user_settings WHERE user_id = ?`,
        [userId],
        (err, row) => {
          if (err) {
            console.error("❌ Error fetching settings:", err);
            resolve({
              success: false,
              message: "Error al obtener configuración.",
              settings: null,
            });
            return;
          }

          // Si no existe configuración para este usuario, la creamos con valores por defecto
          if (!row) {
            console.log(
              "ℹ️ No settings found for user, creating defaults for user_id:",
              userId
            );

            db.run(
              `INSERT INTO user_settings 
                 (user_id, sensitivity, notificationsEnabled, alertThreshold, breakInterval, characterTheme)
               VALUES (?, 5, 1, 3, 30, 'female')`,
              [userId],
              (insertErr) => {
                if (insertErr) {
                  console.error(
                    "❌ Error creating default settings for user:",
                    insertErr
                  );
                  resolve({
                    success: false,
                    message:
                      "Error al crear configuración por defecto para el usuario.",
                    settings: null,
                  });
                  return;
                }

                // Volvemos a leer para devolverle al frontend la fila recién creada
                db.get(
                  `SELECT * FROM user_settings WHERE user_id = ?`,
                  [userId],
                  (err2, newRow) => {
                    if (err2 || !newRow) {
                      console.error(
                        "❌ Error fetching newly created settings:",
                        err2
                      );
                      resolve({
                        success: false,
                        message:
                          "Error al obtener configuración recién creada.",
                        settings: null,
                      });
                      return;
                    }

                    resolve({
                      success: true,
                      settings: newRow,
                    });
                  }
                );
              }
            );

            return;
          }

          // Caso normal: configuración encontrada
          resolve({
            success: true,
            settings: row,
          });
        }
      );
    });
  } catch (e) {
    console.error("❌ Exception in settings:get:", e);
    return {
      success: false,
      message: "Error inesperado al obtener configuración.",
      settings: null,
    };
  }
});


// IPC Handler: Save user settings
ipcMain.handle("settings:save", async (event, userId, settingsData) => {
  try {
    console.log("💾 Saving settings for user:", userId, settingsData);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE user_settings 
         SET sensitivity = ?, notificationsEnabled = ?, alertThreshold = ?, breakInterval = ?, characterTheme = ?
         WHERE user_id = ?`,
        [
          settingsData.sensitivity,
          settingsData.notificationsEnabled,
          settingsData.alertThreshold,
          settingsData.breakInterval,
          settingsData.characterTheme,
          userId,
        ],
        function (err) {
          if (err) {
            console.error("❌ Error saving settings:", err);
            resolve({
              success: false,
              message: "Error al guardar configuración.",
            });
            return;
          }

          if (this.changes === 0) {
            console.log("⚠️ No settings record found for user:", userId);
            resolve({
              success: false,
              message: "Registro de configuración no encontrado.",
            });
            return;
          }

          console.log("✅ Settings saved for user:", userId);
          resolve({
            success: true,
            message: "Configuración guardada exitosamente.",
          });
        }
      );
    });
  } catch (error) {
    console.error("❌ Exception saving settings:", error);
    return { success: false, message: "Error al guardar configuración." };
  }
});

// IPC Handler: Get total stats for user
ipcMain.handle("stats:get-total", async (event, userId) => {
  try {
    console.log("📊 Fetching total stats for user:", userId);

    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM user_stats WHERE user_id = ?",
        [userId],
        (err, stats) => {
          if (err) {
            console.error("❌ Error fetching stats:", err);
            resolve({
              success: false,
              message: "Error al obtener estadísticas.",
            });
            return;
          }

          if (!stats) {
            console.log("⚠️ No stats found for user:", userId);
            resolve({
              success: false,
              message: "Estadísticas no encontradas.",
            });
            return;
          }

          console.log("✅ Stats retrieved for user:", userId);
          resolve({ success: true, stats });
        }
      );
    });
  } catch (error) {
    console.error("❌ Exception fetching stats:", error);
    return { success: false, message: "Error al obtener estadísticas." };
  }
});

// IPC Handler: Log session stats (batch update)
ipcMain.handle(
  "stats:log-session",
  async (event, userId, correct, incorrect, alerts) => {
    try {
      console.log("📝 Logging session stats for user:", userId, {
        correct,
        incorrect,
        alerts,
      });

      return new Promise((resolve, reject) => {
        db.run(
          `UPDATE user_stats 
         SET correctSeconds = correctSeconds + ?, 
             incorrectSeconds = incorrectSeconds + ?,
             alertsCount = alertsCount + ?
         WHERE user_id = ?`,
          [correct, incorrect, alerts, userId],
          function (err) {
            if (err) {
              console.error("❌ Error logging session stats:", err);
              resolve({
                success: false,
                message: "Error al guardar estadísticas de sesión.",
              });
              return;
            }

            console.log("✅ Session stats logged for user:", userId);
            resolve({
              success: true,
              message: "Estadísticas guardadas exitosamente.",
            });
          }
        );
      });
    } catch (error) {
      console.error("❌ Exception logging session stats:", error);
      return { success: false, message: "Error al guardar estadísticas." };
    }
  }
);

// IPC Handler: Log posture event
ipcMain.handle("event:log-posture", async (event, userId, eventData) => {
  try {
    console.log("📝 Logging posture event for user:", userId, eventData);

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO posture_events (user_id, timestamp, type)
         VALUES (?, ?, ?)`,
        [userId, eventData.timestamp, eventData.type],
        function (err) {
          if (err) {
            console.error("❌ Error logging posture event:", err);
            resolve({
              success: false,
              message: "Error al guardar evento de postura.",
            });
            return;
          }

          console.log("✅ Posture event logged for user:", userId);
          resolve({ success: true, eventId: this.lastID });
        }
      );
    });
  } catch (error) {
    console.error("❌ Exception logging posture event:", error);
    return { success: false, message: "Error al guardar evento." };
  }
});

// IPC Handler: Log alert event
ipcMain.handle("event:log-alert", async (event, userId, timestamp) => {
  try {
    console.log("🚨 Logging alert event for user:", userId, timestamp);

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO alert_events (user_id, timestamp)
         VALUES (?, ?)`,
        [userId, timestamp],
        function (err) {
          if (err) {
            console.error("❌ Error logging alert event:", err);
            resolve({ success: false, message: "Error al guardar alerta." });
            return;
          }

          console.log("✅ Alert event logged for user:", userId);
          resolve({ success: true, alertId: this.lastID });
        }
      );
    });
  } catch (error) {
    console.error("❌ Exception logging alert event:", error);
    return { success: false, message: "Error al guardar alerta." };
  }
});

// IPC Handler: Get modal data with SQL calculations
ipcMain.handle(
  "stats:get-modal-data",
  async (event, userId, startDate, endDate) => {
    try {
      console.log("📊 Fetching modal data for user:", userId, {
        startDate,
        endDate,
      });

      return new Promise((resolve, reject) => {
        // Parse dates
        let startMs = null;
        let endMs = null;

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          startMs = start.getTime();
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          endMs = end.getTime();
        }

        // Build WHERE clause for date filtering
        let dateFilter = "";
        let params = [userId];

        if (startMs && endMs) {
          dateFilter = " AND timestamp >= ? AND timestamp <= ?";
          params.push(startMs, endMs);
        } else if (startMs) {
          dateFilter = " AND timestamp >= ?";
          params.push(startMs);
        } else if (endMs) {
          dateFilter = " AND timestamp <= ?";
          params.push(endMs);
        }

        // Get posture events
        db.all(
          `SELECT * FROM posture_events 
         WHERE user_id = ?${dateFilter}
         ORDER BY timestamp ASC`,
          params,
          (err, events) => {
            if (err) {
              console.error("❌ Error fetching posture events:", err);
              resolve({ success: false, message: "Error al obtener eventos." });
              return;
            }

            // Calculate KPIs from events
            let correctSeconds = 0;
            let incorrectSeconds = 0;
            let currentState = "Correcta";
            let lastTime =
              startMs || (events.length > 0 ? events[0].timestamp : Date.now());
            const now = endMs || Date.now();

            for (const event of events) {
              const duration = (event.timestamp - lastTime) / 1000;
              if (currentState === "Correcta") {
                correctSeconds += duration;
              } else if (currentState === "Incorrecta") {
                incorrectSeconds += duration;
              }
              currentState = event.type;
              lastTime = event.timestamp;
            }

            // Final segment
            const finalDuration = (now - lastTime) / 1000;
            if (currentState === "Correcta") {
              correctSeconds += finalDuration;
            } else if (currentState === "Incorrecta") {
              incorrectSeconds += finalDuration;
            }

            correctSeconds = Math.max(0, Math.floor(correctSeconds));
            incorrectSeconds = Math.max(0, Math.floor(incorrectSeconds));

            // Get alert count
            db.get(
              `SELECT COUNT(*) as count FROM alert_events 
             WHERE user_id = ?${dateFilter}`,
              params,
              (err, alertResult) => {
                if (err) {
                  console.error("❌ Error counting alerts:", err);
                  resolve({
                    success: false,
                    message: "Error al contar alertas.",
                  });
                  return;
                }

                const totalAlerts = alertResult.count;

                // Prepare event list for table (newest first)
                const eventList = events
                  .map((e) => ({
                    timestamp: e.timestamp,
                    type: e.type,
                    time: new Date(e.timestamp).toLocaleTimeString(),
                  }))
                  .reverse();

                // Process chart data (group by day)
                const dailyData = {};
                for (const event of events) {
                  const date = new Date(event.timestamp)
                    .toISOString()
                    .split("T")[0];
                  if (!dailyData[date]) {
                    dailyData[date] = { correct: 0, incorrect: 0 };
                  }
                }

                // Calculate durations for each day
                currentState = "Correcta";
                lastTime =
                  startMs ||
                  (events.length > 0 ? events[0].timestamp : Date.now());

                for (const event of events) {
                  const duration = (event.timestamp - lastTime) / 1000;
                  const lastDate = new Date(lastTime)
                    .toISOString()
                    .split("T")[0];

                  if (!dailyData[lastDate]) {
                    dailyData[lastDate] = { correct: 0, incorrect: 0 };
                  }

                  if (currentState === "Correcta") {
                    dailyData[lastDate].correct += duration / 60; // Convert to minutes
                  } else if (currentState === "Incorrecta") {
                    dailyData[lastDate].incorrect += duration / 60; // Convert to minutes
                  }

                  currentState = event.type;
                  lastTime = event.timestamp;
                }

                // Final segment for chart
                const finalDate = new Date(lastTime)
                  .toISOString()
                  .split("T")[0];
                if (!dailyData[finalDate]) {
                  dailyData[finalDate] = { correct: 0, incorrect: 0 };
                }
                const finalDur = (now - lastTime) / 1000;
                if (currentState === "Correcta") {
                  dailyData[finalDate].correct += finalDur / 60; // Convert to minutes
                } else if (currentState === "Incorrecta") {
                  dailyData[finalDate].incorrect += finalDur / 60; // Convert to minutes
                }

                // Convert to Chart.js format
                const labels = Object.keys(dailyData).sort();
                const correctData = labels.map((date) =>
                  Math.round(dailyData[date].correct)
                );
                const incorrectData = labels.map((date) =>
                  Math.round(dailyData[date].incorrect)
                );

                const chartData = {
                  labels,
                  datasets: [
                    {
                      label: "Postura Correcta",
                      data: correctData,
                      backgroundColor: "rgba(46, 160, 67, 0.8)",
                      borderColor: "rgba(46, 160, 67, 1)",
                      borderWidth: 1,
                    },
                    {
                      label: "Postura Incorrecta",
                      data: incorrectData,
                      backgroundColor: "rgba(225, 29, 72, 0.8)",
                      borderColor: "rgba(225, 29, 72, 1)",
                      borderWidth: 1,
                    },
                  ],
                };

                // Calculate trend data (if date range is specified)
                let trendData = null;
                if (startDate && endDate) {
                  const start = new Date(startDate);
                  const end = new Date(endDate);
                  const duration = end.getTime() - start.getTime();

                  const prevEndDate = new Date(
                    start.getTime() - 24 * 60 * 60 * 1000
                  );
                  const prevStartDate = new Date(
                    prevEndDate.getTime() - duration
                  );

                  const prevStartMs = prevStartDate.getTime();
                  const prevEndMs = prevEndDate.getTime();

                  // Get previous period events
                  db.all(
                    `SELECT * FROM posture_events 
                   WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
                   ORDER BY timestamp ASC`,
                    [userId, prevStartMs, prevEndMs],
                    (err, prevEvents) => {
                      if (err) {
                        console.error(
                          "❌ Error fetching previous period events:",
                          err
                        );
                      } else {
                        // Calculate previous period KPIs
                        let prevCorrect = 0;
                        let prevIncorrect = 0;
                        let prevState = "Correcta";
                        let prevLastTime = prevStartMs;

                        for (const event of prevEvents) {
                          const dur = (event.timestamp - prevLastTime) / 1000;
                          if (prevState === "Correcta") {
                            prevCorrect += dur;
                          } else if (prevState === "Incorrecta") {
                            prevIncorrect += dur;
                          }
                          prevState = event.type;
                          prevLastTime = event.timestamp;
                        }

                        const prevFinalDur = (prevEndMs - prevLastTime) / 1000;
                        if (prevState === "Correcta") {
                          prevCorrect += prevFinalDur;
                        } else if (prevState === "Incorrecta") {
                          prevIncorrect += prevFinalDur;
                        }

                        prevCorrect = Math.max(0, Math.floor(prevCorrect));
                        prevIncorrect = Math.max(0, Math.floor(prevIncorrect));

                        // Calculate percentage changes
                        const calculatePercentageChange = (
                          current,
                          previous
                        ) => {
                          if (previous === 0) {
                            if (current === 0) return "0.0%";
                            return "+100.0%";
                          }
                          const change =
                            ((current - previous) / previous) * 100;
                          const sign = change > 0 ? "+" : "";
                          return `${sign}${change.toFixed(1)}%`;
                        };

                        trendData = {
                          correctTrend: calculatePercentageChange(
                            correctSeconds,
                            prevCorrect
                          ),
                          incorrectTrend: calculatePercentageChange(
                            incorrectSeconds,
                            prevIncorrect
                          ),
                          correctChange: correctSeconds - prevCorrect,
                          incorrectChange: incorrectSeconds - prevIncorrect,
                        };

                        // Send response with trend data
                        console.log(
                          "✅ Modal data retrieved for user:",
                          userId
                        );
                        resolve({
                          success: true,
                          data: {
                            kpis: {
                              correct: correctSeconds,
                              incorrect: incorrectSeconds,
                            },
                            totalAlerts,
                            eventList,
                            chartData,
                            trendData,
                          },
                        });
                      }
                    }
                  );

                  return; // Wait for trend calculation
                }

                // Send response without trend data
                console.log("✅ Modal data retrieved for user:", userId);
                resolve({
                  success: true,
                  data: {
                    kpis: {
                      correct: correctSeconds,
                      incorrect: incorrectSeconds,
                    },
                    totalAlerts,
                    eventList,
                    chartData,
                    trendData: null,
                  },
                });
              }
            );
          }
        );
      });
    } catch (error) {
      console.error("❌ Exception fetching modal data:", error);
      return { success: false, message: "Error al obtener datos del modal." };
    }
  }
);

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
ipcMain.on("notify:posture", (event, title, body) => {
  console.log("📬 IPC received: notify:posture -", title, body);

  // Check if notifications are supported
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title || "ActiveBreak Alert",
      body: body || "¡Revisa tu postura!",
      silent: false, // Enable sound
    });

    notification.show();
    console.log("✅ Notification sent:", title, body);
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
