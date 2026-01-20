/**
 * AI Toolkit Server
 * Configurable AI provider, runner, and prompt services with Express routes
 */

import { createProviderService } from './providers.js';
import { createRunnerService } from './runner.js';
import { createPromptsService } from './prompts.js';
import { createProvidersRoutes } from './routes/providers.js';
import { createRunsRoutes } from './routes/runs.js';
import { createPromptsRoutes } from './routes/prompts.js';

export * from './validation.js';
export { createProviderService, createRunnerService, createPromptsService };
export { createProvidersRoutes, createRunsRoutes, createPromptsRoutes };

/**
 * Create a complete AI toolkit instance with services and routes
 */
export function createAIToolkit(config = {}) {
  const {
    dataDir = './data',
    providersFile = 'providers.json',
    runsDir = 'runs',
    promptsDir = 'prompts',
    screenshotsDir = './data/screenshots',
    sampleProvidersFile = null,

    // Socket.IO instance for real-time updates
    io = null,

    // Optional async handler wrapper (e.g., for error handling)
    asyncHandler = (fn) => fn,

    // Hooks for lifecycle events
    hooks = {},

    // Runner config
    maxConcurrentRuns = 5
  } = config;

  // Create services
  const providerService = createProviderService({
    dataDir,
    providersFile,
    sampleFile: sampleProvidersFile
  });

  const runnerService = createRunnerService({
    dataDir,
    runsDir,
    screenshotsDir,
    providerService,
    hooks,
    maxConcurrentRuns
  });

  const promptsService = createPromptsService({
    dataDir,
    promptsDir
  });

  // Initialize prompts service
  promptsService.init().catch(err => {
    console.error(`❌ Failed to initialize prompts: ${err.message}`);
  });

  // Create routes
  const providersRouter = createProvidersRoutes(providerService, { asyncHandler });
  const runsRouter = createRunsRoutes(runnerService, { asyncHandler, io });
  const promptsRouter = createPromptsRoutes(promptsService, { asyncHandler });

  return {
    // Services
    services: {
      providers: providerService,
      runner: runnerService,
      prompts: promptsService
    },

    // Routes
    routes: {
      providers: providersRouter,
      runs: runsRouter,
      prompts: promptsRouter
    },

    // Convenience method to mount all routes
    mountRoutes(app, basePath = '/api') {
      app.use(`${basePath}/providers`, providersRouter);
      app.use(`${basePath}/runs`, runsRouter);
      app.use(`${basePath}/prompts`, promptsRouter);
    }
  };
}
