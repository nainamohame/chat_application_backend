const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
    code: err.code,
  });
};

module.exports = errorHandler;
