# Barcode Emulator Electron

Cross-platform Electron desktop app that emulates a barcode reader by typing a configured value into the currently focused application when a global hotkey is pressed.

<img width="420" height="424" alt="Screenshot from 2026-04-28 22-18-26" src="https://github.com/user-attachments/assets/4a557209-f3e7-48ec-9bc3-77e8f32745b5" />

## Features

- Editable barcode value
- Configurable global hotkey
- Adjustable delay between key presses
- Optional trailing `Enter`
- Persistent settings between launches

## Getting started

```bash
npm install
npm start
```

## Build distributable apps

```bash
npm run dist
```

### Platform-specific builds

```bash
npm run dist:linux
npm run dist:win
npm run dist:mac
```

To request all three targets from one command:

```bash
npm run dist:all
```

That command intentionally stops with guidance instead of attempting unsupported cross-packaging from one host.

### Recommended way to build Windows + macOS + Ubuntu

Use the included GitHub Actions workflow. It runs a native build matrix on:

- Ubuntu for Ubuntu artifacts (`.deb` and AppImage)
- Windows for Windows artifacts
- macOS for macOS artifacts

That avoids the usual cross-packaging limitations from a single local machine.

The build workflow runs automatically for pushes to version branches matching `v*`.

### Publish a versioned release

Push a tag like `v1.0.0` and the release workflow will:

- build Ubuntu artifacts on Ubuntu
- build Windows artifacts on Windows
- build macOS ZIP artifacts on macOS
- publish the generated installers/binaries to a GitHub release

### Local build notes

- Ubuntu builds produce `.deb` and AppImage artifacts.
- If by Linux you mean Ubuntu, use the Ubuntu runner/build path in this project.
- Windows installers cannot be reliably produced from Linux here because `electron-builder` requires Wine.
- Windows builds are best produced on Windows runners or machines.
- macOS builds are best produced on macOS runners or machines.
- `src/icon.png` is used for the app window icon and Ubuntu packaging.
- `src/icon.icns` is used for the macOS app bundle icon.
- macOS packaging is configured as ZIP output to avoid the flaky DMG-only `dmg-license` toolchain dependency.
- macOS builds produce separate `x64` and `arm64` ZIP artifacts; Intel Macs should use the `x64` file.
- To avoid Gatekeeper blocking the macOS app, sign and notarize it by setting `MACOS_CERTIFICATE_P12`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` in GitHub Actions secrets.
- `npm run dist:all` points you to the native-runner GitHub Actions flow instead of trying to force unsupported local cross-builds.
- `release/` contains the generated artifacts.

## Notes

- Keyboard emulation and global shortcuts may require accessibility/input permissions depending on the operating system.
- The app is tuned for a US keyboard layout, matching the original barcode reader emulator behavior.
