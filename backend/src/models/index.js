const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const base = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  }
};

const Company = sequelize.define('Company', {
  ...base,
  name: { type: DataTypes.STRING, allowNull: false },
  crNumber: DataTypes.STRING,
  address: DataTypes.TEXT,
  contactPerson: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  logoPath: DataTypes.STRING,
  stampPath: DataTypes.STRING,
  settings: { type: DataTypes.JSON, defaultValue: {} },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const User = sequelize.define('User', {
  ...base,
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'STAFF',
    validate: { isIn: [['SUPER_ADMIN', 'COMPANY_ADMIN', 'STAFF']] }
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const CompanyDocument = sequelize.define('CompanyDocument', {
  ...base,
  title: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Other' },
  issueDate: DataTypes.DATEONLY,
  expiryDate: DataTypes.DATEONLY,
  documentType: DataTypes.STRING,
  remarks: DataTypes.TEXT,
  filePath: { type: DataTypes.STRING, allowNull: false },
  originalName: { type: DataTypes.STRING, allowNull: false },
  mimeType: DataTypes.STRING,
  sizeBytes: DataTypes.INTEGER,
  isArchived: { type: DataTypes.BOOLEAN, defaultValue: false }
});
const CompanyAddress = sequelize.define('CompanyAddress', {
  ...base,
  label: {
    type: DataTypes.STRING,
    defaultValue: 'Main Office'
  },
  addressLine1: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  addressLine2: DataTypes.TEXT,
  city: DataTypes.STRING,
  state: DataTypes.STRING,
  postalCode: DataTypes.STRING,
  country: DataTypes.STRING,
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

const CompanySocialLink = sequelize.define('CompanySocialLink', {
  ...base,
  platform: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

const CompanyContact = sequelize.define('CompanyContact', {
  ...base,
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jobTitle: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

const CompanyProfileDocument = sequelize.define(
  'CompanyProfileDocument',
  {
    ...base,
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['LEGAL', 'CERTIFICATION']]
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    documentNumber: DataTypes.STRING,
    issueDate: DataTypes.DATEONLY,
    expiryDate: DataTypes.DATEONLY,
    authority: DataTypes.STRING,
    remarks: DataTypes.TEXT,
    filePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mimeType: DataTypes.STRING,
    sizeBytes: DataTypes.INTEGER,
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }
);
const MasterChecklistItem = sequelize.define('MasterChecklistItem', {
  ...base,
  title: { type: DataTypes.TEXT, allowNull: false },
  defaultStatus: { type: DataTypes.STRING, defaultValue: 'YES' },
  defaultRemark: DataTypes.TEXT,
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const Project = sequelize.define('Project', {
  ...base,
  name: { type: DataTypes.STRING, allowNull: false },
  number: DataTypes.STRING,
  client: DataTypes.STRING,
  consultant: DataTypes.STRING,
  contractor: DataTypes.STRING,
  supplier: DataTypes.STRING,
  productSystem: DataTypes.STRING,
  revision: DataTypes.STRING,
  projectDate: DataTypes.DATEONLY,
  submittalNumber: DataTypes.STRING,
  discipline: DataTypes.STRING,
  status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' }
});

const ChildChecklist = sequelize.define('ChildChecklist', {
  ...base,
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const ChildChecklistItem = sequelize.define('ChildChecklistItem', {
  ...base,
  titleSnapshot: { type: DataTypes.TEXT, allowNull: false },
  status: DataTypes.STRING,
  remarks: DataTypes.TEXT,
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const PqdSubmission = sequelize.define('PqdSubmission', {
  ...base,
  title: DataTypes.STRING,
  revision: DataTypes.STRING,
  status: {
    type: DataTypes.STRING,
    defaultValue: 'DRAFT',
    validate: { isIn: [['DRAFT', 'GENERATED']] }
  },
  currentVersion: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const PqdSubmissionItem = sequelize.define('PqdSubmissionItem', {
  ...base,
  titleSnapshot: { type: DataTypes.TEXT, allowNull: false },
  status: DataTypes.STRING,
  remarks: DataTypes.TEXT,
  includeInPdf: { type: DataTypes.BOOLEAN, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const GeneratedPdf = sequelize.define('GeneratedPdf', {
  ...base,
  version: { type: DataTypes.INTEGER, allowNull: false },
  filePath: { type: DataTypes.STRING, allowNull: false },
  fileName: { type: DataTypes.STRING, allowNull: false },
  sizeBytes: DataTypes.INTEGER
});

const AlertSetting = sequelize.define('AlertSetting', {
  ...base,
  daysBefore: { type: DataTypes.JSON, defaultValue: [30, 15, 7] },
  recipientEmails: { type: DataTypes.TEXT, defaultValue: '' },
  frequency: { type: DataTypes.STRING, defaultValue: 'DAILY' },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const ActivityLog = sequelize.define('ActivityLog', {
  ...base,
  action: { type: DataTypes.STRING, allowNull: false },
  entityType: DataTypes.STRING,
  entityId: DataTypes.STRING,
  details: DataTypes.JSON,
  ipAddress: DataTypes.STRING
});

Company.hasMany(User, { foreignKey: 'companyId', as: 'users' });
User.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(CompanyDocument, { foreignKey: 'companyId', as: 'documents' });
CompanyDocument.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
User.hasMany(CompanyDocument, { foreignKey: 'createdById', as: 'uploadedDocuments' });
CompanyDocument.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

Company.hasMany(MasterChecklistItem, { foreignKey: 'companyId', as: 'masterChecklistItems' });
MasterChecklistItem.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(Project, { foreignKey: 'companyId', as: 'projects' });
Project.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(ChildChecklist, { foreignKey: 'companyId', as: 'childChecklists' });
ChildChecklist.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Project.hasMany(ChildChecklist, { foreignKey: 'projectId', as: 'childChecklists' });
ChildChecklist.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

ChildChecklist.hasMany(ChildChecklistItem, { foreignKey: 'childChecklistId', as: 'items', onDelete: 'CASCADE' });
ChildChecklistItem.belongsTo(ChildChecklist, { foreignKey: 'childChecklistId', as: 'checklist' });
MasterChecklistItem.hasMany(ChildChecklistItem, { foreignKey: 'masterItemId', as: 'childItems' });
ChildChecklistItem.belongsTo(MasterChecklistItem, { foreignKey: 'masterItemId', as: 'masterItem' });

Company.hasMany(PqdSubmission, { foreignKey: 'companyId', as: 'submissions' });
PqdSubmission.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Project.hasMany(PqdSubmission, { foreignKey: 'projectId', as: 'submissions' });
PqdSubmission.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
ChildChecklist.hasMany(PqdSubmission, { foreignKey: 'childChecklistId', as: 'submissions' });
PqdSubmission.belongsTo(ChildChecklist, { foreignKey: 'childChecklistId', as: 'childChecklist' });
User.hasMany(PqdSubmission, { foreignKey: 'createdById', as: 'createdSubmissions' });
PqdSubmission.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

PqdSubmission.hasMany(PqdSubmissionItem, { foreignKey: 'submissionId', as: 'items', onDelete: 'CASCADE' });
PqdSubmissionItem.belongsTo(PqdSubmission, { foreignKey: 'submissionId', as: 'submission' });
ChildChecklistItem.hasMany(PqdSubmissionItem, { foreignKey: 'childChecklistItemId', as: 'submissionItems' });
PqdSubmissionItem.belongsTo(ChildChecklistItem, { foreignKey: 'childChecklistItemId', as: 'childChecklistItem' });
CompanyDocument.hasMany(PqdSubmissionItem, { foreignKey: 'documentId', as: 'submissionItems' });
PqdSubmissionItem.belongsTo(CompanyDocument, { foreignKey: 'documentId', as: 'document' });

PqdSubmission.hasMany(GeneratedPdf, { foreignKey: 'submissionId', as: 'generatedPdfs', onDelete: 'CASCADE' });
GeneratedPdf.belongsTo(PqdSubmission, { foreignKey: 'submissionId', as: 'submission' });
User.hasMany(GeneratedPdf, { foreignKey: 'generatedById', as: 'generatedPdfs' });
GeneratedPdf.belongsTo(User, { foreignKey: 'generatedById', as: 'generatedBy' });

Company.hasOne(AlertSetting, { foreignKey: 'companyId', as: 'alertSetting' });
AlertSetting.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(ActivityLog, { foreignKey: 'companyId', as: 'activityLogs' });
ActivityLog.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activityLogs' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  Company,
  User,
  CompanyDocument,
  MasterChecklistItem,
  Project,
  ChildChecklist,
  ChildChecklistItem,
  PqdSubmission,
  PqdSubmissionItem,
  GeneratedPdf,
  AlertSetting,
  ActivityLog
};
