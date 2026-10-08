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

  it('initializes with default disconnected and empty state', () => {
    const { result } = renderHook(() => useLiveSession());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.transcript).toEqual([]);
    expect(typeof result.current.startSession).toBe('function');
    expect(typeof result.current.endSession).toBe('function');
  });

  it('acquires token and opens WebSocket with setup message on startSession', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'mock-ephemeral-token-123' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    expect(global.fetch).toHaveBeenCalledWith('/api/gemini-token', { method: 'POST' });
    expect(ws.url).toContain('mock-ephemeral-token-123');
    expect(result.current.isConnected).toBe(true);
    expect(ws.send).toHaveBeenCalled();
    const setupMsg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(setupMsg.setup).toBeDefined();
    expect(setupMsg.setup.model).toBe('models/gemini-2.0-flash-exp');
    expect(setupMsg.setup.systemInstruction.parts[0].text).toContain('B2');

    // Verify audio recording was started
    expect(mockStartRecording).toHaveBeenCalled();
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

  it('processes incoming audio chunks and transcript from server message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-xyz' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    // Simulate incoming server audio and text turn
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
                  },
                  {
                    text: 'Bonjour ! Comment allez-vous ?'
                  }
                ]
              }
            }
          })
        });
      }
    });

    expect(mockPlayAudioChunk).toHaveBeenCalledWith('base64-model-audio-data');
    expect(result.current.transcript).toEqual([
      { role: 'model', text: 'Bonjour ! Comment allez-vous ?' }
    ]);
  });

  it('properly cleans up on endSession', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token-test' })
    });

    const { result } = renderHook(() => useLiveSession());
    const ws = await connectSessionHelper(result);

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.endSession();
    });

    expect(ws.close).toHaveBeenCalled();
    expect(mockStopRecording).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });
});
