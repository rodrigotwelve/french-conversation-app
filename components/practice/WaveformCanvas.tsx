'use client';

import React, { useEffect, useRef } from 'react';
import { AudioLevels } from '@/hooks/useAudioPipeline';

interface WaveformCanvasProps {
    getAudioLevels?: () => AudioLevels;
    isLive?: boolean;
    className?: string;
    width?: number;
    height?: number;
}

export function WaveformCanvas({
    getAudioLevels,
    isLive = false,
    className = 'w-32 h-7',
    width = 128,
    height = 28,
}: WaveformCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animFrameIdRef = useRef<number | null>(null);
    const phaseRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Support high-DPI displays
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        let isRunning = true;

        const render = () => {
            if (!isRunning) return;

            ctx.clearRect(0, 0, width, height);

            const levels = getAudioLevels ? getAudioLevels() : { inputLevel: 0, outputLevel: 0, timeDomainData: new Uint8Array(0) };
            const effectiveLevel = Math.max(levels.inputLevel, levels.outputLevel);
            const timeData = levels.timeDomainData;

            const centerY = height / 2;
            phaseRef.current += 0.05;

            ctx.lineWidth = 1.75;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (isLive && timeData && timeData.length > 0 && effectiveLevel > 0.01) {
                // Active live waveform
                ctx.strokeStyle = '#18181B'; // Zinc-900 / dark slate
                ctx.beginPath();

                const sliceWidth = width / (timeData.length - 1);
                let x = 0;

                for (let i = 0; i < timeData.length; i++) {
                    const v = timeData[i] / 128.0; // 0 to 2
                    // Scale amplitude to canvas bounds
                    const maxAmp = (height / 2) - 2;
                    const y = centerY + (v - 1) * maxAmp;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                ctx.stroke();
            } else if (isLive) {
                // Connected / live but silent: gentle undulating baseline
                ctx.strokeStyle = '#71717A'; // Zinc-500
                ctx.beginPath();

                for (let x = 0; x < width; x++) {
                    const normalizedX = x / width;
                    const sinVal = Math.sin(normalizedX * Math.PI * 4 + phaseRef.current) * 2;
                    const y = centerY + sinVal;

                    if (x === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.stroke();
            } else {
                // Idle state: flat subtle horizontal line with slight fade at edges
                ctx.strokeStyle = '#E4E4E7'; // Zinc-200
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.stroke();
            }

            animFrameIdRef.current = requestAnimationFrame(render);
        };

        animFrameIdRef.current = requestAnimationFrame(render);

        return () => {
            isRunning = false;
            if (animFrameIdRef.current) {
                cancelAnimationFrame(animFrameIdRef.current);
            }
        };
    }, [getAudioLevels, isLive, width, height]);

    return (
        <canvas
            ref={canvasRef}
            className={`block ${className}`}
            style={{ width, height }}
            aria-label="Visualiseur audio"
        />
    );
}
