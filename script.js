document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('capture');
    const toggleCameraBtn = document.getElementById('toggleCamera');
    const resetFrameBtn = document.getElementById('resetFrame');
    const photoboothFrame = document.getElementById('photoboothFrame');
    const backgroundLayer = document.getElementById('backgroundLayer');
    const frameTextInput = document.getElementById('frameText');
    const fontSelect = document.getElementById('fontSelect');
    const textColorPicker = document.getElementById('textColor');
    const backgroundColorPicker = document.getElementById('backgroundColor');
    const backgroundImageInput = document.getElementById('backgroundImage');
    const repeatBackgroundCheckbox = document.getElementById('repeatBackground');
    const downloadPhotoBtn = document.getElementById('downloadPhoto');
    const frameOrientationSelect = document.getElementById('frameOrientation');
    const addTextBtn = document.getElementById('addTextBtn');
    const removeTextBtn = document.getElementById('removeTextBtn');
    const addStickerBtn = document.getElementById('addStickerBtn');
    const stickerUpload = document.getElementById('stickerUpload');
    const textSizeSlider = document.getElementById('textSize');
    const textSizeValue = document.getElementById('textSizeValue');
    const textRotationSlider = document.getElementById('textRotation');
    const textRotationValue = document.getElementById('textRotationValue');

    // State variables
    let stream = null;
    let photos = [];
    let textElements = [];
    let stickerElements = [];
    let activeTextElement = null;
    let activeStickerElement = null;
    let contextMenu = null;
    let isDragging = false;
    let initialX, initialY;
    let showBorders = true;
    let backgroundImage = null;
    let repeatBackground = true;
    let isBackgroundActive = false;
    let backgroundWidth = 0;
    let backgroundHeight = 0;
    let stickerCount = 0;
    const MAX_STICKERS = 10;

    // Initialize
    initCamera();
    setupEventListeners();
    updateFrameOrientation();
    createInitialSlots();

    function createInitialSlots() {
        const frameHeader = photoboothFrame.querySelector('.frame-header') || photoboothFrame;
        for (let i = 0; i < 4; i++) {
            const slot = document.createElement('div');
            slot.className = 'frame-slot';
            slot.setAttribute('data-index', i);
            photoboothFrame.insertBefore(slot, frameHeader.nextSibling);
        }
    }

    async function initCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: false
            });
            video.srcObject = stream;
            video.play().catch(err => console.error("Video play error:", err));
            toggleCameraBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
            captureBtn.disabled = false;
        } catch (err) {
            console.error("Camera error:", err);
            alert("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.");
            captureBtn.disabled = true;
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            toggleCameraBtn.innerHTML = '<i class="fas fa-video"></i>';
            captureBtn.disabled = true;
        }
    }

    function setupEventListeners() {
        document.addEventListener('click', handleDocumentClick);
        document.addEventListener('touchstart', handleDocumentClick);
        document.getElementById('removeBackgroundBtn').addEventListener('click', removeBackgroundImage);
        toggleCameraBtn.addEventListener('click', () => (video.srcObject ? stopCamera() : initCamera()));
        captureBtn.addEventListener('click', capturePhoto);
        resetFrameBtn.addEventListener('click', resetFrame);
        frameTextInput.addEventListener('input', updateActiveTextElement);
        fontSelect.addEventListener('change', updateActiveTextElement);
        textColorPicker.addEventListener('input', updateActiveTextElement);
        textSizeSlider.addEventListener('input', updateTextSize);
        textRotationSlider.addEventListener('input', updateTextRotation);
        backgroundColorPicker.addEventListener('input', updateFramePreview);
        backgroundImageInput.addEventListener('change', handleBackgroundImage);
        repeatBackgroundCheckbox.addEventListener('change', () => {
            repeatBackground = repeatBackgroundCheckbox.checked;
            updateFramePreview();
        });
        downloadPhotoBtn.addEventListener('click', downloadPhoto);
        frameOrientationSelect.addEventListener('change', updateFrameOrientation);
        addTextBtn.addEventListener('click', addTextElement);
        removeTextBtn.addEventListener('click', removeActiveTextElement);
        addStickerBtn.addEventListener('click', openStickerUpload);
        stickerUpload.addEventListener('change', handleStickerUpload);
        
        photoboothFrame.addEventListener('click', handleFrameClick);
        photoboothFrame.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('click', handleDocumentClick);
        photoboothFrame.addEventListener('mousedown', startInteraction);
        photoboothFrame.addEventListener('touchstart', startInteraction, { passive: false });
        document.addEventListener('mousemove', handleInteraction);
        document.addEventListener('touchmove', handleInteraction, { passive: false });
        document.addEventListener('mouseup', stopInteraction);
        document.addEventListener('touchend', stopInteraction);
    }

    function updateTextSize() {
        textSizeValue.textContent = textSizeSlider.value;
        updateActiveTextElement();
    }

    function updateTextRotation() {
        textRotationValue.textContent = textRotationSlider.value;
        updateActiveTextElement();
    }

    function handleBackgroundImage(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                backgroundImage = new Image();
                backgroundImage.src = event.target.result;
                backgroundImage.onload = () => {
                    const frameRect = photoboothFrame.getBoundingClientRect();
                    const maxTileSize = Math.min(frameRect.width, frameRect.height) / 4;
                    backgroundWidth = Math.min(backgroundImage.width, maxTileSize);
                    backgroundHeight = Math.min(backgroundImage.height, maxTileSize);
                    const aspectRatio = backgroundImage.width / backgroundImage.height;
                    if (backgroundWidth / backgroundHeight > aspectRatio) {
                        backgroundWidth = backgroundHeight * aspectRatio;
                    } else {
                        backgroundHeight = backgroundWidth / aspectRatio;
                    }
                    updateFramePreview();
                };
            };
            reader.readAsDataURL(file);
        } else {
            backgroundImage = null;
            backgroundWidth = 0;
            backgroundHeight = 0;
            updateFramePreview();
        }
    }

    function openStickerUpload() {
        if (photos.length === 0) {
            alert('Vui lòng chụp ít nhất một ảnh trước khi thêm sticker.');
            return;
        }
        if (stickerCount >= MAX_STICKERS) {
            alert(`Bạn đã đạt tối đa ${MAX_STICKERS} sticker. Vui lòng xóa bớt trước khi thêm mới.`);
            return;
        }
        stickerUpload.click();
    }

    function handleStickerUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            alert('Vui lòng chọn file ảnh (JPEG, PNG, GIF)');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            addStickerElement(event.target.result);
            e.target.value = ''; // Reset input để có thể chọn cùng file lại
        };
        reader.readAsDataURL(file);
    }

    function addStickerElement(stickerUrl) {
        if (!stickerUrl) return;

        const stickerElement = document.createElement('img');
        stickerElement.className = 'sticker-element active';
        stickerElement.src = stickerUrl;
        stickerElement.style.width = '100px';
        stickerElement.style.height = 'auto';
        stickerElement.style.position = 'absolute';
        stickerElement.style.transform = 'rotate(0deg)';
        stickerElement.style.zIndex = '100';
        stickerElement.style.cursor = 'grab';
        stickerElement.draggable = false;

        const frameRect = photoboothFrame.getBoundingClientRect();
        const x = frameRect.width / 2 - 50;
        const y = frameRect.height / 2 - 50;
        stickerElement.style.left = `${x}px`;
        stickerElement.style.top = `${y}px`;

        const stickerObj = {
            element: stickerElement,
            slotIndex: photos.length - 1,
            url: stickerUrl,
            size: 100,
            rotation: 0,
            x: x,
            y: y
        };

        stickerElements.push(stickerObj);
        activeStickerElement = stickerObj;
        photoboothFrame.appendChild(stickerElement);
        setupStickerElementInteractions(stickerElement);
        stickerCount++;

        stickerElement.onerror = () => {
            console.error('Failed to load sticker image:', stickerUrl);
            stickerElement.remove();
            const index = stickerElements.indexOf(stickerObj);
            if (index !== -1) stickerElements.splice(index, 1);
            stickerCount--;
            alert('Không thể tải sticker. Vui lòng chọn file ảnh khác.');
        };
    }

    function setupStickerElementInteractions(element) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            setActiveStickerElement(element);
        });
        element.addEventListener('mousedown', startInteraction);
        element.addEventListener('touchstart', startInteraction, { passive: false });
    }

    function setActiveStickerElement(element) {
        document.querySelectorAll('.sticker-element').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.text-element').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        activeTextElement = null;
        const stickerObj = stickerElements.find(s => s.element === element);
        if (stickerObj) activeStickerElement = stickerObj;
    }

    function updateActiveStickerElement() {
        if (!activeStickerElement) return;
        const element = activeStickerElement.element;
        element.style.width = `${activeStickerElement.size}px`;
        element.style.height = 'auto';
        element.style.transform = `rotate(${activeStickerElement.rotation}deg)`;
        element.style.left = `${activeStickerElement.x}px`;
        element.style.top = `${activeStickerElement.y}px`;
    }

    function removeActiveStickerElement() {
        if (!activeStickerElement) {
            alert('Không có sticker nào được chọn để xóa.');
            return;
        }
        const index = stickerElements.findIndex(s => s === activeStickerElement);
        if (index !== -1) {
            activeStickerElement.element.remove();
            stickerElements.splice(index, 1);
            activeStickerElement = null;
            stickerCount--;
            hideContextMenu();
        }
    }

    function handleFrameClick(e) {
        const textElement = e.target.closest('.text-element');
        const stickerElement = e.target.closest('.sticker-element');
        const isBackground = e.target === backgroundLayer;
        if (textElement) {
            e.stopPropagation();
            setActiveTextElement(textElement);
            activeStickerElement = null;
            isBackgroundActive = false;
            backgroundLayer.classList.remove('active');
        } else if (stickerElement) {
            e.stopPropagation();
            setActiveStickerElement(stickerElement);
            activeTextElement = null;
            isBackgroundActive = false;
            backgroundLayer.classList.remove('active');
        } else if (isBackground && backgroundImage) {
            e.stopPropagation();
            document.querySelectorAll('.text-element').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.sticker-element').forEach(el => el.classList.remove('active'));
            activeTextElement = null;
            activeStickerElement = null;
            isBackgroundActive = true;
            backgroundLayer.classList.add('active');
            hideContextMenu();
        } else {
            document.querySelectorAll('.text-element').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.sticker-element').forEach(el => el.classList.remove('active'));
            activeTextElement = null;
            activeStickerElement = null;
            isBackgroundActive = false;
            backgroundLayer.classList.remove('active');
            hideContextMenu();
        }
    }

    function handleContextMenu(e) {
        e.preventDefault();
        const textElement = e.target.closest('.text-element');
        const stickerElement = e.target.closest('.sticker-element');
        if (textElement) {
            setActiveTextElement(textElement);
            showTextContextMenu(e, textElement);
        } else if (stickerElement) {
            setActiveStickerElement(stickerElement);
            showStickerContextMenu(e, stickerElement);
        } else {
            hideContextMenu();
        }
    }

   function handleDocumentClick(e) {
    if (!contextMenu) return;
    
    // Kiểm tra nếu click ra ngoài context menu
    if (!contextMenu.contains(e.target)) {
        // Chỉ ẩn menu nếu không click vào các phần tử điều khiển
        const isControlElement = e.target.closest('.icon-btn') || 
                               e.target.closest('.control-group') ||
                               e.target.closest('.button-group') ||
                               e.target.closest('.select2-container');
        
        if (!isControlElement) {
            hideContextMenu();
        }
    }
    }

    

    function removeBackgroundImage() {
    backgroundImage = null;
    backgroundImageInput.value = '';
    updateFramePreview();
    }

    function showTextContextMenu(e, element) {
        hideContextMenu();
        contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'absolute';
        const frameRect = photoboothFrame.getBoundingClientRect();
        let x = e.clientX - frameRect.left;
        let y = e.clientY - frameRect.top;
        if (x + 220 > frameRect.width) x = frameRect.width - 220;
        if (y + 250 > frameRect.height) y = frameRect.height - 250;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;

        contextMenu.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div>
                    <label style="font-size: 0.8rem; color: #555;">Nội dung:</label>
                    <input type="text" id="contextText" value="${element.textContent || ''}" style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; direction: ltr;">
                </div>
                <div>
                    <label style="font-size: 0.8rem; color: #555;">Font chữ:</label>
                    <select id="contextFont" style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        ${Array.from(fontSelect.options).map(opt => `<option value="${opt.value}" style="font-family: ${opt.style.fontFamily}" ${opt.value === activeTextElement.font ? 'selected' : ''}>${opt.text}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size: 0.8rem; color: #555;">Màu chữ:</label>
                    <input type="color" id="contextColor" value="${activeTextElement.color}" style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div>
                    <label style="font-size: 0.8rem; color: #555;">Kích thước: <span id="contextSizeValue">${activeTextElement.size}</span>px</label>
                    <input type="range" id="contextSize" min="10" max="72" value="${activeTextElement.size}" style="width: 100%; z-index: 2000;">
                </div>
                <div>
                    <label style="font-size: 0.8rem; color: #555;">Góc xoay: <span id="contextRotationValue">${activeTextElement.rotation}</span>°</label>
                    <input type="range" id="contextRotation" min="0" max="360" value="${activeTextElement.rotation}" style="width: 100%; z-index: 2000;">
                </div>
                <button id="contextApply" style="background: #ff5e78; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer;">Áp dụng</button>
            </div>
        `;

        photoboothFrame.appendChild(contextMenu);
        contextMenu.addEventListener('click', (e) => e.stopPropagation());

        const contextText = contextMenu.querySelector('#contextText');
        contextText.addEventListener('input', (e) => {
            e.stopPropagation();
            activeTextElement.text = e.target.value;
            activeTextElement.element.textContent = e.target.value;
            frameTextInput.value = e.target.value;
            updateActiveTextElement();
        });

        const contextFont = $(contextMenu).find('#contextFont');
        contextFont.on('select2:select', (e) => {
            e.stopPropagation();
            const newFont = e.params.data.text;
            activeTextElement.font = newFont;
            activeTextElement.element.style.fontFamily = `'${newFont}'`;
            fontSelect.value = newFont;
            updateActiveTextElement();
        });

        const contextColor = contextMenu.querySelector('#contextColor');
        contextColor.addEventListener('input', (e) => {
            e.stopPropagation();
            activeTextElement.color = e.target.value;
            activeTextElement.element.style.color = e.target.value;
            textColorPicker.value = e.target.value;
            updateActiveTextElement();
        });

        const contextSize = contextMenu.querySelector('#contextSize');
        contextSize.addEventListener('mousedown', (e) => e.stopPropagation());
        contextSize.addEventListener('pointerdown', (e) => e.stopPropagation());
        contextSize.addEventListener('input', (e) => {
            e.stopPropagation();
            const size = parseInt(e.target.value);
            activeTextElement.size = size;
            activeTextElement.element.style.fontSize = `${size}px`;
            contextMenu.querySelector('#contextSizeValue').textContent = size;
            textSizeSlider.value = size;
            textSizeValue.textContent = size;
            updateActiveTextElement();
        });

        const contextRotation = contextMenu.querySelector('#contextRotation');
        contextRotation.addEventListener('mousedown', (e) => e.stopPropagation());
        contextRotation.addEventListener('pointerdown', (e) => e.stopPropagation());
        contextRotation.addEventListener('input', (e) => {
            e.stopPropagation();
            const rotation = parseInt(e.target.value);
            activeTextElement.rotation = rotation;
            activeTextElement.element.style.transform = `rotate(${rotation}deg)`;
            contextMenu.querySelector('#contextRotationValue').textContent = rotation;
            textRotationSlider.value = rotation;
            textRotationValue.textContent = rotation;
            updateActiveTextElement();
        });

        contextMenu.querySelector('#contextApply').addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
        });

        $(contextMenu).find('#contextFont').select2({
            width: '100%',
            templateResult: state => !state.id ? state.text : $(`<span style="font-family:${state.text}">${state.text}</span>`),
            templateSelection: state => !state.id ? state.text : $(`<span style="font-family:${state.text}">${state.text}</span>`),
            dropdownParent: $(contextMenu)
        });
    }

    function showStickerContextMenu(e, element) {
        hideContextMenu();
        contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'absolute';
        const frameRect = photoboothFrame.getBoundingClientRect();
        let x = e.clientX - frameRect.left;
        let y = e.clientY - frameRect.top;
        if (x + 220 > frameRect.width) x = frameRect.width - 220;
        if (y + 200 > frameRect.height) y = frameRect.height - 200;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;

        contextMenu.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div>
                    <label style="font-size: 0.8rem; color: #555;">Kích thước: <span id="contextSizeValue">${activeStickerElement.size}</span>px</label>
                    <input type="range" id="contextSize" min="10" max="200" value="${activeStickerElement.size}" style="width: 100%; z-index: 2000;">
                </div>
                <div>
                    <label style="font-size: 0.8rem; color: #555;">Góc xoay: <span id="contextRotationValue">${activeStickerElement.rotation}</span>°</label>
                    <input type="range" id="contextRotation" min="0" max="360" value="${activeStickerElement.rotation}" style="width: 100%; z-index: 2000;">
                </div>
                <button id="contextApply" style="background: #ff5e78; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer;">Áp dụng</button>
                <button id="contextRemove" style="background: #ff4444; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer;">Xóa Sticker</button>
            </div>
        `;

        photoboothFrame.appendChild(contextMenu);
        contextMenu.addEventListener('click', (e) => e.stopPropagation());

        const contextSize = contextMenu.querySelector('#contextSize');
        contextSize.addEventListener('mousedown', (e) => e.stopPropagation());
        contextSize.addEventListener('pointerdown', (e) => e.stopPropagation());
        contextSize.addEventListener('input', (e) => {
            e.stopPropagation();
            const size = parseInt(e.target.value);
            activeStickerElement.size = size;
            contextMenu.querySelector('#contextSizeValue').textContent = size;
            updateActiveStickerElement();
        });

        const contextRotation = contextMenu.querySelector('#contextRotation');
        contextRotation.addEventListener('mousedown', (e) => e.stopPropagation());
        contextRotation.addEventListener('pointerdown', (e) => e.stopPropagation());
        contextRotation.addEventListener('input', (e) => {
            e.stopPropagation();
            const rotation = parseInt(e.target.value);
            activeStickerElement.rotation = rotation;
            contextMenu.querySelector('#contextRotationValue').textContent = rotation;
            updateActiveStickerElement();
        });

        contextMenu.querySelector('#contextApply').addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
        });

        contextMenu.querySelector('#contextRemove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeActiveStickerElement();
        });
    }

    function hideContextMenu() {
    if (contextMenu) {
        // Xóa Select2 nếu có
        const select2 = $(contextMenu).find('.select2-container');
        if (select2.length) {
            $(contextMenu).find('select').select2('destroy');
        }
        
        contextMenu.remove();
        contextMenu = null;
    }
}

    function capturePhoto() {
        if (!stream || photos.length >= 4) {
            alert(photos.length >= 4 ? 'Đã đạt tối đa 4 ảnh.' : 'Vui lòng bật camera để chụp ảnh.');
            return;
        }

        const flash = document.createElement('div');
        flash.className = 'camera-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 500);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        photos.push(canvas.toDataURL('image/png'));
        updatePhotoboothFrame();
    }

    function updatePhotoboothFrame() {
        const slots = photoboothFrame.querySelectorAll('.frame-slot');
        slots.forEach((slot, index) => {
            slot.innerHTML = '';
            if (index < photos.length) {
                const img = document.createElement('img');
                img.src = photos[index];
                slot.appendChild(img);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-photo-btn';
                deleteBtn.innerHTML = '&times;';
                deleteBtn.title = 'Xóa ảnh';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    photos.splice(index, 1);
                    updatePhotoboothFrame();
                });
                slot.appendChild(deleteBtn);
                slot.style.display = 'flex';
                slot.classList.toggle('no-border', !showBorders);
            } else {
                slot.style.display = 'none';
            }
        });

        photoboothFrame.classList.remove('single-photo');
        if (photos.length === 0) {
            photoboothFrame.style.minHeight = '200px';
        } else if (photos.length === 1) {
            photoboothFrame.style.minHeight = '300px';
            if (!photoboothFrame.classList.contains('square')) {
                photoboothFrame.classList.add('single-photo');
            }
        } else {
            photoboothFrame.style.minHeight = '600px';
        }

        updateFramePreview();

        textElements.forEach(textEl => {
            if (!photoboothFrame.contains(textEl.element)) {
                const textElementClone = textEl.element.cloneNode(true);
                textElementClone.contentEditable = true;
                photoboothFrame.appendChild(textElementClone);
                setupTextElementInteractions(textElementClone);
                textEl.element = textElementClone;
            }
        });

        stickerElements.forEach(stickerEl => {
            if (!photoboothFrame.contains(stickerEl.element)) {
                const stickerElementClone = stickerEl.element.cloneNode(true);
                photoboothFrame.appendChild(stickerElementClone);
                setupStickerElementInteractions(stickerElementClone);
                stickerEl.element = stickerElementClone;
            }
        });
    }

    function updateFramePreview() {
        photoboothFrame.style.backgroundImage = '';
    if (backgroundImage) {
        photoboothFrame.style.backgroundColor = '';
        backgroundLayer.style.backgroundImage = `url(${backgroundImage.src})`;
        if (repeatBackground) {
            backgroundLayer.style.backgroundSize = `${backgroundWidth}px ${backgroundHeight}px`;
            backgroundLayer.style.backgroundRepeat = 'repeat';
        } else {
            backgroundLayer.style.backgroundSize = 'cover';
            backgroundLayer.style.backgroundRepeat = 'no-repeat';
        }
        backgroundLayer.style.backgroundPosition = 'center';
    } else {
        backgroundLayer.style.backgroundImage = '';
        backgroundLayer.style.backgroundSize = '';
        backgroundLayer.style.backgroundRepeat = '';
        photoboothFrame.style.backgroundColor = backgroundColorPicker.value;
        }
    }

    function updateFrameOrientation() {
        const orientation = frameOrientationSelect.value;
        photoboothFrame.classList.remove('square', 'vertical');
        photoboothFrame.classList.add(orientation);
        updatePhotoboothFrame();
    }

    function addTextElement() {
        if (photos.length === 0) {
            alert('Vui lòng chụp ít nhất một ảnh trước khi thêm chữ.');
            return;
        }

        const textElement = document.createElement('div');
        textElement.className = 'text-element active';
        textElement.contentEditable = true;
        textElement.style.fontFamily = `'${fontSelect.value}'`;
        textElement.style.color = textColorPicker.value;
        textElement.style.fontSize = `${textSizeSlider.value}px`;
        textElement.style.left = '10px';
        textElement.style.top = '120px';
        textElement.style.position = 'absolute';
        textElement.style.transform = `rotate(${textRotationSlider.value}deg)`;
        textElement.style.direction = 'ltr';
        textElement.style.textAlign = 'left';

        const textObj = {
            element: textElement,
            slotIndex: photos.length - 1,
            text: frameTextInput.value || '',
            font: fontSelect.value,
            color: textColorPicker.value,
            size: parseInt(textSizeSlider.value),
            rotation: parseInt(textRotationSlider.value),
            x: 10,
            y: 120
        };

        textElements.push(textObj);
        activeTextElement = textObj;
        activeStickerElement = null;
        photoboothFrame.appendChild(textElement);
        setupTextElementInteractions(textElement);

        if (frameTextInput.value) {
            textElement.textContent = frameTextInput.value;
        }

        textElement.focus();
    }

    function setupTextElementInteractions(element) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            setActiveTextElement(element);
        });

        element.addEventListener('input', (e) => {
            const textObj = textElements.find(t => t.element === element);
            if (textObj) {
                textObj.text = element.textContent;
                frameTextInput.value = element.textContent;
            }
        });

        element.addEventListener('focus', () => {
            element.contentEditable = 'true';
            element.style.cursor = 'text';
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(element);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        });

        element.addEventListener('blur', () => {
            element.style.cursor = 'grab';
        });
    }

    function setActiveTextElement(element) {
        document.querySelectorAll('.text-element').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.sticker-element').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        activeStickerElement = null;
        element.contentEditable = 'true';
        element.focus();

        const textObj = textElements.find(t => t.element === element);
        if (textObj) {
            activeTextElement = textObj;
            frameTextInput.value = element.textContent || '';
            fontSelect.value = textObj.font;
            textColorPicker.value = textObj.color;
            textSizeSlider.value = textObj.size;
            textSizeValue.textContent = textObj.size;
            textRotationSlider.value = textObj.rotation;
            textRotationValue.textContent = textObj.rotation;
        }
    }

    function updateActiveTextElement() {
        if (!activeTextElement) return;

        const element = activeTextElement.element;
        element.textContent = frameTextInput.value || '';
        element.style.fontFamily = `'${fontSelect.value}'`;
        element.style.color = textColorPicker.value;
        element.style.fontSize = `${textSizeSlider.value}px`;
        element.style.transform = `rotate(${textRotationSlider.value}deg)`;

        activeTextElement.text = frameTextInput.value || '';
        activeTextElement.font = fontSelect.value;
        activeTextElement.color = textColorPicker.value;
        activeTextElement.size = parseInt(textSizeSlider.value);
        activeTextElement.rotation = parseInt(textRotationSlider.value);
    }

    function removeActiveTextElement() {
        if (!activeTextElement) {
            alert('Không có chữ nào được chọn để xóa.');
            return;
        }

        const index = textElements.findIndex(t => t === activeTextElement);
        if (index !== -1) {
            activeTextElement.element.remove();
            textElements.splice(index, 1);
            activeTextElement = null;
            hideContextMenu();
        }
    }

    function downloadPhoto() {
        if (photos.length === 0) {
            alert('Vui lòng chụp ảnh trước.');
            return;
        }

        const frameRect = photoboothFrame.getBoundingClientRect();
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = frameRect.width * scale;
        canvas.height = frameRect.height * scale;
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, canvas.width, canvas.height, 8 * scale);
        ctx.clip();
        if (backgroundImage) {
            if (repeatBackground) {
                const imgWidth = backgroundWidth * scale;
                const imgHeight = backgroundHeight * scale;
                for (let x = 0; x < canvas.width; x += imgWidth) {
                    for (let y = 0; y < canvas.height; y += imgHeight) {
                        ctx.drawImage(backgroundImage, x, y, imgWidth, imgHeight);
                    }
                }
            } else {
                ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
            }
        } else {
            ctx.fillStyle = backgroundColorPicker.value;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // Draw photos
        let loadedImages = 0;
        const totalImages = photos.length + stickerElements.length + textElements.length;
        const slots = photoboothFrame.querySelectorAll('.frame-slot');
        slots.forEach((slot, idx) => {
            if (idx >= photos.length || slot.style.display === 'none') return;

            const img = new Image();
            img.src = photos[idx];
            img.onload = () => {
                const slotRect = slot.getBoundingClientRect();
                const x = (slotRect.left - frameRect.left) * scale;
                const y = (slotRect.top - frameRect.top) * scale;
                const w = slotRect.width * scale;
                const h = slotRect.height * scale;

                ctx.save();
                if (showBorders) {
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 8 * scale);
                    ctx.clip();
                }
                ctx.drawImage(img, x, y, w, h);
                ctx.restore();

                if (++loadedImages === totalImages) finalizeDownload();
            };
            img.onerror = () => {
                console.error('Failed to load photo:', photos[idx]);
                if (++loadedImages === totalImages) finalizeDownload();
            };
        });

        // Draw stickers
        stickerElements.forEach(stickerEl => {
            const img = new Image();
            img.src = stickerEl.url;
            img.onload = () => {
                ctx.save();
                const x = stickerEl.x * scale;
                const y = stickerEl.y * scale;
                const width = stickerEl.size * scale;
                const height = (img.height / img.width) * width;
                ctx.translate(x + width / 2, y + height / 2);
                ctx.rotate((stickerEl.rotation * Math.PI) / 180);
                ctx.drawImage(img, -width / 2, -height / 2, width, height);
                ctx.restore();

                if (++loadedImages === totalImages) finalizeDownload();
            };
            img.onerror = () => {
                console.error('Failed to load sticker:', stickerEl.url);
                if (++loadedImages === totalImages) finalizeDownload();
            };
        });

        // Draw text elements
        textElements.forEach(textEl => {
            const style = window.getComputedStyle(textEl.element);
            ctx.save();
            ctx.font = `${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`;
            ctx.fillStyle = style.color;
            ctx.textAlign = 'left';
            const x = parseFloat(textEl.element.style.left) * scale;
            const y = parseFloat(textEl.element.style.top) * scale;
            ctx.translate(x, y);
            ctx.rotate((parseFloat(textEl.element.style.transform.match(/rotate\((.*?)\)/)?.[1] || 0) * Math.PI) / 180);
            ctx.fillText(textEl.element.textContent, 0, 0);
            ctx.restore();

            if (++loadedImages === totalImages) finalizeDownload();
        });

        function finalizeDownload() {
            const link = document.createElement('a');
            link.download = `photobooth-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    }

    function resetFrame() {
        photos = [];
        textElements.forEach(text => text.element.remove());
        stickerElements.forEach(sticker => sticker.element.remove());
        textElements = [];
        stickerElements = [];
        stickerCount = 0;
        activeTextElement = null;
        activeStickerElement = null;
        backgroundImage = null;
        backgroundWidth = 0;
        backgroundHeight = 0;
        repeatBackground = true;
        repeatBackgroundCheckbox.checked = true;
        backgroundImageInput.value = '';
        stickerUpload.value = '';
        isBackgroundActive = false;
        backgroundLayer.classList.remove('active');
        updatePhotoboothFrame();
        hideContextMenu();
    }

    function startInteraction(e) {
        e.preventDefault();
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        const textElement = e.target.closest('.text-element');
        const stickerElement = e.target.closest('.sticker-element');

        if (textElement?.classList.contains('active')) {
            isDragging = true;
            activeTextElement = textElements.find(t => t.element === textElement);
            const frameRect = photoboothFrame.getBoundingClientRect();
            initialX = touch.clientX - (activeTextElement?.x || 0);
            initialY = touch.clientY - (activeTextElement?.y || 0);
            return;
        }

        if (stickerElement?.classList.contains('active')) {
            isDragging = true;
            activeStickerElement = stickerElements.find(s => s.element === stickerElement);
            const frameRect = photoboothFrame.getBoundingClientRect();
            initialX = touch.clientX - (activeStickerElement?.x || 0);
            initialY = touch.clientY - (activeStickerElement?.y || 0);
        }
    }

    function handleInteraction(e) {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.type === 'touchmove' ? e.touches[0] : e;
        const frameRect = photoboothFrame.getBoundingClientRect();

        if (activeTextElement) {
            let newX = touch.clientX - initialX;
            let newY = touch.clientY - initialY;
            newX = Math.max(0, Math.min(newX, frameRect.width - activeTextElement.element.offsetWidth));
            newY = Math.max(0, Math.min(newY, frameRect.height - activeTextElement.element.offsetHeight));

            activeTextElement.element.style.left = `${newX}px`;
            activeTextElement.element.style.top = `${newY}px`;
            activeTextElement.x = newX;
            activeTextElement.y = newY;
        }

        if (activeStickerElement) {
            let newX = touch.clientX - initialX;
            let newY = touch.clientY - initialY;
            newX = Math.max(0, Math.min(newX, frameRect.width - activeStickerElement.element.offsetWidth));
            newY = Math.max(0, Math.min(newY, frameRect.height - activeStickerElement.element.offsetHeight));

            activeStickerElement.element.style.left = `${newX}px`;
            activeStickerElement.element.style.top = `${newY}px`;
            activeStickerElement.x = newX;
            activeStickerElement.y = newY;
            updateActiveStickerElement();
        }
    }

    function stopInteraction() {
        isDragging = false;
    }

    // Initialize Select2 for dropdown
    $(fontSelect).select2({
        width: '100%',
        templateResult: state => !state.id ? state.text : $(`<span style="font-family:${state.text}">${state.text}</span>`),
        templateSelection: state => !state.id ? state.text : $(`<span style="font-family:${state.text}">${state.text}</span>`),
    });
});