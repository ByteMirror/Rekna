import { Temporal } from "temporal-polyfill";

const TIME_ZONE_ALIASES = new Map<string, string>([
  ["berlin", "Europe/Berlin"],
  ["cet", "Europe/Berlin"],
  ["cest", "Europe/Berlin"],
  ["gmt", "UTC"],
  ["hkt", "Asia/Hong_Kong"],
  ["hong kong", "Asia/Hong_Kong"],
  ["london", "Europe/London"],
  ["madrid", "Europe/Madrid"],
  ["new york", "America/New_York"],
  ["pst", "America/Los_Angeles"],
  ["pdt", "America/Los_Angeles"],
  ["pt", "America/Los_Angeles"],
  ["utc", "UTC"],
]);

export type DateTimeOptions = {
  localTimeZone?: string;
  now?: () => Temporal.Instant;
};

export function evaluateDateTimeExpression(
  expression: string,
  options: DateTimeOptions = {}
) {
  const trimmed = expression.trim();

  if (!trimmed) {
    return null;
  }

  const now = options.now ?? (() => Temporal.Now.instant());
  const localTimeZone =
    options.localTimeZone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC";

  if (/^(?:time|now)$/i.test(trimmed)) {
    return formatZonedDateTime(now().toZonedDateTimeISO(localTimeZone), false);
  }

  const relativeDate = evaluateRelativeDateExpression(
    trimmed,
    now,
    localTimeZone
  );

  if (relativeDate) {
    return relativeDate;
  }

  const zoneTimeMatch = trimmed.match(/^time in (.+)$/i);
  if (zoneTimeMatch?.[1]) {
    const timeZone = resolveTimeZone(zoneTimeMatch[1]);

    if (timeZone) {
      return formatZonedDateTime(now().toZonedDateTimeISO(timeZone), false);
    }
  }

  const suffixTimeMatch = trimmed.match(/^(.+?)\s+time$/i);
  if (suffixTimeMatch?.[1]) {
    const timeZone = resolveTimeZone(suffixTimeMatch[1]);

    if (timeZone) {
      return formatZonedDateTime(now().toZonedDateTimeISO(timeZone), false);
    }
  }

  const explicitMatch = trimmed.match(
    /^(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+(.+?)\s+(?:in|into|to|as)\s+(.+)$/i
  );

  if (!explicitMatch) {
    return null;
  }

  const sourceTimeZone = resolveTimeZone(explicitMatch[3] ?? "");
  const targetTimeZone = resolveTimeZone(explicitMatch[4] ?? "");

  if (!sourceTimeZone || !targetTimeZone) {
    return null;
  }

  const date = explicitMatch[1]
    ? Temporal.PlainDate.from(explicitMatch[1])
    : now().toZonedDateTimeISO(sourceTimeZone).toPlainDate();
  const time = parseClockTime(explicitMatch[2] ?? "");

  if (!time) {
    return null;
  }

  const sourceDateTime = Temporal.ZonedDateTime.from({
    day: date.day,
    hour: time.hour,
    minute: time.minute,
    month: date.month,
    second: 0,
    timeZone: sourceTimeZone,
    year: date.year,
  });
  const targetDateTime = sourceDateTime.withTimeZone(targetTimeZone);

  return formatZonedDateTime(targetDateTime, true);
}

function evaluateRelativeDateExpression(
  expression: string,
  now: () => Temporal.Instant,
  localTimeZone: string
) {
  const match = expression.match(
    /^(today|tomorrow|yesterday)(?:\s*([+-])\s*(\d+)\s+(day|days|week|weeks|month|months|year|years))?$/i
  );

  if (!match) {
    return null;
  }

  const today = now().toZonedDateTimeISO(localTimeZone).toPlainDate();
  const anchor = (match[1] ?? "").toLowerCase();
  const operator = match[2];
  const rawAmount = match[3];
  const unit = match[4]?.toLowerCase();
  const baseDate =
    anchor === "tomorrow"
      ? today.add({ days: 1 })
      : anchor === "yesterday"
        ? today.add({ days: -1 })
        : today;

  if (!operator || !rawAmount || !unit) {
    return formatPlainDate(baseDate);
  }

  const amount = Number.parseInt(rawAmount, 10);

  if (!Number.isFinite(amount)) {
    return null;
  }

  const signedAmount = operator === "-" ? -amount : amount;
  const duration = createDateDuration(unit, signedAmount);

  if (!duration) {
    return null;
  }

  return formatPlainDate(baseDate.add(duration));
}

function createDateDuration(unit: string, amount: number) {
  if (unit === "day" || unit === "days") {
    return { days: amount };
  }

  if (unit === "week" || unit === "weeks") {
    return { weeks: amount };
  }

  if (unit === "month" || unit === "months") {
    return { months: amount };
  }

  if (unit === "year" || unit === "years") {
    return { years: amount };
  }

  return null;
}

export function formatUnixTimestamp(
  timestamp: number,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
) {
  const instant = Temporal.Instant.fromEpochMilliseconds(timestamp * 1000);
  return formatZonedDateTime(instant.toZonedDateTimeISO(timeZone), true);
}

function formatZonedDateTime(
  value: Temporal.ZonedDateTime,
  includeDate: boolean
) {
  const time = `${pad(value.hour)}:${pad(value.minute)}`;
  const zoneName = formatShortTimeZoneName(value);

  if (!includeDate) {
    return `${time} ${zoneName}`;
  }

  return `${formatPlainDate(value.toPlainDate())} ${time} ${zoneName}`;
}

function formatPlainDate(value: Temporal.PlainDate) {
  const year = String(value.year).slice(-2);
  return `${year}/${pad(value.month)}/${pad(value.day)}`;
}

function parseClockTime(input: string) {
  const match = input.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);

  if (!match) {
    return null;
  }

  const rawHour = Number.parseInt(match[1] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);
  const meridiem = (match[3] ?? "").toLowerCase();

  if (rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  const hour = meridiem === "pm" ? (rawHour % 12) + 12 : rawHour % 12;

  return {
    hour,
    minute,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function resolveTimeZone(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const alias = TIME_ZONE_ALIASES.get(trimmed.toLowerCase());

  if (alias) {
    return alias;
  }

  if (trimmed.includes("/")) {
    try {
      Temporal.Now.instant().toZonedDateTimeISO(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }

  return null;
}

function formatShortTimeZoneName(value: Temporal.ZonedDateTime) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: value.timeZoneId,
      timeZoneName: "short",
    }).formatToParts(new Date(Number(value.epochMilliseconds)));

    const zoneName = parts.find((part) => part.type === "timeZoneName")?.value;

    return zoneName?.trim() || value.timeZoneId;
  } catch {
    return value.timeZoneId;
  }
}
