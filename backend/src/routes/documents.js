const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { CompanyDocument } = require('../models');
const { authenticate, enforceCompany } = require('../middleware/auth');
const { createUploader } = require('../utils/upload');
const { getDocumentStatus } = require('../utils/docStatus');
const { logActivity } = require('../utils/activity');
const { extractDocumentFields } = require('../services/expiryExtractionService');

const router = express.Router();
const upload = createUploader('documents').single('file');
const extractionUpload = createUploader('document-extraction').single('file');

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const parseJsonField = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const serializeDocument = (document) => ({
  ...document.toJSON(),
  statusInfo: getDocumentStatus(
    document.expiryDate,
    document.expiryNotApplicable
  )
});

const inferredType = (category, mimeType) => {
  if (category === 'Certificates') return 'Certificate';
  if (category === 'Legal Documents') return 'Legal Document';
  return mimeType || 'Document';
};

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
        { title: { [Op.iLike]: `%${req.query.search}%` } },
        { originalName: { [Op.iLike]: `%${req.query.search}%` } },
        { documentNumber: { [Op.iLike]: `%${req.query.search}%` } },
        { issuingAuthority: { [Op.iLike]: `%${req.query.search}%` } }
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

// Runs OCR immediately after file selection. The temporary file is deleted
// after extraction, and the user can verify/edit all suggested fields before save.
router.post('/extract', enforceCompany, (req, res, next) => {
  extractionUpload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) {
        return res.status(400).json({
          message: 'Choose a PDF or image file.'
        });
      }

      const extraction = await extractDocumentFields(
        req.file.path,
        req.file.mimetype,
        req.file.originalname
      );

      return res.json({ extraction });
    } catch (err) {
      next(err);
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  });
});

router.post('/', enforceCompany, (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) {
        return res.status(400).json({ message: 'A file is required.' });
      }

      const expiryNotApplicable = parseBoolean(
        req.body.expiryNotApplicable
      );

      const previewExtraction = parseJsonField(req.body.ocrData);
      const extraction = previewExtraction?.fields
        ? previewExtraction
        : await extractDocumentFields(
            req.file.path,
            req.file.mimetype,
            req.file.originalname
          );

      const fields = extraction.fields || {};
      const category = String(req.body.category || 'Other').trim();

      const document = await CompanyDocument.create({
        companyId: req.companyId,
        createdById: req.user.id,
        title:
          String(req.body.title || fields.title || '').trim() ||
          path.parse(req.file.originalname).name,
        category,
        documentNumber:
          String(
            req.body.documentNumber || fields.documentNumber || ''
          ).trim() || null,
        issuingAuthority:
          String(
            req.body.issuingAuthority || fields.authority || ''
          ).trim() || null,
        issueDate:
          String(req.body.issueDate || fields.issueDate || '').trim() ||
          null,
        expiryDate: expiryNotApplicable
          ? null
          : String(
              req.body.expiryDate || fields.expiryDate || ''
            ).trim() || null,
        expiryNotApplicable,
        ocrData: extraction,
        documentType:
          String(req.body.documentType || '').trim() ||
          inferredType(category, req.file.mimetype),
        remarks: String(req.body.remarks || '').trim() || null,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      });

      await logActivity(req, 'UPLOAD', 'Document', document.id, {
        title: document.title,
        extractedFields: extraction.fields || {}
      });

      return res.status(201).json({
        document: serializeDocument(document)
      });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(err);
    }
  });
});

router.put('/:id', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

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

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        'expiryNotApplicable'
      )
    ) {
      updates.expiryNotApplicable = parseBoolean(
        req.body.expiryNotApplicable
      );
      if (updates.expiryNotApplicable) updates.expiryDate = null;
    }

    await document.update(updates);
    await logActivity(req, 'UPDATE', 'Document', document.id, {
      title: document.title
    });

    return res.json({ document: serializeDocument(document) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/replace', enforceCompany, (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) {
        return res.status(400).json({
          message: 'A replacement file is required.'
        });
      }

      const document = await CompanyDocument.findOne({
        where: {
          id: req.params.id,
          companyId: req.companyId
        }
      });

      if (!document) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Document not found.' });
      }

      const extraction = await extractDocumentFields(
        req.file.path,
        req.file.mimetype,
        req.file.originalname
      );

      const oldPath = document.filePath;
      const updates = {
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        ocrData: extraction
      };

      if (parseBoolean(req.body.applyOcrFields, false)) {
        const fields = extraction.fields || {};
        if (fields.title) updates.title = fields.title;
        if (fields.documentNumber) {
          updates.documentNumber = fields.documentNumber;
        }
        if (fields.authority) {
          updates.issuingAuthority = fields.authority;
        }
        if (fields.issueDate) updates.issueDate = fields.issueDate;
        if (!document.expiryNotApplicable && fields.expiryDate) {
          updates.expiryDate = fields.expiryDate;
        }
      }

      await document.update(updates);

      if (oldPath && oldPath !== req.file.path && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }

      await logActivity(req, 'REPLACE_FILE', 'Document', document.id, {
        title: document.title,
        extractedFields: extraction.fields || {}
      });

      return res.json({ document: serializeDocument(document) });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(err);
    }
  });
});

// Inline view endpoint. The frontend fetches it as an authenticated blob and
// opens it in a new browser tab.
router.get('/:id/view', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId,
        isArchived: false
      }
    });

    if (!document || !document.filePath) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const absolutePath = path.resolve(document.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }

    if (document.mimeType) res.type(document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(
        document.originalName || path.basename(absolutePath)
      )}`
    );
    res.setHeader('Cache-Control', 'private, no-store');

    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/download', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId
      }
    });

    if (!document || !document.filePath) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const absolutePath = path.resolve(document.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }

    return res.download(
      absolutePath,
      document.originalName || path.basename(absolutePath)
    );
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', enforceCompany, async (req, res, next) => {
  try {
    const document = await CompanyDocument.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    await document.update({ isArchived: true });
    await logActivity(req, 'ARCHIVE', 'Document', document.id, {
      title: document.title
    });

    return res.json({ message: 'Document archived.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
