const express = require('express');
const { Op } = require('sequelize');
const {
  sequelize,
  MasterChecklistItem,
  ChildChecklist,
  ChildChecklistItem,
  Project
} = require('../models');
const { authenticate, enforceCompany } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authenticate);

router.get('/master', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };
    if (req.query.active === 'true') where.isActive = true;
    const items = await MasterChecklistItem.findAll({ where, order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']] });
    res.json({ items });
  } catch (error) { next(error); }
});

router.post('/master', enforceCompany, async (req, res, next) => {
  try {
    const max = await MasterChecklistItem.max('sortOrder', { where: { companyId: req.companyId } });
    const item = await MasterChecklistItem.create({
      companyId: req.companyId,
      title: req.body.title,
      defaultStatus: req.body.defaultStatus || 'YES',
      defaultRemark: req.body.defaultRemark || '',
      sortOrder: Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : (Number(max) || 0) + 1,
      isActive: req.body.isActive !== false
    });
    await logActivity(req, 'CREATE', 'MasterChecklistItem', item.id, { title: item.title });
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

router.put('/master/:id', enforceCompany, async (req, res, next) => {
  try {
    const item = await MasterChecklistItem.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!item) return res.status(404).json({ message: 'Checklist item not found.' });
    const updates = {};
    ['title', 'defaultStatus', 'defaultRemark', 'sortOrder', 'isActive'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    });
    await item.update(updates);
    await logActivity(req, 'UPDATE', 'MasterChecklistItem', item.id, { title: item.title });
    res.json({ item });
  } catch (error) { next(error); }
});

router.post('/master/reorder', enforceCompany, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    for (let index = 0; index < ids.length; index += 1) {
      await MasterChecklistItem.update({ sortOrder: index + 1 }, { where: { id: ids[index], companyId: req.companyId }, transaction });
    }
    await transaction.commit();
    await logActivity(req, 'REORDER', 'MasterChecklistItem', null, { count: ids.length });
    res.json({ message: 'Checklist order updated.' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.delete('/master/:id', enforceCompany, async (req, res, next) => {
  try {
    const item = await MasterChecklistItem.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!item) return res.status(404).json({ message: 'Checklist item not found.' });
    await item.update({ isActive: false });
    await logActivity(req, 'DEACTIVATE', 'MasterChecklistItem', item.id, { title: item.title });
    res.json({ message: 'Item deactivated. Existing checklists remain unchanged.', item });
  } catch (error) { next(error); }
});

router.get('/project', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };
    if (req.query.projectId) where.projectId = req.query.projectId;
    const checklists = await ChildChecklist.findAll({
      where,
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name', 'number'] },
        { model: ChildChecklistItem, as: 'items', separate: true, order: [['sortOrder', 'ASC']] }
      ],
      order: [['updatedAt', 'DESC']]
    });
    res.json({ checklists });
  } catch (error) { next(error); }
});

router.post('/project', enforceCompany, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const project = await Project.findOne({ where: { id: req.body.projectId, companyId: req.companyId }, transaction });
    if (!project) { await transaction.rollback(); return res.status(404).json({ message: 'Project not found.' }); }
    const masterIds = Array.isArray(req.body.masterItemIds) ? req.body.masterItemIds : [];
    if (!masterIds.length) { await transaction.rollback(); return res.status(400).json({ message: 'Select at least one Master Checklist item.' }); }
    const masterItems = await MasterChecklistItem.findAll({ where: { id: { [Op.in]: masterIds }, companyId: req.companyId, isActive: true }, transaction });
    const masterById = Object.fromEntries(masterItems.map((item) => [item.id, item]));
    const orderedMasterItems = masterIds.map((id) => masterById[id]).filter(Boolean);
    if (orderedMasterItems.length !== masterIds.length) { await transaction.rollback(); return res.status(400).json({ message: 'One or more selected Master Checklist items are inactive or invalid.' }); }
    const checklist = await ChildChecklist.create({ companyId: req.companyId, projectId: project.id, name: req.body.name, description: req.body.description || '' }, { transaction });
    const customById = Object.fromEntries((req.body.items || []).map((item) => [item.masterItemId, item]));
    await ChildChecklistItem.bulkCreate(orderedMasterItems.map((master, index) => ({
      childChecklistId: checklist.id,
      masterItemId: master.id,
      titleSnapshot: customById[master.id]?.titleSnapshot || master.title,
      status: customById[master.id]?.status || master.defaultStatus,
      remarks: customById[master.id]?.remarks ?? master.defaultRemark,
      sortOrder: index + 1
    })), { transaction });
    await transaction.commit();
    req.companyId = checklist.companyId;
    await logActivity(req, 'CREATE', 'ChildChecklist', checklist.id, { name: checklist.name, projectId: project.id });
    const result = await ChildChecklist.findByPk(checklist.id, { include: [{ model: ChildChecklistItem, as: 'items', separate: true, order: [['sortOrder', 'ASC']] }, { model: Project, as: 'project' }] });
    res.status(201).json({ checklist: result });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.put('/project/:id', enforceCompany, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const checklist = await ChildChecklist.findOne({ where: { id: req.params.id, companyId: req.companyId }, transaction });
    if (!checklist) { await transaction.rollback(); return res.status(404).json({ message: 'Project checklist not found.' }); }
    await checklist.update({ name: req.body.name ?? checklist.name, description: req.body.description ?? checklist.description, isActive: req.body.isActive ?? checklist.isActive }, { transaction });
    if (Array.isArray(req.body.items)) {
      const masterIds = [...new Set(req.body.items.map((item) => item.masterItemId).filter(Boolean))];
      if (masterIds.length) {
        const validCount = await MasterChecklistItem.count({ where: { id: { [Op.in]: masterIds }, companyId: req.companyId }, transaction });
        if (validCount !== masterIds.length) { await transaction.rollback(); return res.status(400).json({ message: 'One or more checklist items do not belong to this company.' }); }
      }
      await ChildChecklistItem.destroy({ where: { childChecklistId: checklist.id }, transaction });
      await ChildChecklistItem.bulkCreate(req.body.items.map((item, index) => ({
        childChecklistId: checklist.id,
        masterItemId: item.masterItemId || null,
        titleSnapshot: item.titleSnapshot,
        status: item.status || '',
        remarks: item.remarks || '',
        sortOrder: item.sortOrder || index + 1
      })), { transaction });
    }
    await transaction.commit();
    await logActivity(req, 'UPDATE', 'ChildChecklist', checklist.id, { name: checklist.name });
    const result = await ChildChecklist.findByPk(checklist.id, { include: [{ model: ChildChecklistItem, as: 'items', separate: true, order: [['sortOrder', 'ASC']] }, { model: Project, as: 'project' }] });
    res.json({ checklist: result });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.delete('/project/:id', enforceCompany, async (req, res, next) => {
  try {
    const checklist = await ChildChecklist.findOne({ where: { id: req.params.id, companyId: req.companyId } });
    if (!checklist) return res.status(404).json({ message: 'Project checklist not found.' });
    await checklist.update({ isActive: false });
    await logActivity(req, 'DEACTIVATE', 'ChildChecklist', checklist.id, { name: checklist.name });
    res.json({ message: 'Project checklist deactivated.' });
  } catch (error) { next(error); }
});

module.exports = router;
