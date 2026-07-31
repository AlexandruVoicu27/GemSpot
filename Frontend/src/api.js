const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function getGames() {
  const response = await fetch(`${API_URL}/games`);

  if (!response.ok) {
    throw new Error("Failed to load games");
  }

  return response.json();
}