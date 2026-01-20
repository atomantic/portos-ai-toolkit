import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Create a provider service with configurable storage
 */
export function createProviderService(config = {}) {
  const {
    dataDir = './data',
    providersFile = 'providers.json',
    sampleFile = null
  } = config;

  const PROVIDERS_PATH = join(dataDir, providersFile);

  async function ensureDataDir() {
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }
  }

  async function loadProviders() {
    await ensureDataDir();

    if (!existsSync(PROVIDERS_PATH)) {
      // Copy from sample if exists
      if (sampleFile && existsSync(sampleFile)) {
        const sample = await readFile(sampleFile, 'utf-8');
        await writeFile(PROVIDERS_PATH, sample);
        return JSON.parse(sample);
      }
      return { activeProvider: null, providers: {} };
    }

    const content = await readFile(PROVIDERS_PATH, 'utf-8');
    return JSON.parse(content);
  }

  async function saveProviders(data) {
    await ensureDataDir();
    await writeFile(PROVIDERS_PATH, JSON.stringify(data, null, 2));
  }

  return {
    /**
     * Get all providers with active provider info
     */
    async getAllProviders() {
      const data = await loadProviders();
      return {
        activeProvider: data.activeProvider,
        providers: Object.values(data.providers)
      };
    },

    /**
     * Get a specific provider by ID
     */
    async getProviderById(id) {
      const data = await loadProviders();
      return data.providers[id] || null;
    },

    /**
     * Get the currently active provider
     */
    async getActiveProvider() {
      const data = await loadProviders();
      if (!data.activeProvider) return null;
      return data.providers[data.activeProvider] || null;
    },

    /**
     * Set the active provider
     */
    async setActiveProvider(id) {
      const data = await loadProviders();
      if (!data.providers[id]) {
        return null;
      }
      data.activeProvider = id;
      await saveProviders(data);
      return data.providers[id];
    },

    /**
     * Create a new provider
     */
    async createProvider(providerData) {
      const data = await loadProviders();
      const id = providerData.id || providerData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      if (data.providers[id]) {
        throw new Error('Provider with this ID already exists');
      }

      const provider = {
        id,
        name: providerData.name,
        type: providerData.type || 'cli',
        command: providerData.command || null,
        args: providerData.args || [],
        endpoint: providerData.endpoint || null,
        apiKey: providerData.apiKey || '',
        models: providerData.models || [],
        defaultModel: providerData.defaultModel || null,
        timeout: providerData.timeout || 300000,
        enabled: providerData.enabled !== false,
        envVars: providerData.envVars || {}
      };

      data.providers[id] = provider;

      // Set as active if it's the first provider
      if (!data.activeProvider) {
        data.activeProvider = id;
      }

      await saveProviders(data);
      return provider;
    },

    /**
     * Update an existing provider
     */
    async updateProvider(id, updates) {
      const data = await loadProviders();

      if (!data.providers[id]) {
        return null;
      }

      const provider = {
        ...data.providers[id],
        ...updates,
        id // Prevent ID override
      };

      data.providers[id] = provider;
      await saveProviders(data);
      return provider;
    },

    /**
     * Delete a provider
     */
    async deleteProvider(id) {
      const data = await loadProviders();

      if (!data.providers[id]) {
        return false;
      }

      delete data.providers[id];

      // Clear active if it was deleted
      if (data.activeProvider === id) {
        const remaining = Object.keys(data.providers);
        data.activeProvider = remaining.length > 0 ? remaining[0] : null;
      }

      await saveProviders(data);
      return true;
    },

    /**
     * Test provider connectivity
     */
    async testProvider(id) {
      const data = await loadProviders();
      const provider = data.providers[id];

      if (!provider) {
        return { success: false, error: 'Provider not found' };
      }

      if (provider.type === 'cli') {
        // Test CLI availability
        const { stdout, stderr } = await execAsync(`which ${provider.command}`).catch(() => ({ stdout: '', stderr: 'not found' }));

        if (!stdout.trim()) {
          return { success: false, error: `Command '${provider.command}' not found in PATH` };
        }

        // Try to get version or help
        const { stdout: versionOut } = await execAsync(`${provider.command} --version 2>/dev/null || ${provider.command} -v 2>/dev/null || echo "available"`).catch(() => ({ stdout: 'available' }));

        return {
          success: true,
          path: stdout.trim(),
          version: versionOut.trim()
        };
      }

      if (provider.type === 'api') {
        // Test API endpoint
        const modelsUrl = `${provider.endpoint}/models`;
        const response = await fetch(modelsUrl, {
          headers: provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : {}
        }).catch(err => ({ ok: false, error: err.message }));

        if (!response.ok) {
          return { success: false, error: `API not reachable: ${response.error || response.status}` };
        }

        const models = await response.json().catch(() => ({ data: [] }));
        return {
          success: true,
          endpoint: provider.endpoint,
          models: models.data?.map(m => m.id) || []
        };
      }

      return { success: false, error: 'Unknown provider type' };
    },

    /**
     * Refresh models from API provider
     */
    async refreshProviderModels(id) {
      const data = await loadProviders();
      const provider = data.providers[id];

      if (!provider || provider.type !== 'api') {
        return null;
      }

      const modelsUrl = `${provider.endpoint}/models`;
      const response = await fetch(modelsUrl, {
        headers: provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : {}
      }).catch(() => null);

      if (!response?.ok) return null;

      const responseData = await response.json().catch(() => ({ data: [] }));
      const models = responseData.data?.map(m => m.id) || [];

      const updatedProvider = {
        ...data.providers[id],
        models
      };

      data.providers[id] = updatedProvider;
      await saveProviders(data);
      return updatedProvider;
    }
  };
}
