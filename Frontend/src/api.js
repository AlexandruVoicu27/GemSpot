const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const TOKEN_STORAGE_KEY = "gemspot_access_token";

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function saveToken(token) {
  // Pastram tokenul ca frontendul sa il trimita la rutele protejate.
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken() {
  // Fara cookies: logout inseamna sa stergem tokenul salvat.
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function getAuthHeaders() {
  const token = getStoredToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || "API request failed");
    error.code = data?.code;
    throw error;
  }

  return data;
}

export async function login(email, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (data.session?.access_token) {
    saveToken(data.session.access_token);
  }

  return data;
}

export async function signup(email, password, username) {
  const data = await apiFetch("/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, username }),
  });

  // Cu Confirm Email activ, session este null pana userul confirma emailul.
  if (data.session?.access_token) {
    saveToken(data.session.access_token);
  }

  return data;
}

export async function getCurrentUser() {
  // Backendul verifica tokenul si intoarce userul curent.
  return apiFetch("/auth/me");
}

export async function getGames() {
  return apiFetch("/games");
}

export async function updateProfile(profileData) {
  return apiFetch("/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profileData),
  });
}


export async function uploadGame({ title, description, genre, gameFile, adminBypassScan }) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description);
  if (genre) formData.append("genre", genre);
  formData.append("gameFile", gameFile);
  if (adminBypassScan) formData.append("adminBypassScan", "true");

  return apiFetch("/uploads/games", {
    method: "POST",
    body: formData,
  });
}

export async function getUploadStatus(fileId) {
  return apiFetch("/uploads/" + fileId);
}
