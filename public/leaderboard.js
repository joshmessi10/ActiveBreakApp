document.addEventListener("DOMContentLoaded", () => {
  const periodTypeSelect = document.getElementById("periodTypeSelect");
  const periodKeyInput = document.getElementById("periodKeyInput");
  const reloadBtn = document.getElementById("reloadLeaderboardBtn");
  const tbody = document.getElementById("leaderboardBody");
  const errorBox = document.getElementById("leaderboardError");
  const subtitle = document.getElementById("leaderboardSubtitle");

  const challengesList = document.getElementById("challengesList");
  const challengesErrorBox = document.getElementById("challengesError");
  const challengesSubtitle = document.getElementById("challengesSubtitle");

  function periodTypeLabel(periodType) {
    if (periodType === "weekly") return "Esta semana";
    if (periodType === "monthly") return "Este mes";
    return "Hoy";
  }

  // ✅ Versión correcta: leemos de las sesiones reales de la app
  function getCurrentUserId() {
    try {
      // 1) Sesión cliente (dashboard de postura)
      const clientSessionData = localStorage.getItem("ab_current_client");
      if (clientSessionData) {
        const clientSession = JSON.parse(clientSessionData);
        if (
          clientSession &&
          typeof clientSession.id === "number"
        ) {
          return clientSession.id;
        }
      }

      // 2) Si no hay cliente, usar sesión admin (modo panel admin)
      const adminSessionData = localStorage.getItem("ab_current_user");
      if (adminSessionData) {
        const adminSession = JSON.parse(adminSessionData);
        if (
          adminSession &&
          typeof adminSession.id === "number"
        ) {
          return adminSession.id;
        }
      }
    } catch (e) {
      console.error("Error leyendo sesión desde localStorage:", e);
    }

    return null;
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
        <td colspan="6" style="text-align:center;">Cargando...</td>
      </tr>
    `;

    // Dejamos que el backend decida el período actual si no se especifica clave
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
            <td colspan="6" style="text-align:center;">Sin datos</td>
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
            <td colspan="6" style="text-align:center;">Todavía no hay XP registrada en este período.</td>
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
        const level = entry.level || 1;
        const periodXp = entry.total_score || 0;

        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${userName}</td>
          <td>${orgName}</td>
          <td>${level}</td>
          <td>${periodXp}</td>
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
          <td colspan="6" style="text-align:center;">Error al cargar datos.</td>
        </tr>
      `;
    }
  }

  async function loadChallenges() {
    if (!window.api || !window.api.getActiveChallenges) {
      console.error("window.api.getActiveChallenges no está disponible");
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      console.warn("No se encontró userId para cargar retos");
      if (challengesList) {
        challengesList.innerHTML =
          '<p class="challenges-empty">No se pudo determinar el usuario actual.</p>';
      }
      return;
    }

    const periodType = periodTypeSelect.value;

    challengesErrorBox.style.display = "none";
    challengesSubtitle.textContent = "";
    challengesList.innerHTML =
      '<p class="challenges-empty">Cargando retos...</p>';

    try {
      const result = await window.api.getActiveChallenges(userId, periodType);

      if (!result || !result.success) {
        challengesErrorBox.style.display = "block";
        challengesErrorBox.textContent =
          result && result.message
            ? result.message
            : "Error al obtener retos activos.";
        challengesList.innerHTML =
          '<p class="challenges-empty">Sin información de retos.</p>';
        return;
      }

      challengesSubtitle.textContent = `Período de retos: ${periodTypeLabel(
        result.periodType
      )} (${result.periodKey || "actual"})`;

      const challenges = result.challenges || [];
      if (!challenges.length) {
        challengesList.innerHTML =
          '<p class="challenges-empty">Aún no hay retos configurados para este período.</p>';
        return;
      }

      challengesList.innerHTML = "";
      challenges.forEach((ch) => {
        const card = document.createElement("div");
        const progressValue = ch.progress_value || 0;
        const target = ch.target_value || 0;
        const completed = ch.completed === 1;
        const rewardXp = ch.reward_xp || 0;

        let progressLabel = "";
        if (ch.target_type === "breaks_completed") {
          progressLabel = `${progressValue}/${target} pausas`;
        } else if (ch.target_type === "xp_gain") {
          progressLabel = `${progressValue}/${target} XP`;
        } else {
          progressLabel = `${progressValue}/${target}`;
        }

        let pct = 0;
        if (target > 0) {
          pct = Math.round((progressValue / target) * 100);
          if (pct > 100) pct = 100;
          if (pct < 0) pct = 0;
        }

        card.className = "challenge-card" + (completed ? " completed" : "");

        const periodChip =
          periodType === "weekly"
            ? "Reto semanal"
            : periodType === "monthly"
            ? "Reto mensual"
            : "Reto diario";

        card.innerHTML = `
          <div class="challenge-title-row">
            <strong>${ch.name}</strong>
            <span class="challenge-chip ${
              completed ? "completed" : ""
            }">${completed ? "Completado" : periodChip}</span>
          </div>
          ${
            ch.description
              ? `<div class="challenge-desc">${ch.description}</div>`
              : ""
          }
          <div class="challenge-progress-bar">
            <div class="challenge-progress-fill" style="width:${pct}%;"></div>
          </div>
          <div class="challenge-meta">
            <span>${progressLabel}</span>
            <span>Recompensa: ${rewardXp} XP</span>
          </div>
        `;

        challengesList.appendChild(card);
      });
    } catch (err) {
      console.error("Error cargando retos:", err);
      challengesErrorBox.style.display = "block";
      challengesErrorBox.textContent =
        "Error inesperado al cargar retos activos.";
      challengesList.innerHTML =
        '<p class="challenges-empty">Error al cargar retos.</p>';
    }
  }

  reloadBtn.addEventListener("click", () => {
    loadLeaderboard();
    loadChallenges();
  });

  periodTypeSelect.addEventListener("change", () => {
    // al cambiar de tipo, limpiamos la clave para que el backend use el período actual
    periodKeyInput.value = "";
    loadLeaderboard();
    loadChallenges();
  });

  // Carga inicial
  loadLeaderboard();
  loadChallenges();
});
