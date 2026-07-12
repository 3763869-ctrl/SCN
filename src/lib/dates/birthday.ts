import { getEasternDateKey } from "@/lib/dates/eastern-time";

function getParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return { day, month, year };
}

export function getAgeFromDateOfBirth(
  dateOfBirth: string | null | undefined,
  todayKey = getEasternDateKey(),
) {
  if (!dateOfBirth) {
    return null;
  }

  const birth = getParts(dateOfBirth);
  const today = getParts(todayKey);
  let age = today.year - birth.year;

  if (
    today.month < birth.month ||
    (today.month === birth.month && today.day < birth.day)
  ) {
    age -= 1;
  }

  return age;
}

export function getBirthdayDue(
  dateOfBirth: string | null | undefined,
  lastShownYear: number | null | undefined,
  todayKey = getEasternDateKey(),
) {
  if (!dateOfBirth) {
    return { age: null, due: false };
  }

  const birth = getParts(dateOfBirth);
  const today = getParts(todayKey);
  const birthdayPassedThisYear =
    today.month > birth.month ||
    (today.month === birth.month && today.day >= birth.day);
  const age = getAgeFromDateOfBirth(dateOfBirth, todayKey);

  return {
    age,
    due: birthdayPassedThisYear && lastShownYear !== today.year,
  };
}
