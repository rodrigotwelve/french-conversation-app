import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioLevels {
    inputLevel: number;
    outputLevel: number;
    timeDomainData: Uint8Array<ArrayBuffer>;
}

export interface UseAudioPipelineReturn {
    startRecording: (onChunk: (base64PCM: string) => void) => Promise<void>;
    stopRecording: () => void;
    playAudioChunk: (base64PCM: string) => void;
    isRecording: boolean;
    getAudioLevels: () => AudioLevels;
}

export function useAudioPipeline(): UseAudioPipelineReturn {
    const [isRecording, setIsRecording] = useState(false);

    // Recording refs
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioCtxRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const inputAnalyserRef = useRef<AnalyserNode | null>(null);

    // Playback refs
    const outputAudioCtxRef = useRef<AudioContext | null>(null);
    const outputAnalyserRef = useRef<AnalyserNode | null>(null);
    const nextPlaybackTimeRef = useRef<number>(0);

    // Reusable buffers for telemetry without GC thrashing
    const inputFreqBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const outputFreqBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const timeDomainBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);


    const getOutputAudioContext = useCallback(() => {
        if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
            const ctx = new AudioContext({ sampleRate: 24000 });
            outputAudioCtxRef.current = ctx;
            nextPlaybackTimeRef.current = 0;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.connect(ctx.destination);
            outputAnalyserRef.current = analyser;
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

            if (outputAnalyserRef.current) {
                source.connect(outputAnalyserRef.current);
            } else {
                source.connect(ctx.destination);
            }

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

        if (inputAnalyserRef.current) {
            inputAnalyserRef.current.disconnect();
            inputAnalyserRef.current = null;
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

                const analyser = inputCtx.createAnalyser();
                analyser.fftSize = 256;
                inputAnalyserRef.current = analyser;

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

                source.connect(analyser);
                source.connect(workletNode);
                setIsRecording(true);
            } catch (err) {
                stopRecording();
                throw err;
            }
        },
        [stopRecording]
    );

    const getAudioLevels = useCallback((): AudioLevels => {
        let inputLevel = 0;
        let outputLevel = 0;

        if (!timeDomainBufferRef.current) {
            timeDomainBufferRef.current = new Uint8Array(128).fill(128);
        }
        const fallbackBuffer = timeDomainBufferRef.current;

        // Input stream telemetry
        if (inputAnalyserRef.current && inputAudioCtxRef.current && inputAudioCtxRef.current.state === 'running') {
            const analyser = inputAnalyserRef.current;
            if (!inputFreqBufferRef.current || inputFreqBufferRef.current.length !== analyser.frequencyBinCount) {
                inputFreqBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
            }
            const data = inputFreqBufferRef.current;
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i];
            }
            inputLevel = sum / (data.length * 255);
        }

        // Output stream telemetry
        if (outputAnalyserRef.current && outputAudioCtxRef.current && outputAudioCtxRef.current.state === 'running') {
            const analyser = outputAnalyserRef.current;
            if (!outputFreqBufferRef.current || outputFreqBufferRef.current.length !== analyser.frequencyBinCount) {
                outputFreqBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
            }
            const data = outputFreqBufferRef.current;
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i];
            }
            outputLevel = sum / (data.length * 255);
        }

        // Prefer active stream for waveform rendering (output if playing, else input)
        const activeAnalyser = (outputLevel > 0.01 && outputLevel >= inputLevel)
            ? outputAnalyserRef.current
            : (inputAnalyserRef.current || outputAnalyserRef.current);

        if (activeAnalyser) {
            const fftSize = activeAnalyser.fftSize;
            if (!timeDomainBufferRef.current || timeDomainBufferRef.current.length !== fftSize) {
                timeDomainBufferRef.current = new Uint8Array(fftSize);
            }
            activeAnalyser.getByteTimeDomainData(timeDomainBufferRef.current);
            return {
                inputLevel: Math.min(1, Math.max(0, inputLevel)),
                outputLevel: Math.min(1, Math.max(0, outputLevel)),
                timeDomainData: timeDomainBufferRef.current
            };
        }

        return {
            inputLevel: 0,
            outputLevel: 0,
            timeDomainData: fallbackBuffer
        };
    }, []);

    useEffect(() => {
        return () => {
            stopRecording();
            if (outputAnalyserRef.current) {
                outputAnalyserRef.current.disconnect();
                outputAnalyserRef.current = null;
            }
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
        isRecording,
        getAudioLevels
    };
}

