#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const manifestPath = path.join(process.cwd(), ".next", "build-manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.warn(
    "[postbuild] build-manifest.json not found at",
    manifestPath,
    "- skipping CSS scrub",
  );
  process.exit(0);
}

const stripCssEntries = (value) => {
  if (Array.isArray(value)) {
    return value.filter(
      (entry) => !(typeof entry === "string" && entry.trim().endsWith(".css")),
    );
  }
  if (value && typeof value === "object") {
    Object.keys(value).forEach((key) => {
      value[key] = stripCssEntries(value[key]);
    });
  }
  return value;
};

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.rootMainFiles) {
    manifest.rootMainFiles = stripCssEntries(manifest.rootMainFiles);
  }
  if (manifest.rootMainFilesTree) {
    manifest.rootMainFilesTree = stripCssEntries(manifest.rootMainFilesTree);
  }
  if (manifest.pages && typeof manifest.pages === "object") {
    Object.keys(manifest.pages).forEach((page) => {
      manifest.pages[page] = stripCssEntries(manifest.pages[page]);
    });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log("[postbuild] stripped CSS entries from build-manifest");
} catch (err) {
  console.error("[postbuild] failed to scrub build-manifest", err);
  process.exit(1);
}
