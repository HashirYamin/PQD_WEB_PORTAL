const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  Company,
  Project,
  ChildChecklist,
  ChildChecklistItem,
  CompanyDocument,
  Supplier,
  SupplierDocumentLink,
  PqdSubmission,
  PqdSubmissionItem,
  GeneratedPdf,
  User
} = require('../models');
const { authenticate, enforceCompany } = require('../middleware/auth');
const { getDocumentStatus } = require('../utils/docStatus');
const { generatePqdPdf, makeGeneratedPath } = require('../services/pdfService');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authenticate);

const submissionInclude = [
  { model: Project, as: 'project' },
  { model: ChildChecklist, as: 'childChecklist' },
  { model: Supplier, as: 'supplier' },
  {
    model: PqdSubmissionItem,
    as: 'items',
    separate: true,
    order: [['sortOrder', 'ASC']],
    include: [{ model: CompanyDocument, as: 'document' }]
  },
  {
    model: GeneratedPdf,
    as: 'generatedPdfs',
    separate: true,
    order: [['version', 'DESC']]
  },
  {
    model: User,
    as: 'createdBy',
    attributes: ['id', 'name', 'email']
  }
];

const getSubmission = (id, companyId) =>
  PqdSubmission.findOne({
    where: { id, companyId },
    include: submissionInclude
  });

const validateSubmission = (submission) => {
  const missing = [];
  const expired = [];
  const expiringSoon = [];

  for (const item of submission.items || []) {
    if (!item.includeInPdf) continue;

    if (!item.document) {
      missing.push({
        itemId: item.id,
        title: item.titleSnapshot
      });
      continue;
    }

    const status = getDocumentStatus(
      item.document.expiryDate,
      item.document.expiryNotApplicable
    );

    if (status.key === 'EXPIRED') {
      expired.push({
        itemId: item.id,
        title: item.titleSnapshot,
        document: item.document.title,
        expiryDate: item.document.expiryDate,
        daysRemaining: status.daysRemaining
      });
    }

    if (status.key === 'EXPIRING_SOON') {
      expiringSoon.push({
        itemId: item.id,
        title: item.titleSnapshot,
        document: item.document.title,
        expiryDate: item.document.expiryDate,
        daysRemaining: status.daysRemaining
      });
    }
  }

  return {
    missing,
    expired,
    expiringSoon,
    canGenerate: missing.length === 0 && expired.length === 0
  };
};

const buildAutoDocumentMap = async ({
  supplierId,
  checklistItems,
  companyId,
  transaction
}) => {
  const masterIds = checklistItems
    .map((item) => item.masterItemId)
    .filter(Boolean);

  if (!masterIds.length) return new Map();

  const links = await SupplierDocumentLink.findAll({
    where: {
      supplierId,
      masterItemId: { [Op.in]: masterIds }
    },
    include: [
      {
        model: CompanyDocument,
        as: 'document',
        required: true,
        where: {
          companyId,
          isArchived: false
        }
      }
    ],
    order: [['priority', 'ASC'], ['createdAt', 'DESC']],
    transaction
  });

  const byMasterItem = new Map();

  for (const link of links) {
    if (!byMasterItem.has(link.masterItemId)) {
      byMasterItem.set(link.masterItemId, link.documentId);
    }
  }

  return byMasterItem;
};

router.get('/', enforceCompany, async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.projectId) where.projectId = req.query.projectId;

    const submissions = await PqdSubmission.findAll({
      where,
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name', 'number']
        },
        {
          model: ChildChecklist,
          as: 'childChecklist',
          attributes: ['id', 'name']
        },
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'code']
        },
        {
          model: GeneratedPdf,
          as: 'generatedPdfs',
          separate: true,
          order: [['version', 'DESC']]
        }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.json({ submissions });
  } catch (error) {
    next(error);
  }
});

router.post('/', enforceCompany, async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const project = await Project.findOne({
      where: {
        id: req.body.projectId,
        companyId: req.companyId
      },
      transaction
    });

    if (!project) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Project not found.' });
    }

    const checklist = await ChildChecklist.findOne({
      where: {
        id: req.body.childChecklistId,
        projectId: project.id,
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
      ],
      transaction
    });

    if (!checklist) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Project Checklist not found.'
      });
    }

    const supplier = await Supplier.findOne({
      where: {
        id: req.body.supplierId,
        companyId: req.companyId,
        isActive: true
      },
      transaction
    });

    if (!supplier) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Select an active supplier profile.'
      });
    }

    const autoDocumentMap = await buildAutoDocumentMap({
      supplierId: supplier.id,
      checklistItems: checklist.items,
      companyId: req.companyId,
      transaction
    });

    const submission = await PqdSubmission.create(
      {
        companyId: req.companyId,
        projectId: project.id,
        childChecklistId: checklist.id,
        supplierId: supplier.id,
        createdById: req.user.id,
        title:
          req.body.title ||
          `${project.name} - ${checklist.name} - ${supplier.name}`,
        revision: req.body.revision || project.revision || '0',
        status: 'DRAFT'
      },
      { transaction }
    );

    const rows = checklist.items.map((item, index) => ({
      submissionId: submission.id,
      childChecklistItemId: item.id,
      titleSnapshot: item.titleSnapshot,
      status: item.status || '',
      remarks: item.remarks || '',
      includeInPdf: true,
      sortOrder: index + 1,
      documentId: autoDocumentMap.get(item.masterItemId) || null
    }));

    await PqdSubmissionItem.bulkCreate(rows, { transaction });
    await transaction.commit();

    const autoMatchedCount = rows.filter((row) => row.documentId).length;

    await logActivity(req, 'CREATE', 'PqdSubmission', submission.id, {
      projectId: project.id,
      checklistId: checklist.id,
      supplierId: supplier.id,
      autoMatchedCount
    });

    res.status(201).json({
      submission: await getSubmission(submission.id, req.companyId),
      autoMatchedCount,
      totalItemCount: rows.length
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.get('/:id', enforceCompany, async (req, res, next) => {
  try {
    const submission = await getSubmission(req.params.id, req.companyId);

    if (!submission) {
      return res.status(404).json({
        message: 'PQD submission not found.'
      });
    }

    res.json({
      submission,
      validation: validateSubmission(submission)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', enforceCompany, async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const submission = await PqdSubmission.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId
      },
      transaction
    });

    if (!submission) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'PQD submission not found.'
      });
    }

    await submission.update(
      {
        title: req.body.title ?? submission.title,
        revision: req.body.revision ?? submission.revision,
        status: req.body.status ?? submission.status
      },
      { transaction }
    );

    if (Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        const record = await PqdSubmissionItem.findOne({
          where: {
            id: item.id,
            submissionId: submission.id
          },
          transaction
        });

        if (!record) continue;

        if (item.documentId) {
          const document = await CompanyDocument.findOne({
            where: {
              id: item.documentId,
              companyId: req.companyId,
              isArchived: false
            },
            transaction
          });

          if (!document) {
            await transaction.rollback();
            return res.status(400).json({
              message: 'One selected document is invalid.'
            });
          }
        }

        await record.update(
          {
            titleSnapshot: item.titleSnapshot ?? record.titleSnapshot,
            status: item.status ?? record.status,
            remarks: item.remarks ?? record.remarks,
            includeInPdf: item.includeInPdf ?? record.includeInPdf,
            sortOrder: item.sortOrder ?? record.sortOrder,
            documentId: item.documentId || null
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    await logActivity(req, 'UPDATE', 'PqdSubmission', submission.id, {
      title: submission.title
    });

    const refreshed = await getSubmission(submission.id, req.companyId);

    res.json({
      submission: refreshed,
      validation: validateSubmission(refreshed)
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.get('/:id/validate', enforceCompany, async (req, res, next) => {
  try {
    const submission = await getSubmission(req.params.id, req.companyId);

    if (!submission) {
      return res.status(404).json({
        message: 'PQD submission not found.'
      });
    }

    res.json({ validation: validateSubmission(submission) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/generate', enforceCompany, async (req, res, next) => {
  try {
    const submission = await getSubmission(req.params.id, req.companyId);

    if (!submission) {
      return res.status(404).json({
        message: 'PQD submission not found.'
      });
    }

    const validation = validateSubmission(submission);
    const allowMissing = req.body.allowMissing === true;
    const allowExpired = req.body.allowExpired === true;

    if (
      (validation.missing.length && !allowMissing) ||
      (validation.expired.length && !allowExpired)
    ) {
      return res.status(409).json({
        message: 'Submission has missing or expired documents.',
        validation
      });
    }

    const company = await Company.findByPk(req.companyId);
    const includedItems = (submission.items || []).filter(
      (item) => item.includeInPdf
    );
    const nextVersion = submission.currentVersion + 1;
    const outputPath = makeGeneratedPath(
      req.companyId,
      submission.id,
      nextVersion
    );

    const projectData = {
      ...submission.project.toJSON(),
      supplier:
        submission.supplier?.name || submission.project.supplier
    };

    const result = await generatePqdPdf({
      company: company.toJSON(),
      project: projectData,
      submission: submission.toJSON(),
      items: includedItems.map((item) => item.toJSON()),
      outputPath
    });

    const generated = await GeneratedPdf.create({
      submissionId: submission.id,
      generatedById: req.user.id,
      version: nextVersion,
      filePath: outputPath,
      fileName: path.basename(outputPath),
      sizeBytes: result.sizeBytes
    });

    await submission.update({
      status: 'GENERATED',
      currentVersion: nextVersion
    });

    await logActivity(req, 'GENERATE_PDF', 'PqdSubmission', submission.id, {
      version: nextVersion,
      pageCount: result.pageCount,
      supplierId: submission.supplierId
    });

    res.json({
      generatedPdf: generated,
      validation,
      pageCount: result.pageCount
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/:id/versions/:versionId/download',
  enforceCompany,
  async (req, res, next) => {
    try {
      const submission = await PqdSubmission.findOne({
        where: {
          id: req.params.id,
          companyId: req.companyId
        }
      });

      if (!submission) {
        return res.status(404).json({
          message: 'PQD submission not found.'
        });
      }

      const generated = await GeneratedPdf.findOne({
        where: {
          id: req.params.versionId,
          submissionId: submission.id
        }
      });

      if (!generated || !fs.existsSync(generated.filePath)) {
        return res.status(404).json({
          message: 'Generated PDF file not found.'
        });
      }

      res.download(generated.filePath, generated.fileName);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', enforceCompany, async (req, res, next) => {
  try {
    const submission = await PqdSubmission.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId
      }
    });

    if (!submission) {
      return res.status(404).json({
        message: 'PQD submission not found.'
      });
    }

    await submission.destroy();
    await logActivity(req, 'DELETE', 'PqdSubmission', req.params.id);

    res.json({ message: 'PQD submission deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
