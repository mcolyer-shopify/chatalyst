import { render, screen, fireEvent } from '@testing-library/preact';
import { EnvVarsTable } from './EnvVarsTable';

describe('EnvVarsTable', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders table with headers', () => {
    render(<EnvVarsTable env={{}} onChange={mockOnChange} />);
    
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders existing environment variables', () => {
    const env = {
      'API_KEY': 'secret-key',
      'BASE_URL': 'https://api.example.com',
      'TIMEOUT': '30'
    };
    
    render(<EnvVarsTable env={env} onChange={mockOnChange} />);
    
    expect(screen.getByText('API_KEY')).toBeInTheDocument();
    expect(screen.getByText('secret-key')).toBeInTheDocument();
    expect(screen.getByText('BASE_URL')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
    expect(screen.getByText('TIMEOUT')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('adds new environment variable', () => {
    render(<EnvVarsTable env={{}} onChange={mockOnChange} />);
    
    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('value');
    const addButton = screen.getByText('Add');
    
    // Initially disabled
    expect(addButton).toBeDisabled();
    
    // Enter key
    fireEvent.input(keyInput, { target: { value: 'NEW_VAR' } });
    expect(addButton).toBeDisabled(); // Still disabled without value
    
    // Enter value
    fireEvent.input(valueInput, { target: { value: 'new-value' } });
    expect(addButton).not.toBeDisabled();
    
    // Click add
    fireEvent.click(addButton);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      'NEW_VAR': 'new-value'
    });
  });

  it('clears input fields after adding', () => {
    render(<EnvVarsTable env={{}} onChange={mockOnChange} />);
    
    const keyInput = screen.getByPlaceholderText('KEY') as HTMLInputElement;
    const valueInput = screen.getByPlaceholderText('value') as HTMLInputElement;
    const addButton = screen.getByText('Add');
    
    fireEvent.input(keyInput, { target: { value: 'TEST_KEY' } });
    fireEvent.input(valueInput, { target: { value: 'test-value' } });
    fireEvent.click(addButton);
    
    expect(keyInput.value).toBe('');
    expect(valueInput.value).toBe('');
  });

  it('removes environment variable', () => {
    const env = {
      'KEY1': 'value1',
      'KEY2': 'value2',
      'KEY3': 'value3'
    };
    
    render(<EnvVarsTable env={env} onChange={mockOnChange} />);
    
    const removeButtons = screen.getAllByText('Remove');
    expect(removeButtons).toHaveLength(3);
    
    // Remove the second item
    fireEvent.click(removeButtons[1]);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      'KEY1': 'value1',
      'KEY3': 'value3'
    });
  });

  it('trims whitespace from key and value', () => {
    render(<EnvVarsTable env={{}} onChange={mockOnChange} />);
    
    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('value');
    const addButton = screen.getByText('Add');
    
    fireEvent.input(keyInput, { target: { value: '  PADDED_KEY  ' } });
    fireEvent.input(valueInput, { target: { value: '  padded-value  ' } });
    fireEvent.click(addButton);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      'PADDED_KEY': 'padded-value'
    });
  });

  it('does not enable add button with only whitespace', () => {
    render(<EnvVarsTable env={{}} onChange={mockOnChange} />);
    
    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('value');
    const addButton = screen.getByText('Add');
    
    fireEvent.input(keyInput, { target: { value: '   ' } });
    fireEvent.input(valueInput, { target: { value: '   ' } });
    
    expect(addButton).toBeDisabled();
  });

  it('handles adding to existing environment variables', () => {
    const env = {
      'EXISTING': 'value'
    };
    
    render(<EnvVarsTable env={env} onChange={mockOnChange} />);
    
    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('value');
    const addButton = screen.getByText('Add');
    
    fireEvent.input(keyInput, { target: { value: 'NEW_KEY' } });
    fireEvent.input(valueInput, { target: { value: 'new-value' } });
    fireEvent.click(addButton);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      'EXISTING': 'value',
      'NEW_KEY': 'new-value'
    });
  });

  it('overwrites existing key when adding duplicate', () => {
    const env = {
      'DUPLICATE': 'old-value'
    };
    
    render(<EnvVarsTable env={env} onChange={mockOnChange} />);
    
    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('value');
    const addButton = screen.getByText('Add');
    
    fireEvent.input(keyInput, { target: { value: 'DUPLICATE' } });
    fireEvent.input(valueInput, { target: { value: 'new-value' } });
    fireEvent.click(addButton);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      'DUPLICATE': 'new-value'
    });
  });

  it('handles null or undefined env prop', () => {
    render(<EnvVarsTable env={null as any} onChange={mockOnChange} />);
    
    // Should render without errors
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    
    // Should be able to add new variables
    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('value');
    const addButton = screen.getByText('Add');
    
    fireEvent.input(keyInput, { target: { value: 'TEST' } });
    fireEvent.input(valueInput, { target: { value: 'value' } });
    fireEvent.click(addButton);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      'TEST': 'value'
    });
  });
});