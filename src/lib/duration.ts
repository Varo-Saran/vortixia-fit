type DurationTimestamp = Date | number | string;

function timestampMilliseconds(value: DurationTimestamp): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(value);
}

export function normalizeDurationSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

export function durationSecondsBetween(
  startTime: DurationTimestamp,
  endTime: DurationTimestamp,
): number {
  const startMilliseconds = timestampMilliseconds(startTime);
  const endMilliseconds = timestampMilliseconds(endTime);

  if (
    !Number.isFinite(startMilliseconds)
    || !Number.isFinite(endMilliseconds)
    || endMilliseconds <= startMilliseconds
  ) {
    return 0;
  }

  return normalizeDurationSeconds(
    (endMilliseconds - startMilliseconds) / 1000,
  );
}

export function formatDuration(totalSeconds: unknown): string {
  const normalizedSeconds = normalizeDurationSeconds(totalSeconds);
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;
  const paddedMinutes = minutes.toString().padStart(2, '0');
  const paddedSeconds = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}
