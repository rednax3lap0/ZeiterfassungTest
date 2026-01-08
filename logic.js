// logic.js
import {
  apiEnsureDefaultAdmin,
  apiLogin,
  apiLoadAll,
  apiCreateEntry,
  apiDeleteEntry,
  apiCreateObject,
  apiDeleteObject,
  apiCreateUser,
  apiDeleteUser,
  apiUpdateUserAllowedObjects,
} from "./api.js";

const STORAGE_KEY_CURRENT_USER = "timeApp_currentUser_v1";
const STORAGE_KEY_ACTIVE_STAMPS = "timeApp_activeStamps_v1";

export const state = {
  currentUser: null,
  users: [],
  objects: [],
  entries: [],
  filters: {
    objectId: "all",
    userId: "all",
  },
  activeStamps: {},
};

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === undefined || parsed === null) return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("localStorage-Fehler:", e);
  }
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role,
    allowedObjectIds: Array.isArray(row.allowed_object_ids)
      ? row.allowed_object_ids
      : [],
  };
}

function mapEntry(row) {
  const dur =
    row.duration_minutes === undefined || row.duration_minutes === null
      ? 0
      : row.duration_minutes;
  return {
    id: row.id,
    userId: row.user_id,
    objectId: row.object_id,
    date: row.date,
    start: row.start ? String(row.start).slice(0, 5) : "",
    end: row.end ? String(row.end).slice(0, 5) : "",
    durationMinutes: dur,
    description: row.description || "",
  };
}

function loadActiveStamps() {
  const saved = loadFromStorage(STORAGE_KEY_ACTIVE_STAMPS, {});
  if (saved && typeof saved === "object") {
    state.activeStamps = saved;
  } else {
    state.activeStamps = {};
  }
}

function saveActiveStamps() {
  saveToStorage(STORAGE_KEY_ACTIVE_STAMPS, state.activeStamps);
}

export function getCurrentStamp() {
  if (!state.currentUser) return null;
  return state.activeStamps[String(state.currentUser.id)] || null;
}

function setCurrentStamp(stamp) {
  if (!state.currentUser) return;
  const key = String(state.currentUser.id);
  if (stamp) {
    state.activeStamps[key] = stamp;
  } else {
    delete state.activeStamps[key];
  }
  saveActiveStamps();
}


export function updateCurrentStampDescription(description) {
  if (!state.currentUser) return;
  const key = String(state.currentUser.id);
  const stamp = state.activeStamps[key];
  if (!stamp) return;
  stamp.description = description || "";
  saveActiveStamps();
}


export function calcDurationMinutes(start, end) {
  const partsStart = start.split(":");
  const partsEnd = end.split(":");
  const sh = parseInt(partsStart[0], 10);
  const sm = parseInt(partsStart[1], 10);
  const eh = parseInt(partsEnd[0], 10);
  const em = parseInt(partsEnd[1], 10);
  return eh * 60 + em - (sh * 60 + sm);
}

export function formatDuration(min) {
  const m = Number(min) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h + "h " + String(r).padStart(2, "0") + "m";
}

export function isAdmin() {
  return state.currentUser && state.currentUser.role === "admin";
}

export function isLead() {
  return state.currentUser && state.currentUser.role === "lead";
}

export function isUserOnly() {
  return state.currentUser && state.currentUser.role === "user";
}

export function getAllowedObjectsForUser(user) {
  if (!user) return [];
  if (user.role === "admin") return state.objects;
  const ids = Array.isArray(user.allowedObjectIds) ? user.allowedObjectIds : [];
  return state.objects.filter(function (o) {
    return ids.indexOf(o.id) !== -1;
  });
}

export function getAllowedObjectsForCurrentUser() {
  if (!state.currentUser) return [];
  // Immer den vollständigen User aus state.users holen,
  // damit allowedObjectIds aktuell sind
  const full = state.users.find(function (u) {
    return u.id === state.currentUser.id;
  });
  return getAllowedObjectsForUser(full || state.currentUser);
}

export async function initApp() {
  state.currentUser = loadFromStorage(STORAGE_KEY_CURRENT_USER, null);
  loadActiveStamps();

  await apiEnsureDefaultAdmin();
  const all = await apiLoadAll();
  state.users = (all.users || []).map(mapUser);
  state.objects = all.objects || [];
  state.entries = (all.entries || []).map(mapEntry);

  if (
    state.currentUser &&
    !state.users.find(function (u) {
      return u.id === state.currentUser.id;
    })
  ) {
    state.currentUser = null;
    saveToStorage(STORAGE_KEY_CURRENT_USER, null);
  }
}

export async function login(username, password) {
  const userRow = await apiLogin(username, password);
  if (!userRow) {
    return { ok: false, message: "Login fehlgeschlagen." };
  }
  const user = mapUser(userRow);
  state.currentUser = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  saveToStorage(STORAGE_KEY_CURRENT_USER, state.currentUser);
  return { ok: true };
}

export function logout() {
  state.currentUser = null;
  saveToStorage(STORAGE_KEY_CURRENT_USER, null);
}

export async function handleClockIn(objectId, description) {
  if (!state.currentUser) {
    return { ok: false, message: "Nicht eingeloggt." };
  }
  if (getCurrentStamp()) {
    return { ok: false, message: "Du bist bereits eingestempelt." };
  }

  const allowed = getAllowedObjectsForCurrentUser();
  if (state.currentUser.role !== "admin" && (!allowed || !allowed.length)) {
    return { ok: false, message: "Dir sind keine Objekte zugewiesen." };
  }

  if (!objectId) {
    return { ok: false, message: "Bitte ein Objekt auswählen." };
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);

  setCurrentStamp({
    date: date,
    start: time,
    objectId: Number(objectId),
    description: description || "",
  });

  return { ok: true };
}

export async function handleClockOut() {
  if (!state.currentUser) {
    return { ok: false, message: "Nicht eingeloggt." };
  }
  const stamp = getCurrentStamp();
  if (!stamp) {
    return { ok: false, message: "Du bist nicht eingestempelt." };
  }

  const now = new Date();
  const endTime = now.toTimeString().slice(0, 5);
  let minutes = calcDurationMinutes(stamp.start, endTime);
  if (minutes <= 0) minutes = 1;

  const entryRow = await apiCreateEntry({
    user_id: state.currentUser.id,
    object_id: stamp.objectId,
    date: stamp.date,
    start: stamp.start,
    end: endTime,
    duration_minutes: minutes,
    description: stamp.description || "",
  });

  if (entryRow) {
    state.entries.push(mapEntry(entryRow));
  }

  setCurrentStamp(null);
  return { ok: true };
}

export function setObjectFilter(objectId) {
  state.filters.objectId = objectId || "all";
}

export function setUserFilter(userId) {
  state.filters.userId = userId || "all";
}

export function getEntriesViewModel() {
  const current = state.currentUser;
  if (!current) {
    return {
      rows: [],
      totalMinutes: 0,
      objectOptions: [{ value: "all", label: "Alle" }],
      userOptions: [{ value: "all", label: "Alle" }],
    };
  }

  let base = state.entries;
  if (current.role === "admin") {
    base = state.entries;
  } else if (current.role === "lead") {
    const leadUser = state.users.find(function (u) {
      return u.id === current.id;
    });
    const ids =
      leadUser && Array.isArray(leadUser.allowedObjectIds)
        ? leadUser.allowedObjectIds
        : [];
    base = state.entries.filter(function (e) {
      return !e.objectId || ids.indexOf(e.objectId) !== -1;
    });
  } else {
    base = state.entries.filter(function (e) {
      return e.userId === current.id;
    });
  }

  const objMap = new Map();
  const userMap = new Map();

  base.forEach(function (e) {
    if (e.objectId) {
      const obj = state.objects.find(function (o) {
        return o.id === e.objectId;
      });
      if (obj) objMap.set(String(obj.id), obj.name);
    }
    const usr = state.users.find(function (u) {
      return u.id === e.userId;
    });
    if (usr) userMap.set(String(usr.id), usr.username);
  });

  const objectOptions = [{ value: "all", label: "Alle" }];
  objMap.forEach(function (name, id) {
    objectOptions.push({ value: id, label: name });
  });

  const userOptions = [{ value: "all", label: "Alle" }];
  userMap.forEach(function (username, id) {
    userOptions.push({ value: id, label: username });
  });

  const filtered = base.filter(function (e) {
    if (
      state.filters.objectId !== "all" &&
      String(e.objectId || "") !== state.filters.objectId
    )
      return false;
    if (
      state.filters.userId !== "all" &&
      String(e.userId) !== state.filters.userId
    )
      return false;
    return true;
  });

  let totalMinutes = 0;
  const rows = filtered
    .slice()
    .sort(function (a, b) {
      return (a.date + " " + a.start).localeCompare(b.date + " " + b.start);
    })
    .map(function (e) {
      totalMinutes += e.durationMinutes;
      const obj = state.objects.find(function (o) {
        return o.id === e.objectId;
      });
      const user = state.users.find(function (u) {
        return u.id === e.userId;
      });
      return {
        id: e.id,
        date: e.date,
        start: e.start,
        end: e.end,
        durationMinutes: e.durationMinutes,
        durationLabel: formatDuration(e.durationMinutes),
        objectName: obj ? obj.name : "",
        description: e.description,
        username: user ? user.username : "",
      };
    });

  return {
    rows: rows,
    totalMinutes: totalMinutes,
    objectOptions: objectOptions,
    userOptions: userOptions,
  };
}

export async function deleteEntry(id) {
  await apiDeleteEntry(id);
  state.entries = state.entries.filter(function (e) {
    return e.id !== id;
  });
}

export async function createObject(name, code) {
  const obj = await apiCreateObject(name, code);
  if (obj) state.objects.push(obj);
}

export async function deleteObject(id) {
  await apiDeleteObject(id);
  state.objects = state.objects.filter(function (o) {
    return o.id !== id;
  });
  state.entries = state.entries.filter(function (e) {
    return e.objectId !== id;
  });
  state.users.forEach(function (user) {
    if (Array.isArray(user.allowedObjectIds)) {
      user.allowedObjectIds = user.allowedObjectIds.filter(function (oid) {
        return oid !== id;
      });
    }
  });
}

export async function createUser(username, password, role) {
  const u = await apiCreateUser(username, password, role);
  if (u) state.users.push(mapUser(u));
}

export async function deleteUser(id) {
  await apiDeleteUser(id);
  state.users = state.users.filter(function (u) {
    return u.id !== id;
  });
  state.entries = state.entries.filter(function (e) {
    return e.userId !== id;
  });
}

export async function updateUserAllowedObjects(userId, objectIds) {
  await apiUpdateUserAllowedObjects(userId, objectIds);
  const u = state.users.find(function (x) {
    return x.id === userId;
  });
  if (u) {
    u.allowedObjectIds = objectIds.slice();
  }
}
