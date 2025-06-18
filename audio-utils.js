// Improved audio loading with better error handling and validation
export async function loadAudioToBuffer(url, forceCorsProxy = false) {
    // Don't force sample rate - let the browser handle it naturally
    const audioCTX = new AudioContext();
    
    const proxies = [
        { prefix: '', type: 'direct' },
        { prefix: 'https://corsproxy.io/?', type: 'encoded' },
        { prefix: 'https://api.allorigins.win/raw?url=', type: 'encoded' },
        { prefix: 'https://thingproxy.freeboard.io/fetch/', type: 'unencoded' },
        { prefix: 'https://corsproxy.org/?', type: 'encoded' },
    ];
    
    const startIndex = forceCorsProxy ? 1 : 0;
    const proxiesToTry = proxies.slice(startIndex);
    let lastError = null;
    
    for (const proxy of proxiesToTry) {
        let fetchUrl;
        switch(proxy.type) {
            case 'direct':
                fetchUrl = url;
                break;
            case 'encoded':
                fetchUrl = `${proxy.prefix}${encodeURIComponent(url)}`;
                break;
            case 'unencoded':
                fetchUrl = `${proxy.prefix}${url}`;
                break;
        }
        
        try {
            console.log(`Attempting to fetch via ${proxy.type}: ${fetchUrl}`);
            
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch(fetchUrl, { 
                signal: controller.signal,
                headers: {
                    'Accept': 'audio/*,*/*;q=0.9'
                }
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP status ${response.status} for ${fetchUrl}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Validate that we actually got audio data
            if (arrayBuffer.byteLength === 0) {
                throw new Error('Empty audio buffer received');
            }
            
            console.log(`Successfully fetched audio (${arrayBuffer.byteLength} bytes) via ${proxy.type}`);
            
            // Decode with error handling
            const audioBuffer = await audioCTX.decodeAudioData(arrayBuffer);
            
            // Validate the decoded audio
            if (audioBuffer.duration === 0) {
                throw new Error('Audio buffer has zero duration');
            }
            
            console.log(`Audio decoded successfully: ${audioBuffer.duration}s, ${audioBuffer.sampleRate}Hz`);
            return audioBuffer;
            
        } catch (error) {
            lastError = error;
            console.warn(`Fetch/decode via ${proxy.type} failed for "${url}". Error:`, error.message);
            
            // If it's an abort error, we might want to try the next proxy immediately
            if (error.name === 'AbortError') {
                console.warn('Request timed out, trying next proxy...');
                continue;
            }
        }
    }
    
    console.error(`All fetch attempts failed for url: ${url}. Last error:`, lastError);
    throw new Error(`Failed to load audio from all sources: ${lastError?.message || 'Unknown error'}`);
}

// Upload audio file to get URL
export async function uploadAudioFile(filename, uploadedVoiceUrls) {
    if (uploadedVoiceUrls[filename]) {
        return uploadedVoiceUrls[filename];
    }

    try {
        // Fetch the local audio file
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        
        // Create a File object
        const file = new File([blob], filename.split('/').pop(), { type: blob.type });
        
        // Upload to websim storage
        const url = await websim.upload(file);
        uploadedVoiceUrls[filename] = url;
        return url;
    } catch (error) {
        console.error('Error uploading audio file:', filename, error);
        throw error;
    }
}