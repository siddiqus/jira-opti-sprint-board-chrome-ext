const SPRINT_HEADER_ID = "#ghx-column-header-group";
const TIME_ELAPSED_CLASS_NAME = "ghx-issue-time-elapsed";

const options = {
  flags: {
    HOURS_IN_STATUS_ENABLED: "JIRA_PLUGIN_HOURS_IN_STATUS_ENABLED",
    SHOW_REVIEW_PAIRS_ENABLED: "JIRA_PLUGIN_SHOW_REVIEW_PAIRS_ENABLED",
  },
};

const localStorageService = (() => {
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

  return {
    get: async (key) => {
      return chrome.storage[syncVariableForBrowser]
        .get([key])
        .then((result) => {
          return result[key];
        });
    },
    set: (key, value) => {
      chrome.storage[syncVariableForBrowser].set({ [key]: value });
    },
  };
})();

async function setDefaults() {
  if (
    [undefined, null].includes(
      await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED)
    )
  ) {
    localStorageService.set(options.flags.HOURS_IN_STATUS_ENABLED, true);
  }

  if (
    [undefined, null].includes(
      await localStorageService.get(options.flags.SHOW_REVIEW_PAIRS_ENABLED)
    )
  ) {
    localStorageService.set(options.flags.SHOW_REVIEW_PAIRS_ENABLED, false);
  }
}
