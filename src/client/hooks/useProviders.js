import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing AI providers
 */
export function useProviders(apiClient, options = {}) {
  const { autoLoad = true } = options;

  const [providers, setProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProviders = useCallback(async () => {
    if (!apiClient) {
      setError('API client not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    const data = await apiClient.providers.getAll().catch(err => {
      setError(err.message);
      return { providers: [], activeProvider: null };
    });

    setProviders(data.providers || []);
    setActiveProvider(data.activeProvider);
    setIsLoading(false);
  }, [apiClient]);

  const setActive = useCallback(async (id) => {
    if (!apiClient) return;

    await apiClient.providers.setActive(id);
    setActiveProvider(id);
  }, [apiClient]);

  const createProvider = useCallback(async (data) => {
    if (!apiClient) return null;

    const provider = await apiClient.providers.create(data);
    await loadProviders();
    return provider;
  }, [apiClient, loadProviders]);

  const updateProvider = useCallback(async (id, data) => {
    if (!apiClient) return null;

    const provider = await apiClient.providers.update(id, data);
    await loadProviders();
    return provider;
  }, [apiClient, loadProviders]);

  const deleteProvider = useCallback(async (id) => {
    if (!apiClient) return;

    await apiClient.providers.delete(id);
    await loadProviders();
  }, [apiClient, loadProviders]);

  const testProvider = useCallback(async (id) => {
    if (!apiClient) return null;

    return apiClient.providers.test(id);
  }, [apiClient]);

  const refreshModels = useCallback(async (id) => {
    if (!apiClient) return null;

    const provider = await apiClient.providers.refreshModels(id);
    await loadProviders();
    return provider;
  }, [apiClient, loadProviders]);

  useEffect(() => {
    if (autoLoad) {
      loadProviders();
    }
  }, [autoLoad, loadProviders]);

  return {
    providers,
    activeProvider,
    isLoading,
    error,
    refetch: loadProviders,
    setActive,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
    refreshModels
  };
}
