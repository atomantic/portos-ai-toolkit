/**
 * AI Toolkit Server
 * Configurable AI provider, runner, and prompt services with Express routes
 */

import { createProviderService } from './providers.js';
import { createRunnerService } from './runner.js';
import { createPromptsService } from './prompts.js';
import { createProviderStatusService } from './providerStatus.js';
import { createProvidersRoutes } from './routes/providers.js';
import { createRunsRoutes } from './routes/runs.js';
import { createPromptsRoutes } from './routes/prompts.js';
import { createProviderStatusRoutes } from './routes/providerStatus.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Path to the default providers sample file included with the toolkit.
 * Use this as the sampleProvidersFile config option to get preconfigured providers:
 * - claude-code (CLI)
 * - codex (CLI)
 * - gemini-cli (CLI)
 * - nvidia-kimi (API - NVIDIA's free Kimi K2.5 models)
 * - lmstudio (API)
 * - ollama (API)
 */
export const DEFAULT_PROVIDERS_SAMPLE = join(__dirname, 'defaults/providers.sample.json');

export * from './validation.js';
export * from './errorDetection.js';
export { createProviderService, createRunnerService, createPromptsService, createProviderStatusService };
export { createProvidersRoutes, createRunsRoutes, createPromptsRoutes, createProviderStatusRoutes };

/**
 * Create a complete AI toolkit instance with services and routes
 */
export function createAIToolkit(config = {}) {
  const {
    dataDir = './data',
    providersFile = 'providers.json',
    statusFile = 'provider-status.json',
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
    maxConcurrentRuns = 5,

    // Provider status config
    enableProviderStatus = true,
    defaultFallbackPriority = ['claude-code', 'codex', 'nvidia-kimi', 'lmstudio', 'ollama', 'gemini-cli']
  } = config;

  // Create services
  const providerService = createProviderService({
    dataDir,
    providersFile,
    sampleFile: sampleProvidersFile
  });

  // Create provider status service if enabled
  let providerStatusService = null;
  if (enableProviderStatus) {
    providerStatusService = createProviderStatusService({
      dataDir,
      statusFile,
      defaultFallbackPriority,
      onStatusChange: (eventData) => {
        // Emit Socket.IO event if io is configured
        io?.emit('provider:status:changed', eventData);
      }
    });

    // Initialize status service
    providerStatusService.init().catch(err => {
      console.error(`❌ Failed to initialize provider status: ${err.message}`);
    });
  }

  const runnerService = createRunnerService({
    dataDir,
    runsDir,
    screenshotsDir,
    providerService,
    providerStatusService,
    hooks: {
      ...hooks,
      // Add hook to emit provider error events
      onProviderError: (providerId, errorAnalysis, output) => {
        io?.emit('provider:error', { providerId, errorAnalysis });
        hooks.onProviderError?.(providerId, errorAnalysis, output);
      }
    },
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

  // Create provider status routes if enabled
  let providerStatusRouter = null;
  if (providerStatusService) {
    providerStatusRouter = createProviderStatusRoutes(providerStatusService, { asyncHandler });
  }

  return {
    // Services
    services: {
      providers: providerService,
      runner: runnerService,
      prompts: promptsService,
      providerStatus: providerStatusService
    },

    // Routes
    routes: {
      providers: providersRouter,
      runs: runsRouter,
      prompts: promptsRouter,
      providerStatus: providerStatusRouter
    },

    // Convenience method to mount all routes
    mountRoutes(app, basePath = '/api') {
      app.use(`${basePath}/providers`, providersRouter);
      app.use(`${basePath}/runs`, runsRouter);
      app.use(`${basePath}/prompts`, promptsRouter);
      if (providerStatusRouter) {
        app.use(`${basePath}/providers/status`, providerStatusRouter);
      }
    }
  };
}
