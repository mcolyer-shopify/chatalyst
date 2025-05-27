import type { Message as MessageType } from '../types';
import { marked } from 'marked';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const renderContent = () => {
    if (message.role === 'assistant') {
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
    <div class={`message message-${message.role}`}>
      {renderContent()}
      <div class="message-timestamp">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}