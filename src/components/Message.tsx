import type { Message as MessageType } from '../types';
import { marked } from 'marked';
import { useEffect, useState } from 'preact/hooks';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const [animationFrame, setAnimationFrame] = useState(0);

  useEffect(() => {
    if (message.isGenerating) {
      const interval = setInterval(() => {
        setAnimationFrame(prev => (prev + 1) % 4);
      }, 400);
      return () => clearInterval(interval);
    }
  }, [message.isGenerating]);

  const getLoadingAnimation = () => {
    const frames = ['⠋', '⠙', '⠹', '⠸'];
    return frames[animationFrame];
  };

  const renderContent = () => {
    if (message.role === 'tool') {
      return (
        <div class="message-content tool-message">
          <div class="tool-header">
            <span class="tool-icon">🔧</span>
            <span class="tool-name">{message.toolName || 'Tool'}</span>
          </div>
          {message.toolCall && (
            <div class="tool-call">
              <div class="tool-label">Call:</div>
              <pre>{JSON.stringify(message.toolCall, null, 2)}</pre>
            </div>
          )}
          {message.toolResult !== undefined && (
            <div class="tool-result">
              <div class="tool-label">Result:</div>
              <pre>{JSON.stringify(message.toolResult, null, 2)}</pre>
            </div>
          )}
        </div>
      );
    }
    
    if (message.role === 'assistant') {
      // Show loading animation if generating and no content
      if (message.isGenerating && !message.content) {
        return (
          <div class="message-content loading" style={{ color: '#999' }}>
            {getLoadingAnimation()}
          </div>
        );
      }

      // Configure marked for safety
      marked.setOptions({
        breaks: true,
        gfm: true,
        async: false
      });
      
      return (
        <div 
          class="message-content"
          dangerouslySetInnerHTML={{ __html: marked.parse(message.content) as string }}
        />
      );
    }
    
    return (
      <div class="message-content">
        {message.content}
      </div>
    );
  };

  return (
    <div class={`message message-${message.role}${message.isError ? ' message-error' : ''}`}>
      {renderContent()}
      <div class="message-timestamp">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}