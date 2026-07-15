const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Company } = require('../models');
const { authenticate, authorize, resolveCompanyId } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'COMPANY_ADMIN'), async (req, res, next) => {
  try {
    const where = req.user.role === 'SUPER_ADMIN' && !req.query.companyId ? {} : { companyId: resolveCompanyId(req) };
    const users = await User.findAll({ where, attributes: { exclude: ['passwordHash'] }, include: [{ model: Company, as: 'company', attributes: ['id', 'name'] }], order: [['createdAt', 'DESC']] });
    res.json({ users });
  } catch (error) { next(error); }
});

router.post('/', authorize('SUPER_ADMIN', 'COMPANY_ADMIN'), async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.body.companyId || null : req.user.companyId;
    const role = req.user.role === 'COMPANY_ADMIN' && req.body.role === 'SUPER_ADMIN' ? 'STAFF' : req.body.role;
    if (role !== 'SUPER_ADMIN' && !companyId) return res.status(400).json({ message: 'Company is required.' });
    const passwordHash = await bcrypt.hash(req.body.password || 'ChangeMe@123', 12);
    const user = await User.create({ name: req.body.name, email: String(req.body.email).toLowerCase(), passwordHash, role, companyId, isActive: true });
    req.companyId = companyId;
    await logActivity(req, 'CREATE', 'User', user.id, { email: user.email, role: user.role });
    const safe = user.toJSON(); delete safe.passwordHash;
    res.status(201).json({ user: safe });
  } catch (error) { next(error); }
});

router.put('/:id', authorize('SUPER_ADMIN', 'COMPANY_ADMIN'), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (req.user.role !== 'SUPER_ADMIN' && user.companyId !== req.user.companyId) return res.status(403).json({ message: 'Access denied.' });
    const updates = {};
    ['name', 'email', 'role', 'companyId', 'isActive'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    });
    if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    if (updates.email) updates.email = String(updates.email).toLowerCase();
    if (req.user.role !== 'SUPER_ADMIN') { delete updates.companyId; if (updates.role === 'SUPER_ADMIN') delete updates.role; }
    await user.update(updates);
    req.companyId = user.companyId;
    await logActivity(req, 'UPDATE', 'User', user.id, { email: user.email });
    const safe = user.toJSON(); delete safe.passwordHash;
    res.json({ user: safe });
  } catch (error) { next(error); }
});

module.exports = router;
