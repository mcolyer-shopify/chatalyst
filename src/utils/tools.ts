import { executeMCPTool } from './mcp';
import { OPENAI_BUILTIN_TOOLS, OpenAIBuiltinTool } from '../types';

export interface ActiveTool {
  name: string;
  description?: string;
  parameters: unknown;
}

export interface BuiltinToolsConfig {
  enabledBuiltinTools: string[];
  useResponsesAPI: boolean;
}

export function createToolsObject(activeTools: ActiveTool[]) {
  if (activeTools.length === 0) {
    return undefined;
  }

  return activeTools.reduce((acc, activeTool) => {
    acc[activeTool.name] = {
      description: activeTool.description || '',
      parameters: activeTool.parameters,
      execute: async (args: unknown) => {
        const result = await executeMCPTool(activeTool.name, args);
        return result;
      }
    };
    return acc;
  }, {} as Record<string, {
    description: string;
    parameters: unknown;
    execute: (args: unknown) => Promise<unknown>;
  }>);
}

export function getBuiltinToolsForModel(model: string, enabledBuiltinTools: string[] = []): OpenAIBuiltinTool[] {
  return OPENAI_BUILTIN_TOOLS.filter(tool => {
    // Check if tool is enabled for this conversation
    if (!enabledBuiltinTools.includes(tool.id)) {
      return false;
    }
    
    // Check if tool supports this model (if model restrictions exist)
    if (tool.supportedModels && !tool.supportedModels.some(supportedModel => 
      model.toLowerCase().includes(supportedModel.toLowerCase())
    )) {
      return false;
    }
    
    return true;
  });
}

export function createBuiltinToolsArray(builtinTools: OpenAIBuiltinTool[]): Array<{ type: string }> {
  return builtinTools.map(tool => ({ type: tool.type }));
}