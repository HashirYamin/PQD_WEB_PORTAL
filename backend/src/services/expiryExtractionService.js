const fs = require('fs');
const os = require('os');
const path = require('path');
const dayjs = require('dayjs');
const customParseFormat = require(
  'dayjs/plugin/customParseFormat'
);

dayjs.extend(customParseFormat);

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/bmp',
  'image/tiff'
]);

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

const EXPIRY_WORDS = [
  'expiry',
  'expires',
  'expiration',
  'valid until',
  'valid till',
  'valid through',
  'valid up to',
  'date of expiry',
  'validity end'
];

const ISSUE_WORDS = [
  'issue date',
  'issued on',
  'date of issue',
  'effective date',
  'start date',
  'registration date',
  'date issued'
];

const normalizeSpaces = (value) =>
  String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const normalizeDateText = (value) =>
  String(value || '')
    .replace(/(\d)(st|nd|rd|th)/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const parseDateCandidate = (value) => {
  const normalized = normalizeDateText(value);

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(
      normalized,
      format,
      true
    );

    if (parsed.isValid()) {
      return parsed;
    }
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

    while (
      (match = pattern.exec(text)) !== null
    ) {
      const parsed = parseDateCandidate(
        match[0]
      );

      if (
        !parsed ||
        parsed.year() < 1900 ||
        parsed.year() > 2200
      ) {
        continue;
      }

      const start = Math.max(
        0,
        match.index - 110
      );

      const end = Math.min(
        text.length,
        match.index +
          match[0].length +
          110
      );

      const context = text
        .slice(start, end)
        .replace(/\s+/g, ' ')
        .trim();

      const lowerContext =
        context.toLowerCase();

      const expiryScore =
        EXPIRY_WORDS.reduce(
          (score, word) =>
            score +
            (lowerContext.includes(word)
              ? 12
              : 0),
          0
        ) -
        ISSUE_WORDS.reduce(
          (score, word) =>
            score +
            (lowerContext.includes(word)
              ? 8
              : 0),
          0
        ) +
        (parsed.isAfter(
          dayjs().subtract(1, 'day')
        )
          ? 3
          : 0);

      const issueScore =
        ISSUE_WORDS.reduce(
          (score, word) =>
            score +
            (lowerContext.includes(word)
              ? 12
              : 0),
          0
        ) -
        EXPIRY_WORDS.reduce(
          (score, word) =>
            score +
            (lowerContext.includes(word)
              ? 8
              : 0),
          0
        ) +
        (parsed.isBefore(
          dayjs().add(1, 'day')
        )
          ? 2
          : 0);

      results.push({
        raw: match[0],
        isoDate: parsed.format(
          'YYYY-MM-DD'
        ),
        expiryScore,
        issueScore,
        context
      });
    }
  }

  const unique = new Map();

  for (const candidate of results) {
    const current = unique.get(
      candidate.isoDate
    );

    if (
      !current ||
      Math.max(
        candidate.expiryScore,
        candidate.issueScore
      ) >
        Math.max(
          current.expiryScore,
          current.issueScore
        )
    ) {
      unique.set(
        candidate.isoDate,
        candidate
      );
    }
  }

  return [...unique.values()];
};

const chooseDates = (candidates) => {
  const expiry =
    [...candidates].sort(
      (a, b) =>
        b.expiryScore -
          a.expiryScore ||
        b.isoDate.localeCompare(
          a.isoDate
        )
    )[0] || null;

  const issue =
    [...candidates]
      .filter(
        (candidate) =>
          !expiry ||
          candidate.isoDate !==
            expiry.isoDate ||
          candidate.issueScore >
            candidate.expiryScore
      )
      .sort(
        (a, b) =>
          b.issueScore -
            a.issueScore ||
          a.isoDate.localeCompare(
            b.isoDate
          )
      )[0] || null;

  return {
    expiryDate:
      expiry &&
      expiry.expiryScore >= 3
        ? expiry.isoDate
        : null,

    issueDate:
      issue &&
      issue.issueScore >= 3
        ? issue.isoDate
        : null,

    expiryCandidate: expiry,
    issueCandidate: issue
  };
};

const cleanField = (value) =>
  String(value || '')
    .replace(
      /^[\s:#\-–—]+|[\s,;]+$/g,
      ''
    )
    .replace(/\s{2,}/g, ' ')
    .trim();

const extractDocumentNumber = (text) => {
  const patterns = [
    /(?:commercial\s+registration|registration|certificate|licen[cs]e|document|permit|approval|cr)\s*(?:no\.?|number|#|num(?:ber)?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/.]{2,})/i,
    /(?:no\.?|number|#)\s*[:\-]\s*([A-Z0-9][A-Z0-9\-\/.]{3,})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return cleanField(match[1]);
    }
  }

  return null;
};

const extractAuthority = (text) => {
  const lines = normalizeSpaces(text)
    .split('\n')
    .map(cleanField)
    .filter(Boolean);

  const labelPatterns = [
    /^(?:issuing authority|issued by|authority|registered by|approved by|certified by)\s*[:\-]?\s*(.+)$/i,
    /^(?:issuer|registrar)\s*[:\-]?\s*(.+)$/i
  ];

  for (const line of lines) {
    for (
      const pattern of labelPatterns
    ) {
      const match = line.match(pattern);

      if (
        match &&
        match[1]?.length >= 3
      ) {
        return cleanField(
          match[1]
        ).slice(0, 180);
      }
    }
  }

  const authorityLine = lines.find(
    (line) =>
      /\b(ministry|authority|department|municipality|council|bureau|government|chamber of commerce|standards institution|certification body|certification services)\b/i.test(
        line
      ) &&
      line.length >= 5 &&
      line.length <= 180
  );

  return authorityLine || null;
};

const detectTitle = (
  text,
  originalName
) => {
  const lower = text.toLowerCase();

  const known = [
    [
      'commercial registration certificate',
      'Commercial Registration Certificate'
    ],
    [
      'commercial registration',
      'Commercial Registration'
    ],
    [
      'trade license',
      'Trade Licence'
    ],
    [
      'trade licence',
      'Trade Licence'
    ],
    [
      'iso 9001',
      'ISO 9001 Certificate'
    ],
    [
      'iso 14001',
      'ISO 14001 Certificate'
    ],
    [
      'iso 45001',
      'ISO 45001 Certificate'
    ],
    [
      'ohsas 18001',
      'OHSAS 18001 Certificate'
    ],
    [
      'tax certificate',
      'Tax Certificate'
    ],
    [
      'certificate of incorporation',
      'Certificate of Incorporation'
    ],
    [
      'supplier registration',
      'Supplier Registration'
    ],
    [
      'authorization letter',
      'Authorization Letter'
    ],
    [
      'authorisation letter',
      'Authorization Letter'
    ]
  ];

  const found = known.find(
    ([keyword]) =>
      lower.includes(keyword)
  );

  if (found) {
    return found[1];
  }

  const lines = normalizeSpaces(text)
    .split('\n')
    .map(cleanField)
    .filter(Boolean);

  const heading = lines.find(
    (line) =>
      line.length >= 5 &&
      line.length <= 100 &&
      /\b(certificate|registration|licen[cs]e|approval|permit|authorization|authorisation)\b/i.test(
        line
      )
  );

  if (heading) {
    return heading;
  }

  return path
    .parse(
      originalName || 'document'
    )
    .name
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
};

const loadPdf = async (filePath) => {
  const pdfjs = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  );

  const data = new Uint8Array(
    fs.readFileSync(filePath)
  );

  return pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true
  }).promise;
};

const readPdfText = async (
  filePath
) => {
  try {
    const pdf = await loadPdf(filePath);
    const pageCount = Math.min(
      pdf.numPages,
      10
    );

    const chunks = [];

    for (
      let pageNumber = 1;
      pageNumber <= pageCount;
      pageNumber += 1
    ) {
      const page = await pdf.getPage(
        pageNumber
      );

      const content =
        await page.getTextContent();

      const pageText = content.items
        .map((item) =>
          String(
            item.str || ''
          ).trim()
        )
        .filter(Boolean)
        .join(' ');

      if (pageText) {
        chunks.push(pageText);
      }
    }

    return chunks.join('\n');
  } catch (pdfJsError) {
    try {
      const pdfParse = require(
        'pdf-parse'
      );

      const result = await pdfParse(
        fs.readFileSync(filePath)
      );

      return String(
        result.text || ''
      );
    } catch {
      return '';
    }
  }
};

const recognizeImage = async (
  inputPath
) => {
  const Tesseract = require(
    'tesseract.js'
  );

  const result =
    await Tesseract.recognize(
      inputPath,
      'eng'
    );

  return String(
    result.data?.text || ''
  );
};

const ocrPdfPages = async (
  filePath
) => {
  const {
    createCanvas
  } = require('@napi-rs/canvas');

  const pdf = await loadPdf(filePath);

  const pageCount = Math.min(
    pdf.numPages,
    3
  );

  const chunks = [];

  const tempDir = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'pqd-pdf-ocr-'
    )
  );

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pageCount;
      pageNumber += 1
    ) {
      const page = await pdf.getPage(
        pageNumber
      );

      const viewport =
        page.getViewport({
          scale: 2
        });

      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );

      const context =
        canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      const imagePath = path.join(
        tempDir,
        `page-${pageNumber}.png`
      );

      fs.writeFileSync(
        imagePath,
        canvas.toBuffer('image/png')
      );

      const recognizedText =
        await recognizeImage(
          imagePath
        );

      chunks.push(recognizedText);
    }
  } finally {
    fs.rmSync(tempDir, {
      recursive: true,
      force: true
    });
  }

  return chunks.join('\n');
};

const extractText = async (
  filePath,
  mimeType
) => {
  const extension = path
    .extname(filePath)
    .toLowerCase();

  if (
    mimeType === 'application/pdf' ||
    extension === '.pdf'
  ) {
    const selectableText =
      await readPdfText(filePath);

    if (
      normalizeSpaces(
        selectableText
      ).length >= 40
    ) {
      return {
        text: selectableText,
        method: 'PDF_TEXT',
        warning: null
      };
    }

    try {
      const ocrText =
        await ocrPdfPages(filePath);

      return {
        text:
          `${selectableText}\n${ocrText}`,
        method: 'PDF_OCR',
        warning:
          'Scanned PDF OCR checks the first three pages. Verify every extracted field.'
      };
    } catch (error) {
      return {
        text: selectableText,
        method: 'PDF_TEXT',
        warning:
          `The PDF appears scanned and PDF OCR could not complete: ${error.message}`
      };
    }
  }

  if (
    SUPPORTED_IMAGE_TYPES.has(
      mimeType
    ) ||
    [
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
      '.bmp',
      '.tif',
      '.tiff'
    ].includes(extension)
  ) {
    return {
      text: await recognizeImage(
        filePath
      ),
      method: 'TESSERACT_OCR',
      warning: null
    };
  }

  return {
    text: '',
    method: 'UNSUPPORTED',
    warning:
      'Automatic extraction supports PDF and image files.'
  };
};

const extractDocumentFields = async (
  filePath,
  mimeType,
  originalName = ''
) => {
  const base = {
    attempted: false,
    method: 'UNSUPPORTED',

    fields: {
      title: null,
      documentNumber: null,
      authority: null,
      issueDate: null,
      expiryDate: null
    },

    confidence: {},
    candidates: [],
    textPreview: '',
    warning: null,
    extractedAt:
      new Date().toISOString()
  };

  try {
    if (
      !filePath ||
      !fs.existsSync(filePath)
    ) {
      return {
        ...base,
        warning:
          'Uploaded file is unavailable for extraction.'
      };
    }

    const extraction =
      await extractText(
        filePath,
        mimeType
      );

    const text = normalizeSpaces(
      extraction.text
    ).slice(0, 80000);

    const candidates =
      collectDateCandidates(text);

    const dates =
      chooseDates(candidates);

    const documentNumber =
      extractDocumentNumber(text);

    const authority =
      extractAuthority(text);

    const title = detectTitle(
      text,
      originalName
    );

    const fields = {
      title,
      documentNumber,
      authority,
      issueDate: dates.issueDate,
      expiryDate: dates.expiryDate
    };

    const foundCount =
      Object.values(fields).filter(
        Boolean
      ).length;

    return {
      attempted:
        extraction.method !==
        'UNSUPPORTED',

      method: extraction.method,

      fields,

      expiryDate:
        fields.expiryDate,

      issueDate:
        fields.issueDate,

      confidence: {
        title: title ? 0.7 : 0,

        documentNumber:
          documentNumber
            ? 0.72
            : 0,

        authority:
          authority ? 0.62 : 0,

        issueDate:
          dates.issueDate
            ? 0.72
            : 0,

        expiryDate:
          dates.expiryDate
            ? 0.78
            : 0,

        overall: Number(
          Math.min(
            0.95,
            0.35 +
              foundCount * 0.11
          ).toFixed(2)
        )
      },

      candidates: candidates
        .sort(
          (a, b) =>
            Math.max(
              b.expiryScore,
              b.issueScore
            ) -
            Math.max(
              a.expiryScore,
              a.issueScore
            )
        )
        .slice(0, 12),

      textPreview: text
        .replace(/\s+/g, ' ')
        .slice(0, 1000),

      warning:
        extraction.warning ||
        (foundCount < 2
          ? 'Only limited information was detected. Please complete and verify the fields manually.'
          : 'OCR values are suggestions. Verify them before saving.'),

      extractedAt:
        new Date().toISOString()
    };
  } catch (error) {
    return {
      ...base,
      attempted: true,
      warning:
        `Automatic document extraction failed: ${error.message}`
    };
  }
};

const extractExpiryDate = async (
  filePath,
  mimeType,
  originalName = ''
) => {
  const result =
    await extractDocumentFields(
      filePath,
      mimeType,
      originalName
    );

  return {
    ...result,
    expiryDate:
      result.fields?.expiryDate ||
      null
  };
};

module.exports = {
  extractDocumentFields,
  extractExpiryDate
};