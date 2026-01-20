/**
 * TypeScript declarations for @portos/ai-toolkit/server
 */

export interface ProviderService {
  getAllProviders(): Promise<{ activeProvider: string | null; providers: any[] }>;
  getProviderById(id: string): Promise<any | null>;
  getActiveProvider(): Promise<any | null>;
  setActiveProvider(id: string): Promise<any | null>;
  createProvider(data: any): Promise<any>;
  updateProvider(id: string, updates: any): Promise<any | null>;
  deleteProvider(id: string): Promise<boolean>;
  testProvider(id: string): Promise<{ success: boolean; [key: string]: any }>;
  refreshProviderModels(id: string): Promise<any | null>;
}

export interface RunnerService {
  createRun(options: any): Promise<any>;
  executeCliRun(...args: any[]): Promise<string>;
  executeApiRun(...args: any[]): Promise<string>;
  stopRun(runId: string): Promise<boolean>;
  getRun(runId: string): Promise<any | null>;
  getRunOutput(runId: string): Promise<string | null>;
  getRunPrompt(runId: string): Promise<string | null>;
  listRuns(limit?: number, offset?: number, source?: string): Promise<{ total: number; runs: any[] }>;
  deleteRun(runId: string): Promise<boolean>;
  deleteFailedRuns(): Promise<number>;
  isRunActive(runId: string): Promise<boolean>;
}

export interface PromptsService {
  init(): Promise<void>;
  getStages(): Record<string, any>;
  getStage(name: string): any | null;
  getStageTemplate(name: string): Promise<string | null>;
  updateStageTemplate(name: string, content: string): Promise<void>;
  updateStageConfig(name: string, config: any): Promise<void>;
  createStage(stageName: string, config: any, template?: string): Promise<void>;
  deleteStage(stageName: string): Promise<void>;
  getVariables(): Record<string, any>;
  getVariable(key: string): any | null;
  updateVariable(key: string, data: any): Promise<void>;
  createVariable(key: string, data: any): Promise<void>;
  deleteVariable(key: string): Promise<void>;
  buildPrompt(stageName: string, data?: any): Promise<string>;
  previewPrompt(stageName: string, testData?: any): Promise<string>;
}

export interface AIToolkit {
  services: {
    providers: ProviderService;
    runner: RunnerService;
    prompts: PromptsService;
  };
  routes: {
    providers: any;
    runs: any;
    prompts: any;
  };
  mountRoutes(app: any, basePath?: string): void;
}

export interface AIToolkitConfig {
  dataDir?: string;
  providersFile?: string;
  runsDir?: string;
  promptsDir?: string;
  screenshotsDir?: string;
  sampleProvidersFile?: string;
  io?: any;
  asyncHandler?: (fn: any) => any;
  hooks?: {
    onRunCreated?: (metadata: any) => void;
    onRunStarted?: (run: any) => void;
    onRunCompleted?: (metadata: any, output: string) => void;
    onRunFailed?: (metadata: any, error: string, output: string) => void;
  };
  maxConcurrentRuns?: number;
}

export function createAIToolkit(config?: AIToolkitConfig): AIToolkit;
export function createProviderService(config?: Partial<AIToolkitConfig>): ProviderService;
export function createRunnerService(config?: Partial<AIToolkitConfig>): RunnerService;
export function createPromptsService(config?: Partial<AIToolkitConfig>): PromptsService;
export function createProvidersRoutes(service: ProviderService, options?: any): any;
export function createRunsRoutes(service: RunnerService, options?: any): any;
export function createPromptsRoutes(service: PromptsService, options?: any): any;
