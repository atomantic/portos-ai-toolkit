import { Router } from 'express';

/**
 * Create provider status routes
 */
export function createProviderStatusRoutes(providerStatusService, options = {}) {
  const router = Router();
  const { asyncHandler = (fn) => fn } = options;

  // GET /providers/status - Get all provider statuses
  router.get('/', asyncHandler(async (req, res) => {
    const statuses = providerStatusService.getAllStatuses();
    res.json(statuses);
  }));

  // GET /providers/status/:id - Get status for specific provider
  router.get('/:id', asyncHandler(async (req, res) => {
    const status = providerStatusService.getStatus(req.params.id);
    const timeUntilRecovery = providerStatusService.getTimeUntilRecovery(req.params.id);

    res.json({
      ...status,
      timeUntilRecovery
    });
  }));

  // POST /providers/status/:id/recover - Manually mark provider as available
  router.post('/:id/recover', asyncHandler(async (req, res) => {
    const status = await providerStatusService.markAvailable(req.params.id);
    res.json(status);
  }));

  // POST /providers/status/:id/usage-limit - Mark provider as having hit usage limit
  router.post('/:id/usage-limit', asyncHandler(async (req, res) => {
    const { message, waitTime } = req.body;
    const status = await providerStatusService.markUsageLimit(req.params.id, {
      message,
      waitTime
    });
    res.json(status);
  }));

  // POST /providers/status/:id/rate-limit - Mark provider as rate limited
  router.post('/:id/rate-limit', asyncHandler(async (req, res) => {
    const status = await providerStatusService.markRateLimited(req.params.id);
    res.json(status);
  }));

  return router;
}
