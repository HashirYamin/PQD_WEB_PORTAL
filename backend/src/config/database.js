const { Sequelize } = require('sequelize');
const env = require('./env');

let sequelize;

if (process.env.USE_PG_MEM === 'true') {
  // Test-only, in-memory PostgreSQL compatibility mode.
  // Production and normal local development must use the DATABASE_URL below.
  const { newDb, DataType } = require('pg-mem');
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  memoryDb.public.registerFunction({ name: 'current_database', args: [], returns: DataType.text, implementation: () => 'pqd_test' });
  memoryDb.public.registerFunction({ name: 'version', args: [], returns: DataType.text, implementation: () => 'PostgreSQL 16 test' });
  const pg = memoryDb.adapters.createPg();
  sequelize = new Sequelize('postgres://test:test@localhost:5432/pqd_test', {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false
  });
} else {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required. Start PostgreSQL with docker compose and configure backend/.env.');
  }
  sequelize = new Sequelize(env.databaseUrl, {
    logging: false,
    dialect: 'postgres',
    dialectOptions: env.nodeEnv === 'production' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
  });
}

module.exports = sequelize;
