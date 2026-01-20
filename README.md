# @portos/ai-toolkit

Shared AI provider, model, and prompt template patterns for PortOS-style applications.

## Installation

```bash
npm install @portos/ai-toolkit
```

## Features

- **Provider Management**: Support for CLI-based (Claude Code, Codex, etc.) and API-based (OpenAI-compatible) AI providers
- **Prompt Templates**: Reusable prompt template system with variable interpolation
- **Run History**: Track and manage AI run history with streaming support
- **React Components**: Ready-to-use React components and hooks for AI provider management
- **Express Routes**: Pre-built Express route handlers for provider, prompt, and run management

## Usage

### Server-side

```javascript
import { createAIRoutes, ProvidersService, RunnerService } from '@portos/ai-toolkit/server';
import express from 'express';

const app = express();

// Initialize services
const providersService = new ProvidersService('./data');
const runnerService = new RunnerService(providersService);

// Mount AI routes
app.use('/api', createAIRoutes({ providersService, runnerService }));
```

### Client-side

```javascript
import { AIProviders, useProviders, createApiClient } from '@portos/ai-toolkit/client';

// Use the full-featured AIProviders page component
function ProvidersPage() {
  return <AIProviders onError={console.error} colorPrefix="app" />;
}

// Or use hooks for custom implementations
function CustomComponent() {
  const { providers, loading, refresh } = useProviders();
  // ...
}
```

### Shared utilities

```javascript
import { PROVIDER_TYPES, DEFAULT_TIMEOUT } from '@portos/ai-toolkit/shared';
```

## Provider Types

### CLI Providers
Execute AI commands via CLI tools like Claude Code or Codex:
- Claude Code CLI (`claude`)
- Codex CLI (`codex`)
- Custom CLI tools

### API Providers
Connect to OpenAI-compatible APIs:
- LM Studio
- Ollama
- OpenAI
- Any OpenAI-compatible endpoint

## API Reference

### Server Exports (`@portos/ai-toolkit/server`)

- `createAIRoutes(options)` - Create Express router with all AI routes
- `ProvidersService` - Manage AI provider configurations
- `RunnerService` - Execute prompts and manage runs
- `PromptsService` - Manage prompt templates
- Route handlers: `createProvidersRoutes`, `createRunsRoutes`, `createPromptsRoutes`

### Client Exports (`@portos/ai-toolkit/client`)

- `AIProviders` - Full-featured provider management page component
- `ProviderDropdown` - Dropdown for selecting providers
- `useProviders()` - Hook for provider state management
- `useRuns()` - Hook for run history
- `createApiClient(baseUrl)` - Create API client instance

### Shared Exports (`@portos/ai-toolkit/shared`)

- `PROVIDER_TYPES` - Provider type constants
- `DEFAULT_TIMEOUT` - Default timeout value

## License

MIT
