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
  const [shouldScrollToUserMessage, setShouldScrollToUserMessage] = useState(false);

  // Check if user is at the bottom of scroll (checking against last message, not padding)
  const isAtBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    // Find the last actual message element
    const messageElements = container.querySelectorAll('.message');
    const lastMessage = messageElements[messageElements.length - 1] as HTMLElement;
    
    if (!lastMessage) return true;
    
    const threshold = 100; // pixels from bottom of last message
    const containerBottom = container.getBoundingClientRect().bottom;
    const messageBottom = lastMessage.getBoundingClientRect().bottom;
    
    return messageBottom - containerBottom < threshold;
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

  // Check if we should show button when messages change and manage padding
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Remove padding if the last message is from assistant
    const lastMessage = conversation?.messages[conversation.messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      const existingPadding = container.querySelector('.scroll-padding');
      if (existingPadding) {
        existingPadding.remove();
      }
    }
    
    // Give DOM time to update
    setTimeout(() => {
      setShowScrollButton(!isAtBottom());
    }, 0);
  }, [conversation?.messages]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Find the last actual message element
    const messageElements = container.querySelectorAll('.message');
    const lastMessage = messageElements[messageElements.length - 1] as HTMLElement;
    
    if (lastMessage) {
      // Scroll to the bottom of the last message
      const containerTop = container.getBoundingClientRect().top;
      const messageBottom = lastMessage.getBoundingClientRect().bottom;
      const scrollOffset = messageBottom - containerTop - container.clientHeight;
      
      container.scrollTo({
        top: container.scrollTop + scrollOffset,
        behavior: 'smooth'
      });
    }
  };

  const scrollToUserMessage = (retryCount = 0) => {
    const container = messagesContainerRef.current;
    if (!container || !conversation?.messages.length) return;

    // Find the last user message (which should be the newly added one)
    const lastUserMessageIndex = conversation.messages.findLastIndex(m => m.role === 'user');
    if (lastUserMessageIndex === -1) return;

    // Get all message elements
    const messageElements = container.querySelectorAll('.message');
    const userMessageElement = messageElements[lastUserMessageIndex] as HTMLElement;
    
    // If element not found and we haven't retried too many times, retry
    if (!userMessageElement && retryCount < 10) {
      setTimeout(() => scrollToUserMessage(retryCount + 1), 50);
      return;
    }
    
    if (!userMessageElement) return;

    // Calculate scroll position to place user message at top
    const containerTop = container.getBoundingClientRect().top;
    const messageTop = userMessageElement.getBoundingClientRect().top;
    const scrollOffset = messageTop - containerTop;
    
    // Create padding div if needed to allow scrolling message to top
    const existingPadding = container.querySelector('.scroll-padding');
    if (existingPadding) {
      existingPadding.remove();
    }

    // Calculate padding needed to align user message with top of viewport
    const paddingHeight = container.clientHeight - userMessageElement.offsetHeight;
    if (paddingHeight > 0) {
      const paddingDiv = document.createElement('div');
      paddingDiv.className = 'scroll-padding';
      paddingDiv.style.height = `${paddingHeight}px`;
      container.appendChild(paddingDiv);
    }

    // Scroll to position user message at top
    if (container.scrollTo) {
      container.scrollTo({
        top: container.scrollTop + scrollOffset,
        behavior: 'smooth'
      });
    } else {
      // Fallback for test environments that don't support scrollTo
      container.scrollTop = container.scrollTop + scrollOffset;
    }

    // Update scroll button state after scrolling
    setTimeout(() => {
      setShowScrollButton(!isAtBottom());
    }, 300); // Wait for smooth scroll to complete
  };

  // Effect to scroll to user message when flag is set
  useEffect(() => {
    if (shouldScrollToUserMessage && conversation?.messages.length) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        scrollToUserMessage();
        setShouldScrollToUserMessage(false);
      });
    }
  }, [shouldScrollToUserMessage, conversation?.messages.length]);

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
        <div class="conversation-header-content">
          <h2>{conversation.title}</h2>
          <ModelSelector
            selectedModel={conversation.model}
            onModelChange={onModelChange}
            className="conversation-model-selector"
          />
        </div>
      </div>
      <div class="conversation-messages" ref={messagesContainerRef}>
        <div class="conversation-messages-content">
          {conversation.messages.map((message) => (
            <Message 
              key={message.id} 
              message={message}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
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
        onSend={(message) => {
          onSendMessage(message);
          // Set flag to trigger scroll to user message after DOM updates
          setShouldScrollToUserMessage(true);
        }} 
        onStopGeneration={onStopGeneration}
        disabled={isStreaming.value && !isLastMessageGenerating} 
        isGenerating={isLastMessageGenerating}
        userMessages={conversation.messages
          .filter(m => m.role === 'user')
          .map(m => m.content)}
        conversationId={conversation.id}
      />
    </div>
  );
}