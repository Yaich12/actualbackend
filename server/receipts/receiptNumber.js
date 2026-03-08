const { admin } = require('../firebaseAdmin');

const RECEIPT_NUMBER_PAD = 4;
const DEFAULT_PREFIX = 'SEL';

const normalizeReceiptPrefix = (value) => {
  const cleaned = `${value || DEFAULT_PREFIX}`
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return cleaned || DEFAULT_PREFIX;
};

const formatReceiptNumber = ({ prefix = DEFAULT_PREFIX, year, sequence }) => {
  const normalizedPrefix = normalizeReceiptPrefix(prefix);
  const normalizedYear = Number(year) || new Date().getFullYear();
  const normalizedSequence = Math.max(1, Number(sequence) || 1);
  return `${normalizedPrefix}-${normalizedYear}-${String(normalizedSequence).padStart(
    RECEIPT_NUMBER_PAD,
    '0'
  )}`;
};

const assignReceiptNumberInTransaction = async ({
  tx,
  counterRef,
  year,
  prefix = DEFAULT_PREFIX,
}) => {
  const normalizedYear = Number(year) || new Date().getFullYear();
  const counterSnap = await tx.get(counterRef);
  const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
  const counterYear = Number(counterData?.year) || null;
  const lastNumber = Number(counterData?.lastNumber) || 0;

  const nextNumber = counterYear === normalizedYear ? lastNumber + 1 : 1;
  const receiptNumber = formatReceiptNumber({
    prefix,
    year: normalizedYear,
    sequence: nextNumber,
  });

  tx.set(
    counterRef,
    {
      year: normalizedYear,
      lastNumber: nextNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt:
        counterData?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { receiptNumber, sequence: nextNumber, year: normalizedYear };
};

module.exports = {
  DEFAULT_PREFIX,
  RECEIPT_NUMBER_PAD,
  normalizeReceiptPrefix,
  formatReceiptNumber,
  assignReceiptNumberInTransaction,
};
