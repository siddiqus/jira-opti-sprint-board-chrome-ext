async function run() {
  setDefaults();

  await enhanceSprintBoard();
  await enhanceBacklog();
}

async function loop(fn) {
  await fn();

  setInterval(async () => {
    await fn();
  }, 2000);
}

loop(run);
