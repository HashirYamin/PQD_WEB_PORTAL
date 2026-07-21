const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  Company,
  User,
  AlertSetting,
  CompanyAddress,
  CompanySocialLink,
  CompanyContact,
  CompanyDocument
} = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { createUploader } = require('../utils/upload');
const { logActivity } = require('../utils/activity');
const { getDocumentStatus } = require('../utils/docStatus');
const { extractDocumentFields } = require('../services/expiryExtractionService');

const router = express.Router();

const logoUpload = createUploader('logos', {
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/avif',
    'image/svg+xml'
  ],
  maxBytes: 5 * 1024 * 1024
}).single('logo');

const profileDocumentUpload = createUploader('company-profile-documents').single('file');


const normalizeUploadedLogo = async (file) => {
  if (['image/png', 'image/jpeg'].includes(file.mimetype)) return file.path;
  const sharp = require('sharp');
  const parsed = path.parse(file.path);
  const convertedPath = path.join(parsed.dir, `${parsed.name}.png`);
  await sharp(file.path).png().toFile(convertedPath);
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  return convertedPath;
};

const parseJsonField = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const canViewCompany = (req, companyId) => (
  req.user.role === 'SUPER_ADMIN' || req.user.companyId === companyId
);

const canManageCompany = (req, companyId) => (
  req.user.role === 'SUPER_ADMIN' ||
  (req.user.role === 'COMPANY_ADMIN' && req.user.companyId === companyId)
);

const profileInclude = [
  { model: AlertSetting, as: 'alertSetting' },
  { model: CompanyAddress, as: 'addresses', separate: true, order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']] },
  { model: CompanySocialLink, as: 'socialLinks', separate: true, order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']] },
  { model: CompanyContact, as: 'contacts', separate: true, order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']] }
];

const PROFILE_CATEGORIES = ['Legal Documents', 'Certificates'];

const profileTypeFromCategory = (category) => (
  category === 'Certificates' ? 'CERTIFICATION' : 'LEGAL'
);

const profileCategoryFromType = (type) => (
  String(type || '').toUpperCase() === 'CERTIFICATION'
    ? 'Certificates'
    : 'Legal Documents'
);

const serializeProfileDocument = (document) => {
  const json = document.toJSON ? document.toJSON() : document;
  return {
    ...json,
    type: profileTypeFromCategory(json.category),
    authority: json.issuingAuthority || null,
    statusInfo: getDocumentStatus(json.expiryDate, json.expiryNotApplicable)
  };
};

const loadProfileDocuments = (companyId) => CompanyDocument.findAll({
  where: {
    companyId,
    isArchived: false,
    category: { [Op.in]: PROFILE_CATEGORIES }
  },
  order: [['category', 'ASC'], ['createdAt', 'DESC']]
});

const serializeCompany = (company, profileDocuments = []) => {
  if (!company) return null;
  const json = company.toJSON();
  json.profileDocuments = profileDocuments.map(serializeProfileDocument);
  return json;
};

const formatAddress = (address) => [
  address.addressLine1,
  address.addressLine2,
  address.city,
  address.state,
  address.postalCode,
  address.country
].filter(Boolean).join(', ');

const syncPrimaryAddress = async (companyId, transaction) => {
  const primary = await CompanyAddress.findOne({
    where: { companyId },
    order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']],
    transaction
  });

  await Company.update(
    { address: primary ? formatAddress(primary) : null },
    { where: { id: companyId }, transaction }
  );
};

const syncPrimaryContact = async (companyId, transaction) => {
  const primary = await CompanyContact.findOne({
    where: { companyId },
    order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']],
    transaction
  });

  if (!primary) return;

  await Company.update(
    {
      contactPerson: primary.name,
      email: primary.email || undefined,
      phone: primary.phone || primary.mobile || undefined
    },
    { where: { id: companyId }, transaction }
  );
};

const findCompanyForWrite = async (req, res) => {
  if (!canManageCompany(req, req.params.id)) {
    res.status(403).json({ message: 'Access denied.' });
    return null;
  }

  const company = await Company.findByPk(req.params.id);
  if (!company) {
    res.status(404).json({ message: 'Company not found.' });
    return null;
  }

  return company;
};

router.use(authenticate);

router.get('/registrations/pending', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const inactiveCompanies = await Company.findAll({
      where: { isActive: false },
      include: [{ model: User, as: 'users', attributes: { exclude: ['passwordHash'] } }],
      order: [['createdAt', 'DESC']]
    });

    const companies = inactiveCompanies.filter(
      (company) => company.settings?.registrationStatus === 'PENDING_APPROVAL'
    );

    res.json({ companies });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      const company = await Company.findByPk(req.user.companyId);
      return res.json({ companies: company ? [company] : [] });
    }

    const companies = await Company.findAll({ order: [['createdAt', 'DESC']] });
    return res.json({ companies });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const company = await Company.create(req.body);
    await AlertSetting.create({ companyId: company.id });
    req.companyId = company.id;
    await logActivity(req, 'CREATE', 'Company', company.id, { name: company.name });
    res.status(201).json({ company });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/approve-registration', authorize('SUPER_ADMIN'), async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const company = await Company.findByPk(req.params.id, { transaction });

    if (!company) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Company registration not found.' });
    }

    if (company.settings?.registrationStatus !== 'PENDING_APPROVAL') {
      await transaction.rollback();
      return res.status(400).json({ message: 'This company is not waiting for approval.' });
    }

    await company.update({
      isActive: true,
      settings: {
        ...(company.settings || {}),
        registrationStatus: 'APPROVED',
        approvedAt: new Date().toISOString(),
        approvedBy: req.user.id
      }
    }, { transaction });

    await User.update(
      { isActive: true },
      { where: { companyId: company.id, role: 'COMPANY_ADMIN' }, transaction }
    );

    await transaction.commit();
    req.companyId = company.id;
    await logActivity(req, 'APPROVE_REGISTRATION', 'Company', company.id, { name: company.name });

    return res.json({ message: 'Company registration approved successfully.', company });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.patch('/:id/reject-registration', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company registration not found.' });

    if (company.settings?.registrationStatus !== 'PENDING_APPROVAL') {
      return res.status(400).json({ message: 'This company is not waiting for review.' });
    }

    const rejectionReason = String(req.body.rejectionReason || '').trim();
    if (!rejectionReason) return res.status(400).json({ message: 'A rejection reason is required.' });

    await company.update({
      isActive: false,
      settings: {
        ...(company.settings || {}),
        registrationStatus: 'REJECTED',
        rejectionReason,
        rejectedAt: new Date().toISOString(),
        rejectedBy: req.user.id
      }
    });

    req.companyId = company.id;
    await logActivity(req, 'REJECT_REGISTRATION', 'Company', company.id, {
      name: company.name,
      rejectionReason
    });

    return res.json({ message: 'Company registration rejected.', company });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!canViewCompany(req, req.params.id)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const company = await Company.findByPk(req.params.id, { include: profileInclude });
    if (!company) return res.status(404).json({ message: 'Company not found.' });

    const profileDocuments = await loadProfileDocuments(company.id);
    return res.json({ company: serializeCompany(company, profileDocuments) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) return;

    const allowed = [
      'name',
      'crNumber',
      'yearEstablished',
      'natureOfWork',
      'address',
      'contactPerson',
      'email',
      'phone',
      'fax',
      'website',
      'stampPath',
      'settings',
      'isActive'
    ];

    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    }

    if (req.user.role !== 'SUPER_ADMIN') delete updates.isActive;
    if (updates.yearEstablished === '') updates.yearEstablished = null;

    await company.update(updates);
    req.companyId = company.id;
    await logActivity(req, 'UPDATE', 'Company', company.id, { name: company.name });

    const refreshed = await Company.findByPk(company.id, { include: profileInclude });
    const profileDocuments = await loadProfileDocuments(company.id);
    return res.json({ company: serializeCompany(refreshed, profileDocuments) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/logo', async (req, res, next) => {
  if (!canManageCompany(req, req.params.id)) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  req.companyId = req.params.id;
  logoUpload(req, res, async (error) => {
    let finalLogoPath = null;
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'Logo file is required.' });

      const company = await Company.findByPk(req.params.id);
      if (!company) return res.status(404).json({ message: 'Company not found.' });

      finalLogoPath = await normalizeUploadedLogo(req.file);
      const oldPath = company.logoPath;
      await company.update({ logoPath: finalLogoPath });
      if (oldPath && oldPath !== finalLogoPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      await logActivity(req, 'UPLOAD_LOGO', 'Company', company.id);
      return res.json({ company });
    } catch (err) {
      [req.file?.path, finalLogoPath].filter(Boolean).forEach((filePath) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
      next(err);
    }
  });
});

router.get('/:id/logo', async (req, res, next) => {
  try {
    if (!canViewCompany(req, req.params.id)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const company = await Company.findByPk(req.params.id, { attributes: ['id', 'logoPath'] });
    if (!company?.logoPath) return res.status(404).json({ message: 'Company logo not found.' });

    const absolutePath = path.resolve(company.logoPath);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ message: 'Company logo file not found.' });

    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
});

// Addresses
router.post('/:id/addresses', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) {
      await transaction.rollback();
      return;
    }

    const addressLine1 = String(req.body.addressLine1 || '').trim();
    if (!addressLine1) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Address line 1 is required.' });
    }

    const count = await CompanyAddress.count({ where: { companyId: company.id }, transaction });
    const isPrimary = parseBoolean(req.body.isPrimary, count === 0);

    if (isPrimary) {
      await CompanyAddress.update({ isPrimary: false }, { where: { companyId: company.id }, transaction });
    }

    const address = await CompanyAddress.create({
      companyId: company.id,
      label: String(req.body.label || 'Main Office').trim(),
      addressLine1,
      addressLine2: String(req.body.addressLine2 || '').trim() || null,
      city: String(req.body.city || '').trim() || null,
      state: String(req.body.state || '').trim() || null,
      postalCode: String(req.body.postalCode || '').trim() || null,
      country: String(req.body.country || '').trim() || null,
      isPrimary
    }, { transaction });

    await syncPrimaryAddress(company.id, transaction);
    await transaction.commit();

    req.companyId = company.id;
    await logActivity(req, 'CREATE', 'CompanyAddress', address.id, { label: address.label });
    return res.status(201).json({ address });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.put('/:id/addresses/:addressId', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) {
      await transaction.rollback();
      return;
    }

    const address = await CompanyAddress.findOne({
      where: { id: req.params.addressId, companyId: company.id },
      transaction
    });
    if (!address) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Address not found.' });
    }

    const updates = {};
    ['label', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key] || null;
    });

    if (Object.prototype.hasOwnProperty.call(req.body, 'isPrimary')) {
      updates.isPrimary = parseBoolean(req.body.isPrimary);
      if (updates.isPrimary) {
        await CompanyAddress.update({ isPrimary: false }, {
          where: { companyId: company.id },
          transaction
        });
      }
    }

    await address.update(updates, { transaction });
    await syncPrimaryAddress(company.id, transaction);
    await transaction.commit();

    req.companyId = company.id;
    await logActivity(req, 'UPDATE', 'CompanyAddress', address.id, { label: address.label });
    return res.json({ address });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.delete('/:id/addresses/:addressId', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) {
      await transaction.rollback();
      return;
    }

    const address = await CompanyAddress.findOne({
      where: { id: req.params.addressId, companyId: company.id },
      transaction
    });
    if (!address) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Address not found.' });
    }

    await address.destroy({ transaction });
    await syncPrimaryAddress(company.id, transaction);
    await transaction.commit();

    req.companyId = company.id;
    await logActivity(req, 'DELETE', 'CompanyAddress', req.params.addressId);
    return res.json({ message: 'Address removed.' });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

// Social links
router.post('/:id/social-links', async (req, res, next) => {
  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) return;

    const platform = String(req.body.platform || '').trim();
    const url = String(req.body.url || '').trim();
    if (!platform || !url) return res.status(400).json({ message: 'Platform and URL are required.' });

    const socialLink = await CompanySocialLink.create({
      companyId: company.id,
      platform,
      url,
      sortOrder: Number(req.body.sortOrder || 0)
    });

    req.companyId = company.id;
    await logActivity(req, 'CREATE', 'CompanySocialLink', socialLink.id, { platform });
    return res.status(201).json({ socialLink });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/social-links/:linkId', async (req, res, next) => {
  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) return;

    const socialLink = await CompanySocialLink.findOne({
      where: { id: req.params.linkId, companyId: company.id }
    });
    if (!socialLink) return res.status(404).json({ message: 'Social link not found.' });

    const updates = {};
    ['platform', 'url', 'sortOrder'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    });

    await socialLink.update(updates);
    req.companyId = company.id;
    await logActivity(req, 'UPDATE', 'CompanySocialLink', socialLink.id, { platform: socialLink.platform });
    return res.json({ socialLink });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/social-links/:linkId', async (req, res, next) => {
  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) return;

    const socialLink = await CompanySocialLink.findOne({
      where: { id: req.params.linkId, companyId: company.id }
    });
    if (!socialLink) return res.status(404).json({ message: 'Social link not found.' });

    await socialLink.destroy();
    req.companyId = company.id;
    await logActivity(req, 'DELETE', 'CompanySocialLink', req.params.linkId);
    return res.json({ message: 'Social link removed.' });
  } catch (error) {
    next(error);
  }
});

// Contacts
router.post('/:id/contacts', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) {
      await transaction.rollback();
      return;
    }

    const name = String(req.body.name || '').trim();
    if (!name) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Contact name is required.' });
    }

    const count = await CompanyContact.count({ where: { companyId: company.id }, transaction });
    const isPrimary = parseBoolean(req.body.isPrimary, count === 0);

    if (isPrimary) {
      await CompanyContact.update({ isPrimary: false }, { where: { companyId: company.id }, transaction });
    }

    const contact = await CompanyContact.create({
      companyId: company.id,
      name,
      jobTitle: String(req.body.jobTitle || '').trim() || null,
      department: String(req.body.department || '').trim() || null,
      email: String(req.body.email || '').trim().toLowerCase() || null,
      phone: String(req.body.phone || '').trim() || null,
      mobile: String(req.body.mobile || '').trim() || null,
      isPrimary
    }, { transaction });

    await syncPrimaryContact(company.id, transaction);
    await transaction.commit();

    req.companyId = company.id;
    await logActivity(req, 'CREATE', 'CompanyContact', contact.id, { name: contact.name });
    return res.status(201).json({ contact });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.put('/:id/contacts/:contactId', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) {
      await transaction.rollback();
      return;
    }

    const contact = await CompanyContact.findOne({
      where: { id: req.params.contactId, companyId: company.id },
      transaction
    });
    if (!contact) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Contact not found.' });
    }

    const updates = {};
    ['name', 'jobTitle', 'department', 'email', 'phone', 'mobile'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key] || null;
    });
    if (updates.email) updates.email = String(updates.email).toLowerCase();

    if (Object.prototype.hasOwnProperty.call(req.body, 'isPrimary')) {
      updates.isPrimary = parseBoolean(req.body.isPrimary);
      if (updates.isPrimary) {
        await CompanyContact.update({ isPrimary: false }, {
          where: { companyId: company.id },
          transaction
        });
      }
    }

    await contact.update(updates, { transaction });
    await syncPrimaryContact(company.id, transaction);
    await transaction.commit();

    req.companyId = company.id;
    await logActivity(req, 'UPDATE', 'CompanyContact', contact.id, { name: contact.name });
    return res.json({ contact });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.delete('/:id/contacts/:contactId', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) {
      await transaction.rollback();
      return;
    }

    const contact = await CompanyContact.findOne({
      where: { id: req.params.contactId, companyId: company.id },
      transaction
    });
    if (!contact) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Contact not found.' });
    }

    await contact.destroy({ transaction });
    await syncPrimaryContact(company.id, transaction);
    await transaction.commit();

    req.companyId = company.id;
    await logActivity(req, 'DELETE', 'CompanyContact', req.params.contactId);
    return res.json({ message: 'Contact removed.' });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

// Legal documents and certifications shown inside Company Profile
router.post('/:id/profile-documents/extract', async (req, res, next) => {
  if (!canManageCompany(req, req.params.id)) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  req.companyId = req.params.id;
  profileDocumentUpload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'Choose a PDF or image file.' });

      const extraction = await extractDocumentFields(
        req.file.path,
        req.file.mimetype,
        req.file.originalname
      );

      return res.json({ extraction });
    } catch (err) {
      next(err);
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  });
});

router.post('/:id/profile-documents', async (req, res, next) => {
  if (!canManageCompany(req, req.params.id)) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  req.companyId = req.params.id;
  profileDocumentUpload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'A file is required.' });

      const company = await Company.findByPk(req.params.id);
      if (!company) return res.status(404).json({ message: 'Company not found.' });

      const type = String(req.body.type || '').toUpperCase();
      if (!['LEGAL', 'CERTIFICATION'].includes(type)) {
        return res.status(400).json({ message: 'Document type must be LEGAL or CERTIFICATION.' });
      }

      const expiryNotApplicable = parseBoolean(req.body.expiryNotApplicable);
      const previewExtraction = parseJsonField(req.body.ocrData);
      const extraction = previewExtraction?.fields
        ? previewExtraction
        : await extractDocumentFields(req.file.path, req.file.mimetype, req.file.originalname);
      const fields = extraction.fields || {};

      const document = await CompanyDocument.create({
        companyId: company.id,
        createdById: req.user.id,
        category: profileCategoryFromType(type),
        title: String(req.body.title || fields.title || '').trim() || req.file.originalname,
        documentNumber: String(req.body.documentNumber || fields.documentNumber || '').trim() || null,
        issueDate: String(req.body.issueDate || fields.issueDate || '').trim() || null,
        expiryDate: expiryNotApplicable
          ? null
          : (String(req.body.expiryDate || fields.expiryDate || '').trim() || null),
        expiryNotApplicable,
        issuingAuthority: String(req.body.authority || fields.authority || '').trim() || null,
        documentType: type === 'CERTIFICATION' ? 'Certificate' : 'Legal Document',
        remarks: String(req.body.remarks || '').trim() || null,
        ocrData: extraction,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      });

      await logActivity(req, 'UPLOAD', 'CompanyDocument', document.id, {
        title: document.title,
        type,
        extractedFields: extraction.fields || {}
      });

      return res.status(201).json({
        document: serializeProfileDocument(document)
      });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(err);
    }
  });
});

router.put('/:id/profile-documents/:documentId', async (req, res, next) => {
  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) return;

    const document = await CompanyDocument.findOne({
      where: { id: req.params.documentId, companyId: company.id, isArchived: false }
    });
    if (!document) return res.status(404).json({ message: 'Profile document not found.' });

    const updates = {};
    ['title', 'documentNumber', 'issueDate', 'expiryDate', 'remarks'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key] || null;
    });

    if (Object.prototype.hasOwnProperty.call(req.body, 'authority')) {
      updates.issuingAuthority = req.body.authority || null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'type')) {
      const type = String(req.body.type || '').toUpperCase();
      if (!['LEGAL', 'CERTIFICATION'].includes(type)) {
        return res.status(400).json({ message: 'Document type must be LEGAL or CERTIFICATION.' });
      }
      updates.category = profileCategoryFromType(type);
      updates.documentType = type === 'CERTIFICATION' ? 'Certificate' : 'Legal Document';
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'expiryNotApplicable')) {
      updates.expiryNotApplicable = parseBoolean(req.body.expiryNotApplicable);
      if (updates.expiryNotApplicable) updates.expiryDate = null;
    }

    await document.update(updates);
    req.companyId = company.id;
    await logActivity(req, 'UPDATE', 'CompanyDocument', document.id, { title: document.title });

    return res.json({
      document: serializeProfileDocument(document)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/profile-documents/:documentId/replace', async (req, res, next) => {
  if (!canManageCompany(req, req.params.id)) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  req.companyId = req.params.id;

  profileDocumentUpload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'A replacement file is required.' });

      const document = await CompanyDocument.findOne({
        where: { id: req.params.documentId, companyId: req.params.id, isArchived: false }
      });
      if (!document) return res.status(404).json({ message: 'Profile document not found.' });

      const extraction = await extractDocumentFields(req.file.path, req.file.mimetype, req.file.originalname);
      const oldPath = document.filePath;
      const updates = {
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        ocrData: extraction
      };

      const applyOcrFields = parseBoolean(req.body.applyOcrFields, false)
        || parseBoolean(req.body.applyOcrDate, false);

      if (applyOcrFields) {
        const fields = extraction.fields || {};
        if (fields.title) updates.title = fields.title;
        if (fields.documentNumber) updates.documentNumber = fields.documentNumber;
        if (fields.authority) updates.issuingAuthority = fields.authority;
        if (fields.issueDate) updates.issueDate = fields.issueDate;
        if (!document.expiryNotApplicable && fields.expiryDate) {
          updates.expiryDate = fields.expiryDate;
        }
      }

      await document.update(updates);
      if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      await logActivity(req, 'REPLACE_FILE', 'CompanyDocument', document.id, {
        title: document.title,
        ocrExpiryDate: extraction.fields?.expiryDate || null
      });

      return res.json({
        document: serializeProfileDocument(document)
      });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(err);
    }
  });
});

router.get('/:id/profile-documents/:documentId/download', async (req, res, next) => {
  try {
    if (!canViewCompany(req, req.params.id)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const document = await CompanyDocument.findOne({
      where: { id: req.params.documentId, companyId: req.params.id, isArchived: false }
    });

    if (!document || !fs.existsSync(document.filePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }

    return res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/profile-documents/:documentId', async (req, res, next) => {
  try {
    const company = await findCompanyForWrite(req, res);
    if (!company) return;

    const document = await CompanyDocument.findOne({
      where: { id: req.params.documentId, companyId: company.id, isArchived: false }
    });
    if (!document) return res.status(404).json({ message: 'Profile document not found.' });

    await document.update({ isArchived: true });
    req.companyId = company.id;
    await logActivity(req, 'ARCHIVE', 'CompanyDocument', document.id, { title: document.title });
    return res.json({ message: 'Profile document archived.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
