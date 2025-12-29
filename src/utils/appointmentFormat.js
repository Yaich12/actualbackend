const pad = (value) => String(value).padStart(2, '0');

export const parseDateString = (dateStr) => {
  if (!dateStr || typeof dateStr != 'string') {
    return null;
  }

  const normalized = dateStr.replace(/[/.]/g, '-').trim();
  const parts = normalized.split('-').map((part) => part.trim());
  if (parts.length != 3) {
    return null;
  }

  const numbers = parts.map((part) => parseInt(part, 10));
  if (numbers.some((value) => Number.isNaN(value))) {
    return null;
  }

  let day = numbers[0];
  let month = numbers[1];
  let year = numbers[2];

  if (day > 31) {
    year = numbers[0];
    month = numbers[1];
    day = numbers[2];
  }

  if (year < 100) {
    year += 2000;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { day, month, year };
};

export const normalizeDateString = (dateStr) => {
  const parsed = parseDateString(dateStr);
  if (!parsed) {
    return dateStr;
  }

  const { day, month, year } = parsed;
  return `${pad(day)}-${pad(month)}-${year}`;
};


export const formatIsoToDateParts = (isoString) => {
  if (!isoString) {
    return { date: null, time: null };
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return { date: null, time: null };
  }

  return {
    date: `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
};

export const combineDateAndTimeToIso = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) {
    return null;
  }

  const parsedDate = parseDateString(dateStr);
  if (!parsedDate) {
    return null;
  }

  const [hours, minutes] = timeStr.split(':').map((part) => parseInt(part, 10));

  if ([hours, minutes].some((value) => Number.isNaN(value))) {
    return null;
  }

  const date = new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day, hours, minutes);
  return date.toISOString();
};

