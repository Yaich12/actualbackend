const normalizeAscii = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();

const pad2 = (value) => String(value).padStart(2, "0");

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const converted = new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export const buildClientInitials = (clientName, fallback = "APT") => {
  const cleaned = normalizeAscii(clientName);
  if (!cleaned) return fallback;

  const tokens = cleaned
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!tokens.length) return fallback;
  if (tokens.length >= 3) {
    return `${tokens[0][0]}${tokens[1][0]}${tokens[2][0]}`.toUpperCase();
  }
  if (tokens.length === 2) {
    const first = tokens[0][0] || "X";
    const second = tokens[1][0] || "X";
    const third = tokens[1][1] || tokens[0][1] || "X";
    return `${first}${second}${third}`.toUpperCase();
  }

  const token = tokens[0].toUpperCase();
  if (token.length >= 3) return token.slice(0, 3);
  return `${token}${"X".repeat(3 - token.length)}`;
};

export const buildAppointmentReference = ({ clientName, createdAt }) => {
  const date = toDate(createdAt) || new Date();
  const initials = buildClientInitials(clientName);
  const dateCode = `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${pad2(date.getHours())}${pad2(
    date.getMinutes()
  )}`;
  return `${initials}${dateCode}`;
};

export const withReferenceSuffix = (reference, sequence) => {
  if (!sequence || sequence < 1) return reference;
  return `${reference}${sequence}`;
};
