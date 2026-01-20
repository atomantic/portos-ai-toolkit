import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing AI runs
 */
export function useRuns(apiClient, options = {}) {
  const { autoLoad = true, limit = 50, offset = 0, source = 'all' } = options;

  const [runs, setRuns] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadRuns = useCallback(async () => {
    if (!apiClient) {
      setError('API client not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    const data = await apiClient.runs.list(limit, offset, source).catch(err => {
      setError(err.message);
      return { runs: [], total: 0 };
    });

    setRuns(data.runs || []);
    setTotal(data.total || 0);
    setIsLoading(false);
  }, [apiClient, limit, offset, source]);

  const createRun = useCallback(async (data) => {
    if (!apiClient) return null;

    const result = await apiClient.runs.create(data);
    await loadRuns();
    return result;
  }, [apiClient, loadRuns]);

  const stopRun = useCallback(async (id) => {
    if (!apiClient) return;

    await apiClient.runs.stop(id);
    await loadRuns();
  }, [apiClient, loadRuns]);

  const deleteRun = useCallback(async (id) => {
    if (!apiClient) return;

    await apiClient.runs.delete(id);
    await loadRuns();
  }, [apiClient, loadRuns]);

  const deleteFailedRuns = useCallback(async () => {
    if (!apiClient) return;

    const result = await apiClient.runs.deleteFailedRuns();
    await loadRuns();
    return result;
  }, [apiClient, loadRuns]);

  const getRunOutput = useCallback(async (id) => {
    if (!apiClient) return null;

    return apiClient.runs.getOutput(id);
  }, [apiClient]);

  const getRunPrompt = useCallback(async (id) => {
    if (!apiClient) return null;

    return apiClient.runs.getPrompt(id);
  }, [apiClient]);

  useEffect(() => {
    if (autoLoad) {
      loadRuns();
    }
  }, [autoLoad, loadRuns]);

  return {
    runs,
    total,
    isLoading,
    error,
    refetch: loadRuns,
    createRun,
    stopRun,
    deleteRun,
    deleteFailedRuns,
    getRunOutput,
    getRunPrompt
  };
}
