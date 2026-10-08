import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioPipeline } from './useAudioPipeline';

export interface LiveTranscriptItem {
    role: 'user' | 'model';
    text: string;
    timestamp?: string;
}

export type LiveSessionStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface UseLiveSessionReturn {
    startSession: () => Promise<void>;
    endSession: () => void;
    status: LiveSessionStatus;
    error: string | null;
    elapsedSeconds: number;
    isConnected: boolean;
    isSpeaking: boolean;
    transcript: LiveTranscriptItem[];
}

const SYSTEM_INSTRUCTION_TEXT =
    "Tu es un tuteur de français interactif et bienveillant. Ton élève a pour objectif d'atteindre le niveau B2 d'ici avril 2027 pour son PVT en France. Corrige ses erreurs oralement de manière naturelle et encourage-le constamment. Réponds en français de manière concise et dynamique.";

export function useLiveSession(): UseLiveSessionReturn {
    const [status, setStatus] = useState<LiveSessionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState<LiveTranscriptItem[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const { startRecording, stopRecording, playAudioChunk } = useAudioPipeline();

    // Session timer
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (status === 'live') {
            interval = setInterval(() => {
                setElapsedSeconds((prev) => prev + 1);
            }, 1000);
        } else {
            setElapsedSeconds(0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status]);

    const formatTimestamp = () => {
        const now = new Date();
        return now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const cleanupResources = useCallback(() => {
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch {
                // Ignore close errors
            }
            wsRef.current = null;
        }

        stopRecording();
        setIsSpeaking(false);
    }, [stopRecording]);

    const endSession = useCallback(() => {
        cleanupResources();
        setStatus('idle');
        setError(null);
    }, [cleanupResources]);

    const startSession = useCallback(async () => {
        cleanupResources();
        setStatus('connecting');
        setError(null);

        try {
            // 1. Fetch ephemeral token
            const res = await fetch('/api/gemini-token', { method: 'POST' });
            if (!res.ok) {
                const errText = res.statusText || `Status ${res.status}`;
                throw new Error(`Failed to obtain ephemeral token: ${errText}`);
            }
            const data = await res.json();
            const token = data.token;
            if (!token) {
                throw new Error('Ephemeral token not found in response');
            }

            // 2. Open WebSocket with v1beta endpoint and access_token query param
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=${token}`;

            await new Promise<void>((resolve, reject) => {
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = async () => {
                    // Send setup message
                    const setupMessage = {
                        setup: {
                            model: 'models/gemini-3.8-live',
                            generationConfig: {
                                responseModalities: ['AUDIO'],
                            },
                            systemInstruction: {
                                parts: [{ text: SYSTEM_INSTRUCTION_TEXT }],
                            },
                            inputAudioTranscription: {},
                            outputAudioTranscription: {},
                        },
                    };
                    ws.send(JSON.stringify(setupMessage));

                    // Start audio recording and stream chunks
                    try {
                        await startRecording((base64PCM: string) => {
                            if (ws.readyState === WebSocket.OPEN) {
                                const audioMessage = {
                                    realtimeInput: {
                                        mediaChunks: [
                                            {
                                                mimeType: 'audio/pcm;rate=16000',
                                                data: base64PCM,
                                            },
                                        ],
                                    },
                                };
                                ws.send(JSON.stringify(audioMessage));
                            }
                        });

                        setStatus('live');
                        resolve();
                    } catch (err) {
                        cleanupResources();
                        setStatus('error');
                        setError(err instanceof Error ? err.message : 'Microphone recording failed');
                        reject(err);
                    }
                };

                ws.onmessage = (event) => {
                    try {
                        const message = typeof event.data === 'string' ? JSON.parse(event.data) : null;
                        if (!message) return;

                        // Interruption signal
                        if (message.serverContent?.interrupted) {
                            setIsSpeaking(false);
                        }

                        // User speech transcription
                        const userText =
                            message.serverContent?.inputTranscription?.text ||
                            message.serverContent?.inputAudioTranscription?.text;
                        if (userText) {
                            setTranscript((prev) => [
                                ...prev,
                                {
                                    role: 'user',
                                    text: userText,
                                    timestamp: formatTimestamp(),
                                },
                            ]);
                        }

                        // Model speech transcription from dedicated transcription field
                        const modelOutputText =
                            message.serverContent?.outputTranscription?.text ||
                            message.serverContent?.outputAudioTranscription?.text;
                        if (modelOutputText) {
                            setTranscript((prev) => [
                                ...prev,
                                {
                                    role: 'model',
                                    text: modelOutputText,
                                    timestamp: formatTimestamp(),
                                },
                            ]);
                        }

                        // Model audio and text parts from modelTurn
                        const parts = message.serverContent?.modelTurn?.parts;
                        if (Array.isArray(parts)) {
                            for (const part of parts) {
                                if (part.inlineData?.data) {
                                    playAudioChunk(part.inlineData.data);
                                    setIsSpeaking(true);
                                }
                                if (part.text) {
                                    setTranscript((prev) => [
                                        ...prev,
                                        {
                                            role: 'model',
                                            text: part.text,
                                            timestamp: formatTimestamp(),
                                        },
                                    ]);
                                }
                            }
                        }

                        if (message.serverContent?.turnComplete) {
                            setIsSpeaking(false);
                        }
                    } catch (err) {
                        console.error('Failed to parse incoming WebSocket message', err);
                    }
                };

                ws.onerror = (err) => {
                    console.error('Gemini Live WebSocket error', err);
                    cleanupResources();
                    setStatus('error');
                    setError(err instanceof Error ? err.message : 'WebSocket error');
                    reject(err);
                };

                ws.onclose = () => {
                    cleanupResources();
                    setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
                };
            });
        } catch (err) {
            cleanupResources();
            setStatus('error');
            const errorMessage = err instanceof Error ? err.message : 'Failed to start live session';
            setError(errorMessage);
            throw err;
        }
    }, [cleanupResources, startRecording, playAudioChunk]);

    useEffect(() => {
        return () => {
            cleanupResources();
        };
    }, [cleanupResources]);

    return {
        startSession,
        endSession,
        status,
        error,
        elapsedSeconds,
        isConnected: status === 'live',
        isSpeaking,
        transcript,
    };
}
