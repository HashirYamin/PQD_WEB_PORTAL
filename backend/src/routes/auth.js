const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { rateLimit } = require('express-rate-limit');

const env = require('../config/env');
const {
  sequelize,
  User,
  Company,
  AlertSetting
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try again later.'
  }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many registration attempts. Please try again later.'
  }
});

/* LOGIN */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Company, as: 'company' }]
    });

    const validPassword =
      user && (await bcrypt.compare(password, user.passwordHash));

    if (
      !user ||
      !user.isActive ||
      (user.companyId && !user.company?.isActive) ||
      !validPassword
    ) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        companyId: user.companyId
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    const safeUser = user.toJSON();
    delete safeUser.passwordHash;

    res.json({
      token,
      user: safeUser
    });
  } catch (error) {
    next(error);
  }
});

/* COMPANY SIGNUP */
router.post(
  '/register-company',
  signupLimiter,
  async (req, res, next) => {
    let transaction;

    try {
      const companyName = String(
        req.body.companyName || ''
      ).trim();

      const crNumber = String(
        req.body.crNumber || ''
      ).trim();

      const companyEmail = String(
        req.body.companyEmail || ''
      )
        .trim()
        .toLowerCase();

      const companyPhone = String(
        req.body.companyPhone || ''
      ).trim();

      const address = String(
        req.body.address || ''
      ).trim();

      const contactPerson = String(
        req.body.contactPerson || ''
      ).trim();

      const adminName = String(
        req.body.adminName || ''
      ).trim();

      const adminEmail = String(
        req.body.adminEmail || ''
      )
        .trim()
        .toLowerCase();

      const password = String(
        req.body.password || ''
      );

      const confirmPassword = String(
        req.body.confirmPassword || ''
      );

      if (
        !companyName ||
        !crNumber ||
        !companyEmail ||
        !adminName ||
        !adminEmail ||
        !password ||
        !confirmPassword
      ) {
        return res.status(400).json({
          message: 'Please complete all required fields.'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          message: 'Passwords do not match.'
        });
      }

      const passwordIsStrong =
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);

      if (!passwordIsStrong) {
        return res.status(400).json({
          message:
            'Password must contain at least 8 characters, including uppercase, lowercase, number and special character.'
        });
      }

      const existingUser = await User.findOne({
        where: { email: adminEmail }
      });

      if (existingUser) {
        return res.status(409).json({
          message:
            'An account already exists with this administrator email.'
        });
      }

      const existingCompany = await Company.findOne({
        where: {
          [Op.or]: [
            { crNumber },
            { email: companyEmail }
          ]
        }
      });

      if (existingCompany) {
        return res.status(409).json({
          message:
            'A company already exists with this CR number or company email.'
        });
      }

      transaction = await sequelize.transaction();

      const passwordHash = await bcrypt.hash(password, 12);

      const company = await Company.create(
        {
          name: companyName,
          crNumber,
          address: address || null,
          contactPerson: contactPerson || adminName,
          email: companyEmail,
          phone: companyPhone || null,
          isActive: false,
          settings: {
            registrationStatus: 'PENDING_APPROVAL',
            registeredAt: new Date().toISOString()
          }
        },
        { transaction }
      );

      const user = await User.create(
        {
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: 'COMPANY_ADMIN',
          companyId: company.id,
          isActive: false
        },
        { transaction }
      );

      await AlertSetting.create(
        {
          companyId: company.id,
          daysBefore: [30, 15, 7],
          recipientEmails: adminEmail,
          frequency: 'DAILY',
          enabled: true
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(201).json({
        message:
          'Registration submitted successfully. Your account will be available after Super Admin approval.',
        registration: {
          companyId: company.id,
          companyName: company.name,
          administratorEmail: user.email,
          status: 'PENDING_APPROVAL'
        }
      });
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      next(error);
    }
  }
);

router.get(
  '/me',
  authenticate,
  async (req, res) => {
    res.json({ user: req.user });
  }
);

module.exports = router;