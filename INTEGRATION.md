# Integration Guide

This document explains how to integrate `@portos/ai-toolkit` into an existing PortOS-style application.

## Full Integration (Future Work)

To fully integrate the toolkit into PortOS, the following steps would be needed:

### 1. Server Integration

Replace local services with toolkit services in `server/index.js`:

```javascript
import { createAIToolkit } from '@portos/ai-toolkit/server';
import { asyncHandler } from './lib/errorHandler.js';

// Create toolkit with PortOS configuration
const aiToolkit = createAIToolkit({
  dataDir: './data',
  providersFile: 'providers.json',
  runsDir: 'runs',
  promptsDir: 'prompts',
  screenshotsDir: './data/screenshots',
  io,
  asyncHandler,
  hooks: {
    onRunCreated: (metadata) => {
      // Record usage session
      recordSession(metadata.providerId, metadata.providerName, metadata.model);
    },
    onRunCompleted: (metadata, output) => {
      // Record message usage
      const estimatedTokens = Math.ceil(output.length / 4);
      recordMessages(metadata.providerId, metadata.model, 1, estimatedTokens);
    },
    onRunFailed: (metadata, error, output) => {
      // Emit error event for autofix
      errorEvents.emit('error', {
        code: 'AI_PROVIDER_EXECUTION_FAILED',
        message: `AI provider ${metadata.providerName} execution failed: ${error}`,
        severity: 'error',
        canAutoFix: true,
        context: { ...metadata, outputTail: output.slice(-2000) }
      });
    }
  }
});

// Replace existing routes
app.use('/api/providers', aiToolkit.routes.providers);
app.use('/api/runs', aiToolkit.routes.runs);
app.use('/api/prompts', aiToolkit.routes.prompts);
```

### 2. Remove Local Files

Once integrated, the following local files can be removed:

**Server:**
- `server/services/providers.js`
- `server/services/runner.js` (keeping cosRunnerClient integration separate)
- `server/services/promptService.js`
- `server/routes/providers.js`
- `server/routes/runs.js`
- `server/routes/prompts.js`

**Client:**
- Extract AI-specific code from `client/src/pages/AIProviders.jsx` into reusable components
- Use toolkit hooks instead of local state management

### 3. Considerations

**Dependencies to Keep in PortOS:**
- `cosRunnerClient.js` - PortOS-specific CLI run delegation
- `errorHandler.js` - PortOS error handling system
- `usage.js` - PortOS usage tracking
- `visionTest.js` - Vision testing utilities

**Integration Strategy:**

Option A: **Extend Toolkit Services**
- Keep toolkit as-is for basic functionality
- Wrap toolkit services with PortOS-specific extensions

Option B: **Plugin Architecture**
- Add plugin system to toolkit
- PortOS provides plugins for cosRunner, error handling, usage tracking

Option C: **Gradual Migration**
- Start with new projects using toolkit directly
- Migrate PortOS incrementally
- Keep PortOS-specific features separate

## Standalone Usage

The toolkit works standalone in new projects without PortOS dependencies:

### Minimal Server Setup

```javascript
import express from 'express';
import { createAIToolkit } from '@portos/ai-toolkit/server';

const app = express();
app.use(express.json());

const aiToolkit = createAIToolkit({ dataDir: './data' });
aiToolkit.mountRoutes(app);

app.listen(3000);
```

### Minimal Client Setup

```javascript
import { createApiClient, useProviders } from '@portos/ai-toolkit/client';

const api = createApiClient();

function App() {
  const { providers, setActive } = useProviders(api);

  return (
    <select onChange={(e) => setActive(e.target.value)}>
      {providers.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
```

## Testing Integration

Before full integration, test the toolkit in isolation:

```bash
cd packages/ai-toolkit
npm test
```

Create a test Express app to verify routes work as expected:

```bash
node test-server.js
```

## Rollback Plan

If integration causes issues:
1. Keep both systems running in parallel
2. Feature flag to switch between old and new
3. Gradual route migration (providers first, then runs, then prompts)
4. Monitor for issues and roll back if needed

## Success Metrics

- [ ] All existing provider tests pass
- [ ] All existing run tests pass
- [ ] API endpoints maintain backward compatibility
- [ ] Socket.IO events work correctly
- [ ] No performance regression
- [ ] Error handling works as expected
