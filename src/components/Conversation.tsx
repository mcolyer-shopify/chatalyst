import { useEffect, useRef, useState } from 'preact/hooks';
import { Message } from './Message';
import { MessageInput } from './MessageInput';
import { ModelSelector } from './ModelSelector';
import { isStreaming } from '../store';
import type { Conversation as ConversationType } from '../types';

interface ConversationProps {
  conversation: ConversationType | null;
  onSendMessage: (message: string) => void;
  onModelChange: (modelId: string) => void;
  onStopGeneration?: () => void;
}

export function Conversation({ conversation, onSendMessage, onModelChange, onStopGeneration }: ConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Check if user is at the bottom of scroll
  const isAtBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle scroll events to show/hide button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollButton(!isAtBottom());
    };

    // Check initially
    handleScroll();

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [conversation?.id]);

  // Check if we should show button when messages change
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Give DOM time to update
    setTimeout(() => {
      setShowScrollButton(!isAtBottom());
    }, 0);
  }, [conversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const [isLastMessageGenerating, setIsLastMessageGenerating] = useState(false);

  // Update generating state when conversation changes
  useEffect(() => {
    if (!conversation?.messages.length) {
      setIsLastMessageGenerating(false);
      return;
    }
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    setIsLastMessageGenerating(lastMessage.role === 'assistant' && !!lastMessage.isGenerating);
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
      <div class="conversation-messages" ref={messagesContainerRef}>
        {conversation.messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
        {showScrollButton && (
          <button
            class="scroll-to-bottom"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            ↓
          </button>
        )}
      </div>
      <MessageInput 
        onSend={onSendMessage} 
        onStopGeneration={onStopGeneration}
        disabled={isStreaming.value && !isLastMessageGenerating} 
        isGenerating={isLastMessageGenerating}
        userMessages={conversation.messages
          .filter(m => m.role === 'user')
          .map(m => m.content)}
      />
    </div>
  );
}