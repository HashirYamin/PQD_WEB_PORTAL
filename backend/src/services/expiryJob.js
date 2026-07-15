const cron = require('node-cron');
const dayjs = require('dayjs');
const { Company, CompanyDocument, AlertSetting } = require('../models');
const { getDocumentStatus } = require('../utils/docStatus');
const { sendExpiryAlert } = require('./emailService');

const runExpiryAlerts = async () => {
  const companies = await Company.findAll({ where: { isActive: true }, include: [{ model: AlertSetting, as: 'alertSetting' }] });
  for (const company of companies) {
    const setting = company.alertSetting;
    if (!setting?.enabled) continue;
    if (setting.frequency === 'WEEKLY' && dayjs().day() !== 1) continue;
    const days = Array.isArray(setting.daysBefore) ? setting.daysBefore : [30, 15, 7];
    const documents = await CompanyDocument.findAll({ where: { companyId: company.id, isArchived: false } });
    const due = documents
      .map((doc) => ({ ...doc.toJSON(), status: getDocumentStatus(doc.expiryDate) }))
      .filter((doc) => doc.status.key === 'EXPIRED' || days.includes(doc.status.daysRemaining));
    if (!due.length) continue;
    const recipients = String(setting.recipientEmails || '').split(',').map((item) => item.trim()).filter(Boolean);
    await sendExpiryAlert({ to: recipients, companyName: company.name, documents: due });
  }
};

const startExpiryJob = () => {
  cron.schedule('0 8 * * *', () => runExpiryAlerts().catch((error) => console.error('Expiry alert job failed:', error)));
};

module.exports = { startExpiryJob, runExpiryAlerts };
