// stats.js - Display posture statistics from localStorage

// 🕒 Format time in mm:ss (copied from script.js for consistency)
function formatTime(s) {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// 📊 Load and display statistics
window.addEventListener("DOMContentLoaded", () => {
  console.log("📊 Loading statistics from localStorage...");

  // Get DOM elements
  const correctTimeElement = document.getElementById("correctTime");
  const incorrectTimeElement = document.getElementById("incorrectTime");

  // Read data from localStorage
  const correctSeconds = parseInt(
    localStorage.getItem("correctSeconds") || "0",
    10
  );
  const incorrectSeconds = parseInt(
    localStorage.getItem("incorrectSeconds") || "0",
    10
  );

  // Format and display the time
  const correctTimeFormatted = formatTime(correctSeconds);
  const incorrectTimeFormatted = formatTime(incorrectSeconds);

  correctTimeElement.textContent = correctTimeFormatted;
  incorrectTimeElement.textContent = incorrectTimeFormatted;

  console.log(`✅ Correct posture time: ${correctTimeFormatted}`);
  console.log(`⚠️ Incorrect posture time: ${incorrectTimeFormatted}`);

  // Calculate and log totals
  const totalSeconds = correctSeconds + incorrectSeconds;
  const totalTimeFormatted = formatTime(totalSeconds);
  console.log(`📈 Total tracking time: ${totalTimeFormatted}`);

  // Calculate percentage if there's data
  if (totalSeconds > 0) {
    const correctPercentage = ((correctSeconds / totalSeconds) * 100).toFixed(
      1
    );
    const incorrectPercentage = (
      (incorrectSeconds / totalSeconds) *
      100
    ).toFixed(1);
    console.log(
      `📊 Correct: ${correctPercentage}% | Incorrect: ${incorrectPercentage}%`
    );
  }

  // 📝 Load and display posture event history
  loadPostureHistory();
});

// 📝 Load posture event history into table
function loadPostureHistory() {
  console.log("📝 Loading posture event history...");

  // 1. Get the history table tbody element
  const historyTable = document.getElementById("historyTable");

  if (!historyTable) {
    console.warn("History table element not found");
    return;
  }

  // 2. Read posture history from localStorage
  const historyJSON = localStorage.getItem("postureHistory");
  const history = historyJSON ? JSON.parse(historyJSON) : [];

  // 3. Clear the table
  historyTable.innerHTML = "";

  // 4. Check if there's any history
  if (history.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="3" style="text-align: center; color: #888;">
        No hay eventos registrados aún. Comienza a usar la aplicación para ver tu historial.
      </td>
    `;
    historyTable.appendChild(emptyRow);
    console.log("📝 No history events found");
    return;
  }

  // 5. Loop through events (already sorted, newest first) and create rows
  history.forEach((event) => {
    const date = new Date(event.timestamp);

    // Format date (YYYY-MM-DD)
    const dateStr = date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    // Format time (HH:MM:SS)
    const timeStr = date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Create table row
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${dateStr}</td>
      <td>${timeStr}</td>
      <td style="color: ${event.type === "Correcta" ? "#2ea043" : "#f85149"}">
        ${event.type}
      </td>
    `;

    historyTable.appendChild(row);
  });

  console.log(`📝 Loaded ${history.length} history events`);
}
