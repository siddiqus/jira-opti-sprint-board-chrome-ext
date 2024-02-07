const enableHoursDisplayBtn = document.getElementById("enableHoursDisplay");
const disableHoursDisplayBtn = document.getElementById("disableHoursDisplay");

const enableReviewPairsBtn = document.getElementById("enableReviewPairs");
const disableReviewPairsBtn = document.getElementById("disableReviewPairs");

// Set initial state based on local storage
async function loadHoursDisplayFlagDefault() {
  const isHoursEnabled = await localStorageService.get(
    options.flags.HOURS_IN_STATUS_ENABLED
  );

  if (isHoursEnabled) {
    enableHoursDisplayBtn.checked = true;
  } else {
    disableHoursDisplayBtn.checked = true;
  }
}

async function loadReviewPairsFlagDefault() {
  const isHoursEnabled = await localStorageService.get(
    options.flags.SHOW_REVIEW_PAIRS_ENABLED
  );

  if (isHoursEnabled) {
    enableReviewPairsBtn.checked = true;
  } else {
    disableReviewPairsBtn.checked = true;
  }
}

(async function onLoad() {
  await loadHoursDisplayFlagDefault();
  await loadReviewPairsFlagDefault();
})();

// Add event listeners
enableHoursDisplayBtn.addEventListener("change", function () {
  if (enableHoursDisplayBtn.checked) {
    localStorageService.set(options.flags.HOURS_IN_STATUS_ENABLED, true);
  }
});

disableHoursDisplayBtn.addEventListener("change", function () {
  if (disableHoursDisplayBtn.checked) {
    localStorageService.set(options.flags.HOURS_IN_STATUS_ENABLED, false);
  }
});

enableReviewPairsBtn.addEventListener("change", function () {
  if (enableReviewPairsBtn.checked) {
    localStorageService.set(options.flags.SHOW_REVIEW_PAIRS_ENABLED, true);
  }
});

disableReviewPairsBtn.addEventListener("change", function () {
  if (disableReviewPairsBtn.checked) {
    localStorageService.set(options.flags.SHOW_REVIEW_PAIRS_ENABLED, false);
  }
});
