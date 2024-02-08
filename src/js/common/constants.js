// eslint-disable-next-line
const SPRINT_HEADER_ID = '#ghx-column-header-group';
// eslint-disable-next-line
const TIME_ELAPSED_CLASS_NAME = 'ghx-issue-time-elapsed';

const options = {
  flags: {
    HOURS_IN_STATUS_ENABLED: 'JIRA_PLUGIN_HOURS_IN_STATUS_ENABLED',
    SHOW_REVIEW_PAIRS_ENABLED: 'JIRA_PLUGIN_SHOW_REVIEW_PAIRS_ENABLED',
  },
};

const localStorageService = (() => ({
  get: async (key) => chrome.storage.sync.get([key]).then((result) => result[key]),
  set: (key, value) => {
    chrome.storage.sync.set({ [key]: value });
  },
}))();

// eslint-disable-next-line
async function setDefaults() {
  if (
    [undefined, null].includes(await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED))
  ) {
    localStorageService.set(options.flags.HOURS_IN_STATUS_ENABLED, true);
  }

  if (
    [undefined, null].includes(
      await localStorageService.get(options.flags.SHOW_REVIEW_PAIRS_ENABLED),
    )
  ) {
    localStorageService.set(options.flags.SHOW_REVIEW_PAIRS_ENABLED, false);
  }
}
