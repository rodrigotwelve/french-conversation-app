import { renderHook, act } from '@testing-library/react';
import { useAudioPipeline } from '../hooks/useAudioPipeline';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useAudioPipeline hook', () => {
    let mockAddModule: ReturnType<typeof vi.fn>;
    let mockCreateMediaStreamSource: ReturnType<typeof vi.fn>;
    let mockCreateBuffer: ReturnType<typeof vi.fn>;
    let mockCreateBufferSource: ReturnType<typeof vi.fn>;
    let mockClose: ReturnType<typeof vi.fn>;
    let mockResume: ReturnType<typeof vi.fn>;
    let mockAudioWorkletNode: any;
    let mockGetUserMedia: ReturnType<typeof vi.fn>;
    let mockTracks: Array<{ stop: ReturnType<typeof vi.fn> }>;

    beforeEach(() => {
        mockAddModule = vi.fn().mockResolvedValue(undefined);
        mockCreateMediaStreamSource = vi.fn().mockReturnValue({
            connect: vi.fn(),
            disconnect: vi.fn()
        });
        mockCreateBuffer = vi.fn((channels, length, sampleRate) => {
            const channelData = new Float32Array(length);
            return {
                numberOfChannels: channels,
                length,
                sampleRate,
                copyToChannel: vi.fn((data, ch) => {
                    channelData.set(data);
                }),
                getChannelData: vi.fn(() => channelData)
            };
        });
        mockCreateBufferSource = vi.fn().mockReturnValue({
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null
        });
        mockClose = vi.fn().mockResolvedValue(undefined);
        mockResume = vi.fn().mockResolvedValue(undefined);

        class MockAudioWorkletNode {
            port = {
                onmessage: null as ((ev: any) => void) | null,
                postMessage: vi.fn()
            };
            connect = vi.fn();
            disconnect = vi.fn();
            constructor() {
                mockAudioWorkletNode = this;
            }
        }

        class MockAudioContext {
            sampleRate: number;
            currentTime = 0;
            state = 'running';
            destination = {};
            audioWorklet = {
                addModule: mockAddModule
            };
            createMediaStreamSource = mockCreateMediaStreamSource;
            createBuffer = mockCreateBuffer;
            createBufferSource = mockCreateBufferSource;
            close = mockClose;
            resume = mockResume;

            constructor(options?: { sampleRate?: number }) {
                this.sampleRate = options?.sampleRate || 44100;
            }
        }

        vi.stubGlobal('AudioContext', MockAudioContext);
        vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);

        mockTracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
        mockGetUserMedia = vi.fn().mockResolvedValue({
            getTracks: vi.fn(() => mockTracks)
        });

        vi.stubGlobal('navigator', {
            mediaDevices: {
                getUserMedia: mockGetUserMedia
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('starts with isRecording as false', () => {
        const { result } = renderHook(() => useAudioPipeline());
        expect(result.current.isRecording).toBe(false);
    });

    it('requests media, loads worklet, and sets isRecording to true on startRecording', async () => {
        const { result } = renderHook(() => useAudioPipeline());
        const onChunk = vi.fn();

        await act(async () => {
            await result.current.startRecording(onChunk);
        });

        expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
        expect(mockAddModule).toHaveBeenCalledWith('/audio-processor.js');
        expect(result.current.isRecording).toBe(true);

        // Simulate incoming audio chunk from worklet
        const pcm16 = new Int16Array([100, -200, 300]);
        const pcmBuffer = pcm16.buffer;

        act(() => {
            if (mockAudioWorkletNode?.port?.onmessage) {
                mockAudioWorkletNode.port.onmessage({ data: pcmBuffer });
            }
        });

        expect(onChunk).toHaveBeenCalled();
        expect(typeof onChunk.mock.calls[0][0]).toBe('string');
    });

    it('cleans up and sets isRecording to false on stopRecording', async () => {
        const { result } = renderHook(() => useAudioPipeline());
        const onChunk = vi.fn();

        await act(async () => {
            await result.current.startRecording(onChunk);
        });

        expect(result.current.isRecording).toBe(true);

        act(() => {
            result.current.stopRecording();
        });

        expect(result.current.isRecording).toBe(false);
        mockTracks.forEach(track => expect(track.stop).toHaveBeenCalled());
        expect(mockClose).toHaveBeenCalled();
    });

    it('schedules playback when playAudioChunk is called with 24kHz base64 PCM', async () => {
        const { result } = renderHook(() => useAudioPipeline());

        // Create a 24kHz test chunk with 10 samples
        const int16Samples = new Int16Array([1000, -1000, 2000, -2000, 3000, -3000, 4000, -4000, 5000, -5000]);
        const uint8 = new Uint8Array(int16Samples.buffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        const base64PCM = btoa(binary);

        act(() => {
            result.current.playAudioChunk(base64PCM);
        });

        expect(mockCreateBuffer).toHaveBeenCalledWith(1, int16Samples.length, 24000);
        expect(mockCreateBufferSource).toHaveBeenCalled();
    });
});
