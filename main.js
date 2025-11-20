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

function getDayKey(timestampMs) {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // p.ej. 2025-11-19
}

function getWeekKey(timestampMs) {
  // ISO week YYYY-Www
  const d = new Date(timestampMs);
  d.setHours(0, 0, 0, 0);

  // pasar al jueves de la semana actual
  const day = d.getDay(); // 0 = domingo, 1 = lunes...
  const diff = (day === 0 ? -6 : 1) - day; // mover a lunes
  d.setDate(d.getDate() + diff + 3); // jueves

  const weekYear = d.getFullYear();
  const jan4 = new Date(weekYear, 0, 4);
  const dayDiff = (d - jan4) / 86400000;
  const week = 1 + Math.floor(dayDiff / 7);

  return `${weekYear}-W${String(week).padStart(2, "0")}`; // p.ej. 2025-W47
}

function getMonthKey(timestampMs) {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`; // p.ej. 2025-11
}

function getDefaultPeriodKey(periodType) {
  const now = Date.now();
  if (periodType === "weekly") return getWeekKey(now);
  if (periodType === "monthly") return getMonthKey(now);
  // fallback: daily
  return getDayKey(now);
}

function calculateLevelFromXp(totalXp) {
  const xp = Math.max(0, totalXp || 0);
  const base = 100; // XP base por "salto" de nivel

  // Curva suave: el coste por nivel crece (no lineal)
  // Ejemplos aprox:
  // 0 XP   -> lvl 1
  // 100 XP -> lvl 2
  // 400 XP -> lvl 3
  // 900 XP -> lvl 4, etc.
  const level = Math.floor(Math.sqrt(xp / base)) + 1;

  return Math.max(1, level);
}

// 🧮 Actualizar XP total y nivel de un usuario
function updateUserProgressXp(db, userId, xpGain) {
  return new Promise((resolve, reject) => {
    const gain = Math.max(0, xpGain || 0);
    const now = Date.now();

    db.get(
      `SELECT total_xp, level FROM user_progress WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          console.error("❌ Error fetching user_progress:", err);
          return reject(err);
        }

        const currentXp = row ? row.total_xp || 0 : 0;
        const newTotalXp = currentXp + gain;
        const newLevel = calculateLevelFromXp(newTotalXp);

        if (!row) {
          // Crear fila si no existía (usuarios antiguos)
          db.run(
            `INSERT INTO user_progress (user_id, total_xp, level, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, newTotalXp, newLevel, now, now],
            (insertErr) => {
              if (insertErr) {
                console.error(
                  "❌ Error inserting user_progress:",
                  insertErr
                );
                return reject(insertErr);
              }
              resolve({ totalXp: newTotalXp, level: newLevel });
            }
          );
        } else {
          // Actualizar fila existente
          db.run(
            `UPDATE user_progress
             SET total_xp = ?, level = ?, updated_at = ?
             WHERE user_id = ?`,
            [newTotalXp, newLevel, now, userId],
            (updateErr) => {
              if (updateErr) {
                console.error(
                  "❌ Error updating user_progress:",
                  updateErr
                );
                return reject(updateErr);
              }
              resolve({ totalXp: newTotalXp, level: newLevel });
            }
          );
        }
      }
    );
  });
}

function updateGameScoreAggregates(db, userId, score, endedAt) {
  return new Promise((resolve, reject) => {
    const dayKey = getDayKey(endedAt);
    const weekKey = getWeekKey(endedAt);
    const monthKey = getMonthKey(endedAt);

    const updates = [
      { periodType: "daily", periodKey: dayKey },
      { periodType: "weekly", periodKey: weekKey },
      { periodType: "monthly", periodKey: monthKey },
    ];

    let pending = updates.length;
    let hadError = false;

    updates.forEach(({ periodType, periodKey }) => {
      db.run(
        `
        INSERT INTO game_scores (user_id, period_type, period_key, total_score, breaks_count, last_break_at)
        VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT(user_id, period_type, period_key)
        DO UPDATE SET 
          total_score = total_score + excluded.total_score,
          breaks_count = breaks_count + 1,
          last_break_at = excluded.last_break_at
      `,
        [userId, periodType, periodKey, score, endedAt],
        (err) => {
          if (err) {
            console.error("❌ Error updating game_scores:", err);
            hadError = true;
          }

          pending -= 1;
          if (pending === 0) {
            if (hadError) {
              reject(new Error("Error updating some game_scores entries"));
            } else {
              resolve();
            }
          }
        }
      );
    });
  });
}

function calculateBreakGameScore(payload) {
  const { completed, qualityFactor, responseTimeSeconds } = payload;

  if (!completed) {
    return 0;
  }

  const basePoints = 50;

  const q = Math.max(0, Math.min(1, typeof qualityFactor === "number" ? qualityFactor : 0));
  const qualityPoints = Math.round(50 * q);

  let engagementPoints = 0;
  if (typeof responseTimeSeconds === "number") {
    if (responseTimeSeconds <= 5) engagementPoints = 20;
    else if (responseTimeSeconds <= 15) engagementPoints = 10;
  }

  // De momento dejamos el streak bonus en 0
  // Luego podemos implementar streak real con game_scores / game_break_sessions
  const streakBonus = 0;

  return basePoints + qualityPoints + engagementPoints + streakBonus;
}


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
                      // Tabla de sesiones de pausas activas (histórico de "mini-juegos")
                      db.run(
                        `
                        CREATE TABLE IF NOT EXISTS game_break_sessions (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          user_id INTEGER NOT NULL,
                          started_at INTEGER NOT NULL,
                          ended_at INTEGER NOT NULL,
                          score INTEGER NOT NULL,
                          completed_exercises_count INTEGER NOT NULL,
                          trigger_reason TEXT,
                          quality_factor REAL,
                          response_time_s REAL,
                          created_at INTEGER NOT NULL,
                          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                      `,
                        (err) => {
                          if (err) {
                            console.error("❌ game_break_sessions table creation error:", err);
                          } else {
                            console.log("✅ game_break_sessions table ready");
                          }
                        }
                      );

                      // Tabla de agregados de puntaje por periodo (para rankings)
                      db.run(
                        `
                        CREATE TABLE IF NOT EXISTS game_scores (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          user_id INTEGER NOT NULL,
                          period_type TEXT NOT NULL,      -- 'daily' | 'weekly' | 'monthly'
                          period_key TEXT NOT NULL,       -- '2025-11-19' | '2025-W47' | '2025-11'
                          total_score INTEGER NOT NULL DEFAULT 0,
                          breaks_count INTEGER NOT NULL DEFAULT 0,
                          last_break_at INTEGER,
                          UNIQUE (user_id, period_type, period_key),
                          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                      `,
                        (err) => {
                          if (err) {
                            console.error("❌ game_scores table creation error:", err);
                          } else {
                            console.log("✅ game_scores table ready");
                          }
                        }
                      );

                      // Opcional: tabla de recompensas (para premios)
                      db.run(
                        `
                        CREATE TABLE IF NOT EXISTS game_rewards (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          user_id INTEGER NOT NULL,
                          period_type TEXT NOT NULL,
                          period_key TEXT NOT NULL,
                          reward_type TEXT NOT NULL,      -- 'TOP1' | 'TOP3' | 'PARTICIPATION' | ...
                          metadata TEXT,
                          created_at INTEGER NOT NULL,
                          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                      `,
                        (err) => {
                          if (err) {
                            console.error("❌ game_rewards table creation error:", err);
                          } else {
                            console.log("✅ game_rewards table ready");
                          }
                        }
                      );
                      db.run(
                        `
                        CREATE TABLE IF NOT EXISTS user_progress (
                          user_id INTEGER PRIMARY KEY,
                          total_xp INTEGER NOT NULL DEFAULT 0,
                          level INTEGER NOT NULL DEFAULT 1,
                          created_at INTEGER NOT NULL,
                          updated_at INTEGER NOT NULL,
                          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                      `,
                        (err) => {
                          if (err) {
                            console.error("❌ user_progress table creation error:", err);
                          } else {
                            console.log("✅ user_progress table ready");
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

              const nowTs = Date.now();
              db.run(
                `INSERT INTO user_progress (user_id, total_xp, level, created_at, updated_at)
                VALUES (?, 0, 1, ?, ?)`,
                [newUserId, nowTs, nowTs],
                (err) => {
                  if (err) {
                    console.error("❌ Error creating user_progress row:", err);
                  } else {
                    console.log("✅ user_progress initialized for user:", newUserId);
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

ipcMain.handle("game:breakCompleted", async (event, userId, payload) => {
  try {
    console.log("🎮 game:breakCompleted for user:", userId, payload);

    const now = Date.now();
    const startedAt = payload.startedAt || now;
    const endedAt = payload.endedAt || now;

    const cleanPayload = {
      completed: !!payload.completed,
      qualityFactor:
        typeof payload.qualityFactor === "number" ? payload.qualityFactor : 0,
      responseTimeSeconds:
        typeof payload.responseTimeSeconds === "number"
          ? payload.responseTimeSeconds
          : null,
      completedExercisesCount:
        typeof payload.completedExercisesCount === "number"
          ? payload.completedExercisesCount
          : 1,
      triggerReason: payload.triggerReason || null,
      startedAt,
      endedAt,
    };

    // 🧮 XP ganado en esta pausa (antes lo llamábamos "score")
    const xpGain = calculateBreakGameScore(cleanPayload);

    return new Promise((resolve) => {
      db.run(
        `
        INSERT INTO game_break_sessions 
          (user_id, started_at, ended_at, score, completed_exercises_count, trigger_reason, quality_factor, response_time_s, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          userId,
          cleanPayload.startedAt,
          cleanPayload.endedAt,
          xpGain, // 👈 almacenamos XP de esta pausa
          cleanPayload.completedExercisesCount,
          cleanPayload.triggerReason,
          cleanPayload.qualityFactor,
          cleanPayload.responseTimeSeconds,
          now,
        ],
        async (err) => {
          if (err) {
            console.error("❌ Error inserting game_break_session:", err);
            resolve({
              success: false,
              message: "Error al guardar sesión de juego.",
            });
            return;
          }

          try {
            // XP del período (día/semana/mes) – sigue usando game_scores.total_score
            await updateGameScoreAggregates(
              db,
              userId,
              xpGain,
              cleanPayload.endedAt
            );
          } catch (aggErr) {
            console.error("❌ Error updating score aggregates:", aggErr);
          }

          let progress = null;
          try {
            // 🎯 Actualizar XP total y nivel global del usuario
            progress = await updateUserProgressXp(db, userId, xpGain);
          } catch (progressErr) {
            console.error(
              "❌ Error updating user progress XP:",
              progressErr
            );
          }

          resolve({
            success: true,
            // XP ganada en esta pausa
            xpGain,
            // mantenemos scoreBreak por compatibilidad, pero es XP
            scoreBreak: xpGain,
            // progreso global (puede ser null si hubo error)
            totalXp: progress ? progress.totalXp : null,
            level: progress ? progress.level : null,
          });
        }
      );
    });
  } catch (e) {
    console.error("❌ Exception in game:breakCompleted:", e);
    return {
      success: false,
      message: "Error inesperado al guardar XP de juego.",
    };
  }
});


ipcMain.handle("game:getLeaderboard", async (event, args) => {
  try {
    const periodType =
      (args && args.periodType) && ["daily", "weekly", "monthly"].includes(args.periodType)
        ? args.periodType
        : "daily";

    const periodKey =
      (args && args.periodKey) && typeof args.periodKey === "string"
        ? args.periodKey
        : getDefaultPeriodKey(periodType);

    const limit =
      args && typeof args.limit === "number" && args.limit > 0
        ? Math.min(args.limit, 50)
        : 10;

    console.log("🏆 game:getLeaderboard", { periodType, periodKey, limit });

    return new Promise((resolve) => {
      db.all(
        `
        SELECT 
          u.id as user_id,
          u.full_name,
          u.org_name,
          gs.total_score,        -- XP del período
          gs.breaks_count,
          gs.last_break_at,
          p.total_xp,            -- XP total global
          p.level                -- nivel global
        FROM game_scores gs
        JOIN users u ON u.id = gs.user_id
        LEFT JOIN user_progress p ON p.user_id = u.id
        WHERE gs.period_type = ? AND gs.period_key = ?
        ORDER BY gs.total_score DESC, gs.last_break_at ASC
        LIMIT ?
      `,
        [periodType, periodKey, limit],
        (err, rows) => {
          if (err) {
            console.error("❌ Error fetching leaderboard:", err);
            resolve({
              success: false,
              message: "Error al obtener leaderboard.",
              entries: [],
            });
            return;
          }

          resolve({
            success: true,
            periodType,
            periodKey,
            entries: rows || [],
          });
        }
      );
    });
  } catch (e) {
    console.error("❌ Exception in game:getLeaderboard:", e);
    return {
      success: false,
      message: "Error inesperado al obtener leaderboard.",
      entries: [],
    };
  }
});

ipcMain.handle("user:getProgress", async (event, userId) => {
  try {
    return new Promise((resolve) => {
      db.get(
        `SELECT total_xp, level FROM user_progress WHERE user_id = ?`,
        [userId],
        async (err, row) => {
          if (err) {
            console.error("❌ Error fetching user_progress:", err);
            resolve({
              success: false,
              message: "Error al obtener progreso.",
            });
            return;
          }

          if (!row) {
            // Crear registro por defecto si no existe
            try {
              const progress = await updateUserProgressXp(db, userId, 0);
              resolve({
                success: true,
                totalXp: progress.totalXp,
                level: progress.level,
              });
            } catch (createErr) {
              console.error(
                "❌ Error creating default user_progress:",
                createErr
              );
              resolve({
                success: false,
                message:
                  "Error al inicializar progreso de usuario.",
              });
            }
            return;
          }

          resolve({
            success: true,
            totalXp: row.total_xp,
            level: row.level,
          });
        }
      );
    });
  } catch (e) {
    console.error("❌ Exception in user:getProgress:", e);
    return {
      success: false,
      message: "Error inesperado al obtener progreso.",
    };
  }
});


app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
