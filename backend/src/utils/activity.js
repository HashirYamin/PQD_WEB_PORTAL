const { ActivityLog } = require('../models');

const logActivity = async (req, action, entityType, entityId, details = {}) => {
  try {
    await ActivityLog.create({
      companyId: req.companyId || req.user?.companyId || null,
      userId: req.user?.id || null,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      details,
      ipAddress: req.ip
    });
  } catch (error) {
    console.warn('Activity log failed:', error.message);
  }
};

module.exports = { logActivity };
