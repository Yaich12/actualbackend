const SERVICE_DURATION_KEYS = {
  '15 minutter': 'booking.services.duration.15m',
  '30 minutter': 'booking.services.duration.30m',
  '45 minutter': 'booking.services.duration.45m',
  '1 time': 'booking.services.duration.60m',
  '1 time 30 minutter': 'booking.services.duration.90m',
  '2 timer': 'booking.services.duration.120m',
};

export const getServiceDurationOptions = (t) =>
  Object.entries(SERVICE_DURATION_KEYS).map(([value, key]) => ({
    value,
    label: t(key, value),
  }));

export const formatServiceDuration = (value, t) => {
  if (!value) return value;
  const key = SERVICE_DURATION_KEYS[value];
  return key ? t(key, value) : value;
};
