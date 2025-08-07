const { AppError } = require('./errorHandler');

// Zod validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validate request body, query, and params
      const dataToValidate = {
        body: req.body,
        query: req.query,
        params: req.params,
      };

      const validatedData = schema.parse(dataToValidate);

      // Replace request data with validated data
      req.body = validatedData.body || req.body;
      req.query = validatedData.query || req.query;
      req.params = validatedData.params || req.params;

      next();
    } catch (error) {
      // Format Zod validation errors
      if (error.errors) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return next(new AppError(
          `Validation failed: ${validationErrors.map(err => err.message).join(', ')}`,
          400
        ));
      }

      next(error);
    }
  };
};

// Custom validation for specific fields
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validatePhone = (phone) => {
  // Indian phone number format
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
};

const validateOTP = (otp) => {
  // 6-digit OTP
  const otpRegex = /^\d{6}$/;
  return otpRegex.test(otp);
};

// Sanitize input data
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
};

// Sanitize request body
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  next();
};

module.exports = {
  validate,
  validateEmail,
  validatePassword,
  validatePhone,
  validateOTP,
  sanitizeInput,
  sanitizeBody,
};
