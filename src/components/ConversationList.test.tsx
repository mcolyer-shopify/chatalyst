import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { ConversationList } from './ConversationList';
import type { Conversation } from '../types';

// Mock the signals
vi.mock('@preact/signals', () => ({
  signal: vi.fn((initialValue) => ({ value: initialValue })),
  computed: vi.fn((fn) => ({ value: fn() })),
  effect: vi.fn()
}));

describe('ConversationList', () => {
  const mockConversations: Conversation[] = [
    {
      id: '1',
      title: 'First Conversation',
      messages: [],
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

  const mockProps = {
    conversations: mockConversations,
    selectedId: '1',
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSettingsClick: vi.fn(),
    defaultModel: 'gpt-4',
    onDefaultModelChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conversation list with header', () => {
    render(<ConversationList {...mockProps} />);
    
    expect(screen.getByText('New Conversation')).toBeInTheDocument();
  });

  it('renders all conversations', () => {
    render(<ConversationList {...mockProps} />);
    
    expect(screen.getByText('First Conversation')).toBeInTheDocument();
    expect(screen.getByText('Second Conversation')).toBeInTheDocument();
  });

  it('highlights selected conversation', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const selectedItem = container.querySelector('.conversation-item.selected');
    expect(selectedItem).toHaveTextContent('First Conversation');
  });

  it('calls onSelect when conversation is clicked', () => {
    render(<ConversationList {...mockProps} />);
    
    fireEvent.click(screen.getByText('Second Conversation'));
    expect(mockProps.onSelect).toHaveBeenCalledWith('2');
  });

  it('calls onCreate when new button is clicked', () => {
    render(<ConversationList {...mockProps} />);
    
    fireEvent.click(screen.getByText('New Conversation'));
    expect(mockProps.onCreate).toHaveBeenCalled();
  });

  it('shows dropdown menu when menu button is clicked', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides dropdown menu when clicking outside', async () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    
    expect(screen.getByText('Rename')).toBeInTheDocument();
    
    // Click outside
    fireEvent.mouseDown(document.body);
    
    await waitFor(() => {
      expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    });
  });

  it('enters rename mode when rename is clicked', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Rename'));
    
    const input = container.querySelector('.conversation-title-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('First Conversation');
  });

  it('saves rename on Enter key', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Rename'));
    
    const input = container.querySelector('.conversation-title-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockProps.onRename).toHaveBeenCalledWith('1', 'New Name');
  });

  it('cancels rename on Escape key', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Rename'));
    
    const input = container.querySelector('.conversation-title-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(container.querySelector('.conversation-title-input')).not.toBeInTheDocument();
    expect(mockProps.onRename).not.toHaveBeenCalled();
  });

  it('saves rename on blur', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Rename'));
    
    const input = container.querySelector('.conversation-title-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'New Name' } });
    fireEvent.blur(input);
    
    expect(mockProps.onRename).toHaveBeenCalledWith('1', 'New Name');
  });

  it('does not save empty rename', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Rename'));
    
    const input = container.querySelector('.conversation-title-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockProps.onRename).not.toHaveBeenCalled();
  });

  it('calls onDelete when delete is clicked', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Delete'));
    
    expect(mockProps.onDelete).toHaveBeenCalledWith('1');
  });

  it('renders empty state correctly', () => {
    render(<ConversationList {...mockProps} conversations={[]} />);
    
    expect(screen.getByText('New Conversation')).toBeInTheDocument();
    expect(screen.queryByText('First Conversation')).not.toBeInTheDocument();
  });

  it('handles null selectedId', () => {
    const { container } = render(<ConversationList {...mockProps} selectedId={null} />);
    
    const selectedItems = container.querySelectorAll('.conversation-item.selected');
    expect(selectedItems).toHaveLength(0);
  });

  it('stops propagation on menu button click', () => {
    const { container } = render(<ConversationList {...mockProps} />);
    
    const menuButtons = container.querySelectorAll('.menu-button');
    fireEvent.click(menuButtons[1]); // Click menu on second conversation
    
    expect(mockProps.onSelect).not.toHaveBeenCalled();
  });

  it('renders settings button', () => {
    render(<ConversationList {...mockProps} />);
    
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('calls onSettingsClick when settings button is clicked', () => {
    render(<ConversationList {...mockProps} />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    expect(mockProps.onSettingsClick).toHaveBeenCalled();
  });
});