/**
 * Provider Dropdown Component
 * Dropdown for selecting an AI provider
 */

export function ProviderDropdown({
  providers = [],
  value,
  onChange,
  filter = null,
  showType = false,
  placeholder = 'Select provider...',
  className = '',
  theme = {}
}) {
  const {
    bg = 'bg-port-bg',
    border = 'border-port-border',
    text = 'text-white'
  } = theme;

  const filteredProviders = filter ? providers.filter(filter) : providers;

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 ${bg} border ${border} rounded-lg ${text} ${className}`}
    >
      <option value="">{placeholder}</option>
      {filteredProviders.map(provider => (
        <option key={provider.id} value={provider.id}>
          {provider.name}
          {showType && ` (${provider.type})`}
        </option>
      ))}
    </select>
  );
}
