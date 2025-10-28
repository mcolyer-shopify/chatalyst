// Thinking model detection and configuration

// Models that support thinking/extended thinking
const THINKING_MODELS = [
  // OpenAI reasoning models (use reasoning_effort parameter)
  'gpt-5',
  'gpt-5-chat-latest',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-turbo',
  'gpt-5-preview',
  // Claude models (use thinking parameter)
  'claude-sonnet-4.5-*',
  'claude-opus-4.1-*'
];

export type ThinkingAmount = 'low' | 'medium' | 'high' | 'enabled' | 'extended';

export interface ThinkingPreset {
  label: string;
  value: ThinkingAmount;
  description: string;
}

// Presets for OpenAI reasoning models (reasoning_effort parameter)
const OPENAI_THINKING_PRESETS: ThinkingPreset[] = [
  { label: 'Low', value: 'low', description: 'Minimal reasoning' },
  { label: 'Medium', value: 'medium', description: 'Balanced reasoning' },
  { label: 'High', value: 'high', description: 'Extended reasoning' }
];

// Presets for Claude thinking models (thinking parameter)
const CLAUDE_THINKING_PRESETS: ThinkingPreset[] = [
  { label: 'Enabled', value: 'enabled', description: 'Standard thinking' },
  { label: 'Extended', value: 'extended', description: 'Extended thinking' }
];

export function isThinkingModel(model: string): boolean {
  if (!model) return false;

  const lowerModel = model.toLowerCase();

  // Check exact matches
  for (const thinkingModel of THINKING_MODELS) {
    if (thinkingModel.endsWith('-*')) {
      // Wildcard match
      const prefix = thinkingModel.slice(0, -2);
      if (lowerModel.startsWith(prefix.toLowerCase())) {
        return true;
      }
    } else if (lowerModel === thinkingModel.toLowerCase()) {
      return true;
    }
  }

  return false;
}

export function isOpenAIReasoningModel(model: string): boolean {
  if (!model) return false;

  const lowerModel = model.toLowerCase();
  const openaiReasoningModels = THINKING_MODELS.filter(m => !m.includes('claude'));

  for (const reasoningModel of openaiReasoningModels) {
    if (reasoningModel.endsWith('-*')) {
      const prefix = reasoningModel.slice(0, -2);
      if (lowerModel.startsWith(prefix.toLowerCase())) {
        return true;
      }
    } else if (lowerModel === reasoningModel.toLowerCase()) {
      return true;
    }
  }

  return false;
}

export function isClaudeThinkingModel(model: string): boolean {
  if (!model) return false;

  const lowerModel = model.toLowerCase();
  const claudeThinkingModels = THINKING_MODELS.filter(m => m.includes('claude'));

  for (const claudeModel of claudeThinkingModels) {
    if (claudeModel.endsWith('-*')) {
      const prefix = claudeModel.slice(0, -2);
      if (lowerModel.startsWith(prefix.toLowerCase())) {
        return true;
      }
    } else if (lowerModel === claudeModel.toLowerCase()) {
      return true;
    }
  }

  return false;
}

export function getThinkingPresetsForModel(model: string): ThinkingPreset[] {
  if (isOpenAIReasoningModel(model)) {
    return OPENAI_THINKING_PRESETS;
  }

  if (isClaudeThinkingModel(model)) {
    return CLAUDE_THINKING_PRESETS;
  }

  return [];
}

export function getDefaultThinkingAmount(model: string): ThinkingAmount | null {
  if (isOpenAIReasoningModel(model)) {
    return 'medium';
  }

  if (isClaudeThinkingModel(model)) {
    return 'enabled';
  }

  return null;
}
