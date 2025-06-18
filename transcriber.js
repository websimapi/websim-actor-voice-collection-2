import { pipeline } from '@xenova/transformers';

// Enhanced transcriber with better error handling and preprocessing
export class Transcriber {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            try {
                console.log('Loading transcription model...');
                this.instance = await this.getNewInstance(progress_callback);
                console.log('Transcription model loaded successfully');
            } catch (error) {
                console.error('Failed to load transcription model:', error);
                throw new Error(`Transcription model loading failed: ${error.message}`);
            }
        }
        return this.instance;
    }

    static async getNewInstance(progress_callback = null) {
        return pipeline(this.task, this.model, { 
            progress_callback,
            // Add model configuration for better reliability
            chunk_length_s: 30,
            stride_length_s: 5
        });
    }
    
    // Enhanced transcription method with preprocessing
    static async transcribe(audioBuffer, options = {}) {
        try {
            const transcriber = await this.getInstance();
            
            // Preprocess audio for better transcription
            const processedAudio = this.preprocessAudio(audioBuffer);
            
            // Perform transcription with error handling
            const startTime = performance.now();
            const result = await transcriber(processedAudio, {
                return_timestamps: false,
                chunk_length_s: 30,
                stride_length_s: 5,
                ...options
            });
            
            const duration = performance.now() - startTime;
            console.log(`Transcription completed in ${duration.toFixed(2)}ms`);
            
            // Validate transcription result
            if (!result || typeof result.text !== 'string') {
                throw new Error('Invalid transcription result');
            }
            
            const transcribedText = result.text.trim();
            
            if (transcribedText.length === 0) {
                console.warn('Transcription returned empty text');
                return '';
            }
            
            console.log(`Transcribed: "${transcribedText}"`);
            return transcribedText;
            
        } catch (error) {
            console.error('Transcription failed:', error);
            throw new Error(`Transcription failed: ${error.message}`);
        }
    }
    
    // Audio preprocessing to improve transcription reliability
    static preprocessAudio(audioBuffer) {
        const audioData = audioBuffer.getChannelData(0);
        
        // Convert to the format expected by Whisper (Float32Array)
        // Ensure audio is in the correct range [-1, 1]
        const normalizedAudio = new Float32Array(audioData.length);
        
        // Find the maximum absolute value for normalization
        let maxAbs = 0;
        for (let i = 0; i < audioData.length; i++) {
            maxAbs = Math.max(maxAbs, Math.abs(audioData[i]));
        }
        
        // Normalize if needed (but avoid over-normalization)
        const normalizationFactor = maxAbs > 0.95 ? 0.95 / maxAbs : 1.0;
        
        for (let i = 0; i < audioData.length; i++) {
            normalizedAudio[i] = audioData[i] * normalizationFactor;
        }
        
        return normalizedAudio;
    }
    
    // Clear the instance to force reload (useful for debugging)
    static clearInstance() {
        this.instance = null;
        console.log('Transcriber instance cleared');
    }
}