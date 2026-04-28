const api = window.barcodeEmulator;

const barcodeValueInput = document.getElementById("barcodeValue");
const scanButton = document.getElementById("scanButton");
const valueHint = document.getElementById("valueHint");
const hotkeyLabel = document.getElementById("hotkeyLabel");
const changeHotkeyButton = document.getElementById("changeHotkeyButton");
const delayInput = document.getElementById("delayInput");
const delayValue = document.getElementById("delayValue");
const sendEnterInput = document.getElementById("sendEnterInput");
const status = document.getElementById("status");
const hotkeyDialog = document.getElementById("hotkeyDialog");
const modifierControl = document.getElementById("modifierControl");
const modifierAlt = document.getElementById("modifierAlt");
const modifierShift = document.getElementById("modifierShift");
const modifierSuper = document.getElementById("modifierSuper");
const hotkeyKeySelect = document.getElementById("hotkeyKeySelect");
const dialogPreview = document.getElementById("dialogPreview");
const saveHotkeyButton = document.getElementById("saveHotkeyButton");

let currentSettings = null;
let valueSaveTimer = null;

function setControlsEnabled(isEnabled) {
  barcodeValueInput.disabled = !isEnabled;
  scanButton.disabled = !isEnabled;
  changeHotkeyButton.disabled = !isEnabled;
  delayInput.disabled = !isEnabled;
  sendEnterInput.disabled = !isEnabled;
}

function showStatus(message, type = "info") {
  status.textContent = message;
  status.dataset.type = type;
}

function clearStatus() {
  status.textContent = "";
  status.dataset.type = "idle";
}

function getDraftHotkey() {
  return {
    key: hotkeyKeySelect.value,
    modifiers: {
      control: modifierControl.checked,
      alt: modifierAlt.checked,
      shift: modifierShift.checked,
      super: modifierSuper.checked,
    },
  };
}

function updateDelayLabel(value) {
  delayValue.textContent = `${value} ms`;
}

function updateValueHint(rawValue) {
  const normalizedValue = api.normalizeBarcodeValue(rawValue);

  if (!rawValue) {
    valueHint.textContent = "Nothing will be typed until a value is entered.";
    return;
  }

  if (normalizedValue !== rawValue) {
    valueHint.textContent = "Unsupported characters will be typed as ?.";
    return;
  }

  valueHint.textContent = "Ready to emulate barcode input.";
}

function syncDialogPreview() {
  const previewParts = [];
  const draftHotkey = getDraftHotkey();

  if (draftHotkey.modifiers.control) {
    previewParts.push("Ctrl / Control");
  }
  if (draftHotkey.modifiers.alt) {
    previewParts.push("Alt / Option");
  }
  if (draftHotkey.modifiers.shift) {
    previewParts.push("Shift");
  }
  if (draftHotkey.modifiers.super) {
    previewParts.push("Win / Command");
  }

  previewParts.push(draftHotkey.key);
  dialogPreview.textContent = `Preview: ${previewParts.join(" + ")}`;
}

function populateKeyOptions() {
  for (const key of api.hotkeyKeys) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key;
    hotkeyKeySelect.append(option);
  }
}

function render(settingsState) {
  currentSettings = settingsState.settings;
  barcodeValueInput.value = currentSettings.barcodeValue;
  hotkeyLabel.textContent = settingsState.hotkeyLabel;
  delayInput.value = String(currentSettings.delayMs);
  sendEnterInput.checked = currentSettings.sendEnter;
  updateDelayLabel(currentSettings.delayMs);
  updateValueHint(currentSettings.barcodeValue);
  setControlsEnabled(true);
}

async function persistSettings(partialSettings) {
  const settingsState = await api.updateSettings(partialSettings);
  render(settingsState);
}

function queueBarcodeValueSave(value) {
  clearTimeout(valueSaveTimer);
  valueSaveTimer = setTimeout(() => {
    persistSettings({ barcodeValue: value }).catch((error) => {
      showStatus(error.message, "error");
    });
  }, 150);
}

function openHotkeyDialog() {
  if (!currentSettings) {
    return;
  }

  const { hotkey } = currentSettings;
  modifierControl.checked = hotkey.modifiers.control;
  modifierAlt.checked = hotkey.modifiers.alt;
  modifierShift.checked = hotkey.modifiers.shift;
  modifierSuper.checked = hotkey.modifiers.super;
  hotkeyKeySelect.value = hotkey.key;
  syncDialogPreview();
  hotkeyDialog.showModal();
}

barcodeValueInput.addEventListener("input", () => {
  const nextValue = barcodeValueInput.value;
  updateValueHint(nextValue);
  queueBarcodeValueSave(nextValue);
});

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  showStatus("Scanning all displays for barcodes...", "info");

  try {
    const scannedValue = await api.scanScreenBarcode();
    barcodeValueInput.value = scannedValue;
    updateValueHint(scannedValue);
    await persistSettings({ barcodeValue: scannedValue });
    showStatus("Barcode value updated from the screen.", "success");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    scanButton.disabled = false;
  }
});

changeHotkeyButton.addEventListener("click", () => {
  clearStatus();
  openHotkeyDialog();
});

for (const element of [modifierControl, modifierAlt, modifierShift, modifierSuper, hotkeyKeySelect]) {
  element.addEventListener("change", syncDialogPreview);
}

saveHotkeyButton.addEventListener("click", async () => {
  saveHotkeyButton.disabled = true;

  try {
    const settingsState = await api.setHotkey(getDraftHotkey());
    render(settingsState);
    hotkeyDialog.close();
    showStatus(`Hotkey updated to ${settingsState.hotkeyLabel}.`, "success");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    saveHotkeyButton.disabled = false;
  }
});

delayInput.addEventListener("input", async () => {
  const delayMs = Number(delayInput.value);
  updateDelayLabel(delayMs);

  try {
    await persistSettings({ delayMs });
  } catch (error) {
    showStatus(error.message, "error");
  }
});

sendEnterInput.addEventListener("change", async () => {
  try {
    await persistSettings({ sendEnter: sendEnterInput.checked });
  } catch (error) {
    showStatus(error.message, "error");
  }
});

api.onStatus(({ message, type }) => {
  showStatus(message, type);
});

populateKeyOptions();
setControlsEnabled(false);

api.getSettings()
  .then((settingsState) => {
    render(settingsState);
  })
  .catch((error) => {
    showStatus(error.message, "error");
  });
