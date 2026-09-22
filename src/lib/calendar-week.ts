type CalendarDateInput = Date | number | string;

export interface LocalCalendarWeek {
  start: Date;
  end: Date;
  days: Date[];
}

function toValidDate(value: CalendarDateInput): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('Invalid calendar date');
  }

  return date;
}

export function startOfLocalDay(value: CalendarDateInput): Date {
  const date = toValidDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getLocalCalendarWeek(
  reference: CalendarDateInput = new Date(),
): LocalCalendarWeek {
  const start = startOfLocalDay(reference);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });

  return { start, end, days };
}

export function localDayTimestamp(value: CalendarDateInput): number | null {
  try {
    return startOfLocalDay(value).getTime();
  } catch {
    return null;
  }
}
