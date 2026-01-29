/**
 * Shared constants for AI Toolkit
 */

export const PROVIDER_TYPES = {
  CLI: 'cli',
  API: 'api'
};

export const MODEL_TIERS = {
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy'
};

export const RUN_TYPES = {
  AI: 'ai',
  COMMAND: 'command'
};

export const DEFAULT_TIMEOUT = 300000; // 5 minutes
export const MAX_TIMEOUT = 600000; // 10 minutes
export const MIN_TIMEOUT = 1000; // 1 second

export const DEFAULT_TEMPERATURE = 0.1;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Error categories for AI provider errors
 */
export const ERROR_CATEGORIES = {
  RATE_LIMIT: 'rate-limit',
  USAGE_LIMIT: 'usage-limit',
  AUTH_ERROR: 'auth-error',
  MODEL_NOT_FOUND: 'model-not-found',
  NETWORK_ERROR: 'network-error',
  TIMEOUT: 'timeout',
  QUOTA_EXCEEDED: 'quota-exceeded',
  UNKNOWN: 'unknown'
};

/**
 * Provider status reasons
 */
export const PROVIDER_STATUS_REASONS = {
  OK: 'ok',
  USAGE_LIMIT: 'usage-limit',
  RATE_LIMIT: 'rate-limit',
  AUTH_ERROR: 'auth-error',
  NETWORK_ERROR: 'network-error'
};

/**
 * Default wait times for provider recovery (in milliseconds)
 */
export const DEFAULT_USAGE_LIMIT_WAIT = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_RATE_LIMIT_WAIT = 5 * 60 * 1000; // 5 minutes
