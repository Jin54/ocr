/* image-manager.js - Image upload, drag-and-drop, thumbnail gallery */

const ImageManager = (function () {
  let images = [];
  let selectedId = null;
  let onSelectCallback = null;

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
            dataUrl: e.target.result,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });
          loaded++;
          if (loaded === files.length) {
            renderThumbnails();
            if (!selectedId) {
              selectImage(images[images.length - files.length].id);
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

  function getImageElement() {
    return workspaceImage();
  }

  return { init, getSelected, getAll, getImageElement, selectImage };
})();
