/* ocr-engine.js - Tesseract.js worker, region-based OCR with clean output */

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
      tessedit_pageseg_mode: '7', // SINGLE_LINE - 한 줄씩 인식
    });

    isInitialized = true;
  }

  // 영역을 크롭하고 전처리 (왼쪽 아이콘 영역 제거)
  function preprocessRegion(imageEl, region) {
    const nw = imageEl.naturalWidth;
    const nh = imageEl.naturalHeight;

    let left = Math.round(region.nx * nw);
    const top = Math.round(region.ny * nh);
    let width = Math.round(region.nw * nw);
    const height = Math.round(region.nh * nh);

    // 왼쪽 아이콘 영역 제거 (줄 높이의 약 1.2배만큼 왼쪽을 잘라냄)
    // 각 줄의 높이를 추정하여 아이콘 크기를 계산
    const lineHeight = Math.min(height, 30); // 한 줄 기준 아이콘 크기 추정
    const iconCut = Math.round(lineHeight * 1.2);
    left += iconCut;
    width -= iconCut;
    if (width < 10) width = Math.round(region.nw * nw); // 너무 작으면 원본 유지

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
      const enhanced = gray < 128 ? Math.max(0, gray - 40) : Math.min(255, gray + 40);
      data[i] = data[i + 1] = data[i + 2] = enhanced;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  // 스킬명에서 특수문자 제거 (한글, 영문, 숫자, 공백, +, - 만 허용)
  function cleanText(text) {
    return text
      .replace(/[^가-힣a-zA-Z0-9\s+\-\.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // OCR 결과에서 스킬명 + 레벨 파싱
  function parseSkillLine(text) {
    const cleaned = cleanText(text);
    if (!cleaned) return null;

    // "격파쇄 Lv +2" 또는 "충격 적중 Lv +3" 패턴
    let match = cleaned.match(/^(.+?)\s*(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)/);
    if (match) {
      return { name: match[1].trim(), level: '+' + match[2] };
    }

    // "격파쇄 +2" 패턴 (Lv 없이)
    match = cleaned.match(/^(.+?)\s+\+(\d+)\s*$/);
    if (match) {
      return { name: match[1].trim(), level: '+' + match[2] };
    }

    // 매칭 안되면 전체 텍스트를 이름으로
    return { name: cleaned, level: '' };
  }

  async function recognizeRegions(imageEl, regions, onProgress) {
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

        const preprocessed = preprocessRegion(imageEl, region);

        try {
          const { data } = await worker.recognize(preprocessed);
          const rawText = data.text.trim();
          console.log(`OCR [${region.label}]:`, rawText);

          // 여러 줄이 나올 수 있으므로 줄별로 파싱
          const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          const skills = [];
          for (const line of lines) {
            const parsed = parseSkillLine(line);
            if (parsed && parsed.name) {
              skills.push(parsed);
            }
          }

          results.push({
            regionLabel: region.label,
            skills: skills,
            rawText: rawText,
          });
        } catch (err) {
          console.error('OCR error for region:', region.label, err);
          results.push({
            regionLabel: region.label,
            skills: [],
            rawText: '[인식 실패]',
          });
        }
      }

      onProgress && onProgress({ status: 'done', text: '완료', progress: 1 });
      return results;
    } catch (err) {
      console.error('OCR engine error:', err);
      App.toast('OCR 오류: ' + err.message, 'error');
      return null;
    } finally {
      isProcessing = false;
    }
  }

  return { recognizeRegions, cleanText, parseSkillLine };
})();
