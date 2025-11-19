document.addEventListener("DOMContentLoaded", () => {
  const periodTypeSelect = document.getElementById("periodTypeSelect");
  const periodKeyInput = document.getElementById("periodKeyInput");
  const reloadBtn = document.getElementById("reloadLeaderboardBtn");
  const tbody = document.getElementById("leaderboardBody");
  const errorBox = document.getElementById("leaderboardError");
  const subtitle = document.getElementById("leaderboardSubtitle");

  function periodTypeLabel(periodType) {
    if (periodType === "weekly") return "Esta semana";
    if (periodType === "monthly") return "Este mes";
    return "Hoy";
  }

  async function loadLeaderboard() {
    if (!window.api || !window.api.getLeaderboard) {
      console.error("window.api.getLeaderboard no está disponible");
      return;
    }

    const periodType = periodTypeSelect.value;
    let periodKey = periodKeyInput.value.trim();

    errorBox.style.display = "none";
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;">Cargando...</td>
      </tr>
    `;

    // Dejamos que el backend decida el periodo actual si no se especifica clave
    const args = {
      periodType,
      limit: 10,
    };

    if (periodKey) {
      args.periodKey = periodKey;
    }

    try {
      const result = await window.api.getLeaderboard(args);

      if (!result || !result.success) {
        errorBox.style.display = "block";
        subtitle.textContent = "No se pudo cargar el leaderboard.";
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center;">Sin datos</td>
          </tr>
        `;
        return;
      }

      const usedPeriodType = result.periodType || periodType;
      const usedPeriodKey = result.periodKey || periodKey || "";

      subtitle.textContent = `Período: ${periodTypeLabel(
        usedPeriodType
      )} (${usedPeriodKey || "actual"})`;

      // reflejar en el input la clave real usada por el backend
      if (usedPeriodKey) {
        periodKeyInput.value = usedPeriodKey;
      }

      const entries = result.entries || [];
      if (!entries.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center;">Todavía no hay puntajes en este período.</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = "";
      entries.forEach((entry, index) => {
        const tr = document.createElement("tr");

        const orgName = entry.org_name || "-";
        const userName =
          entry.full_name && entry.full_name.trim().length
            ? entry.full_name
            : `Usuario #${entry.user_id}`;

        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${userName}</td>
          <td>${orgName}</td>
          <td>${entry.total_score}</td>
          <td>${entry.breaks_count}</td>
        `;

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("Error cargando leaderboard:", err);
      errorBox.style.display = "block";
      subtitle.textContent = "Error inesperado al cargar el leaderboard.";
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;">Error al cargar datos.</td>
        </tr>
      `;
    }
  }

  reloadBtn.addEventListener("click", () => {
    loadLeaderboard();
  });

  periodTypeSelect.addEventListener("change", () => {
    // al cambiar de tipo, limpiamos la clave para que el backend use el período actual
    periodKeyInput.value = "";
    loadLeaderboard();
  });

  // Carga inicial
  loadLeaderboard();
});
