const {
  sequelize,
  CompanyProfileDocument,
  CompanyDocument
} = require('./models');

const run = async () => {
  await sequelize.authenticate();

  const legacyDocuments = await CompanyProfileDocument.findAll({
    where: { isArchived: false },
    order: [['createdAt', 'ASC']]
  });

  let migrated = 0;

  for (const legacy of legacyDocuments) {
    const transaction = await sequelize.transaction();

    try {
      const category =
        legacy.type === 'CERTIFICATION'
          ? 'Certificates'
          : 'Legal Documents';

      await CompanyDocument.create(
        {
          companyId: legacy.companyId,
          createdById: legacy.createdById,
          title: legacy.title,
          category,
          documentNumber: legacy.documentNumber,
          issuingAuthority: legacy.authority,
          issueDate: legacy.issueDate,
          expiryDate: legacy.expiryDate,
          expiryNotApplicable: legacy.expiryNotApplicable,
          documentType:
            legacy.type === 'CERTIFICATION'
              ? 'Certificate'
              : 'Legal Document',
          remarks: legacy.remarks,
          ocrData: {
            ...(legacy.ocrData || {}),
            migratedFromProfileDocumentId: legacy.id,
            migratedAt: new Date().toISOString()
          },
          filePath: legacy.filePath,
          originalName: legacy.originalName,
          mimeType: legacy.mimeType,
          sizeBytes: legacy.sizeBytes,
          isArchived: false,
          createdAt: legacy.createdAt,
          updatedAt: legacy.updatedAt
        },
        { transaction }
      );

      // The old record is archived so running this migration again does not
      // create duplicates. The physical file remains in the same location.
      await legacy.update(
        { isArchived: true },
        { transaction }
      );

      await transaction.commit();
      migrated += 1;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  console.log(
    `Profile document migration completed. Migrated ${migrated} document(s).`
  );
  await sequelize.close();
};

run().catch(async (error) => {
  console.error('Profile document migration failed:', error);
  await sequelize.close();
  process.exit(1);
});
