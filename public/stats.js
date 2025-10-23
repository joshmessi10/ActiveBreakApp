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
});
