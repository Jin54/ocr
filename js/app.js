/* app.js - Application entry point, event wiring, global state */

const App = (function () {
  function init() {
    // Initialize modules
    ImageManager.init(onImageSelected);
    RegionSelector.init();
    ExportManager.init();
    TemplateManager.init();

    // OCR buttons
    document.getElementById('btn-run-ocr').addEventListener('click', runOcrAll);
    document.getElementById('btn-clear-results').addEventListener('click', () => {
      if (confirm('모든 결과를 삭제할까요?')) {
        ResultTable.clear();
      }
    });
  }

  function onImageSelected(imgData) {
    // Wait for the image to render, then sync canvas
    requestAnimationFrame(() => {
      RegionSelector.onImageChange();
    });
  }

  async function runOcrAll() {
    const allImages = ImageManager.getAll();
    if (allImages.length === 0) {
      toast('이미지를 먼저 업로드해주세요', 'error');
      return;
    }

    const regions = RegionSelector.getRegions();
    if (regions.length === 0) {
      toast('대표 이미지에서 OCR 영역을 먼저 그려주세요', 'error');
      return;
    }

    setOcrButtonsEnabled(false);
    showProgress(true);

    // 별도의 img 엘리먼트를 사용하여 각 이미지를 로드
    for (let i = 0; i < allImages.length; i++) {
      const imgData = allImages[i];

      onOcrProgress({
        status: 'batch',
        text: `이미지 ${i + 1}/${allImages.length}: ${imgData.fileName}`,
        progress: i / allImages.length,
      });

      // 새 이미지 엘리먼트를 만들어서 로드
      const imgEl = new Image();
      imgEl.src = imgData.dataUrl;
      await new Promise(resolve => {
        imgEl.onload = resolve;
        if (imgEl.complete) resolve();
      });

      const results = await OcrEngine.recognizeImage(imgEl, regions, onOcrProgress);
      if (results) {
        ResultTable.addResults(imgData.fileName, results);
      }
    }

    toast('전체 OCR 완료: ' + allImages.length + '개 이미지', 'success');
    setOcrButtonsEnabled(true);
    setTimeout(() => showProgress(false), 1500);
  }

  function onOcrProgress(info) {
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    fill.style.width = Math.round((info.progress || 0) * 100) + '%';
    text.textContent = info.text || '';
  }

  function showProgress(show) {
    document.getElementById('progress-container').classList.toggle('hidden', !show);
    if (!show) {
      document.getElementById('progress-fill').style.width = '0%';
      document.getElementById('progress-text').textContent = '';
    }
  }

  function setOcrButtonsEnabled(enabled) {
    document.getElementById('btn-run-ocr').disabled = !enabled;
  }

  function toast(message, type) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = 'toast' + (type ? ' ' + type : '');
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  return { toast };
})();
