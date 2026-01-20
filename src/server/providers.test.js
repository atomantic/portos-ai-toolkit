import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createProviderService } from './providers.js';

const TEST_DATA_DIR = join(process.cwd(), 'test-data');

describe('Provider Service', () => {
  let providerService;

  beforeEach(async () => {
    // Create test data directory
    if (!existsSync(TEST_DATA_DIR)) {
      await mkdir(TEST_DATA_DIR, { recursive: true });
    }

    providerService = createProviderService({
      dataDir: TEST_DATA_DIR,
      providersFile: 'providers.json'
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (existsSync(TEST_DATA_DIR)) {
      await rm(TEST_DATA_DIR, { recursive: true });
    }
  });

  it('should create a provider', async () => {
    const provider = await providerService.createProvider({
      name: 'Test Provider',
      type: 'cli',
      command: 'test',
      args: ['--version']
    });

    expect(provider).toBeDefined();
    expect(provider.id).toBe('test-provider');
    expect(provider.name).toBe('Test Provider');
    expect(provider.type).toBe('cli');
  });

  it('should get all providers', async () => {
    await providerService.createProvider({
      name: 'Test Provider 1',
      type: 'cli',
      command: 'test1'
    });

    await providerService.createProvider({
      name: 'Test Provider 2',
      type: 'api',
      endpoint: 'https://api.example.com'
    });

    const { providers } = await providerService.getAllProviders();
    expect(providers).toHaveLength(2);
  });

  it('should set active provider', async () => {
    const newProvider = await providerService.createProvider({
      name: 'Test Provider',
      type: 'cli',
      command: 'test'
    });

    const active = await providerService.setActiveProvider(newProvider.id);
    expect(active).toBeDefined();
    expect(active.id).toBe(newProvider.id);

    const activeProvider = await providerService.getActiveProvider();
    expect(activeProvider.id).toBe(newProvider.id);
  });

  it('should update a provider', async () => {
    const newProvider = await providerService.createProvider({
      name: 'Test Provider',
      type: 'cli',
      command: 'test'
    });

    const updated = await providerService.updateProvider(newProvider.id, {
      command: 'updated-test'
    });

    expect(updated.command).toBe('updated-test');
  });

  it('should delete a provider', async () => {
    const newProvider = await providerService.createProvider({
      name: 'Test Provider',
      type: 'cli',
      command: 'test'
    });

    const deleted = await providerService.deleteProvider(newProvider.id);
    expect(deleted).toBe(true);

    const retrieved = await providerService.getProviderById(newProvider.id);
    expect(retrieved).toBeNull();
  });

  it('should throw error for duplicate provider', async () => {
    await providerService.createProvider({
      name: 'Test Provider',
      type: 'cli',
      command: 'test'
    });

    await expect(
      providerService.createProvider({
        name: 'Test Provider',
        type: 'cli',
        command: 'test'
      })
    ).rejects.toThrow('Provider with this ID already exists');
  });
});
