import { uploadAudioFile } from './audio-utils.js';

export class TTSHandler {
    constructor(room) {
        this.room = room;
        this.selectedVoiceForTTS = null;
        this.previewAudio = null;
        this.uploadedVoiceUrls = {}; // Cache for uploaded URLs
    }

    populateVoiceDropdown(voices) {
        const dropdown = document.getElementById('voice-dropdown');
        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = voice.title;
            dropdown.appendChild(option);
        });
    }

    selectVoiceFromDropdown(voices) {
        const dropdown = document.getElementById('voice-dropdown');
        const selectedIndex = dropdown.value;
        
        if (selectedIndex === '') {
            this.hideVoicePreview();
            if (this.previewAudio) {
                this.previewAudio.pause();
                this.previewAudio = null;
            }
            document.getElementById('preview-play-btn').textContent = '▶ Preview';
            return;
        }
        
        this.selectVoiceForTTS(parseInt(selectedIndex), voices);
    }

    selectRandomVoice(voices) {
        const randomIndex = Math.floor(Math.random() * voices.length);
        document.getElementById('voice-dropdown').value = randomIndex;
        this.selectVoiceForTTS(randomIndex, voices);
    }

    selectVoiceForTTS(index, voices) {
        const voice = voices[index];
        this.selectedVoiceForTTS = { file: voice.file, title: voice.title, script: voice.script };

        // Stop and clear any existing preview audio from another voice
        if (this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio = null;
        }
        document.getElementById('preview-play-btn').textContent = '▶ Preview';
        
        // Show and update preview
        this.showVoicePreview(voice);
    }

    showVoicePreview(voice) {
        const preview = document.getElementById('selected-voice-preview');
        const title = document.getElementById('preview-title');
        
        title.textContent = voice.title;
        preview.style.display = 'block';
    }

    hideVoicePreview() {
        document.getElementById('selected-voice-preview').style.display = 'none';
        this.selectedVoiceForTTS = null;
    }

    playPreview() {
        if (!this.selectedVoiceForTTS) return;
        
        const button = document.getElementById('preview-play-btn');

        // If there's no preview audio object for the current voice, create it
        if (!this.previewAudio) {
            this.previewAudio = new Audio(this.selectedVoiceForTTS.file);
            this.previewAudio.onended = function() {
                button.textContent = '▶ Preview';
                button.classList.remove('playing');
            };
        }

        // Toggle play/pause
        if (this.previewAudio.paused) {
            this.previewAudio.play();
            button.textContent = '⏸️ Pause';
            button.classList.add('playing');
        } else {
            this.previewAudio.pause();
            button.textContent = '▶ Preview';
            button.classList.remove('playing');
        }
    }

    async generateTTS() {
        const text = document.getElementById('tts-text').value.trim();
        const generateBtn = document.getElementById('generate-tts-btn');
        const ttsOutput = document.getElementById('tts-output');
        const audioPlayer = ttsOutput.querySelector('audio');

        if (!this.selectedVoiceForTTS) {
            alert('Please select a voice first.');
            return;
        }

        if (!text) {
            alert('Please enter some text to generate speech.');
            return;
        }

        // Set loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = 'Generating... <div class="spinner"></div>';

        try {
            // Upload the audio file first to get a URL
            const voiceUrl = await uploadAudioFile(this.selectedVoiceForTTS.file, this.uploadedVoiceUrls);
            
            const result = await this.room.textToSpeech({
                text: text,
                voice_sample: voiceUrl
            });

            audioPlayer.src = result.url;
            ttsOutput.style.display = 'block';
            audioPlayer.play();

            // Save to database
            await this.room.collection('generated_voice').create({
                text: text,
                voice_type: this.selectedVoiceForTTS.title,
                audio_url: result.url,
                voice_sample_file: this.selectedVoiceForTTS.file,
                username: (await this.room.auth.profile).username
            });

            // Clear the text area after successful generation
            document.getElementById('tts-text').value = '';

        } catch (error) {
            console.error('TTS Generation Error:', error);
            alert('Sorry, there was an error generating the speech. Please try again.');
        } finally {
            // Reset button
            generateBtn.disabled = false;
            generateBtn.innerHTML = 'Generate Speech';
        }
    }
}