
interface MessageHistoryProps {
  message: string;
  setMessage: (message: string) => void;
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  tempMessage: string;
  setTempMessage: (message: string) => void;
  userMessages: string[];
  inputRef: { current: HTMLTextAreaElement | null };
}

export function useMessageHistory({
  message,
  setMessage,
  historyIndex,
  setHistoryIndex,
  tempMessage,
  setTempMessage,
  userMessages,
  inputRef
}: MessageHistoryProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    const textarea = e.currentTarget as HTMLTextAreaElement;
    
    if (e.key === 'ArrowUp') {
      // Only navigate history if cursor is at position 0
      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        if (userMessages.length > 0) {
          e.preventDefault();
          
          if (historyIndex === -1) {
            // Save current message before navigating
            setTempMessage(message);
          }
          
          const newIndex = Math.min(historyIndex + 1, userMessages.length - 1);
          if (newIndex !== historyIndex) {
            setHistoryIndex(newIndex);
            const historicalMessage = userMessages[userMessages.length - 1 - newIndex];
            setMessage(historicalMessage);
            
            // Set cursor to beginning
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.setSelectionRange(0, 0);
              }
            }, 0);
          }
        }
      }
    } else if (e.key === 'ArrowDown') {
      // Only navigate history if we're in history mode
      if (historyIndex >= 0) {
        e.preventDefault();
        
        const newIndex = historyIndex - 1;
        if (newIndex >= 0) {
          setHistoryIndex(newIndex);
          const historicalMessage = userMessages[userMessages.length - 1 - newIndex];
          setMessage(historicalMessage);
        } else {
          // Return to current message
          setHistoryIndex(-1);
          setMessage(tempMessage);
        }
        
        // Set cursor to end
        setTimeout(() => {
          if (inputRef.current) {
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
          }
        }, 0);
      }
    }
  };

  return { handleKeyDown };
}