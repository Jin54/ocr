/* region-selector.js - 두 가지 고정 영역: 종류(빨강) + 스킬(파랑) */

const RegionSelector = (function () {
  const REGION_TYPES = {
    type: { label: '종류 영역', color: '#ef5350' },   // 빨간색
    skill: { label: '스킬 영역', color: '#42a5f5' },  // 파란색
  };

  let regions = { type: null, skill: null };
  let drawingTarget = null; // 'type' | 'skill'
  let isDrawing = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;

  let canvas, ctx, imgEl;

  function init() {
    canvas = document.getElementById('region-canvas');
    ctx = canvas.getContext('2d');
    imgEl = document.getElementById('workspace-image');

    document.getElementById('btn-draw-type').addEventListener('click', () => startDrawMode('type'));
    document.getElementById('btn-draw-skill').addEventListener('click', () => startDrawMode('skill'));
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

  function startDrawMode(target) {
    drawingTarget = target;
    canvas.classList.add('draw-mode');
    updateButtons();
  }

  function stopDrawMode() {
    drawingTarget = null;
    isDrawing = false;
    canvas.classList.remove('draw-mode');
    updateButtons();
  }

  function updateButtons() {
    const btnType = document.getElementById('btn-draw-type');
    const btnSkill = document.getElementById('btn-draw-skill');
    btnType.classList.toggle('active', drawingTarget === 'type');
    btnSkill.classList.toggle('active', drawingTarget === 'skill');
    btnType.textContent = drawingTarget === 'type' ? '그리는 중...' : (regions.type ? '종류 영역 ✓' : '종류 영역');
    btnSkill.textContent = drawingTarget === 'skill' ? '그리는 중...' : (regions.skill ? '스킬 영역 ✓' : '스킬 영역');
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseDown(e) { if (!drawingTarget) return; startDraw(getCanvasCoords(e)); }
  function onMouseMove(e) { if (!isDrawing) return; continueDraw(getCanvasCoords(e)); }
  function onMouseUp() { if (!isDrawing) return; endDraw(); }

  function onTouchStart(e) { if (!drawingTarget) return; e.preventDefault(); startDraw(getCanvasCoords(e.touches[0])); }
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
    // 드래그 중인 영역 미리보기
    const rx = Math.min(startX, currentX), ry = Math.min(startY, currentY);
    const rw = Math.abs(currentX - startX), rh = Math.abs(currentY - startY);
    const color = REGION_TYPES[drawingTarget].color;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
    ctx.fillStyle = color + '22'; ctx.fillRect(rx, ry, rw, rh);
  }

  function endDraw() {
    isDrawing = false;
    const rw = Math.abs(currentX - startX), rh = Math.abs(currentY - startY);
    if (rw < 10 || rh < 10) { redraw(); stopDrawMode(); return; }

    const rx = Math.min(startX, currentX), ry = Math.min(startY, currentY);
    regions[drawingTarget] = {
      nx: rx / canvas.width, ny: ry / canvas.height,
      nw: rw / canvas.width, nh: rh / canvas.height,
    };
    stopDrawMode();
    redraw();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const [key, region] of Object.entries(regions)) {
      if (!region) continue;
      const info = REGION_TYPES[key];
      const x = region.nx * canvas.width, y = region.ny * canvas.height;
      const w = region.nw * canvas.width, h = region.nh * canvas.height;
      ctx.fillStyle = info.color + '22'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = info.color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      // 라벨
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(info.label).width;
      ctx.fillStyle = info.color + 'cc'; ctx.fillRect(x, y - 18, tw + 8, 18);
      ctx.fillStyle = '#fff'; ctx.fillText(info.label, x + 4, y - 5);
    }
  }

  function clearAll() {
    regions = { type: null, skill: null };
    stopDrawMode();
    redraw();
  }

  function getRegions() { return regions; }

  function onImageChange() { syncCanvasSize(); }

  return { init, getRegions, clearAll, onImageChange, syncCanvasSize };
})();
