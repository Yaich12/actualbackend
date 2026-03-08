const PAGE_WIDTH = 595.28; // A4 width
const PAGE_HEIGHT = 841.89; // A4 height
const LEFT_X = 52;
const RIGHT_X = 330;

const toLatin1 = (value) =>
  Array.from(`${value || ''}`)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code <= 255 ? char : '?';
    })
    .join('');

const escapePdfText = (value) =>
  toLatin1(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const drawText = ({
  x,
  y,
  text,
  font = 'F1',
  size = 10,
}) => `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(
  2
)} Tm (${escapePdfText(text)}) Tj ET`;

const drawLine = ({ x1, y1, x2, y2 }) =>
  `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;

const wrapText = (value, maxCharsPerLine = 56) => {
  const input = `${value || ''}`.trim();
  if (!input) return ['-'];
  const words = input.split(/\s+/).filter(Boolean);
  if (!words.length) return ['-'];

  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      return;
    }
    if (current) {
      lines.push(current);
      current = word;
      return;
    }
    lines.push(word.slice(0, maxCharsPerLine));
    current = word.slice(maxCharsPerLine);
  });
  if (current) lines.push(current);
  return lines;
};

const formatNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0,00';
  return new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

const formatCurrency = (value, currency = 'DKK') =>
  `${formatNumber(value)} ${String(currency || 'DKK').toUpperCase()}`;

const createPdfBuffer = (contentStream) => {
  const stream = toLatin1(contentStream);
  const streamLength = Buffer.byteLength(stream, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(
      2
    )} ${PAGE_HEIGHT.toFixed(
      2
    )}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];

  objects.forEach((objectBody, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
};

const generateReceiptPdfBuffer = (receipt = {}) => {
  const {
    clinicName = 'Klinik',
    clinicAddress = '-',
    clinicCvr = '-',
    patientName = '-',
    receiptNumber = '-',
    paidAtLabel = '-',
    paymentMethod = '-',
    stripePaymentIntentId = '-',
    stripeChargeId = '-',
    therapistName = '-',
    serviceName = '-',
    appointmentLabel = '-',
    subtotalAmount = 0,
    vatRate = 0,
    vatAmount = 0,
    amount = 0,
    currency = 'DKK',
  } = receipt;

  const commands = [];
  let y = 800;

  const push = (line) => commands.push(line);
  const pushText = (options) => push(drawText(options));
  const addGap = (gap = 14) => {
    y -= gap;
  };

  pushText({
    x: LEFT_X,
    y,
    text: clinicName,
    font: 'F2',
    size: 16,
  });
  addGap(16);

  wrapText(clinicAddress, 58).forEach((line, index) => {
    pushText({
      x: LEFT_X,
      y: y - index * 12,
      text: line,
      size: 10,
    });
  });
  addGap(14 + wrapText(clinicAddress, 58).length * 12);

  pushText({
    x: LEFT_X,
    y,
    text: `CVR: ${clinicCvr || '-'}`,
    size: 10,
  });

  pushText({
    x: RIGHT_X,
    y: 804,
    text: 'KVITTERING',
    font: 'F2',
    size: 20,
  });
  pushText({
    x: RIGHT_X,
    y: 785,
    text: `Kvitteringsnr: ${receiptNumber || '-'}`,
    size: 10,
  });

  y = 736;
  push(drawLine({ x1: LEFT_X, y1: y, x2: PAGE_WIDTH - LEFT_X, y2: y }));
  y -= 22;

  pushText({
    x: LEFT_X,
    y,
    text: `Patient: ${patientName || '-'}`,
    font: 'F2',
    size: 11,
  });
  addGap(18);

  pushText({
    x: LEFT_X,
    y,
    text: `Betalingsdato/tid: ${paidAtLabel || '-'}`,
    size: 10,
  });
  addGap(14);

  pushText({
    x: LEFT_X,
    y,
    text: `Betalingsmetode: ${paymentMethod || '-'}`,
    size: 10,
  });
  addGap(14);

  pushText({
    x: LEFT_X,
    y,
    text: `Stripe PaymentIntent: ${stripePaymentIntentId || '-'}`,
    size: 9,
  });
  addGap(12);
  pushText({
    x: LEFT_X,
    y,
    text: `Stripe Charge: ${stripeChargeId || '-'}`,
    size: 9,
  });

  y -= 24;
  push(drawLine({ x1: LEFT_X, y1: y, x2: PAGE_WIDTH - LEFT_X, y2: y }));
  y -= 20;

  pushText({
    x: LEFT_X,
    y,
    text: 'Behandlingslinje',
    font: 'F2',
    size: 11,
  });
  addGap(15);

  pushText({
    x: LEFT_X,
    y,
    text: `Behandler: ${therapistName || '-'}`,
    size: 10,
  });
  addGap(14);

  wrapText(`Ydelse: ${serviceName || '-'}`, 78).forEach((line, index) => {
    pushText({
      x: LEFT_X,
      y: y - index * 12,
      text: line,
      size: 10,
    });
  });
  addGap(14 + wrapText(`Ydelse: ${serviceName || '-'}`, 78).length * 12);

  pushText({
    x: LEFT_X,
    y,
    text: `Aftaletid: ${appointmentLabel || '-'}`,
    size: 10,
  });

  y -= 22;
  push(drawLine({ x1: LEFT_X, y1: y, x2: PAGE_WIDTH - LEFT_X, y2: y }));
  y -= 20;

  pushText({
    x: LEFT_X,
    y,
    text: 'Prisopdeling',
    font: 'F2',
    size: 11,
  });
  addGap(16);

  pushText({
    x: LEFT_X,
    y,
    text: `Subtotal (ekskl. moms): ${formatCurrency(subtotalAmount, currency)}`,
    size: 10,
  });
  addGap(14);
  pushText({
    x: LEFT_X,
    y,
    text: `Moms (%): ${formatNumber(vatRate)}`,
    size: 10,
  });
  addGap(14);
  pushText({
    x: LEFT_X,
    y,
    text: `Momsbeløb: ${formatCurrency(vatAmount, currency)}`,
    size: 10,
  });
  addGap(18);
  pushText({
    x: LEFT_X,
    y,
    text: `Total (inkl. moms): ${formatCurrency(amount, currency)}`,
    font: 'F2',
    size: 12,
  });

  const footerY = 74;
  push(drawLine({ x1: LEFT_X, y1: footerY + 20, x2: PAGE_WIDTH - LEFT_X, y2: footerY + 20 }));
  pushText({
    x: LEFT_X,
    y: footerY,
    text: 'SelmaPay drives af Stripe (Express) - Udstedt via Selma+',
    size: 9,
  });

  return createPdfBuffer(commands.join('\n'));
};

module.exports = {
  generateReceiptPdfBuffer,
};
