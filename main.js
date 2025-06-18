import { voices } from './voice-data.js';
import { TTSHandler } from './tts-handler.js';
import { VoiceCollection } from './voice-collection.js';

// Initialize database connection
const room = new WebsimSocket();

// Initialize handlers
const ttsHandler = new TTSHandler(room);
const voiceCollection = new VoiceCollection();

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Add active class to clicked tab button
    event.target.classList.add('active');

    if (tabName === 'voices' && !document.querySelector('.voice-card .score-value.analyzed')) {
        // analyzeVoiceScores();
    }
}
window.switchTab = switchTab;

// Populate voice dropdown
window.populateVoiceDropdown = () => ttsHandler.populateVoiceDropdown(voices);

// Select voice from dropdown
window.selectVoiceFromDropdown = () => ttsHandler.selectVoiceFromDropdown(voices);

// Select random voice
window.selectRandomVoice = () => ttsHandler.selectRandomVoice(voices);

// Play preview
window.playPreview = () => ttsHandler.playPreview();

// Voice collection functions
window.playVoice = (filename, button) => voiceCollection.playVoice(filename, button);
window.stopAll = () => voiceCollection.stopAll();
window.playRandomFromCollection = () => voiceCollection.playRandomFromCollection(voices);

function selectForTTSFromCard(filename, title, index) {
    // Switch to TTS tab
    switchTab('tts');
    
    // Update dropdown selection
    document.getElementById('voice-dropdown').value = index;
    
    // Select the voice
    ttsHandler.selectVoiceForTTS(index, voices);
    
    // Highlight selected card
    document.querySelectorAll('.voice-card').forEach(card => card.classList.remove('selected'));
    document.getElementById(`voice-card-${index}`).classList.add('selected');
}
window.selectForTTSFromCard = selectForTTSFromCard;

window.analyzeSingleVoice = (index) => voiceCollection.analyzeSingleVoice(index, voices);
window.analyzeVoiceScores = () => voiceCollection.analyzeVoiceScores(voices);
window.toggleScoreDetails = (index) => voiceCollection.toggleScoreDetails(index);

// Gallery functions
function renderGallery(voices) {
    const container = document.getElementById('galleryContainer');
    if (voices.length === 0) {
        container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No generated voices yet. Be the first to create one!</p>';
        return;
    }

    container.innerHTML = voices.reverse().map(voice => `
        <div class="gallery-item">
            <div class="gallery-header">
                <img src="https://images.websim.com/avatar/${voice.username}" alt="${voice.username}" class="user-avatar">
                <div class="gallery-info">
                    <div class="username">@${voice.username}</div>
                    <div class="voice-type">${voice.voice_type}</div>
                    <div class="timestamp">${new Date(voice.created_at).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="gallery-text">"${voice.text}"</div>
            <audio controls class="gallery-audio">
                <source src="${voice.audio_url}" type="audio/wav">
            </audio>
        </div>
    `).join('');
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    ttsHandler.populateVoiceDropdown(voices);
    document.getElementById('voicesGrid').innerHTML = voices.map((voice, index) => 
        voiceCollection.createVoiceCard(voice, index)
    ).join('');
    
    // Event Listeners
    document.getElementById('generate-tts-btn').addEventListener('click', () => ttsHandler.generateTTS());

    // Subscribe to gallery updates
    room.collection('generated_voice').subscribe(renderGallery);
});