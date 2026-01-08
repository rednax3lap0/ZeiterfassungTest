// ui.js
import {
  state,
  initApp,
  login,
  logout,
  handleClockIn,
  handleClockOut,
  getCurrentStamp,
  getAllowedObjectsForCurrentUser,
  getEntriesViewModel,
  setObjectFilter,
  setUserFilter,
  deleteEntry,
  createObject,
  deleteObject,
  createUser,
  deleteUser,
  updateUserAllowedObjects,
  isAdmin,
  isLead,
  isUserOnly,
  formatDuration,
} from "./logic.js";

let objectModalUserId = null;

function qs(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showLoginView() {
  qs("login-view").style.display = "block";
  qs("app-view").style.display = "none";
}

function showAppView() {
  qs("login-view").style.display = "none";
  qs("app-view").style.display = "block";
  renderAll();
}

function renderUserBadge() {
  const nameEl = qs("current-username");
  const rolePill = qs("current-role-pill");
  const adminSections = document.querySelectorAll(".admin-only");
  const entriesSection = qs("entries-section");

  if (!state.currentUser) return;

  if (nameEl) nameEl.textContent = state.currentUser.username;
  if (rolePill) {
    if (state.currentUser.role === "admin") rolePill.textContent = "Admin";
    else if (state.currentUser.role === "lead")
      rolePill.textContent = "Objektleitung";
    else rolePill.textContent = "Mitarbeiter";
  }

  adminSections.forEach((sec) => {
    sec.style.display = isAdmin() ? "block" : "none";
  });

  if (entriesSection) {
    entriesSection.style.display = isUserOnly() ? "none" : "block";
  }
}

function renderStampSection() {
  const statusEl = qs("stamp-status");
  const objectSelect = qs("stamp-object");
  const descInput = qs("stamp-description");
  const stampButton = qs("stamp-button");
  const stopButton = qs("stamp-stop-button");

  if (!statusEl || !objectSelect || !stampButton || !stopButton) return;

  const stamp = getCurrentStamp();

  objectSelect.innerHTML = "";
  if (!state.currentUser) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nicht eingeloggt";
    objectSelect.appendChild(opt);
    objectSelect.disabled = true;
    if (descInput) descInput.disabled = true;
    stampButton.disabled = true;
    stopButton.disabled = true;
    stampButton.style.display = "none";
    stopButton.style.display = "none";
    statusEl.textContent = "Bitte einloggen, um zu stempeln.";
    return;
  }

  const allowed = getAllowedObjectsForCurrentUser();
  if (!allowed.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent =
      state.currentUser.role === "admin"
        ? "Keine Objekte vorhanden"
        : "Keine Objekte zugewiesen";
    objectSelect.appendChild(opt);
    objectSelect.disabled = true;
  } else {
    allowed.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = String(o.id);
      opt.textContent = o.name;
      objectSelect.appendChild(opt);
    });
    objectSelect.disabled = !!stamp;
  }

  if (!stamp) {
    statusEl.textContent = "Du bist aktuell nicht eingestempelt.";
    if (descInput) {
      descInput.disabled = false;
      descInput.value = "";
    }
    stampButton.disabled = false;
    stopButton.disabled = true;
    stampButton.style.display = "inline-flex";
    stopButton.style.display = "none";
  } else {
    const obj = allowed.find((o) => o.id === stamp.objectId) ||
      state.objects.find((o) => o.id === stamp.objectId);
    const objName = obj ? obj.name : "(Objekt)";
    statusEl.textContent =
      "Eingestempelt seit " +
      stamp.start +
      " Uhr am " +
      stamp.date +
      " bei "" +
      objName +
      "".";
    if (descInput) {
      descInput.disabled = true;
      descInput.value = stamp.description || "";
    }
    const val = String(stamp.objectId);
    const hasOption = [...objectSelect.options].some((o) => o.value === val);
    if (hasOption) objectSelect.value = val;
    stampButton.disabled = true;
    stopButton.disabled = false;
    stampButton.style.display = "none";
    stopButton.style.display = "inline-flex";
  }
}

function renderEntriesSection() {
  const tbody = qs("entries-body");
  const emptyEl = qs("entries-empty");
  const totalEl = qs("total-hours");
  const thUser = qs("th-user");
  const filterObjectSelect = qs("filter-object");
  const filterUserSelect = qs("filter-user");
  const subtitleEl = qs("entries-subtitle");

  if (!tbody || !emptyEl || !totalEl) return;

  const vm = getEntriesViewModel();

  if (state.currentUser && (isAdmin() || isLead())) {
    if (thUser) thUser.style.display = "";
    if (subtitleEl) {
      subtitleEl.textContent = isAdmin()
        ? " – alle Benutzer"
        : " – eigene Objekte";
    }
  } else {
    if (thUser) thUser.style.display = "none";
    if (subtitleEl) subtitleEl.textContent = "";
  }

  if (filterObjectSelect) {
    filterObjectSelect.innerHTML = "";
    vm.objectOptions.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      filterObjectSelect.appendChild(o);
    });
    filterObjectSelect.value = state.filters.objectId || "all";
  }

  if (filterUserSelect) {
    filterUserSelect.innerHTML = "";
    vm.userOptions.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      filterUserSelect.appendChild(o);
    });
    filterUserSelect.value = state.filters.userId || "all";
  }

  tbody.innerHTML = "";
  if (!vm.rows.length) {
    emptyEl.style.display = "block";
    totalEl.textContent = "0h 00m";
    return;
  } else {
    emptyEl.style.display = "none";
  }

  for (const row of vm.rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.start)}</td>
      <td>${escapeHtml(row.end)}</td>
      <td><span class="pill">${escapeHtml(row.durationLabel)}</span></td>
      <td>${escapeHtml(row.objectName)}</td>
      <td class="description-cell">${escapeHtml(row.description)}</td>
      ${
        state.currentUser && (isAdmin() || isLead())
          ? `<td>${escapeHtml(row.username)}</td>`
          : `<td style="display:none;"></td>`
      }
      <td><button type="button" class="btn-danger" data-entry-id="${
        row.id
      }">✕</button></td>
    `;
    tbody.appendChild(tr);
  }

  totalEl.textContent = formatDuration(vm.totalMinutes);

  tbody.querySelectorAll("[data-entry-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-entry-id"));
      const ok = confirm("Buchung wirklich löschen?");
      if (!ok) return;
      try {
        await deleteEntry(id);
        renderEntriesSection();
      } catch (e) {
        console.error("Fehler beim Löschen der Buchung:", e);
        alert("Buchung konnte nicht gelöscht werden.");
      }
    });
  });
}

function renderObjectsSection() {
  const tbody = qs("objects-body");
  const emptyEl = qs("objects-empty");
  if (!tbody || !emptyEl) return;

  tbody.innerHTML = "";
  if (!state.objects.length) {
    emptyEl.style.display = "block";
    return;
  } else {
    emptyEl.style.display = "none";
  }

  for (const obj of state.objects) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(obj.name)}</td>
      <td><button type="button" class="btn-danger" data-object-id="${obj.id}">Löschen</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-object-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-object-id"));
      const obj = state.objects.find((o) => o.id === id);
      if (!obj) return;
      const ok = confirm(
        `Objekt "${obj.name}" wirklich löschen? Alle zugehörigen Buchungen werden entfernt.`
      );
      if (!ok) return;
      try {
        await deleteObject(id);
        renderObjectsSection();
        renderEntriesSection();
        renderUsersSection();
        renderStampSection();
      } catch (e) {
        console.error("Fehler beim Löschen des Objekts:", e);
        alert("Objekt konnte nicht gelöscht werden.");
      }
    });
  });
}

function renderUsersSection() {
  const tbody = qs("users-body");
  const emptyEl = qs("users-empty");
  if (!tbody || !emptyEl) return;

  tbody.innerHTML = "";
  if (!state.users.length) {
    emptyEl.style.display = "block";
    return;
  } else {
    emptyEl.style.display = "none";
  }

  for (const user of state.users) {
    const tr = document.createElement("tr");
    let roleLabel = "Mitarbeiter";
    let badgeClass = "badge-user";
    if (user.role === "admin") {
      roleLabel = "Admin";
      badgeClass = "badge-admin";
    } else if (user.role === "lead") {
      roleLabel = "Objektleitung";
      badgeClass = "badge-lead";
    }

    const ids = Array.isArray(user.allowedObjectIds) ? user.allowedObjectIds : [];
    let objectsLabel = "";
    if (user.role === "admin") {
      objectsLabel = "alle";
    } else if (!state.objects.length) {
      objectsLabel = "-";
    } else if (!ids.length) {
      objectsLabel = "keine";
    } else {
      const names = state.objects
        .filter((o) => ids.includes(o.id))
        .map((o) => o.name);
      if (!names.length) objectsLabel = "keine";
      else if (names.length <= 2) objectsLabel = names.join(", ");
      else objectsLabel = names.slice(0, 2).join(", ") + ` (+${names.length - 2})`;
    }

    tr.innerHTML = `
      <td>${escapeHtml(user.username)}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(roleLabel)}</span></td>
      <td>
        ${escapeHtml(objectsLabel || "")}
        ${
          user.role !== "admin"
            ? `<button type="button" class="btn-secondary small-btn" data-edit-objects="${user.id}">Objekte</button>`
            : ""
        }
      </td>
      <td>
        ${
          user.username === "admin"
            ? ""
            : `<button type="button" class="btn-danger" data-user-id="${user.id}">Löschen</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-user-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-user-id"));
      const user = state.users.find((u) => u.id === id);
      if (!user) return;
      if (state.currentUser && state.currentUser.id === id) {
        alert("Dich selbst zu löschen ist keine gute Idee.");
        return;
      }
      const ok = confirm(
        `Benutzer "${user.username}" wirklich löschen? Alle zugehörigen Buchungen werden entfernt.`
      );
      if (!ok) return;
      try {
        await deleteUser(id);
        renderUsersSection();
        renderEntriesSection();
      } catch (e) {
        console.error("Fehler beim Löschen des Benutzers:", e);
        alert("Benutzer konnte nicht gelöscht werden.");
      }
    });
  });

  tbody.querySelectorAll("[data-edit-objects]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-edit-objects"));
      openObjectModal(id);
    });
  });
}

function openObjectModal(userId) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  if (!state.objects.length) {
    alert("Es gibt noch keine Objekte.");
    return;
  }
  objectModalUserId = userId;
  const backdrop = qs("object-modal-backdrop");
  const nameEl = qs("object-modal-username");
  const search = qs("object-modal-search");
  if (nameEl) nameEl.textContent = user.username;
  if (search) search.value = "";
  renderObjectModalList();
  if (backdrop) backdrop.style.display = "flex";
}

function closeObjectModal() {
  const backdrop = qs("object-modal-backdrop");
  objectModalUserId = null;
  if (backdrop) backdrop.style.display = "none";
}

function renderObjectModalList() {
  const listEl = qs("object-modal-list");
  const searchInput = qs("object-modal-search");
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!state.objects.length) {
    const empty = document.createElement("div");
    empty.className = "modal-list-empty";
    empty.textContent = "Keine Objekte vorhanden.";
    listEl.appendChild(empty);
    return;
  }
  const user = state.users.find((u) => u.id === objectModalUserId);
  if (!user) return;
  const allowed = Array.isArray(user.allowedObjectIds) ? user.allowedObjectIds : [];
  const term = (searchInput && searchInput.value || "").toLowerCase().trim();
  const filtered = state.objects.filter((o) =>
    !term || String(o.name || "").toLowerCase().includes(term)
  );
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "modal-list-empty";
    empty.textContent = "Keine Treffer.";
    listEl.appendChild(empty);
    return;
  }
  for (const obj of filtered) {
    const label = document.createElement("label");
    label.className = "modal-list-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(obj.id);
    cb.checked = allowed.includes(obj.id);
    const span = document.createElement("span");
    span.textContent = obj.name;
    label.appendChild(cb);
    label.appendChild(span);
    listEl.appendChild(label);
  }
}

function renderAll() {
  renderUserBadge();
  renderStampSection();
  renderEntriesSection();
  renderObjectsSection();
  renderUsersSection();
}

async function onStampInClick() {
  const objSelect = qs("stamp-object");
  const descInput = qs("stamp-description");
  const objectId = objSelect && objSelect.value ? objSelect.value : "";
  const description = descInput ? descInput.value.trim() : "";

  try {
    const res = await handleClockIn(objectId, description);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    renderStampSection();
  } catch (e) {
    console.error("Fehler beim Einstempeln:", e);
    alert("Buchung konnte nicht gestartet werden.");
  }
}

async function onStampOutClick() {
  try {
    const res = await handleClockOut();
    if (!res.ok) {
      alert(res.message);
      return;
    }
    renderStampSection();
    renderEntriesSection();
  } catch (e) {
    console.error("Fehler beim Ausstempeln:", e);
    alert("Buchung konnte nicht beendet werden.");
  }
}

function setupEventHandlers() {
  const loginForm = qs("login-form");
  const logoutBtn = qs("logout-btn");
  const stampBtn = qs("stamp-button");
  const stopBtn = qs("stamp-stop-button");
  const filterObjectSelect = qs("filter-object");
  const filterUserSelect = qs("filter-user");
  const objectForm = qs("object-form");
  const userForm = qs("user-form");
  const modalBackdrop = qs("object-modal-backdrop");
  const modalSearch = qs("object-modal-search");
  const modalCloseBtn = qs("object-modal-close");
  const modalCancelBtn = qs("object-modal-cancel");
  const modalSaveBtn = qs("object-modal-save");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = qs("login-username").value.trim();
      const password = qs("login-password").value;
      try {
        const res = await login(username, password);
        if (!res.ok) {
          alert(res.message || "Login fehlgeschlagen.");
          return;
        }
        showAppView();
      } catch (err) {
        console.error("Login-Fehler:", err);
        alert("Login nicht möglich.");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
      showLoginView();
    });
  }

  if (stampBtn) {
    stampBtn.addEventListener("click", onStampInClick);
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", onStampOutClick);
  }

  if (filterObjectSelect) {
    filterObjectSelect.addEventListener("change", () => {
      setObjectFilter(filterObjectSelect.value || "all");
      renderEntriesSection();
    });
  }

  if (filterUserSelect) {
    filterUserSelect.addEventListener("change", () => {
      setUserFilter(filterUserSelect.value || "all");
      renderEntriesSection();
    });
  }

  if (objectForm) {
    objectForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = qs("object-name");
      const name = input.value.trim();
      if (!name) return;
      try {
        await createObject(name);
        input.value = "";
        renderObjectsSection();
        renderStampSection();
        renderUsersSection();
      } catch (err) {
        console.error("Fehler beim Anlegen des Objekts:", err);
        alert("Objekt konnte nicht angelegt werden.");
      }
    });
  }

  if (userForm) {
    userForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const uInput = qs("user-username");
      const pInput = qs("user-password");
      const rSelect = qs("user-role");

      const username = uInput.value.trim();
      const password = pInput.value;
      const role = rSelect.value;

      if (!username || !password) {
        alert("Benutzername und Passwort sind Pflicht.");
        return;
      }
      if (state.users.find((u) => u.username === username)) {
        alert("Benutzername existiert bereits.");
        return;
      }
      try {
        await createUser(username, password, role);
        uInput.value = "";
        pInput.value = "";
        rSelect.value = "user";
        renderUsersSection();
      } catch (err) {
        console.error("Fehler beim Anlegen des Benutzers:", err);
        alert("Benutzer konnte nicht angelegt werden.");
      }
    });
  }

  if (modalSearch) {
    modalSearch.addEventListener("input", () => renderObjectModalList());
  }
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => closeObjectModal());
  }
  if (modalCancelBtn) {
    modalCancelBtn.addEventListener("click", () => closeObjectModal());
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeObjectModal();
    });
  }
  if (modalSaveBtn) {
    modalSaveBtn.addEventListener("click", async () => {
      const user = state.users.find((u) => u.id === objectModalUserId);
      if (!user) {
        closeObjectModal();
        return;
      }
      const listEl = qs("object-modal-list");
      if (!listEl) {
        closeObjectModal();
        return;
      }
      const boxes = listEl.querySelectorAll('input[type="checkbox"]');
      const ids = [];
      boxes.forEach((cb) => {
        if (cb.checked) {
          const v = Number(cb.value);
          if (!Number.isNaN(v)) ids.push(v);
        }
      });
      try {
        await updateUserAllowedObjects(user.id, ids);
        renderUsersSection();
        if (state.currentUser && state.currentUser.id === user.id) {
          renderStampSection();
          renderEntriesSection();
        }
        closeObjectModal();
      } catch (err) {
        console.error("Fehler beim Speichern der Objekt-Zuweisung:", err);
        alert("Objekte konnten nicht gespeichert werden.");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initApp();
    setupEventHandlers();
    if (state.currentUser) {
      showAppView();
    } else {
      showLoginView();
    }
  } catch (e) {
    console.error("Fehler beim Initialisieren der App:", e);
    alert("App konnte nicht gestartet werden.");
    showLoginView();
  }
});
