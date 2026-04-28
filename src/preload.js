const { contextBridge, ipcRenderer } = require("electron");

const { HOTKEY_KEYS, normalizeBarcodeValue } = require("./shared");

contextBridge.exposeInMainWorld("barcodeEmulator", {
  hotkeyKeys: HOTKEY_KEYS,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  normalizeBarcodeValue,
  onStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("status", listener);

    return () => {
      ipcRenderer.removeListener("status", listener);
    };
  },
  scanScreenBarcode: () => ipcRenderer.invoke("screen:scan"),
  setHotkey: (hotkey) => ipcRenderer.invoke("hotkey:update", hotkey),
  updateSettings: (partialSettings) => ipcRenderer.invoke("settings:update", partialSettings),
});

