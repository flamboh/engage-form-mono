import { samplePurchase } from "@engage-form/domain";
import { createFillPlan, detectStep, type FillAction } from "@engage-form/fill-engine";

type ExtensionMessage = {
  type: "ENGAGE_FILL_SAMPLE";
};

type ExtensionResponse = {
  ok: boolean;
  message: string;
  step: string;
  filled: number;
};

type ChromeRuntime = {
  runtime: {
    onMessage: {
      addListener(
        callback: (
          message: ExtensionMessage,
          sender: unknown,
          sendResponse: (response: ExtensionResponse) => void,
        ) => void,
      ): void;
    };
  };
};

declare const chrome: ChromeRuntime;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "ENGAGE_FILL_SAMPLE") {
    return;
  }

  const heading = pageHeading();
  const step = detectStep(heading);
  const plan = createFillPlan(step, samplePurchase);
  const result = applyFillPlan(plan.actions);
  showToast(result.message);
  sendResponse({ ok: true, message: result.message, step, filled: result.filled });
});

function applyFillPlan(actions: FillAction[]) {
  let filled = 0;
  const stopMessages: string[] = [];

  for (const action of actions) {
    if (action.type === "stop") {
      stopMessages.push(action.message);
      continue;
    }

    if (applyAction(action)) {
      filled += 1;
    }
  }

  if (stopMessages.length > 0) {
    return { filled, message: stopMessages.join(" ") };
  }

  return { filled, message: "Filled current page." };
}

function applyAction(action: Exclude<FillAction, { type: "stop" }>) {
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

  return setSelect(action.labelIncludes, action.valueIncludes);
}

function setField(labelIncludes: string, value: string, selector: "input" | "textarea") {
  const control = findControl(labelIncludes, selector);
  if (control === null) {
    return false;
  }

  control.value = value;
  dispatchInput(control);
  return true;
}

function setChoice(labelIncludes: string, type: "checkbox" | "radio", checked: boolean) {
  const input = findChoice(labelIncludes, type);
  if (input === null) {
    return false;
  }

  if (input.checked !== checked) {
    input.click();
  }

  return true;
}

function setSelect(labelIncludes: string, valueIncludes: string) {
  const select = findControl(labelIncludes, "select");
  if (select === null) {
    return false;
  }

  const option = Array.from(select.options).find((item) =>
    includes(item.textContent, valueIncludes),
  );
  if (option === undefined) {
    return false;
  }

  select.value = option.value;
  dispatchInput(select);
  return true;
}

function findControl<T extends "input" | "textarea" | "select">(
  labelIncludes: string,
  selector: T,
) {
  const direct = Array.from(
    document.querySelectorAll<
      T extends "input"
        ? HTMLInputElement
        : T extends "textarea"
          ? HTMLTextAreaElement
          : HTMLSelectElement
    >(selector),
  ).find((control) => includes(accessibleText(control), labelIncludes));

  if (direct !== undefined) {
    return direct;
  }

  const labelNode = findTextContainer(labelIncludes);
  if (labelNode === null) {
    return null;
  }

  return nextControl(labelNode, selector);
}

function findChoice(labelIncludes: string, type: "checkbox" | "radio") {
  const choices = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="${type}"]`));
  return choices.find((choice) => includes(choiceText(choice), labelIncludes)) ?? null;
}

function choiceText(choice: HTMLInputElement) {
  const container = choice.closest("label, div, li, p");
  return `${accessibleText(choice)} ${container?.textContent ?? ""}`;
}

function accessibleText(element: Element) {
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("placeholder"),
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("description"),
  ]
    .filter((value) => value !== null)
    .join(" ");
}

function findTextContainer(labelIncludes: string) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("label, div, p, span, strong"));
  return nodes.find((node) => includes(node.textContent, labelIncludes)) ?? null;
}

function nextControl<T extends "input" | "textarea" | "select">(start: Element, selector: T) {
  const controls = Array.from(
    document.querySelectorAll<
      T extends "input"
        ? HTMLInputElement
        : T extends "textarea"
          ? HTMLTextAreaElement
          : HTMLSelectElement
    >(selector),
  );
  const startRect = start.getBoundingClientRect();
  return controls.find((control) => control.getBoundingClientRect().top >= startRect.top) ?? null;
}

function pageHeading() {
  return Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((heading) => heading.textContent ?? "")
    .join(" ");
}

function dispatchInput(control: HTMLElement) {
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function includes(value: string | null, search: string) {
  return normalize(value ?? "").includes(normalize(search));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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
