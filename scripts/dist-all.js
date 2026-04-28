#!/usr/bin/env node

const platform = process.platform;

const platformNames = {
  linux: "Linux",
  win32: "Windows",
  darwin: "macOS",
};

const localCommandByPlatform = {
  linux: "npm run dist:linux",
  win32: "npm run dist:win",
  darwin: "npm run dist:mac",
};

const currentPlatformName = platformNames[platform] ?? platform;
const localCommand = localCommandByPlatform[platform] ?? "npm run dist";

console.error(
  [
    "Local all-platform packaging is not supported from a single machine in this project.",
    `${currentPlatformName} can build its native target locally with: ${localCommand}`,
    "To build Windows + macOS + Linux together, use the GitHub Actions workflows on native runners.",
    "For a published multi-platform release, push a tag like v1.0.0.",
  ].join("\n"),
);

process.exit(1);
