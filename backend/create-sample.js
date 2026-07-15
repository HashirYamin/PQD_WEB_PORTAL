const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { generatePqdPdf } = require('./src/services/pdfService');

(async () => {
  const sampleDir = path.resolve(__dirname, '../samples');
  fs.mkdirSync(sampleDir, { recursive: true });
  const sourcePath = path.join(sampleDir, 'sample-source-document.pdf');
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  const page = source.addPage([595, 842]);
  page.drawText('ABC Construction W.L.L.', { x: 48, y: 760, size: 22, font });
  page.drawText('Sample supporting company profile document.', { x: 48, y: 710, size: 12, font });
  fs.writeFileSync(sourcePath, await source.save());

  const outputPath = path.join(sampleDir, 'sample-generated-pqd.pdf');
  await generatePqdPdf({
    company: { name: 'ABC Construction W.L.L.', crNumber: 'QCR-1002456', address: 'Doha, Qatar', contactPerson: 'John Doe', email: 'info@example.com', phone: '+974 5555 1234' },
    project: { name: 'Metro Station Expansion', number: 'MSE-2026-014', client: 'Public Works Authority', consultant: 'Global Engineering Consultants', contractor: 'Main Contractor W.L.L.', supplier: 'ABC Construction W.L.L.', productSystem: 'HVAC Equipment and Accessories', discipline: 'Mechanical', submittalNumber: 'PQD-HVAC-001', revision: '0', projectDate: '2026-07-13' },
    submission: { revision: '0' },
    items: [
      { titleSnapshot: 'Manufacturer/Supplier Profile and Organization Chart', status: 'YES', remarks: 'Attached and compliant', includeInPdf: true, document: { title: 'Company Profile', originalName: 'sample-source-document.pdf', filePath: sourcePath, mimeType: 'application/pdf' } },
      { titleSnapshot: 'Compliance with Project Specification', status: 'NA', remarks: 'Refer to QCS compliance', includeInPdf: true, document: null }
    ],
    outputPath
  });
  console.log(outputPath);
})().catch((error) => { console.error(error); process.exit(1); });
