export const daysUntilDate = (futureDate: Date) => {
  const now = new Date();
  const _MS_PER_DAY = 1000 * 60 * 60 * 24;

  const utc1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utc2 = Date.UTC(
    futureDate.getFullYear(),
    futureDate.getMonth(),
    futureDate.getDate()
  );

  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
};

export const dateOlderThen7Days = (date: string): boolean => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return new Date(date) < sevenDaysAgo;
};
