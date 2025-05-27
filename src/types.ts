export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  isGenerating?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
}

export interface Model {
  id: string;
  name: string;
  description?: string;
}

export interface Settings {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
}