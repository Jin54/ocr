/* app.js - Application entry point */

const App = (function () {
  function init() {
    ImageManager.init(onImageSelected);
    RegionSelector.init();
    ExportManager.init();
    initClassSelect();

    document.getElementById('btn-run-ocr').addEventListener('click', runOcrAll);
    document.getElementById('btn-clear-results').addEventListener('click', () => {
      if (confirm('모든 결과를 삭제할까요?')) {
        ResultTable.clear();
      }
    });
  }

  function initClassSelect() {
    const select = document.getElementById('class-select');
    for (const name of SkillData.getClassNames()) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      OcrEngine.setClass(select.value || null);
    });
  }

  function onImageSelected(imgData) {
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
    if (!regions.type && !regions.skill) {
      toast('종류 또는 스킬 영역을 먼저 그려주세요', 'error');
      return;
    }

    setOcrButtonsEnabled(false);
    showProgress(true);

    for (let i = 0; i < allImages.length; i++) {
      const imgData = allImages[i];

      onOcrProgress({
        status: 'batch',
        text: `이미지 ${i + 1}/${allImages.length}: ${imgData.fileName}`,
        progress: i / allImages.length,
      });

      const imgEl = new Image();
      imgEl.src = imgData.dataUrl;
      await new Promise(resolve => {
        imgEl.onload = resolve;
        if (imgEl.complete) resolve();
      });

      const result = await OcrEngine.recognizeRegions(imgEl, regions, onOcrProgress);
      if (result) {
        ResultTable.addResult(imgData.fileName, result);
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

  document.addEventListener('DOMContentLoaded', init);

  return { toast };
})();
