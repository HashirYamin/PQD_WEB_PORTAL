process.env.USE_PG_MEM = 'true';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOAD_ROOT = 'test-uploads';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const app = require('./src/app');
const {
  sequelize, Company, User, MasterChecklistItem, Project, ChildChecklist,
  ChildChecklistItem, CompanyDocument, AlertSetting
} = require('./src/models');

(async () => {
  await sequelize.sync({ force: true });
  const company = await Company.create({ name: 'Test Co' });
  await AlertSetting.create({ companyId: company.id });
  const passwordHash = await bcrypt.hash('Admin@123', 4);
  await User.create({ name: 'Admin', email: 'admin@test.local', passwordHash, role: 'COMPANY_ADMIN', companyId: company.id });
  const master = await MasterChecklistItem.create({ companyId: company.id, title: 'Company Profile', defaultStatus: 'YES', sortOrder: 1 });
  const project = await Project.create({ companyId: company.id, name: 'Test Project', number: 'P-1' });
  const child = await ChildChecklist.create({ companyId: company.id, projectId: project.id, name: 'Main PQD' });
  await ChildChecklistItem.create({ childChecklistId: child.id, masterItemId: master.id, titleSnapshot: master.title, status: 'YES', sortOrder: 1 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Test attachment', { x: 50, y: 700, font });
  const filePath = path.resolve('test-uploads/documents/test.pdf');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, await pdf.save());
  const doc = await CompanyDocument.create({ companyId: company.id, title: 'Profile PDF', category: 'Company Documents', expiryDate: '2030-01-01', filePath, originalName: 'test.pdf', mimeType: 'application/pdf', sizeBytes: fs.statSync(filePath).size });

  const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin@123' }).expect(200);
  const token = login.body.token;
  const auth = { Authorization: `Bearer ${token}` };
  await request(app).get('/api/dashboard/summary').set(auth).expect(200);
  const draft = await request(app).post('/api/pqds').set(auth).send({ projectId: project.id, childChecklistId: child.id }).expect(201);
  const submission = draft.body.submission;
  await request(app).put(`/api/pqds/${submission.id}`).set(auth).send({ items: [{ id: submission.items[0].id, documentId: doc.id, status: 'YES', includeInPdf: true, remarks: 'Compliant' }] }).expect(200);
  const generated = await request(app).post(`/api/pqds/${submission.id}/generate`).set(auth).send({}).expect(200);
  if (!generated.body.generatedPdf?.id) throw new Error('PDF not generated');
  await request(app).get(`/api/pqds/${submission.id}/versions/${generated.body.generatedPdf.id}/download`).set(auth).expect(200);
  console.log('Integration test passed:', { submissionId: submission.id, version: generated.body.generatedPdf.version, pages: generated.body.pageCount });
  await sequelize.close();
  fs.rmSync(path.resolve('test-uploads'), { recursive: true, force: true });
})().catch(async (error) => {
  console.error(error);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
