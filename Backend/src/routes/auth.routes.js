const express = require("express");
const { requireSupabaseConfig, supabase, supabaseAdmin } = require("../db");
const createRateLimit = require("../middleware/rateLimit");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many login attempts. Please try again in 15 minutes.",
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `login:${req.ip}:${email}`;
  },
});

const signupRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many signup attempts. Please try again later.",
  keyGenerator: (req) => `signup:${req.ip}`,
});

function normalizeUsername(username) {
  return String(username || "").trim();
}

function isValidUsername(username) {
  return usernamePattern.test(username);
}

function normalizeLoginIdentifier(identifier) {
  return String(identifier || "").trim();
}

function isEmailIdentifier(identifier) {
  return identifier.includes("@");
}


const profileSelect =
  "id, username, email, display_name, bio, avatar_url, role, is_banned, created_at, updated_at";

const allowedAvatarTypes = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseAvatarData(avatarData) {
  if (!avatarData) {
    return null;
  }

  const match = String(avatarData).match(
    /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/
  );

  if (!match) {
    throw new Error("Invalid avatar image.");
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("Avatar must be smaller than 2MB.");
  }

  return {
    buffer,
    mimeType,
    extension: allowedAvatarTypes[mimeType],
  };
}

async function uploadAvatar(userId, avatarData) {
  const parsedAvatar = parseAvatarData(avatarData);

  if (!parsedAvatar) {
    return null;
  }

  const filePath =
    userId + "/" + Date.now() + "." + parsedAvatar.extension;

  const { error } = await supabaseAdmin.storage
    .from("avatars")
    .upload(filePath, parsedAvatar.buffer, {
      contentType: parsedAvatar.mimeType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabaseAdmin.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function resolveLoginEmail(identifier) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);

  if (isEmailIdentifier(normalizedIdentifier)) {
    return normalizedIdentifier.toLowerCase();
  }

  if (!isValidUsername(normalizedIdentifier)) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("username", normalizedIdentifier)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.email || null;
}

async function upsertUserProfile(authUser, username) {
  if (!authUser?.id || !authUser?.email) {
    return null;
  }

  const normalizedUsername =
    normalizeUsername(username) ||
    authUser.user_metadata?.username?.trim() ||
    authUser.email.split("@")[0];

  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email: authUser.email,
        username: normalizedUsername,
      },
      { onConflict: "id" }
    )
    .select(profileSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

router.post("/signup", signupRateLimit, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { email, password, username } = req.body;
  const normalizedUsername = normalizeUsername(username);

  if (!isValidUsername(normalizedUsername)) {
    return res.status(400).json({
      error: "Username must be 3-24 characters and use only letters, numbers, or underscores.",
    });
  }
  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existingProfileError) {
    return res.status(500).json({ error: existingProfileError.message });
  }

  if (existingProfile) {
    return res.status(409).json({ error: "Username is already taken." });
  }

  // Supabase creeaza userul in Auth si trimite emailul de confirmare.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: normalizedUsername,
      },
      // Dupa confirmare, userul este trimis inapoi in frontend.
      emailRedirectTo: frontendUrl,
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  let profile = null;

  try {
    profile = await upsertUserProfile(data.user, normalizedUsername);
  } catch (profileError) {
    if (profileError.code === "23505") {
      return res.status(409).json({ error: "Username or email is already taken." });
    }

    return res.status(400).json({ error: profileError.message });
  }

  res.status(201).json({
    user: data.user,
    profile,
    session: data.session,
    needsEmailConfirmation: !data.session,
  });
});

router.post("/login", loginRateLimit, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { email, password } = req.body;
  let loginEmail = null;

  try {
    loginEmail = await resolveLoginEmail(email);
  } catch (identifierError) {
    return res.status(500).json({ error: identifierError.message });
  }

  if (!loginEmail) {
    return res.status(401).json({ error: "Invalid login credentials" });
  }

  // Backendul verifica email/parola prin Supabase.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password,
  });

  if (error) {
    return res.status(401).json({ error: "Invalid login credentials" });
  }

  let profile = null;

  try {
    profile = await upsertUserProfile(data.user);
  } catch (profileError) {
    return res.status(400).json({ error: profileError.message });
  }

  if (profile?.is_banned) {
    return res.status(403).json({
      code: "USER_BANNED",
      error: "This account has been banned."
    });
  }
  // Frontendul va salva access_token si il va trimite ca Bearer token.
  res.json({
    user: data.user,
    profile,
    session: data.session,
  });
});


router.patch("/profile", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const {
    username,
    displayName,
    bio,
    avatarData,
    removeAvatar = false,
  } = req.body;

  const updates = {};

  if (username !== undefined) {
    const normalizedUsername = normalizeUsername(username);

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        error: "Username must be 3-24 characters and use only letters, numbers, or underscores.",
      });
    }

    const { data: existingUser, error: existingUserError } =
      await supabaseAdmin
        .from("users")
        .select("id")
        .eq("username", normalizedUsername)
        .neq("id", req.user.id)
        .maybeSingle();

    if (existingUserError) {
      return res.status(500).json({ error: existingUserError.message });
    }

    if (existingUser) {
      return res.status(409).json({
        error: "Username is already taken.",
      });
    }

    updates.username = normalizedUsername;
  }

  if (displayName !== undefined) {
    updates.display_name = String(displayName).trim().slice(0, 60);
  }

  if (bio !== undefined) {
    updates.bio = String(bio).trim().slice(0, 280);
  }

  if (removeAvatar) {
    updates.avatar_url = null;
  }

  if (avatarData) {
    try {
      updates.avatar_url = await uploadAvatar(req.user.id, avatarData);
    } catch (error) {
      return res.status(400).json({
        error: error.message || "Avatar upload failed.",
      });
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: "No profile changes were provided.",
    });
  }

  const { data: profile, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", req.user.id)
    .select(profileSelect)
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      profile,
    },
    profile,
  });
});

router.post("/logout", (req, res) => {
  // Fara cookies, logout-ul real este stergerea tokenului din frontend.
  res.json({ ok: true });
});

module.exports = router;
