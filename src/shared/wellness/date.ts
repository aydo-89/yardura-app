// Date utilities for wellness tracking
export const mondayStart = (d: Date): Date => {
  const t = new Date(d);
  const day = (t.getDay() + 6) % 7; // Monday = 0
  t.setDate(t.getDate() - day);
  t.setHours(0, 0, 0, 0);
  return t;
};

export const formatWeekLabel = (startDate: Date): string => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startMonth} ${startDay}-${endDay}`;
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }
};

export const buildWeeklySeries = (now: Date, weeksCount: number = 8): Date[] => {
  const weeks: Date[] = [];
  let current = mondayStart(now);

  for (let i = 0; i < weeksCount; i++) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() - 7);
  }

  return weeks;
};
