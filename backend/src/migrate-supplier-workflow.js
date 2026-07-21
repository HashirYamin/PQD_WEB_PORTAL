const { sequelize } = require('./models');

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('Supplier workflow database migration completed.');
  } finally {
    await sequelize.close();
  }
};

run().catch(async (error) => {
  console.error('Supplier workflow migration failed:', error);
  try {
    await sequelize.close();
  } catch {}
  process.exit(1);
});
