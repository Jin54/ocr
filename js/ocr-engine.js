/* ocr-engine.js - 색상 분리 OCR: 노란색→종류, 파란색→스킬 */

const OcrEngine = (function () {
  let worker = null;
  let isInitialized = false;
  let isProcessing = false;

  const SET_NAMES = ['활력', '마력', '광분', '순수'];
  const TYPE_NAMES = ['성배', '양피지', '나침반', '종', '거울', '천칭'];

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
        }
      },
    });

    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
      tessedit_pageseg_mode: '6',
    });

    isInitialized = true;
  }

  // 스케일된 캔버스 생성
  function createScaledCanvas(imageEl) {
    const canvas = document.createElement('canvas');
    const scale = Math.max(1, Math.ceil(600 / imageEl.naturalHeight));
    canvas.width = imageEl.naturalWidth * scale;
    canvas.height = imageEl.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);
    return { canvas, ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) };
  }

  // 노란색 텍스트만 추출 (종류명: "활력의 성배" 등)
  function preprocessYellow(imageEl) {
    const { canvas, ctx, imageData } = createScaledCanvas(imageEl);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];

      let isYellow = false;

      // 노란색/금색: R과 G가 높고 B가 낮음
      if (r > 150 && g > 100 && b < 120 && r > b * 1.5 && g > b * 1.2) {
        isYellow = true;
      }

      if (isYellow) {
        data[i] = data[i + 1] = data[i + 2] = 0;
      } else {
        data[i] = data[i + 1] = data[i + 2] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // 파란/하늘색 텍스트만 추출 (스킬명 + Lv)
  function preprocessBlue(imageEl) {
    const { canvas, ctx, imageData } = createScaledCanvas(imageEl);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      let isBlue = false;

      // 파란/하늘/시안 계열: B 또는 G가 우세하고 채도 있음
      if (brightness > 50 && brightness < 240) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 0 ? (max - min) / max : 0;
        if (saturation > 0.15 && (b > r || g > r)) {
          isBlue = true;
        }
      }

      // 흰색/밝은 텍스트 (Lv +1 같은 레벨 텍스트)
      if (brightness > 180) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 0 ? (max - min) / max : 0;
        if (saturation < 0.15) {
          isBlue = true;
        }
      }

      if (isBlue) {
        data[i] = data[i + 1] = data[i + 2] = 0;
      } else {
        data[i] = data[i + 1] = data[i + 2] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function cleanSkillName(text) {
    return text.replace(/[^가-힣\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  let selectedClass = null;
  function setClass(className) {
    selectedClass = className || null;
  }

  // "A의 B" 파싱
  function parseTypeName(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
      const match = line.match(/([가-힣]+)\s*의\s*([가-힣]+)/);
      if (match) {
        const setName = matchClosest(match[1], SET_NAMES);
        const typeName = matchClosest(match[2], TYPE_NAMES);
        return { set: setName || match[1], type: typeName || match[2] };
      }
    }
    // 직접 탐색
    let set = '', type = '';
    for (const s of SET_NAMES) { if (rawText.includes(s)) { set = s; break; } }
    for (const t of TYPE_NAMES) { if (rawText.includes(t)) { type = t; break; } }
    return { set, type };
  }

  // 스킬 파싱
  function parseSkills(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const skills = [];

    for (const line of lines) {
      if (skills.length >= 4) break;

      let match = line.match(/([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s*(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)/);
      if (!match) {
        match = line.match(/([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s+\+(\d+)/);
      }
      if (match) {
        const name = cleanSkillName(match[1]);
        if (name) {
          const matched = SkillData.matchSkill(name, selectedClass);
          skills.push({ name: matched || name, level: '+' + match[2] });
        }
      }
    }

    return skills;
  }

  function matchClosest(text, list) {
    for (const item of list) {
      if (text === item) return item;
    }
    for (const item of list) {
      if (text.includes(item) || item.includes(text)) return item;
    }
    let best = null, bestDist = Infinity;
    for (const item of list) {
      const dist = SkillData.levenshtein(text, item);
      if (dist < bestDist) { bestDist = dist; best = item; }
    }
    if (best && bestDist <= Math.floor(best.length * 0.5)) return best;
    return null;
  }

  async function recognizeImage(imageEl, onProgress) {
    if (isProcessing) {
      App.toast('이미 OCR이 진행 중입니다', 'error');
      return null;
    }

    isProcessing = true;

    try {
      await initWorker(onProgress);

      // 1) 노란색 OCR → 종류
      onProgress && onProgress({ status: 'processing', text: '종류 인식 중 (노란색)...', progress: 0.1 });
      const yellowCanvas = preprocessYellow(imageEl);
      const yellowResult = await worker.recognize(yellowCanvas);
      const yellowText = yellowResult.data.text.trim();
      console.log('노란색 OCR:', yellowText);
      const typeInfo = parseTypeName(yellowText);

      // 2) 파란색 OCR → 스킬
      onProgress && onProgress({ status: 'processing', text: '스킬 인식 중 (파란색)...', progress: 0.5 });
      const blueCanvas = preprocessBlue(imageEl);
      const blueResult = await worker.recognize(blueCanvas);
      const blueText = blueResult.data.text.trim();
      console.log('파란색 OCR:', blueText);
      const skills = parseSkills(blueText);

      const result = {
        set: typeInfo.set,
        type: typeInfo.type,
        skills: skills,
      };
      console.log('최종 결과:', result);

      onProgress && onProgress({ status: 'done', text: '완료', progress: 1 });
      return result;
    } catch (err) {
      console.error('OCR engine error:', err);
      App.toast('OCR 오류: ' + err.message, 'error');
      return null;
    } finally {
      isProcessing = false;
    }
  }

  return { recognizeImage, setClass };
})();
