import "./style.css";

type ChromeRuntime = {
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
};

type ExtensionMessage = {
  type: "ENGAGE_FILL_SAMPLE";
};

type ExtensionResponse = {
  ok: boolean;
  message: string;
  step: string;
  filled: number;
};

declare const chrome: ChromeRuntime;

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("App root missing.");
}

app.innerHTML = `
  <main class="popup">
    <section class="head">
      <div>
        <p>Engage Form</p>
        <h1>Ready purchase</h1>
      </div>
      <strong class="ready">Ready</strong>
    </section>

    <section class="purchase">
      <h2>Mort Garson music vinyl</h2>
      <dl>
        <div><dt>Org</dt><dd>Album Listening Club</dd></div>
        <div><dt>Amount</dt><dd>$22.98</dd></div>
        <div><dt>Event</dt><dd>04/21, 6:30pm</dd></div>
        <div><dt>Recipient</dt><dd>Aidan O'Donnell</dd></div>
      </dl>
    </section>

    <button id="fill-page" type="button">Fill current Engage page</button>
    <p id="status">Open Engage form, then fill page by page.</p>
  </main>
`;

const fillButton = document.querySelector<HTMLButtonElement>("#fill-page");
const status = document.querySelector<HTMLParagraphElement>("#status");

if (fillButton === null || status === null) {
  throw new Error("Popup controls missing.");
}

fillButton.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const [tab] = tabs;

    if (tab?.id === undefined) {
      status.textContent = "No active tab.";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "ENGAGE_FILL_SAMPLE" }, (response) => {
      if (chrome.runtime.lastError !== undefined) {
        status.textContent = "Open the Engage form first.";
        return;
      }

      status.textContent = `${response.message} Step: ${response.step}. Filled: ${response.filled}.`;
    });
  });
});
