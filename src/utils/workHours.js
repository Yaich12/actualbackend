const WORK_HOURS_DAYS = [
  { key: 'monday', shortKey: 'mon' },
  { key: 'tuesday', shortKey: 'tue' },
  { key: 'wednesday', shortKey: 'wed' },
  { key: 'thursday', shortKey: 'thu' },
  { key: 'friday', shortKey: 'fri' },
  { key: 'saturday', shortKey: 'sat' },
  { key: 'sunday', shortKey: 'sun' },
];

const DEFAULT_WORK_HOURS = {
  monday: { enabled: true, start: '08:00', end: '16:00' },
  tuesday: { enabled: true, start: '08:00', end: '16:00' },
  wednesday: { enabled: true, start: '08:00', end: '16:00' },
  thursday: { enabled: true, start: '08:00', end: '16:00' },
  friday: { enabled: true, start: '08:00', end: '15:00' },
  saturday: { enabled: false, start: '', end: '' },
  sunday: { enabled: false, start: '', end: '' },
};

const parseTimeToMinutes = (value) => {
  if (typeof value !== 'string' || !value) return null;
  const parts = value.split(':');
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const createDefaultWorkHours = () =>
  WORK_HOURS_DAYS.reduce((acc, day) => {
    acc[day.key] = { ...DEFAULT_WORK_HOURS[day.key] };
    return acc;
  }, {});

const normalizeWorkHours = (workHours) => {
  const normalized = createDefaultWorkHours();
  if (!workHours || typeof workHours !== 'object') {
    return normalized;
  }

  WORK_HOURS_DAYS.forEach((day) => {
    const entry = workHours[day.key];
    if (!entry || typeof entry !== 'object') return;
    const start = typeof entry.start === 'string' ? entry.start : '';
    const end = typeof entry.end === 'string' ? entry.end : '';
    const enabled =
      typeof entry.enabled === 'boolean' ? entry.enabled : Boolean(start && end);
    normalized[day.key] = { enabled, start, end };
  });

  return normalized;
};

const buildWorkHoursPayload = (workHours) => {
  const normalized = normalizeWorkHours(workHours);
  return WORK_HOURS_DAYS.reduce((acc, day) => {
    const entry = normalized[day.key] || {};
    const enabled = Boolean(entry.enabled);
    const start = typeof entry.start === 'string' ? entry.start : '';
    const end = typeof entry.end === 'string' ? entry.end : '';
    acc[day.key] = {
      enabled,
      start: enabled && start ? start : null,
      end: enabled && end ? end : null,
    };
    return acc;
  }, {});
};

const workHoursFromWorkingHours = (workingHours) => {
  if (!workingHours || typeof workingHours !== 'object') return null;
  const resolved = createDefaultWorkHours();
  WORK_HOURS_DAYS.forEach((day) => {
    const windows = workingHours[day.shortKey];
    if (!Array.isArray(windows) || windows.length === 0) {
      resolved[day.key] = { enabled: false, start: '', end: '' };
      return;
    }
    const first = windows[0] || {};
    const start = typeof first.start === 'string' ? first.start : '';
    const end = typeof first.end === 'string' ? first.end : '';
    if (start && end) {
      resolved[day.key] = { enabled: true, start, end };
    } else {
      resolved[day.key] = { enabled: false, start: '', end: '' };
    }
  });
  return resolved;
};

const resolveWorkHours = (data) => {
  if (data?.workHours && typeof data.workHours === 'object') {
    return normalizeWorkHours(data.workHours);
  }
  if (data?.workingHours && typeof data.workingHours === 'object') {
    const converted = workHoursFromWorkingHours(data.workingHours);
    if (converted) return converted;
  }
  return createDefaultWorkHours();
};

const getWorkHoursValidation = (workHours) => {
  const errors = {};
  WORK_HOURS_DAYS.forEach((day) => {
    const entry = workHours?.[day.key];
    if (!entry?.enabled) return;
    const start = typeof entry.start === 'string' ? entry.start : '';
    const end = typeof entry.end === 'string' ? entry.end : '';
    if (!start || !end) {
      errors[day.key] = 'missing';
      return;
    }
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      errors[day.key] = 'order';
    }
  });
  return errors;
};

export {
  WORK_HOURS_DAYS,
  createDefaultWorkHours,
  normalizeWorkHours,
  resolveWorkHours,
  buildWorkHoursPayload,
  workHoursFromWorkingHours,
  parseTimeToMinutes,
  getWorkHoursValidation,
};
