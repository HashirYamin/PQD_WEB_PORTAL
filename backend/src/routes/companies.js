const express = require('express');
const fs = require('fs');
const { Company, User, AlertSetting } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { createUploader } = require('../utils/upload');
const { logActivity } = require('../utils/activity');

const router = express.Router();
const logoUpload = createUploader('logos', { allowedMimeTypes: ['image/png', 'image/jpeg'], maxBytes: 5 * 1024 * 1024 }).single('logo');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      const company = await Company.findByPk(req.user.companyId);
      return res.json({ companies: company ? [company] : [] });
    }
    const companies = await Company.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ companies });
  } catch (error) { next(error); }
});

router.post('/', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const company = await Company.create(req.body);
    await AlertSetting.create({ companyId: company.id });
    req.companyId = company.id;
    await logActivity(req, 'CREATE', 'Company', company.id, { name: company.name });
    res.status(201).json({ company });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.companyId !== req.params.id) return res.status(403).json({ message: 'Access denied.' });
    const company = await Company.findByPk(req.params.id, { include: [{ model: AlertSetting, as: 'alertSetting' }] });
    if (!company) return res.status(404).json({ message: 'Company not found.' });
    res.json({ company });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && !(req.user.role === 'COMPANY_ADMIN' && req.user.companyId === req.params.id)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found.' });
    const allowed = ['name', 'crNumber', 'address', 'contactPerson', 'email', 'phone', 'stampPath', 'settings', 'isActive'];
    const updates = {};
    allowed.forEach((key) => { if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key]; });
    await company.update(updates);
    req.companyId = company.id;
    await logActivity(req, 'UPDATE', 'Company', company.id, { name: company.name });
    res.json({ company });
  } catch (error) { next(error); }
});

router.post('/:id/logo', async (req, res, next) => {
  if (req.user.role !== 'SUPER_ADMIN' && !(req.user.role === 'COMPANY_ADMIN' && req.user.companyId === req.params.id)) {
    return res.status(403).json({ message: 'Access denied.' });
  }
  req.companyId = req.params.id;
  logoUpload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'Logo file is required.' });
      const company = await Company.findByPk(req.params.id);
      if (!company) return res.status(404).json({ message: 'Company not found.' });
      if (company.logoPath && fs.existsSync(company.logoPath)) fs.unlinkSync(company.logoPath);
      await company.update({ logoPath: req.file.path });
      await logActivity(req, 'UPLOAD_LOGO', 'Company', company.id);
      res.json({ company });
    } catch (err) { next(err); }
  });
});

module.exports = router;
