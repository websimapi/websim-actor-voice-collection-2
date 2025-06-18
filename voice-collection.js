import { Transcriber } from './transcriber.js';
import { VoiceSampleAnalyzer } from './analyzer.js';
import { loadAudioToBuffer, uploadAudioFile } from './audio-utils.js';

// Enhanced scoring function with better error handling
export async function analyzeVoiceSampleWithTranscription(audioUrl, expectedScript, options = {}) {
    const analyzer = new VoiceSampleAnalyzer();
    
    try {
        console.log(`Starting analysis for: ${audioUrl}`);
        
        // Load audio with retry logic
        let audioBuffer;
        let transcribedText = '';
        
        try {
            audioBuffer = await loadAudioToBuffer(audioUrl, options.forceCorsProxy);
        } catch (audioError) {
            console.error('Audio loading failed:', audioError);
            throw new Error(`Failed to load audio: ${audioError.message}`);
        }
        
        // Attempt transcription with fallback
        try {
            transcribedText = await Transcriber.transcribe(audioBuffer, options.transcriptionOptions);
        } catch (transcriptionError) {
            console.error('Transcription failed:', transcriptionError);
            
            // Provide fallback behavior instead of complete failure
            if (options.allowEmptyTranscription) {
                console.warn('Using empty transcription as fallback');
                transcribedText = '';
            } else {
                throw new Error(`Transcription failed: ${transcriptionError.message}`);
            }
        }
        
        // Proceed with analysis
        const analysis = await analyzer.analyzeVoiceSample(
            audioBuffer, 
            expectedScript, 
            transcribedText, 
            options
        );
        
        // Add transcription to results for debugging
        analysis.transcribedText = transcribedText;
        analysis.audioInfo = {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels
        };
        
        return analysis;
        
    } catch (error) {
        console.error('Voice sample analysis failed:', error);
        throw error;
    }
}

export class VoiceCollection {
    constructor() {
        this.currentAudio = null;
        this.currentButton = null;
        this.analysisInProgress = false;
        this.uploadedVoiceUrls = {}; // Cache for uploaded URLs
    }

    createVoiceCard(voice, index) {
        return `
            <div class="voice-card" id="voice-card-${index}">
                <div class="voice-title">${voice.title}</div>
                <div class="voice-script">"${voice.script}"</div>
                <div class="voice-score-container">
                     <div class="score-header">
                        <span class="score-label">Overall Quality Score</span>
                        <button class="score-details-btn" id="details-btn-${index}" onclick="toggleScoreDetails(${index})" style="display:none;">Details</button>
                    </div>
                    <div class="score-value" id="score-value-${index}">Not yet analyzed</div>
                    <div class="score-details" id="score-details-${index}">
                         <p><strong>Overall Insights:</strong></p>
                         <div id="insights-${index}"></div>

                         <div class="analysis-breakdown" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                            <p><strong>Original Sample Analysis (Score: <span id="original-score-${index}">-</span>)</strong></p>
                             <p><em>Transcribed Text:</em></p>
                             <div class="transcribed-text-container"><span id="transcribed-text-${index}">...</span></div>
                             <p><strong>Score Breakdown:</strong></p>
                             <ul class="metric-list" id="detailed-scores-${index}"></ul>
                         </div>
                         
                         <div class="analysis-breakdown" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                             <p><strong>TTS Clone Analysis (Score: <span id="tts-score-${index}">-</span>)</strong></p>
                             <div id="tts-audio-player-container-${index}" style="margin-bottom: 10px; display: none;">
                                 <p><em>Generated Clone Audio:</em></p>
                                 <audio controls style="width: 100%; height: 35px; margin-top: 5px;"></audio>
                             </div>
                             <p><em>Transcribed Text:</em></p>
                             <div class="transcribed-text-container"><span id="tts-transcribed-text-${index}">...</span></div>
                             <p><strong>Score Breakdown:</strong></p>
                             <ul class="metric-list" id="tts-detailed-scores-${index}"></ul>
                         </div>
                    </div>
                </div>
                <div class="card-buttons">
                    <button class="play-button" onclick="playVoice('${voice.file}', this)">
                        ▶ Play
                    </button>
                    <button class="use-tts-button" onclick="selectForTTSFromCard('${voice.file}', '${voice.title}', ${index})">
                        🎙️ Use
                    </button>
                    <button class="analyze-one-button" id="analyze-one-btn-${index}" onclick="analyzeSingleVoice(${index})">
                        🔍 Analyze
                    </button>
                </div>
            </div>
        `;
    }

    playVoice(filename, button) {
        // Stop current audio if playing
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            if (this.currentButton) {
                this.currentButton.classList.remove('playing');
                this.currentButton.innerHTML = '▶ Play';
            }
        }

        // If clicking the same button, just stop
        if (this.currentButton === button) {
            this.currentAudio = null;
            this.currentButton = null;
            return;
        }

        // Play new audio
        this.currentAudio = new Audio(filename);
        this.currentButton = button;
        
        button.classList.add('playing');
        button.innerHTML = '⏸️ Playing...';
        
        this.currentAudio.play();
        
        this.currentAudio.onended = function() {
            button.classList.remove('playing');
            button.innerHTML = '▶ Play';
            this.currentAudio = null;
            this.currentButton = null;
        }.bind(this);
    }

    stopAll() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            if (this.currentButton) {
                this.currentButton.classList.remove('playing');
                this.currentButton.innerHTML = '▶ Play';
            }
            this.currentAudio = null;
            this.currentButton = null;
        }
    }

    playRandomFromCollection(voices) {
        this.stopAll();
        const randomIndex = Math.floor(Math.random() * voices.length);
        const buttons = document.querySelectorAll('.play-button');
        this.playVoice(voices[randomIndex].file, buttons[randomIndex]);
    }

    formatDetailedScores(scores, weights) {
        return Object.entries(scores).map(([key, value]) => {
            const name = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const score = (value * 100).toFixed(1);
            const weight = ((weights[key] || 0) * 100);
            return `<li>${name.padEnd(22, ' ')}: ${score.padStart(5)} / 100 (weight: ${weight.toFixed(0)}%)</li>`;
        }).join('');
    }

    async analyzeSingleVoice(index, voices) {
        if (this.analysisInProgress) {
            alert("Another analysis is already in progress. Please wait.");
            return;
        }
        this.analysisInProgress = true;
        
        const button = document.getElementById(`analyze-one-btn-${index}`);
        button.disabled = true;
        button.innerHTML = 'Analyzing... <div class="spinner"></div>';
        
        const voice = voices[index];
        const scoreEl = document.getElementById(`score-value-${index}`);
        const detailsBtn = document.getElementById(`details-btn-${index}`);
        
        try {
            console.log(`Starting analysis for voice ${index}:`, voice);
            
            // --- Part 1: Setup ---
            const initialScoreText = scoreEl.textContent;
            if (!initialScoreText.includes('%')) {
                scoreEl.innerHTML = 'Loading model...';
            }

            let transcriber = await Transcriber.getInstance((progress) => {
                if (!initialScoreText.includes('%')) {
                    scoreEl.textContent = `Loading model... ${Math.round(progress.progress)}%`;
                }
            });
            
            // --- Part 2: Analyze Original Sample ---
            scoreEl.innerHTML = 'Analyzing original... <div class="spinner"></div>';
            
            const originalAnalysis = await analyzeVoiceSampleWithTranscription(
                voice.file, 
                voice.script, 
                { 
                    forceCorsProxy: false,
                    isTTSAnalysis: false,
                    allowEmptyTranscription: false
                }
            );

            // --- Part 3: Generate and Analyze TTS Clone ---
            scoreEl.innerHTML = 'Generating clone... <div class="spinner"></div>';
            const voiceUrl = await uploadAudioFile(voice.file, this.uploadedVoiceUrls);
            const ttsResult = await websim.textToSpeech({
                text: voice.script,
                voice_sample: voiceUrl
            });

            // --- Add audio player for the generated clone ---
            const ttsAudioContainer = document.getElementById(`tts-audio-player-container-${index}`);
            if (ttsAudioContainer) {
                const ttsAudioPlayer = ttsAudioContainer.querySelector('audio');
                ttsAudioPlayer.src = ttsResult.url;
                ttsAudioContainer.style.display = 'block';
            }

            scoreEl.innerHTML = 'Analyzing clone... <div class="spinner"></div>';
            
            const ttsAnalysis = await analyzeVoiceSampleWithTranscription(
                ttsResult.url, 
                voice.script, 
                { 
                    forceCorsProxy: true, // Always use CORS proxy for TTS URLs
                    isTTSAnalysis: true,
                    allowEmptyTranscription: true // Allow fallback for TTS analysis
                }
            );

            // --- Part 4: Combine and Display Results ---
            const combinedScore = Math.round((originalAnalysis.overallScore * 0.6) + (ttsAnalysis.overallScore * 0.4));
            
            scoreEl.textContent = `${combinedScore} / 100`;
            scoreEl.classList.add('analyzed');
            
            if (combinedScore > 80) scoreEl.style.color = '#2ecc71';
            else if (combinedScore > 60) scoreEl.style.color = '#f1c40f';
            else scoreEl.style.color = '#e74c3c';

            // Populate details for original sample
            document.getElementById(`original-score-${index}`).textContent = `${originalAnalysis.overallScore} / 100`;
            document.getElementById(`transcribed-text-${index}`).textContent = `"${originalAnalysis.transcribedText || '...'}"`;
            document.getElementById(`detailed-scores-${index}`).innerHTML = this.formatDetailedScores(originalAnalysis.detailedScores, originalAnalysis.weightsUsed);
            
            // Populate details for TTS clone
            document.getElementById(`tts-score-${index}`).textContent = `${ttsAnalysis.overallScore} / 100`;
            document.getElementById(`tts-transcribed-text-${index}`).textContent = `"${ttsAnalysis.transcribedText || '...'}"`;
            document.getElementById(`tts-detailed-scores-${index}`).innerHTML = this.formatDetailedScores(ttsAnalysis.detailedScores, ttsAnalysis.weightsUsed);

            // Combine insights
            const combinedInsights = [
                ...originalAnalysis.insights, 
                ...ttsAnalysis.insights.map(i => `[TTS Clone] ${i}`)
            ];
            const uniqueInsights = [...new Set(combinedInsights)];
            const insightsContainer = document.getElementById(`insights-${index}`);
            if (uniqueInsights.length > 0) {
                insightsContainer.innerHTML = '<ul>' + uniqueInsights.map(insight => `<li>${insight}</li>`).join('') + '</ul>';
            } else {
                insightsContainer.innerHTML = '<ul><li>✅ Looks great! This is a high-quality sample.</li></ul>';
            }

            if(detailsBtn) detailsBtn.style.display = 'inline-block';
            
            console.log(`Analysis completed for voice ${index}:`, { originalAnalysis, ttsAnalysis, combinedScore });

        } catch (e) {
            console.error(`Error analyzing ${voice.title}:`, e);
            scoreEl.textContent = 'Error';
            scoreEl.style.color = '#e74c3c';
        } finally {
            this.analysisInProgress = false;
            button.disabled = false;
            button.innerHTML = '🔍 Analyze';
        }
    }

    async analyzeVoiceScores(voices) {
        if (this.analysisInProgress) {
             alert("Analysis is already in progress.");
             return;
        }
        this.analysisInProgress = true;
        const analyzeBtn = document.getElementById('analyze-btn');
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = 'Analyzing... <div class="spinner"></div>';

        try {
            for (const [i, voice] of voices.entries()) {
                const scoreEl = document.getElementById(`score-value-${i}`);
                if (scoreEl && !scoreEl.classList.contains('analyzed')) {
                    scoreEl.innerHTML = 'Loading model...';
                }
            }

            const transcriber = await Transcriber.getInstance((progress) => {
                 for (const [i, voice] of voices.entries()) {
                    const scoreEl = document.getElementById(`score-value-${i}`);
                    if (scoreEl && !scoreEl.classList.contains('analyzed')) {
                       scoreEl.textContent = `Loading model... ${Math.round(progress.progress)}%`;
                    }
                }
            });

            for (const [i, voice] of voices.entries()) {
                const button = document.getElementById(`analyze-one-btn-${i}`);
                button.disabled = true;

                const scoreEl = document.getElementById(`score-value-${i}`);
                const detailsBtn = document.getElementById(`details-btn-${i}`);
                
                try {
                    console.log(`Starting batch analysis for voice ${i}:`, voice);
                    
                    // --- Part 2: Analyze Original Sample ---
                    scoreEl.innerHTML = 'Analyzing original... <div class="spinner"></div>';
                    
                    const originalAnalysis = await analyzeVoiceSampleWithTranscription(
                        voice.file, 
                        voice.script, 
                        { 
                            forceCorsProxy: false,
                            isTTSAnalysis: false,
                            allowEmptyTranscription: false
                        }
                    );

                    // --- Part 3: Generate and Analyze TTS Clone ---
                    scoreEl.innerHTML = 'Generating clone... <div class="spinner"></div>';
                    const voiceUrl = await uploadAudioFile(voice.file, this.uploadedVoiceUrls);
                    const ttsResult = await websim.textToSpeech({
                        text: voice.script,
                        voice_sample: voiceUrl
                    });

                    // --- Add audio player for the generated clone ---
                    const ttsAudioContainer = document.getElementById(`tts-audio-player-container-${i}`);
                    if (ttsAudioContainer) {
                        const ttsAudioPlayer = ttsAudioContainer.querySelector('audio');
                        ttsAudioPlayer.src = ttsResult.url;
                        ttsAudioContainer.style.display = 'block';
                    }

                    scoreEl.innerHTML = 'Analyzing clone... <div class="spinner"></div>';
                    
                    const ttsAnalysis = await analyzeVoiceSampleWithTranscription(
                        ttsResult.url, 
                        voice.script, 
                        { 
                            forceCorsProxy: true, // Always use CORS proxy for TTS URLs
                            isTTSAnalysis: true,
                            allowEmptyTranscription: true // Allow fallback for TTS analysis
                        }
                    );

                    // --- Part 4: Combine and Display Results ---
                    const combinedScore = Math.round((originalAnalysis.overallScore * 0.6) + (ttsAnalysis.overallScore * 0.4));
                    
                    scoreEl.textContent = `${combinedScore} / 100`;
                    scoreEl.classList.add('analyzed');
                    
                    if (combinedScore > 80) scoreEl.style.color = '#2ecc71';
                    else if (combinedScore > 60) scoreEl.style.color = '#f1c40f';
                    else scoreEl.style.color = '#e74c3c';

                    // Populate details for original sample
                    document.getElementById(`original-score-${i}`).textContent = `${originalAnalysis.overallScore} / 100`;
                    document.getElementById(`transcribed-text-${i}`).textContent = `"${originalAnalysis.transcribedText || '...'}"`;
                    document.getElementById(`detailed-scores-${i}`).innerHTML = this.formatDetailedScores(originalAnalysis.detailedScores, originalAnalysis.weightsUsed);
                    
                    // Populate details for TTS clone
                    document.getElementById(`tts-score-${i}`).textContent = `${ttsAnalysis.overallScore} / 100`;
                    document.getElementById(`tts-transcribed-text-${i}`).textContent = `"${ttsAnalysis.transcribedText || '...'}"`;
                    document.getElementById(`tts-detailed-scores-${i}`).innerHTML = this.formatDetailedScores(ttsAnalysis.detailedScores, ttsAnalysis.weightsUsed);

                    // Combine insights
                    const combinedInsights = [
                        ...originalAnalysis.insights, 
                        ...ttsAnalysis.insights.map(insight => `[TTS Clone] ${insight}`)
                    ];
                    const uniqueInsights = [...new Set(combinedInsights)];
                    const insightsContainer = document.getElementById(`insights-${i}`);
                    if (uniqueInsights.length > 0) {
                        insightsContainer.innerHTML = '<ul>' + uniqueInsights.map(insight => `<li>${insight}</li>`).join('') + '</ul>';
                    } else {
                        insightsContainer.innerHTML = '<ul><li>✅ Looks great! This is a high-quality sample.</li></ul>';
                    }
                    
                    if(detailsBtn) detailsBtn.style.display = 'inline-block';
                    
                    console.log(`Batch analysis completed for voice ${i}:`, { originalAnalysis, ttsAnalysis, combinedScore });

                } catch (e) {
                    console.error(`Error analyzing ${voice.title}:`, e);
                    scoreEl.textContent = 'Error';
                    scoreEl.style.color = '#e74c3c';
                } finally {
                    button.disabled = false;
                    button.innerHTML = '🔍 Analyze';
                }
            }
        } catch (error) {
            console.error("Failed to initialize the transcriber model:", error);
            alert("Could not load the analysis model. Please refresh and try again.");
            for (const [i, voice] of voices.entries()) {
                 const scoreEl = document.getElementById(`score-value-${i}`);
                 if (scoreEl && !scoreEl.classList.contains('analyzed')) {
                    scoreEl.textContent = 'Model load failed';
                 }
            }
        } finally {
            this.analysisInProgress = false;
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '🔍 Analyze All Voices';
        }
    }

    toggleScoreDetails(index) {
        const detailsEl = document.getElementById(`score-details-${index}`);
        const btn = document.getElementById(`details-btn-${index}`);
        if (detailsEl.style.display === 'none') {
            detailsEl.style.display = 'block';
            btn.textContent = 'Hide';
        } else {
            detailsEl.style.display = 'none';
            btn.textContent = 'Details';
        }
    }
}