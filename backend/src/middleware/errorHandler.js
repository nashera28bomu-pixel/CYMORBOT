function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status === 500 ? 'Something went wrong on our end. Please try again shortly.' : err.message
    }
  });
}

module.exports = { notFoundHandler, errorHandler };
