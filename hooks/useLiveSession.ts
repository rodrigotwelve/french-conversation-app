import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioPipeline } from './useAudioPipeline';

export interface LiveTranscriptItem {
    role: 'user' | 'model';
    text: string;
}

export interface UseLiveSessionReturn {
    startSession: () => Promise<void>;
    endSession: () => void;
    isConnected: boolean;
    isSpeaking: boolean;
    transcript: LiveTranscriptItem[];
}

const SYSTEM_INSTRUCTION_TEXT =
    "Tu es un tuteur de français interactif et bienveillant. Ton élève a pour objectif d'atteindre le niveau B2 d'ici avril 2027 pour son PVT en France. Corrige ses erreurs oralement de manière naturelle et encourage-le constamment. Réponds en français de manière concise et dynamique.";

export function useLiveSession(): UseLiveSessionReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState<LiveTranscriptItem[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const isConnectedRef = useRef(false);

    const { startRecording, stopRecording, playAudioChunk } = useAudioPipeline();

    const endSession = useCallback(() => {
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch {
                // Ignore close errors
            }
            wsRef.current = null;
        }

        stopRecording();
        setIsConnected(false);
        isConnectedRef.current = false;
        setIsSpeaking(false);
    }, [stopRecording]);

    const startSession = useCallback(async () => {
        endSession();

        // 1. Fetch ephemeral token
        const res = await fetch('/api/gemini-token', { method: 'POST' });
        if (!res.ok) {
            throw new Error(`Failed to obtain ephemeral token: ${res.statusText}`);
        }
        const data = await res.json();
        const token = data.token;
        if (!token) {
            throw new Error('Ephemeral token not found in response');
        }

        // 2. Open WebSocket
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${token}`;

        await new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                setIsConnected(true);
                isConnectedRef.current = true;

                // Send setup message
                const setupMessage = {
                    setup: {
                        model: 'models/gemini-2.0-flash-exp',
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                        },
                        systemInstruction: {
                            parts: [{ text: SYSTEM_INSTRUCTION_TEXT }],
                        },
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
                    resolve();
                } catch (err) {
                    endSession();
                    reject(err);
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = typeof event.data === 'string' ? JSON.parse(event.data) : null;
                    if (!message) return;

                    const parts = message.serverContent?.modelTurn?.parts;
                    if (Array.isArray(parts)) {
                        for (const part of parts) {
                            if (part.inlineData?.data) {
                                playAudioChunk(part.inlineData.data);
                                setIsSpeaking(true);
                            }
                            if (part.text) {
                                setTranscript((prev) => [...prev, { role: 'model', text: part.text }]);
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
                endSession();
                reject(err);
            };

            ws.onclose = () => {
                endSession();
            };
        });
    }, [endSession, startRecording, playAudioChunk]);

    useEffect(() => {
        return () => {
            endSession();
        };
    }, [endSession]);

    return {
        startSession,
        endSession,
        isConnected,
        isSpeaking,
        transcript,
    };
}
