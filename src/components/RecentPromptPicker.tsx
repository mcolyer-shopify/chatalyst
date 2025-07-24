import { useState, useRef, useEffect } from 'preact/hooks';
import { Prompt } from '../types';
import { recentPrompts, markPromptAsUsed } from '../store';

interface RecentPromptPickerProps {
  onSelectPrompt: (content: string) => void;
  onOpenFullLibrary: () => void;
  disabled?: boolean;
}

export function RecentPromptPicker({ onSelectPrompt, onOpenFullLibrary, disabled }: RecentPromptPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelectPrompt = (prompt: Prompt) => {
    markPromptAsUsed(prompt.id);
    onSelectPrompt(prompt.content);
    setIsOpen(false);
  };

  const handleOpenFullLibrary = () => {
    onOpenFullLibrary();
    setIsOpen(false);
  };

  const recent = recentPrompts.value.slice(0, 3);

  return (
    <div class="recent-prompt-picker">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        class="message-input-prompt-button"
        title="Recent prompts"
        aria-label="Open recent prompts"
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">💬</span>
        <span aria-hidden="true" class="dropdown-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div ref={dropdownRef} class="recent-prompt-dropdown">
          {recent.length > 0 ? (
            <>
              <div class="recent-prompts-section">
                <div class="recent-prompts-header">Recent</div>
                {recent.map((prompt) => (
                  <button
                    key={prompt.id}
                    class="recent-prompt-item"
                    onClick={() => handleSelectPrompt(prompt)}
                    title={prompt.content}
                  >
                    <span class="recent-prompt-title">{prompt.title}</span>
                  </button>
                ))}
              </div>
              <div class="dropdown-separator" />
            </>
          ) : null}
          
          <button
            class="dropdown-menu-item full-library-btn"
            onClick={handleOpenFullLibrary}
          >
            <span class="menu-icon">📚</span>
            <span>All Prompts...</span>
          </button>
        </div>
      )}
    </div>
  );
}