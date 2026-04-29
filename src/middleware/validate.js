const HttpError = require("../utils/httpError");

const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return next(new HttpError(400, message, "VALIDATION_ERROR"));
  }
  req.body = result.data;
  next();
};

module.exports = validate;
