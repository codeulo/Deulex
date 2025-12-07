// lib/errors/AuthenticationError.js
class AuthenticationError extends Error {
  public name = "AuthenticationError";
  public details?: any;
  public statusCode = 401;

  static from(message?: string, details?: any) {
    const err = new this(message ?? "");
    err.details = details;
    return err;
  }
}

// lib/errors/DatabaseError.js
class DatabaseError extends Error {
  public name = "DatabaseError";
  public details?: any;
  public statusCode = 500;

  static from(message?: string, details?: any) {
    const err = new this(message ?? "");
    err.details = details;
    return err;
  }
}

// lib/errors/RateLimitError.js
class RateLimitError extends Error {
  public name = "RateLimitError";
  public details?: any;
  public statusCode = 429;

  static from(message?: string, details?: any) {
    const err = new this(message ?? "");
    err.details = details;
    return err;
  }
}

module.exports = { AuthenticationError, DatabaseError, RateLimitError };
