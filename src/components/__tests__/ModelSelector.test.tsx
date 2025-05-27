import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelSelector } from '../ModelSelector';
import * as store from '../../store';

// Mock fetch
global.fetch = vi.fn();

// Mock the store
vi.mock('../../store', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { signal } = require('@preact/signals');
  return {
    settings: signal({ baseURL: 'https://api.test.com', apiKey: 'test-key', defaultModel: '' }),
    getCachedModels: vi.fn(),
    setCachedModels: vi.fn(),
    availableModels: signal([]),
    errorMessage: signal(null),
    errorTimestamp: signal(null),
    showError: vi.fn(),
    clearError: vi.fn()
  };
});

// Mock signals
vi.mock('@preact/signals', () => ({
  signal: vi.fn((initialValue) => ({ value: initialValue })),
  computed: vi.fn((fn) => ({ value: fn() })),
  effect: vi.fn()
}));

describe('ModelSelector', () => {
  const mockProps = {
    selectedModel: 'gpt-4',
    onModelChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
    (store.getCachedModels as ReturnType<typeof vi.fn>).mockReturnValue(null);
    store.availableModels.value = [];
  });

  it('renders with selected model', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' },
          { id: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('gpt-4')).toBeInTheDocument();
    });
  });

  it('fetches models on mount when baseURL and apiKey are provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/models', {
        headers: {
          'Authorization': 'Bearer test-key',
          'Content-Type': 'application/json'
        }
      });
    });
  });

  it('opens dropdown when button is clicked', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' },
          { id: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('GPT-4 model')).toBeInTheDocument();
      expect(screen.getByText('GPT-3.5 Turbo')).toBeInTheDocument();
    });
  });

  it('calls onModelChange when model is selected', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' },
          { id: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    // Open dropdown
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Select a model
    await waitFor(() => {
      const option = screen.getByText('gpt-3.5-turbo');
      fireEvent.click(option);
    });

    expect(mockProps.onModelChange).toHaveBeenCalledWith('gpt-3.5-turbo');
  });

  it('shows error message when fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    render(<ModelSelector {...mockProps} />);

    // First click to open dropdown and trigger error display
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    render(<ModelSelector {...mockProps} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('disables button when loading or no models', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    render(<ModelSelector {...mockProps} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('highlights selected model in dropdown', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' },
          { id: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    // Open dropdown
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const options = screen.getAllByText('gpt-4');
      const selectedOption = options[1].closest('button'); // Get the one in dropdown
      expect(selectedOption).toHaveClass('selected');
    });
  });

  it('closes dropdown when clicking outside', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    // Open dropdown
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('GPT-4 model')).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('GPT-4 model')).not.toBeInTheDocument();
    });
  });

  it('filters models based on search input', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' },
          { id: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' },
          { id: 'claude-3', description: 'Claude 3 model' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    // Open dropdown
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });

    // Type in search
    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'gpt' } });

    await waitFor(() => {
      // Should show 2 gpt models, not the claude model
      const modelOptions = screen.getAllByText(/^gpt-/);
      expect(modelOptions).toHaveLength(3); // 1 in button text + 2 in dropdown
      expect(screen.queryByText('claude-3')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when search has no matches', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4', description: 'GPT-4 model' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    // Open dropdown
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });

    // Type in search with no matches
    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No models found matching "nonexistent"')).toBeInTheDocument();
    });
  });

  it('uses cached models when available', async () => {
    const cachedModels = [
      { id: 'cached-model', name: 'cached-model', description: 'From cache' }
    ];

    (store.getCachedModels as ReturnType<typeof vi.fn>).mockReturnValue(cachedModels);

    render(<ModelSelector {...{ ...mockProps, selectedModel: 'cached-model' }} />);

    await waitFor(() => {
      expect(screen.getByText('cached-model')).toBeInTheDocument();
    });

    // Should not fetch from API when cache is fresh
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('navigates options with keyboard', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'model-1', description: 'Model 1' },
          { id: 'model-2', description: 'Model 2' }
        ]
      })
    });

    render(<ModelSelector {...mockProps} />);

    // Open dropdown
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search models...');

    // Wait for models to be loaded first
    await waitFor(() => {
      expect(screen.getByText('model-1')).toBeInTheDocument();
    });

    // Navigate down
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    await waitFor(() => {
      const firstOption = screen.getByText('model-1').closest('button');
      expect(firstOption).toHaveClass('highlighted');
    });

    // Navigate down again
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    await waitFor(() => {
      const secondOption = screen.getByText('model-2').closest('button');
      expect(secondOption).toHaveClass('highlighted');
    });

    // Press Enter to select
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(mockProps.onModelChange).toHaveBeenCalledWith('model-2');
  });
});