const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  Supplier,
  SupplierAddress,
  SupplierContact,
  SupplierProfileDocument,
  SupplierProduct,
  ProductDocumentLink,
  CompanyDocument,
  MasterChecklistItem,
  ChildChecklist,
  ChildChecklistItem
} = require('../models');
const {
  authenticate,
  authorize,
  enforceCompany
} = require('../middleware/auth');
const { createUploader } = require('../utils/upload');
const { logActivity } = require('../utils/activity');
const { getDocumentStatus } = require('../utils/docStatus');

const router = express.Router();
router.use(authenticate);

const logoUpload = createUploader('supplier-logos', {
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 5 * 1024 * 1024
}).single('logo');

const isManager = (req) =>
  ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role);

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const serializeDocument = (document) => {
  if (!document) return null;
  const json = document.toJSON ? document.toJSON() : document;
  return {
    ...json,
    statusInfo: getDocumentStatus(
      json.expiryDate,
      json.expiryNotApplicable
    )
  };
};

const documentInclude = {
  model: CompanyDocument,
  as: 'document',
  required: false
};

const supplierDetailInclude = [
  {
    model: SupplierAddress,
    as: 'addresses',
    separate: true,
    order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']]
  },
  {
    model: SupplierContact,
    as: 'contacts',
    separate: true,
    order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']]
  },
  {
    model: SupplierProfileDocument,
    as: 'profileDocuments',
    where: { isActive: true },
    required: false,
    separate: true,
    order: [['type', 'ASC'], ['sortOrder', 'ASC'], ['createdAt', 'DESC']],
    include: [documentInclude]
  },
  {
    model: SupplierProduct,
    as: 'products',
    separate: true,
    order: [['isActive', 'DESC'], ['name', 'ASC']],
    include: [
      {
        model: ProductDocumentLink,
        as: 'documentLinks',
        where: { isActive: true },
        required: false,
        separate: true,
        order: [['priority', 'ASC'], ['createdAt', 'ASC']],
        include: [
          documentInclude,
          {
            model: MasterChecklistItem,
            as: 'masterItem',
            attributes: ['id', 'title', 'sortOrder', 'isActive']
          }
        ]
      }
    ]
  }
];

const serializeSupplier = (supplier) => {
  const json = supplier.toJSON();

  json.profileDocuments = (json.profileDocuments || []).map((link) => ({
    ...link,
    document: link.document
      ? {
          ...link.document,
          statusInfo: getDocumentStatus(
            link.document.expiryDate,
            link.document.expiryNotApplicable
          )
        }
      : null
  }));

  json.products = (json.products || []).map((product) => ({
    ...product,
    documentLinks: (product.documentLinks || []).map((link) => ({
      ...link,
      document: link.document
        ? {
            ...link.document,
            statusInfo: getDocumentStatus(
              link.document.expiryDate,
              link.document.expiryNotApplicable
            )
          }
        : null
    }))
  }));

  return json;
};

const getSupplier = async (id, companyId, transaction = undefined) =>
  Supplier.findOne({
    where: { id, companyId },
    include: supplierDetailInclude,
    transaction
  });

const findSupplier = async (req, res, options = {}) => {
  const supplier = await Supplier.findOne({
    where: {
      id: req.params.id || req.params.supplierId,
      companyId: req.companyId,
      ...(options.activeOnly ? { isActive: true } : {})
    },
    transaction: options.transaction
  });

  if (!supplier) {
    res.status(404).json({ message: 'Supplier profile not found.' });
    return null;
  }

  return supplier;
};

const findProduct = async (req, res, supplier, options = {}) => {
  const product = await SupplierProduct.findOne({
    where: {
      id: req.params.productId,
      supplierId: supplier.id,
      ...(options.activeOnly ? { isActive: true } : {})
    },
    transaction: options.transaction
  });

  if (!product) {
    res.status(404).json({ message: 'Supplier product not found.' });
    return null;
  }

  return product;
};

router.get('/', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };

    if (req.query.active === 'true') where.isActive = true;

    if (req.query.search) {
      const search = `%${String(req.query.search).trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: search } },
        { code: { [Op.iLike]: search } },
        { registrationNumber: { [Op.iLike]: search } },
        { email: { [Op.iLike]: search } }
      ];
    }

    const suppliers = await Supplier.findAll({
      where,
      include: [
        { model: SupplierProduct, as: 'products', attributes: ['id'] },
        { model: SupplierContact, as: 'contacts', attributes: ['id'] }
      ],
      order: [['isActive', 'DESC'], ['name', 'ASC']]
    });

    res.json({
      suppliers: suppliers.map((supplier) => ({
        ...supplier.toJSON(),
        productCount: supplier.products?.length || 0,
        contactCount: supplier.contacts?.length || 0
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Supplier name is required.' });
      }

      const supplier = await Supplier.create({
        companyId: req.companyId,
        name,
        code: String(req.body.code || '').trim() || null,
        registrationNumber:
          String(req.body.registrationNumber || '').trim() || null,
        yearEstablished: req.body.yearEstablished || null,
        natureOfBusiness:
          String(req.body.natureOfBusiness || '').trim() || null,
        email: String(req.body.email || '').trim().toLowerCase() || null,
        phone: String(req.body.phone || '').trim() || null,
        fax: String(req.body.fax || '').trim() || null,
        website: String(req.body.website || '').trim() || null,
        description: String(req.body.description || '').trim() || null,
        isActive: req.body.isActive !== false
      });

      await logActivity(req, 'CREATE', 'Supplier', supplier.id, {
        name: supplier.name
      });

      res.status(201).json({ supplier });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id/logo', enforceCompany, async (req, res, next) => {
  try {
    const supplier = await findSupplier(req, res);
    if (!supplier) return;

    if (!supplier.logoPath || !fs.existsSync(supplier.logoPath)) {
      return res.status(404).json({ message: 'Supplier logo not found.' });
    }

    res.sendFile(path.resolve(supplier.logoPath));
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/logo',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    const supplier = await findSupplier(req, res);
    if (!supplier) return;

    logoUpload(req, res, async (error) => {
      try {
        if (error) throw error;
        if (!req.file) {
          return res.status(400).json({ message: 'Choose a supplier logo.' });
        }

        const oldPath = supplier.logoPath;
        await supplier.update({ logoPath: req.file.path });

        if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

        await logActivity(req, 'UPLOAD_LOGO', 'Supplier', supplier.id);
        res.json({ supplier });
      } catch (err) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        next(err);
      }
    });
  }
);

router.get('/:id', enforceCompany, async (req, res, next) => {
  try {
    const supplier = await getSupplier(req.params.id, req.companyId);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier profile not found.' });
    }
    res.json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    next(error);
  }
});

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;

      const allowed = [
        'name',
        'code',
        'registrationNumber',
        'yearEstablished',
        'natureOfBusiness',
        'email',
        'phone',
        'fax',
        'website',
        'description',
        'isActive'
      ];
      const updates = {};

      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key] === '' ? null : req.body[key];
        }
      }

      if (updates.email) updates.email = String(updates.email).toLowerCase();
      if (updates.yearEstablished === '') updates.yearEstablished = null;

      await supplier.update(updates);
      await logActivity(req, 'UPDATE', 'Supplier', supplier.id, {
        name: supplier.name
      });

      res.json({ supplier });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      await supplier.update({ isActive: false });
      await logActivity(req, 'DEACTIVATE', 'Supplier', supplier.id);
      res.json({ message: 'Supplier profile deactivated.' });
    } catch (error) {
      next(error);
    }
  }
);

// Supplier addresses
router.post(
  '/:id/addresses',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const supplier = await findSupplier(req, res, { transaction });
      if (!supplier) {
        await transaction.rollback();
        return;
      }

      const addressLine1 = String(req.body.addressLine1 || '').trim();
      if (!addressLine1) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Address line 1 is required.' });
      }

      const count = await SupplierAddress.count({
        where: { supplierId: supplier.id },
        transaction
      });
      const isPrimary = parseBoolean(req.body.isPrimary, count === 0);

      if (isPrimary) {
        await SupplierAddress.update(
          { isPrimary: false },
          { where: { supplierId: supplier.id }, transaction }
        );
      }

      const address = await SupplierAddress.create(
        {
          supplierId: supplier.id,
          label: String(req.body.label || 'Main Office').trim(),
          addressLine1,
          addressLine2: String(req.body.addressLine2 || '').trim() || null,
          city: String(req.body.city || '').trim() || null,
          state: String(req.body.state || '').trim() || null,
          postalCode: String(req.body.postalCode || '').trim() || null,
          country: String(req.body.country || '').trim() || null,
          isPrimary
        },
        { transaction }
      );

      await transaction.commit();
      await logActivity(req, 'CREATE', 'SupplierAddress', address.id, {
        supplierId: supplier.id
      });
      res.status(201).json({ address });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      next(error);
    }
  }
);

router.put(
  '/:id/addresses/:addressId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const supplier = await findSupplier(req, res, { transaction });
      if (!supplier) {
        await transaction.rollback();
        return;
      }

      const address = await SupplierAddress.findOne({
        where: { id: req.params.addressId, supplierId: supplier.id },
        transaction
      });
      if (!address) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Supplier address not found.' });
      }

      const updates = {};
      for (const key of [
        'label',
        'addressLine1',
        'addressLine2',
        'city',
        'state',
        'postalCode',
        'country'
      ]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key] || null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'isPrimary')) {
        updates.isPrimary = parseBoolean(req.body.isPrimary);
        if (updates.isPrimary) {
          await SupplierAddress.update(
            { isPrimary: false },
            { where: { supplierId: supplier.id }, transaction }
          );
        }
      }

      await address.update(updates, { transaction });
      await transaction.commit();
      await logActivity(req, 'UPDATE', 'SupplierAddress', address.id, {
        supplierId: supplier.id
      });
      res.json({ address });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      next(error);
    }
  }
);

router.delete(
  '/:id/addresses/:addressId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const address = await SupplierAddress.findOne({
        where: { id: req.params.addressId, supplierId: supplier.id }
      });
      if (!address) {
        return res.status(404).json({ message: 'Supplier address not found.' });
      }
      await address.destroy();
      await logActivity(req, 'DELETE', 'SupplierAddress', address.id, {
        supplierId: supplier.id
      });
      res.json({ message: 'Supplier address removed.' });
    } catch (error) {
      next(error);
    }
  }
);

// Supplier contacts
router.post(
  '/:id/contacts',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const supplier = await findSupplier(req, res, { transaction });
      if (!supplier) {
        await transaction.rollback();
        return;
      }

      const name = String(req.body.name || '').trim();
      if (!name) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Contact name is required.' });
      }

      const count = await SupplierContact.count({
        where: { supplierId: supplier.id },
        transaction
      });
      const isPrimary = parseBoolean(req.body.isPrimary, count === 0);

      if (isPrimary) {
        await SupplierContact.update(
          { isPrimary: false },
          { where: { supplierId: supplier.id }, transaction }
        );
      }

      const contact = await SupplierContact.create(
        {
          supplierId: supplier.id,
          name,
          jobTitle: String(req.body.jobTitle || '').trim() || null,
          department: String(req.body.department || '').trim() || null,
          email: String(req.body.email || '').trim().toLowerCase() || null,
          phone: String(req.body.phone || '').trim() || null,
          mobile: String(req.body.mobile || '').trim() || null,
          isPrimary
        },
        { transaction }
      );

      await transaction.commit();
      await logActivity(req, 'CREATE', 'SupplierContact', contact.id, {
        supplierId: supplier.id
      });
      res.status(201).json({ contact });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      next(error);
    }
  }
);

router.put(
  '/:id/contacts/:contactId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const supplier = await findSupplier(req, res, { transaction });
      if (!supplier) {
        await transaction.rollback();
        return;
      }

      const contact = await SupplierContact.findOne({
        where: { id: req.params.contactId, supplierId: supplier.id },
        transaction
      });
      if (!contact) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Supplier contact not found.' });
      }

      const updates = {};
      for (const key of [
        'name',
        'jobTitle',
        'department',
        'email',
        'phone',
        'mobile'
      ]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key] || null;
        }
      }

      if (updates.email) updates.email = String(updates.email).toLowerCase();

      if (Object.prototype.hasOwnProperty.call(req.body, 'isPrimary')) {
        updates.isPrimary = parseBoolean(req.body.isPrimary);
        if (updates.isPrimary) {
          await SupplierContact.update(
            { isPrimary: false },
            { where: { supplierId: supplier.id }, transaction }
          );
        }
      }

      await contact.update(updates, { transaction });
      await transaction.commit();
      await logActivity(req, 'UPDATE', 'SupplierContact', contact.id, {
        supplierId: supplier.id
      });
      res.json({ contact });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      next(error);
    }
  }
);

router.delete(
  '/:id/contacts/:contactId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const contact = await SupplierContact.findOne({
        where: { id: req.params.contactId, supplierId: supplier.id }
      });
      if (!contact) {
        return res.status(404).json({ message: 'Supplier contact not found.' });
      }
      await contact.destroy();
      await logActivity(req, 'DELETE', 'SupplierContact', contact.id, {
        supplierId: supplier.id
      });
      res.json({ message: 'Supplier contact removed.' });
    } catch (error) {
      next(error);
    }
  }
);

// Supplier legal documents and certifications linked to Document Library
router.post(
  '/:id/profile-documents',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;

      const type = String(req.body.type || '').toUpperCase();
      if (!['LEGAL', 'CERTIFICATION'].includes(type)) {
        return res.status(400).json({ message: 'Invalid supplier document type.' });
      }

      const document = await CompanyDocument.findOne({
        where: {
          id: req.body.documentId,
          companyId: req.companyId,
          isArchived: false
        }
      });
      if (!document) {
        return res.status(400).json({ message: 'Select a valid Document Library file.' });
      }

      const [link, created] = await SupplierProfileDocument.findOrCreate({
        where: {
          supplierId: supplier.id,
          documentId: document.id,
          type
        },
        defaults: {
          supplierId: supplier.id,
          documentId: document.id,
          type,
          remarks: String(req.body.remarks || '').trim() || null,
          sortOrder: Number(req.body.sortOrder || 0),
          isActive: true
        }
      });

      if (!created) {
        await link.update({
          remarks: String(req.body.remarks || '').trim() || link.remarks,
          sortOrder: Number(req.body.sortOrder || link.sortOrder || 0),
          isActive: true
        });
      }

      await logActivity(req, 'LINK_DOCUMENT', 'SupplierProfileDocument', link.id, {
        supplierId: supplier.id,
        documentId: document.id,
        type
      });

      res.status(created ? 201 : 200).json({
        link: {
          ...link.toJSON(),
          document: serializeDocument(document)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id/profile-documents/:linkId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const link = await SupplierProfileDocument.findOne({
        where: { id: req.params.linkId, supplierId: supplier.id }
      });
      if (!link) {
        return res.status(404).json({ message: 'Supplier profile document link not found.' });
      }
      await link.destroy();
      await logActivity(req, 'UNLINK_DOCUMENT', 'SupplierProfileDocument', link.id, {
        supplierId: supplier.id
      });
      res.json({ message: 'Supplier profile document unlinked.' });
    } catch (error) {
      next(error);
    }
  }
);

// Products
router.post(
  '/:id/products',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Product name is required.' });
      }

      const product = await SupplierProduct.create({
        supplierId: supplier.id,
        name,
        code: String(req.body.code || '').trim() || null,
        model: String(req.body.model || '').trim() || null,
        brand: String(req.body.brand || '').trim() || null,
        category: String(req.body.category || '').trim() || null,
        manufacturer: String(req.body.manufacturer || '').trim() || null,
        countryOfOrigin: String(req.body.countryOfOrigin || '').trim() || null,
        description: String(req.body.description || '').trim() || null,
        isActive: req.body.isActive !== false
      });

      await logActivity(req, 'CREATE', 'SupplierProduct', product.id, {
        supplierId: supplier.id,
        name: product.name
      });
      res.status(201).json({ product });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id/products/:productId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const product = await findProduct(req, res, supplier);
      if (!product) return;

      const updates = {};
      for (const key of [
        'name',
        'code',
        'model',
        'brand',
        'category',
        'manufacturer',
        'countryOfOrigin',
        'description',
        'isActive'
      ]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key] === '' ? null : req.body[key];
        }
      }

      await product.update(updates);
      await logActivity(req, 'UPDATE', 'SupplierProduct', product.id, {
        supplierId: supplier.id
      });
      res.json({ product });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id/products/:productId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const product = await findProduct(req, res, supplier);
      if (!product) return;
      await product.update({ isActive: false });
      await logActivity(req, 'DEACTIVATE', 'SupplierProduct', product.id, {
        supplierId: supplier.id
      });
      res.json({ message: 'Supplier product deactivated.' });
    } catch (error) {
      next(error);
    }
  }
);

// Product document mappings
router.post(
  '/:id/products/:productId/document-links',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const product = await findProduct(req, res, supplier);
      if (!product) return;

      const document = await CompanyDocument.findOne({
        where: {
          id: req.body.documentId,
          companyId: req.companyId,
          isArchived: false
        }
      });
      if (!document) {
        return res.status(400).json({ message: 'Select a valid Document Library file.' });
      }

      const masterItem = await MasterChecklistItem.findOne({
        where: {
          id: req.body.masterItemId,
          companyId: req.companyId,
          isActive: true
        }
      });
      if (!masterItem) {
        return res.status(400).json({ message: 'Select a valid Master Checklist item.' });
      }

      const [link, created] = await ProductDocumentLink.findOrCreate({
        where: {
          productId: product.id,
          documentId: document.id,
          masterItemId: masterItem.id
        },
        defaults: {
          productId: product.id,
          documentId: document.id,
          masterItemId: masterItem.id,
          priority: Number(req.body.priority || 1),
          remarks: String(req.body.remarks || '').trim() || null,
          isActive: true
        }
      });

      if (!created) {
        await link.update({
          priority: Number(req.body.priority || link.priority || 1),
          remarks: String(req.body.remarks || '').trim() || link.remarks,
          isActive: true
        });
      }

      await logActivity(req, 'MAP_PRODUCT_DOCUMENT', 'ProductDocumentLink', link.id, {
        supplierId: supplier.id,
        productId: product.id,
        documentId: document.id,
        masterItemId: masterItem.id
      });

      res.status(created ? 201 : 200).json({
        link: {
          ...link.toJSON(),
          document: serializeDocument(document),
          masterItem
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id/products/:productId/document-links/:linkId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res);
      if (!supplier) return;
      const product = await findProduct(req, res, supplier);
      if (!product) return;
      const link = await ProductDocumentLink.findOne({
        where: { id: req.params.linkId, productId: product.id }
      });
      if (!link) {
        return res.status(404).json({ message: 'Product document mapping not found.' });
      }
      await link.destroy();
      await logActivity(req, 'UNMAP_PRODUCT_DOCUMENT', 'ProductDocumentLink', link.id, {
        supplierId: supplier.id,
        productId: product.id
      });
      res.json({ message: 'Product document mapping removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id/products/:productId/matches',
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await findSupplier(req, res, { activeOnly: true });
      if (!supplier) return;
      const product = await findProduct(req, res, supplier, { activeOnly: true });
      if (!product) return;

      const checklist = await ChildChecklist.findOne({
        where: {
          id: req.query.childChecklistId,
          companyId: req.companyId,
          isActive: true
        },
        include: [
          {
            model: ChildChecklistItem,
            as: 'items',
            separate: true,
            order: [['sortOrder', 'ASC']]
          }
        ]
      });

      if (!checklist) {
        return res.status(404).json({ message: 'Saved Project Checklist not found.' });
      }

      const masterIds = checklist.items.map((item) => item.masterItemId).filter(Boolean);
      const links = masterIds.length
        ? await ProductDocumentLink.findAll({
            where: {
              productId: product.id,
              masterItemId: { [Op.in]: masterIds },
              isActive: true
            },
            include: [
              {
                model: CompanyDocument,
                as: 'document',
                required: true,
                where: { companyId: req.companyId, isArchived: false }
              }
            ],
            order: [['priority', 'ASC'], ['createdAt', 'ASC']]
          })
        : [];

      const grouped = new Map();
      for (const link of links) {
        const rows = grouped.get(link.masterItemId) || [];
        rows.push({
          linkId: link.id,
          priority: link.priority,
          document: serializeDocument(link.document)
        });
        grouped.set(link.masterItemId, rows);
      }

      const items = checklist.items.map((item) => ({
        id: item.id,
        masterItemId: item.masterItemId,
        titleSnapshot: item.titleSnapshot,
        matches: grouped.get(item.masterItemId) || []
      }));

      res.json({
        supplier: { id: supplier.id, name: supplier.name },
        product: { id: product.id, name: product.name, code: product.code },
        checklist: { id: checklist.id, name: checklist.name },
        items,
        matchedItemCount: items.filter((item) => item.matches.length > 0).length,
        totalItemCount: items.length
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
