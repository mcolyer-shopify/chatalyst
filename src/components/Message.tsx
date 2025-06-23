import type { Message as MessageType } from '../types';
import { marked } from 'marked';
import { useEffect, useState } from 'preact/hooks';

interface MessageProps {
  message: MessageType;
  collapsed?: boolean;
  onRetry?: () => void;
  onDelete?: () => void;
}

export function Message({ message, collapsed = true, onRetry, onDelete }: MessageProps) {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(message.role === 'tool' ? true : collapsed);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (message.isGenerating) {
      const interval = setInterval(() => {
        setAnimationFrame(prev => (prev + 1) % 4);
      }, 400);
      return () => clearInterval(interval);
    }
  }, [message.isGenerating]);

  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  const getLoadingAnimation = () => {
    const frames = ['⠋', '⠙', '⠹', '⠸'];
    return frames[animationFrame];
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleDelete = () => {
    console.log('Delete button clicked', { messageId: message.id, onDelete: !!onDelete });
    if (onDelete) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    console.log('User confirmed deletion, calling onDelete');
    setShowDeleteConfirm(false);
    if (onDelete) {
      onDelete();
    }
  };

  const cancelDelete = () => {
    console.log('User cancelled deletion');
    setShowDeleteConfirm(false);
  };

  const renderContent = () => {
    if (message.role === 'tool') {
      return (
        <div class={`message-content tool-message ${isCollapsed ? 'collapsed' : ''}`}>
          <div class="tool-header" onClick={() => setIsCollapsed(!isCollapsed)}>
            <span class="tool-icon">🔧</span>
            <span class="tool-name">{message.toolName || 'Tool'}</span>
            <span class="tool-toggle">{isCollapsed ? '▶' : '▼'}</span>
          </div>
          {!isCollapsed && (
            <div class="tool-details">
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
    
    // For user messages, also use markdown to preserve newlines
    if (message.role === 'user') {
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
      <div class="message-footer">
        <div class="message-timestamp">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
        {message.role === 'user' && onRetry && (
          <button
            class="message-retry-button"
            onClick={onRetry}
            aria-label="Retry from this message"
            title="Retry from this message"
          >
            ↻
          </button>
        )}
        {message.role === 'user' && onDelete && (
          <button
            class="message-delete-button"
            onClick={handleDelete}
            aria-label="Delete this message and all following messages"
            title="Delete this message and all following messages"
          >
            🗑️
          </button>
        )}
        {message.role === 'assistant' && (
          <button
            class="message-copy-button"
            onClick={handleCopy}
            aria-label="Copy message content"
            title="Copy message content"
          >
            ⧉
          </button>
        )}
      </div>
      {showDeleteConfirm && (
        <div class="delete-confirm-overlay">
          <div class="delete-confirm-dialog">
            <h3>Confirm Deletion</h3>
            <p>Delete this message and all messages after it? This cannot be undone.</p>
            <div class="delete-confirm-buttons">
              <button class="delete-confirm-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button class="delete-confirm-ok" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}