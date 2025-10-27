// admin-dashboard.js - User management functionality

let currentUsers = [];

/**
 * Formats a timestamp to a readable date string
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Shows a message to the user
 */
function showMessage(text, isSuccess = false) {
  const messageEl = document.getElementById("message");
  messageEl.textContent = text;
  messageEl.className = isSuccess ? "success" : "error";

  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageEl.style.display = "none";
  }, 5000);
}

/**
 * Loads and displays all users from the database
 */
async function loadUsers() {
  try {
    const result = await window.api.adminGetAllUsers();

    if (!result.success) {
      showMessage(result.message, false);
      return;
    }

    currentUsers = result.users || [];
    renderUserTable();
  } catch (error) {
    console.error("Error loading users:", error);
    showMessage("Error al cargar usuarios. Intenta de nuevo.", false);
  }
}

/**
 * Renders the user table with current data
 */
function renderUserTable() {
  const tbody = document.getElementById("userTableBody");
  tbody.innerHTML = "";

  if (currentUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px;">
          <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p style="font-size: 16px; margin: 0;">No hay usuarios registrados aún</p>
            <p style="font-size: 14px; margin-top: 8px;">Registra el primer cliente para comenzar</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  currentUsers.forEach((user) => {
    const row = document.createElement("tr");

    const roleClass = user.role === "admin" ? "role-admin" : "role-client";
    const roleLabel = user.role === "admin" ? "Admin" : "Cliente";

    row.innerHTML = `
      <td><strong>${user.email}</strong></td>
      <td><span class="role-badge ${roleClass}">${roleLabel}</span></td>
      <td>${user.full_name || "-"}</td>
      <td>${user.org_name || "-"}</td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        <button class="btn btn-danger" data-user-id="${
          user.id
        }" data-user-email="${user.email}">
          🗑️ Eliminar
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });

  // Add event listeners to delete buttons
  const deleteButtons = tbody.querySelectorAll(".btn-danger");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", handleDeleteUser);
  });
}

/**
 * Handles user deletion
 */
async function handleDeleteUser(event) {
  const button = event.currentTarget;
  const userId = parseInt(button.dataset.userId, 10);
  const userEmail = button.dataset.userEmail;

  // Check if user is deleting themselves
  const currentUserData = localStorage.getItem("ab_current_user");
  const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
  const isDeletingSelf = currentUser && currentUser.email === userEmail;

  // Confirmation dialog
  const confirmMessage = isDeletingSelf
    ? `⚠️ ADVERTENCIA: Estás a punto de eliminar tu propia cuenta de administrador.\n\nEsta acción cerrará tu sesión inmediatamente y no podrás volver a acceder.\n\n¿Estás seguro?`
    : `¿Estás seguro de que quieres eliminar al usuario "${userEmail}"?\n\nEsta acción no se puede deshacer.`;

  const confirmed = confirm(confirmMessage);

  if (!confirmed) {
    return;
  }

  // Disable button during operation
  button.disabled = true;
  button.textContent = "Eliminando...";

  try {
    const result = await window.api.adminDeleteUser(userId);

    if (!result.success) {
      showMessage(result.message, false);
      button.disabled = false;
      button.innerHTML = "🗑️ Eliminar";
      return;
    }

    // If user deleted themselves, immediately logout
    if (isDeletingSelf) {
      localStorage.removeItem("ab_current_user");
      alert("Tu cuenta ha sido eliminada. Serás redirigido al inicio.");
      window.location.replace("../landing.html");
      return;
    }

    showMessage(`Usuario "${userEmail}" eliminado exitosamente.`, true);

    // Reload user list
    await loadUsers();
  } catch (error) {
    console.error("Error deleting user:", error);
    showMessage("Error al eliminar usuario. Intenta de nuevo.", false);
    button.disabled = false;
    button.innerHTML = "🗑️ Eliminar";
  }
}

// Logout function - clears admin session and returns to landing
function logout() {
  try {
    localStorage.removeItem("ab_current_user");
    // Use replace() to prevent back button from returning to admin page
    window.location.replace("../landing.html");
  } catch (e) {
    console.error("Error during logout:", e);
    window.location.replace("../landing.html");
  }
}

// Load users when page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Admin dashboard loaded");
  loadUsers();
});
