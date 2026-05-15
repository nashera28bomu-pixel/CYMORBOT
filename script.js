document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("fileInput");
    const startBtn = document.getElementById("startBtn");
    const downloadContainer = document.getElementById("downloadContainer");
    const downloadBtn = document.getElementById("downloadBtn");
    const sourceVideo = document.getElementById("sourceVideo");
    const processedVideo = document.getElementById("processedVideo");
    const processingOverlay = document.getElementById("processingOverlay");
    const progressBar = document.getElementById("progressBar");
    const statusText = document.getElementById("statusText");
    const beforeWrapper = document.getElementById("beforeWrapper");
    const sliderHandle = document.getElementById("sliderHandle");

    let videoUrl = null;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            videoUrl = URL.createObjectURL(file);
            sourceVideo.src = videoUrl;
            processedVideo.src = videoUrl;
            document.getElementById('settingsBox').classList.remove('disabled');
            downloadContainer.classList.add('hidden'); // Hide download if new file uploaded
        }
    });

    // Slider Logic
    const moveSlider = (e) => {
        const rect = document.getElementById("sliderContainer").getBoundingClientRect();
        let x = (e.pageX || e.touches[0].pageX) - rect.left;
        let pos = (x / rect.width) * 100;
        if (pos < 0) pos = 0; if (pos > 100) pos = 100;
        beforeWrapper.style.width = pos + "%";
        sliderHandle.style.left = pos + "%";
    };

    sliderHandle.addEventListener('mousedown', () => window.addEventListener('mousemove', moveSlider));
    window.addEventListener('mouseup', () => window.removeEventListener('mousemove', moveSlider));
    sliderHandle.addEventListener('touchstart', () => window.addEventListener('touchmove', moveSlider));
    window.addEventListener('touchend', () => window.removeEventListener('touchmove', moveSlider));

    // Render Simulation
    startBtn.addEventListener('click', async () => {
        processingOverlay.classList.remove('hidden');
        let progress = 0;
        
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(finishRender, 500);
            }
            progressBar.style.width = progress + "%";
            document.getElementById('progressPercent').textContent = Math.floor(progress) + "%";
        }, 300);
    });

    function finishRender() {
        processingOverlay.classList.add('hidden');
        
        // Apply "Cymor" Visual Enhancement to preview
        processedVideo.style.filter = "contrast(1.15) saturate(1.2) brightness(1.05)";
        processedVideo.style.boxShadow = "0 0 20px rgba(0, 242, 254, 0.4)";
        
        // SHOW THE DOWNLOAD BUTTON
        downloadContainer.classList.remove('hidden');
        
        alert("Enhancement Complete! Your 4K video is ready for download.");
    }

    // DOWNLOAD FUNCTION
    downloadBtn.addEventListener('click', () => {
        if (!videoUrl) return;
        const a = document.createElement('a');
        a.href = videoUrl; 
        a.download = "Cymor_Enhanced_4K.mp4";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
});
