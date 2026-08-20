const fs = require("node:fs/promises");
const path = require("node:path");

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Notification,
  screen,
  shell,
} = require("electron");
const { keyboard, Key } = require("@nut-tree-fork/nut-js");
const { uIOhook } = require("uiohook-napi");

const {
  DEFAULT_SETTINGS,
  createAcceleratorFromSpec,
  formatHotkeyLabel,
  mergeSettings,
  normalizeBarcodeValue,
  normalizeHotkeySpec,
} = require("./shared");
const {
  createHotkeyModifierPlan,
  getRestoreKeycodes,
  isTrackedModifierKeycode,
  mapModifierKeycodesToNutKeys,
} = require("./modifier-state");

let mainWindow = null;
let settings = mergeSettings(DEFAULT_SETTINGS, {});
let currentAccelerator = null;
let startupStatus = null;
let modifierTrackingStarted = false;
const pressedModifierKeycodes = new Set();

const singleInstanceLockAcquired = app.requestSingleInstanceLock();

if (!singleInstanceLockAcquired) {
  app.quit();
}

const SETTINGS_FILE_NAME = "settings.json";
const HISTORY_FILE_NAME = "history.json";
const HISTORY_LIMIT = 25;
const MAIN_WINDOW_MIN_HEIGHT = 150;
const MAIN_WINDOW_WIDTH = 640;
const APP_ICON_PATH = path.join(
  __dirname,
  process.platform === "win32" ? "icon.ico" : "icon.png",
);

let history = [];

function getSettingsFilePath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function getHistoryFilePath() {
  return path.join(app.getPath("userData"), HISTORY_FILE_NAME);
}

function applyStartOnBoot(enabled) {
  if (typeof app.setLoginItemSettings !== "function") {
    return;
  }

  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
}

async function loadSettings() {
  try {
    const saved = await fs.readFile(getSettingsFilePath(), "utf8");
    const parsedSettings = JSON.parse(saved);

    if (parsedSettings.suffixKey === undefined && parsedSettings.sendEnter === false) {
      parsedSettings.suffixKey = "none";
    }

    settings = mergeSettings(DEFAULT_SETTINGS, parsedSettings);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }

    settings = mergeSettings(DEFAULT_SETTINGS, {});
    await saveSettings();
  }

  applyStartOnBoot(settings.startOnBoot);

  return settings;
}

async function saveSettings() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getSettingsFilePath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

async function loadHistory() {
  try {
    const saved = await fs.readFile(getHistoryFilePath(), "utf8");
    const parsed = JSON.parse(saved);
    history = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }

    history = [];
  }

  return history;
}

async function saveHistory() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getHistoryFilePath(), `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

function pushHistoryUpdate() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("history:updated", history);
  }
}

async function recordHistoryEntry(value) {
  history = [
    { value, timestamp: Date.now() },
    ...history.filter((entry) => entry.value !== value),
  ].slice(0, HISTORY_LIMIT);

  pushHistoryUpdate();

  try {
    await saveHistory();
  } catch (error) {
    console.error(error);
  }
}

function getRendererState() {
  return {
    settings,
    hotkeyLabel: formatHotkeyLabel(settings.hotkey),
  };
}

function pushStatus(payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("status", payload);
  }
}

function showStatusNotification(payload) {
  if (!payload.notify || !Notification.isSupported()) {
    return;
  }

  new Notification({
    title: "Barcode Reader Emulator",
    body: payload.message,
  }).show();
}

function sendStatus(payload) {
  pushStatus({
    type: payload.type,
    message: payload.message,
  });
  showStatusNotification(payload);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function handleGlobalKeydown(event) {
  if (isTrackedModifierKeycode(event.keycode)) {
    pressedModifierKeycodes.add(event.keycode);
  }
}

function handleGlobalKeyup(event) {
  if (isTrackedModifierKeycode(event.keycode)) {
    pressedModifierKeycodes.delete(event.keycode);
  }
}

function startModifierTracking() {
  if (modifierTrackingStarted) {
    return;
  }

  uIOhook.on("keydown", handleGlobalKeydown);
  uIOhook.on("keyup", handleGlobalKeyup);
  uIOhook.start();
  modifierTrackingStarted = true;
}

function stopModifierTracking() {
  if (!modifierTrackingStarted) {
    return;
  }

  uIOhook.off("keydown", handleGlobalKeydown);
  uIOhook.off("keyup", handleGlobalKeyup);
  uIOhook.stop();
  modifierTrackingStarted = false;
  pressedModifierKeycodes.clear();
}

async function releaseHotkeyModifiersForEmulation() {
  const modifierPlan = createHotkeyModifierPlan(settings.hotkey, pressedModifierKeycodes);
  const releaseKeys = mapModifierKeycodesToNutKeys(modifierPlan.releaseKeycodes);

  if (releaseKeys.length > 0) {
    await keyboard.releaseKey(...releaseKeys);
  }

  return modifierPlan;
}

async function restoreHotkeyModifiersAfterEmulation(modifierPlan) {
  const restoreKeys = mapModifierKeycodesToNutKeys(
    getRestoreKeycodes(modifierPlan, pressedModifierKeycodes),
  );

  if (restoreKeys.length > 0) {
    await keyboard.pressKey(...restoreKeys);
  }
}

async function emulateBarcodeInput() {
  const normalizedValue = normalizeBarcodeValue(settings.barcodeValue);

  if (!normalizedValue) {
    sendStatus({
      type: "warning",
      message: "Nothing was typed because the barcode value is empty.",
      notify: true,
    });
    return;
  }

  const modifierPlan = await releaseHotkeyModifiersForEmulation();

  try {
    await wait(150);
    shell.beep();

    keyboard.config.autoDelayMs = settings.delayMs;
    await keyboard.type(normalizedValue);

    if (settings.suffixKey !== "none") {
      await keyboard.type(settings.suffixKey === "tab" ? Key.Tab : Key.Enter);
    }
  } finally {
    await restoreHotkeyModifiersAfterEmulation(modifierPlan);
  }

  sendStatus({
    type: normalizedValue === settings.barcodeValue ? "success" : "warning",
    message: normalizedValue === settings.barcodeValue
      ? "Barcode emulated."
      : "Barcode emulated, but unsupported characters were replaced with ?.",
    notify: true,
  });

  await recordHistoryEntry(normalizedValue);
}

function hotkeyCallback() {
  emulateBarcodeInput().catch((error) => {
    sendStatus({
      type: "error",
      message: `Typing failed: ${error.message}`,
      notify: true,
    });
  });
}

function restorePreviousHotkey(previousAccelerator) {
  if (!previousAccelerator) {
    currentAccelerator = null;
    return;
  }

  const restored = globalShortcut.register(previousAccelerator, hotkeyCallback);
  currentAccelerator = restored ? previousAccelerator : null;
}

function registerHotkey(spec) {
  const accelerator = createAcceleratorFromSpec(spec);
  const previousAccelerator = currentAccelerator;

  if (previousAccelerator) {
    globalShortcut.unregister(previousAccelerator);
  }

  const registered = globalShortcut.register(accelerator, hotkeyCallback);
  if (!registered) {
    restorePreviousHotkey(previousAccelerator);
    throw new Error(`The hotkey ${formatHotkeyLabel(spec)} could not be registered. Try another combination.`);
  }

  currentAccelerator = accelerator;
}

let showMainWindowOnce = () => {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_MIN_HEIGHT,
    minWidth: MAIN_WINDOW_WIDTH,
    maxWidth: MAIN_WINDOW_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    resizable: false,
    show: false,
    title: "Barcode Reader Emulator",
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: "#f7f7f7",
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  let windowShown = false;

  const showWindowOnce = () => {
    if (windowShown || mainWindow.isDestroyed()) {
      return;
    }
    windowShown = true;
    mainWindow.show();
    if (startupStatus) {
      pushStatus(startupStatus);
      startupStatus = null;
    }
  };

  showMainWindowOnce = showWindowOnce;

  mainWindow.once("ready-to-show", () => {
    // Fallback in case the renderer never reports its content height (e.g. bridge unavailable).
    setTimeout(showWindowOnce, 300);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    showMainWindowOnce = () => {};
  });

  return mainWindow.loadFile(path.join(__dirname, "..", "dist-renderer", "index.html"));
}

function clampWindowHeight(window, height) {
  const display = screen.getDisplayMatching(window.getBounds());
  const maxHeight = Math.max(display.workAreaSize.height - 80, 200);
  return Math.max(MAIN_WINDOW_MIN_HEIGHT, Math.min(Math.ceil(height), maxHeight));
}

function resizeWindowToContent(window, contentHeight) {
  if (!window || window.isDestroyed()) {
    return;
  }

  const [contentWidth, currentHeight] = window.getContentSize();
  const nextHeight = clampWindowHeight(window, contentHeight);

  if (Math.abs(currentHeight - nextHeight) < 2) {
    return;
  }

  window.setContentSize(contentWidth, nextHeight);
}

ipcMain.handle("settings:get", async () => {
  if (!currentAccelerator) {
    await loadSettings();
  }

  return getRendererState();
});

ipcMain.handle("settings:update", async (_event, partialSettings) => {
  settings = mergeSettings(settings, partialSettings);

  if (partialSettings && partialSettings.startOnBoot !== undefined) {
    applyStartOnBoot(settings.startOnBoot);
  }

  await saveSettings();
  return getRendererState();
});

ipcMain.on("window:content-height", (event, contentHeight) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  resizeWindowToContent(window, Number(contentHeight) || 0);
  showMainWindowOnce();
});

ipcMain.on("barcode-value:sync", (_event, barcodeValue) => {
  settings = mergeSettings(settings, { barcodeValue: String(barcodeValue ?? "") });
});

ipcMain.handle("history:get", async () => history);

ipcMain.handle("history:clear", async () => {
  history = [];
  await saveHistory();
  pushHistoryUpdate();
  return history;
});

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("app:open-external", (_event, url) => {
  if (typeof url === "string" && /^https:\/\//.test(url)) {
    return shell.openExternal(url);
  }

  return undefined;
});

ipcMain.handle("hotkey:update", async (_event, nextHotkey) => {
  try {
    const normalizedHotkey = normalizeHotkeySpec(nextHotkey);
    registerHotkey(normalizedHotkey);
    settings = mergeSettings(settings, { hotkey: normalizedHotkey });
    await saveSettings();

    const rendererState = getRendererState();
    sendStatus({
      type: "success",
      message: `Hotkey updated to ${rendererState.hotkeyLabel}.`,
      notify: true,
    });
    return rendererState;
  } catch (error) {
    sendStatus({
      type: "error",
      message: error.message,
      notify: true,
    });
    throw error;
  }
});

ipcMain.handle("barcode:emulate", async () => {
  try {
    await emulateBarcodeInput();
    return true;
  } catch (error) {
    sendStatus({
      type: "error",
      message: `Typing failed: ${error.message}`,
      notify: true,
    });
    throw error;
  }
});

if (singleInstanceLockAcquired) {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    await loadSettings();
    await loadHistory();
    startModifierTracking();

    try {
      registerHotkey(settings.hotkey);
    } catch (error) {
      startupStatus = {
        type: "warning",
        message: error.message,
      };
    }

    if (process.platform === "darwin" && app.dock) {
      app.dock.setIcon(APP_ICON_PATH);
    }

    await createWindow();

    app.on("activate", async () => {
      if (!mainWindow) {
        await createWindow();
      }
    });
  }).catch((error) => {
    console.error(error);
    app.quit();
  });

  app.on("will-quit", () => {
    stopModifierTracking();
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
