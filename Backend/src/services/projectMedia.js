const crypto = require("crypto");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const multer = require("multer");
const { supabaseAdmin } = require("../db");

const mediaTempDir = path.resolve(
  process.env.QUARANTINE_DIR || path.join(__dirname, "../../quarantine")
);
const coverStorageBucket = process.env.GAME_COVERS_BUCKET || "Game Covers";
const maxImageSize = 5 * 1024 * 1024;
const maxScreenshots = 6;
const maxGenres = 4;

const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const allowedGenres = new Set([
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
]);

fs.mkdirSync(mediaTempDir, { recursive: true });

function safeImageName(fileName) {
  const cleaned = path
    .basename(String(fileName || "game-image"))
    .replace(/[^a-zA-Z0-9._-]/g, "-");

  return cleaned.slice(-120) || "game-image";
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const mediaDiskStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, mediaTempDir),
  filename: (_req, file, callback) => {
    callback(null, crypto.randomUUID() + "-" + safeImageName(file.originalname));
  },
});

const projectMediaUpload = multer({
  storage: mediaDiskStorage,
  limits: {
    fileSize: maxImageSize,
    files: maxScreenshots + 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!["coverImage", "screenshots"].includes(file.fieldname)) {
      return callback(new Error("Unsupported project media field."));
    }

    if (!allowedImageTypes.has(file.mimetype)) {
      return callback(new Error("Images must be PNG, JPG, or WebP."));
    }

    callback(null, true);
  },
});

function getRequestFiles(req) {
  return [
    ...(req.files?.coverImage || []),
    ...(req.files?.screenshots || []),
  ];
}

async function cleanupTemporaryFiles(files) {
  await Promise.all(
    (files || []).map((file) => fsp.unlink(file.path).catch(() => {}))
  );
}

function projectMediaError(error) {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return "Each image must be smaller than 5MB.";
  }

  if (
    error?.code === "LIMIT_FILE_COUNT" ||
    error?.code === "LIMIT_UNEXPECTED_FILE"
  ) {
    return "Upload one cover and no more than 6 screenshots.";
  }

  return error?.message || "Project media upload failed.";
}

function receiveProjectMedia(req, res, next) {
  projectMediaUpload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "screenshots", maxCount: maxScreenshots },
  ])(req, res, async (error) => {
    if (error) {
      await cleanupTemporaryFiles(getRequestFiles(req));
      return res.status(400).json({ error: projectMediaError(error) });
    }

    next();
  });
}

function parseJsonArray(value, fieldName) {
  let parsed;

  try {
    parsed = JSON.parse(value || "[]");
  } catch (_error) {
    throw httpError(400, `${fieldName} must be a valid array.`);
  }

  if (!Array.isArray(parsed)) {
    throw httpError(400, `${fieldName} must be an array.`);
  }

  return parsed;
}

function parseGenres(value) {
  const requestedGenres = parseJsonArray(value, "genres");

  if (requestedGenres.length > maxGenres) {
    throw httpError(400, `Choose no more than ${maxGenres} genres.`);
  }

  const uniqueGenres = [];

  for (const value of requestedGenres) {
    const genre = String(value || "").trim();

    if (!allowedGenres.has(genre)) {
      throw httpError(400, `Unsupported genre: ${genre || "empty value"}.`);
    }

    if (!uniqueGenres.includes(genre)) {
      uniqueGenres.push(genre);
    }
  }

  return uniqueGenres;
}

function parseRemovedScreenshotIds(value) {
  return [
    ...new Set(
      parseJsonArray(value, "removedScreenshotIds")
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];
}

async function hasValidImageSignature(file) {
  const handle = await fsp.open(file.path, "r");

  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);

    if (file.mimetype === "image/png") {
      return (
        bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
      );
    }

    if (file.mimetype === "image/jpeg") {
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    }

    if (file.mimetype === "image/webp") {
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
    }

    return false;
  } finally {
    await handle.close();
  }
}

async function validateImageFiles(files) {
  for (const file of files) {
    if (!(await hasValidImageSignature(file))) {
      throw httpError(
        400,
        `${safeImageName(file.originalname)} is not a valid PNG, JPG, or WebP image.`
      );
    }
  }
}

function imageExtension(mimetype) {
  if (mimetype === "image/png") return "png";
  if (mimetype === "image/webp") return "webp";
  return "jpg";
}

async function uploadProjectImage(file, gameId, directory) {
  const storagePath =
    `${gameId}/${directory}/${crypto.randomUUID()}.` +
    imageExtension(file.mimetype);
  const imageBuffer = await fsp.readFile(file.path);

  const uploadResult = await supabaseAdmin.storage
    .from(coverStorageBucket)
    .upload(storagePath, imageBuffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const publicUrlResult = supabaseAdmin.storage
    .from(coverStorageBucket)
    .getPublicUrl(storagePath);

  return {
    file,
    storagePath,
    publicUrl: publicUrlResult.data.publicUrl,
  };
}

async function removeStoredImages(storagePaths) {
  const paths = [...new Set((storagePaths || []).filter(Boolean))];
  if (paths.length === 0) return;

  const result = await supabaseAdmin.storage
    .from(coverStorageBucket)
    .remove(paths);

  if (result.error) {
    console.warn("Could not remove old project media:", result.error.message);
  }
}

async function rollbackNewMedia({ game, insertedFileIds, uploadedAssets, gameUpdated }) {
  if (gameUpdated) {
    try {
      await supabaseAdmin
        .from("games")
        .update({
          genre: game.genre,
          cover_image_url: game.cover_image_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", game.id)
        .eq("creator_id", game.creator_id);
    } catch (_error) {
      // Preserve the original save error; rollback is best effort.
    }
  }

  if (insertedFileIds.length > 0) {
    try {
      await supabaseAdmin
        .from("game_files")
        .delete()
        .in("id", insertedFileIds);
    } catch (_error) {
      // Preserve the original save error; rollback is best effort.
    }
  }

  await removeStoredImages(uploadedAssets.map((asset) => asset.storagePath));
}

async function saveProjectMedia(req, res) {
  const temporaryFiles = getRequestFiles(req);
  const coverFile = req.files?.coverImage?.[0] || null;
  const screenshotFiles = req.files?.screenshots || [];
  const uploadedAssets = [];
  const insertedFileIds = [];
  let ownedGame = null;
  let gameUpdated = false;

  try {
    const genres = parseGenres(req.body.genres);
    const removedScreenshotIds = parseRemovedScreenshotIds(
      req.body.removedScreenshotIds
    );

    const gameResult = await supabaseAdmin
      .from("games")
      .select(`
        id,
        creator_id,
        title,
        slug,
        description,
        genre,
        status,
        cover_image_url,
        files:game_files(id, kind, file_name, url, storage_path, size_bytes)
      `)
      .eq("id", req.params.gameId)
      .eq("creator_id", req.user.id)
      .maybeSingle();

    if (gameResult.error) throw gameResult.error;
    if (!gameResult.data) {
      throw httpError(404, "Project not found or you do not own this project.");
    }

    ownedGame = gameResult.data;

    if (ownedGame.status === "ARCHIVED") {
      throw httpError(400, "Archived projects cannot be edited.");
    }

    const existingFiles = ownedGame.files || [];
    const existingScreenshots = existingFiles.filter(
      (file) => file.kind === "SCREENSHOT"
    );
    const existingCovers = existingFiles.filter(
      (file) => file.kind === "COVER_IMAGE"
    );
    const screenshotById = new Map(
      existingScreenshots.map((file) => [file.id, file])
    );

    const invalidRemovedId = removedScreenshotIds.find(
      (id) => !screenshotById.has(id)
    );

    if (invalidRemovedId) {
      throw httpError(400, "One of the selected screenshots does not belong to this game.");
    }

    const removedScreenshots = removedScreenshotIds.map((id) =>
      screenshotById.get(id)
    );
    const resultingScreenshotCount =
      existingScreenshots.length -
      removedScreenshots.length +
      screenshotFiles.length;

    if (resultingScreenshotCount > maxScreenshots) {
      throw httpError(400, `A game can have no more than ${maxScreenshots} screenshots.`);
    }

    await validateImageFiles(temporaryFiles);

    let newCoverAsset = null;

    if (coverFile) {
      newCoverAsset = await uploadProjectImage(coverFile, ownedGame.id, "covers");
      uploadedAssets.push(newCoverAsset);
    }

    const newScreenshotAssets = [];

    for (const screenshotFile of screenshotFiles) {
      const asset = await uploadProjectImage(
        screenshotFile,
        ownedGame.id,
        "screenshots"
      );
      newScreenshotAssets.push(asset);
      uploadedAssets.push(asset);
    }

    const now = new Date().toISOString();
    const newFileRows = [
      ...(newCoverAsset
        ? [
            {
              game_id: ownedGame.id,
              kind: "COVER_IMAGE",
              file_name: newCoverAsset.file.originalname,
              url: newCoverAsset.publicUrl,
              storage_path: newCoverAsset.storagePath,
              size_bytes: newCoverAsset.file.size,
              scan_status: "APPROVED",
              scanned_at: now,
            },
          ]
        : []),
      ...newScreenshotAssets.map((asset) => ({
        game_id: ownedGame.id,
        kind: "SCREENSHOT",
        file_name: asset.file.originalname,
        url: asset.publicUrl,
        storage_path: asset.storagePath,
        size_bytes: asset.file.size,
        scan_status: "APPROVED",
        scanned_at: now,
      })),
    ];

    if (newFileRows.length > 0) {
      const insertResult = await supabaseAdmin
        .from("game_files")
        .insert(newFileRows)
        .select("id");

      if (insertResult.error) throw insertResult.error;
      insertedFileIds.push(...(insertResult.data || []).map((file) => file.id));
    }

    const gameUpdates = {
      genre: genres.join(", ") || null,
      updated_at: now,
    };

    if (newCoverAsset) {
      gameUpdates.cover_image_url = newCoverAsset.publicUrl;
    }

    const updateResult = await supabaseAdmin
      .from("games")
      .update(gameUpdates)
      .eq("id", ownedGame.id)
      .eq("creator_id", req.user.id)
      .select("id")
      .single();

    if (updateResult.error) throw updateResult.error;
    gameUpdated = true;

    const rowsToDelete = [
      ...removedScreenshots,
      ...(newCoverAsset ? existingCovers : []),
    ];

    if (rowsToDelete.length > 0) {
      const deleteResult = await supabaseAdmin
        .from("game_files")
        .delete()
        .eq("game_id", ownedGame.id)
        .in(
          "id",
          rowsToDelete.map((file) => file.id)
        );

      if (deleteResult.error) throw deleteResult.error;

      await removeStoredImages(rowsToDelete.map((file) => file.storage_path));
    }

    const refreshedResult = await supabaseAdmin
      .from("games")
      .select(`
        id,
        title,
        slug,
        description,
        genre,
        status,
        cover_image_url,
        files:game_files(id, kind, file_name, url, storage_path, size_bytes, created_at)
      `)
      .eq("id", ownedGame.id)
      .single();

    const refreshed = refreshedResult.data;

    return res.json({
      message: "Project media updated.",
      project: refreshed
        ? {
            id: refreshed.id,
            title: refreshed.title,
            slug: refreshed.slug,
            description: refreshed.description,
            status: refreshed.status,
            coverImageUrl: refreshed.cover_image_url,
            genres: String(refreshed.genre || "")
              .split(",")
              .map((genre) => genre.trim())
              .filter(Boolean),
            screenshots: (refreshed.files || []).filter(
              (file) => file.kind === "SCREENSHOT"
            ),
          }
        : null,
    });
  } catch (error) {
    if (ownedGame) {
      await rollbackNewMedia({
        game: ownedGame,
        insertedFileIds,
        uploadedAssets,
        gameUpdated,
      });
    } else {
      await removeStoredImages(uploadedAssets.map((asset) => asset.storagePath));
    }

    if (!error.status || error.status >= 500) {
      console.error("Could not save project media:", error);
    }

    return res.status(error.status || 500).json({
      error:
        error.status && error.status < 500
          ? error.message
          : "Could not save project changes.",
    });
  } finally {
    await cleanupTemporaryFiles(temporaryFiles);
  }
}

module.exports = {
  receiveProjectMedia,
  saveProjectMedia,
};
