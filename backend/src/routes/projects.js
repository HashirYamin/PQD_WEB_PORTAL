const express = require('express');
const { Op } = require('sequelize');
const { Project, ChildChecklist, PqdSubmission } = require('../models');
const { authenticate, enforceCompany } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authenticate);

router.get('/', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };
    if (req.query.search) where[Op.or] = [
      { name: { [Op.like]: `%${req.query.search}%` } },
      { number: { [Op.like]: `%${req.query.search}%` } },
      { client: { [Op.like]: `%${req.query.search}%` } }
    ];
    const projects = await Project.findAll({
      where,
      order: [['updatedAt', 'DESC']],
      include: [
        { model: ChildChecklist, as: 'childChecklists', attributes: ['id', 'name', 'isActive'] },
        { model: PqdSubmission, as: 'submissions', attributes: ['id', 'status', 'currentVersion'] }
      ]
    });
    res.json({ projects });
  } catch (error) { next(error); }
});

router.post('/', enforceCompany, async (req, res, next) => {
  try {
    const project = await Project.create({ ...req.body, companyId: req.companyId });
    await logActivity(req, 'CREATE', 'Project', project.id, { name: project.name });
    res.status(201).json({ project });
  } catch (error) { next(error); }
});

router.put('/:id', enforceCompany, async (req, res, next) => {
  try {
    const project = await Project.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const updates = {};
    ['name', 'number', 'client', 'consultant', 'contractor', 'supplier', 'productSystem', 'revision', 'projectDate', 'submittalNumber', 'discipline', 'status'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    });
    await project.update(updates);
    await logActivity(req, 'UPDATE', 'Project', project.id, { name: project.name });
    res.json({ project });
  } catch (error) { next(error); }
});

router.delete('/:id', enforceCompany, async (req, res, next) => {
  try {
    const project = await Project.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    await project.update({ status: 'ARCHIVED' });
    await logActivity(req, 'ARCHIVE', 'Project', project.id, { name: project.name });
    res.json({ message: 'Project archived.' });
  } catch (error) { next(error); }
});

module.exports = router;
