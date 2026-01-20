/**
 * API Client for AI Toolkit
 * Configurable API requests for providers and runs
 */

/**
 * Create an API client with configurable base URL and error handler
 */
export function createApiClient(config = {}) {
  const {
    baseUrl = '/api',
    onError = (error) => console.error(error)
  } = config;

  async function request(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
    const requestConfig = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, requestConfig);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      const errorMessage = error.error || `HTTP ${response.status}`;
      onError(errorMessage);
      throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Handle text/plain responses
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/plain')) {
      return response.text();
    }

    return response.json();
  }

  return {
    // Providers
    providers: {
      getAll: () => request('/providers'),
      getActive: () => request('/providers/active'),
      setActive: (id) => request('/providers/active', {
        method: 'PUT',
        body: JSON.stringify({ id })
      }),
      getById: (id) => request(`/providers/${id}`),
      create: (data) => request('/providers', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      update: (id, data) => request(`/providers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
      delete: (id) => request(`/providers/${id}`, {
        method: 'DELETE'
      }),
      test: (id) => request(`/providers/${id}/test`, {
        method: 'POST'
      }),
      refreshModels: (id) => request(`/providers/${id}/refresh-models`, {
        method: 'POST'
      })
    },

    // Runs
    runs: {
      list: (limit = 50, offset = 0, source = 'all') =>
        request(`/runs?limit=${limit}&offset=${offset}&source=${source}`),
      create: (data) => request('/runs', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      getById: (id) => request(`/runs/${id}`),
      getOutput: (id) => request(`/runs/${id}/output`),
      getPrompt: (id) => request(`/runs/${id}/prompt`),
      stop: (id) => request(`/runs/${id}/stop`, {
        method: 'POST'
      }),
      delete: (id) => request(`/runs/${id}`, {
        method: 'DELETE'
      }),
      deleteFailedRuns: () => request('/runs?filter=failed', {
        method: 'DELETE'
      })
    }
  };
}

// Default export with default config
export default createApiClient();
