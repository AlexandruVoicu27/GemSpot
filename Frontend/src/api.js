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
    error.reason = data?.reason;
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

// Loads all projects owned by the authenticated creator.
// Searches published games and public creator profiles.
export async function searchSite(query) {
  return apiFetch("/search?q=" + encodeURIComponent(query));
}

// Loads one public creator profile and their published games.
export async function getPublicProfile(username) {
  return apiFetch("/users/" + encodeURIComponent(username));
}
export async function getMyProjects() {
  return apiFetch("/games/mine");
}

// Publishes a creator-owned game after its build was approved.
export async function publishGame(gameId) {
  return apiFetch(`/games/${gameId}/publish`, {
    method: "POST",
  });
}

// Archives a creator-owned or administrator-selected game.
export async function deleteGame(gameId) {
  return apiFetch(`/games/${gameId}`, {
    method: "DELETE",
  });
}

// Loads games visible to administrator accounts.
export async function getAdminGames() {
  return apiFetch("/admin/games");
}

// Loads users visible to administrator accounts.
export async function getAdminUsers() {
  return apiFetch("/admin/users");
}

// Bans one user through the administrator endpoint.
export async function banUser(userId, reason) {
  return apiFetch(`/admin/users/${userId}/ban`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
}

// Removes one user's ban through the administrator endpoint.
export async function unbanUser(userId) {
  return apiFetch(`/admin/users/${userId}/unban`, {
    method: "POST",
  });
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


export async function uploadGame({ title, description, genre, gameFile,coverImage }) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description);
  if (genre) formData.append("genre", genre);
  formData.append("gameFile", gameFile);
  
  if (coverImage) {
    formData.append("coverImage", coverImage);
  }
  return apiFetch("/uploads/games", {
    method: "POST",
    body: formData,
  });
}

export async function getUploadStatus(fileId) {
  return apiFetch("/uploads/" + fileId);
}

export async function getUploadSettings() {
  return apiFetch("/uploads/settings");
}

export async function updateCloudmersiveScanning(enabled) {
  return apiFetch("/uploads/settings/cloudmersive", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  });
}

export async function getManualReviewQueue() {
  return apiFetch("/uploads/review");
}

export async function reviewUpload(fileId, decision, note = "") {
  return apiFetch("/uploads/" + fileId + "/review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision, note }),
  });
}

export async function downloadManualReviewFile(fileId, filename = "game-upload") {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(API_URL + "/uploads/review/" + fileId + "/download", {
    headers: authHeaders,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Could not download review file");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function getGame(slug) {
  return apiFetch(`/games/${encodeURIComponent(slug)}`);
}
// Loads the logged-in account's permanent claim and review state.
export async function getReviewState(slug) {
  return apiFetch(
    `/games/${encodeURIComponent(slug)}/review-state`
  );
}
export async function getAwaitingReviewGames() {
  return apiFetch("/games/awaiting-review");
}

export async function claimGame(slug) {
  return apiFetch(`/games/${encodeURIComponent(slug)}/claim`, {
    method: "POST",
  });
}

export async function saveGameReview(slug, rating, body) {
  return apiFetch(`/games/${encodeURIComponent(slug)}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rating, body }),
  });
}

// Administrators can permanently remove a review.
export async function deleteGameReview(slug, reviewId) {
  return apiFetch(
    `/games/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}`,
    {
      method: "DELETE",
    }
  );
}

// The game creator can create or update one reply.
export async function saveCreatorReply(slug, reviewId, body) {
  return apiFetch(
    `/games/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}/reply`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );
}

// The original reviewer can create or update their follow-up.
export async function saveReviewerFollowUp(slug, reviewId, body) {
  return apiFetch(
    `/games/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(
      reviewId
    )}/reply/follow-up`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );
}

export function getGameFileUrl(fileId) {
  return `${API_URL}/uploads/files/${encodeURIComponent(fileId)}`;
}
/**
 * Gets the editable data for a project.
 * The backend checks that the authenticated user owns the game.
 */
export function getEditableProject(gameId) {
  return apiFetch(`/games/${encodeURIComponent(gameId)}/edit`);
}
/**
 * Saves genres, an optional new cover and new screenshots.
 *
 * FormData is needed because we are sending actual image files.
 */
export function saveProjectEdits(
  gameId,
  {
    genres,
    coverImage,
    screenshots,
    removedScreenshotIds,
  }
) {
  const formData = new FormData();

  formData.append("genres", JSON.stringify(genres));
  formData.append(
    "removedScreenshotIds",
    JSON.stringify(removedScreenshotIds)
  );

  if (coverImage) {
    formData.append("coverImage", coverImage);
  }

  screenshots.forEach((screenshot) => {
    formData.append("screenshots", screenshot);
  });

  return apiFetch(
    `/uploads/games/${encodeURIComponent(gameId)}`,
    {
      method: "PATCH",
      body: formData,
    }
  );
}
