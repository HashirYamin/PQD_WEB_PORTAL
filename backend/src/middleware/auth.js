const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Company } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findByPk(payload.sub, {
      attributes: { exclude: ['passwordHash'] },
      include: [{ model: Company, as: 'company' }]
    });

    if (!user || !user.isActive) return res.status(401).json({ message: 'Account is unavailable.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission for this action.' });
  }
  next();
};

const resolveCompanyId = (req) => {
  if (req.user.role === 'SUPER_ADMIN') {
    return req.query.companyId || req.body.companyId || req.params.companyId || req.user.companyId || null;
  }
  return req.user.companyId;
};

const enforceCompany = (req, res, next) => {
  const companyId = resolveCompanyId(req);
  if (!companyId) return res.status(400).json({ message: 'A company must be selected.' });
  req.companyId = companyId;
  next();
};

module.exports = { authenticate, authorize, enforceCompany, resolveCompanyId };
