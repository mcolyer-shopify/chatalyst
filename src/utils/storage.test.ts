import { loadConversations, saveConversations, loadSelectedConversationId, saveSelectedConversationId } from './storage';
import type { Conversation } from '../types';
import { showError } from '../store';

// Mock the store module
vi.mock('../store', () => ({
  showError: vi.fn()
}));

// Note: These utilities are now deprecated as we use signals for state management
describe('Storage utilities (deprecated)', () => {
  const mockConversations: Conversation[] = [
    {
      id: '1',
      title: 'First Conversation',
      messages: [
        {
          id: '1',
          content: 'Hello',
          role: 'user',
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: '2',
      title: 'Second Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  beforeEach(() => {
    // Clear localStorage mock
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('loadConversations', () => {
    it('returns empty array when no data exists', () => {
      localStorage.getItem.mockReturnValue(null);
      
      const result = loadConversations();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('chatalyst_conversations');
      expect(result).toEqual([]);
    });

    it('returns parsed conversations from localStorage', () => {
      localStorage.getItem.mockReturnValue(JSON.stringify(mockConversations));
      
      const result = loadConversations();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('chatalyst_conversations');
      expect(result).toEqual(mockConversations);
    });

    it('handles invalid JSON gracefully', () => {
      localStorage.getItem.mockReturnValue('invalid json');
      
      const result = loadConversations();
      
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to load conversations from storage'));
      expect(result).toEqual([]);
    });

    it('handles localStorage errors gracefully', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = loadConversations();
      
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to load conversations from storage'));
      expect(result).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      localStorage.getItem.mockReturnValue('');
      
      const result = loadConversations();
      
      expect(result).toEqual([]);
    });
  });

  describe('saveConversations', () => {
    it('saves conversations to localStorage', () => {
      saveConversations(mockConversations);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'chatalyst_conversations',
        JSON.stringify(mockConversations)
      );
    });

    it('saves empty array', () => {
      saveConversations([]);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'chatalyst_conversations',
        '[]'
      );
    });

    it('handles localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      saveConversations(mockConversations);
      
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to save conversations to storage'));
    });

    it('preserves conversation structure when saving', () => {
      // Reset the mock to not throw errors
      localStorage.setItem.mockImplementation(() => {});
      
      const complexConversation: Conversation = {
        id: '3',
        title: 'Complex Conversation',
        messages: [
          {
            id: '1',
            content: 'Message with special characters: "quotes", \'apostrophes\', and \n newlines',
            role: 'user',
            timestamp: 1704067200000
          },
          {
            id: '2',
            content: 'Unicode: 🎉 emoji support',
            role: 'assistant',
            timestamp: 1704067260000
          }
        ],
        createdAt: 1704067200000,
        updatedAt: 1704067260000
      };

      saveConversations([complexConversation]);
      
      const savedData = localStorage.setItem.mock.calls[0][1];
      const parsed = JSON.parse(savedData);
      
      expect(parsed).toEqual([complexConversation]);
    });
  });

  describe('Integration', () => {
    it('can save and load conversations', () => {
      // Override mock implementations for this test
      let storage: { [key: string]: string } = {};
      
      localStorage.setItem.mockImplementation((key, value) => {
        storage[key] = value;
      });
      
      localStorage.getItem.mockImplementation((key) => storage[key] || null);
      
      // Save conversations
      saveConversations(mockConversations);
      
      // Load conversations
      const loaded = loadConversations();
      
      expect(loaded).toEqual(mockConversations);
    });
  });

  describe('loadSelectedConversationId', () => {
    it('returns null when no selected conversation exists', () => {
      localStorage.getItem.mockReturnValue(null);
      
      const result = loadSelectedConversationId();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('chatalyst_selected_conversation');
      expect(result).toBeNull();
    });

    it('returns the selected conversation ID from localStorage', () => {
      const conversationId = 'conversation-123';
      localStorage.getItem.mockReturnValue(conversationId);
      
      const result = loadSelectedConversationId();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('chatalyst_selected_conversation');
      expect(result).toBe(conversationId);
    });

    it('handles localStorage errors gracefully', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = loadSelectedConversationId();
      
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to load selected conversation from storage'));
      expect(result).toBeNull();
    });
  });

  describe('saveSelectedConversationId', () => {
    it('saves conversation ID to localStorage', () => {
      const conversationId = 'conversation-456';
      
      saveSelectedConversationId(conversationId);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'chatalyst_selected_conversation',
        conversationId
      );
    });

    it('removes item from localStorage when ID is null', () => {
      saveSelectedConversationId(null);
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('chatalyst_selected_conversation');
    });

    it('handles localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      saveSelectedConversationId('conversation-789');
      
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to save selected conversation to storage'));
    });

    it('handles removeItem errors gracefully', () => {
      localStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      saveSelectedConversationId(null);
      
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to save selected conversation to storage'));
    });
  });

  describe('Selected Conversation Integration', () => {
    it('can save and load selected conversation ID', () => {
      // Override mock implementations for this test
      let storage: { [key: string]: string } = {};
      
      localStorage.setItem.mockImplementation((key, value) => {
        storage[key] = value;
      });
      
      localStorage.getItem.mockImplementation((key) => storage[key] || null);
      
      localStorage.removeItem.mockImplementation((key) => {
        delete storage[key];
      });
      
      const conversationId = 'test-conversation-123';
      
      // Save conversation ID
      saveSelectedConversationId(conversationId);
      
      // Load conversation ID
      const loaded = loadSelectedConversationId();
      
      expect(loaded).toBe(conversationId);
      
      // Test null case
      saveSelectedConversationId(null);
      const loadedNull = loadSelectedConversationId();
      
      expect(loadedNull).toBeNull();
    });
  });
});