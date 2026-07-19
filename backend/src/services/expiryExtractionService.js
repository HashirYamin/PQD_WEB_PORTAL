const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(customParseFormat);

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/bmp',
  'image/tiff'
]);

const EXPIRY_WORDS = [
  'expiry',
  'expires',
  'expiration',
  'valid until',
  'valid till',
  'valid through',
  'valid up to',
  'date of expiry'
];

const ISSUE_WORDS = [
  'issue date',
  'issued on',
  'date of issue',
  'effective date',
  'start date'
];

const DATE_FORMATS = [
  'DD/MM/YYYY',
  'D/M/YYYY',
  'DD-MM-YYYY',
  'D-M-YYYY',
  'DD.MM.YYYY',
  'D.M.YYYY',
  'YYYY-MM-DD',
  'D MMM YYYY',
  'DD MMM YYYY',
  'D MMMM YYYY',
  'DD MMMM YYYY',
  'MMM D YYYY',
  'MMMM D YYYY',
  'MMM D, YYYY',
  'MMMM D, YYYY'
];

const normalizeDateText = (value) => String(value || '')
  .replace(/(\d)(st|nd|rd|th)/gi, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const parseDateCandidate = (value) => {
  const normalized = normalizeDateText(value);

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(normalized, format, true);
    if (parsed.isValid()) return parsed;
  }

  return null;
};

const collectDateCandidates = (text) => {
  const patterns = [
    /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}\b/g,
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\b/gi,
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{4}\b/gi
  ];

  const results = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseDateCandidate(match[0]);
      if (!parsed) continue;

      const start = Math.max(0, match.index - 90);
      const end = Math.min(text.length, match.index + match[0].length + 90);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      const lowerContext = context.toLowerCase();

      let score = 0;
      if (EXPIRY_WORDS.some((word) => lowerContext.includes(word))) score += 10;
      if (ISSUE_WORDS.some((word) => lowerContext.includes(word))) score -= 7;
      if (parsed.isAfter(dayjs().subtract(1, 'day'))) score += 3;
      if (parsed.year() >= 2000 && parsed.year() <= 2100) score += 1;

      results.push({
        raw: match[0],
        isoDate: parsed.format('YYYY-MM-DD'),
        score,
        context
      });
    }
  }

  const unique = new Map();
  for (const candidate of results) {
    const current = unique.get(candidate.isoDate);
    if (!current || candidate.score > current.score) {
      unique.set(candidate.isoDate, candidate);
    }
  }

  return [...unique.values()]
    .sort((a, b) => b.score - a.score || b.isoDate.localeCompare(a.isoDate));
};

const readPdfText = async (filePath) => {
  let pdfParse;
  try {
    // Pinned recommendation: pdf-parse@1.1.1 for CommonJS compatibility.
    pdfParse = require('pdf-parse');
  } catch {
    return {
      attempted: false,
      method: 'PDF_TEXT',
      text: '',
      warning: 'pdf-parse is not installed.'
    };
  }

  const buffer = fs.readFileSync(filePath);
  const result = await pdfParse(buffer);

  return {
    attempted: true,
    method: 'PDF_TEXT',
    text: String(result.text || ''),
    warning: String(result.text || '').trim().length < 30
      ? 'The PDF appears scanned or contains very little selectable text. Manual verification is required.'
      : null
  };
};

const readImageText = async (filePath) => {
  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch {
    return {
      attempted: false,
      method: 'TESSERACT_OCR',
      text: '',
      warning: 'tesseract.js is not installed.'
    };
  }

  const result = await Tesseract.recognize(filePath, 'eng');

  return {
    attempted: true,
    method: 'TESSERACT_OCR',
    text: String(result.data?.text || ''),
    warning: null
  };
};

const extractExpiryDate = async (filePath, mimeType) => {
  const baseResult = {
    attempted: false,
    method: 'UNSUPPORTED',
    expiryDate: null,
    confidence: 0,
    candidates: [],
    textPreview: '',
    warning: null,
    extractedAt: new Date().toISOString()
  };

  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { ...baseResult, warning: 'Uploaded file is unavailable for extraction.' };
    }

    const extension = path.extname(filePath).toLowerCase();
    let extraction;

    if (mimeType === 'application/pdf' || extension === '.pdf') {
      extraction = await readPdfText(filePath);
    } else if (SUPPORTED_IMAGE_TYPES.has(mimeType) || ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'].includes(extension)) {
      extraction = await readImageText(filePath);
    } else {
      return {
        ...baseResult,
        warning: 'Automatic expiry extraction is supported for PDF and image files. Enter the date manually for this file type.'
      };
    }

    const text = String(extraction.text || '').slice(0, 50000);
    const candidates = collectDateCandidates(text);
    const selected = candidates[0] || null;
    const confidence = selected
      ? Math.max(0.35, Math.min(0.98, 0.45 + selected.score * 0.045))
      : 0;

    return {
      attempted: extraction.attempted,
      method: extraction.method,
      expiryDate: selected?.isoDate || null,
      confidence: Number(confidence.toFixed(2)),
      candidates: candidates.slice(0, 10),
      textPreview: text.replace(/\s+/g, ' ').trim().slice(0, 600),
      warning: extraction.warning || (selected ? null : 'No reliable expiry date was found. Please enter or verify it manually.'),
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ...baseResult,
      attempted: true,
      warning: `Automatic expiry extraction failed: ${error.message}`
    };
  }
};

module.exports = { extractExpiryDate };
