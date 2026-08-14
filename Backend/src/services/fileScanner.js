const crypto = require("crypto");
const fs = require("fs");
const { basename } = require("path");

function scannerMode() {
  return String(process.env.SCANNER_MODE || "required").toLowerCase();
}

function envFlag(name, defaultValue) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

function summarizeViruses(foundViruses) {
  if (!Array.isArray(foundViruses) || foundViruses.length === 0) return "";

  return foundViruses
    .map((virus) => {
      const fileName = virus && virus.FileName ? virus.FileName : "unknown file";
      const virusName = virus && virus.VirusName ? virus.VirusName : "unknown threat";
      return `${fileName}: ${virusName}`;
    })
    .join("; ");
}

function summarizePolicyFlags(result) {
  const flagNames = [
    "ContainsExecutable",
    "ContainsInvalidFile",
    "ContainsScript",
    "ContainsPasswordProtectedFile",
    "ContainsRestrictedFileFormat",
    "ContainsMacros",
    "ContainsXmlExternalEntities",
    "ContainsInsecureDeserialization",
    "ContainsHtml",
    "ContainsUnsafeArchive",
    "ContainsOleEmbeddedObject",
    "ContainsUnwantedAction",
  ];

  return flagNames.filter((name) => result && result[name] === true);
}

function cloudmersiveHeaders(fileName) {
  return {
    Apikey: process.env.CLOUDMERSIVE_API_KEY,
    Accept: "application/json",
    fileName,
    allowExecutables: String(envFlag("CLOUDMERSIVE_ALLOW_EXECUTABLES", true)),
    allowInvalidFiles: String(envFlag("CLOUDMERSIVE_ALLOW_INVALID_FILES", false)),
    allowScripts: String(envFlag("CLOUDMERSIVE_ALLOW_SCRIPTS", true)),
    allowPasswordProtectedFiles: String(
      envFlag("CLOUDMERSIVE_ALLOW_PASSWORD_PROTECTED_FILES", false)
    ),
    allowMacros: String(envFlag("CLOUDMERSIVE_ALLOW_MACROS", false)),
    allowXmlExternalEntities: String(envFlag("CLOUDMERSIVE_ALLOW_XML_EXTERNAL_ENTITIES", false)),
    allowInsecureDeserialization: String(
      envFlag("CLOUDMERSIVE_ALLOW_INSECURE_DESERIALIZATION", false)
    ),
    allowHtml: String(envFlag("CLOUDMERSIVE_ALLOW_HTML", true)),
  };
}

async function scanWithCloudmersive(filePath, options = {}) {
  if (!process.env.CLOUDMERSIVE_API_KEY) {
    throw new Error("CLOUDMERSIVE_API_KEY is required for upload malware scanning.");
  }

  const endpoint =
    process.env.CLOUDMERSIVE_SCAN_ENDPOINT ||
    "https://api.cloudmersive.com/virus/scan/file/advanced";
  const fileName = options.fileName || basename(filePath);
  const form = new FormData();
  const fileBlob = await fs.openAsBlob(filePath, { type: "application/octet-stream" });
  form.append("inputFile", fileBlob, fileName);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: cloudmersiveHeaders(fileName),
    body: form,
  });

  const rawBody = await response.text();
  let result = null;

  try {
    result = rawBody ? JSON.parse(rawBody) : null;
  } catch (_error) {
    result = null;
  }

  if (!response.ok) {
    const detail = result && (result.Message || result.ErrorDetailedDescription || result.title);
    throw new Error(
      `Cloudmersive scan failed with HTTP ${response.status}: ${detail || rawBody || response.statusText}`
    );
  }

  if (!result || typeof result.CleanResult !== "boolean") {
    throw new Error("Cloudmersive returned an unexpected scan response.");
  }

  if (result.Successful === false) {
    throw new Error(
      `Cloudmersive could not scan the upload: ${result.ErrorDetailedDescription || rawBody}`
    );
  }

  const viruses = summarizeViruses(result.FoundViruses);
  if (viruses) {
    return {
      status: "REJECTED",
      output: `Cloudmersive detected malware. ${viruses}`,
      raw: result,
    };
  }

  if (result.CleanResult === false) {
    const flags = summarizePolicyFlags(result);
    const policyStatus = String(
      process.env.CLOUDMERSIVE_POLICY_FAIL_STATUS || "MANUAL_REVIEW"
    ).toUpperCase();

    return {
      status: policyStatus === "REJECTED" ? "REJECTED" : "MANUAL_REVIEW",
      output:
        `Cloudmersive marked the upload as not clean.` +
        (flags.length ? ` Policy flags: ${flags.join(", ")}.` : ""),
      raw: result,
    };
  }

  return {
    status: "APPROVED",
    output: "Cloudmersive scan clean.",
    raw: result,
  };
}

async function scanFile(filePath, options = {}) {
  const sha256 = await hashFile(filePath);

  if (scannerMode() === "mock") {
    return {
      status: "APPROVED",
      sha256,
      output: "Mock scanner enabled; use only for local UI testing.",
    };
  }

  const result = await scanWithCloudmersive(filePath, options);

  return {
    status: result.status,
    sha256,
    output: [result.output, `SHA-256: ${sha256}`].join("\n"),
  };
}

module.exports = { scanFile };
