const bcrypt = require('bcryptjs');
const { User } = require('../models');

const ensureSuperAdmin = async () => {
  const name = String(
    process.env.SUPER_ADMIN_NAME || 'System Administrator'
  ).trim();
  const email = String(process.env.SUPER_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '');

  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required in production.'
    );
  }

  const passwordIsStrong =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (!passwordIsStrong) {
    throw new Error(
      'SUPER_ADMIN_PASSWORD must include uppercase, lowercase, number and special character.'
    );
  }

  const existing = await User.findOne({ where: { email } });

  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') {
      throw new Error(
        'SUPER_ADMIN_EMAIL already belongs to a non-super-admin account.'
      );
    }

    const updates = {};
    if (!existing.isActive) updates.isActive = true;
    if (name && existing.name !== name) updates.name = name;
    if (!(await bcrypt.compare(password, existing.passwordHash))) {
      updates.passwordHash = await bcrypt.hash(password, 12);
    }
    if (Object.keys(updates).length) await existing.update(updates);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({
    name,
    email,
    passwordHash,
    role: 'SUPER_ADMIN',
    companyId: null,
    isActive: true
  });
};

module.exports = { ensureSuperAdmin };
