const normalizeWhitespace = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeEmail = (value) => normalizeWhitespace(value).toLowerCase();

const normalizePhone = (value) =>
  normalizeWhitespace(value).replace(/[^\d+]/g, '');

const resolveRole = (data) => {
  const rawRole = normalizeWhitespace(data?.role).toLowerCase();
  const isOwner = data?.isOwner === true || rawRole === 'owner';
  return {
    role: isOwner ? 'owner' : rawRole || 'member',
    isOwner,
  };
};

const buildIdentityKey = (member) => {
  const uid = normalizeWhitespace(member?.memberUid).toLowerCase();
  if (uid) return `uid:${uid}`;
  const email = normalizeEmail(member?.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(member?.phone);
  if (phone) return `phone:${phone}`;
  const name = normalizeWhitespace(member?.name).toLowerCase();
  if (name) return `name:${name}`;
  return '';
};

export const mapClinicMemberDoc = (docSnap, fallbackLabel = 'Medarbejder') => {
  const data = docSnap.data() || {};
  const { role, isOwner } = resolveRole(data);
  const name =
    normalizeWhitespace(data?.name) ||
    normalizeWhitespace(`${data?.firstName || ''} ${data?.lastName || ''}`) ||
    normalizeWhitespace(fallbackLabel) ||
    'Medarbejder';

  const avatarText =
    normalizeWhitespace(data?.avatarText) ||
    name.charAt(0).toUpperCase() ||
    '?';
  const memberUid =
    normalizeWhitespace(data?.memberUid) || normalizeWhitespace(data?.uid) || '';

  return {
    id: String(docSnap.id || ''),
    name,
    email: normalizeWhitespace(data?.email),
    phone: normalizeWhitespace(data?.phone),
    avatarUrl: normalizeWhitespace(data?.avatarUrl),
    avatarColor: normalizeWhitespace(data?.calendarColor || data?.avatarColor) || '#0ea5e9',
    avatarText,
    role,
    isOwner,
    memberUid: memberUid || null,
  };
};

export const dedupeClinicMembers = (members) => {
  const source = Array.isArray(members) ? members : [];
  const seenIds = new Set();
  const seenIdentity = new Set();
  const result = [];

  source.forEach((member) => {
    if (!member) return;
    const id = normalizeWhitespace(member.id);
    const identity = buildIdentityKey(member);

    if (id && seenIds.has(id)) return;
    if (identity && seenIdentity.has(identity)) return;

    if (id) seenIds.add(id);
    if (identity) seenIdentity.add(identity);

    result.push({
      ...member,
      id,
      name: normalizeWhitespace(member.name),
      email: normalizeWhitespace(member.email),
      phone: normalizeWhitespace(member.phone),
      memberUid: normalizeWhitespace(member.memberUid) || null,
    });
  });

  return result;
};

export const isOwnerMemberForUid = (member, uid) => {
  const normalizedUid = normalizeWhitespace(uid);
  if (!normalizedUid) return false;
  return (
    normalizeWhitespace(member?.id) === normalizedUid ||
    normalizeWhitespace(member?.memberUid) === normalizedUid ||
    member?.isOwner === true
  );
};

export const normalizeMemberName = normalizeWhitespace;
