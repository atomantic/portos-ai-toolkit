import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Create a prompts service with configurable storage
 */
export function createPromptsService(config = {}) {
  const {
    dataDir = './data',
    promptsDir = 'prompts'
  } = config;

  const PROMPTS_PATH = join(dataDir, promptsDir);

  let stageConfig = null;
  let variables = null;

  /**
   * Load or reload prompts configuration
   */
  async function loadPrompts() {
    const configPath = join(PROMPTS_PATH, 'stage-config.json');
    const varsPath = join(PROMPTS_PATH, 'variables.json');

    if (existsSync(configPath)) {
      stageConfig = JSON.parse(await readFile(configPath, 'utf-8'));
    } else {
      stageConfig = { stages: {} };
    }

    if (existsSync(varsPath)) {
      variables = JSON.parse(await readFile(varsPath, 'utf-8'));
    } else {
      variables = { variables: {} };
    }

    console.log(`📝 Loaded ${Object.keys(stageConfig.stages || {}).length} prompt stages`);
  }

  /**
   * Apply Mustache-like template substitution
   */
  function applyTemplate(template, data) {
    let result = template;

    // Handle sections {{#key}}...{{/key}}
    result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
      const value = data[key];
      if (!value) return '';
      if (Array.isArray(value)) {
        return value.map(item => {
          if (typeof item === 'object') {
            return applyTemplate(content, item);
          }
          return content.replace(/\{\{\.\}\}/g, item);
        }).join('');
      }
      return applyTemplate(content, data);
    });

    // Handle inverted sections {{^key}}...{{/key}}
    result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
      return data[key] ? '' : content;
    });

    // Handle simple variables {{key}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });

    return result.trim();
  }

  return {
    /**
     * Load prompts configuration
     */
    async init() {
      await loadPrompts();
    },

    /**
     * Get all stages
     */
    getStages() {
      return stageConfig?.stages || {};
    },

    /**
     * Get a single stage
     */
    getStage(stageName) {
      return stageConfig?.stages?.[stageName] || null;
    },

    /**
     * Get stage template content
     */
    async getStageTemplate(stageName) {
      const templatePath = join(PROMPTS_PATH, 'stages', `${stageName}.md`);
      if (!existsSync(templatePath)) return null;
      return readFile(templatePath, 'utf-8');
    },

    /**
     * Update stage template
     */
    async updateStageTemplate(stageName, content) {
      const stagesDir = join(PROMPTS_PATH, 'stages');
      if (!existsSync(stagesDir)) await mkdir(stagesDir, { recursive: true });
      await writeFile(join(stagesDir, `${stageName}.md`), content);
    },

    /**
     * Update stage configuration
     */
    async updateStageConfig(stageName, updatedConfig) {
      if (!stageConfig) await loadPrompts();
      stageConfig.stages[stageName] = { ...stageConfig.stages[stageName], ...updatedConfig };
      await writeFile(join(PROMPTS_PATH, 'stage-config.json'), JSON.stringify(stageConfig, null, 2));
    },

    /**
     * Create a new stage
     */
    async createStage(stageName, config, template = '') {
      if (!stageConfig) await loadPrompts();
      if (stageConfig.stages[stageName]) {
        throw new Error(`Stage ${stageName} already exists`);
      }
      stageConfig.stages[stageName] = config;
      await writeFile(join(PROMPTS_PATH, 'stage-config.json'), JSON.stringify(stageConfig, null, 2));

      // Create template file
      const stagesDir = join(PROMPTS_PATH, 'stages');
      if (!existsSync(stagesDir)) await mkdir(stagesDir, { recursive: true });
      await writeFile(join(stagesDir, `${stageName}.md`), template);

      console.log(`✅ Created prompt stage: ${stageName}`);
    },

    /**
     * Delete a stage
     */
    async deleteStage(stageName) {
      if (!stageConfig) await loadPrompts();
      if (!stageConfig.stages[stageName]) {
        throw new Error(`Stage ${stageName} not found`);
      }
      delete stageConfig.stages[stageName];
      await writeFile(join(PROMPTS_PATH, 'stage-config.json'), JSON.stringify(stageConfig, null, 2));

      // Delete template file if it exists
      const templatePath = join(PROMPTS_PATH, 'stages', `${stageName}.md`);
      if (existsSync(templatePath)) {
        const { unlink } = await import('fs/promises');
        await unlink(templatePath);
      }

      console.log(`🗑️ Deleted prompt stage: ${stageName}`);
    },

    /**
     * Get all variables
     */
    getVariables() {
      return variables?.variables || {};
    },

    /**
     * Get a single variable
     */
    getVariable(key) {
      return variables?.variables?.[key] || null;
    },

    /**
     * Update a variable
     */
    async updateVariable(key, data) {
      if (!variables) await loadPrompts();
      variables.variables[key] = { ...variables.variables[key], ...data };
      await writeFile(join(PROMPTS_PATH, 'variables.json'), JSON.stringify(variables, null, 2));
    },

    /**
     * Create a new variable
     */
    async createVariable(key, data) {
      if (!variables) await loadPrompts();
      if (variables.variables[key]) {
        throw new Error(`Variable ${key} already exists`);
      }
      variables.variables[key] = data;
      await writeFile(join(PROMPTS_PATH, 'variables.json'), JSON.stringify(variables, null, 2));
    },

    /**
     * Delete a variable
     */
    async deleteVariable(key) {
      if (!variables) await loadPrompts();
      delete variables.variables[key];
      await writeFile(join(PROMPTS_PATH, 'variables.json'), JSON.stringify(variables, null, 2));
    },

    /**
     * Build a prompt from template and variables
     */
    async buildPrompt(stageName, data = {}) {
      const stage = stageConfig?.stages?.[stageName];
      if (!stage) throw new Error(`Stage ${stageName} not found`);

      let template = await this.getStageTemplate(stageName);
      if (!template) throw new Error(`Template for ${stageName} not found`);

      const allVars = { ...data };
      for (const varName of stage.variables || []) {
        const v = variables?.variables?.[varName];
        if (v) allVars[varName] = v.content;
      }

      return applyTemplate(template, allVars);
    },

    /**
     * Preview a prompt with test data
     */
    async previewPrompt(stageName, testData = {}) {
      return this.buildPrompt(stageName, testData);
    }
  };
}
