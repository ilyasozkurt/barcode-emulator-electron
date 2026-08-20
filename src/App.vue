<template>
  <main ref="pageRoot" class="bg-white">
    <div>
      <header class="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <img :src="appIconUrl" alt="" class="h-7 w-7 shrink-0 rounded-md" aria-hidden="true" />
        <h1 class="m-0 truncate text-[1.05rem] font-bold text-slate-800">Barcode Reader Emulator</h1>
      </header>

      <div class="flex items-stretch">
        <aside class="flex w-32 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-2.5">
          <button
            v-for="item in navItems"
            :id="`nav-${item.id}`"
            :key="item.id"
            type="button"
            class="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[0.8rem] font-medium transition"
            :class="activeSection === item.id
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'"
            @click="activeSection = item.id"
          >
            <i :class="['pi', item.icon, 'text-[0.85rem]']" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </button>
        </aside>

        <div class="flex min-w-0 flex-1 flex-col">
          <div
            ref="contentPanel"
            class="min-w-0 overflow-y-auto p-4"
            :class="lockedContentHeight ? 'shrink-0 grow-0' : 'flex-1'"
            :style="lockedContentHeight ? { height: `${lockedContentHeight}px` } : undefined"
          >
          <section v-if="activeSection === 'emulator'" aria-label="Barcode reader emulator controls" class="grid gap-3 mb-4">

            <div class="grid gap-1.5">
              <span class="text-[0.8rem] font-semibold text-slate-500">Input</span>
              <Textarea
                id="barcodeValue"
                v-model="barcodeValue"
                :rows="4"
                placeholder="Type a barcode value..."
                :disabled="!controlsEnabled"
                class="w-full rounded-[1.4rem] border border-[#d6d6d6] bg-white px-4 py-4 text-[0.95rem] shadow-none"
                @update:modelValue="onBarcodeInput"
              />
              <div class="flex items-center gap-1.5 text-[0.82rem]" :class="statusColorClass">
                <i :class="['pi', statusIcon]" aria-hidden="true" />
                <span>{{ statusText }}</span>
              </div>
            </div>

            <div class="flex items-end gap-2.5">
              <div class="grid gap-1">
                <span class="text-[0.75rem] font-semibold text-slate-500">Suffix</span>
                <Select
                  id="suffixKeySelect"
                  v-model="suffixKey"
                  :options="suffixKeyOptions"
                  option-label="label"
                  option-value="value"
                  size="small"
                  overlay-class="suffix-key-select-overlay"
                  class="w-28! [&_.p-select-label]:py-1.5! [&_.p-select-label]:text-[0.8rem]!"
                  :disabled="!bridgeAvailable || !controlsEnabled"
                  @update:model-value="handleSuffixKeyUpdate"
                />
              </div>

              <div class="grid gap-1">
                <span class="text-[0.75rem] font-semibold text-slate-500">Delay</span>
                <div class="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5">
                  <input
                    id="delayInput"
                    type="number"
                    min="10"
                    max="100"
                    step="5"
                    :value="delayMs"
                    class="w-10 border-0 p-0 text-[0.85rem] text-slate-700 focus:outline-none"
                    :disabled="!bridgeAvailable || !controlsEnabled || hotkeyRecording"
                    @input="handleDelayInput(Number($event.target.value))"
                  />
                  <span class="text-[0.72rem] text-slate-400">ms</span>
                </div>
              </div>

              <div class="ml-auto grid w-1/2 gap-1 relative">
                <span class="text-[0.75rem] font-semibold text-transparent select-none" aria-hidden="true">Emulate</span>
                <Button
                  id="sendButton"
                  :loading="sendBusy"
                  :disabled="!bridgeAvailable || !controlsEnabled || sendBusy || hotkeyRecording || isTyping || !barcodeValue"
                  @click="sendBarcode"
                >
                  <i class="pi pi-play" aria-hidden="true" />
                  Emulate
                </Button>
                <div class="flex items-center justify-center gap-2 absolute -bottom-7 left-0 w-full">
                  <span class="text-[0.72rem] text-slate-400">Hotkey: {{ hotkeyLabel }}</span>
                  <button
                    id="editHotkeyButtonEmulator"
                    type="button"
                    class="inline-flex cursor-pointer h-6 min-w-6 items-center justify-center rounded-full border border-slate-300 px-1.5 text-[0.7rem] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="!bridgeAvailable || !controlsEnabled || hotkeySaveBusy"
                    @click="toggleHotkeyRecording"
                  >
                    <span v-if="hotkeyRecording">Cancel</span>
                    <i v-else class="pi pi-pencil text-[0.68rem]" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeSection === 'settings'" aria-label="Settings" class="grid gap-5">
            <div class="grid gap-1.5">
              <div class="flex items-center gap-3">
                <span class="text-[0.8rem] font-semibold text-slate-500">Start on boot</span>
                <ToggleSwitch
                  id="startOnBootToggle"
                  v-model="startOnBoot"
                  :disabled="!bridgeAvailable || !controlsEnabled"
                  @update:model-value="handleStartOnBootUpdate"
                />
              </div>
              <p class="m-0 text-[0.72rem] text-slate-400">
                Launch the app automatically in the background whenever you sign in.
              </p>
            </div>

            <div class="grid gap-1.5">
              <div class="flex items-center gap-3">
                <span class="text-[0.8rem] font-semibold text-slate-500">Notifications</span>
                <ToggleSwitch
                  id="notificationsEnabledToggle"
                  v-model="notificationsEnabled"
                  :disabled="!bridgeAvailable || !controlsEnabled"
                  @update:model-value="handleNotificationsEnabledUpdate"
                />
              </div>
              <p class="m-0 text-[0.72rem] text-slate-400">
                Show a desktop notification each time a barcode value is emulated.
              </p>
            </div>

            <div class="grid gap-1.5">
              <div class="flex items-center gap-3">
                <span class="text-[0.8rem] font-semibold text-slate-500">Show/hide with hotkey</span>
                <ToggleSwitch
                  id="quickToggleEnabledToggle"
                  v-model="quickToggleEnabled"
                  :disabled="!bridgeAvailable || !controlsEnabled"
                  @update:model-value="handleQuickToggleEnabledUpdate"
                />
                <span class="text-[0.72rem] text-slate-400">{{ quickToggleHotkeyLabel }}</span>
                <button
                  id="editQuickToggleHotkeyButton"
                  type="button"
                  class="inline-flex cursor-pointer h-6 min-w-6 items-center justify-center rounded-full border border-slate-300 px-1.5 text-[0.7rem] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!bridgeAvailable || !controlsEnabled || quickToggleHotkeySaveBusy"
                  @click="toggleQuickToggleHotkeyRecording"
                >
                  <span v-if="quickToggleHotkeyRecording">Cancel</span>
                  <i v-else class="pi pi-pencil text-[0.68rem]" aria-hidden="true" />
                </button>
              </div>
              <p class="m-0 text-[0.72rem] text-slate-400">
                Press {{ quickToggleHotkeyLabel }} anytime to show or hide this window from the system tray. Closing the window will keep it running in the tray.
              </p>
            </div>
          </section>

          <section v-else-if="activeSection === 'history'" aria-label="History" class="grid gap-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-[0.8rem] font-semibold text-slate-500">Recently emulated</span>
              <button
                id="clearHistoryButton"
                type="button"
                class="cursor-pointer text-[0.78rem] font-medium text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!bridgeAvailable || historyEntries.length === 0"
                @click="clearHistory"
              >
                Clear
              </button>
            </div>

            <p v-if="historyEntries.length === 0" class="m-0 text-[0.85rem] text-slate-500">
              Nothing emulated yet. Values you send will show up here.
            </p>

            <ul v-else class="m-0 grid list-none gap-1.5 p-0">
              <li
                v-for="entry in historyEntries"
                :key="entry.timestamp"
                class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="truncate font-mono text-[0.85rem] text-slate-800">{{ entry.value }}</div>
                  <div class="text-[0.72rem] text-slate-500">{{ formatHistoryTimestamp(entry.timestamp) }}</div>
                </div>
                <button
                  type="button"
                  class="shrink-0 cursor-pointer rounded-full border border-blue-500 px-2.5 py-1 text-[0.74rem] font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!bridgeAvailable || !controlsEnabled"
                  @click="reuseHistoryEntry(entry.value)"
                >
                  Use
                </button>
              </li>
            </ul>
          </section>

          <section v-else aria-label="About" class="grid gap-3">
            <div class="grid gap-1">
              <span class="text-[0.95rem] font-semibold text-slate-800">Barcode Reader Emulator</span>
              <span class="text-[0.8rem] text-slate-500">Version {{ appVersion }}</span>
            </div>
            <p class="m-0 text-[0.85rem] text-slate-600">
              Simulates a barcode scanner by typing values into the currently focused application using
              a configurable global hotkey.
            </p>
            <div class="grid gap-1.5">
              <button
                type="button"
                class="cursor-pointer text-left text-[0.82rem] font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                @click="openExternalLink('https://barcodescanneremulator.dev')"
              >
                Website
              </button>
              <button
                type="button"
                class="cursor-pointer text-left text-[0.82rem] font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                @click="openExternalLink('https://github.com/ilyasozkurt/barcode-emulator-electron')"
              >
                GitHub repository
              </button>
              <button
                type="button"
                class="cursor-pointer text-left text-[0.82rem] font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                @click="openExternalLink('https://github.com/ilyasozkurt/barcode-emulator-electron/issues/new')"
              >
                Report an issue
              </button>
            </div>
            <span class="text-[0.75rem] text-slate-400">MIT License</span>
          </section>
          </div>

          <footer class="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-[0.8rem]">
            <span class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <i class="pi pi-key text-slate-400" aria-hidden="true" />
              <span class="text-slate-500">Keyboard wedge:</span>
              <span class="font-semibold" :class="bridgeAvailable ? 'text-emerald-600' : 'text-slate-400'">
                {{ bridgeAvailable ? "Enabled" : "Unavailable" }}
              </span>
            </span>
            <span class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <i class="pi pi-desktop text-slate-400" aria-hidden="true" />
              <span class="text-slate-500">Platform:</span>
              <span class="font-semibold text-blue-600">{{ platformLabel }}</span>
            </span>
          </footer>
        </div>
      </div>
    </div>

    <Drawer
      v-model:visible="hotkeyRecording"
      position="bottom"
      class="h-auto! max-h-[50vh]! rounded-t-3xl"
      pt:header:class="!px-5 !py-4"
      aria-live="polite"
    >
      <template #header>
        <div class="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span class="relative flex h-3 w-3">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span>Recording shortcut</span>
        </div>
      </template>

      <section class="grid gap-1 pb-2">
        <p class="m-0 text-[0.82rem] text-slate-500">{{ hotkeyRecordingMessage }}</p>
      </section>
    </Drawer>

    <Drawer
      v-model:visible="quickToggleHotkeyRecording"
      position="bottom"
      class="h-auto! max-h-[50vh]! rounded-t-3xl"
      pt:header:class="!px-5 !py-4"
      aria-live="polite"
    >
      <template #header>
        <div class="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span class="relative flex h-3 w-3">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span>Recording show/hide shortcut</span>
        </div>
      </template>

      <section class="grid gap-1 pb-2">
        <p class="m-0 text-[0.82rem] text-slate-500">{{ quickToggleHotkeyRecordingMessage }}</p>
      </section>
    </Drawer>

    <Dialog
      v-model:visible="clearHistoryConfirmVisible"
      modal
      header="Clear history?"
      :closable="!clearHistoryBusy"
      class="w-[min(90vw,360px)]!"
    >
      <p class="m-0 text-[0.85rem] text-slate-600">
        This will remove all recently emulated values. This action cannot be undone.
      </p>
      <template #footer>
        <button
          type="button"
          class="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-[0.8rem] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="clearHistoryBusy"
          @click="clearHistoryConfirmVisible = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-full bg-red-500 px-3 py-1.5 text-[0.8rem] font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="clearHistoryBusy"
          @click="confirmClearHistory"
        >
          Clear
        </button>
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Drawer from "primevue/drawer";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import ToggleSwitch from "primevue/toggleswitch";
import appIconUrl from "./icon.png";

const api = window.barcodeEmulator;

const PLATFORM_LABELS = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
};

const MODIFIER_ONLY_KEYS = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift"]);

const NAV_ITEMS = [
  { id: "emulator", label: "Emulator", icon: "pi-barcode" },
  { id: "history", label: "History", icon: "pi-history" },
  { id: "settings", label: "Settings", icon: "pi-cog" },
  { id: "about", label: "About", icon: "pi-info-circle" },
];

const bridgeAvailable = Boolean(
  api
    && typeof api.getSettings === "function"
    && typeof api.updateSettings === "function"
    && typeof api.setHotkey === "function"
    && typeof api.emulateBarcode === "function"
    && typeof api.reportContentHeight === "function"
    && typeof api.syncBarcodeValue === "function"
    && typeof api.onStatus === "function"
    && typeof api.normalizeBarcodeValue === "function",
);

const platformLabel = computed(() => PLATFORM_LABELS[api?.platform] ?? "Unknown");

function cloneHotkey(hotkey) {
  return {
    key: hotkey?.key ?? "A",
    modifiers: {
      control: Boolean(hotkey?.modifiers?.control),
      alt: Boolean(hotkey?.modifiers?.alt),
      shift: Boolean(hotkey?.modifiers?.shift),
      super: Boolean(hotkey?.modifiers?.super),
    },
  };
}

function hasHotkeyModifier(modifiers = {}) {
  return Boolean(modifiers.control || modifiers.alt || modifiers.shift || modifiers.super);
}

function extractRecordedHotkeyKey(event, allowFunctionKeys = false) {
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }

  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }

  if (/^Numpad[0-9]$/.test(event.code)) {
    return event.code.slice(6);
  }

  if (allowFunctionKeys && /^F([1-9]|1[0-2])$/.test(event.key ?? "")) {
    return event.key;
  }

  const normalizedKey = String(event.key ?? "").toUpperCase();
  return /^[A-Z0-9]$/.test(normalizedKey) ? normalizedKey : null;
}

const controlsEnabled = ref(false);
const barcodeValue = ref("");
const hotkeyLabel = ref("Loading hotkey...");
const delayMs = ref(30);
const suffixKey = ref("enter");
const suffixKeyOptions = [
  { label: "NONE", value: "none" },
  { label: "ENTER", value: "enter" },
  { label: "TAB", value: "tab" },
];
const startOnBoot = ref(false);
const notificationsEnabled = ref(true);
const quickToggleEnabled = ref(false);
const isTyping = ref(false);
const statusMessage = ref("");
const statusType = ref("idle");
const STATUS_PRESENTATION = {
  idle: { icon: "pi-check-circle", colorClass: "text-emerald-600" },
  success: { icon: "pi-check-circle", colorClass: "text-emerald-600" },
  warning: { icon: "pi-exclamation-triangle", colorClass: "text-amber-600" },
  error: { icon: "pi-times-circle", colorClass: "text-red-600" },
  info: { icon: "pi-info-circle", colorClass: "text-slate-500" },
  typing: { icon: "pi-spinner-dotted pi-spin", colorClass: "text-slate-500" },
  empty: { icon: "pi-info-circle", colorClass: "text-slate-400" },
};
const statusText = computed(() => {
  if (isTyping.value) {
    return "Input is being changed...";
  }
  if (!barcodeValue.value) {
    return "Type a barcode value";
  }
  return statusMessage.value || "Ready to emulate";
});
const statusPresentationKey = computed(() => {
  if (isTyping.value) {
    return "typing";
  }
  if (!barcodeValue.value) {
    return "empty";
  }
  return statusType.value;
});
const statusIcon = computed(() => (STATUS_PRESENTATION[statusPresentationKey.value] ?? STATUS_PRESENTATION.info).icon);
const statusColorClass = computed(() => (STATUS_PRESENTATION[statusPresentationKey.value] ?? STATUS_PRESENTATION.info).colorClass);
const draftHotkey = ref(
  cloneHotkey({
    key: "A",
    modifiers: { control: true, alt: true, shift: false, super: false },
  }),
);
const currentSettings = ref(null);
const sendBusy = ref(false);
const hotkeyRecording = ref(false);
const hotkeySaveBusy = ref(false);
const hotkeyRecordingMessage = ref("Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.");
const quickToggleDraftHotkey = ref(
  cloneHotkey({
    key: "F9",
    modifiers: { control: false, alt: false, shift: false, super: false },
  }),
);
const quickToggleHotkeyLabel = ref("Loading hotkey...");
const quickToggleHotkeyRecording = ref(false);
const quickToggleHotkeySaveBusy = ref(false);
const quickToggleHotkeyRecordingMessage = ref("Press the new shortcut now. F1-F12 can be used alone; other keys need at least one modifier. Press Esc to cancel.");
const pageRoot = ref(null);
const contentPanel = ref(null);
const lockedContentHeight = ref(null);
const activeSection = ref("emulator");
const navItems = NAV_ITEMS;
const historyEntries = ref([]);
const appVersion = ref("");
const clearHistoryConfirmVisible = ref(false);
const clearHistoryBusy = ref(false);

let valueSaveTimer = null;
let delaySaveTimer = null;
let unsubscribeStatus = null;
let unsubscribeHistory = null;

function setStatus(message, type = "info") {
  statusMessage.value = message;
  statusType.value = type;
}

function clearStatus() {
  statusMessage.value = "";
  statusType.value = "idle";
}

function applySettingsState(settingsState) {
  currentSettings.value = settingsState.settings;
  barcodeValue.value = settingsState.settings.barcodeValue;
  hotkeyLabel.value = settingsState.hotkeyLabel;
  delayMs.value = settingsState.settings.delayMs;
  suffixKey.value = settingsState.settings.suffixKey;
  startOnBoot.value = settingsState.settings.startOnBoot;
  notificationsEnabled.value = settingsState.settings.notificationsEnabled;
  quickToggleEnabled.value = settingsState.settings.quickToggleEnabled;
  quickToggleHotkeyLabel.value = settingsState.quickToggleHotkeyLabel;
  quickToggleDraftHotkey.value = cloneHotkey(settingsState.settings.quickToggleHotkey);
  draftHotkey.value = cloneHotkey(settingsState.settings.hotkey);
  controlsEnabled.value = true;
}

async function persistSettings(partialSettings) {
  clearTimeout(valueSaveTimer);
  const settingsState = await api.updateSettings(partialSettings);
  applySettingsState(settingsState);
}

function queueBarcodeValueSave(value) {
  clearTimeout(valueSaveTimer);
  isTyping.value = true;
  valueSaveTimer = setTimeout(async () => {
    try {
      await persistSettings({ barcodeValue: value });
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      isTyping.value = false;
    }
  }, 150);
}

function onBarcodeInput(value) {
  if (!bridgeAvailable) {
    return;
  }

  barcodeValue.value = value;
  api.syncBarcodeValue(value);
  queueBarcodeValueSave(value);
}

function queueDelaySave(value) {
  clearTimeout(delaySaveTimer);
  delaySaveTimer = setTimeout(async () => {
    try {
      await persistSettings({ delayMs: value });
    } catch (error) {
      setStatus(error.message, "error");
    }
  }, 150);
}

function handleDelayInput(value) {
  if (!bridgeAvailable) {
    return;
  }

  delayMs.value = value;

  if (currentSettings.value && value === currentSettings.value.delayMs) {
    clearTimeout(delaySaveTimer);
    return;
  }

  queueDelaySave(value);
}

function reuseHistoryEntry(value) {
  if (!bridgeAvailable) {
    return;
  }

  barcodeValue.value = value;
  api.syncBarcodeValue(value);
  queueBarcodeValueSave(value);
  clearStatus();
  activeSection.value = "emulator";
}

async function clearHistory() {
  if (!bridgeAvailable || typeof api.clearHistory !== "function" || historyEntries.value.length === 0) {
    return;
  }

  clearHistoryConfirmVisible.value = true;
}

async function confirmClearHistory() {
  if (!bridgeAvailable || typeof api.clearHistory !== "function") {
    return;
  }

  clearHistoryBusy.value = true;

  try {
    historyEntries.value = await api.clearHistory();
    clearHistoryConfirmVisible.value = false;
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    clearHistoryBusy.value = false;
  }
}

function formatHistoryTimestamp(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function openExternalLink(url) {
  if (bridgeAvailable && typeof api.openExternal === "function") {
    api.openExternal(url);
  }
}

async function sendBarcode() {
  if (isTyping.value || !barcodeValue.value) {
    return;
  }

  sendBusy.value = true;

  try {
    await api.emulateBarcode();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    sendBusy.value = false;
  }
}

async function saveHotkey(nextHotkey = draftHotkey.value) {
  hotkeySaveBusy.value = true;

  try {
    const settingsState = await api.setHotkey(nextHotkey);
    applySettingsState(settingsState);
    setStatus(`Hotkey updated to ${settingsState.hotkeyLabel}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    hotkeySaveBusy.value = false;
  }
}

async function onSuffixKeyChange() {
  if (!currentSettings.value || suffixKey.value === currentSettings.value.suffixKey) {
    return;
  }

  try {
    await persistSettings({ suffixKey: suffixKey.value });
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function handleSuffixKeyUpdate(value) {
  suffixKey.value = value;
  onSuffixKeyChange();
}

async function handleStartOnBootUpdate(value) {
  startOnBoot.value = value;

  if (!currentSettings.value || value === currentSettings.value.startOnBoot) {
    return;
  }

  try {
    await persistSettings({ startOnBoot: value });
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function handleNotificationsEnabledUpdate(value) {
  notificationsEnabled.value = value;

  if (!currentSettings.value || value === currentSettings.value.notificationsEnabled) {
    return;
  }

  try {
    await persistSettings({ notificationsEnabled: value });
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function handleQuickToggleEnabledUpdate(value) {
  quickToggleEnabled.value = value;

  if (!currentSettings.value || value === currentSettings.value.quickToggleEnabled) {
    return;
  }

  try {
    await persistSettings({ quickToggleEnabled: value });
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function saveQuickToggleHotkey(nextHotkey = quickToggleDraftHotkey.value) {
  quickToggleHotkeySaveBusy.value = true;

  try {
    const settingsState = await api.setQuickToggleHotkey(nextHotkey);
    applySettingsState(settingsState);
    setStatus(`Show/hide hotkey updated to ${settingsState.quickToggleHotkeyLabel}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    quickToggleHotkeySaveBusy.value = false;
  }
}

function toggleQuickToggleHotkeyRecording() {
  quickToggleHotkeyRecording.value = !quickToggleHotkeyRecording.value;
  quickToggleHotkeyRecordingMessage.value = "Press the new shortcut now. F1-F12 can be used alone; other keys need at least one modifier. Press Esc to cancel.";
}

function toggleHotkeyRecording() {
  hotkeyRecording.value = !hotkeyRecording.value;
  hotkeyRecordingMessage.value = "Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.";
}

async function handleHotkeyRecordingKeydown(event) {
  if (!hotkeyRecording.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    hotkeyRecording.value = false;
    hotkeyRecordingMessage.value = "Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.";
    return;
  }

  if (event.repeat || MODIFIER_ONLY_KEYS.has(event.key)) {
    return;
  }

  const recordedKey = extractRecordedHotkeyKey(event);
  if (!recordedKey) {
    hotkeyRecordingMessage.value = "Use a letter A-Z or digit 0-9 for the main key.";
    return;
  }

  const recordedHotkey = cloneHotkey({
    key: recordedKey,
    modifiers: {
      control: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      super: event.metaKey,
    },
  });

  if (!hasHotkeyModifier(recordedHotkey.modifiers)) {
    hotkeyRecordingMessage.value = "Include at least one modifier key such as Ctrl, Alt, Shift, or Win/Command.";
    return;
  }

  draftHotkey.value = recordedHotkey;
  hotkeyRecording.value = false;
  hotkeyRecordingMessage.value = "Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.";
  await saveHotkey(recordedHotkey);
}

async function handleQuickToggleHotkeyRecordingKeydown(event) {
  if (!quickToggleHotkeyRecording.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    quickToggleHotkeyRecording.value = false;
    quickToggleHotkeyRecordingMessage.value = "Press the new shortcut now. F1-F12 can be used alone; other keys need at least one modifier. Press Esc to cancel.";
    return;
  }

  if (event.repeat || MODIFIER_ONLY_KEYS.has(event.key)) {
    return;
  }

  const recordedKey = extractRecordedHotkeyKey(event, true);
  if (!recordedKey) {
    quickToggleHotkeyRecordingMessage.value = "Use a letter A-Z, digit 0-9, or F1-F12 for the main key.";
    return;
  }

  const recordedHotkey = cloneHotkey({
    key: recordedKey,
    modifiers: {
      control: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      super: event.metaKey,
    },
  });

  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(recordedKey);
  if (!isFunctionKey && !hasHotkeyModifier(recordedHotkey.modifiers)) {
    quickToggleHotkeyRecordingMessage.value = "Include at least one modifier key such as Ctrl, Alt, Shift, or Win/Command.";
    return;
  }

  quickToggleDraftHotkey.value = recordedHotkey;
  quickToggleHotkeyRecording.value = false;
  quickToggleHotkeyRecordingMessage.value = "Press the new shortcut now. F1-F12 can be used alone; other keys need at least one modifier. Press Esc to cancel.";
  await saveQuickToggleHotkey(recordedHotkey);
}

async function init() {
  if (!bridgeAvailable) {
    hotkeyLabel.value = "Unavailable";
    setStatus(
      "Electron bridge is unavailable. Restart the app from Electron instead of opening the HTML file directly.",
      "error",
    );
    return;
  }

  unsubscribeStatus = api.onStatus(({ message, type }) => {
    setStatus(message, type);
  });

  if (typeof api.onHistoryUpdated === "function") {
    unsubscribeHistory = api.onHistoryUpdated((entries) => {
      historyEntries.value = Array.isArray(entries) ? entries : [];
    });
  }

  if (typeof api.getHistory === "function") {
    try {
      historyEntries.value = await api.getHistory();
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  if (typeof api.getAppVersion === "function") {
    try {
      appVersion.value = await api.getAppVersion();
    } catch {
      appVersion.value = "";
    }
  }

  try {
    const settingsState = await api.getSettings();
    applySettingsState(settingsState);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function reportContentHeight() {
  if (!bridgeAvailable) {
    return;
  }

  const pageElement = pageRoot.value;
  if (!pageElement) {
    return;
  }

  const contentElement = pageElement.firstElementChild ?? pageElement;
  const measuredHeight = Math.max(
    contentElement.scrollHeight,
    Math.ceil(contentElement.getBoundingClientRect().height),
  );

  api.reportContentHeight(measuredHeight);
}

async function lockContentHeight() {
  await nextTick();

  const panelElement = contentPanel.value;
  if (!panelElement) {
    return;
  }

  lockedContentHeight.value = Math.ceil(panelElement.getBoundingClientRect().height);

  await nextTick();
  reportContentHeight();
}

onMounted(async () => {
  await init();
  window.addEventListener("keydown", handleHotkeyRecordingKeydown, true);
  window.addEventListener("keydown", handleQuickToggleHotkeyRecordingKeydown, true);
  await lockContentHeight();
});

onBeforeUnmount(() => {
  unsubscribeStatus?.();
  unsubscribeHistory?.();
  clearTimeout(valueSaveTimer);
  clearTimeout(delaySaveTimer);
  window.removeEventListener("keydown", handleHotkeyRecordingKeydown, true);
  window.removeEventListener("keydown", handleQuickToggleHotkeyRecordingKeydown, true);
});
</script>
