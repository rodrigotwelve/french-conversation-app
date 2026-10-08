import { renderHook, act } from '@testing-library/react';
import { useLiveSession } from '../hooks/useLiveSession';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn();
const mockPlayAudioChunk = vi.fn();
let mockIsRecording = false;

vi.mock('../hooks/useAudioPipeline', () => ({
  useAudioPipeline: () => ({
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    playAudioChunk: mockPlayAudioChunk,
    isRecording: mockIsRecording,
  })
}));

describe('useLiveSession hook', () => {
  let mockWebSocketInstances: any[] = [];
  let originalWebSocket: any;
  let originalFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketInstances = [];
    mockIsRecording = false;

    originalWebSocket = global.WebSocket;
    originalFetch = global.fetch;

    class MockWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      url: string;
      onopen: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      onclose: ((ev: any) => void) | null = null;
      readyState: number = 0; // CONNECTING
      send = vi.fn();
      close = vi.fn(() => {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose({} as any);
      });

      constructor(url: string) {
        this.url = url;
        mockWebSocketInstances.push(this);
      }
    }

    // @ts-ignore
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  const connectSessionHelper = async (result: any) => {
    let startPromise: Promise<void>;
    act(() => {
      startPromise = result.current.startSession();
    });

    // Wait until fetch resolves and WebSocket instance is created
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const ws = mockWebSocketInstances[0];
    if (!ws) throw new Error('WebSocket instance not created');

    await act(async () => {
      ws.readyState = 1; // OPEN
      if (ws.onopen) await ws.onopen();
      await startPromise;
    });

    return ws;
  };

  it('initializes with default idle state and metrics', () => {
    const { result } = renderHook(() => useLiveSession());

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.transcript).toEqual([]);
    expect(typeof result.current.startSession).toBe('function');
    expect(typeof result.current.endSession).toBe('function');
  });

  it('acquires token and opens v1beta WebSocket with gemini-3.8-live and bidirectional transcription configs', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'mock-ephemeral-token-123' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    expect(global.fetch).toHaveBeenCalledWith('/api/gemini-token', { method: 'POST' });
    
    // Check v1beta endpoint and access_token query param
    expect(ws.url).toContain('v1beta.GenerativeService.BidiGenerateContent');
    expect(ws.url).toContain('access_token=mock-ephemeral-token-123');
    
    expect(result.current.status).toBe('live');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();

    expect(ws.send).toHaveBeenCalled();
    const setupMsg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(setupMsg.setup).toBeDefined();
    expect(setupMsg.setup.model).toBe('models/gemini-3.8-live');
    expect(setupMsg.setup.generationConfig.responseModalities).toContain('AUDIO');
    expect(setupMsg.setup.inputAudioTranscription).toBeDefined();
    expect(setupMsg.setup.outputAudioTranscription).toBeDefined();
    expect(setupMsg.setup.systemInstruction.parts[0].text).toContain('B2');

    // Verify audio recording was started
    expect(mockStartRecording).toHaveBeenCalled();
  });

  it('increments elapsedSeconds while status is live and resets on endSession', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-timer' })
    });

    const { result } = renderHook(() => useLiveSession());
    await connectSessionHelper(result);

    expect(result.current.status).toBe('live');
    expect(result.current.elapsedSeconds).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.elapsedSeconds).toBe(3);

    act(() => {
      result.current.endSession();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('streams audio chunks over WebSocket when recording emits chunks', async () => {
    let capturedOnChunk: ((base64: string) => void) | null = null;
    mockStartRecording.mockImplementation((cb: (base64: string) => void) => {
      capturedOnChunk = cb;
      return Promise.resolve();
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-abc' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    expect(capturedOnChunk).toBeTruthy();

    act(() => {
      if (capturedOnChunk) {
        capturedOnChunk('mock-base64-pcm-chunk');
      }
    });

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: 'mock-base64-pcm-chunk'
            }
          ]
        }
      })
    );
  });

  it('processes incoming user speech transcription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-user-transcription' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    act(() => {
      if (ws.onmessage) {
        ws.onmessage({
          data: JSON.stringify({
            serverContent: {
              inputTranscription: {
                text: 'Bonjour, je voudrais pratiquer mon français.'
              }
            }
          })
        });
      }
    });

    expect(result.current.transcript.length).toBe(1);
    expect(result.current.transcript[0].role).toBe('user');
    expect(result.current.transcript[0].text).toBe('Bonjour, je voudrais pratiquer mon français.');
    expect(result.current.transcript[0].timestamp).toBeDefined();
  });

  it('processes incoming model audio chunks and output transcription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-model' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    act(() => {
      if (ws.onmessage) {
        ws.onmessage({
          data: JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/pcm;rate=24000',
                      data: 'base64-model-audio-data'
                    }
                  }
                ]
              },
              outputTranscription: {
                text: 'Très bien ! De quoi aimeriez-vous parler aujourd’hui ?'
              }
            }
          })
        });
      }
    });

    expect(mockPlayAudioChunk).toHaveBeenCalledWith('base64-model-audio-data');
    expect(result.current.isSpeaking).toBe(true);
    expect(result.current.transcript.length).toBe(1);
    expect(result.current.transcript[0].role).toBe('model');
    expect(result.current.transcript[0].text).toBe('Très bien ! De quoi aimeriez-vous parler aujourd’hui ?');
  });

  it('handles server interruption by stopping speech playback state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-interrupt' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    act(() => {
      if (ws.onmessage) {
        ws.onmessage({
          data: JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [{ inlineData: { data: 'audio-data' } }]
              }
            }
          })
        });
      }
    });
    expect(result.current.isSpeaking).toBe(true);

    act(() => {
      if (ws.onmessage) {
        ws.onmessage({
          data: JSON.stringify({
            serverContent: {
              interrupted: true
            }
          })
        });
      }
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it('sets error status and message when token fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error'
    });

    const { result } = renderHook(() => useLiveSession());

    let errorThrown = false;
    await act(async () => {
      try {
        await result.current.startSession();
      } catch {
        errorThrown = true;
      }
    });

    expect(errorThrown).toBe(true);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Failed to obtain ephemeral token');
  });

  it('sets error status when WebSocket encounters an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-err' })
    });

    const { result } = renderHook(() => useLiveSession());
    
    let startPromise: Promise<void>;
    act(() => {
      startPromise = result.current.startSession();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const ws = mockWebSocketInstances[0];

    await act(async () => {
      if (ws.onerror) ws.onerror(new Error('Connection failed'));
      try {
        await startPromise;
      } catch {
        // expected
      }
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeDefined();
  });
});
