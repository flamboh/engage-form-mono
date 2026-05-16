import type { Purchase } from "@engage-form/domain";
import { createFillPlan, detectStep, type FillAction } from "@engage-form/fill-engine";
import {
  clickNextStep,
  type FileUploadResult,
  setChoice,
  setComboBox,
  setField,
  setFiles,
  setSelect,
  uploadMiss,
} from "./form-controls.ts";

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

type FillRunState = {
  purchase: Purchase;
  filled: number;
  pageCount: number;
};

type ChromeApi = {
  runtime: {
    getURL(path: string): string;
    onMessage: {
      addListener(
        callback: (
          message: ExtensionMessage,
          sender: unknown,
          sendResponse: (response: ExtensionResponse) => void,
        ) => boolean | void,
      ): void;
    };
  };
};

declare const chrome: ChromeApi;

const FILL_RUN_KEY = "engageFormFillRun";
const MAX_RUN_PAGES = 16;
const windowState = window as Window & { __engageFormContentLoaded?: boolean };

if (windowState.__engageFormContentLoaded !== true) {
  windowState.__engageFormContentLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const task =
      message.type === "ENGAGE_COMPLETE_READY_PURCHASE"
        ? startFillRun(message.purchase)
        : fillCurrentPage(message.purchase);

    void task
      .then((result) => {
        showToast(result.message);
        sendResponse(result);
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown fill error.";
        clearFillRun();
        showToast(errorMessage);
        sendResponse({
          ok: false,
          message: errorMessage,
          step: detectStep(pageHeading()),
          filled: 0,
          missed: [],
        });
      });
    return true;
  });

  window.setTimeout(() => {
    void resumeFillRun();
  }, 500);
}

async function fillCurrentPage(purchase: Purchase): Promise<ExtensionResponse> {
  const step = detectStep(pageHeading());
  const plan = createFillPlan(step, purchase);
  const result = await applyFillPlan(plan.actions);

  return {
    ok: result.missed.length === 0,
    message: result.message,
    step,
    filled: result.filled,
    missed: result.missed,
  };
}

async function startFillRun(purchase: Purchase): Promise<ExtensionResponse> {
  saveFillRun({ purchase, filled: 0, pageCount: 0 });
  return continueFillRun();
}

async function resumeFillRun() {
  const state = loadFillRun();
  if (state === null) return;

  const result = await continueFillRun();
  showToast(result.message);
}

async function continueFillRun(): Promise<ExtensionResponse> {
  const state = loadFillRun();
  const step = detectStep(pageHeading());
  if (state === null) {
    return {
      ok: false,
      message: "No active fill run.",
      step,
      filled: 0,
      missed: [],
    };
  }

  if (step === "review") {
    clearFillRun();
    return {
      ok: true,
      message: `Review reached. Filled ${state.filled} fields.`,
      step,
      filled: state.filled,
      missed: [],
    };
  }

  if (step === "unknown") {
    clearFillRun();
    return {
      ok: false,
      message: "Unknown Engage step. Stopped before advancing.",
      step,
      filled: state.filled,
      missed: [],
    };
  }

  if (state.pageCount >= MAX_RUN_PAGES) {
    clearFillRun();
    return {
      ok: false,
      message: "Stopped after too many Engage steps.",
      step,
      filled: state.filled,
      missed: [],
    };
  }

  const result = await fillCurrentPage(state.purchase);
  const filled = state.filled + result.filled;

  if (result.missed.length > 0) {
    clearFillRun();
    return { ...result, filled, ok: false };
  }

  if (!clickNextStep()) {
    clearFillRun();
    return {
      ok: false,
      message: "Current page filled, but no next button found.",
      step,
      filled,
      missed: [],
    };
  }

  saveFillRun({ ...state, filled, pageCount: state.pageCount + 1 });
  return {
    ok: true,
    message: `Continuing to review. Filled ${filled} fields.`,
    step,
    filled,
    missed: [],
  };
}

async function applyFillPlan(actions: FillAction[]) {
  let filled = 0;
  const missed: string[] = [];
  const stopMessages: string[] = [];

  for (const action of actions) {
    if (action.type === "stop") {
      stopMessages.push(action.message);
      continue;
    }

    const result = await applyAction(action);
    if (result === true || (typeof result === "object" && result.ok)) {
      filled += 1;
    } else {
      missed.push(typeof result === "object" ? result.message : actionLabel(action));
      if (action.type === "file") break;
    }
  }

  if (stopMessages.length > 0) {
    return { filled, missed, message: stopMessages.join(" ") };
  }

  if (missed.length > 0) {
    return { filled, missed, message: `Filled ${filled}; missed ${missed.join(", ")}.` };
  }

  return { filled, missed, message: "Filled current page." };
}

async function applyAction(action: Exclude<FillAction, { type: "stop" }>) {
  if (action.type === "text") {
    return setField(action.labelIncludes, action.value, "input");
  }

  if (action.type === "textarea") {
    return setField(action.labelIncludes, action.value, "textarea");
  }

  if (action.type === "checkbox") {
    return setChoice(action.labelIncludes, "checkbox", action.checked);
  }

  if (action.type === "radio") {
    return setChoice(action.labelIncludes, "radio", true);
  }

  if (action.type === "combobox") {
    return setComboBox(action.labelIncludes, action.valueIncludes);
  }

  if (action.type === "file") {
    return setFiles(action.labelIncludes, action.files, uploadFiles);
  }

  return setSelect(action.labelIncludes, action.valueIncludes);
}

async function uploadFiles(
  selector: string,
  files: {
    filename: string;
    contentType: string;
    storageKey: string;
  }[],
  dropSelector: string,
): Promise<FileUploadResult> {
  const input = document.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) return uploadMiss("Tagged file input disappeared.");

  const dropTarget = document.querySelector(dropSelector);
  if (!(dropTarget instanceof HTMLElement)) return uploadMiss("Tagged upload target disappeared.");

  return assignFiles(input, files, dropTarget);
}

async function assignFiles(
  input: HTMLInputElement,
  files: {
    filename: string;
    contentType: string;
    storageKey: string;
  }[],
  dropTarget: HTMLElement,
): Promise<FileUploadResult> {
  const transfer = new DataTransfer();

  for (const file of files) {
    const response = await fetch(chrome.runtime.getURL(file.storageKey));
    if (!response.ok) return uploadMiss(`Upload asset missing: ${file.filename}.`);

    transfer.items.add(
      new File([await response.blob()], file.filename, { type: file.contentType }),
    );
  }

  input.files = transfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  dropTarget.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  return { ok: true };
}

function pageHeading() {
  return Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((heading) => heading.textContent ?? "")
    .join(" ");
}

function actionLabel(action: Exclude<FillAction, { type: "stop" }>) {
  if (action.type === "text" || action.type === "textarea" || action.type === "file") {
    return `${action.type}:${action.labelIncludes}`;
  }

  if (action.type === "checkbox") {
    return `checkbox:${action.labelIncludes}`;
  }

  return `${action.type}:${action.labelIncludes}`;
}

function loadFillRun() {
  const json = window.sessionStorage.getItem(FILL_RUN_KEY);
  if (json === null) return null;

  try {
    return JSON.parse(json) as FillRunState;
  } catch {
    clearFillRun();
    return null;
  }
}

function saveFillRun(state: FillRunState) {
  window.sessionStorage.setItem(FILL_RUN_KEY, JSON.stringify(state));
}

function clearFillRun() {
  window.sessionStorage.removeItem(FILL_RUN_KEY);
}

function showToast(message: string) {
  const existing = document.querySelector("#engage-form-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.id = "engage-form-toast";
  toast.textContent = message;
  toast.style.cssText = [
    "position: fixed",
    "right: 18px",
    "bottom: 18px",
    "z-index: 2147483647",
    "max-width: 320px",
    "padding: 12px 14px",
    "border: 1px solid #171717",
    "border-radius: 8px",
    "background: #fffefa",
    "color: #171717",
    "font: 14px/1.4 system-ui, sans-serif",
    "box-shadow: 0 16px 40px rgb(33 30 24 / 18%)",
  ].join(";");

  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 5000);
}
