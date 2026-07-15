const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { CompanyDocument } = require('../models');
const { authenticate, enforceCompany } = require('../middleware/auth');
const { createUploader } = require('../utils/upload');
const { getDocumentStatus } = require('../utils/docStatus');
const { logActivity } = require('../utils/activity');

const router = express.Router();
const upload = createUploader('documents').single('file');

router.use(authenticate);

router.get('/', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId, isArchived: req.query.archived === 'true' };
    if (req.query.category) where.category = req.query.category;
    if (req.query.search) where[Op.or] = [
      { title: { [Op.like]: `%${req.query.search}%` } },
      { originalName: { [Op.like]: `%${req.query.search}%` } }
    ];
    const documents = await CompanyDocument.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ documents: documents.map((doc) => ({ ...doc.toJSON(), statusInfo: getDocumentStatus(doc.expiryDate) })) });
  } catch (error) { next(error); }
});

router.post('/', enforceCompany, (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'A file is required.' });
      const document = await CompanyDocument.create({
        companyId: req.companyId,
        createdById: req.user.id,
        title: req.body.title || path.parse(req.file.originalname).name,
        category: req.body.category || 'Other',
        issueDate: req.body.issueDate || null,
        expiryDate: req.body.expiryDate || null,
        documentType: req.body.documentType || req.file.mimetype,
        remarks: req.body.remarks || null,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      });
      await logActivity(req, 'UPLOAD', 'Document', document.id, { title: document.title });
      res.status(201).json({ document: { ...document.toJSON(), statusInfo: getDocumentStatus(document.expiryDate) } });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(err);
    }
  });
});

router.put('/:id', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!document) return res.status(404).json({ message: 'Document not found.' });
    const allowed = ['title', 'category', 'issueDate', 'expiryDate', 'documentType', 'remarks', 'isArchived'];
    const updates = {};
    allowed.forEach((key) => { if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key] || null; });
    await document.update(updates);
    await logActivity(req, 'UPDATE', 'Document', document.id, { title: document.title });
    res.json({ document: { ...document.toJSON(), statusInfo: getDocumentStatus(document.expiryDate) } });
  } catch (error) { next(error); }
});

router.post('/:id/replace', enforceCompany, (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'A replacement file is required.' });
      const document = await CompanyDocument.findOne({ where: { id: req.params.id, companyId: req.companyId } });
      if (!document) return res.status(404).json({ message: 'Document not found.' });
      if (document.filePath && fs.existsSync(document.filePath)) fs.unlinkSync(document.filePath);
      await document.update({ filePath: req.file.path, originalName: req.file.originalname, mimeType: req.file.mimetype, sizeBytes: req.file.size });
      await logActivity(req, 'REPLACE_FILE', 'Document', document.id, { title: document.title });
      res.json({ document: { ...document.toJSON(), statusInfo: getDocumentStatus(document.expiryDate) } });
    } catch (err) { next(err); }
  });
});

router.get('/:id/download', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!document || !fs.existsSync(document.filePath)) return res.status(404).json({ message: 'File not found.' });
    res.download(document.filePath, document.originalName);
  } catch (error) { next(error); }
});

router.delete('/:id', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!document) return res.status(404).json({ message: 'Document not found.' });
    await document.update({ isArchived: true });
    await logActivity(req, 'ARCHIVE', 'Document', document.id, { title: document.title });
    res.json({ message: 'Document archived.' });
  } catch (error) { next(error); }
});

module.exports = router;
