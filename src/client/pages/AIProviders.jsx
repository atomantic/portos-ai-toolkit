import { useState, useEffect } from 'react';
import { createApiClient } from '../api.js';
import { io } from 'socket.io-client';

/**
 * AIProviders - Full-featured AI provider management page
 *
 * @param {Object} props
 * @param {Function} props.onError - Error handler (e.g., toast.error)
 * @param {string} props.colorPrefix - CSS color prefix (default: 'app')
 */
export default function AIProviders({ onError = console.error, colorPrefix = 'app' }) {
  const api = createApiClient({ onError });

  const [providers, setProviders] = useState([]);
  const [activeProviderId, setActiveProviderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [runs, setRuns] = useState([]);
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [runPrompt, setRunPrompt] = useState('');
  const [activeRun, setActiveRun] = useState(null);
  const [runOutput, setRunOutput] = useState('');
  const [socket, setSocket] = useState(null);

  // Color classes using the prefix
  const colors = {
    bg: `bg-${colorPrefix}-bg`,
    card: `bg-${colorPrefix}-card`,
    border: `border-${colorPrefix}-border`,
    accent: `bg-${colorPrefix}-accent`,
    accentHover: `hover:bg-${colorPrefix}-accent/80`,
    accentText: `text-${colorPrefix}-accent`,
    accentBg: `bg-${colorPrefix}-accent/20`,
    success: `bg-${colorPrefix}-success`,
    successText: `text-${colorPrefix}-success`,
    successBg: `bg-${colorPrefix}-success/20`,
    warning: `bg-${colorPrefix}-warning`,
    warningText: `text-${colorPrefix}-warning`,
    warningBg: `bg-${colorPrefix}-warning/20`,
    error: `bg-${colorPrefix}-error`,
    errorText: `text-${colorPrefix}-error`,
    errorBg: `bg-${colorPrefix}-error/20`,
    borderColor: `bg-${colorPrefix}-border`,
    borderHover: `hover:bg-${colorPrefix}-border/80`,
  };

  useEffect(() => {
    loadData();
    const newSocket = io({ path: '/socket.io' });
    setSocket(newSocket);
    return () => newSocket?.disconnect();
  }, []);

  useEffect(() => {
    if (!activeRun || !socket) return;

    const handleData = (data) => {
      setRunOutput(prev => prev + data);
    };

    const handleComplete = () => {
      setActiveRun(null);
      loadRuns();
    };

    socket.on(`run:${activeRun}:data`, handleData);
    socket.on(`run:${activeRun}:complete`, handleComplete);

    return () => {
      socket.off(`run:${activeRun}:data`, handleData);
      socket.off(`run:${activeRun}:complete`, handleComplete);
    };
  }, [activeRun, socket]);

  const loadData = async () => {
    setLoading(true);
    const [providersData, runsData] = await Promise.all([
      api.providers.getAll().catch(() => ({ providers: [], activeProvider: null })),
      api.runs.list(20).catch(() => ({ runs: [] }))
    ]);
    setProviders(providersData.providers || []);
    setActiveProviderId(providersData.activeProvider);
    setRuns(runsData.runs || []);
    setLoading(false);
  };

  const loadRuns = async () => {
    const runsData = await api.runs.list(20).catch(() => ({ runs: [] }));
    setRuns(runsData.runs || []);
  };

  const handleSetActive = async (id) => {
    await api.providers.setActive(id);
    setActiveProviderId(id);
  };

  const handleTest = async (id) => {
    setTestResults(prev => ({ ...prev, [id]: { testing: true } }));
    const result = await api.providers.test(id).catch(err => ({ success: false, error: err.message }));
    setTestResults(prev => ({ ...prev, [id]: result }));
  };

  const handleDelete = async (id) => {
    await api.providers.delete(id);
    loadData();
  };

  const handleToggleEnabled = async (provider) => {
    await api.providers.update(provider.id, { enabled: !provider.enabled });
    loadData();
  };

  const handleRefreshModels = async (id) => {
    await api.providers.refreshModels(id);
    loadData();
  };

  const handleExecuteRun = async () => {
    if (!runPrompt.trim() || !activeProviderId) return;

    setRunOutput('');
    const result = await api.runs.create({
      providerId: activeProviderId,
      prompt: runPrompt
    }).catch(err => ({ error: err.message }));

    if (result.error) {
      setRunOutput(`Error: ${result.error}`);
      return;
    }

    setActiveRun(result.runId);
  };

  const handleStopRun = async () => {
    if (activeRun) {
      await api.runs.stop(activeRun);
      setActiveRun(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading providers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">AI Providers</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowRunPanel(!showRunPanel)}
            className={`px-4 py-2 ${colors.accent} ${colors.accentHover} text-white rounded-lg transition-colors`}
          >
            {showRunPanel ? 'Hide Runner' : 'Run Prompt'}
          </button>
          <button
            onClick={() => { setEditingProvider(null); setShowForm(true); }}
            className={`px-4 py-2 ${colors.borderColor} ${colors.borderHover} text-white rounded-lg transition-colors`}
          >
            Add Provider
          </button>
        </div>
      </div>

      {/* Run Panel */}
      {showRunPanel && (
        <div className={`${colors.card} border ${colors.border} rounded-xl p-4 space-y-4`}>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <select
              value={activeProviderId || ''}
              onChange={(e) => handleSetActive(e.target.value)}
              className={`px-3 py-2 ${colors.bg} border ${colors.border} rounded-lg text-white w-full sm:w-auto`}
            >
              <option value="">Select Provider</option>
              {providers.filter(p => p.enabled).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <textarea
            value={runPrompt}
            onChange={(e) => setRunPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            rows={3}
            className={`w-full px-3 py-2 ${colors.bg} border ${colors.border} rounded-lg text-white resize-none focus:border-${colorPrefix}-accent focus:outline-none`}
          />

          <div className="flex justify-between items-center">
            <button
              onClick={handleExecuteRun}
              disabled={!runPrompt.trim() || !activeProviderId || activeRun}
              className={`px-6 py-2 ${colors.success} hover:opacity-80 text-white rounded-lg transition-colors disabled:opacity-50`}
            >
              {activeRun ? 'Running...' : 'Execute'}
            </button>

            {activeRun && (
              <button
                onClick={handleStopRun}
                className={`px-4 py-2 ${colors.error} hover:opacity-80 text-white rounded-lg transition-colors`}
              >
                Stop
              </button>
            )}
          </div>

          {runOutput && (
            <div className={`${colors.bg} border ${colors.border} rounded-lg p-3 max-h-64 overflow-auto`}>
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{runOutput}</pre>
            </div>
          )}
        </div>
      )}

      {/* Provider List */}
      <div className="grid gap-4">
        {providers.map(provider => (
          <div
            key={provider.id}
            className={`${colors.card} border rounded-xl p-4 ${
              provider.id === activeProviderId ? `border-${colorPrefix}-accent` : colors.border
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    provider.type === 'cli' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {provider.type.toUpperCase()}
                  </span>
                  {provider.id === activeProviderId && (
                    <span className={`text-xs px-2 py-0.5 rounded ${colors.accentBg} ${colors.accentText}`}>
                      DEFAULT
                    </span>
                  )}
                  {!provider.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">
                      DISABLED
                    </span>
                  )}
                </div>

                <div className="mt-2 text-sm text-gray-400 space-y-1">
                  {provider.type === 'cli' && (
                    <p className="break-words">Command: <code className="text-gray-300 break-all">{provider.command} {provider.args?.join(' ')}</code></p>
                  )}
                  {provider.type === 'api' && (
                    <p className="break-words">Endpoint: <code className="text-gray-300 break-all">{provider.endpoint}</code></p>
                  )}
                  {provider.models?.length > 0 && (
                    <p>Models: {provider.models.slice(0, 3).join(', ')}{provider.models.length > 3 ? ` +${provider.models.length - 3}` : ''}</p>
                  )}
                  {provider.defaultModel && (
                    <p className="break-words">Default: <code className="text-gray-300 break-all">{provider.defaultModel}</code></p>
                  )}
                  {(provider.lightModel || provider.mediumModel || provider.heavyModel) && (
                    <p className="text-xs">
                      Tiers:
                      {provider.lightModel && <span className="ml-1 text-green-400">{provider.lightModel}</span>}
                      {provider.mediumModel && <span className="ml-1 text-yellow-400">{provider.mediumModel}</span>}
                      {provider.heavyModel && <span className="ml-1 text-red-400">{provider.heavyModel}</span>}
                    </p>
                  )}
                </div>

                {testResults[provider.id] && !testResults[provider.id].testing && (
                  <div className={`mt-2 text-sm ${testResults[provider.id].success ? colors.successText : colors.errorText}`}>
                    {testResults[provider.id].success
                      ? `✓ Available${testResults[provider.id].version ? ` (${testResults[provider.id].version})` : ''}`
                      : `✗ ${testResults[provider.id].error}`
                    }
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleTest(provider.id)}
                  disabled={testResults[provider.id]?.testing}
                  className={`px-3 py-1.5 text-sm ${colors.borderColor} ${colors.borderHover} text-white rounded transition-colors disabled:opacity-50`}
                >
                  {testResults[provider.id]?.testing ? 'Testing...' : 'Test'}
                </button>

                {provider.type === 'api' && (
                  <button
                    onClick={() => handleRefreshModels(provider.id)}
                    className={`px-3 py-1.5 text-sm ${colors.borderColor} ${colors.borderHover} text-white rounded transition-colors`}
                  >
                    Refresh
                  </button>
                )}

                <button
                  onClick={() => handleToggleEnabled(provider)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    provider.enabled
                      ? `${colors.warningBg} ${colors.warningText} hover:bg-${colorPrefix}-warning/30`
                      : `${colors.successBg} ${colors.successText} hover:bg-${colorPrefix}-success/30`
                  }`}
                >
                  {provider.enabled ? 'Disable' : 'Enable'}
                </button>

                {provider.id !== activeProviderId && provider.enabled && (
                  <button
                    onClick={() => handleSetActive(provider.id)}
                    className={`px-3 py-1.5 text-sm ${colors.accentBg} ${colors.accentText} hover:bg-${colorPrefix}-accent/30 rounded transition-colors`}
                  >
                    Set Default
                  </button>
                )}

                <button
                  onClick={() => { setEditingProvider(provider); setShowForm(true); }}
                  className={`px-3 py-1.5 text-sm ${colors.borderColor} ${colors.borderHover} text-white rounded transition-colors`}
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(provider.id)}
                  className={`px-3 py-1.5 text-sm ${colors.errorBg} ${colors.errorText} hover:bg-${colorPrefix}-error/30 rounded transition-colors`}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {providers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No providers configured. Add a provider to get started.
          </div>
        )}
      </div>

      {/* Recent Runs */}
      {runs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Recent Runs</h2>
          <div className="space-y-2">
            {runs.map(run => (
              <div
                key={run.id}
                className={`${colors.card} border ${colors.border} rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 sm:mt-0 ${
                    run.success === true ? colors.success :
                    run.success === false ? colors.error :
                    `${colors.warning} animate-pulse`
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{run.prompt}</p>
                    <p className="text-xs text-gray-500">
                      {run.providerName} • {run.workspaceName || 'No workspace'} • {new Date(run.startTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-400 flex-shrink-0 pl-5 sm:pl-0">
                  {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : 'Running...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provider Form Modal */}
      {showForm && (
        <ProviderForm
          provider={editingProvider}
          onClose={() => { setShowForm(false); setEditingProvider(null); }}
          onSave={() => { setShowForm(false); setEditingProvider(null); loadData(); }}
          api={api}
          colorPrefix={colorPrefix}
        />
      )}
    </div>
  );
}

function ProviderForm({ provider, onClose, onSave, api, colorPrefix = 'app' }) {
  const [formData, setFormData] = useState({
    name: provider?.name || '',
    type: provider?.type || 'cli',
    command: provider?.command || '',
    args: provider?.args?.join(' ') || '',
    endpoint: provider?.endpoint || '',
    apiKey: provider?.apiKey || '',
    models: provider?.models || [],
    defaultModel: provider?.defaultModel || '',
    lightModel: provider?.lightModel || '',
    mediumModel: provider?.mediumModel || '',
    heavyModel: provider?.heavyModel || '',
    timeout: provider?.timeout || 300000,
    enabled: provider?.enabled !== false
  });

  const availableModels = formData.models || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      args: formData.args ? formData.args.split(' ').filter(Boolean) : [],
      timeout: parseInt(formData.timeout)
    };

    if (provider) {
      await api.providers.update(provider.id, data);
    } else {
      await api.providers.create(data);
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-${colorPrefix}-card border border-${colorPrefix}-border rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
        <h2 className="text-xl font-bold text-white mb-4">
          {provider ? 'Edit Provider' : 'Add Provider'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
            >
              <option value="cli">CLI</option>
              <option value="api">API</option>
            </select>
          </div>
          {formData.type === 'cli' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Command *</label>
                <input
                  type="text"
                  value={formData.command}
                  onChange={(e) => setFormData(prev => ({ ...prev, command: e.target.value }))}
                  placeholder="claude"
                  required={formData.type === 'cli'}
                  className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Arguments (space-separated)</label>
                <input
                  type="text"
                  value={formData.args}
                  onChange={(e) => setFormData(prev => ({ ...prev, args: e.target.value }))}
                  placeholder="--print -p"
                  className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
                />
              </div>
            </>
          )}
          {formData.type === 'api' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Endpoint *</label>
                <input
                  type="url"
                  value={formData.endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="http://localhost:1234/v1"
                  required={formData.type === 'api'}
                  className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                  className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Available Models
              {formData.type === 'api' && <span className="text-xs text-gray-500 ml-2">(Use Refresh after saving)</span>}
            </label>
            <textarea
              value={(formData.models || []).join(', ')}
              onChange={(e) => {
                const models = e.target.value.split(',').map(m => m.trim()).filter(Boolean);
                setFormData(prev => ({ ...prev, models }));
              }}
              placeholder="model-1, model-2, model-3"
              rows={2}
              className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white resize-none focus:border-${colorPrefix}-accent focus:outline-none`}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Default Model</label>
            {availableModels.length > 0 ? (
              <select
                value={formData.defaultModel}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultModel: e.target.value }))}
                className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
              >
                <option value="">None</option>
                {availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.defaultModel}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultModel: e.target.value }))}
                placeholder="claude-sonnet-4-6"
                className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
              />
            )}
          </div>

          {/* Model Tiers */}
          <div className={`border-t border-${colorPrefix}-border pt-4 mt-4`}>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Model Tiers</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                  Light (fast)
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={formData.lightModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, lightModel: e.target.value }))}
                    className={`w-full px-2 py-1.5 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white text-sm focus:border-${colorPrefix}-accent focus:outline-none`}
                  >
                    <option value="">None</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.lightModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, lightModel: e.target.value }))}
                    placeholder="haiku"
                    className={`w-full px-2 py-1.5 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white text-sm focus:border-${colorPrefix}-accent focus:outline-none`}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1"></span>
                  Medium (balanced)
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={formData.mediumModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, mediumModel: e.target.value }))}
                    className={`w-full px-2 py-1.5 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white text-sm focus:border-${colorPrefix}-accent focus:outline-none`}
                  >
                    <option value="">None</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.mediumModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, mediumModel: e.target.value }))}
                    placeholder="sonnet"
                    className={`w-full px-2 py-1.5 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white text-sm focus:border-${colorPrefix}-accent focus:outline-none`}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>
                  Heavy (powerful)
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={formData.heavyModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, heavyModel: e.target.value }))}
                    className={`w-full px-2 py-1.5 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white text-sm focus:border-${colorPrefix}-accent focus:outline-none`}
                  >
                    <option value="">None</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.heavyModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, heavyModel: e.target.value }))}
                    placeholder="opus"
                    className={`w-full px-2 py-1.5 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white text-sm focus:border-${colorPrefix}-accent focus:outline-none`}
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Timeout (ms)</label>
            <input
              type="number"
              value={formData.timeout}
              onChange={(e) => setFormData(prev => ({ ...prev, timeout: e.target.value }))}
              className={`w-full px-3 py-2 bg-${colorPrefix}-bg border border-${colorPrefix}-border rounded-lg text-white focus:border-${colorPrefix}-accent focus:outline-none`}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className={`w-4 h-4 rounded border-${colorPrefix}-border bg-${colorPrefix}-bg`}
            />
            <span className="text-sm text-gray-400">Enabled</span>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button type="submit" className={`px-6 py-2 bg-${colorPrefix}-accent hover:bg-${colorPrefix}-accent/80 text-white rounded-lg transition-colors`}>
              {provider ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
