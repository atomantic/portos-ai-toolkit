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
        // Model tiers for intelligent task routing
        lightModel: providerData.lightModel || null,
        mediumModel: providerData.mediumModel || null,
        heavyModel: providerData.heavyModel || null,
        // Fallback provider when this one hits usage limits
        fallbackProvider: providerData.fallbackProvider || null,
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
     * Refresh models from provider using provider-specific strategies
     */
    async refreshProviderModels(id) {
      const data = await loadProviders();
      const provider = data.providers[id];

      if (!provider) {
        return null;
      }

      let models = [];

      try {
        // Provider-specific refresh strategies
        if (provider.type === 'api') {
          models = await this._refreshAPIProviderModels(provider);
        } else if (provider.type === 'cli') {
          models = await this._refreshCLIProviderModels(provider);
        }
      } catch (error) {
        console.error(`Failed to refresh models for ${provider.name}:`, error.message);
        return null;
      }

      if (!models || models.length === 0) {
        return null;
      }

      const updatedProvider = {
        ...data.providers[id],
        models
      };

      data.providers[id] = updatedProvider;
      await saveProviders(data);
      return updatedProvider;
    },

    /**
     * Refresh models from API providers
     * Supports OpenAI-compatible endpoints (OpenAI, LM Studio, etc.)
     * and Ollama-style endpoints
     */
    async _refreshAPIProviderModels(provider) {
      // Try Ollama format first if endpoint suggests it
      if (provider.endpoint?.includes('ollama') || provider.endpoint?.includes(':11434')) {
        const ollamaUrl = `${provider.endpoint}/api/tags`;
        const response = await fetch(ollamaUrl).catch(() => null);

        if (response?.ok) {
          const data = await response.json().catch(() => null);
          if (data?.models) {
            return data.models.map(m => m.name || m.model);
          }
        }
      }

      // Try OpenAI-compatible format (default)
      const modelsUrl = `${provider.endpoint}/models`;
      const headers = {};

      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const response = await fetch(modelsUrl, { headers }).catch(() => null);

      if (!response?.ok) {
        throw new Error(`HTTP ${response?.status || 'error'}`);
      }

      const responseData = await response.json().catch(() => ({ data: [] }));

      // OpenAI format: { data: [{ id: "model-name" }] }
      if (responseData.data && Array.isArray(responseData.data)) {
        return responseData.data.map(m => m.id);
      }

      // Alternative format: { models: ["model-name"] }
      if (responseData.models && Array.isArray(responseData.models)) {
        return responseData.models;
      }

      return [];
    },

    /**
     * Refresh models from CLI providers using provider-specific APIs
     */
    async _refreshCLIProviderModels(provider) {
      const providerName = provider.name.toLowerCase();

      // Claude/Anthropic - fetch from Anthropic API
      if (providerName.includes('claude') || provider.command === 'claude') {
        return await this._fetchAnthropicModels(provider);
      }

      // Gemini - fetch from Google AI API
      if (providerName.includes('gemini') || provider.command === 'gemini') {
        return await this._fetchGeminiModels(provider);
      }

      // For other CLI providers, we can't refresh models
      throw new Error('Model refresh not supported for this CLI provider');
    },

    /**
     * Fetch available Claude models from Anthropic API
     */
    async _fetchAnthropicModels(provider) {
      // Check for API key in provider or environment
      const apiKey = provider.apiKey || process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        throw new Error('Anthropic API key required for model refresh');
      }

      // Known Claude models as of January 2025
      // Anthropic doesn't have a public models list endpoint yet
      return [
        'claude-opus-4-6',
        'claude-opus-4',
        'claude-sonnet-4-6',
        'claude-sonnet-4',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ];
    },

    /**
     * Fetch available Gemini models from Google AI API
     */
    async _fetchGeminiModels(provider) {
      const apiKey = provider.apiKey || process.env.GOOGLE_API_KEY;

      if (!apiKey) {
        throw new Error('Google API key required for model refresh');
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      ).catch(() => null);

      if (!response?.ok) {
        throw new Error(`HTTP ${response?.status || 'error'}`);
      }

      const data = await response.json().catch(() => ({ models: [] }));

      // Filter to only generative models
      return (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
    }
  };
}
