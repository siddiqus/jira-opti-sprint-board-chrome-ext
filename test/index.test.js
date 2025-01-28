function getEffectiveHoursWithoutWeekend(timeInHours, currentDate = new Date()) {
  const MS_IN_HOURS = 60 * 60 * 1000;
  const WEEKEND_DAYS = [5, 6]; // friday saturday

  if (timeInHours < 24) {
    return timeInHours;
  }

  const startTime = new Date(currentDate.getTime() - timeInHours * MS_IN_HOURS);

  const currentTime = new Date(currentDate);

  let effectiveHours = timeInHours;

  while (true) {
    if (currentTime.getDate() < startTime.getDate()) {
      break;
    }

    const currentDay = currentTime.getDay();

    if (WEEKEND_DAYS.includes(currentDay) && currentDay !== startTime.getDay()) {
      effectiveHours -= 24;
    }

    if (WEEKEND_DAYS.includes(currentDay) && currentDay === startTime.getDay()) {
      effectiveHours -= 24 - startTime.getHours();
    }

    currentTime.setDate(currentTime.getDate() - 1);
  }

  return Math.max(effectiveHours, 0);
}

describe('tests', () => {
  // what if it goes more than a week?

  it('start on thursday 10 am, now it is monday 4pm', () => {
    const currentDate = new Date(2024, 6, 8);
    currentDate.setHours(16);

    const hours = getEffectiveHoursWithoutWeekend(102, currentDate);
    const expected = 54;
    expect(hours).toEqual(expected);
  });

  it('start on sunday 10 am, now it is monday 2pm', () => {
    const currentDate = new Date(2024, 6, 8);
    currentDate.setHours(14);

    const hours = getEffectiveHoursWithoutWeekend(28, currentDate);
    const expected = 28;
    expect(hours).toEqual(expected);
  });

  it('start on friday 2 pm, now it is monday 10am', () => {
    const currentDate = new Date(2024, 6, 8);
    currentDate.setHours(10);

    const hours = getEffectiveHoursWithoutWeekend(44, currentDate);
    const expected = 34;
    expect(hours).toEqual(expected);
  });

  it('start on sunday 10 am, now it is sunday 2pm', () => {
    const currentDate = new Date(2024, 6, 7);
    currentDate.setHours(14);

    const hours = getEffectiveHoursWithoutWeekend(4, currentDate);
    const expected = 4;
    expect(hours).toEqual(expected);
  });

  it('start on friday 10 am, now it is saturday 2pm', () => {
    const currentDate = new Date(2024, 6, 13);
    currentDate.setHours(14);

    const hours = getEffectiveHoursWithoutWeekend(44, currentDate);
    const expected = 0;
    expect(hours).toEqual(expected);
  });

  it('start on tuesday 19th nov 10 am, now it is tuesday 3rd December 10 am', () => {
    const currentDate = new Date(2024, 6, 13);
    currentDate.setHours(14);

    const start = new Date('2024-11-19 10:00:00');
    const end = new Date('2024-12-03 10:00:00');

    const ms = end.getTime() - start.getTime();
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const resultHours = getEffectiveHoursWithoutWeekend(hours, currentDate);
    const expected = hours - 4 * 24;
    expect(resultHours).toEqual(expected);
  });
});
