const fs = require("node:fs/promises");
const path = require("node:path");

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
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

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function emulateBarcodeInput() {
  const normalizedValue = normalizeBarcodeValue(settings.barcodeValue);

  if (!normalizedValue) {
    pushStatus({
      type: "warning",
      message: "Nothing was typed because the barcode value is empty.",
    });
    return;
  }

  if (normalizedValue !== settings.barcodeValue) {
    pushStatus({
      type: "warning",
      message: "Unsupported characters were replaced with ? while typing.",
    });
  }

  await wait(150);
  shell.beep();

  keyboard.config.autoDelayMs = settings.delayMs;
  await keyboard.type(normalizedValue);

  if (settings.sendEnter) {
    await keyboard.type(Key.Enter);
  }
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
    pushStatus({
      type: "error",
      message: `Typing failed: ${error.message}`,
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
    width: 500,
    height: 520,
    minWidth: 460,
    minHeight: 500,
    show: false,
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: "#111827",
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

  return mainWindow.loadFile(path.join(__dirname, "index.html"));
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

ipcMain.handle("hotkey:update", async (_event, nextHotkey) => {
  const normalizedHotkey = normalizeHotkeySpec(nextHotkey);
  registerHotkey(normalizedHotkey);
  settings = mergeSettings(settings, { hotkey: normalizedHotkey });
  await saveSettings();
  return getRendererState();
});

ipcMain.handle("screen:scan", async () => {
  return scanScreenBarcode();
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
    if (BrowserWindow.getAllWindows().length === 0) {
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
