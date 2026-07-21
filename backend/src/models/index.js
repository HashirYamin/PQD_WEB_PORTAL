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
  yearEstablished: DataTypes.INTEGER,
  natureOfWork: DataTypes.TEXT,
  address: DataTypes.TEXT,
  contactPerson: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  fax: DataTypes.STRING,
  website: DataTypes.STRING,
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
  documentNumber: DataTypes.STRING,
  issuingAuthority: DataTypes.STRING,
  issueDate: DataTypes.DATEONLY,
  expiryDate: DataTypes.DATEONLY,
  expiryNotApplicable: { type: DataTypes.BOOLEAN, defaultValue: false },
  ocrData: { type: DataTypes.JSON, defaultValue: {} },
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
  label: { type: DataTypes.STRING, defaultValue: 'Main Office' },
  addressLine1: { type: DataTypes.TEXT, allowNull: false },
  addressLine2: DataTypes.TEXT,
  city: DataTypes.STRING,
  state: DataTypes.STRING,
  postalCode: DataTypes.STRING,
  country: DataTypes.STRING,
  isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const CompanySocialLink = sequelize.define('CompanySocialLink', {
  ...base,
  platform: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.TEXT, allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const CompanyContact = sequelize.define('CompanyContact', {
  ...base,
  name: { type: DataTypes.STRING, allowNull: false },
  jobTitle: DataTypes.STRING,
  department: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  mobile: DataTypes.STRING,
  isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const CompanyProfileDocument = sequelize.define('CompanyProfileDocument', {
  ...base,
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['LEGAL', 'CERTIFICATION']] }
  },
  title: { type: DataTypes.STRING, allowNull: false },
  documentNumber: DataTypes.STRING,
  issueDate: DataTypes.DATEONLY,
  expiryDate: DataTypes.DATEONLY,
  expiryNotApplicable: { type: DataTypes.BOOLEAN, defaultValue: false },
  authority: DataTypes.STRING,
  remarks: DataTypes.TEXT,
  ocrData: { type: DataTypes.JSON, defaultValue: {} },
  filePath: { type: DataTypes.STRING, allowNull: false },
  originalName: { type: DataTypes.STRING, allowNull: false },
  mimeType: DataTypes.STRING,
  sizeBytes: DataTypes.INTEGER,
  isArchived: { type: DataTypes.BOOLEAN, defaultValue: false }
});
const Supplier = sequelize.define('Supplier', {
  ...base,

  name: {
    type: DataTypes.STRING,
    allowNull: false
  },

  code: DataTypes.STRING,

  registrationNumber: DataTypes.STRING,

  email: DataTypes.STRING,

  phone: DataTypes.STRING,

  website: DataTypes.STRING,

  address: DataTypes.TEXT,

  description: DataTypes.TEXT,

  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

const SupplierContact = sequelize.define(
  'SupplierContact',
  {
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
  }
);

const SupplierDocumentLink = sequelize.define(
  'SupplierDocumentLink',
  {
    ...base,

    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },

    remarks: DataTypes.TEXT
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
  contractCode: DataTypes.STRING,
  client: DataTypes.STRING,
  consultant: DataTypes.STRING,
  contractor: DataTypes.STRING,
  clientLogoPath: DataTypes.STRING,
  consultantLogoPath: DataTypes.STRING,
  contractorLogoPath: DataTypes.STRING,
  supplier: DataTypes.STRING,
  productSystem: DataTypes.STRING,
  revision: DataTypes.STRING,
  projectDate: DataTypes.DATEONLY,
  startDate: DataTypes.DATEONLY,
  endDate: DataTypes.DATEONLY,
  submittalNumber: DataTypes.STRING,
  discipline: DataTypes.STRING,
  status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' }
});

const ProjectContact = sequelize.define('ProjectContact', {
  ...base,
  name: { type: DataTypes.STRING, allowNull: false },
  organization: DataTypes.STRING,
  role: DataTypes.STRING,
  jobTitle: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  mobile: DataTypes.STRING,
  isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 }
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

Company.hasMany(CompanyAddress, { foreignKey: 'companyId', as: 'addresses', onDelete: 'CASCADE' });
CompanyAddress.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(CompanySocialLink, { foreignKey: 'companyId', as: 'socialLinks', onDelete: 'CASCADE' });
CompanySocialLink.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(CompanyContact, { foreignKey: 'companyId', as: 'contacts', onDelete: 'CASCADE' });
CompanyContact.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(CompanyProfileDocument, { foreignKey: 'companyId', as: 'profileDocuments', onDelete: 'CASCADE' });
CompanyProfileDocument.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
User.hasMany(CompanyProfileDocument, { foreignKey: 'createdById', as: 'uploadedProfileDocuments' });
CompanyProfileDocument.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

Company.hasMany(MasterChecklistItem, { foreignKey: 'companyId', as: 'masterChecklistItems' });
MasterChecklistItem.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Company.hasMany(Supplier, {
  foreignKey: 'companyId',
  as: 'suppliers'
});

Supplier.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company'
});

Supplier.hasMany(SupplierContact, {
  foreignKey: 'supplierId',
  as: 'contacts',
  onDelete: 'CASCADE'
});

SupplierContact.belongsTo(Supplier, {
  foreignKey: 'supplierId',
  as: 'supplier'
});

Supplier.hasMany(SupplierDocumentLink, {
  foreignKey: 'supplierId',
  as: 'documentLinks',
  onDelete: 'CASCADE'
});

SupplierDocumentLink.belongsTo(Supplier, {
  foreignKey: 'supplierId',
  as: 'supplier'
});

CompanyDocument.hasMany(SupplierDocumentLink, {
  foreignKey: 'documentId',
  as: 'supplierLinks'
});

SupplierDocumentLink.belongsTo(CompanyDocument, {
  foreignKey: 'documentId',
  as: 'document'
});

MasterChecklistItem.hasMany(
  SupplierDocumentLink,
  {
    foreignKey: 'masterItemId',
    as: 'supplierDocumentLinks'
  }
);

SupplierDocumentLink.belongsTo(
  MasterChecklistItem,
  {
    foreignKey: 'masterItemId',
    as: 'masterItem'
  }
);

Supplier.hasMany(PqdSubmission, {
  foreignKey: 'supplierId',
  as: 'submissions'
});

PqdSubmission.belongsTo(Supplier, {
  foreignKey: 'supplierId',
  as: 'supplier'
});
Company.hasMany(Project, { foreignKey: 'companyId', as: 'projects' });
Project.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Project.hasMany(ProjectContact, { foreignKey: 'projectId', as: 'contacts', onDelete: 'CASCADE' });
ProjectContact.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

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
  CompanyAddress,
  CompanySocialLink,
  CompanyContact,
  CompanyProfileDocument,

  Supplier,
  SupplierContact,
  SupplierDocumentLink,

  MasterChecklistItem,
  Project,
  ProjectContact,
  ChildChecklist,
  ChildChecklistItem,
  PqdSubmission,
  PqdSubmissionItem,
  GeneratedPdf,
  AlertSetting,
  ActivityLog
};
