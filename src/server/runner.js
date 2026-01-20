import { mkdir, writeFile, readFile, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a runner service with configurable storage and hooks
 */
export function createRunnerService(config = {}) {
  const {
    dataDir = './data',
    runsDir = 'runs',
    screenshotsDir = './data/screenshots',
    providerService,
    hooks = {},
    maxConcurrentRuns = 5
  } = config;

  const RUNS_PATH = join(dataDir, runsDir);
  const activeRuns = new Map();

  async function ensureRunsDir() {
    if (!existsSync(RUNS_PATH)) {
      await mkdir(RUNS_PATH, { recursive: true });
    }
  }

  /**
   * Get MIME type from file extension
   */
  function getMimeType(filepath) {
    const ext = extname(filepath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/png';
  }

  /**
   * Load an image as base64 data URL
   */
  async function loadImageAsBase64(imagePath) {
    const fullPath = imagePath.startsWith('/') ? imagePath : join(screenshotsDir, imagePath);

    if (!existsSync(fullPath)) {
      throw new Error(`Image not found: ${fullPath}`);
    }

    const buffer = await readFile(fullPath);
    const mimeType = getMimeType(fullPath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Safe JSON parse with fallback
   */
  function safeJsonParse(str, fallback = {}) {
    if (typeof str !== 'string') {
      return fallback;
    }

    const parsed = JSON.parse(str);
    return parsed;
  }

  return {
    /**
     * Create a new run
     */
    async createRun(options) {
      const {
        providerId,
        model,
        prompt,
        workspacePath = process.cwd(),
        workspaceName = 'default',
        timeout,
        source = 'devtools'
      } = options;

      if (!providerService) {
        throw new Error('Provider service not configured');
      }

      const provider = await providerService.getProviderById(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      if (!provider.enabled) {
        throw new Error('Provider is disabled');
      }

      await ensureRunsDir();

      const runId = uuidv4();
      const runDir = join(RUNS_PATH, runId);
      await mkdir(runDir);

      const metadata = {
        id: runId,
        type: 'ai',
        providerId,
        providerName: provider.name,
        model: model || provider.defaultModel,
        workspacePath,
        workspaceName,
        source,
        prompt: prompt.substring(0, 500),
        startTime: new Date().toISOString(),
        endTime: null,
        duration: null,
        exitCode: null,
        success: null,
        error: null,
        outputSize: 0
      };

      await writeFile(join(runDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
      await writeFile(join(runDir, 'prompt.txt'), prompt);
      await writeFile(join(runDir, 'output.txt'), '');

      hooks.onRunCreated?.(metadata);

      const effectiveTimeout = timeout || provider.timeout;

      return { runId, runDir, provider, metadata, timeout: effectiveTimeout };
    },

    /**
     * Execute a CLI run
     */
    async executeCliRun(runId, provider, prompt, workspacePath, onData, onComplete, timeout) {
      const runDir = join(RUNS_PATH, runId);
      const outputPath = join(runDir, 'output.txt');
      const metadataPath = join(runDir, 'metadata.json');

      const startTime = Date.now();
      let output = '';

      // Build command with args
      const args = [...(provider.args || []), prompt];
      console.log(`🚀 Executing CLI: ${provider.command} ${provider.args?.join(' ') || ''}`);

      const childProcess = spawn(provider.command, args, {
        cwd: workspacePath,
        env: { ...process.env, ...provider.envVars },
        shell: true
      });

      activeRuns.set(runId, childProcess);
      hooks.onRunStarted?.({ runId, provider: provider.name, model: provider.defaultModel });

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        if (childProcess && !childProcess.killed) {
          console.log(`⏱️ Run ${runId} timed out after ${timeout}ms`);
          childProcess.kill('SIGTERM');
        }
      }, timeout);

      childProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        onData?.(text);
      });

      childProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        output += text;
        onData?.(text);
      });

      childProcess.on('close', async (code) => {
        clearTimeout(timeoutHandle);
        activeRuns.delete(runId);

        await writeFile(outputPath, output);

        const metadata = safeJsonParse(await readFile(metadataPath, 'utf-8').catch(() => '{}'));
        metadata.endTime = new Date().toISOString();
        metadata.duration = Date.now() - startTime;
        metadata.exitCode = code;
        metadata.success = code === 0;
        metadata.outputSize = Buffer.byteLength(output);

        if (!metadata.success) {
          metadata.error = `Process exited with code ${code}`;
        }

        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        if (metadata.success) {
          hooks.onRunCompleted?.(metadata, output);
        } else {
          hooks.onRunFailed?.(metadata, metadata.error, output);
        }

        onComplete?.(metadata);
      });

      return runId;
    },

    /**
     * Execute an API run
     */
    async executeApiRun(runId, provider, model, prompt, workspacePath, screenshots, onData, onComplete) {
      const runDir = join(RUNS_PATH, runId);
      const outputPath = join(runDir, 'output.txt');
      const metadataPath = join(runDir, 'metadata.json');

      const startTime = Date.now();
      let output = '';

      const headers = {
        'Content-Type': 'application/json'
      };
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const controller = new AbortController();
      activeRuns.set(runId, controller);

      hooks.onRunStarted?.({ runId, provider: provider.name, model });

      // Build message content
      let messageContent;
      if (screenshots && screenshots.length > 0) {
        console.log(`📸 Loading ${screenshots.length} screenshots for vision API`);
        const contentParts = [];

        for (const screenshotPath of screenshots) {
          const imageDataUrl = await loadImageAsBase64(screenshotPath).catch(err => {
            console.error(`❌ Failed to load screenshot ${screenshotPath}: ${err.message}`);
            return null;
          });
          if (imageDataUrl) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: imageDataUrl }
            });
          }
        }

        contentParts.push({ type: 'text', text: prompt });
        messageContent = contentParts;
      } else {
        messageContent = prompt;
      }

      const response = await fetch(`${provider.endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: model || provider.defaultModel,
          messages: [{ role: 'user', content: messageContent }],
          stream: true
        })
      }).catch(err => ({ ok: false, error: err.message }));

      if (!response.ok) {
        activeRuns.delete(runId);
        const metadata = safeJsonParse(await readFile(metadataPath, 'utf-8').catch(() => '{}'));
        metadata.endTime = new Date().toISOString();
        metadata.duration = Date.now() - startTime;
        metadata.success = false;

        const errorDetails = response.error || `API error: ${response.status}`;
        metadata.error = errorDetails;
        metadata.errorDetails = errorDetails;

        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        hooks.onRunFailed?.(metadata, errorDetails, '');
        onComplete?.(metadata);
        return runId;
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === '✅') continue;

            let parsed = null;
            parsed = JSON.parse(data);
            if (parsed?.choices?.[0]?.delta?.content) {
              const text = parsed.choices[0].delta.content;
              output += text;
              onData?.(text);
            }
          }
        }

        await writeFile(outputPath, output);
        activeRuns.delete(runId);

        const metadata = safeJsonParse(await readFile(metadataPath, 'utf-8').catch(() => '{}'));
        metadata.endTime = new Date().toISOString();
        metadata.duration = Date.now() - startTime;
        metadata.exitCode = 0;
        metadata.success = true;
        metadata.outputSize = Buffer.byteLength(output);
        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        hooks.onRunCompleted?.(metadata, output);
        onComplete?.(metadata);
      };

      processStream().catch(async (err) => {
        activeRuns.delete(runId);

        if (output) {
          await writeFile(outputPath, output).catch(() => {});
        }

        const metadata = safeJsonParse(await readFile(metadataPath, 'utf-8').catch(() => '{}'));
        metadata.endTime = new Date().toISOString();
        metadata.duration = Date.now() - startTime;
        metadata.success = false;
        metadata.error = err.message;
        metadata.outputSize = Buffer.byteLength(output);

        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        hooks.onRunFailed?.(metadata, err.message, output);
        onComplete?.(metadata);
      });

      return runId;
    },

    /**
     * Stop a running run
     */
    async stopRun(runId) {
      const active = activeRuns.get(runId);
      if (!active) return false;

      if (active.kill) {
        active.kill('SIGTERM');
      } else if (active.abort) {
        active.abort();
      }

      activeRuns.delete(runId);
      return true;
    },

    /**
     * Get run metadata
     */
    async getRun(runId) {
      const runDir = join(RUNS_PATH, runId);
      if (!existsSync(runDir)) return null;

      const metadata = safeJsonParse(await readFile(join(runDir, 'metadata.json'), 'utf-8').catch(() => '{}'));
      return metadata;
    },

    /**
     * Get run output
     */
    async getRunOutput(runId) {
      const runDir = join(RUNS_PATH, runId);
      if (!existsSync(runDir)) return null;

      return readFile(join(runDir, 'output.txt'), 'utf-8');
    },

    /**
     * Get run prompt
     */
    async getRunPrompt(runId) {
      const runDir = join(RUNS_PATH, runId);
      if (!existsSync(runDir)) return null;

      return readFile(join(runDir, 'prompt.txt'), 'utf-8');
    },

    /**
     * List runs
     */
    async listRuns(limit = 50, offset = 0, source = 'all') {
      await ensureRunsDir();

      const entries = await readdir(RUNS_PATH, { withFileTypes: true });
      const runIds = entries.filter(e => e.isDirectory()).map(e => e.name);

      const runs = [];
      for (const runId of runIds) {
        const metadataPath = join(RUNS_PATH, runId, 'metadata.json');
        if (existsSync(metadataPath)) {
          const metadata = safeJsonParse(await readFile(metadataPath, 'utf-8').catch(() => '{}'));
          if (metadata.id) runs.push(metadata);
        }
      }

      let filteredRuns = runs;
      if (source !== 'all') {
        filteredRuns = runs.filter(run => {
          const runSource = run.source || 'devtools';
          return runSource === source;
        });
      }

      filteredRuns.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      return {
        total: filteredRuns.length,
        runs: filteredRuns.slice(offset, offset + limit)
      };
    },

    /**
     * Delete a run
     */
    async deleteRun(runId) {
      const runDir = join(RUNS_PATH, runId);
      if (!existsSync(runDir)) return false;

      await rm(runDir, { recursive: true });
      return true;
    },

    /**
     * Delete all failed runs
     */
    async deleteFailedRuns() {
      await ensureRunsDir();

      const entries = await readdir(RUNS_PATH, { withFileTypes: true });
      const runIds = entries.filter(e => e.isDirectory()).map(e => e.name);

      let deletedCount = 0;
      for (const runId of runIds) {
        const metadataPath = join(RUNS_PATH, runId, 'metadata.json');
        if (existsSync(metadataPath)) {
          const metadata = safeJsonParse(await readFile(metadataPath, 'utf-8').catch(() => '{}'));
          if (metadata.success === false) {
            await rm(join(RUNS_PATH, runId), { recursive: true });
            deletedCount++;
          }
        }
      }

      return deletedCount;
    },

    /**
     * Check if a run is active
     */
    async isRunActive(runId) {
      return activeRuns.has(runId);
    }
  };
}
