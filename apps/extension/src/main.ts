import "./style.css";
import type { Purchase } from "@engage-form/domain";
import {
  parseReadyPurchaseJson,
  READY_PURCHASE_KEY,
  readyPurchaseSummary,
  type ReadyPurchaseStore,
} from "./storage.ts";

type ChromeRuntime = {
  scripting: {
    executeScript(injection: ScriptInjection, callback?: (results?: ScriptResult[]) => void): void;
  };
  tabs: {
    query(
      queryInfo: { active: boolean; currentWindow: boolean },
      callback: (tabs: { id?: number }[]) => void,
    ): void;
    sendMessage(
      tabId: number,
      message: ExtensionMessage,
      callback?: (response: ExtensionResponse) => void,
    ): void;
  };
  runtime: {
    lastError?: { message: string };
  };
  storage: ReadyPurchaseStore;
};

type ScriptInjection =
  | { target: { tabId: number }; files: string[] }
  | { target: { tabId: number }; func: () => string | null };

type ScriptResult = { result?: string | null };

type ExtensionMessage =
  | {
      type: "ENGAGE_FILL_READY_PURCHASE";
      purchase: Purchase;
    }
  | {
      type: "ENGAGE_COMPLETE_READY_PURCHASE";
      purchase: Purchase;
    };

type ExtensionResponse = {
  ok: boolean;
  message: string;
  step: string;
  filled: number;
  missed: string[];
};

declare const chrome: ChromeRuntime;

const app = document.querySelector<HTMLDivElement>("#app");
let readyPurchase: Purchase | null = null;

if (app === null) {
  throw new Error("App root missing.");
}

app.innerHTML = `
  <main class="popup">
    <section class="head">
      <div>
        <p>Engage Form</p>
        <h1 id="purchase-title">No ready purchase</h1>
      </div>
      <strong id="purchase-state" class="draft">Draft</strong>
    </section>

    <section class="purchase">
      <h2 id="purchase-item">Send from companion site</h2>
      <dl>
        <div><dt>Org</dt><dd id="purchase-org">-</dd></div>
        <div><dt>Amount</dt><dd id="purchase-amount">-</dd></div>
        <div><dt>Event</dt><dd id="purchase-event">-</dd></div>
        <div><dt>Recipient</dt><dd id="purchase-recipient">-</dd></div>
      </dl>
    </section>

    <button id="primary-action" type="button">Import purchase</button>
    <p id="status">Open the companion purchase, then import.</p>
  </main>
`;

const primaryButton = document.querySelector<HTMLButtonElement>("#primary-action");
const status = document.querySelector<HTMLParagraphElement>("#status");

if (primaryButton === null || status === null) {
  throw new Error("Popup controls missing.");
}

const primaryActionButton = primaryButton;
const statusEl = status;

loadReadyPurchase();

primaryActionButton.addEventListener("click", () => {
  runPrimaryAction();
});

function loadReadyPurchase() {
  chrome.storage.local.get([READY_PURCHASE_KEY], (items) => {
    readyPurchase = items[READY_PURCHASE_KEY] ?? null;
    renderReadyPurchase();
    if (readyPurchase === null) importFromActiveTab();
  });
}

function renderReadyPurchase() {
  const title = document.querySelector<HTMLElement>("#purchase-title");
  const state = document.querySelector<HTMLElement>("#purchase-state");
  const item = document.querySelector<HTMLElement>("#purchase-item");
  const org = document.querySelector<HTMLElement>("#purchase-org");
  const amount = document.querySelector<HTMLElement>("#purchase-amount");
  const event = document.querySelector<HTMLElement>("#purchase-event");
  const recipient = document.querySelector<HTMLElement>("#purchase-recipient");

  if (
    title === null ||
    state === null ||
    item === null ||
    org === null ||
    amount === null ||
    event === null ||
    recipient === null
  ) {
    throw new Error("Popup purchase fields missing.");
  }

  if (readyPurchase === null) {
    title.textContent = "No ready purchase";
    state.textContent = "Draft";
    state.className = "draft";
    item.textContent = "Send from companion site";
    org.textContent = "-";
    amount.textContent = "-";
    event.textContent = "-";
    recipient.textContent = "-";
    primaryActionButton.textContent = "Import purchase";
    primaryActionButton.disabled = false;
    return;
  }

  const summary = readyPurchaseSummary(readyPurchase);
  title.textContent = "Ready purchase";
  state.textContent = "Ready";
  state.className = "ready";
  item.textContent = summary.title;
  org.textContent = summary.org;
  amount.textContent = summary.amount;
  event.textContent = summary.event;
  recipient.textContent = summary.recipient;
  statusEl.textContent = "Open Engage, then complete.";
  primaryActionButton.textContent = "Complete form";
  primaryActionButton.disabled = false;
}

function runPrimaryAction() {
  setBusy("Checking current tab...");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const [tab] = tabs;

    if (tab?.id === undefined) {
      setReady("No active tab.");
      return;
    }

    const tabId = tab.id;
    importFromTab(tabId, (imported) => {
      if (imported) return;

      const purchase = readyPurchase;
      if (purchase === null) {
        setReady("Open the companion purchase first.");
        return;
      }

      fillActiveTab(tabId, { type: "ENGAGE_COMPLETE_READY_PURCHASE", purchase }, false);
    });
  });
}

function importFromActiveTab() {
  setBusy("Importing current tab...");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const [tab] = tabs;

    if (tab?.id === undefined) {
      setReady("No active tab.");
      return;
    }

    importFromTab(tab.id, (imported) => {
      if (!imported) setReady("No ready purchase found on this tab.");
    });
  });
}

function importFromTab(tabId: number, callback: (imported: boolean) => void) {
  chrome.scripting.executeScript({ target: { tabId }, func: readReadyPurchaseJson }, (results) => {
    if (chrome.runtime.lastError !== undefined) {
      callback(false);
      return;
    }

    const json = results?.[0]?.result;
    if (typeof json !== "string") {
      callback(false);
      return;
    }

    saveReadyPurchase(json, callback);
  });
}

function saveReadyPurchase(json: string, callback?: (imported: boolean) => void) {
  const purchase = parseReadyPurchaseJson(json);
  if (purchase === null) {
    setReady("Ready purchase data is invalid.");
    callback?.(false);
    return;
  }

  chrome.storage.local.set({ [READY_PURCHASE_KEY]: purchase }, () => {
    if (chrome.runtime.lastError !== undefined) {
      setReady(chrome.runtime.lastError.message);
      callback?.(false);
      return;
    }

    readyPurchase = purchase;
    renderReadyPurchase();
    statusEl.textContent = "Ready purchase imported.";
    callback?.(true);
  });
}

function fillActiveTab(tabId: number, message: ExtensionMessage, injected: boolean) {
  setBusy("Completing to review...");

  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError !== undefined) {
      if (injected) {
        setReady("Open the Engage form first.");
        return;
      }

      injectContentScript(tabId, message);
      return;
    }

    const missed = response.missed.length > 0 ? ` Missed: ${response.missed.join(", ")}.` : "";
    setReady(`${response.message} Step: ${response.step}. Filled: ${response.filled}.${missed}`);
  });
}

function injectContentScript(tabId: number, message: ExtensionMessage) {
  chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
    if (chrome.runtime.lastError !== undefined) {
      setReady("Open the Engage form first.");
      return;
    }

    fillActiveTab(tabId, message, true);
  });
}

function readReadyPurchaseJson() {
  const element = document.querySelector<HTMLTextAreaElement>("#engage-form-ready-purchase");
  return element?.value ?? null;
}

function setBusy(message: string) {
  primaryActionButton.disabled = true;
  statusEl.textContent = message;
}

function setReady(message: string) {
  primaryActionButton.disabled = false;
  statusEl.textContent = message;
}
