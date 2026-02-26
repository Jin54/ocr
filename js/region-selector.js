/* region-selector.js - Canvas overlay for drawing/editing/deleting OCR regions */

const RegionSelector = (function () {
  let regions = [];
  let isDrawMode = false;
  let isDrawing = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;
  let regionCounter = 0;

  const COLORS = [
    '#4fc3f7', '#81c784', '#ffb74d', '#f06292',
    '#ba68c8', '#4dd0e1', '#aed581', '#ff8a65',
    '#9575cd', '#e57373',
  ];

  let canvas, ctx, imgEl;

  function init() {
    canvas = document.getElementById('region-canvas');
    ctx = canvas.getContext('2d');
    imgEl = document.getElementById('workspace-image');

    // Draw mode button
    document.getElementById('btn-draw-mode').addEventListener('click', toggleDrawMode);
    document.getElementById('btn-clear-regions').addEventListener('click', clearAll);

    // Mouse events
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    // Touch events
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    // Resize observer
    const ro = new ResizeObserver(() => syncCanvasSize());
    ro.observe(imgEl);
  }

  function syncCanvasSize() {
    if (!imgEl.naturalWidth) return;

    const rect = imgEl.getBoundingClientRect();
    const parentRect = imgEl.parentElement.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Position canvas exactly over the image
    canvas.style.left = (rect.left - parentRect.left) + 'px';
    canvas.style.top = (rect.top - parentRect.top) + 'px';
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    redraw();
  }

  function toggleDrawMode() {
    isDrawMode = !isDrawMode;
    canvas.classList.toggle('draw-mode', isDrawMode);
    const btn = document.getElementById('btn-draw-mode');
    btn.textContent = isDrawMode ? '그리기 중지' : '영역 그리기';
    btn.classList.toggle('active', isDrawMode);
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // --- Mouse handlers ---
  function onMouseDown(e) {
    if (!isDrawMode) return;
    const coords = getCanvasCoords(e);
    startDraw(coords.x, coords.y);
  }

  function onMouseMove(e) {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    continueDraw(coords.x, coords.y);
  }

  function onMouseUp(e) {
    if (!isDrawing) return;
    endDraw();
  }

  // --- Touch handlers ---
  function onTouchStart(e) {
    if (!isDrawMode) return;
    e.preventDefault();
    const touch = e.touches[0];
    const coords = getCanvasCoords(touch);
    startDraw(coords.x, coords.y);
  }

  function onTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const coords = getCanvasCoords(touch);
    continueDraw(coords.x, coords.y);
  }

  function onTouchEnd(e) {
    if (!isDrawing) return;
    endDraw();
  }

  // --- Drawing logic ---
  function startDraw(x, y) {
    isDrawing = true;
    startX = x;
    startY = y;
    currentX = x;
    currentY = y;
  }

  function continueDraw(x, y) {
    currentX = x;
    currentY = y;
    redraw();

    // Draw rubber-band rectangle
    const rx = Math.min(startX, currentX);
    const ry = Math.min(startY, currentY);
    const rw = Math.abs(currentX - startX);
    const rh = Math.abs(currentY - startY);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(rx, ry, rw, rh);
  }

  function endDraw() {
    isDrawing = false;

    const rw = Math.abs(currentX - startX);
    const rh = Math.abs(currentY - startY);

    // Minimum size check (at least 10px)
    if (rw < 10 || rh < 10) {
      redraw();
      return;
    }

    const rx = Math.min(startX, currentX);
    const ry = Math.min(startY, currentY);

    // Convert to normalized coordinates
    const nx = rx / canvas.width;
    const ny = ry / canvas.height;
    const nw = rw / canvas.width;
    const nh = rh / canvas.height;

    regionCounter++;
    const region = {
      id: 'r_' + Date.now() + '_' + regionCounter,
      label: '영역 ' + regionCounter,
      nx, ny, nw, nh,
      psm: '6', // SINGLE_BLOCK default
      color: COLORS[(regions.length) % COLORS.length],
    };

    regions.push(region);
    redraw();
    renderRegionList();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    regions.forEach((r, i) => {
      const x = r.nx * canvas.width;
      const y = r.ny * canvas.height;
      const w = r.nw * canvas.width;
      const h = r.nh * canvas.height;

      // Fill
      ctx.fillStyle = r.color + '22';
      ctx.fillRect(x, y, w, h);

      // Border
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Label background
      const label = r.label || '영역 ' + (i + 1);
      ctx.font = '12px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const labelH = 18;
      ctx.fillStyle = r.color + 'cc';
      ctx.fillRect(x, y - labelH, textWidth + 8, labelH);

      // Label text
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 4, y - 5);
    });
  }

  function renderRegionList() {
    const list = document.getElementById('region-list');
    list.innerHTML = '';

    regions.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'region-item';
      div.innerHTML = `
        <span class="region-color" style="background:${r.color}"></span>
        <input type="text" value="${r.label}" data-idx="${i}" class="region-label-input">
        <select data-idx="${i}" class="region-psm-select" title="OCR 모드">
          <option value="6" ${r.psm === '6' ? 'selected' : ''}>블록</option>
          <option value="7" ${r.psm === '7' ? 'selected' : ''}>한 줄</option>
          <option value="8" ${r.psm === '8' ? 'selected' : ''}>단어</option>
          <option value="11" ${r.psm === '11' ? 'selected' : ''}>분산</option>
        </select>
        <span class="region-delete" data-idx="${i}">&times;</span>
      `;
      list.appendChild(div);
    });

    // Event delegation
    list.querySelectorAll('.region-label-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        regions[idx].label = e.target.value;
        redraw();
      });
    });

    list.querySelectorAll('.region-psm-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        regions[idx].psm = e.target.value;
      });
    });

    list.querySelectorAll('.region-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        regions.splice(idx, 1);
        redraw();
        renderRegionList();
      });
    });
  }

  function clearAll() {
    regions = [];
    regionCounter = 0;
    redraw();
    renderRegionList();
  }

  function getRegions() {
    return regions;
  }

  function setRegions(newRegions) {
    regions = newRegions.map((r, i) => ({
      ...r,
      color: r.color || COLORS[i % COLORS.length],
      psm: r.psm || '6',
    }));
    regionCounter = regions.length;
    redraw();
    renderRegionList();
  }

  function onImageChange() {
    syncCanvasSize();
  }

  return { init, getRegions, setRegions, clearAll, onImageChange, syncCanvasSize };
})();
