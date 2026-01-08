// api.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// HIER DEINE SUPABASE-DATEN EINTRAGEN:
const SUPABASE_URL = "https://mgxrmoqpbbnahtijyjci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fS_r7bbCuYcOJKn3DNF0Nw_KqVEVftw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin bei Bedarf automatisch anlegen
export async function apiEnsureDefaultAdmin() {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("username", "admin")
    .limit(1);

  if (error) {
    console.error("Fehler beim Prüfen des Admins:", error);
    return;
  }

  if (!data || data.length === 0) {
    const { error: insError } = await supabase.from("users").insert([
      {
        username: "admin",
        password: "admin123",
        role: "admin",
        allowed_object_ids: [],
      },
    ]);
    if (insError) {
      console.error("Fehler beim Anlegen des Admins:", insError);
    }
  }
}

export async function apiLogin(username, password) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .limit(1);

  if (error) {
    console.error("Login-Fehler:", error);
    throw new Error("Datenbankfehler beim Login");
  }

  return data && data.length ? data[0] : null;
}

export async function apiLoadAll() {
  const [usersRes, objectsRes, entriesRes] = await Promise.all([
    supabase.from("users").select("*"),
    supabase.from("objects").select("*"),
    supabase.from("entries").select("*"),
  ]);

  if (usersRes.error) throw usersRes.error;
  if (objectsRes.error) throw objectsRes.error;
  if (entriesRes.error) throw entriesRes.error;

  return {
    users: usersRes.data || [],
    objects: objectsRes.data || [],
    entries: entriesRes.data || [],
  };
}

export async function apiCreateEntry(entry) {
  const { data, error } = await supabase
    .from("entries")
    .insert([entry])
    .select();
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

export async function apiDeleteEntry(id) {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

export async function apiCreateObject(name, code) {
  const { data, error } = await supabase
    .from("objects")
    .insert([{ name: name, code: code }])
    .select();
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

export async function apiDeleteObject(id) {
  const { error: entriesError } = await supabase
    .from("entries")
    .delete()
    .eq("object_id", id);
  if (entriesError) throw entriesError;

  const { error } = await supabase.from("objects").delete().eq("id", id);
  if (error) throw error;
}

export async function apiCreateUser(username, password, role) {
  const { data, error } = await supabase
    .from("users")
    .insert([{ username, password, role, allowed_object_ids: [] }])
    .select();
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

export async function apiDeleteUser(id) {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
}

export async function apiUpdateUserAllowedObjects(userId, objectIds) {
  const { error } = await supabase
    .from("users")
    .update({ allowed_object_ids: objectIds })
    .eq("id", userId);
  if (error) throw error;
}
