// eslint-disable-next-line
const CUSTOM_SPRINT_STATS_WRAPPER_ID = 'ghx-custom-stats-wrapper';

// eslint-disable-next-line
const TIME_ELAPSED_CLASS_NAME = 'ghx-issue-time-elapsed';

// eslint-disable-next-line
const HEADER_STATS_FONT_SIZE = '11px';

const STATUSES = {
  TODO: 'to do',
  IN_PROGRESS: 'in progress',
  CODE_REVIEW: 'code review',
  PEER_REVIEW: 'peer review',
  REVIEW: 'review',
  IN_REVIEW: 'in review',
  PRODUCT_REVIEW: 'product review',
  DONE: 'done',
  BLOCKED: 'blocked'
};

const colors = {
  byStatus: {
    [STATUSES.TODO]: '#42526e',
    [STATUSES.IN_PROGRESS]: '#3ea9ff',
    [STATUSES.CODE_REVIEW]: '#009688',
    [STATUSES.PEER_REVIEW]: '#009688',
    [STATUSES.IN_REVIEW]: '#009688',
    [STATUSES.REVIEW]: '#009688',
    [STATUSES.PRODUCT_REVIEW]: '#3f51b5',
    [STATUSES.DONE]: '#4dbc52',
    [STATUSES.BLOCKED]: '#c2185b'
  },
};

const options = {
  flags: {
    HOURS_IN_STATUS_ENABLED: 'JIRA_PLUGIN_HOURS_IN_STATUS_ENABLED',
    SHOW_REVIEW_PAIRS_ENABLED: 'JIRA_PLUGIN_SHOW_REVIEW_PAIRS_ENABLED',
    SHOW_REVIEW_COUNTS_ENABLED: 'SHOW_REVIEW_COUNTS_ENABLED',
  },
};

const localStorageService = (() => ({
  get: async (key) => {
    try {
      return chrome.storage.sync.get([key]).then((result) => result[key]);
    } catch (error) {
      console.error(error);
      return undefined;
    }
  },
  set: (key, value) => {
    try {
      chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      console.error(error);
    }
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
