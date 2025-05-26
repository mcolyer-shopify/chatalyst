import { useEffect, useRef } from 'preact/hooks';
import { Message } from './Message';
import { MessageInput } from './MessageInput';
import { ModelSelector } from './ModelSelector';
import type { Conversation as ConversationType } from '../types';

interface ConversationProps {
  conversation: ConversationType | null;
  onSendMessage: (message: string) => void;
  onModelChange: (modelId: string) => void;
}

export function Conversation({ conversation, onSendMessage, onModelChange }: ConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div class="conversation-empty">
        <p>Select a conversation or create a new one to start chatting</p>
      </div>
    );
  }

  return (
    <div class="conversation">
      <div class="conversation-header">
        <h2>{conversation.title}</h2>
        <ModelSelector
          selectedModel={conversation.model}
          onModelChange={onModelChange}
          className="conversation-model-selector"
        />
      </div>
      <div class="conversation-messages">
        {conversation.messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput onSend={onSendMessage} />
    </div>
  );
}