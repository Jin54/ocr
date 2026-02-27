/* ocr-engine.js - 크롭 이미지 전체 OCR + 자동 파싱 */

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

  // 전처리: 텍스트 색상을 검정으로, 나머지 흰색 + 하단 노이즈 제거
  function preprocessImage(imageEl) {
    const canvas = document.createElement('canvas');
    const scale = Math.max(2, Math.ceil(1200 / imageEl.naturalHeight));
    canvas.width = imageEl.naturalWidth * scale;
    canvas.height = imageEl.naturalHeight * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;
    // 하단 55%는 강제 흰색 (스킬 정보는 상단 45%에만 존재)
    const cutoffY = Math.round(h * 0.45);

    for (let i = 0; i < data.length; i += 4) {
      const px = (i / 4) | 0;
      const y = (px / w) | 0;

      if (y >= cutoffY) {
        data[i] = data[i + 1] = data[i + 2] = 255;
        continue;
      }

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      let isText = false;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max > 0 ? (max - min) / max : 0;

      // 밝은 텍스트 (흰색, Lv +N 등)
      if (brightness > 150 && sat < 0.4) {
        isText = true;
      }

      // 채도 있는 텍스트 (노란/파란/초록/하늘 등)
      if (brightness > 40 && sat > 0.15) {
        isText = true;
      }

      if (isText) {
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

  // 세트/종류 이름 매칭 (정확 + 포함)
  function matchExact(text, list) {
    const cleaned = text.replace(/\s/g, '');
    for (const item of list) {
      if (cleaned === item) return item;
    }
    for (const item of list) {
      if (item.length >= 2 && (cleaned.includes(item) || item.includes(cleaned))) return item;
    }
    return null;
  }

  // "A의 B" 파싱
  function parseTypeName(line) {
    const match = line.match(/([가-힣]+)\s*의\s*([가-힣]+)/);
    if (match) {
      const setName = matchExact(match[1], SET_NAMES);
      const typeName = matchExact(match[2], TYPE_NAMES);
      if (setName && typeName) {
        return { set: setName, type: typeName };
      }
    }
    return null;
  }

  // 스킬+레벨 파싱 (라인 기반)
  function parseSkillLine(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    let match = trimmed.match(/([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s*(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)/);
    if (match) {
      const name = cleanSkillName(match[1]);
      if (name && name.length >= 2) {
        const matched = SkillData.matchSkill(name, selectedClass);
        return { name: matched || name, level: '+' + match[2] };
      }
    }

    match = trimmed.match(/([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s+\+(\d+)/);
    if (match) {
      const name = cleanSkillName(match[1]);
      if (name && name.length >= 2) {
        const matched = SkillData.matchSkill(name, selectedClass);
        return { name: matched || name, level: '+' + match[2] };
      }
    }

    return null;
  }

  // OCR raw 텍스트에서 알려진 스킬명을 직접 검색 (fallback)
  function findSkillsInRawText(rawText, existingSkills) {
    const allSkills = selectedClass
      ? SkillData.getSkillsByClass(selectedClass)
      : SkillData.getAllSkills();

    const found = [];
    const existingNames = new Set(existingSkills.map(s => s.name));

    // 긴 이름부터 검색 (부분 매칭 방지)
    const sorted = [...allSkills].sort((a, b) => b.length - a.length);

    for (const skill of sorted) {
      if (existingNames.has(skill)) continue;
      if (found.length + existingSkills.length >= 4) break;

      if (rawText.includes(skill)) {
        found.push({ name: skill, level: '' });
        existingNames.add(skill);
      }
    }

    return found;
  }

  // Lv/+N 레벨 값들을 수집
  function collectLevels(rawText) {
    const levels = [];
    const re = /(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)/g;
    let m;
    while ((m = re.exec(rawText)) !== null) {
      levels.push('+' + m[1]);
    }
    // +N 패턴도 수집 (Lv 없이)
    const re2 = /(?<![0-9,./])(?:^|\s)\+(\d+)(?:\s|$)/gm;
    while ((m = re2.exec(rawText)) !== null) {
      levels.push('+' + m[1]);
    }
    return levels;
  }

  // 전체 OCR 텍스트 파싱
  function parseFullText(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('OCR 전체 텍스트:', lines);

    // 인접 라인 합치기
    const mergedLines = [];
    for (let i = 0; i < lines.length; i++) {
      mergedLines.push(lines[i]);
      if (i + 1 < lines.length) {
        mergedLines.push(lines[i] + ' ' + lines[i + 1]);
      }
    }

    let set = '', type = '';
    const skills = [];

    for (const line of mergedLines) {
      // 세트/종류 파싱
      if (!set || !type) {
        const typeParsed = parseTypeName(line);
        if (typeParsed) {
          if (!set) set = typeParsed.set;
          if (!type) type = typeParsed.type;
        }
      }

      // 스킬 파싱 (최대 4개, 중복 방지)
      if (skills.length < 4) {
        const skillParsed = parseSkillLine(line);
        if (skillParsed) {
          const isDup = skills.some(s => s.name === skillParsed.name && s.level === skillParsed.level);
          if (!isDup) {
            skills.push(skillParsed);
          }
        }
      }
    }

    // fallback: 스킬이 4개 미만이면 raw 텍스트에서 알려진 스킬명 직접 검색
    if (skills.length < 4) {
      const extraSkills = findSkillsInRawText(rawText, skills);
      // 레벨 매칭: 수집된 Lv 값 중 아직 사용되지 않은 것 할당
      const allLevels = collectLevels(rawText);
      // 이미 파싱된 스킬의 레벨 제거
      const usedLevels = skills.map(s => s.level);
      const remainLevels = [...allLevels];
      for (const ul of usedLevels) {
        const idx = remainLevels.indexOf(ul);
        if (idx >= 0) remainLevels.splice(idx, 1);
      }

      for (const extra of extraSkills) {
        if (skills.length >= 4) break;
        // 남은 레벨 중 하나 할당
        if (remainLevels.length > 0) {
          extra.level = remainLevels.shift();
        }
        skills.push(extra);
      }
    }

    // fallback: 세트/종류
    if (!set || !type) {
      for (const line of lines) {
        if (set && type) break;
        const fullMatch = line.match(/([가-힣]+)\s*의\s*([가-힣]+)/);
        if (fullMatch) {
          if (!set) {
            const s = matchExact(fullMatch[1], SET_NAMES);
            if (s) set = s;
          }
          if (!type) {
            const t = matchExact(fullMatch[2], TYPE_NAMES);
            if (t) type = t;
          }
        }
      }
    }
    if (!set || !type) {
      if (!set) {
        for (const s of SET_NAMES) { if (rawText.includes(s)) { set = s; break; } }
      }
      if (!type) {
        for (const t of TYPE_NAMES) {
          if (t.length >= 2 && rawText.includes(t)) { type = t; break; }
        }
      }
    }

    return { set, type, skills };
  }

  async function recognizeImage(imageEl, onProgress) {
    if (isProcessing) {
      App.toast('이미 OCR이 진행 중입니다', 'error');
      return null;
    }

    isProcessing = true;

    try {
      await initWorker(onProgress);

      onProgress && onProgress({ status: 'processing', text: '이미지 전처리 중...', progress: 0.2 });
      const preprocessed = preprocessImage(imageEl);

      onProgress && onProgress({ status: 'recognizing', text: 'OCR 인식 중...', progress: 0.3 });
      const { data } = await worker.recognize(preprocessed);
      const rawText = data.text.trim();
      console.log('OCR raw:', rawText);

      const result = parseFullText(rawText);
      console.log('파싱 결과:', result);

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
