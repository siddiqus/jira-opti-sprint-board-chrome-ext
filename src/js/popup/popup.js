const enableHoursDisplayBtn = document.getElementById('enableHoursDisplay');
const disableHoursDisplayBtn = document.getElementById('disableHoursDisplay');

const enableReviewPairsBtn = document.getElementById('enableReviewPairs');
const disableReviewPairsBtn = document.getElementById('disableReviewPairs');

const enableReviewCountsBtn = document.getElementById('enableReviewCounts');
const disableReviewCountsBtn = document.getElementById('disableReviewCounts');

// Set initial state based on local storage
async function loadHoursDisplayFlagDefault() {
  const isHoursEnabled =
    (await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED)) || true; // show by default

  if (isHoursEnabled) {
    enableHoursDisplayBtn.checked = true;
  } else {
    disableHoursDisplayBtn.checked = true;
  }
}

async function loadReviewPairsFlagDefault() {
  const isEnabled =
    (await localStorageService.get(options.flags.SHOW_REVIEW_PAIRS_ENABLED)) || false; // hide by default

  if (isEnabled) {
    enableReviewPairsBtn.checked = true;
  } else {
    disableReviewPairsBtn.checked = true;
  }
}

async function loadReviewCountsFlagDefault() {
  const isEnabled =
    (await localStorageService.get(options.flags.SHOW_REVIEW_COUNTS_ENABLED)) || true; // show by default

  if (isEnabled) {
    enableReviewCountsBtn.checked = true;
  } else {
    disableReviewCountsBtn.checked = true;
  }
}

(async function onLoad() {
  await loadHoursDisplayFlagDefault();
  await loadReviewPairsFlagDefault();
  await loadReviewCountsFlagDefault();
})();

// Add event listeners
enableHoursDisplayBtn.addEventListener('change', () => {
  if (enableHoursDisplayBtn.checked) {
    localStorageService.set(options.flags.HOURS_IN_STATUS_ENABLED, true);
  }
});

disableHoursDisplayBtn.addEventListener('change', () => {
  if (disableHoursDisplayBtn.checked) {
    localStorageService.set(options.flags.HOURS_IN_STATUS_ENABLED, false);
  }
});

enableReviewPairsBtn.addEventListener('change', () => {
  if (enableReviewPairsBtn.checked) {
    localStorageService.set(options.flags.SHOW_REVIEW_PAIRS_ENABLED, true);
  }
});

disableReviewPairsBtn.addEventListener('change', () => {
  if (disableReviewPairsBtn.checked) {
    localStorageService.set(options.flags.SHOW_REVIEW_PAIRS_ENABLED, false);
  }
});

enableReviewCountsBtn.addEventListener('change', () => {
  if (enableReviewCountsBtn.checked) {
    localStorageService.set(options.flags.SHOW_REVIEW_COUNTS_ENABLED, true);
  }
});

disableReviewCountsBtn.addEventListener('change', () => {
  if (disableReviewCountsBtn.checked) {
    localStorageService.set(options.flags.SHOW_REVIEW_COUNTS_ENABLED, false);
  }
});
