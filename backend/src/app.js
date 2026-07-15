const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const env = require('./config/env');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const documentRoutes = require('./routes/documents');
const checklistRoutes = require('./routes/checklists');
const projectRoutes = require('./routes/projects');
const pqdRoutes = require('./routes/pqds');
const settingsRoutes = require('./routes/settings');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.frontendUrl.split(',').map((item) => item.trim()), credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'PQD Web Portal API', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/pqds', pqdRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
