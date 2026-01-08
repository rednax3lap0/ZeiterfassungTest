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
let qrScanner = null;

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

  adminSections.forEach(function (sec) {
    sec.style.display = isAdmin() ? "block" : "none";
  });

  if (entriesSection) {
    entriesSection.style.display = isUserOnly() ? "none" : "block";
  }

  // Menüeinträge je nach Rolle ein-/ausblenden
  var entriesMenuItem = document.querySelector('[data-section-target="entries-section"]');
  if (entriesMenuItem) {
    entriesMenuItem.style.display = isUserOnly() ? "none" : "block";
  }
  var adminMenuItems = document.querySelectorAll(".menu-item-admin");
  adminMenuItems.forEach(function (item) {
    item.style.display = isAdmin() ? "block" : "none";
  });
}

function renderStampSection() {
  const statusEl = qs("stamp-status");
  const objectSelect = qs("stamp-object");
  const descInput = qs("stamp-description");
  const stampButton = qs("stamp-button");
  const stopButton = qs("stamp-stop-button");
  const qrButton = qs("qr-scan-button");

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
    if (qrButton) {
      qrButton.style.display = "none";
      qrButton.disabled = true;
    }
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
    allowed.forEach(function (o) {
      const opt = document.createElement("option");
      opt.value = String(o.id);
      opt.textContent = o.name;
      objectSelect.appendChild(opt);
    });
    objectSelect.disabled = !!stamp;
  }

  const canScan = allowed.length > 0 && !stamp;
  if (qrButton) {
    qrButton.disabled = !canScan;
    qrButton.style.display = canScan ? "inline-flex" : "none";
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
    const obj =
      allowed.find(function (o) {
        return o.id === stamp.objectId;
      }) ||
      state.objects.find(function (o) {
        return o.id === stamp.objectId;
      });
    const objName = obj ? obj.name : "(Objekt)";
    statusEl.textContent =
      "Eingestempelt seit " +
      stamp.start +
      " Uhr am " +
      stamp.date +
      ' bei "' +
      objName +
      '".';
    if (descInput) {
      descInput.disabled = true;
      descInput.value = stamp.description || "";
    }
    const val = String(stamp.objectId);
    const hasOption = Array.prototype.some.call(
      objectSelect.options,
      function (o) {
        return o.value === val;
      }
    );
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
    vm.objectOptions.forEach(function (opt) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      filterObjectSelect.appendChild(o);
    });
    filterObjectSelect.value = state.filters.objectId || "all";
  }

  if (filterUserSelect) {
    filterUserSelect.innerHTML = "";
    vm.userOptions.forEach(function (opt) {
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

  vm.rows.forEach(function (row) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td>' +
      escapeHtml(row.date) +
      "</td>" +
      "<td>" +
      escapeHtml(row.start) +
      "</td>" +
      "<td>" +
      escapeHtml(row.end) +
      "</td>" +
      '<td><span class="pill">' +
      escapeHtml(row.durationLabel) +
      "</span></td>" +
      "<td>" +
      escapeHtml(row.objectName) +
      "</td>" +
      '<td class="description-cell">' +
      escapeHtml(row.description) +
      "</td>" +
      (state.currentUser && (isAdmin() || isLead())
        ? "<td>" + escapeHtml(row.username) + "</td>"
        : '<td style="display:none;"></td>') +
      '<td><button type="button" class="btn-danger" data-entry-id="' +
      row.id +
      '">✕</button></td>';
    tbody.appendChild(tr);
  });

  totalEl.textContent = formatDuration(vm.totalMinutes);

  const buttons = tbody.querySelectorAll("[data-entry-id]");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = Number(btn.getAttribute("data-entry-id"));
      const ok = confirm("Buchung wirklich löschen?");
      if (!ok) return;
      deleteEntry(id)
        .then(function () {
          renderEntriesSection();
        })
        .catch(function (e) {
          console.error("Fehler beim Löschen der Buchung:", e);
          alert("Buchung konnte nicht gelöscht werden.");
        });
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

  state.objects.forEach(function (obj) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" +
      escapeHtml(obj.name || "") +
      "</td>" +
      "<td>" +
      escapeHtml(obj.code || "") +
      "</td>" +
      '<td><button type="button" class="btn-danger" data-object-id="' +
      obj.id +
      '">Löschen</button></td>';
    tbody.appendChild(tr);
  });

  const buttons = tbody.querySelectorAll("[data-object-id]");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = Number(btn.getAttribute("data-object-id"));
      const obj = state.objects.find(function (o) {
        return o.id === id;
      });
      if (!obj) return;
      const ok = confirm(
        'Objekt "' +
          obj.name +
          '" wirklich löschen? Alle zugehörigen Buchungen werden entfernt.'
      );
      if (!ok) return;
      deleteObject(id)
        .then(function () {
          renderObjectsSection();
          renderEntriesSection();
          renderUsersSection();
          renderStampSection();
        })
        .catch(function (e) {
          console.error("Fehler beim Löschen des Objekts:", e);
          alert("Objekt konnte nicht gelöscht werden.");
        });
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

  state.users.forEach(function (user) {
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
        .filter(function (o) {
          return ids.indexOf(o.id) !== -1;
        })
        .map(function (o) {
          return o.name;
        });
      if (!names.length) objectsLabel = "keine";
      else if (names.length <= 2) objectsLabel = names.join(", ");
      else
        objectsLabel =
          names.slice(0, 2).join(", ") + " (+" + (names.length - 2) + ")";
    }

    tr.innerHTML =
      "<td>" +
      escapeHtml(user.username) +
      "</td>" +
      '<td><span class="badge ' +
      badgeClass +
      '">' +
      escapeHtml(roleLabel) +
      "</span></td>" +
      "<td>" +
      escapeHtml(objectsLabel || "") +
      (user.role !== "admin"
        ? ' <button type="button" class="btn-secondary small-btn" data-edit-objects="' +
          user.id +
          '">Objekte</button>'
        : "") +
      "</td>" +
      "<td>" +
      (user.username === "admin"
        ? ""
        : '<button type="button" class="btn-danger" data-user-id="' +
          user.id +
          '">Löschen</button>') +
      "</td>";
    tbody.appendChild(tr);
  });

  const delButtons = tbody.querySelectorAll("[data-user-id]");
  delButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = Number(btn.getAttribute("data-user-id"));
      const user = state.users.find(function (u) {
        return u.id === id;
      });
      if (!user) return;
      if (state.currentUser && state.currentUser.id === id) {
        alert("Dich selbst zu löschen ist keine gute Idee.");
        return;
      }
      const ok = confirm(
        'Benutzer "' +
          user.username +
          '" wirklich löschen? Alle zugehörigen Buchungen werden entfernt.'
      );
      if (!ok) return;
      deleteUser(id)
        .then(function () {
          renderUsersSection();
          renderEntriesSection();
        })
        .catch(function (e) {
          console.error("Fehler beim Löschen des Benutzers:", e);
          alert("Benutzer konnte nicht gelöscht werden.");
        });
    });
  });

  const editButtons = tbody.querySelectorAll("[data-edit-objects]");
  editButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = Number(btn.getAttribute("data-edit-objects"));
      openObjectModal(id);
    });
  });
}

function openObjectModal(userId) {
  const user = state.users.find(function (u) {
    return u.id === userId;
  });
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
  const user = state.users.find(function (u) {
    return u.id === objectModalUserId;
  });
  if (!user) return;
  const allowed = Array.isArray(user.allowedObjectIds) ? user.allowedObjectIds : [];
  const term = ((searchInput && searchInput.value) || "").toLowerCase().trim();
  const filtered = state.objects.filter(function (o) {
    return !term || String(o.name || "").toLowerCase().indexOf(term) !== -1;
  });
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "modal-list-empty";
    empty.textContent = "Keine Treffer.";
    listEl.appendChild(empty);
    return;
  }
  filtered.forEach(function (obj) {
    const label = document.createElement("label");
    label.className = "modal-list-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(obj.id);
    cb.checked = allowed.indexOf(obj.id) !== -1;
    const span = document.createElement("span");
    span.textContent = obj.name;
    label.appendChild(cb);
    label.appendChild(span);
    listEl.appendChild(label);
  });
}

function findObjectByQrText(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  const allowed = getAllowedObjectsForCurrentUser();
  if (!allowed || !allowed.length) return null;

  const byCode = allowed.find(function (o) {
    return o.code && String(o.code) === trimmed;
  });
  if (byCode) return byCode;

  const match = trimmed.match(/^OBJ:(\d+)$/i);
  if (match) {
    const id = parseInt(match[1], 10);
    const byId = allowed.find(function (o) {
      return o.id === id;
    });
    if (byId) return byId;
  }

  const asNum = parseInt(trimmed, 10);
  if (!isNaN(asNum)) {
    const byId2 = allowed.find(function (o) {
      return o.id === asNum;
    });
    if (byId2) return byId2;
  }

  return null;
}

function onQrDecoded(decodedText) {
  const obj = findObjectByQrText(decodedText);
  if (!obj) {
    alert(
      "Kein passendes Objekt für diesen QR-Code gefunden oder dir nicht zugewiesen."
    );
    return;
  }
  const select = qs("stamp-object");
  if (select) {
    select.value = String(obj.id);
  }
  alert('Objekt "' + obj.name + '" ausgewählt.');
  closeQrModal();
}

function stopQrScanner() {
  if (!qrScanner) return;
  qrScanner
    .stop()
    .then(function () {
      qrScanner.clear();
      qrScanner = null;
    })
    .catch(function (e) {
      console.error("Fehler beim Stoppen des QR-Scanners:", e);
      qrScanner = null;
    });
}

function openQrModal() {
  const backdrop = qs("qr-modal-backdrop");
  if (!backdrop) return;
  if (!window.Html5Qrcode) {
    alert("QR-Scanner-Bibliothek nicht geladen.");
    return;
  }
  backdrop.style.display = "flex";

  if (qrScanner) {
    stopQrScanner();
  }

  try {
    qrScanner = new Html5Qrcode("qr-reader");
  } catch (e) {
    console.error("Fehler beim Initialisieren des QR-Scanners:", e);
    alert("QR-Scanner konnte nicht gestartet werden.");
    backdrop.style.display = "none";
    qrScanner = null;
    return;
  }

  qrScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      function (decodedText, decodedResult) {
        onQrDecoded(decodedText);
      },
      function (errorMessage) {
        // Dekodierfehler ignorieren
      }
    )
    .catch(function (err) {
      console.error("Fehler beim Starten des QR-Scanners:", err);
      alert("Kamera konnte nicht gestartet werden.");
      backdrop.style.display = "none";
      qrScanner = null;
    });
}

function closeQrModal() {
  const backdrop = qs("qr-modal-backdrop");
  if (backdrop) backdrop.style.display = "none";
  stopQrScanner();
}

function renderAll() {
  renderUserBadge();
  renderStampSection();
  renderEntriesSection();
  renderObjectsSection();
  renderUsersSection();
}

function onStampInClick() {
  const objSelect = qs("stamp-object");
  const descInput = qs("stamp-description");
  const objectId = objSelect && objSelect.value ? objSelect.value : "";
  const description = descInput ? descInput.value.trim() : "";

  handleClockIn(objectId, description)
    .then(function (res) {
      if (!res.ok) {
        alert(res.message);
        return;
      }
      renderStampSection();
    })
    .catch(function (e) {
      console.error("Fehler beim Einstempeln:", e);
      alert("Buchung konnte nicht gestartet werden.");
    });
}

function onStampOutClick() {
  handleClockOut()
    .then(function (res) {
      if (!res.ok) {
        alert(res.message);
        return;
      }
      renderStampSection();
      renderEntriesSection();
    })
    .catch(function (e) {
      console.error("Fehler beim Ausstempeln:", e);
      alert("Buchung konnte nicht beendet werden.");
    });
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
  const qrBtn = qs("qr-scan-button");
  const qrBackdrop = qs("qr-modal-backdrop");
  const qrCloseBtn = qs("qr-modal-close");
  const menuToggle = qs("menu-toggle");
  const menuDropdown = qs("menu-dropdown");

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const username = qs("login-username").value.trim();
      const password = qs("login-password").value;
      login(username, password)
        .then(function (res) {
          if (!res.ok) {
            alert(res.message || "Login fehlgeschlagen.");
            return;
          }
          showAppView();
        })
        .catch(function (err) {
          console.error("Login-Fehler:", err);
          alert("Login nicht möglich.");
        });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
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
    filterObjectSelect.addEventListener("change", function () {
      setObjectFilter(filterObjectSelect.value || "all");
      renderEntriesSection();
    });
  }

  if (filterUserSelect) {
    filterUserSelect.addEventListener("change", function () {
      setUserFilter(filterUserSelect.value || "all");
      renderEntriesSection();
    });
  }

  if (objectForm) {
    objectForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const nameInput = qs("object-name");
      const codeInput = qs("object-code");
      const name = nameInput.value.trim();
      const code = codeInput.value.trim();
      if (!name) return;
      createObject(name, code || null)
        .then(function () {
          nameInput.value = "";
          codeInput.value = "";
          renderObjectsSection();
          renderStampSection();
          renderUsersSection();
        })
        .catch(function (err) {
          console.error("Fehler beim Anlegen des Objekts:", err);
          alert("Objekt konnte nicht angelegt werden.");
        });
    });
  }

  if (userForm) {
    userForm.addEventListener("submit", function (e) {
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
      const exists = state.users.find(function (u) {
        return u.username === username;
      });
      if (exists) {
        alert("Benutzername existiert bereits.");
        return;
      }
      createUser(username, password, role)
        .then(function () {
          uInput.value = "";
          pInput.value = "";
          rSelect.value = "user";
          renderUsersSection();
        })
        .catch(function (err) {
          console.error("Fehler beim Anlegen des Benutzers:", err);
          alert("Benutzer konnte nicht angelegt werden.");
        });
    });
  }

  if (modalSearch) {
    modalSearch.addEventListener("input", function () {
      renderObjectModalList();
    });
  }
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", function () {
      closeObjectModal();
    });
  }
  if (modalCancelBtn) {
    modalCancelBtn.addEventListener("click", function () {
      closeObjectModal();
    });
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", function (e) {
      if (e.target === modalBackdrop) closeObjectModal();
    });
  }
  if (modalSaveBtn) {
    modalSaveBtn.addEventListener("click", function () {
      const user = state.users.find(function (u) {
        return u.id === objectModalUserId;
      });
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
      boxes.forEach(function (cb) {
        if (cb.checked) {
          const v = Number(cb.value);
          if (!Number.isNaN(v)) ids.push(v);
        }
      });
      updateUserAllowedObjects(user.id, ids)
        .then(function () {
          renderUsersSection();
          if (state.currentUser && state.currentUser.id === user.id) {
            renderStampSection();
            renderEntriesSection();
          }
          closeObjectModal();
        })
        .catch(function (err) {
          console.error("Fehler beim Speichern der Objekt-Zuweisung:", err);
          alert("Objekte konnten nicht gespeichert werden.");
        });
    });
  }

  if (qrBtn) {
    qrBtn.addEventListener("click", function () {
      openQrModal();
    });
  }
  if (qrCloseBtn) {
    qrCloseBtn.addEventListener("click", function () {
      closeQrModal();
    });
  }
  if (qrBackdrop) {
    qrBackdrop.addEventListener("click", function (e) {
      if (e.target === qrBackdrop) closeQrModal();
    });
  }

  if (menuToggle && menuDropdown) {
    menuToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var visible = menuDropdown.style.display === "block";
      menuDropdown.style.display = visible ? "none" : "block";
    });

    document.addEventListener("click", function (e) {
      if (!menuDropdown.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target)) {
        menuDropdown.style.display = "none";
      }
    });

    var menuItems = menuDropdown.querySelectorAll("[data-section-target]");
    menuItems.forEach(function (item) {
      item.addEventListener("click", function () {
        var targetId = item.getAttribute("data-section-target");
        var target = qs(targetId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        menuDropdown.style.display = "none";
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initApp()
    .then(function () {
      setupEventHandlers();
      if (state.currentUser) {
        showAppView();
      } else {
        showLoginView();
      }
    })
    .catch(function (e) {
      console.error("Fehler beim Initialisieren der App:", e);
      alert("App konnte nicht gestartet werden.");
      showLoginView();
    });
});
