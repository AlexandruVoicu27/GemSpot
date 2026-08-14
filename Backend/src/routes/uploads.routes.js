const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const multer = require("multer");
const { supabaseAdmin, requireSupabaseConfig } = require("../db");
const requireAuth = require("../middleware/requireAuth");
const { scanFile } = require("../services/fileScanner");

const router = express.Router();
const quarantineDir = path.resolve(
  process.env.QUARANTINE_DIR || path.join(__dirname, "../../quarantine")
);
const storageBucket = process.env.GAME_STORAGE_BUCKET || "game-builds";
const maxFileSize = Number(process.env.MAX_GAME_SIZE_BYTES || 250 * 1024 * 1024);
const allowedExtensions = new Set([".zip", ".7z", ".rar", ".tar", ".gz", ".tgz"]);

fs.mkdirSync(quarantineDir, { recursive: true });

function safeFileName(fileName) {
  const cleaned = path
    .basename(String(fileName || "game-build"))
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned.slice(-120) || "game-build";
}

function isModerator(user) {
  return ["ADMIN", "MODERATOR"].includes(user && user.profile && user.profile.role);
}

const cloudScanSettingKey = "cloudmersive_scanning_enabled";

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }

  return defaultValue;
}

function defaultCloudScanEnabled() {
  return parseBoolean(process.env.CLOUDMERSIVE_SCANNING_ENABLED, true);
}

function isMissingSettingsTable(error) {
  return Boolean(
    error &&
      (error.code === "42P01" || String(error.message || "").includes("app_settings"))
  );
}

async function getCloudScanSettings() {
  const fallback = defaultCloudScanEnabled();
  const result = await supabaseAdmin
    .from("app_settings")
    .select("value, updated_by, updated_at")
    .eq("key", cloudScanSettingKey)
    .maybeSingle();

  if (result.error) {
    if (isMissingSettingsTable(result.error)) {
      return {
        cloudScanEnabled: fallback,
        source: "env-fallback",
        missingSettingsTable: true,
      };
    }

    throw result.error;
  }

  if (!result.data) {
    return {
      cloudScanEnabled: fallback,
      source: "env-default",
      missingSettingsTable: false,
    };
  }

  return {
    cloudScanEnabled: parseBoolean(result.data.value, fallback),
    source: "database",
    updatedBy: result.data.updated_by || null,
    updatedAt: result.data.updated_at || null,
    missingSettingsTable: false,
  };
}

async function setCloudScanEnabled(enabled, adminUser) {
  const result = await supabaseAdmin
    .from("app_settings")
    .upsert(
      {
        key: cloudScanSettingKey,
        value: enabled,
        updated_by: adminUser.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("value, updated_by, updated_at")
    .single();

  if (result.error) throw result.error;

  return {
    cloudScanEnabled: parseBoolean(result.data.value, enabled),
    source: "database",
    updatedBy: result.data.updated_by || null,
    updatedAt: result.data.updated_at || null,
  };
}

function requireModerator(req, res, next) {
  if (!isModerator(req.user)) {
    return res.status(403).json({ error: "Moderator access required." });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.profile || req.user.profile.role !== "ADMIN") {
    return res.status(403).json({ error: "Administrator access required." });
  }

  next();
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, quarantineDir),
  filename: (_req, file, callback) => {
    callback(null, crypto.randomUUID() + "-" + safeFileName(file.originalname));
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: maxFileSize },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return callback(new Error("Upload a game archive: .zip, .7z, .rar, .tar, .gz, or .tgz."));
    }

    callback(null, true);
  },
});

function parseUploadError(error) {
  if (error && error.code === "LIMIT_FILE_SIZE") {
    return "Game archive must be smaller than " + Math.round(maxFileSize / 1024 / 1024) + "MB.";
  }

  return (error && error.message) || "Game upload failed.";
}

function slugify(value) {
  return String(value || "game")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "game";
}

async function uniqueSlug(title) {
  const base = slugify(title);

  for (let suffix = 0; suffix < 20; suffix += 1) {
    const slug = suffix === 0 ? base : base + "-" + (suffix + 1);
    const result = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) return slug;
  }

  return base + "-" + crypto.randomUUID().slice(0, 8);
}

async function hashUploadFile(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function updateFile(fileId, updates) {
  const result = await supabaseAdmin
    .from("game_files")
    .update(updates)
    .eq("id", fileId)
    .select("*")
    .single();

  if (result.error) throw result.error;
  return result.data;
}

async function releaseApprovedFile(fileRecord) {
  const fileBuffer = await fsp.readFile(fileRecord.quarantine_path);
  const storagePath =
    fileRecord.game_id + "/" + crypto.randomUUID() + "-" + safeFileName(fileRecord.file_name);

  const result = await supabaseAdmin.storage.from(storageBucket).upload(storagePath, fileBuffer, {
    contentType: "application/octet-stream",
    upsert: false,
  });

  if (result.error) throw result.error;

  await updateFile(fileRecord.id, {
    url: "/api/uploads/files/" + fileRecord.id,
    storage_path: storagePath,
    quarantine_path: null,
    scan_status: "APPROVED",
    scanned_at: new Date().toISOString(),
  });

  await fsp.unlink(fileRecord.quarantine_path).catch(() => {});
}

async function queueForManualReview(fileRecord, reason) {
  if (!fileRecord || !fileRecord.quarantine_path) return;

  try {
    const sha256 = await hashUploadFile(fileRecord.quarantine_path);

    await updateFile(fileRecord.id, {
      scan_status: "MANUAL_REVIEW",
      sha256,
      scanner_output: [reason, "SHA-256: " + sha256].filter(Boolean).join("\n"),
      scanned_at: new Date().toISOString(),
    });
  } catch (error) {
    await updateFile(fileRecord.id, {
      scan_status: "SCAN_ERROR",
      scanner_output: String(error.message || error).slice(0, 12000),
      scanned_at: new Date().toISOString(),
    }).catch(() => {});
  }
}

async function processUpload(fileRecord) {
  if (!fileRecord || !fileRecord.quarantine_path) return;

  try {
    await updateFile(fileRecord.id, { scan_status: "SCANNING" });
    const result = await scanFile(fileRecord.quarantine_path, { fileName: fileRecord.file_name });

    await updateFile(fileRecord.id, {
      scan_status: result.status,
      sha256: result.sha256,
      scanner_output: String(result.output || "").slice(0, 12000),
      scanned_at: new Date().toISOString(),
    });

    if (result.status === "APPROVED") {
      const refreshed = await supabaseAdmin
        .from("game_files")
        .select("*")
        .eq("id", fileRecord.id)
        .single();

      if (refreshed.error) throw refreshed.error;
      await releaseApprovedFile(refreshed.data);
    }
  } catch (error) {
    await updateFile(fileRecord.id, {
      scan_status: "SCAN_ERROR",
      scanner_output: String(error.message || error).slice(0, 12000),
      scanned_at: new Date().toISOString(),
    }).catch(() => {});
  }
}


async function processUploadByCurrentSettings(fileRecord) {
  const scanSettings = await getCloudScanSettings();

  if (scanSettings.cloudScanEnabled) {
    await processUpload(fileRecord);
    return scanSettings;
  }

  await queueForManualReview(
    fileRecord,
    "Cloudmersive scanning is disabled by an administrator; queued for manual review."
  );
  return scanSettings;
}
async function createUpload(req, res) {

  if (!requireSupabaseConfig(res)) return;

  if (!req.file) {
    return res.status(400).json({ error: "Choose a game archive to upload." });
  }

  const title = String(req.body.title || "").trim().slice(0, 120);
  const description = String(req.body.description || "").trim().slice(0, 4000);
  const genre = String(req.body.genre || "").trim().slice(0, 60);

  if (title.length < 2 || description.length < 10) {
    await fsp.unlink(req.file.path).catch(() => {});
    return res.status(400).json({
      error: "Add a title and a description of at least 10 characters.",
    });
  }


  try {
    const slug = await uniqueSlug(title);
    const gameResult = await supabaseAdmin
      .from("games")
      .insert({
        creator_id: req.user.id,
        title,
        slug,
        description,
        genre: genre || null,
        status: "DRAFT",
      })
      .select("id, title, slug, status, created_at")
      .single();

    if (gameResult.error) throw gameResult.error;

    const fileResult = await supabaseAdmin
      .from("game_files")
      .insert({
        game_id: gameResult.data.id,
        kind: "GAME_BUILD",
        file_name: req.file.originalname,
        url: "",
        size_bytes: req.file.size,
        quarantine_path: req.file.path,
        scan_status: "PENDING",
      })
      .select("id, game_id, file_name, size_bytes, scan_status, created_at")
      .single();

    if (fileResult.error) throw fileResult.error;

    const queuedFile = {
      ...fileResult.data,
      quarantine_path: req.file.path,
      game_id: gameResult.data.id,
      file_name: req.file.originalname,
    };

    const scanSettings = await getCloudScanSettings();

    setImmediate(() => processUploadByCurrentSettings(queuedFile));

    return res.status(202).json({
      game: gameResult.data,
      file: fileResult.data,
      scanSettings,
      message: scanSettings.cloudScanEnabled
        ? "Upload received. GemSpot is scanning it before release."
        : "Upload received. Cloudmersive scanning is off, so it is queued for manual review.",
    });
  } catch (error) {
    await fsp.unlink(req.file.path).catch(() => {});
    return res.status(500).json({
      error: error.message || "Could not create the upload.",
    });
  }
}

router.post(
  "/games",
  requireAuth,
  (req, res, next) => {
    upload.single("gameFile")(req, res, (error) => {
      if (error) return res.status(400).json({ error: parseUploadError(error) });
      next();
    });
  },
  createUpload
);


router.get("/settings", requireAuth, requireModerator, async (_req, res) => {
  if (!requireSupabaseConfig(res)) return;

  try {
    const settings = await getCloudScanSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not load upload settings." });
  }
});

router.patch("/settings/cloudmersive", requireAuth, requireAdmin, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  if (!req.body || req.body.enabled == null) {
    return res.status(400).json({ error: "enabled is required." });
  }

  try {
    const settings = await setCloudScanEnabled(parseBoolean(req.body.enabled, false), req.user);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not update Cloudmersive scanning." });
  }
});

router.get("/review/:fileId/download", requireAuth, requireModerator, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const result = await supabaseAdmin
    .from("game_files")
    .select("id, file_name, quarantine_path, scan_status, game:games(id, title, slug)")
    .eq("id", req.params.fileId)
    .maybeSingle();

  if (result.error) return res.status(500).json({ error: result.error.message });
  if (!result.data) return res.status(404).json({ error: "Upload not found." });
  if (result.data.scan_status !== "MANUAL_REVIEW") {
    return res.status(400).json({ error: "Only manual-review uploads can be downloaded from quarantine." });
  }
  if (!result.data.quarantine_path) {
    return res.status(404).json({ error: "Quarantine file is not available." });
  }

  const resolvedPath = path.resolve(result.data.quarantine_path);
  if (!resolvedPath.startsWith(quarantineDir + path.sep)) {
    return res.status(500).json({ error: "Quarantine path is invalid." });
  }

  try {
    await fsp.access(resolvedPath, fs.constants.R_OK);
    res.download(resolvedPath, safeFileName(result.data.file_name));
  } catch (_error) {
    res.status(404).json({ error: "Quarantine file is missing." });
  }
});
router.get("/review", requireAuth, requireModerator, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const result = await supabaseAdmin
    .from("game_files")
    .select(
      "id, game_id, file_name, size_bytes, scan_status, sha256, scanner_output, created_at, scanned_at, game:games(id, title, slug, creator_id)"
    )
    .eq("scan_status", "MANUAL_REVIEW")
    .order("created_at", { ascending: true });

  if (result.error) return res.status(500).json({ error: result.error.message });
  res.json(result.data || []);
});

router.get("/files/:fileId", async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const result = await supabaseAdmin
    .from("game_files")
    .select("id, storage_path, scan_status, game:games(status)")
    .eq("id", req.params.fileId)
    .maybeSingle();

  if (result.error) return res.status(500).json({ error: result.error.message });
  if (
    !result.data ||
    result.data.scan_status !== "APPROVED" ||
    !result.data.game ||
    result.data.game.status !== "PUBLISHED"
  ) {
    return res.status(404).json({ error: "File not available." });
  }

  const signed = await supabaseAdmin.storage
    .from(storageBucket)
    .createSignedUrl(result.data.storage_path, 60);

  if (signed.error) return res.status(500).json({ error: signed.error.message });
  res.redirect(signed.data.signedUrl);
});

router.get("/:fileId", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const result = await supabaseAdmin
    .from("game_files")
    .select(
      "id, game_id, file_name, size_bytes, scan_status, sha256, scanner_output, created_at, scanned_at, game:games(creator_id, title, slug)"
    )
    .eq("id", req.params.fileId)
    .maybeSingle();

  if (result.error) return res.status(500).json({ error: result.error.message });
  if (!result.data) return res.status(404).json({ error: "Upload not found." });

  const owner =
    result.data.game && result.data.game.creator_id === req.user.id;

  if (!owner && !isModerator(req.user)) {
    return res.status(403).json({ error: "Not allowed." });
  }

  res.json(result.data);
});

router.post("/:fileId/review", requireAuth, requireModerator, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const decision = String(req.body && req.body.decision || "").toLowerCase();
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be approve or reject." });
  }

  const result = await supabaseAdmin
    .from("game_files")
    .select("*")
    .eq("id", req.params.fileId)
    .maybeSingle();

  if (result.error) return res.status(500).json({ error: result.error.message });
  if (!result.data) return res.status(404).json({ error: "Upload not found." });

  try {
    if (decision === "approve") {
      await releaseApprovedFile(result.data);
    } else {
      await updateFile(result.data.id, {
        scan_status: "REJECTED",
        review_note: String(req.body && req.body.note || "Rejected during manual review").slice(0, 2000),
        scanned_at: new Date().toISOString(),
      });
    }

    const updated = await supabaseAdmin
      .from("game_files")
      .select("*")
      .eq("id", result.data.id)
      .single();

    res.json(updated.data);
  } catch (reviewError) {
    res.status(500).json({ error: reviewError.message || "Could not finish review." });
  }
});

async function resumePendingUploads() {
  if (!supabaseAdmin) return;

  const result = await supabaseAdmin
    .from("game_files")
    .select("*")
    .in("scan_status", ["PENDING", "SCANNING"])
    .not("quarantine_path", "is", null);

  if (result.error) {
    console.error("Could not resume pending uploads:", result.error.message);
    return;
  }

  for (const file of result.data || []) {
    setImmediate(() => processUploadByCurrentSettings(file));
  }
}

router.processUpload = processUpload;
router.resumePendingUploads = resumePendingUploads;

module.exports = router;
