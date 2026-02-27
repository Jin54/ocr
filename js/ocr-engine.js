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
      tessedit_pageseg_mode: '6', // SINGLE_BLOCK - 여러 줄 텍스트 블록
    });

    isInitialized = true;
  }

  // 영역을 크롭하고 색상 기반 전처리
  // 텍스트 색상(파랑/초록/흰색)만 남기고 아이콘+배경 제거
  function preprocessRegion(imageEl, region) {
    const nw = imageEl.naturalWidth;
    const nh = imageEl.naturalHeight;

    const left = Math.round(region.nx * nw);
    const top = Math.round(region.ny * nh);
    const width = Math.round(region.nw * nw);
    const height = Math.round(region.nh * nh);

    const canvas = document.createElement('canvas');
    const scale = Math.max(1, Math.ceil(400 / height));
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageEl, left, top, width, height, 0, 0, canvas.width, canvas.height);

    // 색상 기반 필터링: 텍스트(파랑/초록/흰색)만 검정으로, 나머지 흰색으로
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      let isText = false;

      // 흰색/밝은 텍스트 (Lv +2 등): 밝기 높고 채도 낮음
      if (brightness > 160) {
        isText = true;
      }

      // 파랑/초록/시안 계열 텍스트 (스킬명): 채도가 있고 어느정도 밝음
      if (brightness > 60) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 0 ? (max - min) / max : 0;
        // 채도가 있고 파랑 또는 초록이 우세
        if (saturation > 0.2 && (b > r || g > r)) {
          isText = true;
        }
      }

      // 텍스트 → 검정, 배경/아이콘 → 흰색 (Tesseract는 흰 배경+검정 텍스트가 최적)
      if (isText) {
        data[i] = data[i + 1] = data[i + 2] = 0; // 검정
      } else {
        data[i] = data[i + 1] = data[i + 2] = 255; // 흰색
      }
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  // 스킬명 정리: 한글과 공백만 남김 (스킬명은 한글만 존재)
  function cleanSkillName(text) {
    return text
      .replace(/[^가-힣\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 선택된 직업
  let selectedClass = null;

  function setClass(className) {
    selectedClass = className || null;
  }

  // OCR 결과 한 줄에서 스킬명 + 레벨 파싱
  function parseSkillLine(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // "격파쇄 Lv +2" 패턴
    let match = trimmed.match(/([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s*(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)/);
    if (match) {
      const name = cleanSkillName(match[1]);
      if (name) {
        const matched = SkillData.matchSkill(name, selectedClass);
        return { name: matched || name, level: '+' + match[2] };
      }
    }

    // "격파쇄 +2" 패턴 (Lv 없이)
    match = trimmed.match(/([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s+\+(\d+)/);
    if (match) {
      const name = cleanSkillName(match[1]);
      if (name) {
        const matched = SkillData.matchSkill(name, selectedClass);
        return { name: matched || name, level: '+' + match[2] };
      }
    }

    return null;
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
          console.log(`OCR [${region.label}] raw:`, rawText);

          // 줄별로 파싱하여 스킬+레벨 패턴만 추출
          const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          const skills = [];
          for (const line of lines) {
            const parsed = parseSkillLine(line);
            if (parsed) {
              skills.push(parsed);
            }
          }

          console.log(`OCR [${region.label}] parsed:`, skills);

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

  return { recognizeRegions, setClass };
})();
