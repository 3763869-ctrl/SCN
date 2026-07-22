type PhoneSystemSettings = {
  active: boolean;
  after_hours_greeting: string;
  availability_mode: "business_hours" | "worker_clock";
  business_days: number[];
  business_end_time: string;
  business_start_time: string;
  business_timezone: string;
  ring_timeout_seconds: number;
  voicemail_greeting: string;
  working_hours_greeting: string;
};

export const defaultPhoneSystemSettings: PhoneSystemSettings = {
  active: true,
  after_hours_greeting:
    "Thank you for calling S C N. We are currently closed. Please leave a message and we will call you back at the first opportunity.",
  availability_mode: "business_hours",
  business_days: [0, 1, 2, 3, 4, 5],
  business_end_time: "17:00",
  business_start_time: "09:00",
  business_timezone: "America/New_York",
  ring_timeout_seconds: 60,
  voicemail_greeting: "No one is available right now. Please leave a message after the beep.",
  working_hours_greeting:
    "Thank you for calling S C N. Please enter the worker extension you are trying to reach.",
};

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export function isWithinBusinessHours(settings: PhoneSystemSettings, now = new Date()) {
  if (!settings.active) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: settings.business_timezone,
    weekday: "short",
  }).formatToParts(now);
  const weekdayLabel = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayLabel);
  const currentMinutes = hour * 60 + minute;
  const startMinutes = timeToMinutes(settings.business_start_time);
  const endMinutes = timeToMinutes(settings.business_end_time);

  if (!settings.business_days.includes(day)) {
    return false;
  }

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function usesBusinessHours(settings: PhoneSystemSettings) {
  return settings.availability_mode === "business_hours";
}

export function normalizePhoneSystemSettings(
  settings: Partial<PhoneSystemSettings> | null | undefined,
): PhoneSystemSettings {
  return {
    ...defaultPhoneSystemSettings,
    ...settings,
    availability_mode:
      settings?.availability_mode === "worker_clock" ? "worker_clock" : "business_hours",
    business_days: settings?.business_days?.length
      ? settings.business_days
      : defaultPhoneSystemSettings.business_days,
    ring_timeout_seconds: Math.min(
      120,
      Math.max(10, settings?.ring_timeout_seconds ?? defaultPhoneSystemSettings.ring_timeout_seconds),
    ),
  };
}
