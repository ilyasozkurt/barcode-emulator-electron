const { contextBridge, ipcRenderer } = require("electron");

const HOTKEY_KEYS = Object.freeze([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
]);

const SUPPORTED_BARCODE_CHAR = /^[0-9A-Za-z`~!@#$%^&*()_+\-=\[\]{}\\|;:'",.<>/?]$/;

function normalizeBarcodeValue(value) {
  return [...String(value ?? "")].map((character) => {
    return SUPPORTED_BARCODE_CHAR.test(character) ? character : "?";
  }).join("");
}

contextBridge.exposeInMainWorld("barcodeEmulator", {
  hotkeyKeys: HOTKEY_KEYS,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  emulateBarcode: () => ipcRenderer.invoke("barcode:emulate"),
  normalizeBarcodeValue,
  openSettingsWindow: () => ipcRenderer.invoke("settings:open-window"),
  reportContentHeight: (height) => ipcRenderer.send("window:content-height", height),
  onStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("status", listener);

    return () => {
      ipcRenderer.removeListener("status", listener);
    };
  },
  scanScreenBarcode: () => ipcRenderer.invoke("screen:scan"),
  setHotkey: (hotkey) => ipcRenderer.invoke("hotkey:update", hotkey),
  syncBarcodeValue: (barcodeValue) => ipcRenderer.send("barcode-value:sync", barcodeValue),
  updateSettings: (partialSettings) => ipcRenderer.invoke("settings:update", partialSettings),
});
