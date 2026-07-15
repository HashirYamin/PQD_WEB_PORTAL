const express = require('express');
const { AlertSetting } = require('../models');
const { authenticate, enforceCompany, authorize } = require('../middleware/auth');
const { runExpiryAlerts } = require('../services/expiryJob');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authenticate);

router.get('/alerts', enforceCompany, async (req, res, next) => {
  try {
    const [setting] = await AlertSetting.findOrCreate({ where: { companyId: req.companyId }, defaults: { daysBefore: [30, 15, 7], recipientEmails: '', frequency: 'DAILY', enabled: true } });
    res.json({ setting });
  } catch (error) { next(error); }
});

router.put('/alerts', enforceCompany, authorize('SUPER_ADMIN', 'COMPANY_ADMIN'), async (req, res, next) => {
  try {
    const [setting] = await AlertSetting.findOrCreate({ where: { companyId: req.companyId }, defaults: {} });
    const daysBefore = Array.isArray(req.body.daysBefore)
      ? req.body.daysBefore.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
      : setting.daysBefore;
    await setting.update({
      daysBefore,
      recipientEmails: req.body.recipientEmails ?? setting.recipientEmails,
      frequency: req.body.frequency ?? setting.frequency,
      enabled: req.body.enabled ?? setting.enabled
    });
    await logActivity(req, 'UPDATE', 'AlertSetting', setting.id);
    res.json({ setting });
  } catch (error) { next(error); }
});

router.post('/alerts/run', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await runExpiryAlerts();
    res.json({ message: 'Expiry alert check completed.' });
  } catch (error) { next(error); }
});

module.exports = router;
