const notFound = (req, res) => res.status(404).json({ message: 'Endpoint not found.' });

const errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ message: err.errors.map((item) => item.message).join(', ') });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: err.message });
  }
  res.status(err.status || 500).json({ message: err.message || 'Unexpected server error.' });
};

module.exports = { notFound, errorHandler };
