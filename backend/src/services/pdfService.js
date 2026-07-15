const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const env = require('../config/env');

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;

const safe = (value, fallback = '-') => (value === null || value === undefined || value === '' ? fallback : String(value));

const wrapText = (text, font, size, maxWidth) => {
  const words = safe(text, '').split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const drawWrapped = (page, text, options) => {
  const { x, y, maxWidth, font, size = 10, lineHeight = 14, color = rgb(0.14, 0.18, 0.25) } = options;
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, size, font, color }));
  return y - lines.length * lineHeight;
};

const drawHeader = (page, title, fonts) => {
  page.drawRectangle({ x: 0, y: PAGE.height - 82, width: PAGE.width, height: 82, color: rgb(0.04, 0.25, 0.46) });
  page.drawText(title, { x: MARGIN, y: PAGE.height - 52, size: 22, font: fonts.bold, color: rgb(1, 1, 1) });
};

const drawInfoRow = (page, label, value, y, fonts) => {
  page.drawText(label, { x: MARGIN, y, size: 10, font: fonts.bold, color: rgb(0.23, 0.31, 0.42) });
  drawWrapped(page, safe(value), { x: 190, y, maxWidth: PAGE.width - 190 - MARGIN, font: fonts.regular, size: 10, lineHeight: 13 });
  page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: PAGE.width - MARGIN, y: y - 8 }, thickness: 0.5, color: rgb(0.87, 0.89, 0.92) });
};

const embedCompanyLogo = async (pdfDoc, page, logoPath) => {
  if (!logoPath || !fs.existsSync(logoPath)) return;
  try {
    const bytes = fs.readFileSync(logoPath);
    const ext = path.extname(logoPath).toLowerCase();
    const image = ext === '.png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    const dims = image.scaleToFit(110, 65);
    page.drawImage(image, { x: PAGE.width - MARGIN - dims.width, y: PAGE.height - 65 - 26, width: dims.width, height: dims.height });
  } catch (error) {
    console.warn('Could not embed logo:', error.message);
  }
};

const drawFooterNumbers = (pdfDoc, fonts) => {
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawLine({ start: { x: MARGIN, y: 28 }, end: { x: PAGE.width - MARGIN, y: 28 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.91) });
    page.drawText(`PQD Web Portal`, { x: MARGIN, y: 14, size: 8, font: fonts.regular, color: rgb(0.42, 0.47, 0.55) });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    const width = fonts.regular.widthOfTextAtSize(pageLabel, 8);
    page.drawText(pageLabel, { x: PAGE.width - MARGIN - width, y: 14, size: 8, font: fonts.regular, color: rgb(0.42, 0.47, 0.55) });
  });
};

const addCoverPage = async (pdfDoc, data, fonts) => {
  const { company, project, submission } = data;
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: rgb(0.96, 0.98, 1) });
  page.drawRectangle({ x: 0, y: PAGE.height - 210, width: PAGE.width, height: 210, color: rgb(0.03, 0.24, 0.45) });
  page.drawText('PREQUALIFICATION', { x: MARGIN, y: PAGE.height - 115, size: 34, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText('DOCUMENT SUBMISSION', { x: MARGIN, y: PAGE.height - 158, size: 25, font: fonts.bold, color: rgb(0.79, 0.9, 1) });
  await embedCompanyLogo(pdfDoc, page, company.logoPath);

  let y = PAGE.height - 290;
  const rows = [
    ['Project', project.name],
    ['Project Number', project.number],
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
    y -= 40;
  });
  page.drawText(safe(company.name), { x: MARGIN, y: 54, size: 12, font: fonts.bold, color: rgb(0.03, 0.24, 0.45) });
};

const addCompanyProjectPage = (pdfDoc, data, fonts) => {
  const { company, project } = data;
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, 'Project & Company Information', fonts);
  let y = PAGE.height - 125;
  const rows = [
    ['Company Name', company.name],
    ['Commercial Registration', company.crNumber],
    ['Company Address', company.address],
    ['Contact Person', company.contactPerson],
    ['Email', company.email],
    ['Phone', company.phone],
    ['Project Name', project.name],
    ['Project Number', project.number],
    ['Client', project.client],
    ['Consultant', project.consultant],
    ['Contractor', project.contractor],
    ['Supplier', project.supplier],
    ['Product / System', project.productSystem],
    ['Discipline', project.discipline]
  ];
  rows.forEach(([label, value]) => {
    drawInfoRow(page, label, value, y, fonts);
    y -= 42;
  });
};

const addChecklistPages = (pdfDoc, items, fonts) => {
  const pageIndexes = [];
  let page;
  let y;
  const startPage = () => {
    page = pdfDoc.addPage([PAGE.width, PAGE.height]);
    pageIndexes.push(pdfDoc.getPageCount() - 1);
    drawHeader(page, 'Prequalification Checklist', fonts);
    y = PAGE.height - 120;
    page.drawRectangle({ x: MARGIN, y: y - 24, width: PAGE.width - MARGIN * 2, height: 26, color: rgb(0.88, 0.93, 0.98) });
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
    if (index % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowHeight + 4, width: PAGE.width - MARGIN * 2, height: rowHeight, color: rgb(0.98, 0.985, 0.995) });
    page.drawText(String(index + 1), { x: MARGIN + 8, y: y - 12, size: 8.5, font: fonts.regular });
    titleLines.forEach((line, i) => page.drawText(line, { x: MARGIN + 40, y: y - 12 - i * 11, size: 8.5, font: fonts.regular }));
    page.drawText(safe(item.status, ''), { x: 400, y: y - 12, size: 8, font: fonts.regular });
    remarkLines.forEach((line, i) => page.drawText(line, { x: 463, y: y - 12 - i * 10, size: 8, font: fonts.regular }));
    page.drawLine({ start: { x: MARGIN, y: y - rowHeight + 4 }, end: { x: PAGE.width - MARGIN, y: y - rowHeight + 4 }, thickness: 0.4, color: rgb(0.84, 0.87, 0.9) });
    y -= rowHeight;
  });
  return pageIndexes;
};

const addSectionTitle = async (pdfDoc, item, index, data, fonts) => {
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: rgb(0.96, 0.98, 1) });
  page.drawRectangle({ x: 0, y: PAGE.height - 110, width: PAGE.width, height: 110, color: rgb(0.03, 0.24, 0.45) });
  page.drawText(`SECTION ${index + 1}`, { x: MARGIN, y: PAGE.height - 68, size: 18, font: fonts.bold, color: rgb(0.79, 0.9, 1) });
  let y = PAGE.height - 225;
  y = drawWrapped(page, item.titleSnapshot, { x: MARGIN, y, maxWidth: PAGE.width - MARGIN * 2, font: fonts.bold, size: 25, lineHeight: 32, color: rgb(0.03, 0.24, 0.45) });
  page.drawRectangle({ x: MARGIN, y: y - 30, width: PAGE.width - MARGIN * 2, height: 1, color: rgb(0.73, 0.81, 0.89) });
  page.drawText(`Status: ${safe(item.status)}`, { x: MARGIN, y: y - 70, size: 11, font: fonts.bold, color: rgb(0.23, 0.31, 0.42) });
  drawWrapped(page, `Remarks: ${safe(item.remarks)}`, { x: MARGIN, y: y - 100, maxWidth: PAGE.width - MARGIN * 2, font: fonts.regular, size: 11, lineHeight: 16 });
  page.drawText(safe(data.project.name), { x: MARGIN, y: 70, size: 11, font: fonts.bold, color: rgb(0.03, 0.24, 0.45) });
  page.drawText(safe(data.company.name), { x: MARGIN, y: 52, size: 10, font: fonts.regular, color: rgb(0.42, 0.47, 0.55) });
  await embedCompanyLogo(pdfDoc, page, data.company.logoPath);
};

const addAttachmentOrNote = async (pdfDoc, item, fonts) => {
  if (item.document?.filePath && item.document.mimeType === 'application/pdf' && fs.existsSync(item.document.filePath)) {
    try {
      const source = await PDFDocument.load(fs.readFileSync(item.document.filePath));
      const pages = await pdfDoc.copyPages(source, source.getPageIndices());
      pages.forEach((page) => pdfDoc.addPage(page));
      return;
    } catch (error) {
      console.warn('PDF merge failed:', error.message);
    }
  }

  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, 'Attachment Reference', fonts);
  page.drawText('The selected attachment could not be embedded in the combined PDF.', { x: MARGIN, y: PAGE.height - 145, size: 11, font: fonts.regular });
  drawInfoRow(page, 'Checklist Item', item.titleSnapshot, PAGE.height - 195, fonts);
  drawInfoRow(page, 'Document', item.document?.title || 'No document attached', PAGE.height - 245, fonts);
  drawInfoRow(page, 'File Name', item.document?.originalName || '-', PAGE.height - 295, fonts);
  drawInfoRow(page, 'Reason', item.document ? 'Only valid PDF attachments are merged automatically.' : 'No supporting document was selected.', PAGE.height - 345, fonts);
};

const generatePqdPdf = async ({ company, project, submission, items, outputPath }) => {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  };

  await addCoverPage(pdfDoc, { company, project, submission }, fonts);
  addCompanyProjectPage(pdfDoc, { company, project }, fonts);

  const tocPage = pdfDoc.addPage([PAGE.width, PAGE.height]);
  drawHeader(tocPage, 'Table of Contents', fonts);

  addChecklistPages(pdfDoc, items, fonts);
  const tocRows = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const sectionPage = pdfDoc.getPageCount() + 1;
    tocRows.push({ title: item.titleSnapshot, page: sectionPage });
    await addSectionTitle(pdfDoc, item, index, { company, project }, fonts);
    await addAttachmentOrNote(pdfDoc, item, fonts);
  }

  let tocY = PAGE.height - 125;
  tocRows.forEach((row, index) => {
    if (tocY < 60) return;
    const title = `${index + 1}. ${row.title}`;
    const lines = wrapText(title, fonts.regular, 9.5, 410);
    lines.forEach((line, i) => tocPage.drawText(line, { x: MARGIN, y: tocY - i * 12, size: 9.5, font: fonts.regular }));
    tocPage.drawText(String(row.page), { x: PAGE.width - MARGIN - 25, y: tocY, size: 9.5, font: fonts.bold });
    tocY -= Math.max(24, lines.length * 12 + 7);
  });

  drawFooterNumbers(pdfDoc, fonts);
  const bytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);
  return { sizeBytes: bytes.length, pageCount: pdfDoc.getPageCount() };
};

const makeGeneratedPath = (companyId, submissionId, version) => {
  const dir = path.join(env.uploadRoot, 'generated', String(companyId), String(submissionId));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `PQD-${submissionId}-v${version}.pdf`);
};

module.exports = { generatePqdPdf, makeGeneratedPath };
