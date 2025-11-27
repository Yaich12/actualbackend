const pad = (value) => String(value).padStart(2, '0');

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

  const [day, month, year] = dateStr.split('-').map((part) => parseInt(part, 10));
  const [hours, minutes] = timeStr.split(':').map((part) => parseInt(part, 10));

  if ([day, month, year, hours, minutes].some((value) => Number.isNaN(value))) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes);
  return date.toISOString();
};


