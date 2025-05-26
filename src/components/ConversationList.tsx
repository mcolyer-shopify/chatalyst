import { useState, useRef, useEffect } from 'preact/hooks';
import type { Conversation } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete
}: ConversationListProps) {
  const [dropdownId, setDropdownId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
    setDropdownId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setDropdownId(null);
  };

  return (
    <div class="conversation-list">
      <div class="conversation-list-header">
        <h2>Conversations</h2>
        <button class="new-conversation-btn" onClick={onCreate}>
          + New
        </button>
      </div>
      <div class="conversations">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            class={`conversation-item ${selectedId === conversation.id ? 'selected' : ''}`}
          >
            {editingId === conversation.id ? (
              <input
                type="text"
                value={editTitle}
                onInput={(e) => setEditTitle(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRename(conversation.id);
                  } else if (e.key === 'Escape') {
                    setEditingId(null);
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
                <div class="conversation-menu" ref={dropdownRef}>
                  <button
                    class="menu-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownId(dropdownId === conversation.id ? null : conversation.id);
                    }}
                  >
                    ⋮
                  </button>
                  {dropdownId === conversation.id && (
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
    </div>
  );
}