const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

const getTransporter = () => {
  if (!env.emailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined
    });
  }
  return transporter;
};

const sendExpiryAlert = async ({ to, companyName, documents }) => {
  const mailer = getTransporter();
  if (!mailer || !to.length) return { skipped: true };
  const rows = documents.map((doc) => `<li><strong>${doc.title}</strong> — ${doc.expiryDate || 'No expiry date'} (${doc.status.label})</li>`).join('');
  await mailer.sendMail({
    from: env.smtp.from,
    to: to.join(','),
    subject: `PQD document expiry alert - ${companyName}`,
    html: `<p>The following documents require attention:</p><ul>${rows}</ul>`
  });
  return { sent: true };
};

module.exports = { sendExpiryAlert };
