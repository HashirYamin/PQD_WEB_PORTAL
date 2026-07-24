const {
  sequelize,
  Supplier,
  SupplierAddress,
  SupplierProduct,
  SupplierDocumentLink,
  ProductDocumentLink,
  PqdSubmission
} = require('./models');

const migrateLegacyLinks = async () => {
  const suppliers = await Supplier.findAll();
  let productsCreated = 0;
  let linksMigrated = 0;
  let submissionsUpdated = 0;
  let addressesMigrated = 0;

  for (const supplier of suppliers) {
    const existingAddressCount = await SupplierAddress.count({
      where: { supplierId: supplier.id }
    });

    if (!existingAddressCount && supplier.address) {
      await SupplierAddress.create({
        supplierId: supplier.id,
        label: 'Main Office',
        addressLine1: supplier.address,
        isPrimary: true
      });
      addressesMigrated += 1;
    }
    const legacyLinks = await SupplierDocumentLink.findAll({
      where: { supplierId: supplier.id }
    });

    let product = await SupplierProduct.findOne({
      where: { supplierId: supplier.id },
      order: [['createdAt', 'ASC']]
    });

    if (!product && legacyLinks.length) {
      product = await SupplierProduct.create({
        supplierId: supplier.id,
        name: 'General Product',
        code: 'GENERAL',
        description:
          'Created automatically while migrating the earlier supplier-level document mappings.',
        isActive: true
      });
      productsCreated += 1;
    }

    if (product) {
      for (const legacy of legacyLinks) {
        const [, created] = await ProductDocumentLink.findOrCreate({
          where: {
            productId: product.id,
            documentId: legacy.documentId,
            masterItemId: legacy.masterItemId
          },
          defaults: {
            productId: product.id,
            documentId: legacy.documentId,
            masterItemId: legacy.masterItemId,
            priority: legacy.priority || 1,
            remarks: legacy.remarks || 'Migrated from supplier-level mapping.',
            isActive: true
          }
        });
        if (created) linksMigrated += 1;
      }

      const [updated] = await PqdSubmission.update(
        { productId: product.id },
        {
          where: {
            supplierId: supplier.id,
            productId: null
          }
        }
      );
      submissionsUpdated += updated;
    }
  }

  return {
    productsCreated,
    linksMigrated,
    submissionsUpdated,
    addressesMigrated
  };
};

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    const result = await migrateLegacyLinks();

    console.log('Supplier-product workflow migration completed.');
    console.log(`Products created from legacy data: ${result.productsCreated}`);
    console.log(`Legacy mappings converted: ${result.linksMigrated}`);
    console.log(`Existing PQD drafts linked to products: ${result.submissionsUpdated}`);
    console.log(`Legacy supplier addresses migrated: ${result.addressesMigrated}`);
  } finally {
    await sequelize.close();
  }
};

run().catch(async (error) => {
  console.error('Supplier-product workflow migration failed:', error);
  try {
    await sequelize.close();
  } catch {}
  process.exit(1);
});
