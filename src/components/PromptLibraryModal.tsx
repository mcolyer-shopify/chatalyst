import { useState, useEffect } from 'preact/hooks';
import { Prompt } from '../types';
import { prompts, createPrompt, updatePrompt, deletePromptById, searchPrompts } from '../store';

interface PromptLibraryModalProps {
  show: boolean;
  onSelectPrompt: (content: string) => void;
  onCancel: () => void;
}

export function PromptLibraryModal({ show, onSelectPrompt, onCancel }: PromptLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tempPrompt, setTempPrompt] = useState<{
    title: string;
    content: string;
  }>({
    title: '',
    content: ''
  });

  // Debounce search query to improve performance with large prompt libraries
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filteredPrompts = debouncedSearchQuery 
    ? searchPrompts(debouncedSearchQuery)
    : prompts.value;

  useEffect(() => {
    if (!show) {
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setEditingPrompt(null);
      setIsCreating(false);
      setTempPrompt({ title: '', content: '' });
    }
  }, [show]);

  if (!show) return null;

  const handleSelectPrompt = (prompt: Prompt) => {
    onSelectPrompt(prompt.content);
    onCancel();
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingPrompt(null);
    setTempPrompt({ title: '', content: '' });
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setIsCreating(false);
    setTempPrompt({
      title: prompt.title,
      content: prompt.content
    });
  };

  const handleSavePrompt = async () => {
    if (!tempPrompt.title.trim() || !tempPrompt.content.trim()) {
      return;
    }

    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, {
          title: tempPrompt.title,
          content: tempPrompt.content
        });
      } else {
        await createPrompt(
          tempPrompt.title,
          tempPrompt.content
        );
      }
      setIsCreating(false);
      setEditingPrompt(null);
      setTempPrompt({ title: '', content: '' });
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      try {
        await deletePromptById(promptId);
        if (editingPrompt?.id === promptId) {
          setEditingPrompt(null);
          setIsCreating(false);
        }
      } catch (error) {
        console.error('Failed to delete prompt:', error);
      }
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingPrompt(null);
    setTempPrompt({ title: '', content: '' });
    onCancel();
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setEditingPrompt(null);
    setTempPrompt({ title: '', content: '' });
  };

  return (
    <>
      <div class="modal-backdrop" onClick={handleCancel} />
      <div class="modal prompt-library-modal">
        <h2>Prompt Library</h2>

        {/* Search and Filter Controls */}
        <div class="prompt-library-controls">
          <div class="form-group">
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              class="search-input"
            />
          </div>

          <button onClick={handleCreateNew} class="button-primary">
            + New Prompt
          </button>
        </div>

        {/* Edit/Create Form */}
        {(isCreating || editingPrompt) && (
          <div class="prompt-form">
            <div class="form-group">
              <label>Title:</label>
              <input
                type="text"
                value={tempPrompt.title}
                onInput={(e) =>
                  setTempPrompt({
                    ...tempPrompt,
                    title: (e.target as HTMLInputElement).value
                  })
                }
                placeholder="Enter prompt title..."
              />
            </div>

            <div class="form-group">
              <label>Content:</label>
              <textarea
                value={tempPrompt.content}
                onInput={(e) =>
                  setTempPrompt({
                    ...tempPrompt,
                    content: (e.target as HTMLTextAreaElement).value
                  })
                }
                placeholder="Enter prompt content..."
                rows={4}
              />
            </div>


            <div class="form-actions">
              <button onClick={handleCancelEdit} class="button-secondary">
                Cancel
              </button>
              <button onClick={handleSavePrompt} class="button-primary">
                {editingPrompt ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Prompt List */}
        <div class="prompt-list">
          {filteredPrompts.length === 0 ? (
            <div class="empty-state">
              {prompts.value.length === 0 
                ? 'No prompts yet. Create your first prompt!'
                : 'No prompts match your search criteria.'
              }
            </div>
          ) : (
            filteredPrompts.map(prompt => (
              <div key={prompt.id} class="prompt-item">
                <div class="prompt-header">
                  <h3 class="prompt-title">{prompt.title}</h3>
                  <div class="prompt-actions">
                    <button
                      onClick={() => handleSelectPrompt(prompt)}
                      class="button-secondary use-prompt-btn"
                      title="Use this prompt"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => handleEditPrompt(prompt)}
                      class="button-secondary edit-prompt-btn"
                      title="Edit prompt"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(prompt.id)}
                      class="button-secondary delete-prompt-btn"
                      title="Delete prompt"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div class="prompt-content">{prompt.content}</div>
              </div>
            ))
          )}
        </div>

        <div class="modal-actions">
          <button onClick={handleCancel} class="button-secondary">
            Close
          </button>
        </div>
      </div>
    </>
  );
}