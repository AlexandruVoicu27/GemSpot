// The genres creators are allowed to select.
// The backend must also validate against this list.
export const GAME_GENRES = [
  "Action",
  "Adventure",
  "Puzzle",
  "Horror",
  "Platformer",
  "RPG",
  "Strategy",
  "Simulation",
  "Sports",
  "Shooter",
  "Visual Novel",
];

// Upload and edit forms enforce the same selection limit.
export const MAX_GAME_GENRES = 4;

export function parseGenres(value = "") {
  return value
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}