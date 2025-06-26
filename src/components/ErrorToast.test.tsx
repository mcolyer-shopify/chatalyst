import { render, screen, fireEvent } from '@testing-library/preact';
import { ErrorToast } from './ErrorToast';

describe('ErrorToast', () => {
  const mockOnClose = vi.fn();
  const defaultMessage = 'Test error message';

  beforeEach(() => {
    mockOnClose.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders error message correctly', () => {
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    expect(screen.getByText(defaultMessage)).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    expect(screen.getByTitle('Dismiss error notification')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    const closeButton = screen.getByTitle('Dismiss error notification');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('automatically closes after default duration', async () => {
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    // Fast-forward time by 4 seconds (default duration)
    vi.advanceTimersByTime(4000);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('automatically closes after custom duration', async () => {
    const customDuration = 2000;
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} duration={customDuration} />);
    
    // Fast-forward time by custom duration
    vi.advanceTimersByTime(customDuration);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not close before duration expires', () => {
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    // Fast-forward time by 3 seconds (less than default 4 seconds)
    vi.advanceTimersByTime(3000);
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('has correct CSS classes', () => {
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    expect(document.querySelector('.error-toast')).toBeInTheDocument();
    expect(document.querySelector('.error-toast-content')).toBeInTheDocument();
    expect(document.querySelector('.error-toast-icon')).toBeInTheDocument();
    expect(document.querySelector('.error-toast-message')).toBeInTheDocument();
    expect(document.querySelector('.error-toast-close')).toBeInTheDocument();
  });

  it('displays long error messages properly', () => {
    const longMessage = 'This is a very long error message that should be displayed properly within the toast container without breaking the layout or causing issues with the text wrapping and spacing.';
    
    render(<ErrorToast message={longMessage} onClose={mockOnClose} />);
    
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it('close button has correct attributes', () => {
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    const closeButton = screen.getByTitle('Dismiss error notification');
    expect(closeButton).toHaveAttribute('type', 'button');
    expect(closeButton).toHaveTextContent('×');
    expect(closeButton).toHaveAttribute('aria-label', 'Dismiss error notification');
  });

  it('cleans up timer on unmount', () => {
    const { unmount } = render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    // Unmount before timer expires
    unmount();
    
    // Fast-forward time
    vi.advanceTimersByTime(4000);
    
    // onClose should not be called since component was unmounted
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(<ErrorToast message={defaultMessage} onClose={mockOnClose} />);
    
    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
    expect(toast).toHaveAttribute('aria-atomic', 'true');
    
    const icon = screen.getByText('⚠️');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    
    const message = screen.getByText(defaultMessage);
    expect(message).toHaveAttribute('id', 'error-message');
    
    const closeButton = screen.getByTitle('Dismiss error notification');
    expect(closeButton).toHaveAttribute('aria-describedby', 'error-message');
  });
});