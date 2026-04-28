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
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} = require("@zxing/library");
const { Jimp } = require("jimp");
const screenshot = require("screenshot-desktop");

const {
  DEFAULT_SETTINGS,
  createAcceleratorFromSpec,
  formatHotkeyLabel,
  mergeSettings,
  normalizeBarcodeValue,
  normalizeHotkeySpec,
} = require("./shared");

let mainWindow = null;
let settingsWindow = null;
let settings = mergeSettings(DEFAULT_SETTINGS, {});
let currentAccelerator = null;
let startupStatus = null;

const SETTINGS_FILE_NAME = "settings.json";
const APP_ICON_PATH = path.join(__dirname, "icon.png");

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

function createDecodeHints() {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODABAR,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODE_128,
    BarcodeFormat.EAN_8,
    BarcodeFormat.EAN_13,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  return hints;
}

async function decodeBuffer(imageBuffer) {
  const image = await Jimp.read(imageBuffer);
  const { data, width, height } = image.bitmap;
  const luminanceSource = new RGBLuminanceSource(Uint8ClampedArray.from(data), width, height);
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
  const reader = new MultiFormatReader();

  return reader.decode(binaryBitmap, createDecodeHints()).getText();
}

async function scanScreenBarcode() {
  const displays = await screenshot.listDisplays();
  let lastError = null;

  for (const display of displays) {
    try {
      const imageBuffer = await screenshot({ format: "png", screen: display.id });
      return await decodeBuffer(imageBuffer);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw new Error(`Could not decode a barcode from the current screen content. ${lastError.message}`);
  }

  throw new Error("Could not find a barcode on any display.");
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
    height: 320,
    minWidth: 320,
    maxWidth: 400,
    minHeight: 180,
    show: false,
    title: "Barcode Reader Emulator",
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: "#f7f7f7",
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

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return Promise.resolve();
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 380,
    minWidth: 320,
    maxWidth: 400,
    minHeight: 220,
    show: false,
    title: "Barcode Reader Emulator Settings",
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: "#f7f7f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.once("ready-to-show", () => {
    settingsWindow.show();
    settingsWindow.focus();
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  return settingsWindow.loadFile(
    path.join(__dirname, "..", "dist-renderer", "index.html"),
    {
      query: {
        view: "settings",
      },
    },
  );
}

function clampWindowHeight(window, height) {
  const display = screen.getDisplayMatching(window.getBounds());
  const maxHeight = Math.max(display.workAreaSize.height - 80, 200);
  const minimumHeight = window === settingsWindow ? 220 : 180;
  return Math.max(minimumHeight, Math.min(Math.ceil(height), maxHeight));
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

ipcMain.handle("settings:open-window", async () => {
  await createSettingsWindow();
  return true;
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

ipcMain.handle("screen:scan", async () => {
  try {
    const barcodeValue = await scanScreenBarcode();
    sendStatus({
      type: "success",
      message: "Barcode value updated from the screen.",
      notify: true,
    });
    return barcodeValue;
  } catch (error) {
    sendStatus({
      type: "error",
      message: error.message,
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
