export const EASTERN_TIME_ZONE = "America/New_York";

const easternDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EASTERN_TIME_ZONE,
});

const easternDateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: EASTERN_TIME_ZONE,
  year: "numeric",
});

function getDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return { day, month, year };
}

function getTimeParts(value = "00:00:00") {
  const [hour = 0, minute = 0, second = 0] = value.split(":").map(Number);

  return { hour, minute, second };
}

function getEasternOffsetMs(date: Date) {
  const parts = easternDateTimePartsFormatter.formatToParts(date);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const easternWallClockAsUtc = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
  );

  return easternWallClockAsUtc - date.getTime();
}

export function getEasternDateKey(date = new Date()) {
  return easternDateFormatter.format(date);
}

export function addDaysToDateKey(value: string, days: number) {
  const { day, month, year } = getDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function getUtcDateFromEasternDateTime(
  dateKey: string,
  timeValue = "00:00:00",
) {
  const { day, month, year } = getDateParts(dateKey);
  const { hour, minute, second } = getTimeParts(timeValue);
  const targetWallClockAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
  );
  let result = new Date(targetWallClockAsUtc);

  for (let index = 0; index < 3; index += 1) {
    result = new Date(targetWallClockAsUtc - getEasternOffsetMs(result));
  }

  return result;
}

export function getEasternDayBounds(dateKey = getEasternDateKey()) {
  return {
    end: getUtcDateFromEasternDateTime(addDaysToDateKey(dateKey, 1)),
    start: getUtcDateFromEasternDateTime(dateKey),
    workDate: dateKey,
  };
}

export function getEasternWeekBounds(dateKey = getEasternDateKey()) {
  const { day, month, year } = getDateParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekStartKey = addDaysToDateKey(dateKey, -date.getUTCDay());

  return {
    end: getUtcDateFromEasternDateTime(addDaysToDateKey(weekStartKey, 7)),
    start: getUtcDateFromEasternDateTime(weekStartKey),
    weekStartKey,
  };
}
