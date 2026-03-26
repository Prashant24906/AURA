const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: messages.join(', '),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: 'DuplicateEntry',
      message: `${field} already exists`,
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'InvalidId',
      message: 'Invalid ID format',
    });
  }

  if (err.message && err.message.includes('Only .jpg')) {
    return res.status(400).json({
      success: false,
      error: 'InvalidFileType',
      message: err.message,
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.name || 'ServerError',
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
