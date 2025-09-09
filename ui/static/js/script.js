document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('text-input');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const speedControl = document.getElementById('speed-control');
    const speedValue = document.getElementById('speed-value');
    const textOutput = document.getElementById('text-output');
    const audioPlayer = document.getElementById('audio-player');
    const speakerSelect = document.getElementById('speaker-select');
    const shareBtn = document.getElementById('share-btn');
    const shareLinkContainer = document.getElementById('share-link-container');
    const shareLinkInput = document.getElementById('share-link');
    const copyLinkBtn = document.getElementById('copy-link-btn');

    let timings = [];
    let currentWordIndex = 0;

    // Populate speaker options (dummy data)
    const speakers = [
        { id: 'speaker1', name: 'Speaker 1' },
        { id: 'speaker2', name: 'Speaker 2' },
        { id: 'multispeaker', name: 'Multi-speaker' }
    ];

    speakers.forEach(speaker => {
        const option = document.createElement('option');
        option.value = speaker.id;
        option.textContent = speaker.name;
        speakerSelect.appendChild(option);
    });

    playPauseBtn.addEventListener('click', async () => {
        if (audioPlayer.paused) {
            const text = textInput.value;
            if (!text) return;

            try {
                const response = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text,
                        speaker: speakerSelect.value,
                        speed: speedControl.value
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to generate audio.');
                }

                const data = await response.json();
                audioPlayer.src = data.audio_url;
                timings = data.timings;
                
                // Prepare text output with spans for each word
                textOutput.innerHTML = text.split(' ').map((word, index) => `<span id="word-${index}">${word}</span>`).join(' ');

                await audioPlayer.play();
                playPauseBtn.textContent = 'Pause';

            } catch (error) {
                console.error('Error:', error);
                alert(error.message);
            }
        } else {
            audioPlayer.pause();
            playPauseBtn.textContent = 'Play';
        }
    });

    speedControl.addEventListener('input', () => {
        const speed = parseFloat(speedControl.value).toFixed(1);
        audioPlayer.playbackRate = speed;
        speedValue.textContent = `${speed}x`;
    });

    audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = audioPlayer.currentTime;
        
        // Find the current word based on timings
        const wordInfo = timings.find(t => currentTime >= t.start && currentTime < t.end);

        if (wordInfo) {
            const wordIndex = timings.indexOf(wordInfo);
            if (wordIndex !== currentWordIndex) {
                // Remove highlight from the previous word
                const prevWordEl = document.getElementById(`word-${currentWordIndex}`);
                if (prevWordEl) prevWordEl.classList.remove('highlight');

                // Add highlight to the current word
                const currentWordEl = document.getElementById(`word-${wordIndex}`);
                if (currentWordEl) currentWordEl.classList.add('highlight');
                
                currentWordIndex = wordIndex;
            }
        }
    });

    audioPlayer.addEventListener('ended', () => {
        playPauseBtn.textContent = 'Play';
        // Remove highlight from the last word
        const lastWordEl = document.getElementById(`word-${currentWordIndex}`);
        if (lastWordEl) lastWordEl.classList.remove('highlight');
        currentWordIndex = 0;
    });

    shareBtn.addEventListener('click', () => {
        // This is a simplified share functionality.
        // A real implementation would involve saving the state on the server
        // and generating a unique URL.
        const text = encodeURIComponent(textInput.value);
        const url = `${window.location.origin}?text=${text}`;
        shareLinkInput.value = url;
        shareLinkContainer.style.display = 'flex';
    });

    copyLinkBtn.addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
        alert('Link copied to clipboard!');
    });

    // Check for shared text in URL on page load
    const urlParams = new URLSearchParams(window.location.search);
    const sharedText = urlParams.get('text');
    if (sharedText) {
        textInput.value = decodeURIComponent(sharedText);
    }
});
