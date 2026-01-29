/**
 * Error Detection Utility
 *
 * Detects and categorizes errors from AI provider responses,
 * particularly rate limits and usage limits that require fallback handling.
 */

/**
 * Error categories and their characteristics
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
 * Error patterns for detection
 * NOTE: Order matters! More specific patterns should come before general ones.
 */
const ERROR_PATTERNS = [
  // Quota exceeded (billing issues - check before usage limit since "quota" could match both)
  {
    pattern: /billing|payment|credit|insufficient funds/i,
    category: ERROR_CATEGORIES.QUOTA_EXCEEDED,
    requiresFallback: true,
    actionable: true,
    suggestedFix: 'Check billing status and add credits to the provider account'
  },

  // Rate limiting (temporary, short wait)
  {
    pattern: /API Error: 429|rate.?limit|too many requests/i,
    category: ERROR_CATEGORIES.RATE_LIMIT,
    requiresFallback: false, // Usually temporary
    actionable: false,
    suggestedFix: 'Wait and retry - temporary rate limiting'
  },

  // Usage limits (longer wait, fallback recommended)
  {
    pattern: /(?:hit your usage limit|You've hit your limit|usage limit|Upgrade to Pro)/i,
    category: ERROR_CATEGORIES.USAGE_LIMIT,
    requiresFallback: true,
    actionable: true,
    suggestedFix: 'Provider usage limit reached. Using fallback provider or wait for limit reset.',
    extractWaitTime: true
  },

  // Authentication errors
  {
    pattern: /unauthorized|invalid.?api.?key|authentication|forbidden|401|403/i,
    category: ERROR_CATEGORIES.AUTH_ERROR,
    requiresFallback: true,
    actionable: true,
    suggestedFix: 'Check API key configuration for this provider'
  },

  // Model not found
  {
    pattern: /model.*(not found|does not exist|unavailable)|invalid model/i,
    category: ERROR_CATEGORIES.MODEL_NOT_FOUND,
    requiresFallback: true,
    actionable: true,
    suggestedFix: 'Check model name and availability in provider settings'
  },

  // Network errors
  {
    pattern: /ECONNREFUSED|ENOTFOUND|network error|connection refused|timeout|ETIMEDOUT/i,
    category: ERROR_CATEGORIES.NETWORK_ERROR,
    requiresFallback: false, // Often temporary
    actionable: false,
    suggestedFix: 'Check network connectivity and provider endpoint URL'
  },

  // Timeout
  {
    pattern: /timed out|timeout exceeded|SIGTERM/i,
    category: ERROR_CATEGORIES.TIMEOUT,
    requiresFallback: false,
    actionable: false,
    suggestedFix: 'Consider increasing timeout or reducing prompt complexity'
  }
];

/**
 * Wait time extraction patterns
 */
const WAIT_TIME_PATTERNS = [
  // "resets 6am (America/Los_Angeles)" - extract timezone-aware time
  /resets?\s+(\d{1,2}(?:am|pm)?)\s*\(([^)]+)\)/i,
  // "try again in X day(s) X hour(s) X minute(s)"
  /try again in\s+((?:\d+\s*(?:day|hour|minute|second)s?\s*)+)/i,
  // "wait X minutes/hours/days"
  /wait\s+((?:\d+\s*(?:day|hour|minute|second)s?\s*)+)/i,
  // "in X hours", "in X minutes"
  /in\s+(\d+)\s*(day|hour|minute|second)s?/i,
  // Specific time format "1 day 1 hour 33 minutes"
  /(\d+\s*day(?:s)?)?[,\s]*(\d+\s*hour(?:s)?)?[,\s]*(\d+\s*min(?:ute)?(?:s)?)?/i
];

/**
 * Extract wait time from error message
 * @param {string} text - Error text to search
 * @returns {string|null} - Human-readable wait time or null
 */
export function extractWaitTime(text) {
  if (!text) return null;

  // Try each pattern
  for (const pattern of WAIT_TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Clean up and return the matched time string
      const timeStr = match.slice(1).filter(Boolean).join(' ').trim();
      if (timeStr && timeStr !== ' ') {
        return timeStr;
      }
    }
  }

  // Try to find any time-related content
  const generalMatch = text.match(/(\d+)\s*(day|hour|min|sec)(?:ute)?(?:s)?/gi);
  if (generalMatch) {
    return generalMatch.join(' ');
  }

  return null;
}

/**
 * Analyze error text and categorize it
 *
 * @param {string} errorText - The error message or output to analyze
 * @param {number} exitCode - Optional exit code from CLI process
 * @returns {Object} - Error analysis result
 */
export function analyzeError(errorText, exitCode = null) {
  if (!errorText && exitCode === 0) {
    return {
      hasError: false,
      category: null,
      message: null,
      waitTime: null,
      requiresFallback: false,
      actionable: false,
      suggestedFix: null
    };
  }

  const text = String(errorText || '');

  // Check each pattern
  for (const errorPattern of ERROR_PATTERNS) {
    if (errorPattern.pattern.test(text)) {
      const result = {
        hasError: true,
        category: errorPattern.category,
        message: extractErrorMessage(text),
        waitTime: errorPattern.extractWaitTime ? extractWaitTime(text) : null,
        requiresFallback: errorPattern.requiresFallback,
        actionable: errorPattern.actionable,
        suggestedFix: errorPattern.suggestedFix
      };

      return result;
    }
  }

  // If we have an error but couldn't categorize it
  if (exitCode !== 0 && exitCode !== null) {
    return {
      hasError: true,
      category: ERROR_CATEGORIES.UNKNOWN,
      message: extractErrorMessage(text) || `Process exited with code ${exitCode}`,
      waitTime: null,
      requiresFallback: false,
      actionable: false,
      suggestedFix: null
    };
  }

  return {
    hasError: false,
    category: null,
    message: null,
    waitTime: null,
    requiresFallback: false,
    actionable: false,
    suggestedFix: null
  };
}

/**
 * Extract the most relevant error message from text
 * @param {string} text - Full error text
 * @returns {string} - Extracted error message
 */
function extractErrorMessage(text) {
  if (!text) return '';

  // Try to find common error message patterns
  const patterns = [
    /Error:\s*(.+?)(?:\n|$)/i,
    /error":\s*"([^"]+)"/i,
    /message":\s*"([^"]+)"/i,
    /failed:\s*(.+?)(?:\n|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Return first meaningful line
  const lines = text.split('\n').filter(line => line.trim());
  return lines[0]?.substring(0, 200) || text.substring(0, 200);
}

/**
 * Check if an HTTP status code indicates rate limiting
 * @param {number} statusCode - HTTP status code
 * @returns {boolean}
 */
export function isRateLimitStatus(statusCode) {
  return statusCode === 429;
}

/**
 * Check if an HTTP status code indicates auth error
 * @param {number} statusCode - HTTP status code
 * @returns {boolean}
 */
export function isAuthErrorStatus(statusCode) {
  return statusCode === 401 || statusCode === 403;
}

/**
 * Analyze an HTTP response for errors
 * @param {Object} response - HTTP response object with status and body
 * @returns {Object} - Error analysis result
 */
export function analyzeHttpError(response) {
  const { status, statusText, body } = response;

  if (status >= 200 && status < 300) {
    return {
      hasError: false,
      category: null,
      message: null,
      waitTime: null,
      requiresFallback: false,
      actionable: false,
      suggestedFix: null
    };
  }

  // Check status code first
  if (isRateLimitStatus(status)) {
    return {
      hasError: true,
      category: ERROR_CATEGORIES.RATE_LIMIT,
      message: `Rate limit exceeded (${status})`,
      waitTime: extractWaitTime(body),
      requiresFallback: false,
      actionable: false,
      suggestedFix: 'Wait and retry - temporary rate limiting'
    };
  }

  if (isAuthErrorStatus(status)) {
    return {
      hasError: true,
      category: ERROR_CATEGORIES.AUTH_ERROR,
      message: `Authentication failed (${status})`,
      waitTime: null,
      requiresFallback: true,
      actionable: true,
      suggestedFix: 'Check API key configuration for this provider'
    };
  }

  // Analyze body for more specific errors
  if (body) {
    return analyzeError(body);
  }

  return {
    hasError: true,
    category: ERROR_CATEGORIES.UNKNOWN,
    message: statusText || `HTTP ${status}`,
    waitTime: null,
    requiresFallback: false,
    actionable: false,
    suggestedFix: null
  };
}
