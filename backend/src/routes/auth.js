const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const { User, Company } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many login attempts. Please try again later.' } });

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ where: { email }, include: [{ model: Company, as: 'company' }] });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role, companyId: user.companyId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    const safeUser = user.toJSON();
    delete safeUser.passwordHash;
    res.json({ token, user: safeUser });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res) => res.json({ user: req.user }));

module.exports = router;
