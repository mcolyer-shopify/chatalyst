import { executeMCPTool } from './mcp';

export interface ActiveTool {
  name: string;
  description?: string;
  parameters: unknown;
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