import { executeMCPTool } from './mcp';
import { OPENAI_BUILTIN_TOOLS, OpenAIBuiltinTool, WebSearchConfig } from '../types';
import { shouldUseResponsesAPI } from './ai';

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

export function getBuiltinToolsForModel(provider: string, model: string, enabledBuiltinTools: string[] = []): OpenAIBuiltinTool[] {
  // Only return tools if the model supports the responses API
  if (!shouldUseResponsesAPI(provider, model)) {
    return [];
  }
  
  return OPENAI_BUILTIN_TOOLS.filter(tool => {
    // Check if tool is enabled for this conversation
    return enabledBuiltinTools.includes(tool.id);
  });
}

export function createBuiltinToolsObject(
  builtinTools: OpenAIBuiltinTool[], 
  openaiProvider: any, // OpenAI provider instance
  config?: WebSearchConfig
): Record<string, any> {
  const toolsObject: Record<string, any> = {};
  
  builtinTools.forEach(tool => {
    switch (tool.type) {
    case 'web_search_preview':
      toolsObject[tool.type] = openaiProvider.tools.webSearchPreview({
        searchContextSize: config?.searchContextSize || 'medium',
        userLocation: config?.userLocation
      });
      break;
    default:
      console.warn(`Unknown built-in tool type: ${tool.type}`);
    }
  });

  return toolsObject;
}