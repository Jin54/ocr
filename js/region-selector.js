/* region-selector.js - Canvas overlay for drawing OCR regions */

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
  ];

  let canvas, ctx, imgEl;

  function init() {
    canvas = document.getElementById('region-canvas');
    ctx = canvas.getContext('2d');
    imgEl = document.getElementById('workspace-image');

    document.getElementById('btn-draw-mode').addEventListener('click', toggleDrawMode);
    document.getElementById('btn-clear-regions').addEventListener('click', clearAll);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    const ro = new ResizeObserver(() => syncCanvasSize());
    ro.observe(imgEl);
  }

  function syncCanvasSize() {
    if (!imgEl.naturalWidth) return;

    const rect = imgEl.getBoundingClientRect();
    const parentRect = imgEl.parentElement.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;
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
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseDown(e) { if (!isDrawMode) return; startDraw(getCanvasCoords(e)); }
  function onMouseMove(e) { if (!isDrawing) return; continueDraw(getCanvasCoords(e)); }
  function onMouseUp() { if (!isDrawing) return; endDraw(); }

  function onTouchStart(e) { if (!isDrawMode) return; e.preventDefault(); startDraw(getCanvasCoords(e.touches[0])); }
  function onTouchMove(e) { if (!isDrawing) return; e.preventDefault(); continueDraw(getCanvasCoords(e.touches[0])); }
  function onTouchEnd() { if (!isDrawing) return; endDraw(); }

  function startDraw(coords) {
    isDrawing = true;
    startX = coords.x; startY = coords.y;
    currentX = coords.x; currentY = coords.y;
  }

  function continueDraw(coords) {
    currentX = coords.x; currentY = coords.y;
    redraw();
    const rx = Math.min(startX, currentX), ry = Math.min(startY, currentY);
    const rw = Math.abs(currentX - startX), rh = Math.abs(currentY - startY);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(rx, ry, rw, rh);
  }

  function endDraw() {
    isDrawing = false;
    const rw = Math.abs(currentX - startX), rh = Math.abs(currentY - startY);
    if (rw < 10 || rh < 10) { redraw(); return; }

    const rx = Math.min(startX, currentX), ry = Math.min(startY, currentY);
    regionCounter++;
    regions.push({
      id: 'r_' + Date.now(),
      label: '영역 ' + regionCounter,
      nx: rx / canvas.width, ny: ry / canvas.height,
      nw: rw / canvas.width, nh: rh / canvas.height,
      color: COLORS[(regions.length - 1) % COLORS.length],
    });
    redraw();
    renderRegionList();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    regions.forEach((r) => {
      const x = r.nx * canvas.width, y = r.ny * canvas.height;
      const w = r.nw * canvas.width, h = r.nh * canvas.height;
      ctx.fillStyle = r.color + '22'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      const label = r.label;
      ctx.font = '12px sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = r.color + 'cc'; ctx.fillRect(x, y - 18, tw + 8, 18);
      ctx.fillStyle = '#000'; ctx.fillText(label, x + 4, y - 5);
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
        <span class="region-delete" data-idx="${i}">&times;</span>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('.region-label-input').forEach(input => {
      input.addEventListener('change', (e) => {
        regions[parseInt(e.target.dataset.idx)].label = e.target.value;
        redraw();
      });
    });
    list.querySelectorAll('.region-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        regions.splice(parseInt(e.target.dataset.idx), 1);
        redraw(); renderRegionList();
      });
    });
  }

  function clearAll() {
    regions = []; regionCounter = 0;
    redraw(); renderRegionList();
  }

  function getRegions() { return regions; }

  function setRegions(newRegions) {
    regions = newRegions.map((r, i) => ({ ...r, color: r.color || COLORS[i % COLORS.length] }));
    regionCounter = regions.length;
    redraw(); renderRegionList();
  }

  function onImageChange() { syncCanvasSize(); }

  return { init, getRegions, setRegions, clearAll, onImageChange, syncCanvasSize };
})();
