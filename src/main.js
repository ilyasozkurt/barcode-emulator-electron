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

const {
  DEFAULT_SETTINGS,
  createAcceleratorFromSpec,
  formatHotkeyLabel,
  mergeSettings,
  normalizeBarcodeValue,
  normalizeHotkeySpec,
} = require("./shared");

let mainWindow = null;
let settings = mergeSettings(DEFAULT_SETTINGS, {});
let currentAccelerator = null;
let startupStatus = null;

const SETTINGS_FILE_NAME = "settings.json";
const MAIN_WINDOW_MIN_HEIGHT = 150;
const APP_ICON_PATH = path.join(
  __dirname,
  process.platform === "win32" ? "icon.ico" : "icon.png",
);

function getSettingsFilePath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

async function loadSettings() {
  try {
    const saved = await fs.readFile(getSettingsFilePath(), "utf8");
    settings = mergeSettings(DEFAULT_SETTINGS, JSON.parse(saved));
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }

    settings = mergeSettings(DEFAULT_SETTINGS, {});
    await saveSettings();
  }

  return settings;
}

async function saveSettings() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getSettingsFilePath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
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

  await wait(150);
  shell.beep();

  keyboard.config.autoDelayMs = settings.delayMs;
  await keyboard.type(normalizedValue);

  if (settings.sendEnter) {
    await keyboard.type(Key.Enter);
  }

  sendStatus({
    type: normalizedValue === settings.barcodeValue ? "success" : "warning",
    message: normalizedValue === settings.barcodeValue
      ? "Barcode emulated."
      : "Barcode emulated, but unsupported characters were replaced with ?.",
    notify: true,
  });
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: MAIN_WINDOW_MIN_HEIGHT,
    minWidth: 320,
    maxWidth: 400,
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

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (startupStatus) {
      pushStatus(startupStatus);
      startupStatus = null;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
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
  await saveSettings();
  return getRendererState();
});

ipcMain.on("window:content-height", (event, contentHeight) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  resizeWindowToContent(window, Number(contentHeight) || 0);
});

ipcMain.on("barcode-value:sync", (_event, barcodeValue) => {
  settings = mergeSettings(settings, { barcodeValue: String(barcodeValue ?? "") });
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

app.whenReady().then(async () => {
  await loadSettings();

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
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
