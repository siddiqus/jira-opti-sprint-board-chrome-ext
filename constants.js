const options = {
  flags: {
    HOURS_IN_STATUS_ENABLED: "JIRA_PLUGIN_HOURS_IN_STATUS_ENABLED",
  },
};

const localStorageService = {
  get: async (key) => {
    return chrome.storage.sync.get([key]).then((result) => {
      return result[key];
    });
  },
  set: (key, value) => {
    chrome.storage.sync.set({ [key]: value });
  },
};
