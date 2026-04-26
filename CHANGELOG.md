# Changelog

## [0.8.3] - 2026-04-25

### Improvements

- Make `claude-opus-4-7` the default heavy/large Opus model in sample provider configs (replaces `claude-opus-4-6`)
- Update Bedrock sample to `us.anthropic.claude-opus-4-7-v1:0` for default and heavy tiers
- Update curated Anthropic models list (used by `Refresh`) to surface `claude-opus-4-7`
- Add UI notice in the AI providers page (card + edit form) clarifying that the `codex` and `gemini` CLIs run with their own configured default model in headless execution — model selections shown are reference metadata for the advisor UI and are not passed to the CLI

## [0.8.2] - 2026-04-22

### Improvements

- Update Codex CLI sample to current GPT-5 line (`gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.2`, `gpt-5.1-codex-max`, `gpt-5.1-codex-mini`)

## [0.6.0] - 2026-02-18

### Improvements

- Update sample provider model IDs to short-form names (e.g. `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`)
- Update default model placeholder in provider form to `claude-sonnet-4-6`

## [0.4.2] - 2026-02-17

### Added

- AWS Bedrock default provider config with Sonnet 4.5 and Opus 4.5 models (`CLAUDE_CODE_USE_BEDROCK` env var)
