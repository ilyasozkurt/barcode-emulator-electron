
# Barcode Scanner Emulator

Cross-platform desktop utility built with Electron and Vue that simulates a barcode scanner by injecting keyboard input into the currently focused application using configurable global shortcuts.

<img alt="Barcode Scanner Emulator Preview" src="https://github.com/user-attachments/assets/3a21d14d-2e92-40bb-bbf6-50c14af1bf93" />

Designed for QA workflows, POS testing, warehouse systems, demos, and development environments where physical barcode scanner hardware is unavailable.

---

## Features

- Simulate HID-style barcode scanner keyboard input
- Configurable global hotkeys, editable from both the Emulator and Settings tabs
- Adjustable typing speed / key delay
- Optional trailing suffix key — `None`, `Enter`, or `Tab`
- Unlimited barcode input length with a fixed-size, scrollable input box (no auto-resize)
- "Input is being changed..." status guard to avoid emulating stale/in-progress edits
- Recently emulated history with one-click reuse and a confirm-before-clear dialog
- Optional desktop notifications for emulation results, toggleable in Settings
- Start on boot toggle for launching automatically with the system
- System tray support with a fully customizable global show/hide hotkey (default F9, recorded the same way as the Emulate hotkey) to toggle the app window (optional, toggleable in Settings); closing the window minimizes it to the tray instead of quitting
- Automatic update check against GitHub Releases with a prominent "New version available" warning banner in the header (and matching status in the About tab), linking to the website download page (with UTM tracking) instead of GitHub, plus a "Skip this version" option to dismiss a specific release
- Single-instance enforcement (relaunching focuses the existing window)
- Sidebar navigation (Emulator / History / Settings / About) with a fixed-height window and internal scrolling
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

## Interface

The app is organized into four sidebar tabs:

<img alt="Barcode Scanner Emulator Preview" src="https://github.com/user-attachments/assets/c20d9d27-216d-4a6d-8ca6-6b0892c5c528" />

- **Emulator** — Enter the barcode value, pick a suffix key (`None` / `Enter` / `Tab`) and delay, then press **Emulate** (or the global hotkey) to type it into the focused window. The global hotkey is editable directly from this tab.
- **History** — Browse recently emulated values, reuse one with **Use**, or clear the list (with a confirmation prompt).
- **Settings** — Toggle **Start on boot**, **Notifications** (desktop notifications for emulation results), and **Show/hide with hotkey** (system tray quick-toggle with a fully customizable hotkey, default F9, editable via the same press-to-record flow as the Emulate hotkey; when enabled, closing the window keeps it running in the tray, and the hotkey or tray icon brings it back).
- **About** — App version, update-available status (with **Download update** / **Skip this version** actions), links to the website, GitHub repository, and issue tracker.

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
