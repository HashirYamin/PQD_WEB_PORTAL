const { sequelize } = require('./models');

const run = async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log('Review update database migration completed.');
  await sequelize.close();
};

run().catch(async (error) => {
  console.error('Review update migration failed:', error);
  await sequelize.close();
  process.exit(1);
});
