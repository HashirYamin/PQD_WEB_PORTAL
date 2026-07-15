const express = require('express');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const {
  Company,
  CompanyDocument,
  Project,
  ChildChecklist,
  PqdSubmission,
  ActivityLog,
  User
} = require('../models');
const { authenticate, resolveCompanyId } = require('../middleware/auth');
const { getDocumentStatus } = require('../utils/docStatus');

const router = express.Router();
router.use(authenticate);

router.get('/summary', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    if (req.user.role === 'SUPER_ADMIN' && !companyId) {
      const [companies, documents, projects, checklists, pqds, allDocuments, recentSubmissions, recentActivity] = await Promise.all([
        Company.count({ where: { isActive: true } }),
        CompanyDocument.count({ where: { isArchived: false } }),
        Project.count(),
        ChildChecklist.count({ where: { isActive: true } }),
        PqdSubmission.count(),
        CompanyDocument.findAll({ where: { isArchived: false }, include: [{ model: Company, as: 'company', attributes: ['id', 'name'] }] }),
        PqdSubmission.findAll({ order: [['updatedAt', 'DESC']], limit: 6, include: [{ model: Project, as: 'project', attributes: ['name', 'number'] }, { model: Company, as: 'company', attributes: ['id', 'name'] }] }),
        ActivityLog.findAll({ limit: 8, order: [['createdAt', 'DESC']], include: [{ model: User, as: 'user', attributes: ['name', 'email'] }] })
      ]);
      const withStatus = allDocuments.map((doc) => ({ ...doc.toJSON(), statusInfo: getDocumentStatus(doc.expiryDate) }));
      const expired = withStatus.filter((doc) => doc.statusInfo.key === 'EXPIRED').length;
      const expiringSoon = withStatus.filter((doc) => doc.statusInfo.key === 'EXPIRING_SOON').length;
      const expiringDocuments = withStatus.filter((doc) => ['EXPIRED', 'EXPIRING_SOON'].includes(doc.statusInfo.key)).sort((a, b) => (a.statusInfo.daysRemaining ?? 9999) - (b.statusInfo.daysRemaining ?? 9999)).slice(0, 8);
      return res.json({
        stats: { companies, documents, projects, checklists, pqds, expired, expiringSoon },
        expiringDocuments,
        recentSubmissions,
        recentActivity
      });
    }

    if (!companyId) return res.status(400).json({ message: 'A company must be selected.' });
    const [documents, projects, checklists, pqds, docs, recentSubmissions, recentActivity] = await Promise.all([
      CompanyDocument.count({ where: { companyId, isArchived: false } }),
      Project.count({ where: { companyId } }),
      ChildChecklist.count({ where: { companyId, isActive: true } }),
      PqdSubmission.count({ where: { companyId } }),
      CompanyDocument.findAll({ where: { companyId, isArchived: false } }),
      PqdSubmission.findAll({ where: { companyId }, order: [['updatedAt', 'DESC']], limit: 6, include: [{ model: Project, as: 'project', attributes: ['name', 'number'] }] }),
      ActivityLog.findAll({ where: { companyId }, limit: 8, order: [['createdAt', 'DESC']], include: [{ model: User, as: 'user', attributes: ['name', 'email'] }] })
    ]);

    const withStatus = docs.map((doc) => ({ ...doc.toJSON(), statusInfo: getDocumentStatus(doc.expiryDate) }));
    const expired = withStatus.filter((doc) => doc.statusInfo.key === 'EXPIRED').length;
    const expiringSoon = withStatus.filter((doc) => doc.statusInfo.key === 'EXPIRING_SOON').length;
    const expiringDocuments = withStatus
      .filter((doc) => ['EXPIRED', 'EXPIRING_SOON'].includes(doc.statusInfo.key))
      .sort((a, b) => (a.statusInfo.daysRemaining ?? 9999) - (b.statusInfo.daysRemaining ?? 9999))
      .slice(0, 8);

    res.json({
      stats: { companies: 1, documents, projects, checklists, pqds, expired, expiringSoon },
      expiringDocuments,
      recentSubmissions,
      recentActivity
    });
  } catch (error) { next(error); }
});

module.exports = router;
