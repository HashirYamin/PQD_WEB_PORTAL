const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { CompanyDocument } = require('../models');
const { authenticate, enforceCompany } = require('../middleware/auth');
const { createUploader } = require('../utils/upload');
const { getDocumentStatus } = require('../utils/docStatus');
const { logActivity } = require('../utils/activity');
const { extractExpiryDate } = require('../services/expiryExtractionService');

const router = express.Router();
const upload = createUploader('documents').single('file');

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const serializeDocument = (document) => ({
  ...document.toJSON(),
  statusInfo: getDocumentStatus(document.expiryDate, document.expiryNotApplicable)
});

router.use(authenticate);

router.get('/', enforceCompany, async (req, res, next) => {
  try {
    const where = {
      companyId: req.companyId,
      isArchived: req.query.archived === 'true'
    };

    if (req.query.category) where.category = req.query.category;
    if (req.query.search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${req.query.search}%` } },
        { originalName: { [Op.like]: `%${req.query.search}%` } },
        { documentNumber: { [Op.like]: `%${req.query.search}%` } }
      ];
    }

    const documents = await CompanyDocument.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json({ documents: documents.map(serializeDocument) });
  } catch (error) {
    next(error);
  }
});

router.post('/', enforceCompany, (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'A file is required.' });

      const expiryNotApplicable = parseBoolean(req.body.expiryNotApplicable);
      const manualExpiryDate = String(req.body.expiryDate || '').trim() || null;
      const extraction = (!expiryNotApplicable && !manualExpiryDate)
        ? await extractExpiryDate(req.file.path, req.file.mimetype)
        : {
            attempted: false,
            method: 'MANUAL_ENTRY',
            expiryDate: null,
            confidence: 0,
            candidates: [],
            warning: null,
            extractedAt: new Date().toISOString()
          };

      const document = await CompanyDocument.create({
        companyId: req.companyId,
        createdById: req.user.id,
        title: req.body.title || path.parse(req.file.originalname).name,
        category: req.body.category || 'Other',
        documentNumber: String(req.body.documentNumber || '').trim() || null,
        issuingAuthority: String(req.body.issuingAuthority || '').trim() || null,
        issueDate: req.body.issueDate || null,
        expiryDate: expiryNotApplicable ? null : (manualExpiryDate || extraction.expiryDate || null),
        expiryNotApplicable,
        ocrData: extraction,
        documentType: req.body.documentType || req.file.mimetype,
        remarks: req.body.remarks || null,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      });

      await logActivity(req, 'UPLOAD', 'Document', document.id, {
        title: document.title,
        ocrExpiryDate: extraction.expiryDate
      });

      res.status(201).json({ document: serializeDocument(document) });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(err);
    }
  });
});

router.put('/:id', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({
      where: { id: req.params.id, companyId: req.companyId }
    });

    if (!document) return res.status(404).json({ message: 'Document not found.' });

    const allowed = [
      'title',
      'category',
      'documentNumber',
      'issuingAuthority',
      'issueDate',
      'expiryDate',
      'documentType',
      'remarks',
      'isArchived'
    ];

    const updates = {};
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key] === '' ? null : req.body[key];
      }
    });

    if (Object.prototype.hasOwnProperty.call(req.body, 'expiryNotApplicable')) {
      updates.expiryNotApplicable = parseBoolean(req.body.expiryNotApplicable);
      if (updates.expiryNotApplicable) updates.expiryDate = null;
    }

    await document.update(updates);
    await logActivity(req, 'UPDATE', 'Document', document.id, { title: document.title });
    res.json({ document: serializeDocument(document) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/replace', enforceCompany, (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'A replacement file is required.' });

      const document = await CompanyDocument.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!document) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Document not found.' });
      }

      const extraction = await extractExpiryDate(req.file.path, req.file.mimetype);
      const oldPath = document.filePath;
      const updates = {
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        ocrData: extraction
      };

      const shouldApplyOcr = parseBoolean(req.body.applyOcrDate, false);
      if (!document.expiryNotApplicable && extraction.expiryDate && shouldApplyOcr) {
        updates.expiryDate = extraction.expiryDate;
      }

      await document.update(updates);
      if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      await logActivity(req, 'REPLACE_FILE', 'Document', document.id, {
        title: document.title,
        ocrExpiryDate: extraction.expiryDate
      });

      res.json({ document: serializeDocument(document) });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(err);
    }
  });
});

router.get('/:id/download', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({
      where: { id: req.params.id, companyId: req.companyId }
    });

    if (!document || !fs.existsSync(document.filePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }

    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({
      where: { id: req.params.id, companyId: req.companyId }
    });

    if (!document) return res.status(404).json({ message: 'Document not found.' });

    await document.update({ isArchived: true });
    await logActivity(req, 'ARCHIVE', 'Document', document.id, { title: document.title });
    res.json({ message: 'Document archived.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
