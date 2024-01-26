export const getDateFromSeconds = (seconds: number) => new Date(seconds * 1000);
export const getSecondsFromDate = (d: Date = new Date()) =>
  (d.getTime() / 1000) | 0;
export const getSecondsFromDays = (days: number) => days * 24 * 60 * 60;
export const getSecondsFromYears = (years: number) =>
  getSecondsFromDays(years * 365);
