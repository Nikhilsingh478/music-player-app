document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('play');
    const prevButton = document.getElementById('prev');
    const nextButton = document.getElementById('next');
    const volumeControl = document.getElementById('volume');
    const playlist1 = document.getElementById('playlist-1');
    const playlist2 = document.getElementById('playlist-2');
    const playlistHeaders = document.querySelectorAll('.playlist-header');
    const albumArt = document.getElementById('album-art');
    const visualizer = document.getElementById('visualizer');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalDurationDisplay = document.getElementById('total-duration');
    const progressBar = document.getElementById('progress-bar');
    const backgroundUpload = document.getElementById('background-upload');
    const fileInput = document.getElementById('file-input');
    const deleteBackgroundIcon = document.getElementById('delete-background-icon');
    const musicLoader = document.getElementById('music-loader');

    document.getElementById('playlist-1').classList.add('active');

    let audio = new Audio();
    audio.volume = 0.4; // Set default volume to 40%
    let isPlaying = false;
    let currentSongIndex = 0;
    let currentPlaylist = 1; // Start with Playlist 1
    let db;
    let songs = { 1: [], 2: [] }; // Object to hold songs for both playlists

    // Open IndexedDB
    const request = indexedDB.open('musicPlayerDB', 1);

    request.onerror = (event) => {
        console.error('IndexedDB error:', event);
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        if (db) {
            loadPlaylists();
        } else {
            console.error('Database initialization failed.');
        }
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains('songs')) {
            db.createObjectStore('songs', { keyPath: 'name' });
        }
    };

    // Load playlists from IndexedDB
    function loadPlaylists() {
        if (!db) {
            console.error('Database not initialized.');
            return;
        }
        const transaction = db.transaction(['songs'], 'readonly');
        const objectStore = transaction.objectStore('songs');
        const request = objectStore.getAll();

        request.onsuccess = (event) => {
            const savedSongs = event.target.result;
            if (savedSongs) {
                savedSongs.forEach(song => {
                    songs[song.playlist].push(song);
                });
                updatePlaylist(currentPlaylist);
            }
        };
    }

    // Save song to IndexedDB
    function saveSong(song) {
        if (!db) {
            console.error('Database not initialized.');
            return;
        }
        const transaction = db.transaction(['songs'], 'readwrite');
        const objectStore = transaction.objectStore('songs');
        objectStore.add(song);
    }

    function updatePlaylist(playlistId) {
        const playlist = playlistId === 1 ? playlist1 : playlist2;
        playlist.innerHTML = '';
        songs[playlistId].forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'song';
            songElement.innerHTML = `
                <span class="songBlock">${isPlaying && currentSongIndex === index ? '<img src="vinyl.png" class="rotating">' : ''} ${song.name}</span>
                <button class="delete-button" data-index="${index}">🗑️</button>
            `;
            songElement.draggable = true; // Make it draggable
            playlist.appendChild(songElement);
        });
    
        document.getElementById(`track-count-${playlistId}`).textContent = songs[playlistId].length;
    
        // Add event listeners for delete buttons
        playlist.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const songIndex = e.target.getAttribute('data-index');
                deleteSong(playlistId, songIndex);
            });
        });
    
        console.log(`Playlist ${playlistId} updated:`, songs[playlistId]);
    }
    
    

    playlistHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const playlistId = Number(header.getAttribute('data-playlist'));
            if (playlistId !== currentPlaylist) {
                document.getElementById(`playlist-${currentPlaylist}`).classList.remove('active');
                currentPlaylist = playlistId;
                document.getElementById(`playlist-${currentPlaylist}`).classList.add('active');
                updatePlaylist(currentPlaylist);
            }
        });
    });
    
    // Delete song
    function deleteSong(playlistId, index) {
        songs[playlistId].splice(index, 1);
        savePlaylist(playlistId);
        updatePlaylist(playlistId);
        if (songs[playlistId].length > 0) {
            currentSongIndex = Math.min(currentSongIndex, songs[playlistId].length - 1);
            stopAudio();
        } else {
            audio.pause();
            isPlaying = false;
            albumArt.style.backgroundImage = 'none';
            albumArt.innerHTML = '';
        }
    }

    // Stop audio
    function stopAudio() {
        audio.pause();
        audio.currentTime = 0;
        isPlaying = false;
    }

    async function extractArtwork(file) {
        try {
            const { parseBuffer } = await import('music-metadata-browser');
            const arrayBuffer = await file.arrayBuffer();
            const metadata = await parseBuffer(Buffer.from(arrayBuffer), { mimeType: file.type });
            console.log('Metadata:', metadata);
            const picture = metadata.common.picture ? metadata.common.picture[0] : null;
            console.log('Picture:', picture);
            if (picture) {
                const imageUrl = URL.createObjectURL(new Blob([picture.data], { type: picture.format }));
                return imageUrl;
            }
            return null;
        } catch (error) {
            console.error('Error extracting artwork:', error);
            return null;
        }
    }

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        console.log('Files selected:', files);
        for (const file of files) {
            console.log('Processing file:', file.name);
            const reader = new FileReader();
            reader.onload = async (event) => {
                const artworkUrl = await extractArtwork(file);
                console.log('Artwork URL:', artworkUrl);
                const song = {
                    name: file.name,
                    url: event.target.result,
                    artwork: artworkUrl,
                    playlist: currentPlaylist // Assign song to the current playlist
                };
                songs[currentPlaylist].push(song);
                saveSong(song);
                updatePlaylist(currentPlaylist);
            };
            reader.readAsDataURL(file);
        }
    });

    // Initialize Sortable for drag-and-drop functionality
    new Sortable(playlist1, {
        animation: 150,
        onEnd: (evt) => {
            const [movedSong] = songs[1].splice(evt.oldIndex, 1);
            songs[1].splice(evt.newIndex, 0, movedSong);
            savePlaylist(1);
        }
    });

    new Sortable(playlist2, {
        animation: 150,
        onEnd: (evt) => {
            const [movedSong] = songs[2].splice(evt.oldIndex, 1);
            songs[2].splice(evt.newIndex, 0, movedSong);
            savePlaylist(2);
        }
    });

    // Save playlist order to IndexedDB
    function savePlaylist(playlistId) {
        if (!db) {
            console.error('Database not initialized.');
            return;
        }
        const transaction = db.transaction(['songs'], 'readwrite');
        const objectStore = transaction.objectStore('songs');
        objectStore.clear();
        songs[playlistId].forEach(song => {
            objectStore.add(song);
        });
    }

    function playSong(index) {
        if (index >= 0 && index < songs[currentPlaylist].length) {
            audio.src = songs[currentPlaylist][index].url;
            audio.play();
            isPlaying = true;
            currentSongIndex = index;

            if (songs[currentPlaylist][index].artwork) {
                albumArt.style.backgroundImage = `url('${songs[currentPlaylist][index].artwork}')`;
                albumArt.style.backgroundSize = 'cover';
                albumArt.style.backgroundPosition = 'center';
            } else {
                albumArt.style.backgroundImage = 'none';
            }

            audio.addEventListener('ended', () => {
                currentSongIndex++;
                if (currentSongIndex < songs[currentPlaylist].length) {
                    playSong(currentSongIndex);
                } else {
                    isPlaying = false;
                }
            });

            // Update visualizer
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            drawVisualizer();
        }
    }
    playButton.addEventListener('click', () => {
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
        } else {
            audio.play();
            isPlaying = true;
            // Ensure currentSongIndex is set correctly
            updatePlaylist(currentPlaylist);
        }
        gsap.to(playButton, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1 });
    });
    audio.addEventListener('playing', () => {
        isPlaying = true;
        updatePlaylist(currentPlaylist);
    });
    
    audio.addEventListener('pause', () => {
        isPlaying = false;
        updatePlaylist(currentPlaylist);
    });

    prevButton.addEventListener('click', () => {
        if (currentSongIndex > 0) {
            currentSongIndex--;
            playSong(currentSongIndex);
        }
        gsap.to(prevButton, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1 });
    });

    nextButton.addEventListener('click', () => {
        if (currentSongIndex < songs[currentPlaylist].length - 1) {
            currentSongIndex++;
            playSong(currentSongIndex);
        }
        gsap.to(nextButton, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1 });
    });

    volumeControl.addEventListener('input', (e) => {
        audio.volume = e.target.value;
    });

    audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        const progress = (currentTime / duration) * 100;

        progressBar.style.width = progress + '%';
        currentTimeDisplay.textContent = formatTime(currentTime);
        totalDurationDisplay.textContent = formatTime(duration);
    });

    // Seek functionality for progress bar
    musicLoader.addEventListener('click', (e) => {
        const clickX = e.offsetX;
        const width = musicLoader.clientWidth;
        const duration = audio.duration;
        audio.currentTime = (clickX / width) * duration;
    });

    musicLoader.addEventListener('mousedown', (e) => {
        const onMouseMove = (e) => {
            const clickX = e.offsetX;
            const width = musicLoader.clientWidth;
            const duration = audio.duration;
            audio.currentTime = (clickX / width) * duration;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    backgroundUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.body.style.backgroundImage = `url('${event.target.result}')`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.animation = 'none';
                document.body.classList.remove('gradient-background');
                document.body.dataset.backgroundAdded = true; // Mark that a background image was added
            };
            reader.readAsDataURL(file);
        }
    });

    deleteBackgroundIcon.addEventListener('click', () => {
        if (document.body.dataset.backgroundAdded) {
            document.body.style.backgroundImage = 'none';
            document.body.classList.add('gradient-background');
            delete document.body.dataset.backgroundAdded; // Remove the marker
        }
    });

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    // Audio Visualizer
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvasCtx = visualizer.getContext('2d');

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, visualizer.width, visualizer.height);

        const barWidth = (visualizer.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];

            const r = barHeight + (25 * (i / bufferLength));
            const g = 255 * (i / bufferLength);
            const b = 50;

            canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
            canvasCtx.fillRect(x, visualizer.height - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1;
        }
    }

    audio.addEventListener('play', () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        drawVisualizer();
    });

    loadPlaylists();
});


// scricpt for loader 
var loader = document.querySelector("#loader")
setTimeout(() => {
    loader.style.top = "-100%";
}, 6000);