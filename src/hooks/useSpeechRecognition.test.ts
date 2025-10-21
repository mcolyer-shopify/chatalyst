import { renderHook, act } from '@testing-library/preact';
import { useSpeechRecognition } from './useSpeechRecognition';

// Define types for testing
interface MockWindow {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

interface SpeechRecognitionResultEvent {
  results: {
    length: number;
    [key: number]: {
      [key: number]: { transcript: string; confidence: number };
      isFinal: boolean;
      length: number;
    };
    item: (index: number) => SpeechRecognitionResultEvent['results'][number];
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

// Mock SpeechRecognition
const mockSpeechRecognition = {
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  maxAlternatives: 1,
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  onerror: null,
  onresult: null,
  onstart: null,
  onend: null
};

const mockSpeechRecognitionConstructor = vi.fn(() => mockSpeechRecognition);

// Mock window with SpeechRecognition
const mockWindow = {
  ...window,
  SpeechRecognition: mockSpeechRecognitionConstructor
};

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeechRecognition.onerror = null;
    mockSpeechRecognition.onresult = null;
    mockSpeechRecognition.onstart = null;
    mockSpeechRecognition.onend = null;
    
    // Mock global window
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.interimTranscript).toBe('');
    expect(result.current.error).toBe(null);
  });

  it('should detect unsupported browser', () => {
    const windowWithoutSpeech = { ...window } as MockWindow;
    delete windowWithoutSpeech.SpeechRecognition;
    delete windowWithoutSpeech.webkitSpeechRecognition;

    Object.defineProperty(global, 'window', {
      value: windowWithoutSpeech,
      writable: true
    });

    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);
  });

  it('should start listening when startListening is called', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    expect(mockSpeechRecognitionConstructor).toHaveBeenCalled();
    expect(mockSpeechRecognition.start).toHaveBeenCalled();
    expect(mockSpeechRecognition.continuous).toBe(true);
    expect(mockSpeechRecognition.interimResults).toBe(true);
    expect(mockSpeechRecognition.lang).toBe('en-US');
    expect(result.current.isProcessing).toBe(true);
  });

  it('should handle speech recognition start event', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Simulate onstart event
    act(() => {
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }
    });

    expect(result.current.isListening).toBe(true);
    expect(result.current.isProcessing).toBe(false);
  });

  it('should handle speech recognition result event', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Mock speech recognition result event
    const mockResultEvent: SpeechRecognitionResultEvent = {
      results: {
        length: 1,
        0: {
          0: { transcript: 'Hello world', confidence: 0.9 },
          isFinal: true,
          length: 1
        },
        item: (index: number) => mockResultEvent.results[index as keyof typeof mockResultEvent.results]
      },
      resultIndex: 0
    };

    act(() => {
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockResultEvent as never);
      }
    });

    expect(result.current.transcript).toBe('Hello world');
  });

  it('should handle interim results', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Mock interim result event
    const mockInterimEvent: SpeechRecognitionResultEvent = {
      results: {
        length: 1,
        0: {
          0: { transcript: 'Hello', confidence: 0.5 },
          isFinal: false,
          length: 1
        },
        item: (index: number) => mockInterimEvent.results[index as keyof typeof mockInterimEvent.results]
      },
      resultIndex: 0
    };

    act(() => {
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockInterimEvent as never);
      }
    });

    expect(result.current.interimTranscript).toBe('Hello');
    expect(result.current.transcript).toBe('');
  });

  it('should handle speech recognition errors', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Mock error event
    const mockErrorEvent: SpeechRecognitionErrorEvent = {
      error: 'not-allowed',
      message: 'Permission denied'
    };

    act(() => {
      if (mockSpeechRecognition.onerror) {
        mockSpeechRecognition.onerror(mockErrorEvent as never);
      }
    });

    expect(result.current.error).toBe('Microphone permission denied. Please allow microphone access.');
    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(false);
  });

  it('should stop listening when stopListening is called', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Set listening state
    act(() => {
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }
    });

    act(() => {
      result.current.stopListening();
    });

    expect(mockSpeechRecognition.stop).toHaveBeenCalled();
  });

  it('should handle end event', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Simulate onend event
    act(() => {
      if (mockSpeechRecognition.onend) {
        mockSpeechRecognition.onend(new Event('end'));
      }
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.interimTranscript).toBe('');
  });

  it('should clear transcript when clearTranscript is called', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    // Set some transcript data
    act(() => {
      result.current.startListening();
    });

    const mockResultEvent: SpeechRecognitionResultEvent = {
      results: {
        length: 1,
        0: {
          0: { transcript: 'Test transcript', confidence: 0.9 },
          isFinal: true,
          length: 1
        },
        item: (index: number) => mockResultEvent.results[index as keyof typeof mockResultEvent.results]
      },
      resultIndex: 0
    };

    act(() => {
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockResultEvent as never);
      }
    });

    expect(result.current.transcript).toBe('Test transcript');

    act(() => {
      result.current.clearTranscript();
    });

    expect(result.current.transcript).toBe('');
    expect(result.current.interimTranscript).toBe('');
  });

  it('should use custom language', () => {
    const { result } = renderHook(() => useSpeechRecognition('es-ES'));

    act(() => {
      result.current.startListening();
    });

    expect(mockSpeechRecognition.lang).toBe('es-ES');
  });

  it('should show error for unsupported browser when starting', () => {
    const windowWithoutSpeech = { ...window } as MockWindow;
    delete windowWithoutSpeech.SpeechRecognition;
    delete windowWithoutSpeech.webkitSpeechRecognition;

    Object.defineProperty(global, 'window', {
      value: windowWithoutSpeech,
      writable: true
    });

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    expect(result.current.error).toBe('Speech recognition is not supported in this browser');
  });
});