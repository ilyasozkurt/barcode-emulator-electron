const path = require("node:path");
const { notarize } = require("@electron/notarize");

module.exports = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== "darwin") {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const hasAnyCredential = [appleId, appleIdPassword, teamId].some(Boolean);
  const hasAllCredentials = [appleId, appleIdPassword, teamId].every(Boolean);

  if (!hasAnyCredential) {
    console.warn(
      "Skipping macOS notarization because APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID are not set.",
    );
    return;
  }

  if (!hasAllCredentials) {
    throw new Error(
      "APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID must be set together for macOS notarization.",
    );
  }

  await notarize({
    appPath: path.join(appOutDir, `${packager.appInfo.productFilename}.app`),
    appleId,
    appleIdPassword,
    teamId,
  });
};
