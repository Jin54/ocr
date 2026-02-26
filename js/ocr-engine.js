/* ocr-engine.js - Tesseract.js worker lifecycle, recognition, preprocessing */

const OcrEngine = (function () {
  let worker = null;
  let isInitialized = false;
  let isProcessing = false;

  async function initWorker(onProgress) {
    if (worker && isInitialized) return;

    onProgress && onProgress({ status: 'loading', text: 'OCR 엔진 로딩 중...' });

    worker = await Tesseract.createWorker(['kor', 'eng'], 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress && onProgress({
            status: 'recognizing',
            progress: m.progress,
            text: 'OCR 인식 중... ' + Math.round(m.progress * 100) + '%',
          });
        } else {
          onProgress && onProgress({
            status: m.status,
            progress: m.progress,
            text: m.status + '...',
          });
        }
      },
    });

    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });

    isInitialized = true;
    onProgress && onProgress({ status: 'ready', text: 'OCR 엔진 준비 완료' });
  }

  function preprocessRegion(imageEl, region) {
    const nw = imageEl.naturalWidth;
    const nh = imageEl.naturalHeight;

    const left = Math.round(region.nx * nw);
    const top = Math.round(region.ny * nh);
    const width = Math.round(region.nw * nw);
    const height = Math.round(region.nh * nh);

    const canvas = document.createElement('canvas');
    const scale = Math.max(1, Math.ceil(300 / height));
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageEl, left, top, width, height, 0, 0, canvas.width, canvas.height);

    // Grayscale + contrast boost
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30);
      data[i] = data[i + 1] = data[i + 2] = enhanced;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  async function recognizeImage(imageEl, regions, onProgress) {
    if (isProcessing) {
      App.toast('이미 OCR이 진행 중입니다', 'error');
      return null;
    }

    if (regions.length === 0) {
      App.toast('OCR 영역을 먼저 그려주세요', 'error');
      return null;
    }

    isProcessing = true;

    try {
      await initWorker(onProgress);

      const results = [];

      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];

        onProgress && onProgress({
          status: 'processing',
          text: `영역 "${region.label}" 인식 중 (${i + 1}/${regions.length})`,
          progress: i / regions.length,
        });

        // Set PSM per region
        const psmValue = parseInt(region.psm) || 6;
        await worker.setParameters({
          tessedit_pageseg_mode: String(psmValue),
        });

        const preprocessed = preprocessRegion(imageEl, region);

        try {
          const { data } = await worker.recognize(preprocessed);
          results.push({
            regionId: region.id,
            regionLabel: region.label,
            text: data.text.trim(),
          });
        } catch (err) {
          console.error('OCR error for region:', region.label, err);
          results.push({
            regionId: region.id,
            regionLabel: region.label,
            text: '[인식 실패]',
          });
        }
      }

      onProgress && onProgress({
        status: 'done',
        text: '완료',
        progress: 1,
      });

      return results;
    } catch (err) {
      console.error('OCR engine error:', err);
      App.toast('OCR 오류: ' + err.message, 'error');
      return null;
    } finally {
      isProcessing = false;
    }
  }

  function getIsProcessing() {
    return isProcessing;
  }

  return { recognizeImage, getIsProcessing };
})();
