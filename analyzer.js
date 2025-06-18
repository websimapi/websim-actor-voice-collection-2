// Enhanced Voice Sample Scoring System
export class VoiceSampleAnalyzer {
    constructor() {
        this.baseWeights = {
            transcriptAccuracy: 0.25,
            audioQuality: 0.20,
            speechClarity: 0.15,
            prosody: 0.15,
            contentQuality: 0.15,
            technicalSuitability: 0.10
        };
        this.weights = { ...this.baseWeights }; // Initialize with base weights
    }

    adjustWeights(wordCount, isTTSAnalysis = false) {
        const base = this.baseWeights;
        let newWeights = { ...base };

        // Step 1: Adjust for word count. Longer samples can have less accuracy weight.
        const shiftFactor = Math.min(1.0, Math.max(0, (wordCount - 10) / 40));
        const weightToShift = 0.10 * shiftFactor;
        newWeights.transcriptAccuracy -= weightToShift;
        newWeights.contentQuality += weightToShift;
        
        // Step 2: Adjust for TTS analysis if applicable
        if (isTTSAnalysis) {
            // For TTS analysis, accuracy is paramount.
            // We increase accuracy weight significantly and proportionally reduce others.
            const accuracyTarget = 0.60; // Target weight for accuracy
            const currentAccuracyWeight = newWeights.transcriptAccuracy;
            const accuracyIncrease = accuracyTarget - currentAccuracyWeight;
            
            newWeights.transcriptAccuracy = accuracyTarget;

            const totalOtherWeight = 1.0 - currentAccuracyWeight;
            if (totalOtherWeight > 0) {
                for (const key in newWeights) {
                    if (key !== 'transcriptAccuracy') {
                        const proportion = newWeights[key] / totalOtherWeight;
                        newWeights[key] -= accuracyIncrease * proportion;
                    }
                }
            }
        }
        
        // Final check to ensure weights sum to 1
        const currentTotal = Object.values(newWeights).reduce((sum, w) => sum + w, 0);
        if (Math.abs(1.0 - currentTotal) > 1e-6) {
            console.warn("Weight adjustment resulted in non-unity total. Resetting to prevent error.", newWeights, currentTotal);
            this.weights = { ...this.baseWeights };
        } else {
            this.weights = newWeights;
        }
    }

    async analyzeVoiceSample(audioBuffer, expectedScript, transcribedText, options = {}) {
        // Adjust weights based on the transcribed word count *before* calculating scores.
        const wordCount = transcribedText.trim().split(/\s+/).filter(Boolean).length;
        this.adjustWeights(wordCount, options.isTTSAnalysis);

        const scores = {
            transcriptAccuracy: this.calculateTranscriptAccuracy(expectedScript, transcribedText),
            audioQuality: await this.calculateAudioQuality(audioBuffer),
            speechClarity: await this.calculateSpeechClarity(audioBuffer, transcribedText),
            prosody: await this.calculateProsodyScore(audioBuffer, transcribedText),
            contentQuality: this.calculateContentQuality(transcribedText, expectedScript),
            technicalSuitability: await this.calculateTechnicalSuitability(audioBuffer)
        };

        const weightedScore = Object.keys(scores).reduce((total, key) => {
            // Use the dynamically adjusted weights for scoring
            return total + (scores[key] * (this.weights[key] || 0));
        }, 0);

        return {
            overallScore: Math.round(weightedScore * 100),
            detailedScores: scores,
            insights: this.generateInsights(scores),
            weightsUsed: { ...this.weights } // Return a copy of the weights used for this analysis
        };
    }

    calculateTranscriptAccuracy(expected, transcribed) {
        const distance = this.levenshtein(expected.toLowerCase(), transcribed.toLowerCase());
        const maxLength = Math.max(expected.length, transcribed.length);
        return maxLength === 0 ? 1 : Math.max(0, 1 - distance / maxLength);
    }

    async calculateAudioQuality(audioBuffer) {
        const audioData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        const snr = this.estimateSNR(audioData);
        const snrScore = Math.min(1, Math.max(0, (snr - 10) / 30));
        
        const dynamicRange = this.calculateDynamicRange(audioData);
        const dynamicScore = Math.min(1, dynamicRange / 60);
        
        const clippingRatio = this.detectClipping(audioData);
        const clippingScore = Math.max(0, 1 - clippingRatio * 10);
        
        const spectrumScore = await this.analyzeFrequencySpectrum(audioData, sampleRate);
        
        return (snrScore + dynamicScore + clippingScore + spectrumScore) / 4;
    }

    async calculateSpeechClarity(audioBuffer, transcribedText) {
        const audioData = audioBuffer.getChannelData(0);
        
        const zcr = this.calculateZeroCrossingRate(audioData);
        // Relaxed ZCR scoring. Punishes extremely high ZCR which often indicates noise.
        const zcrScore = 1 - Math.min(1, zcr * 2.5);
        
        const spectralCentroid = await this.calculateSpectralCentroid(audioData, audioBuffer.sampleRate);
        const centroidScore = this.normalizeSpectralCentroid(spectralCentroid);

        const articulationScore = this.estimateArticulation(audioBuffer.duration, transcribedText);
        
        return (zcrScore + centroidScore + articulationScore) / 3;
    }

    async calculateProsodyScore(audioBuffer, transcribedText) {
        const audioData = audioBuffer.getChannelData(0);
        
        const energyVariation = this.calculateEnergyVariation(audioData);
        const pitchScore = Math.min(1, energyVariation * 20);
        
        const speakingRate = this.estimateSpeakingRate(transcribedText, audioBuffer.duration);
        const rateScore = this.normalizeSpeakingRate(speakingRate);
        
        const pauseScore = this.analyzePausePatterns(audioData);
        
        return (pitchScore + rateScore + pauseScore) / 3;
    }

    calculateContentQuality(transcribedText, expectedScript) {
        const words = transcribedText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        
        const wordCount = words.length;
        const wordCountScore = Math.min(1, Math.log(wordCount + 1) / Math.log(51));
        
        const uniqueWords = new Set(words);
        const diversityScore = uniqueWords.size / Math.max(wordCount, 1);
        
        const phoneticScore = this.calculatePhoneticCoverage(transcribedText);
        
        const complexityScore = this.analyzeSentenceComplexity(transcribedText);
        
        return (wordCountScore + diversityScore + phoneticScore + complexityScore) / 4;
    }

    async calculateTechnicalSuitability(audioBuffer) {
        const duration = audioBuffer.duration;
        const durationScore = this.normalizeDuration(duration);

        const audioData = audioBuffer.getChannelData(0);
        const noiseScore = Math.min(1, Math.max(0, (this.estimateSNR(audioData) - 5) / 25));
        
        return (durationScore + noiseScore) / 2;
    }
    
    levenshtein(s1, s2) {
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) costs[j] = j;
                else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    estimateSNR(audioData) {
        const signalPower = audioData.reduce((sum, s) => sum + s * s, 0) / audioData.length;
        if (signalPower === 0) return 0;
        const sorted = [...audioData].map(Math.abs).sort((a, b) => a - b);
        const noiseFloor = sorted[Math.floor(sorted.length * 0.1)]; // Assume lowest 10% is noise
        const noisePower = noiseFloor * noiseFloor;
        return 10 * Math.log10(signalPower / (noisePower + 1e-10));
    }

    calculateDynamicRange(audioData) {
        let max = 0, min = 1;
        for(let i=0; i<audioData.length; i++) {
            const absSample = Math.abs(audioData[i]);
            if(absSample > max) max = absSample;
            if(absSample < min) min = absSample;
        }
        return 20 * Math.log10(max / (min + 1e-10));
    }

    detectClipping(audioData) {
        const clippedSamples = audioData.filter(s => Math.abs(s) >= 0.98).length;
        return clippedSamples / audioData.length;
    }

    calculateZeroCrossingRate(audioData) {
        let crossings = 0;
        for (let i = 1; i < audioData.length; i++) {
            if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) crossings++;
        }
        return crossings / (audioData.length - 1);
    }

    estimateArticulation(sampleLength, text) {
        const charCount = text.replace(/\s/g, '').length;
        if (charCount === 0) return 0;
        const articulationRate = sampleLength / charCount; // samples per character
        return Math.min(1, Math.max(0, 1 - Math.abs(articulationRate - 400) / 400));
    }

    calculateEnergyVariation(audioData) {
        const frameSize = 1024;
        const energies = [];
        for(let i = 0; i < audioData.length; i += frameSize) {
            const frame = audioData.slice(i, i + frameSize);
            const energy = frame.reduce((sum, s) => sum + s*s, 0) / frame.length;
            energies.push(energy);
        }
        const meanEnergy = energies.reduce((sum, e) => sum + e, 0) / energies.length;
        const variance = energies.reduce((sum, e) => sum + (e-meanEnergy)*(e-meanEnergy), 0) / energies.length;
        return Math.sqrt(variance);
    }

    estimateSpeakingRate(text, duration) {
        const words = text.split(/\s+/).filter(Boolean).length;
        return words / duration;
    }

    normalizeSpeakingRate(rate) {
        // Ideal is 2-4 words/sec
        if (rate > 2 && rate < 4) return 1.0;
        if (rate < 1 || rate > 6) return 0.2;
        if (rate <= 2) return 0.5 + (rate - 1) * 0.5;
        return Math.max(0.2, 1 - (rate - 4) * 0.4);
    }

    analyzePausePatterns(audioData) {
        const threshold = 0.01;
        const silentFrames = audioData.filter(s => Math.abs(s) < threshold).length;
        const silenceRatio = silentFrames / audioData.length;
        // ideal silence ratio around 10-25%
        return Math.min(1, Math.max(0, 1 - Math.abs(silenceRatio - 0.175) / 0.175));
    }
    
    calculatePhoneticCoverage(text) {
        const commonPhonemes = ['th', 'sh', 'ch', 'ng', 'st', 'nd', 'nt', 'er', 'ing', 'ed'];
        const foundPhonemes = commonPhonemes.filter(p => text.toLowerCase().includes(p));
        return foundPhonemes.length / commonPhonemes.length;
    }

    analyzeSentenceComplexity(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length === 0) return 0;
        const avgWords = text.split(/\s+/).length / sentences.length;
        return Math.min(1, Math.max(0, 1 - Math.abs(avgWords - 12.5) / 12.5));
    }

    normalizeDuration(duration) {
        if (duration < 3) return 0.3;
        if (duration > 60) return 0.5;
        if (duration >= 5 && duration <= 30) return 1;
        if (duration < 5) return 0.6 + (duration - 3) * 0.2;
        return Math.max(0.5, 1 - (duration - 30) / 60);
    }

    generateInsights(scores) {
        const insights = [];
        if (scores.transcriptAccuracy < 0.8) insights.push("Clearer pronunciation would improve transcript accuracy.");
        if (scores.audioQuality < 0.7) insights.push("Audio quality could be improved (check for noise/clipping).");
        if (scores.prosody < 0.6) insights.push("More expressive delivery (varied pitch/pace) is recommended.");
        if (scores.contentQuality < 0.7) insights.push("Longer text with more diverse vocabulary would be beneficial.");
        if (scores.technicalSuitability < 0.8) insights.push("Sample duration or noise level may be suboptimal for training.");
        return insights;
    }

    async analyzeFrequencySpectrum(audioData, sampleRate) { return 0.8; } // Placeholder
    async calculateSpectralCentroid(audioData, sampleRate) { return 2000; } // Placeholder Hz
    normalizeSpectralCentroid(c) { return Math.min(1, Math.max(0, 1 - Math.abs(c - 2000) / 2000)); }
}