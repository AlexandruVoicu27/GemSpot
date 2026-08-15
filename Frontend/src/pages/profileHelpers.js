// Returns the most useful public display name for an account.
export function getDisplayName(accountLabel, user, profile) {
  return (
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    profile?.username ||
    user?.user_metadata?.username ||
    accountLabel
  );
}

// Returns the avatar URL provided by the profile or auth metadata.
export function getAvatarUrl(user, profile) {
  return profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.avatarUrl || "";
}

// Builds two-letter initials for accounts without an avatar.
export function getInitials(value) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}