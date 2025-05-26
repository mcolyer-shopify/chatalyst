import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { Conversation } from '../types';
import { ModelSelector } from './ModelSelector';

// Local UI state signals
const dropdownId = signal<string | null>(null);
const editingId = signal<string | null>(null);
const editTitle = signal('');

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onSettingsClick: () => void;
  defaultModel?: string;
  onDefaultModelChange: (modelId: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSettingsClick,
  defaultModel,
  onDefaultModelChange
}: ConversationListProps) {

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      // Check if the click is outside any dropdown menu
      if (!target.closest('.conversation-menu')) {
        dropdownId.value = null;
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRename = (conversation: Conversation) => {
    editingId.value = conversation.id;
    editTitle.value = conversation.title;
    dropdownId.value = null;
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.value.trim()) {
      onRename(id, editTitle.value.trim());
    }
    editingId.value = null;
    editTitle.value = '';
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    dropdownId.value = null;
  };

  return (
    <div class="conversation-list">
      <div class="conversation-list-header">
        <h2>Conversations</h2>
        <div class="sidebar-model-selector">
          <ModelSelector
            selectedModel={defaultModel}
            onModelChange={onDefaultModelChange}
            className="sidebar-model-selector"
            showAsDefault={true}
          />
        </div>
      </div>
      <div class="conversations">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            class={`conversation-item ${selectedId === conversation.id ? 'selected' : ''}`}
          >
            {editingId.value === conversation.id ? (
              <input
                type="text"
                value={editTitle.value}
                onInput={(e) => editTitle.value = e.currentTarget.value}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRename(conversation.id);
                  } else if (e.key === 'Escape') {
                    editingId.value = null;
                  }
                }}
                onBlur={() => handleSaveRename(conversation.id)}
                autoFocus
                class="conversation-title-input"
              />
            ) : (
              <>
                <div
                  class="conversation-title"
                  onClick={() => onSelect(conversation.id)}
                >
                  {conversation.title}
                </div>
                <div class="conversation-menu">
                  <button
                    class="menu-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dropdownId.value = dropdownId.value === conversation.id ? null : conversation.id;
                    }}
                  >
                    ⋮
                  </button>
                  {dropdownId.value === conversation.id && (
                    <div class="dropdown-menu">
                      <button onClick={() => handleRename(conversation)}>
                        Rename
                      </button>
                      <button onClick={() => handleDelete(conversation.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div class="conversation-list-footer">
        <button class="new-conversation-btn" onClick={onCreate}>
          New Conversation
        </button>
        <button
          onClick={onSettingsClick}
          class="settings-button"
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}