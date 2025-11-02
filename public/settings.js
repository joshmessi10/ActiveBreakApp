// settings.js - Manage application settings with database

// 🎨 Get all input elements
const sensitivitySlider = document.getElementById("sensitivity");
const sensitivityValue = document.getElementById("sensitivityValue");
const notificationsCheckbox = document.getElementById("notifications");
const alertThresholdInput = document.getElementById("alertThreshold");
const breakIntervalInput = document.getElementById("breakInterval");
const saveSettingsButton = document.getElementById("saveSettings");

// 📥 Load settings from database
async function loadSettings() {
  console.log("⚙️ Loading settings from database...");

  try {
    // Get current user from localStorage
    const userJson = localStorage.getItem("ab_current_user");
    if (!userJson) {
      console.error("❌ No user session found");
      alert("Error: No se encontró la sesión del usuario.");
      return;
    }

    const user = JSON.parse(userJson);
    const userId = user.id;

    // Fetch settings from database
    const result = await window.api.getSettings(userId);

    if (!result.success) {
      console.error("❌ Error loading settings:", result.message);
      alert("Error al cargar configuración: " + result.message);
      return;
    }

    const settings = result.settings;

    // Populate form with settings
    sensitivitySlider.value = settings.sensitivity;
    sensitivityValue.textContent = settings.sensitivity;
    notificationsCheckbox.checked = settings.notificationsEnabled === 1;
    alertThresholdInput.value = settings.alertThreshold;
    breakIntervalInput.value = settings.breakInterval;

    console.log("✅ Settings loaded:", settings);
  } catch (error) {
    console.error("❌ Exception loading settings:", error);
    alert("Error al cargar configuración.");
  }
}

// 💾 Save settings to database
async function saveSettings() {
  console.log("💾 Saving settings to database...");

  try {
    // Get current user from localStorage
    const userJson = localStorage.getItem("ab_current_user");
    if (!userJson) {
      console.error("❌ No user session found");
      alert("Error: No se encontró la sesión del usuario.");
      return;
    }

    const user = JSON.parse(userJson);
    const userId = user.id;

    // Prepare settings data
    const settingsData = {
      sensitivity: parseInt(sensitivitySlider.value, 10),
      notificationsEnabled: notificationsCheckbox.checked ? 1 : 0,
      alertThreshold: parseInt(alertThresholdInput.value, 10),
      breakInterval: parseInt(breakIntervalInput.value, 10),
    };

    console.log("💾 Saving settings:", settingsData);

    // Save settings to database
    const result = await window.api.saveSettings(userId, settingsData);

    if (!result.success) {
      console.error("❌ Error saving settings:", result.message);
      alert("Error al guardar configuración: " + result.message);
      return;
    }

    console.log("✅ Settings saved successfully");
    alert("✅ Configuración guardada correctamente!");
  } catch (error) {
    console.error("❌ Exception saving settings:", error);
    alert("Error al guardar configuración.");
  }
}

// 🎚️ Update sensitivity value display when slider changes
sensitivitySlider.oninput = () => {
  sensitivityValue.textContent = sensitivitySlider.value;
};

// 💾 Save settings when button is clicked
saveSettingsButton.addEventListener("click", saveSettings);

// 📥 Load settings on page load
window.addEventListener("DOMContentLoaded", loadSettings);

// Logout function - only for admin (settings is admin-only now)
function logout() {
  try {
    localStorage.removeItem("ab_current_user");
    // Use replace() to prevent back button issues
    window.location.replace("landing.html");
  } catch (e) {
    console.error("Error during logout:", e);
    window.location.replace("landing.html");
  }
}
