import { loadConversations, saveConversations } from './storage';
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
});