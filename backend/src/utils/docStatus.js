const dayjs = require('dayjs');

const getDocumentStatus = (expiryDate, expiryNotApplicable = false) => {
  if (expiryNotApplicable) {
    return { key: 'NOT_APPLICABLE', label: 'Not Applicable', daysRemaining: null };
  }

  if (!expiryDate) {
    return { key: 'NO_EXPIRY', label: 'Missing Expiry Date', daysRemaining: null };
  }

  const today = dayjs().startOf('day');
  const expiry = dayjs(expiryDate).startOf('day');
  const daysRemaining = expiry.diff(today, 'day');

  if (daysRemaining < 0) return { key: 'EXPIRED', label: 'Expired', daysRemaining };
  if (daysRemaining <= 30) return { key: 'EXPIRING_SOON', label: 'Expiring Soon', daysRemaining };
  return { key: 'ACTIVE', label: 'Active', daysRemaining };
};

module.exports = { getDocumentStatus };
