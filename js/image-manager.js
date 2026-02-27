/* image-manager.js - Image upload, drag-and-drop, crop ratio control */

const ImageManager = (function () {
  let images = []; // { id, fileName, originalDataUrl, originalWidth, originalHeight, dataUrl, naturalWidth, naturalHeight }
  let selectedId = null;
  let onSelectCallback = null;
  let cropRatio = 0.33; // 오른쪽에서 크롭할 비율 (기본 33%)

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

    // 크롭 비율 슬라이더
    const slider = document.getElementById('crop-ratio');
    const label = document.getElementById('crop-ratio-value');
    if (slider) {
      slider.value = Math.round(cropRatio * 100);
      label.textContent = Math.round(cropRatio * 100) + '%';
      slider.addEventListener('input', (e) => {
        cropRatio = parseInt(e.target.value) / 100;
        label.textContent = e.target.value + '%';
        recropAll();
      });
    }
  }

  // 이미지의 오른쪽 N%를 크롭
  function cropRight(img, ratio) {
    const canvas = document.createElement('canvas');
    const cropX = Math.round(img.naturalWidth * (1 - ratio));
    const cropW = img.naturalWidth - cropX;
    canvas.width = cropW;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, cropX, 0, cropW, img.naturalHeight, 0, 0, cropW, img.naturalHeight);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.95),
      naturalWidth: cropW,
      naturalHeight: img.naturalHeight,
    };
  }

  // 원본 이미지로부터 크롭 (Image 객체 사용)
  function cropFromOriginal(imgData) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cropped = cropRight(img, cropRatio);
        imgData.dataUrl = cropped.dataUrl;
        imgData.naturalWidth = cropped.naturalWidth;
        imgData.naturalHeight = cropped.naturalHeight;
        resolve();
      };
      img.src = imgData.originalDataUrl;
    });
  }

  // 비율 변경 시 전체 이미지 재크롭
  async function recropAll() {
    for (const imgData of images) {
      await cropFromOriginal(imgData);
    }
    renderThumbnails();
    if (selectedId) {
      const img = images.find(i => i.id === selectedId);
      if (img) {
        const wsImg = workspaceImage();
        wsImg.src = img.dataUrl;
      }
    }
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
          const cropped = cropRight(img, cropRatio);
          images.push({
            id,
            fileName: file.name,
            originalDataUrl: e.target.result,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight,
            dataUrl: cropped.dataUrl,
            naturalWidth: cropped.naturalWidth,
            naturalHeight: cropped.naturalHeight,
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
        <img src="${img.dataUrl}" alt="${img.fileName}">
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
    const wsImg = workspaceImage();
    wsImg.src = img.dataUrl;
    workspaceSection().classList.remove('hidden');
    document.getElementById('ocr-section').classList.remove('hidden');
    renderThumbnails();

    if (onSelectCallback) {
      wsImg.onload = () => onSelectCallback(img);
    }
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

  return { init, getSelected, getAll, selectImage };
})();
