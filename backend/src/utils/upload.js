const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const env = require('../config/env');

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const createUploader = (folder, options = {}) => {
  const acceptedTypes = new Set(options.allowedMimeTypes || [...allowedMimeTypes]);
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const companyId = req.companyId || req.user?.companyId || 'unassigned';
      const dir = path.join(env.uploadRoot, folder, String(companyId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${uuid()}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: options.maxBytes || env.maxUploadBytes },
    fileFilter: (req, file, cb) => {
      if (!acceptedTypes.has(file.mimetype)) return cb(new Error('Unsupported file type.'));
      cb(null, true);
    }
  });
};

module.exports = { createUploader };
