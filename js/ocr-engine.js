/* ocr-engine.js - Tesseract.js worker, auto-parse skill/level from game screenshot */

const OcrEngine = (function () {
  let worker = null;
  let isInitialized = false;
  let isProcessing = false;

  async function initWorker(onProgress) {
    if (worker && isInitialized) return;

    onProgress && onProgress({ status: 'loading', text: 'OCR 엔진 로딩 중 (최초 1회)...', progress: 0 });

    worker = await Tesseract.createWorker(['kor', 'eng'], 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress && onProgress({
            status: 'recognizing',
            progress: m.progress,
            text: 'OCR 인식 중... ' + Math.round(m.progress * 100) + '%',
          });
        } else if (m.progress !== undefined) {
          onProgress && onProgress({
            status: m.status,
            progress: m.progress,
            text: m.status + '... ' + Math.round((m.progress || 0) * 100) + '%',
          });
        }
      },
    });

    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
      tessedit_pageseg_mode: '6', // SINGLE_BLOCK
    });

    isInitialized = true;
    onProgress && onProgress({ status: 'ready', text: 'OCR 엔진 준비 완료', progress: 1 });
  }

  // 장착 효과 영역을 크롭하여 전처리
  function preprocessImage(imageEl) {
    const nw = imageEl.naturalWidth;
    const nh = imageEl.naturalHeight;

    // 장착 효과 영역 (이미지 고정 레이아웃 기준)
    // "장착 효과" 텍스트 아래 ~ "세트 효과" 텍스트 위 영역
    // 샘플 기준: 대략 y 37%~72%, x 5%~95%
    const cropX = Math.round(nw * 0.05);
    const cropY = Math.round(nh * 0.37);
    const cropW = Math.round(nw * 0.90);
    const cropH = Math.round(nh * 0.35);

    const canvas = document.createElement('canvas');
    const scale = Math.max(1, Math.ceil(400 / cropH));
    canvas.width = cropW * scale;
    canvas.height = cropH * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageEl, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    // Grayscale + contrast boost
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = gray < 128 ? Math.max(0, gray - 40) : Math.min(255, gray + 40);
      data[i] = data[i + 1] = data[i + 2] = enhanced;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  // OCR 결과에서 스킬명 + 레벨 파싱
  function parseSkills(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const skills = [];

    for (const line of lines) {
      // "격파쇄 Lv +2" 또는 "충격 적중 Lv +3" 패턴 매칭
      // Lv, LV, lv, Iv(OCR 오인식) 모두 허용, +/- 부호와 숫자
      const match = line.match(/^(.+?)\s*(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)/);
      if (match) {
        const name = match[1].replace(/^[■□▣●◆◇☆★\[\]【】\s]+/, '').trim();
        const level = '+' + match[2];
        if (name) {
          skills.push({ name, level });
        }
        continue;
      }

      // "격파쇄 +2" 패턴 (Lv 없이 바로 +숫자)
      const match2 = line.match(/^(.+?)\s+\+(\d+)\s*$/);
      if (match2) {
        const name = match2[1].replace(/^[■□▣●◆◇☆★\[\]【】\s]+/, '').trim();
        const level = '+' + match2[2];
        // 시간[시엘] 같은 건 제외
        if (name && !name.includes('시간') && !name.includes('시엘')) {
          skills.push({ name, level });
        }
      }
    }

    return skills;
  }

  async function recognizeImage(imageEl, onProgress) {
    if (isProcessing) {
      App.toast('이미 OCR이 진행 중입니다', 'error');
      return null;
    }

    isProcessing = true;

    try {
      await initWorker(onProgress);

      const preprocessed = preprocessImage(imageEl);
      const { data } = await worker.recognize(preprocessed);
      const rawText = data.text.trim();

      console.log('OCR raw text:', rawText);

      const skills = parseSkills(rawText);

      onProgress && onProgress({ status: 'done', text: '완료', progress: 1 });

      return skills;
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

  return { recognizeImage, getIsProcessing, parseSkills };
})();
