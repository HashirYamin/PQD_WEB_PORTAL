const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const env = require('../config/env');

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;

const COVER_DEFAULT_DIR = path.join(
  env.uploadRoot,
  'defaults',
  'cover-logos'
);

const DEFAULT_COVER_LOGOS = [
  path.join(COVER_DEFAULT_DIR, 'ashghal.png'),
  path.join(COVER_DEFAULT_DIR, 'ceg.png'),
  path.join(COVER_DEFAULT_DIR, 'amana.png')
];
const safe = (value, fallback = '-') =>
  value === null || value === undefined || value === ''
    ? fallback
    : String(value);

const wrapText = (text, font, size, maxWidth) => {
  const words = safe(text, '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};
const loadEmbeddedImage = async (pdfDoc, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.png') return pdfDoc.embedPng(bytes);
  if (ext === '.jpg' || ext === '.jpeg') return pdfDoc.embedJpg(bytes);

  return null;
};

const resolveCoverLogoPaths = (company) => {
  const settings = company.settings || {};

  return [
    settings.coverLogo1Path || DEFAULT_COVER_LOGOS[0],
    settings.coverLogo2Path || DEFAULT_COVER_LOGOS[1],
    settings.coverLogo3Path || DEFAULT_COVER_LOGOS[2]
  ].filter(Boolean);
};

const drawCoverLogos = async (pdfDoc, page, company) => {
  const logoPaths = resolveCoverLogoPaths(company);

  const slots = [
    { x: 45, y: PAGE.height - 115, width: 145, height: 78 },
    { x: 225, y: PAGE.height - 115, width: 145, height: 78 },
    { x: 405, y: PAGE.height - 115, width: 145, height: 78 }
  ];

  for (let index = 0; index < Math.min(logoPaths.length, slots.length); index += 1) {
    const image = await loadEmbeddedImage(pdfDoc, logoPaths[index]);
    if (!image) continue;

    const slot = slots[index];
    const dims = image.scaleToFit(slot.width, slot.height);

    const drawX = slot.x + (slot.width - dims.width) / 2;
    const drawY = slot.y + (slot.height - dims.height) / 2;

    page.drawImage(image, {
      x: drawX,
      y: drawY,
      width: dims.width,
      height: dims.height
    });
  }
};
const drawWrapped = (page, text, options) => {
  const {
    x,
    y,
    maxWidth,
    font,
    size = 10,
    lineHeight = 14,
    color = rgb(0.14, 0.18, 0.25)
  } = options;

  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color
    });
  });

  return y - lines.length * lineHeight;
};

const drawHeader = (page, title, fonts) => {
  page.drawRectangle({
    x: 0,
    y: PAGE.height - 82,
    width: PAGE.width,
    height: 82,
    color: rgb(0.04, 0.25, 0.46)
  });
  page.drawText(title, {
    x: MARGIN,
    y: PAGE.height - 52,
    size: 22,
    font: fonts.bold,
    color: rgb(1, 1, 1)
  });
};

const drawInfoRow = (page, label, value, y, fonts) => {
  page.drawText(label, {
    x: MARGIN,
    y,
    size: 10,
    font: fonts.bold,
    color: rgb(0.23, 0.31, 0.42)
  });
  drawWrapped(page, safe(value), {
    x: 190,
    y,
    maxWidth: PAGE.width - 190 - MARGIN,
    font: fonts.regular,
    size: 10,
    lineHeight: 13
  });
  page.drawLine({
    start: { x: MARGIN, y: y - 8 },
    end: { x: PAGE.width - MARGIN, y: y - 8 },
    thickness: 0.5,
    color: rgb(0.87, 0.89, 0.92)
  });
};

const embedLogo = async (pdfDoc, page, logoPath, options = {}) => {
  if (!logoPath || !fs.existsSync(logoPath)) return;

  try {
    const bytes = fs.readFileSync(logoPath);
    const ext = path.extname(logoPath).toLowerCase();
    const image = ext === '.png'
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const dims = image.scaleToFit(options.maxWidth || 110, options.maxHeight || 65);

    page.drawImage(image, {
      x: options.x ?? PAGE.width - MARGIN - dims.width,
      y: options.y ?? PAGE.height - 92,
      width: dims.width,
      height: dims.height
    });
  } catch (error) {
    console.warn('Could not embed logo:', error.message);
  }
};

const drawFooterNumbers = (pdfDoc, fonts) => {
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: 28 },
      end: { x: PAGE.width - MARGIN, y: 28 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.91)
    });
    page.drawText('PQD Web Portal', {
      x: MARGIN,
      y: 14,
      size: 8,
      font: fonts.regular,
      color: rgb(0.42, 0.47, 0.55)
    });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    const width = fonts.regular.widthOfTextAtSize(pageLabel, 8);
    page.drawText(pageLabel, {
      x: PAGE.width - MARGIN - width,
      y: 14,
      size: 8,
      font: fonts.regular,
      color: rgb(0.42, 0.47, 0.55)
    });
  });
};

const addCoverPage = async (pdfDoc, data, fonts) => {
  const { company, project, submission } = data;
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);

  // White background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: rgb(1, 1, 1)
  });

  // Draw 3 logos on top
  await drawCoverLogos(pdfDoc, page, company);

  // Blue title band
  const bannerY = PAGE.height - 360;
  const bannerHeight = 210;

  page.drawRectangle({
    x: 0,
    y: bannerY,
    width: PAGE.width,
    height: bannerHeight,
    color: rgb(0.03, 0.24, 0.45)
  });

  page.drawText('PREQUALIFICATION', {
    x: MARGIN,
    y: bannerY + 130,
    size: 34,
    font: fonts.bold,
    color: rgb(1, 1, 1)
  });

  page.drawText('DOCUMENT SUBMISSION', {
    x: MARGIN,
    y: bannerY + 82,
    size: 25,
    font: fonts.bold,
    color: rgb(0.79, 0.9, 1)
  });

  // Details below banner
  let y = bannerY - 38;
  const rows = [
    ['Project', project.name],
    ['Project Number', project.number],
    ['Contract Code', project.contractCode],
    ['Client', project.client],
    ['Consultant', project.consultant],
    ['Contractor', project.contractor],
    ['Supplier', project.supplier || company.name],
    ['Product / System', project.productSystem],
    ['Discipline', project.discipline],
    ['Submittal Number', project.submittalNumber],
    ['Revision', submission.revision || project.revision],
    ['Date', project.projectDate]
  ];

  rows.forEach(([label, value]) => {
    drawInfoRow(page, label, value, y, fonts);
    y -= 32;
  });

  page.drawText(safe(company.name), {
    x: MARGIN,
    y: 42,
    size: 12,
    font: fonts.bold,
    color: rgb(0.03, 0.24, 0.45)
  });
};

const addOverviewPage = async (pdfDoc, data, fonts) => {
  const { company, project, supplier, product } = data;
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, 'Project, Company, Supplier & Product Information', fonts);

  if (supplier?.logoPath) {
    await embedLogo(pdfDoc, page, supplier.logoPath, {
      x: PAGE.width - MARGIN - 90,
      y: PAGE.height - 155,
      maxWidth: 90,
      maxHeight: 48
    });
  }

  let y = PAGE.height - 125;
  const rows = [
    ['Company Name', company.name],
    ['Company CR Number', company.crNumber],
    ['Company Address', company.address],
    ['Company Contact', company.contactPerson],
    ['Company Email', company.email],
    ['Company Phone', company.phone],
    ['Project Name', project.name],
    ['Project Number', project.number],
    ['Supplier Name', supplier?.name],
    ['Supplier Registration', supplier?.registrationNumber],
    ['Supplier Website', supplier?.website],
    ['Product Name', product?.name],
    ['Product Code', product?.code],
    ['Model', product?.model],
    ['Brand', product?.brand],
    ['Manufacturer', product?.manufacturer],
    ['Country of Origin', product?.countryOfOrigin],
    ['Product Category', product?.category]
  ];

  rows.forEach(([label, value]) => {
    if (y < 65) return;
    drawInfoRow(page, label, value, y, fonts);
    y -= 37;
  });
};

const addChecklistPages = (pdfDoc, items, fonts) => {
  let page;
  let y;

  const startPage = () => {
    page = pdfDoc.addPage([PAGE.width, PAGE.height]);
    drawHeader(page, 'Prequalification Checklist', fonts);
    y = PAGE.height - 120;

    page.drawRectangle({
      x: MARGIN,
      y: y - 24,
      width: PAGE.width - MARGIN * 2,
      height: 26,
      color: rgb(0.88, 0.93, 0.98)
    });
    page.drawText('SN', { x: MARGIN + 8, y: y - 15, size: 9, font: fonts.bold });
    page.drawText('Checklist Item', { x: MARGIN + 40, y: y - 15, size: 9, font: fonts.bold });
    page.drawText('Status', { x: 400, y: y - 15, size: 9, font: fonts.bold });
    page.drawText('Remarks', { x: 463, y: y - 15, size: 9, font: fonts.bold });
    y -= 40;
  };

  startPage();

  items.forEach((item, index) => {
    const titleLines = wrapText(item.titleSnapshot, fonts.regular, 8.5, 330);
    const remarkLines = wrapText(item.remarks || '', fonts.regular, 8, 82);
    const rowHeight = Math.max(28, Math.max(titleLines.length, remarkLines.length) * 11 + 10);

    if (y - rowHeight < 55) startPage();

    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight + 4,
        width: PAGE.width - MARGIN * 2,
        height: rowHeight,
        color: rgb(0.98, 0.985, 0.995)
      });
    }

    page.drawText(String(index + 1), {
      x: MARGIN + 8,
      y: y - 12,
      size: 8.5,
      font: fonts.regular
    });
    titleLines.forEach((line, i) => {
      page.drawText(line, {
        x: MARGIN + 40,
        y: y - 12 - i * 11,
        size: 8.5,
        font: fonts.regular
      });
    });
    page.drawText(safe(item.status, ''), {
      x: 400,
      y: y - 12,
      size: 8,
      font: fonts.regular
    });
    remarkLines.forEach((line, i) => {
      page.drawText(line, {
        x: 463,
        y: y - 12 - i * 10,
        size: 8,
        font: fonts.regular
      });
    });

    y -= rowHeight;
  });
};

const addSectionTitle = (pdfDoc, item, index, data, fonts) => {
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, `Section ${index + 1}`, fonts);

  let y = PAGE.height - 155;
  y = drawWrapped(page, item.titleSnapshot, {
    x: MARGIN,
    y,
    maxWidth: PAGE.width - MARGIN * 2,
    font: fonts.bold,
    size: 20,
    lineHeight: 26,
    color: rgb(0.03, 0.24, 0.45)
  });

  y -= 28;
  drawInfoRow(page, 'Supplier', data.supplier?.name, y, fonts);
  y -= 40;
  drawInfoRow(page, 'Product', data.product?.name, y, fonts);
  y -= 40;
  drawInfoRow(page, 'Selected Document', item.document?.title, y, fonts);
  y -= 40;
  drawInfoRow(page, 'Document Type', item.document?.documentType, y, fonts);
  y -= 40;
  drawInfoRow(page, 'Status', item.status, y, fonts);
  y -= 40;
  drawInfoRow(page, 'Remarks', item.remarks, y, fonts);

  return page;
};

const addNotePage = (pdfDoc, title, message, fonts) => {
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, title, fonts);
  drawWrapped(page, message, {
    x: MARGIN,
    y: PAGE.height - 140,
    maxWidth: PAGE.width - MARGIN * 2,
    font: fonts.regular,
    size: 11,
    lineHeight: 17
  });
};

const mergeDocument = async (pdfDoc, item, mergedIds, fonts) => {
  const document = item.document;
  if (!document) {
    addNotePage(
      pdfDoc,
      'Missing Supporting Document',
      'No supporting document was selected for this checklist item.',
      fonts
    );
    return false;
  }

  const key = document.id || document.filePath;
  if (mergedIds.has(key)) {
    addNotePage(
      pdfDoc,
      'Document Already Included',
      `The document “${safe(document.title)}” was already merged earlier in checklist order. It is not duplicated here.`,
      fonts
    );
    return false;
  }

  if (
    !document.filePath ||
    !fs.existsSync(document.filePath) ||
    document.mimeType !== 'application/pdf'
  ) {
    addNotePage(
      pdfDoc,
      'Attachment Not Mergeable',
      `“${safe(document.title)}” is not an available PDF file. Only valid PDF attachments are merged automatically.`,
      fonts
    );
    return false;
  }

  try {
    const source = await PDFDocument.load(fs.readFileSync(document.filePath), {
      ignoreEncryption: true
    });
    const pages = await pdfDoc.copyPages(source, source.getPageIndices());
    pages.forEach((page) => pdfDoc.addPage(page));
    mergedIds.add(key);
    return true;
  } catch (error) {
    addNotePage(
      pdfDoc,
      'Attachment Could Not Be Merged',
      `“${safe(document.title)}” could not be merged because the PDF is invalid, encrypted or unsupported. ${error.message}`,
      fonts
    );
    return false;
  }
};

const drawToc = (page, rows, fonts) => {
  drawHeader(page, 'Table of Contents', fonts);
  let y = PAGE.height - 125;

  rows.forEach((row, index) => {
    if (y < 55) return;
    const title = `${index + 1}. ${row.title}`;
    const lines = wrapText(title, fonts.regular, 9.5, 410);
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: MARGIN,
        y: y - i * 12,
        size: 9.5,
        font: fonts.regular
      });
    });
    page.drawText(String(row.page), {
      x: PAGE.width - MARGIN - 25,
      y,
      size: 9.5,
      font: fonts.bold
    });
    y -= Math.max(24, lines.length * 12 + 7);
  });
};

const generatePqdPdf = async ({
  company,
  project,
  supplier,
  product,
  submission,
  items,
  outputPath
}) => {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  };

  const data = { company, project, supplier, product, submission };

  await addCoverPage(pdfDoc, data, fonts);
  await addOverviewPage(pdfDoc, data, fonts);

  const tocPage = pdfDoc.addPage([PAGE.width, PAGE.height]);
  addChecklistPages(pdfDoc, items, fonts);

  const tocRows = [];
  const mergedIds = new Set();
  let mergedDocumentCount = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const sectionPage = pdfDoc.getPageCount() + 1;
    tocRows.push({ title: item.titleSnapshot, page: sectionPage });
    addSectionTitle(pdfDoc, item, index, data, fonts);
    const merged = await mergeDocument(pdfDoc, item, mergedIds, fonts);
    if (merged) mergedDocumentCount += 1;
  }

  drawToc(tocPage, tocRows, fonts);
  drawFooterNumbers(pdfDoc, fonts);

  const bytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);

  return {
    sizeBytes: bytes.length,
    pageCount: pdfDoc.getPageCount(),
    mergedDocumentCount
  };
};

const makeGeneratedPath = (companyId, submissionId, version) => {
  const dir = path.join(
    env.uploadRoot,
    'generated',
    String(companyId),
    String(submissionId)
  );
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `PQD-${submissionId}-v${version}.pdf`);
};

module.exports = { generatePqdPdf, makeGeneratedPath };
