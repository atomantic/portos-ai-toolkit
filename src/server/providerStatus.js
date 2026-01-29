/**
 * Provider Status Service
 *
 * Tracks provider availability status, usage limits, and provides
 * fallback provider selection when the primary provider is unavailable.
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Create a provider status service with configurable storage
 */
export function createProviderStatusService(config = {}) {
  const {
    dataDir = './data',
    statusFile = 'provider-status.json',
    // Default fallback priority order
    defaultFallbackPriority = ['claude-code', 'codex', 'lmstudio', 'local-lm-studio', 'ollama', 'gemini-cli'],
    // Default wait times
    defaultUsageLimitWait = 24 * 60 * 60 * 1000, // 24 hours
    defaultRateLimitWait = 5 * 60 * 1000, // 5 minutes
    // Hook for when status changes (e.g., emit Socket.IO events)
    onStatusChange = null
  } = config;

  const STATUS_PATH = join(dataDir, statusFile);
  const events = new EventEmitter();

  // In-memory status cache
  let statusCache = {
    providers: {},
    lastUpdated: null
  };

  /**
   * Load status from disk
   */
  async function loadStatus() {
    if (!existsSync(STATUS_PATH)) {
      return { providers: {}, lastUpdated: null };
    }
    const content = await readFile(STATUS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed || { providers: {}, lastUpdated: null };
  }

  /**
   * Save status to disk
   */
  async function saveStatus(status) {
    const dir = dirname(STATUS_PATH);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    status.lastUpdated = new Date().toISOString();
    await writeFile(STATUS_PATH, JSON.stringify(status, null, 2));
    statusCache = status;
  }

  /**
   * Parse wait time string to milliseconds
   * e.g., "1 day 1 hour 33 minutes" -> 91980000
   */
  function parseWaitTime(waitTimeStr) {
    if (!waitTimeStr) return null;

    let totalMs = 0;
    const dayMatch = waitTimeStr.match(/(\d+)\s*day/i);
    const hourMatch = waitTimeStr.match(/(\d+)\s*hour/i);
    const minMatch = waitTimeStr.match(/(\d+)\s*min/i);
    const secMatch = waitTimeStr.match(/(\d+)\s*sec/i);

    if (dayMatch) totalMs += parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000;
    if (hourMatch) totalMs += parseInt(hourMatch[1]) * 60 * 60 * 1000;
    if (minMatch) totalMs += parseInt(minMatch[1]) * 60 * 1000;
    if (secMatch) totalMs += parseInt(secMatch[1]) * 1000;

    return totalMs || null;
  }

  /**
   * Format milliseconds as human-readable time
   */
  function formatTimeRemaining(ms) {
    if (ms <= 0) return 'any moment';

    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '< 1m';
  }

  /**
   * Emit status change event
   */
  function emitStatusChange(providerId, status, type) {
    const eventData = { providerId, status, type };
    events.emit('status:changed', eventData);
    onStatusChange?.(eventData);
  }

  return {
    events,

    /**
     * Initialize status cache and clean up stale statuses
     */
    async init() {
      statusCache = await loadStatus().catch(() => ({ providers: {}, lastUpdated: null }));

      // Clean up stale statuses (recovery time passed)
      const now = Date.now();
      let changed = false;
      for (const [providerId, status] of Object.entries(statusCache.providers)) {
        if (status.estimatedRecovery) {
          const recoveryTime = new Date(status.estimatedRecovery).getTime();
          if (now > recoveryTime) {
            // Recovery time passed, mark as available
            statusCache.providers[providerId] = {
              available: true,
              reason: 'ok',
              message: 'Provider available',
              lastChecked: new Date().toISOString()
            };
            changed = true;
          }
        }
      }

      if (changed) {
        await saveStatus(statusCache);
      }

      return statusCache;
    },

    /**
     * Get status for a specific provider
     */
    getStatus(providerId) {
      return statusCache.providers[providerId] || {
        available: true,
        reason: 'ok',
        message: 'Provider available',
        lastChecked: new Date().toISOString()
      };
    },

    /**
     * Get all provider statuses
     */
    getAllStatuses() {
      return { ...statusCache };
    },

    /**
     * Check if a provider is available
     */
    isAvailable(providerId) {
      const status = this.getStatus(providerId);
      return status.available;
    },

    /**
     * Mark a provider as unavailable due to usage limit
     */
    async markUsageLimit(providerId, errorInfo = {}) {
      const now = new Date();
      const waitTimeMs = parseWaitTime(errorInfo.waitTime) || defaultUsageLimitWait;
      const estimatedRecovery = new Date(now.getTime() + waitTimeMs).toISOString();

      const previousStatus = statusCache.providers[providerId];
      const failureCount = (previousStatus?.failureCount || 0) + 1;

      statusCache.providers[providerId] = {
        available: false,
        reason: 'usage-limit',
        message: errorInfo.message || 'Usage limit exceeded',
        waitTime: errorInfo.waitTime || null,
        unavailableSince: now.toISOString(),
        estimatedRecovery,
        failureCount,
        lastChecked: now.toISOString()
      };

      await saveStatus(statusCache);
      emitStatusChange(providerId, statusCache.providers[providerId], 'usage-limit');

      return statusCache.providers[providerId];
    },

    /**
     * Mark a provider as unavailable due to rate limiting (temporary)
     */
    async markRateLimited(providerId) {
      const now = new Date();
      const estimatedRecovery = new Date(now.getTime() + defaultRateLimitWait).toISOString();

      const previousStatus = statusCache.providers[providerId];
      const failureCount = (previousStatus?.failureCount || 0) + 1;

      statusCache.providers[providerId] = {
        available: false,
        reason: 'rate-limit',
        message: 'Rate limit exceeded - temporary',
        unavailableSince: now.toISOString(),
        estimatedRecovery,
        failureCount,
        lastChecked: now.toISOString()
      };

      await saveStatus(statusCache);
      emitStatusChange(providerId, statusCache.providers[providerId], 'rate-limit');

      return statusCache.providers[providerId];
    },

    /**
     * Mark a provider as available (recovered)
     */
    async markAvailable(providerId) {
      statusCache.providers[providerId] = {
        available: true,
        reason: 'ok',
        message: 'Provider available',
        failureCount: 0,
        lastChecked: new Date().toISOString()
      };

      await saveStatus(statusCache);
      emitStatusChange(providerId, statusCache.providers[providerId], 'recovered');

      return statusCache.providers[providerId];
    },

    /**
     * Get the best available fallback provider
     *
     * Priority order:
     * 1. Task-level fallback (taskFallbackId parameter)
     * 2. Provider-level fallback (provider.fallbackProvider)
     * 3. System default priority list
     *
     * @param {string} primaryProviderId - The primary provider that's unavailable
     * @param {Object} providers - Object of all providers by ID
     * @param {string} taskFallbackId - Optional task-level fallback provider ID
     * @returns {{ provider: Object, source: string } | null}
     */
    getFallbackProvider(primaryProviderId, providers, taskFallbackId = null) {
      // 1. Check task-level fallback first (highest priority)
      if (taskFallbackId && taskFallbackId !== primaryProviderId) {
        const taskFallback = providers[taskFallbackId];
        if (taskFallback?.enabled && this.isAvailable(taskFallback.id)) {
          return { provider: taskFallback, source: 'task' };
        }
      }

      // 2. Check provider's configured fallback
      const primaryProvider = providers[primaryProviderId];
      if (primaryProvider?.fallbackProvider) {
        const configuredFallback = providers[primaryProvider.fallbackProvider];
        if (configuredFallback?.enabled && this.isAvailable(configuredFallback.id)) {
          return { provider: configuredFallback, source: 'provider' };
        }
      }

      // 3. Try fallback priority list
      for (const providerId of defaultFallbackPriority) {
        if (providerId === primaryProviderId) continue;

        const provider = providers[providerId];
        if (provider?.enabled && this.isAvailable(providerId)) {
          return { provider, source: 'system' };
        }
      }

      return null;
    },

    /**
     * Get human-readable time until provider recovery
     */
    getTimeUntilRecovery(providerId) {
      const status = this.getStatus(providerId);
      if (status.available || !status.estimatedRecovery) return null;

      const now = Date.now();
      const recoveryTime = new Date(status.estimatedRecovery).getTime();
      const remainingMs = recoveryTime - now;

      return formatTimeRemaining(remainingMs);
    },

    /**
     * Utility: parse wait time string to milliseconds
     */
    parseWaitTime,

    /**
     * Utility: format milliseconds as human-readable time
     */
    formatTimeRemaining
  };
}
