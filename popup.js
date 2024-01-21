const enableHoursDisplayBtn = document.getElementById("enableHoursDisplay");
const disableHoursDisplayBtn = document.getElementById("disableHoursDisplay");

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

(async function onLoad() {
  await loadHoursDisplayFlagDefault();
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
