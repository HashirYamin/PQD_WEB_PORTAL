const fs = require('fs');
const env = require('./config/env');
const app = require('./app');
const { sequelize } = require('./models');
const { startExpiryJob } = require('./services/expiryJob');

const start = async () => {
  fs.mkdirSync(env.uploadRoot, { recursive: true });
  await sequelize.authenticate();
  await sequelize.sync();
  startExpiryJob();
  app.listen(env.port, () => {
    console.log(`PQD API running on http://localhost:${env.port}`);
    console.log('Database: PostgreSQL');
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
