import { Router } from 'express';

/**
 * Create prompts routes
 */
export function createPromptsRoutes(promptsService, options = {}) {
  const router = Router();
  const { asyncHandler = (fn) => fn } = options;

  // GET /prompts/stages - Get all stages
  router.get('/stages', asyncHandler(async (req, res) => {
    const stages = promptsService.getStages();
    res.json(stages);
  }));

  // GET /prompts/stages/:name - Get specific stage
  router.get('/stages/:name', asyncHandler(async (req, res) => {
    const stage = promptsService.getStage(req.params.name);

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const template = await promptsService.getStageTemplate(req.params.name);
    res.json({ ...stage, template });
  }));

  // PUT /prompts/stages/:name - Update stage
  router.put('/stages/:name', asyncHandler(async (req, res) => {
    const { config, template } = req.body;

    if (config) {
      await promptsService.updateStageConfig(req.params.name, config);
    }

    if (template) {
      await promptsService.updateStageTemplate(req.params.name, template);
    }

    const updated = promptsService.getStage(req.params.name);
    const updatedTemplate = await promptsService.getStageTemplate(req.params.name);

    res.json({ ...updated, template: updatedTemplate });
  }));

  // POST /prompts/stages/:name/preview - Preview stage with test data
  router.post('/stages/:name/preview', asyncHandler(async (req, res) => {
    const preview = await promptsService.previewPrompt(req.params.name, req.body);
    res.json({ preview });
  }));

  // GET /prompts/variables - Get all variables
  router.get('/variables', asyncHandler(async (req, res) => {
    const variables = promptsService.getVariables();
    res.json(variables);
  }));

  // GET /prompts/variables/:key - Get specific variable
  router.get('/variables/:key', asyncHandler(async (req, res) => {
    const variable = promptsService.getVariable(req.params.key);

    if (!variable) {
      return res.status(404).json({ error: 'Variable not found' });
    }

    res.json(variable);
  }));

  // POST /prompts/variables - Create variable
  router.post('/variables', asyncHandler(async (req, res) => {
    const { key, ...data } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Variable key is required' });
    }

    await promptsService.createVariable(key, data);
    const created = promptsService.getVariable(key);
    res.status(201).json(created);
  }));

  // PUT /prompts/variables/:key - Update variable
  router.put('/variables/:key', asyncHandler(async (req, res) => {
    await promptsService.updateVariable(req.params.key, req.body);
    const updated = promptsService.getVariable(req.params.key);
    res.json(updated);
  }));

  // DELETE /prompts/variables/:key - Delete variable
  router.delete('/variables/:key', asyncHandler(async (req, res) => {
    await promptsService.deleteVariable(req.params.key);
    res.status(204).send();
  }));

  return router;
}
