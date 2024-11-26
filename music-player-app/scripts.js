document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('play');
    const prevButton = document.getElementById('prev');
    const nextButton = document.getElementById('next');
    const volumeControl = document.getElementById('volume');
    const playlist = document.getElementById('playlist');
    const albumArt = document.getElementById('album-art');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalDurationDisplay = document.getElementById('total-duration');
    const progressBar = document.getElementById('progress-bar');
    const backgroundUpload = document.getElementById('background-upload');
    const fileInput = document.getElementById('file-input');
    const trackCount = document.getElementById('track-count');
    const deleteBackgroundButton = document.getElementById('delete-background');
    const musicLoader = document.getElementById('music-loader');

    let audio = new Audio();
    let isPlaying = false;
    let currentSongIndex = 0;
    let db;
    let songs = [];

    // Open IndexedDB[_{{{CITATION{{{_1{](https://github.com/fujikawa-lab/rumpfeed/tree/ca8bb086ac55dbd966aefc3fcc7a5eccf588e6e8/content%2Fworkshops%2Fstyled_components%2FREADME.md)[_{{{CITATION{{{_2{](https://github.com/bgoonz/web-dev-utils-package/tree/65a7b21c0444f4cbeb3c313a750fb43560047e77/personal-utilities%2Fcopy-2-clip%2FREADME.md)[_{{{CITATION{{{_3{](https://github.com/ksmself/Gitbook/tree/8323185d6834febe784044415ee708bf3b7fcf1b/html%2Fhtml.md)[_{{{CITATION{{{_4{](https://github.com/jmeboji/template-music-player/tree/78b0e954b392ef0f0069401f1f3007be378a171b/index.md)
    const request = indexedDB.open('musicPlayerDB', 1);

    request.onerror = (event) => {
        console.error('IndexedDB error:', event);
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        if (db) {
            loadPlaylist();
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

    // Load playlist from IndexedDB
    function loadPlaylist() {
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
                songs = savedSongs;
                updatePlaylist();
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

    // Update playlist display
    function updatePlaylist() {
        playlist.innerHTML = '';
        songs.forEach((song) => {
            const songElement = document.createElement('div');
            songElement.className = 'song';
            songElement.innerText = song.name;
            songElement.draggable = true; // Make it draggable
            playlist.appendChild(songElement);
        });
        trackCount.textContent = songs.length;
        console.log('Playlist updated:', songs);
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
                    artwork: artworkUrl
                };
                songs.push(song);
                saveSong(song);
                updatePlaylist();
            };
            reader.readAsDataURL(file);
        }
    });

    // Initialize Sortable for drag-and-drop functionality
    new Sortable(playlist, {
        animation: 150,
        onEnd: (evt) => {
            const [movedSong] = songs.splice(evt.oldIndex, 1);
            songs.splice(evt.newIndex, 0, movedSong);
            savePlaylist();
        }
    });

    // Save playlist order to IndexedDB
    function savePlaylist() {
        if (!db) {
            console.error('Database not initialized.');
            return;
        }
        const transaction = db.transaction(['songs'], 'readwrite');
        const objectStore = transaction.objectStore('songs');
        objectStore.clear();
        songs.forEach(song => {
            objectStore.add(song);
        });
    }

    function playSong(index) {
        if (index >= 0 && index < songs.length) {
            audio.src = songs[index].url;
            audio.play();
            isPlaying = true;
            currentSongIndex = index;
            if (songs[index].artwork) {
                albumArt.style.backgroundImage = `url('${songs[index].artwork}')`;
                albumArt.style.backgroundSize = 'cover';
                albumArt.style.backgroundPosition = 'center';
            } else {
                albumArt.style.backgroundImage = 'none';
                albumArt.innerHTML = `<p>No track selected</p><p>Unknown Artist</p>`;
            }
            audio.addEventListener('ended', () => {
                currentSongIndex++;
                if (currentSongIndex < songs.length) {
                    playSong(currentSongIndex);
                } else {
                    isPlaying = false;
                }
            });
        }
    }

    playButton.addEventListener('click', () => {
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
        } else {
            playSong(currentSongIndex);
        }
        gsap.to(playButton, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1 });
    });

    prevButton.addEventListener('click', () => {
        if (currentSongIndex > 0) {
            currentSongIndex--;
            playSong(currentSongIndex);
        }
        gsap.to(prevButton, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1 });
    });

    nextButton.addEventListener('click', () => {
        if (currentSongIndex < songs.length - 1) {
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
            };
            reader.readAsDataURL(file);
        }
    });

    deleteBackgroundButton.addEventListener('click', () => {
        document.body.style.backgroundImage = 'none';
        document.body.classList.add('gradient-background');
    });

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    loadPlaylist();
});
