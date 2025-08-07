const jwt = require('jsonwebtoken');
const { AppError, asyncHandler } = require('./errorHandler');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes - require authentication
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    // Check if user is still active
    if (!user.isEmailVerified) {
      return next(new AppError('Please verify your email first', 401));
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return next(new AppError('Not authorized to access this route', 401));
  }
});

// Optional authentication - doesn't require token but sets user if available
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (token) {
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isEmailVerified) {
        req.user = user;
      }
    } catch (error) {
      // Token is invalid, but we don't throw error for optional auth
      logger.debug('Optional auth token verification failed:', error.message);
    }
  }

  next();
});

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

// Set JWT cookies
const setTokenCookies = (res, accessToken, refreshToken, rememberMe = false) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  // Access token cookie (short-lived)
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Refresh token cookie
  if (rememberMe) {
    // Long-lived cookie for "Remember Me"
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  } else {
    // Session cookie (expires when browser closes)
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
    });
  }
};

// Clear JWT cookies
const clearTokenCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
};

// Check if user is Pro
const requirePro = asyncHandler(async (req, res, next) => {
  if (!req.user.isPro) {
    return next(new AppError('Pro subscription required for this feature', 403));
  }
  next();
});

module.exports = {
  protect,
  optionalAuth,
  generateTokens,
  setTokenCookies,
  clearTokenCookies,
  requirePro,
};
