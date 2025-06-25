import { useEffect } from 'preact/hooks';

interface ErrorToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function ErrorToast({ message, onClose, duration = 4000 }: ErrorToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div 
      class="error-toast"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div class="error-toast-content">
        <span 
          class="error-toast-icon" 
          aria-hidden="true"
        >
          ⚠️
        </span>
        <span 
          class="error-toast-message" 
          id="error-message"
        >
          {message}
        </span>
        <button 
          type="button" 
          class="error-toast-close" 
          onClick={onClose}
          title="Dismiss error notification"
          aria-label="Dismiss error notification"
          aria-describedby="error-message"
        >
          ×
        </button>
      </div>
    </div>
  );
}