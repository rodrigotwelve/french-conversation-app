import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioPipelineReturn {
    startRecording: (onChunk: (base64PCM: string) => void) => Promise<void>;
    stopRecording: () => void;
    playAudioChunk: (base64PCM: string) => void;
    isRecording: boolean;
}

export function useAudioPipeline(): UseAudioPipelineReturn {
    const [isRecording, setIsRecording] = useState(false);

    // Recording refs
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioCtxRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Playback refs
    const outputAudioCtxRef = useRef<AudioContext | null>(null);
    const nextPlaybackTimeRef = useRef<number>(0);

    const getOutputAudioContext = useCallback(() => {
        if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
            const ctx = new AudioContext({ sampleRate: 24000 });
            outputAudioCtxRef.current = ctx;
            nextPlaybackTimeRef.current = 0;
        }
        if (outputAudioCtxRef.current.state === 'suspended') {
            outputAudioCtxRef.current.resume();
        }
        return outputAudioCtxRef.current;
    }, []);

    const playAudioChunk = useCallback((base64PCM: string) => {
        try {
            if (!base64PCM) return;

            const binaryString = atob(base64PCM);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const sampleCount = Math.floor(bytes.byteLength / 2);
            if (sampleCount === 0) return;

            const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);
            if (int16Array.length === 0) return;

            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
            }

            const ctx = getOutputAudioContext();
            const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
            if (audioBuffer.copyToChannel) {
                audioBuffer.copyToChannel(float32Array, 0);
            } else {
                audioBuffer.getChannelData(0).set(float32Array);
            }

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            const currentTime = ctx.currentTime;
            const startTime = Math.max(currentTime, nextPlaybackTimeRef.current);
            source.start(startTime);
            nextPlaybackTimeRef.current = startTime + audioBuffer.duration;
        } catch (err) {
            console.error('Error playing audio chunk:', err);
        }
    }, [getOutputAudioContext]);

    const stopRecording = useCallback(() => {
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }

        if (sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }

        if (inputAudioCtxRef.current) {
            if (inputAudioCtxRef.current.state !== 'closed') {
                inputAudioCtxRef.current.close().catch(() => {});
            }
            inputAudioCtxRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        setIsRecording(false);
    }, []);

    const startRecording = useCallback(
        async (onChunk: (base64PCM: string) => void) => {
            stopRecording();

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaStreamRef.current = stream;

                const inputCtx = new AudioContext({ sampleRate: 16000 });
                inputAudioCtxRef.current = inputCtx;

                await inputCtx.audioWorklet.addModule('/audio-processor.js');

                const source = inputCtx.createMediaStreamSource(stream);
                sourceNodeRef.current = source;

                const workletNode = new AudioWorkletNode(inputCtx, 'audio-processor');
                workletNodeRef.current = workletNode;

                workletNode.port.onmessage = (event) => {
                    const arrayBuffer: ArrayBuffer = event.data;
                    const uint8 = new Uint8Array(arrayBuffer);
                    let binary = '';
                    const chunkSize = 8192;
                    for (let i = 0; i < uint8.length; i += chunkSize) {
                        const sub = uint8.subarray(i, i + chunkSize);
                        binary += String.fromCharCode.apply(null, sub as unknown as number[]);
                    }
                    const base64 = btoa(binary);
                    onChunk(base64);
                };

                source.connect(workletNode);
                setIsRecording(true);
            } catch (err) {
                stopRecording();
                throw err;
            }
        },
        [stopRecording]
    );

    useEffect(() => {
        return () => {
            stopRecording();
            if (outputAudioCtxRef.current) {
                if (outputAudioCtxRef.current.state !== 'closed') {
                    outputAudioCtxRef.current.close().catch(() => {});
                }
                outputAudioCtxRef.current = null;
            }
        };
    }, [stopRecording]);

    return {
        startRecording,
        stopRecording,
        playAudioChunk,
        isRecording
    };
}
