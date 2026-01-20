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
