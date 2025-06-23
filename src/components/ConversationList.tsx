import { useEffect, useState, useMemo } from 'preact/hooks';
import type { Conversation } from '../types';
import { ModelSelector } from './ModelSelector';
import { generatingTitleFor } from '../store';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onGenerateTitle: (id: string) => void;
  onStartFresh: (id: string) => void;
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
  onArchive,
  onUnarchive,
  onGenerateTitle,
  onStartFresh,
  onSettingsClick,
  defaultModel,
  onDefaultModelChange
}: ConversationListProps) {

  // Local component state for UI state
  const [dropdownId, setDropdownId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations based on tab and search query
  const filteredConversations = useMemo(() => {
    const isArchived = activeTab === 'archived';
    return conversations.filter(conv => {
      // Handle undefined archived field (treat as not archived)
      const matchesTab = isArchived ? conv.archived === true : conv.archived !== true;
      const matchesSearch = searchQuery === '' || 
        conv.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [conversations, activeTab, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      // Check if the click is outside any dropdown menu
      if (!target.closest('.conversation-menu')) {
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
        <div class="sidebar-model-selector">
          <ModelSelector
            selectedModel={defaultModel}
            onModelChange={onDefaultModelChange}
            className="sidebar-model-selector"
            showAsDefault={true}
          />
          <button
            onClick={onSettingsClick}
            class="settings-button"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>
        <div class="conversation-tabs">
          <button
            class={`tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('active');
              setSearchQuery('');
            }}
          >
            Active
          </button>
          <button
            class={`tab ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('archived');
              setSearchQuery('');
            }}
          >
            Archive
          </button>
        </div>
        {activeTab === 'archived' && (
          <div class="search-box">
            <input
              type="text"
              placeholder="Search archived conversations..."
              value={searchQuery}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="search-input"
            />
          </div>
        )}
      </div>
      <div class="conversations">
        {filteredConversations.map((conversation) => (
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
                  {generatingTitleFor.value === conversation.id ? (
                    <span style="opacity: 0.6">Generating title...</span>
                  ) : (
                    conversation.title
                  )}
                </div>
                <div class="conversation-menu">
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="menu-icon">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                        Rename
                      </button>
                      {conversation.messages.length > 0 && (
                        <button onClick={() => {
                          onGenerateTitle(conversation.id);
                          setDropdownId(null);
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="menu-icon">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                          </svg>
                          Generate Title
                        </button>
                      )}
                      <button onClick={() => {
                        onStartFresh(conversation.id);
                        setDropdownId(null);
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="menu-icon">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Start Fresh
                      </button>
                      {conversation.archived ? (
                        <button onClick={() => onUnarchive(conversation.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="menu-icon">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                          </svg>
                          Unarchive
                        </button>
                      ) : (
                        <button onClick={() => onArchive(conversation.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="menu-icon">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                          </svg>
                          Archive
                        </button>
                      )}
                      <button onClick={() => handleDelete(conversation.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="menu-icon">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
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
      </div>
    </div>
  );
}