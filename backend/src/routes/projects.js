const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  Project,
  ProjectContact,
  ChildChecklist,
  PqdSubmission
} = require('../models');
const { authenticate, enforceCompany } = require('../middleware/auth');
const { createUploader } = require('../utils/upload');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authenticate);

const logoUpload = createUploader('project-logos', {
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/avif',
    'image/svg+xml'
  ],
  maxBytes: 5 * 1024 * 1024
}).single('logo');

const PARTY_FIELDS = {
  client: 'clientLogoPath',
  consultant: 'consultantLogoPath',
  contractor: 'contractorLogoPath'
};

const normalizeUploadedLogo = async (file) => {
  if (['image/png', 'image/jpeg'].includes(file.mimetype)) return file.path;
  const sharp = require('sharp');
  const parsed = path.parse(file.path);
  const convertedPath = path.join(parsed.dir, `${parsed.name}.png`);
  await sharp(file.path).png().toFile(convertedPath);
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  return convertedPath;
};

const projectInclude = [
  { model: ChildChecklist, as: 'childChecklists', attributes: ['id', 'name', 'isActive'] },
  { model: PqdSubmission, as: 'submissions', attributes: ['id', 'status', 'currentVersion'] },
  { model: ProjectContact, as: 'contacts', separate: true, order: [['isPrimary', 'DESC'], ['sortOrder', 'ASC'], ['createdAt', 'ASC']] }
];

const findProject = (id, companyId, options = {}) => Project.findOne({
  where: { id, companyId },
  ...options
});

router.get('/', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };
    if (req.query.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.search}%` } },
        { number: { [Op.like]: `%${req.query.search}%` } },
        { contractCode: { [Op.like]: `%${req.query.search}%` } },
        { client: { [Op.like]: `%${req.query.search}%` } }
      ];
    }

    const projects = await Project.findAll({
      where,
      order: [['updatedAt', 'DESC']],
      include: projectInclude
    });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

router.post('/', enforceCompany, async (req, res, next) => {
  try {
    if (req.body.startDate && req.body.endDate && req.body.endDate < req.body.startDate) {
      return res.status(400).json({ message: 'Project end date cannot be before the start date.' });
    }

    const project = await Project.create({
      name: req.body.name,
      number: req.body.number || null,
      contractCode: req.body.contractCode || null,
      client: req.body.client || null,
      consultant: req.body.consultant || null,
      contractor: req.body.contractor || null,
      supplier: req.body.supplier || null,
      productSystem: req.body.productSystem || null,
      revision: req.body.revision || '0',
      projectDate: req.body.projectDate || null,
      startDate: req.body.startDate || null,
      endDate: req.body.endDate || null,
      submittalNumber: req.body.submittalNumber || null,
      discipline: req.body.discipline || null,
      status: req.body.status || 'ACTIVE',
      companyId: req.companyId
    });

    await logActivity(req, 'CREATE', 'Project', project.id, { name: project.name });
    const result = await Project.findByPk(project.id, { include: projectInclude });
    res.status(201).json({ project: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', enforceCompany, async (req, res, next) => {
  try {
    const project = await findProject(req.params.id, req.companyId);
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const updates = {};
    [
      'name', 'number', 'contractCode', 'client', 'consultant', 'contractor',
      'supplier', 'productSystem', 'revision', 'projectDate', 'startDate',
      'endDate', 'submittalNumber', 'discipline', 'status'
    ].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key] === '' ? null : req.body[key];
      }
    });

    if (updates.startDate && updates.endDate && updates.endDate < updates.startDate) {
      return res.status(400).json({ message: 'Project end date cannot be before the start date.' });
    }

    await project.update(updates);
    await logActivity(req, 'UPDATE', 'Project', project.id, { name: project.name });
    const result = await Project.findByPk(project.id, { include: projectInclude });
    res.json({ project: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/contacts', enforceCompany, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const project = await findProject(req.params.id, req.companyId, { transaction });
    if (!project) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Project not found.' });
    }

    const contacts = Array.isArray(req.body.contacts) ? req.body.contacts : [];
    const cleaned = contacts
      .map((contact, index) => ({
        name: String(contact.name || '').trim(),
        organization: String(contact.organization || '').trim() || null,
        role: String(contact.role || '').trim() || null,
        jobTitle: String(contact.jobTitle || '').trim() || null,
        email: String(contact.email || '').trim().toLowerCase() || null,
        phone: String(contact.phone || '').trim() || null,
        mobile: String(contact.mobile || '').trim() || null,
        isPrimary: Boolean(contact.isPrimary),
        sortOrder: index + 1
      }))
      .filter((contact) => contact.name);

    let primaryFound = false;
    cleaned.forEach((contact) => {
      if (contact.isPrimary && !primaryFound) primaryFound = true;
      else if (contact.isPrimary) contact.isPrimary = false;
    });
    if (cleaned.length && !primaryFound) cleaned[0].isPrimary = true;

    await ProjectContact.destroy({ where: { projectId: project.id }, transaction });
    if (cleaned.length) {
      await ProjectContact.bulkCreate(
        cleaned.map((contact) => ({ ...contact, projectId: project.id })),
        { transaction }
      );
    }

    await transaction.commit();
    await logActivity(req, 'UPDATE_CONTACTS', 'Project', project.id, { count: cleaned.length });
    const result = await Project.findByPk(project.id, { include: projectInclude });
    res.json({ project: result });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.post('/:id/logo/:party', enforceCompany, async (req, res, next) => {
  const field = PARTY_FIELDS[String(req.params.party || '').toLowerCase()];
  if (!field) return res.status(400).json({ message: 'Logo party must be client, consultant or contractor.' });

  logoUpload(req, res, async (error) => {
    let finalLogoPath = null;
    try {
      if (error) throw error;
      if (!req.file) return res.status(400).json({ message: 'Logo file is required.' });

      const project = await findProject(req.params.id, req.companyId);
      if (!project) return res.status(404).json({ message: 'Project not found.' });

      finalLogoPath = await normalizeUploadedLogo(req.file);
      const oldPath = project[field];
      await project.update({ [field]: finalLogoPath });
      if (oldPath && oldPath !== finalLogoPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      await logActivity(req, 'UPLOAD_PROJECT_LOGO', 'Project', project.id, { party: req.params.party });
      res.json({ project });
    } catch (err) {
      [req.file?.path, finalLogoPath].filter(Boolean).forEach((filePath) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
      next(err);
    }
  });
});

router.get('/:id/logo/:party', enforceCompany, async (req, res, next) => {
  try {
    const field = PARTY_FIELDS[String(req.params.party || '').toLowerCase()];
    if (!field) return res.status(400).json({ message: 'Logo party must be client, consultant or contractor.' });

    const project = await findProject(req.params.id, req.companyId);
    const logoPath = project?.[field];
    if (!project || !logoPath || !fs.existsSync(logoPath)) {
      return res.status(404).json({ message: 'Project logo not found.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(path.resolve(logoPath));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', enforceCompany, async (req, res, next) => {
  try {
    const project = await findProject(req.params.id, req.companyId);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    await project.update({ status: 'ARCHIVED' });
    await logActivity(req, 'ARCHIVE', 'Project', project.id, { name: project.name });
    res.json({ message: 'Project archived.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
