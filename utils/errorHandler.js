/**
 * Centralized error handling utility
 * Provides secure error responses without exposing sensitive information
 */

const log = require("./secureLogger");

class ErrorHandler {
  /**
   * Sanitizes error messages to prevent information disclosure
   * @param {Error} error - The error object
   * @param {boolean} isDevelopment - Whether in development mode
   * @returns {string} - Sanitized error message
   */
  static sanitizeError(error, isDevelopment = false) {
    if (isDevelopment) {
      return error.message || "An error occurred";
    }
    
    // In production, return generic messages for security
    const genericMessages = {
      'ENOENT': 'Resource not found',
      'EACCES': 'Access denied',
      'ECONNREFUSED': 'Service unavailable',
      'ETIMEDOUT': 'Request timeout',
      'ValidationError': 'Invalid input provided',
      'CastError': 'Invalid data format',
      'MongoError': 'Database error',
      'JsonWebTokenError': 'Authentication failed',
      'TokenExpiredError': 'Session expired'
    };
    
    // Check for known error types
    for (const [errorType, message] of Object.entries(genericMessages)) {
      if (error.name === errorType || error.code === errorType || error.message.includes(errorType)) {
        return message;
      }
    }
    
    return "An unexpected error occurred";
  }

  /**
   * Handles async route errors
   * @param {Function} fn - Async route handler
   * @returns {Function} - Wrapped route handler
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Express error middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static middleware(err, req, res, next) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Log the full error for debugging
    log.error("Error occurred:", {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });

    // Determine status code
    let statusCode = err.statusCode || err.status || 500;
    if (statusCode < 400) statusCode = 500;

    // Handle specific error types
    if (err.name === 'ValidationError') {
      statusCode = 400;
    } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
      statusCode = 401;
    } else if (err.name === 'ForbiddenError') {
      statusCode = 403;
    } else if (err.code === 'ENOENT') {
      statusCode = 404;
    }

    // Prepare response
    const response = {
      error: this.sanitizeError(err, isDevelopment),
      status: statusCode
    };

    // Add stack trace in development
    if (isDevelopment) {
      response.stack = err.stack;
      response.details = err.message;
    }

    // Send appropriate response
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(statusCode).json(response);
    } else {
      // Render error page for HTML requests
      res.status(statusCode).render('errors/error', {
        error: response.error,
        status: statusCode,
        req,
        user: req.user || null
      });
    }
  }

  /**
   * Handles 404 errors
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static notFound(req, res) {
    const statusCode = 404;
    const message = "Page not found";
    
    log.warn("404 Not Found:", {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(statusCode).json({ error: message, status: statusCode });
    } else {
      res.status(statusCode).render('errors/404', {
        req,
        user: req.user || null,
        name: "Impulse"
      });
    }
  }
}

module.exports = ErrorHandler;