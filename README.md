# Barcode Scanner Emulator

Cross-platform desktop utility built with Electron and Vue that simulates a barcode scanner by injecting keyboard input into the currently focused application using configurable global shortcuts.

Designed for QA workflows, POS testing, warehouse systems, demos, and development environments where physical barcode scanner hardware is unavailable.

<img width="1206" height="419" alt="Barcode Scanner Emulator Preview" src="https://github.com/user-attachments/assets/cec9569e-ce33-4498-b439-7be3f9be518d" />

---

## Features

- Simulate HID-style barcode scanner keyboard input
- Configurable global hotkeys
- Adjustable typing speed / key delay
- Optional trailing `Enter`
- Works with desktop apps, browser apps, POS systems, and internal tooling
- Cross-platform support for Windows, macOS, and Linux
- Persistent settings between launches
- Lightweight desktop utility
- Offline-first workflow
- Open-source project

---

## Example Use Cases

- QA testing without physical scanner hardware
- POS workflow validation
- Warehouse and logistics software testing
- ERP integration testing
- Internal demos and onboarding environments
- Local development workflows
- Simulating keyboard wedge barcode readers

---

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development environment:

```bash
npm start
```

---

## Build Distributable Applications

Build the current platform:

```bash
npm run dist
```

### Platform-Specific Builds

```bash
npm run dist:linux
npm run dist:win
npm run dist:mac
```

### Multi-Platform Build Guidance

```bash
npm run dist:all
```

This command intentionally provides guidance instead of attempting unsupported cross-platform packaging from a single machine.

---

## Recommended Build Strategy

The recommended approach is using the included GitHub Actions workflow, which builds artifacts natively on each operating system:

- Ubuntu → `.deb` + AppImage
- Windows → Windows installers
- macOS → ZIP artifacts

This avoids common Electron cross-packaging limitations and produces more reliable release artifacts.

The workflow automatically runs for pushes to version branches matching:

```text
v*
```

---

## Publishing a Release

Push a version tag such as:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release workflow will automatically:

- Build Ubuntu artifacts
- Build Windows artifacts
- Build macOS artifacts
- Publish generated binaries to GitHub Releases

---

## Build Notes

### Linux / Ubuntu

- Ubuntu builds generate:
  - `.deb`
  - AppImage

### Windows

- Windows installers are best built on native Windows runners or machines.
- Cross-building Windows installers from Linux may require Wine and can be unreliable.

### macOS

- macOS builds are best produced on native macOS runners or machines.
- Packaging uses ZIP output for improved reliability and to avoid flaky DMG-related tooling issues.
- Separate `x64` and `arm64` artifacts are generated.
- Intel Macs should use the `x64` build.

### Application Icons

- `src/icon.png`
  - Used for the app window icon and Linux packaging
- `src/icon.icns`
  - Used for the macOS application bundle icon

### Code Signing & Notarization (macOS)

To avoid Gatekeeper warnings and improve user trust, configure the following GitHub Actions secrets:

- `MACOS_CERTIFICATE_P12`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

### Release Output

Generated artifacts are stored in:

```text
release/
```

---

## Permissions & System Notes

Depending on the operating system, keyboard emulation and global shortcuts may require:

- Accessibility permissions
- Input monitoring permissions
- Global shortcut permissions

The application is currently optimized for US keyboard layouts, matching typical barcode scanner keyboard wedge behavior.

---

## Tech Stack

- Electron
- Vue
- Tailwind CSS
- electron-builder
- GitHub Actions

---

## Website

Official website:

```text
https://barcodescanneremulator.dev
```

---

## License

MIT
