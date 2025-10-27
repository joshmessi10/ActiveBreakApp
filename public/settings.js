// settings.js - Manage application settings with localStorage

// 🎨 Get all input elements
const sensitivitySlider = document.getElementById("sensitivity");
const sensitivityValue = document.getElementById("sensitivityValue");
const notificationsCheckbox = document.getElementById("notifications");
const alertThresholdInput = document.getElementById("alertThreshold");
const breakIntervalInput = document.getElementById("breakInterval");
const saveSettingsButton = document.getElementById("saveSettings");

// 📥 Load settings from localStorage
function loadSettings() {
  console.log("⚙️ Loading settings from localStorage...");

  // Load sensitivity (1-10, default: 5)
  const sensitivity = localStorage.getItem("settings_sensitivity") || "5";
  sensitivitySlider.value = sensitivity;
  sensitivityValue.textContent = sensitivity;

  // Load notifications enabled (default: true)
  const notificationsEnabled =
    localStorage.getItem("settings_notifications") !== "false";
  notificationsCheckbox.checked = notificationsEnabled;

  // Load alert threshold in seconds (default: 3)
  const alertThreshold = localStorage.getItem("settings_alertThreshold") || "3";
  alertThresholdInput.value = alertThreshold;

  // Load break interval in minutes (default: 30)
  const breakInterval = localStorage.getItem("settings_breakInterval") || "30";
  breakIntervalInput.value = breakInterval;

  console.log("✅ Settings loaded:", {
    sensitivity,
    notificationsEnabled,
    alertThreshold: `${alertThreshold}s`,
    breakInterval: `${breakInterval}min`,
  });
}

// 💾 Save settings to localStorage
function saveSettings() {
  console.log("💾 Saving settings to localStorage...");

  // Save all settings
  localStorage.setItem("settings_sensitivity", sensitivitySlider.value);
  localStorage.setItem("settings_notifications", notificationsCheckbox.checked);
  localStorage.setItem("settings_alertThreshold", alertThresholdInput.value);
  localStorage.setItem("settings_breakInterval", breakIntervalInput.value);

  console.log("✅ Settings saved:", {
    sensitivity: sensitivitySlider.value,
    notificationsEnabled: notificationsCheckbox.checked,
    alertThreshold: `${alertThresholdInput.value}s`,
    breakInterval: `${breakIntervalInput.value}min`,
  });

  // Show success feedback
  alert("✅ Configuración guardada correctamente!");
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
