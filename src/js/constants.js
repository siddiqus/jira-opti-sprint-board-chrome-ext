const options = {
  flags: {
    HOURS_IN_STATUS_ENABLED: "JIRA_PLUGIN_HOURS_IN_STATUS_ENABLED",
  },
};

function detectBrowser() {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    // Check if the browser is Microsoft Edge by looking for the 'msBrowser' property
    if (
      navigator.userAgent.indexOf("Edg") !== -1 ||
      chrome.runtime.hasOwnProperty("msBrowser")
    ) {
      return "Edge";
    } else {
      return "Chrome";
    }
  } else {
    // If the chrome object is not present or lacks the runtime property, it's not a Chromium-based browser
    return "Unknown";
  }
}

const syncVariableForBrowser = detectBrowser() === "Edge" ? "sync2" : "sync";

const localStorageService = {
  get: async (key) => {
    return chrome.storage[syncVariableForBrowser].get([key]).then((result) => {
      return result[key];
    });
  },
  set: (key, value) => {
    chrome.storage[syncVariableForBrowser].set({ [key]: value });
  },
};
