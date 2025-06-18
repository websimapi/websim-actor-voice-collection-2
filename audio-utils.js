export async function loadAudioToBuffer(url, forceCorsProxy = false) {
    const audioCTX = new AudioContext({ sampleRate: 16000 });
    
    const proxies = [
        { prefix: '', type: 'direct' },
        { prefix: 'https://corsproxy.io/?', type: 'encoded' },
        { prefix: 'https://api.allorigins.win/raw?url=', type: 'encoded' },
        { prefix: 'https://thingproxy.freeboard.io/fetch/', type: 'unencoded' },
        { prefix: 'https://corsproxy.org/?', type: 'encoded' },
    ];

    // If forceCorsProxy is true, skip direct fetch and start with proxies
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
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                throw new Error(`HTTP status ${response.status} for ${fetchUrl}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log(`Successfully fetched and decoded audio via ${proxy.type}`);
            // decodeAudioData can still throw an error for malformed data
            return await audioCTX.decodeAudioData(arrayBuffer);
        } catch (error) {
            lastError = error;
            console.warn(`Fetch/decode via ${proxy.type} failed for "${url}". Trying next fallback. Error:`, error.message);
        }
    }

    console.error(`All fetch attempts failed for url: ${url}. Last error:`, lastError);
    throw lastError; // Throw the last captured error if all proxies fail
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