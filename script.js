document.addEventListener("DOMContentLoaded", () => {
    // DOM Node Selection Elements
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const settingsBox = document.getElementById("settingsBox");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const startBtn = document.getElementById("startBtn");
    const sourceVideo = document.getElementById("sourceVideo");
    const processedVideo = document.getElementById("processedVideo");
    const processingOverlay = document.getElementById("processingOverlay");
    const progressBar = document.getElementById("progressBar");
    const progressPercent = document.getElementById("progressPercent");
    const statusText = document.getElementById("statusText");
    
    // Sliders Comparison Elements
    const sliderContainer = document.getElementById("sliderContainer");
    const beforeWrapper = document.getElementById("beforeWrapper");
    const sliderHandle = document.getElementById("sliderHandle");

    let videoFile = null;

    // --- 1. Drag & Drop File Event Handlers ---
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) handleVideoSelection(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleVideoSelection(e.target.files[0]);
    });

    function handleVideoSelection(file) {
        if (!file.type.startsWith('video/')) {
            alert('Error: Please select a valid video file extension.');
            return;
        }
        videoFile = file;
        
        // Parse metadata to UI Panels
        fileName.textContent = file.name.length > 22 ? file.name.substring(0, 20) + '...' : file.name;
        fileSize.textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        
        // Activate Control Config Panel
        settingsBox.classList.remove('disabled');
        startBtn.disabled = false;

        // Create Object Blob URLs for standard HTML5 hardware acceleration playback
        const objectURL = URL.createObjectURL(file);
        sourceVideo.src = objectURL;
        processedVideo.src = objectURL; // Emulated split preview side
        
        // Multi-video synchronized timeline playback loops
        sourceVideo.load();
        processedVideo.load();
        
        // Autoplay synchronizer matching frame lines
        const playVideo = () => {
            sourceVideo.play();
            processedVideo.play();
        };
        sourceVideo.oncanplay = playVideo;
    }

    // --- 2. Interactive Split Before/After Rendering Slider Engine ---
    let isDragging = false;

    const moveSlider = (clientX) => {
        const rect = sliderContainer.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        let percentage = (offsetX / rect.width) * 100;
        
        // Boundary containment locks
        if (percentage < 0) percentage = 0;
        if (percentage > 100) percentage = 100;

        beforeWrapper.style.width = `${percentage}%`;
        sliderHandle.style.left = `${percentage}%`;
    };

    sliderHandle.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => { if (isDragging) moveSlider(e.clientX); });

    // Touch Support for Mobile Browsers
    sliderHandle.addEventListener('touchstart', () => isDragging = true);
    window.addEventListener('touchend', () => isDragging = false);
    window.addEventListener('touchmove', (e) => { 
        if (isDragging && e.touches.length) moveSlider(e.touches[0].clientX); 
    });


    // --- 3. Async Client WebGPU Spatial Pipeline Emulation ---
    startBtn.addEventListener('click', async () => {
        if (!videoFile) return;

        // Lock UI & deploy computation layer layout overlays
        processingOverlay.classList.remove('hidden');
        startBtn.disabled = true;

        const processSteps = [
            { text: "Initializing WebGPU Context Clones...", delay: 1200 },
            { text: "Allocating Texture Channels & Matrices...", delay: 1500 },
            { text: "Injecting Super-Resolution Weights via WebCodecs...", delay: 1800 },
            { text: "Upscaling Frame Sequences to 4K Ultra Quality...", delay: 4000 }
        ];

        // Process loop simulation passing weights and pipeline instructions locally
        for (let i = 0; i < processSteps.length; i++) {
            statusText.textContent = processSteps[i].text;
            await new Promise(resolve => setTimeout(resolve, processSteps[i].delay / 2));
            
            // Render linear progress bars step updates
            let progressFactor = Math.floor(((i + 1) / processSteps.length) * 65);
            progressBar.style.width = `${progressFactor}%`;
            progressPercent.textContent = `${progressFactor}%`;
        }

        // Finalize compute tasks, export clean wrapper frame lines
        let frameProgress = 65;
        const interval = setInterval(() => {
            frameProgress += Math.floor(Math.random() * 5) + 2;
            if (frameProgress >= 100) {
                frameProgress = 100;
                clearInterval(interval);
                finalizeRender();
            }
            progressBar.style.width = `${frameProgress}%`;
            progressPercent.textContent = `${frameProgress}%`;
            statusText.textContent = `Compiling 4K Bitstream Muxer Layer [Frame Sync Mode]`;
        }, 150);
    });

    function finalizeRender() {
        processingOverlay.classList.add('hidden');
        startBtn.disabled = false;
        progressBar.style.width = `0%`;
        progressPercent.textContent = `0%`;
        
        // Add artificial HDR overlay visual boost effects to the "After" preview video tracking to simulate AI success
        processedVideo.style.filter = "contrast(1.06) saturate(1.08) brightness(1.02); shadow(0 0 4px cyan)";
        
        alert("💥 4K AI Scale Completed Successfully! (Note: In your production build, the WebCodecs Blob file output trigger will compile directly to your local file download stack here).");
    }
});
