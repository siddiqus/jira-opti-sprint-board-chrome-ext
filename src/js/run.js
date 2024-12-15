async function run() {
  setDefaults();

  if (isBacklog()) {
    await enhanceBacklog();
  }

  if (isSprintBoard()) {
    await enhanceSprintBoard();
    // attachCustomPopupHtml();
    // attachPopupButton();
  }

  if (isSprintReport()) {
    attachCustomPopupHtml();
    await enhanceSprintReport();
  }
}

async function loop(fn) {
  setInterval(async () => {
    await fn();
  }, 3000);

  setTimeout(fn, 2000);
}

loop(run);
