class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) {
            return true;
        }

        const channelData = input[0];
        if (!channelData) {
            return true;
        }

        const inputSampleRate = currentFrame ? sampleRate : 16000;
        const targetSampleRate = 16000;

        if (inputSampleRate === targetSampleRate) {
            this.appendAndFlush(channelData);
        } else {
            // Linear interpolation downsampling/resampling to 16kHz
            const ratio = inputSampleRate / targetSampleRate;
            const resampledLength = Math.floor(channelData.length / ratio);
            const resampled = new Float32Array(resampledLength);
            for (let i = 0; i < resampledLength; i++) {
                const srcIndex = i * ratio;
                const idx = Math.floor(srcIndex);
                const frac = srcIndex - idx;
                const s0 = channelData[idx] || 0;
                const s1 = channelData[idx + 1] !== undefined ? channelData[idx + 1] : s0;
                resampled[i] = s0 + frac * (s1 - s0);
            }
            this.appendAndFlush(resampled);
        }

        return true;
    }

    appendAndFlush(samples) {
        for (let i = 0; i < samples.length; i++) {
            this.buffer[this.bufferIndex++] = samples[i];
            if (this.bufferIndex >= this.bufferSize) {
                this.flush();
            }
        }
    }

    flush() {
        if (this.bufferIndex === 0) return;

        const pcm16 = new Int16Array(this.bufferIndex);
        for (let i = 0; i < this.bufferIndex; i++) {
            const s = Math.max(-1, Math.min(1, this.buffer[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
        this.bufferIndex = 0;
    }
}

registerProcessor('audio-processor', AudioProcessor);
