/* image-manager.js - Image upload, drag-and-drop, crop ratio control */

const ImageManager = (function () {
  let images = [];
  let selectedId = null;
  let onSelectCallback = null;
  let cropRight = 0.33;  // 오른쪽 크롭 비율
  let cropBottom = 0;    // 아래쪽 크롭 비율

  const uploadZone = () => document.getElementById('upload-zone');
  const fileInput = () => document.getElementById('file-input');
  const thumbSection = () => document.getElementById('thumbnail-section');
  const thumbStrip = () => document.getElementById('thumbnail-strip');
  const workspaceSection = () => document.getElementById('workspace-section');
  const workspaceImage = () => document.getElementById('workspace-image');

  function init(onSelect) {
    onSelectCallback = onSelect;

    const zone = uploadZone();
    const input = fileInput();

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    input.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    });

    // 오른쪽 크롭 슬라이더
    const rightSlider = document.getElementById('crop-ratio');
    const rightLabel = document.getElementById('crop-ratio-value');
    if (rightSlider) {
      rightSlider.value = Math.round(cropRight * 100);
      rightLabel.textContent = Math.round(cropRight * 100) + '%';
      rightSlider.addEventListener('input', (e) => {
        cropRight = parseInt(e.target.value) / 100;
        rightLabel.textContent = e.target.value + '%';
        updateSelectedPreview();
      });
    }

    // 아래쪽 크롭 슬라이더
    const bottomSlider = document.getElementById('crop-bottom');
    const bottomLabel = document.getElementById('crop-bottom-value');
    if (bottomSlider) {
      bottomSlider.value = Math.round(cropBottom * 100);
      bottomLabel.textContent = Math.round(cropBottom * 100) + '%';
      bottomSlider.addEventListener('input', (e) => {
        cropBottom = parseInt(e.target.value) / 100;
        bottomLabel.textContent = e.target.value + '%';
        updateSelectedPreview();
      });
    }
  }

  // 오른쪽 + 아래쪽 크롭 (canvas 반환)
  function cropImage(img) {
    const canvas = document.createElement('canvas');
    const cropX = Math.round(img.naturalWidth * (1 - cropRight));
    const cropW = img.naturalWidth - cropX;
    const cropH = Math.round(img.naturalHeight * (1 - cropBottom));
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, cropX, 0, cropW, cropH, 0, 0, cropW, cropH);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.95),
      naturalWidth: cropW,
      naturalHeight: cropH,
    };
  }

  // 선택된 이미지만 크롭 미리보기 갱신
  function updateSelectedPreview() {
    if (!selectedId) return;
    const imgData = images.find(i => i.id === selectedId);
    if (!imgData) return;

    const img = new Image();
    img.onload = () => {
      const cropped = cropImage(img);
      workspaceImage().src = cropped.dataUrl;
    };
    img.src = imgData.originalDataUrl;
  }

  // OCR 시점에 크롭된 이미지 생성
  function getCroppedImage(imgData) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cropped = cropImage(img);
        const croppedImg = new Image();
        croppedImg.onload = () => resolve(croppedImg);
        croppedImg.src = cropped.dataUrl;
      };
      img.src = imgData.originalDataUrl;
    });
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          images.push({
            id,
            fileName: file.name,
            originalDataUrl: e.target.result,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight,
          });
          loaded++;
          if (loaded === files.length) {
            if (!selectedId) {
              selectImage(images[images.length - files.length].id);
            } else {
              renderThumbnails();
            }
          }
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        loaded++;
        App.toast('이미지 로드 실패: ' + file.name, 'error');
      };
      reader.readAsDataURL(file);
    });
  }

  function renderThumbnails() {
    const strip = thumbStrip();
    strip.innerHTML = '';

    images.forEach(img => {
      const div = document.createElement('div');
      div.className = 'thumbnail' + (img.id === selectedId ? ' active' : '');
      div.innerHTML = `
        <img src="${img.originalDataUrl}" alt="${img.fileName}">
        <span class="thumb-remove" data-id="${img.id}">&times;</span>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('thumb-remove')) {
          removeImage(e.target.dataset.id);
          return;
        }
        selectImage(img.id);
      });
      strip.appendChild(div);
    });

    thumbSection().classList.toggle('hidden', images.length === 0);
  }

  function selectImage(id) {
    const img = images.find(i => i.id === id);
    if (!img) return;

    selectedId = id;
    workspaceSection().classList.remove('hidden');
    document.getElementById('ocr-section').classList.remove('hidden');
    renderThumbnails();

    // 선택 시 크롭 미리보기 표시
    const tempImg = new Image();
    tempImg.onload = () => {
      const cropped = cropImage(tempImg);
      const wsImg = workspaceImage();
      wsImg.src = cropped.dataUrl;
      if (onSelectCallback) {
        wsImg.onload = () => onSelectCallback(img);
      }
    };
    tempImg.src = img.originalDataUrl;
  }

  function removeImage(id) {
    images = images.filter(i => i.id !== id);
    if (selectedId === id) {
      selectedId = null;
      if (images.length > 0) {
        selectImage(images[0].id);
      } else {
        workspaceSection().classList.add('hidden');
        document.getElementById('ocr-section').classList.add('hidden');
      }
    }
    renderThumbnails();
  }

  function getSelected() {
    return images.find(i => i.id === selectedId) || null;
  }

  function getAll() {
    return images;
  }

  return { init, getSelected, getAll, selectImage, getCroppedImage };
})();
