const express = require('express');
const { Op } = require('sequelize');
const {
  Supplier,
  SupplierContact,
  SupplierDocumentLink,
  CompanyDocument,
  MasterChecklistItem,
  ChildChecklist,
  ChildChecklistItem
} = require('../models');
const { authenticate, authorize, enforceCompany } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const { getDocumentStatus } = require('../utils/docStatus');

const router = express.Router();
router.use(authenticate);

const serializeDocument = (document) => ({
  ...document.toJSON(),
  statusInfo: getDocumentStatus(
    document.expiryDate,
    document.expiryNotApplicable
  )
});

const getSupplier = async (id, companyId) =>
  Supplier.findOne({
    where: { id, companyId },
    include: [
      {
        model: SupplierContact,
        as: 'contacts',
        separate: true,
        order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']]
      },
      {
        model: SupplierDocumentLink,
        as: 'documentLinks',
        separate: true,
        order: [['priority', 'ASC'], ['createdAt', 'DESC']],
        include: [
          { model: CompanyDocument, as: 'document' },
          {
            model: MasterChecklistItem,
            as: 'masterItem',
            attributes: ['id', 'title', 'sortOrder', 'isActive']
          }
        ]
      }
    ]
  });

router.get('/', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };

    if (req.query.active === 'true') where.isActive = true;

    if (req.query.search) {
      const search = `%${req.query.search}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: search } },
        { code: { [Op.iLike]: search } },
        { email: { [Op.iLike]: search } },
        { phone: { [Op.iLike]: search } }
      ];
    }

    const suppliers = await Supplier.findAll({
      where,
      include: [
        { model: SupplierContact, as: 'contacts', attributes: ['id'] },
        { model: SupplierDocumentLink, as: 'documentLinks', attributes: ['id'] }
      ],
      order: [['isActive', 'DESC'], ['name', 'ASC']]
    });

    res.json({
      suppliers: suppliers.map((supplier) => ({
        ...supplier.toJSON(),
        contactCount: supplier.contacts?.length || 0,
        documentCount: supplier.documentLinks?.length || 0
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
        registrationNumber: String(req.body.registrationNumber || '').trim() || null,
        email: String(req.body.email || '').trim().toLowerCase() || null,
        phone: String(req.body.phone || '').trim() || null,
        website: String(req.body.website || '').trim() || null,
        address: String(req.body.address || '').trim() || null,
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

router.get('/:id/matches', enforceCompany, async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId,
        isActive: true
      }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found.' });
    }

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
      return res.status(404).json({ message: 'Project Checklist not found.' });
    }

    const masterIds = checklist.items
      .map((item) => item.masterItemId)
      .filter(Boolean);

    const links = masterIds.length
      ? await SupplierDocumentLink.findAll({
          where: {
            supplierId: supplier.id,
            masterItemId: { [Op.in]: masterIds }
          },
          include: [
            {
              model: CompanyDocument,
              as: 'document',
              required: true,
              where: {
                companyId: req.companyId,
                isArchived: false
              }
            }
          ],
          order: [['priority', 'ASC'], ['createdAt', 'DESC']]
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
      checklist: { id: checklist.id, name: checklist.name },
      items,
      matchedItemCount: items.filter((item) => item.matches.length > 0).length,
      totalItemCount: items.length
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', enforceCompany, async (req, res, next) => {
  try {
    const supplier = await getSupplier(req.params.id, req.companyId);

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found.' });
    }

    const json = supplier.toJSON();
    json.documentLinks = (json.documentLinks || []).map((link) => ({
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

    res.json({ supplier: json });
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
      const supplier = await Supplier.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found.' });
      }

      const updates = {};
      const allowed = [
        'name',
        'code',
        'registrationNumber',
        'email',
        'phone',
        'website',
        'address',
        'description',
        'isActive'
      ];

      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key] === '' ? null : req.body[key];
        }
      }

      if (updates.email) updates.email = String(updates.email).toLowerCase();

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
      const supplier = await Supplier.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found.' });
      }

      await supplier.update({ isActive: false });
      await logActivity(req, 'DEACTIVATE', 'Supplier', supplier.id, {
        name: supplier.name
      });

      res.json({ message: 'Supplier profile deactivated.' });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/contacts',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await Supplier.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found.' });
      }

      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Contact name is required.' });
      }

      const count = await SupplierContact.count({
        where: { supplierId: supplier.id }
      });

      const isPrimary = req.body.isPrimary === true || count === 0;

      if (isPrimary) {
        await SupplierContact.update(
          { isPrimary: false },
          { where: { supplierId: supplier.id } }
        );
      }

      const contact = await SupplierContact.create({
        supplierId: supplier.id,
        name,
        jobTitle: String(req.body.jobTitle || '').trim() || null,
        email: String(req.body.email || '').trim().toLowerCase() || null,
        phone: String(req.body.phone || '').trim() || null,
        isPrimary
      });

      await logActivity(req, 'CREATE', 'SupplierContact', contact.id, {
        supplierId: supplier.id,
        name: contact.name
      });

      res.status(201).json({ contact });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id/contacts/:contactId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await Supplier.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found.' });
      }

      const contact = await SupplierContact.findOne({
        where: {
          id: req.params.contactId,
          supplierId: supplier.id
        }
      });

      if (!contact) {
        return res.status(404).json({ message: 'Supplier contact not found.' });
      }

      const updates = {};
      for (const key of ['name', 'jobTitle', 'email', 'phone', 'isPrimary']) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key] === '' ? null : req.body[key];
        }
      }

      if (updates.email) updates.email = String(updates.email).toLowerCase();

      if (updates.isPrimary === true) {
        await SupplierContact.update(
          { isPrimary: false },
          { where: { supplierId: supplier.id } }
        );
      }

      await contact.update(updates);
      await logActivity(req, 'UPDATE', 'SupplierContact', contact.id, {
        supplierId: supplier.id
      });

      res.json({ contact });
    } catch (error) {
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
      const supplier = await Supplier.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found.' });
      }

      const contact = await SupplierContact.findOne({
        where: {
          id: req.params.contactId,
          supplierId: supplier.id
        }
      });

      if (!contact) {
        return res.status(404).json({ message: 'Supplier contact not found.' });
      }

      await contact.destroy();
      await logActivity(req, 'DELETE', 'SupplierContact', req.params.contactId, {
        supplierId: supplier.id
      });

      res.json({ message: 'Supplier contact removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/document-links',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await Supplier.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found.' });
      }

      const document = await CompanyDocument.findOne({
        where: {
          id: req.body.documentId,
          companyId: req.companyId,
          isArchived: false
        }
      });

      if (!document) {
        return res.status(400).json({
          message: 'Select a valid company document.'
        });
      }

      const masterItem = await MasterChecklistItem.findOne({
        where: {
          id: req.body.masterItemId,
          companyId: req.companyId,
          isActive: true
        }
      });

      if (!masterItem) {
        return res.status(400).json({
          message: 'Select a valid active Master Checklist item.'
        });
      }

      const existing = await SupplierDocumentLink.findOne({
        where: {
          supplierId: supplier.id,
          documentId: document.id,
          masterItemId: masterItem.id
        }
      });

      if (existing) {
        return res.status(409).json({
          message:
            'This document is already mapped to that checklist item for this supplier.'
        });
      }

      const link = await SupplierDocumentLink.create({
        supplierId: supplier.id,
        documentId: document.id,
        masterItemId: masterItem.id,
        priority: Number(req.body.priority || 1),
        remarks: String(req.body.remarks || '').trim() || null
      });

      await logActivity(req, 'CREATE', 'SupplierDocumentLink', link.id, {
        supplierId: supplier.id,
        documentId: document.id,
        masterItemId: masterItem.id
      });

      const result = await SupplierDocumentLink.findByPk(link.id, {
        include: [
          { model: CompanyDocument, as: 'document' },
          { model: MasterChecklistItem, as: 'masterItem' }
        ]
      });

      res.status(201).json({ link: result });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id/document-links/:linkId',
  authorize('SUPER_ADMIN', 'COMPANY_ADMIN'),
  enforceCompany,
  async (req, res, next) => {
    try {
      const supplier = await Supplier.findOne({
        where: { id: req.params.id, companyId: req.companyId }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found.' });
      }

      const link = await SupplierDocumentLink.findOne({
        where: {
          id: req.params.linkId,
          supplierId: supplier.id
        }
      });

      if (!link) {
        return res.status(404).json({
          message: 'Supplier document mapping not found.'
        });
      }

      await link.destroy();
      await logActivity(req, 'DELETE', 'SupplierDocumentLink', req.params.linkId, {
        supplierId: supplier.id
      });

      res.json({ message: 'Supplier document mapping removed.' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
