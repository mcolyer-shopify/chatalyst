import { useState, useEffect } from 'preact/hooks';
import { Prompt } from '../types';
import { prompts, createPrompt, updatePrompt, deletePromptById, searchPrompts, getAllCategories } from '../store';

interface PromptLibraryModalProps {
  show: boolean;
  onSelectPrompt: (content: string) => void;
  onCancel: () => void;
}

export function PromptLibraryModal({ show, onSelectPrompt, onCancel }: PromptLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tempPrompt, setTempPrompt] = useState<{
    title: string;
    content: string;
    category: string;
    tags: string;
  }>({
    title: '',
    content: '',
    category: '',
    tags: ''
  });

  const filteredPrompts = searchQuery 
    ? searchPrompts(searchQuery)
    : selectedCategory 
      ? prompts.value.filter(p => p.category === selectedCategory)
      : prompts.value;

  const categories = getAllCategories();

  useEffect(() => {
    if (!show) {
      setSearchQuery('');
      setSelectedCategory('');
      setEditingPrompt(null);
      setIsCreating(false);
      setTempPrompt({ title: '', content: '', category: '', tags: '' });
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
    setTempPrompt({ title: '', content: '', category: '', tags: '' });
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setIsCreating(false);
    setTempPrompt({
      title: prompt.title,
      content: prompt.content,
      category: prompt.category || '',
      tags: prompt.tags?.join(', ') || ''
    });
  };

  const handleSavePrompt = async () => {
    if (!tempPrompt.title.trim() || !tempPrompt.content.trim()) {
      return;
    }

    const tags = tempPrompt.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, {
          title: tempPrompt.title,
          content: tempPrompt.content,
          category: tempPrompt.category || undefined,
          tags: tags.length > 0 ? tags : undefined
        });
      } else {
        await createPrompt(
          tempPrompt.title,
          tempPrompt.content,
          tempPrompt.category || undefined,
          tags.length > 0 ? tags : undefined
        );
      }
      setIsCreating(false);
      setEditingPrompt(null);
      setTempPrompt({ title: '', content: '', category: '', tags: '' });
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
    setTempPrompt({ title: '', content: '', category: '', tags: '' });
    onCancel();
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setEditingPrompt(null);
    setTempPrompt({ title: '', content: '', category: '', tags: '' });
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
          
          <div class="form-group">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.currentTarget.value)}
              class="category-select"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
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

            <div class="form-group">
              <label>Category:</label>
              <input
                type="text"
                value={tempPrompt.category}
                onInput={(e) =>
                  setTempPrompt({
                    ...tempPrompt,
                    category: (e.target as HTMLInputElement).value
                  })
                }
                placeholder="Optional category..."
              />
            </div>

            <div class="form-group">
              <label>Tags (comma-separated):</label>
              <input
                type="text"
                value={tempPrompt.tags}
                onInput={(e) =>
                  setTempPrompt({
                    ...tempPrompt,
                    tags: (e.target as HTMLInputElement).value
                  })
                }
                placeholder="tag1, tag2, tag3..."
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
                
                <div class="prompt-meta">
                  {prompt.category && (
                    <span class="prompt-category">📁 {prompt.category}</span>
                  )}
                  {prompt.tags && prompt.tags.length > 0 && (
                    <div class="prompt-tags">
                      {prompt.tags.map(tag => (
                        <span key={tag} class="prompt-tag">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
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