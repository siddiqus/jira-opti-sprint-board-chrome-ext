async function run() {
  setDefaults();

  if (isBacklog()) {
    await enhanceBacklog();
  }

  if (isSprintBoard()) {
    await enhanceSprintBoard();
  }
}

async function loop(fn) {
  await fn();

  setInterval(async () => {
    await fn();
  }, 2000);
}

loop(run);
