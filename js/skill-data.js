/* skill-data.js - 직업별 스킬 목록 (OCR 매칭용) */

const SkillData = (function () {
  const classes = {
    검성: {
      active: [
        '내려찍기', '분쇄 파동', '파멸의 맹타', '절단의 맹타', '도약 찍기',
        '돌진 일격', '예리한 일격', '유린의 검', '발목 베기', '충격 해제',
        '검기 난무', '공중 결박',
      ],
      passive: [
        '공격 준비', '충격 적중', '약점 파악', '노련한 반격', '살기 파열',
        '생존 자세', '피의 흡수', '생존 의지', '파괴 충동', '보호의 갑옷',
      ],
    },
    수호성: {
      active: [
        '연속 난타', '심판', '맹렬한 일격', '징벌', '비호의 일격',
        '방패 강타', '쇠약의 맹타', '포획', '방패 돌격', '섬멸',
        '충격 해제', '섬광 난무',
      ],
      passive: [
        '격앙', '충격 적중', '철벽 방어', '체력 강화', '단죄의 가호',
        '고통 차단', '생존 의지', '수호의 인장', '모욕의 포효', '비호의 방패',
      ],
    },
    살성: {
      active: [
        '심장 찌르기', '빠른 베기', '기습', '문양 폭발', '맹수의 포효',
        '폭풍 난무', '암습', '회오리 베기', '섬광 베기', '침투',
        '충격 해제', '그림자 낙하',
      ],
      passive: [
        '강습 자세', '배후 강타', '충격 적중', '빈틈 노리기', '육감 극대화',
        '방어 균열', '각오', '회생의 계약', '기습 자세', '독 바르기',
      ],
    },
    궁성: {
      active: [
        '저격', '속사', '조준 화살', '송곳 화살', '광풍 화살',
        '표적 화살', '파열 화살', '제압 화살', '올가미 화살', '폭발의 덫',
        '충격 해제', '화살 난사',
      ],
      passive: [
        '집중의 눈', '사냥꾼의 결의', '사냥꾼의 혼', '집중 포화', '경계의 눈',
        '속박의 눈', '근접 사격', '회생의 계약', '저항의 결의', '바람의 활력',
      ],
    },
    마도성: {
      active: [
        '불꽃 화살', '불꽃 폭발', '혹한의 바람', '집중의 기원', '얼음 사슬',
        '불꽃 작살', '겨울의 속박', '지옥의 화염', '빙결', '빙결 폭발',
        '화염 난사', '충격 해제',
      ],
      passive: [
        '불꽃의 로브', '불의 표식', '생기 증발', '냉기 소환', '정기 흡수',
        '강화의 은혜', '회생의 계약', '저항의 은혜', '냉기의 로브', '대지의 로브',
      ],
    },
    정령성: {
      active: [
        '화염 전소', '냉기 충격', '원소 융합', '협공: 저주', '소환: 물의 정령',
        '공간 지배', '영혼의 절규', '소환: 바람의 정령', '연속 난사', '소환: 불의 정령',
        '충격 해제', '소환: 땅의 정령',
      ],
      passive: [
        '정령 타격', '정신 집중', '침식', '정령 강림', '정령 보호',
        '연속 역류', '원소 결집', '회생의 계약', '정령 교감', '정령 회생',
      ],
    },
    치유성: {
      active: [
        '쾌유의 광휘', '심판의 번개', '재생의 빛', '치유의 빛', '단죄',
        '대지의 응보', '고통의 연쇄', '신성한 기운', '벼락 난사', '약화의 낙인',
        '벽력', '충격 해제',
      ],
      passive: [
        '대지의 은총', '치유력 강화', '불사의 장막', '주신의 은총', '따뜻한 가호',
        '생존 의지', '찬란한 가호', '집중의 기도', '주신의 가호', '회복 차단',
      ],
    },
    호법성: {
      active: [
        '암격쇄', '격파쇄', '백열격', '쾌유의 주문', '회전격',
        '타격쇄', '돌진 격파', '열파격', '파동격', '질풍 난무',
        '진동쇄', '충격 해제',
      ],
      passive: [
        '공격 준비', '충격 적중', '고취의 주문', '생명의 축복', '대지의 약속',
        '바람의 약속', '생존 의지', '보호진', '격노의 주문', '십자 방어',
      ],
    },
  };

  // 모든 스킬명 리스트 (직업 무관)
  function getAllSkills() {
    const all = new Set();
    for (const cls of Object.values(classes)) {
      cls.active.forEach(s => all.add(s));
      cls.passive.forEach(s => all.add(s));
    }
    return [...all];
  }

  // 특정 직업의 스킬만 가져오기
  function getSkillsByClass(className) {
    const cls = classes[className];
    if (!cls) return getAllSkills();
    return [...cls.active, ...cls.passive];
  }

  // 직업 목록
  function getClassNames() {
    return Object.keys(classes);
  }

  // 레벤슈타인 거리 (편집 거리)
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  // OCR 결과를 스킬 리스트에서 가장 유사한 것으로 매칭
  function matchSkill(ocrText, className) {
    const skills = className ? getSkillsByClass(className) : getAllSkills();
    const cleaned = ocrText.replace(/\s+/g, ' ').trim();
    if (!cleaned) return null;

    // 정확히 일치하면 바로 반환
    const exact = skills.find(s => s === cleaned);
    if (exact) return exact;

    // 포함 관계 확인 (OCR 결과에 스킬명이 포함되어 있거나, 스킬명에 OCR 결과가 포함)
    const contained = skills.find(s => cleaned.includes(s) || s.includes(cleaned));
    if (contained) return contained;

    // 레벤슈타인 거리로 가장 가까운 스킬 찾기
    let bestMatch = null;
    let bestDist = Infinity;
    for (const skill of skills) {
      const dist = levenshtein(cleaned, skill);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = skill;
      }
    }

    // 거리가 원본 길이의 50% 이내일 때만 매칭
    const maxLen = Math.max(cleaned.length, bestMatch ? bestMatch.length : 0);
    if (bestMatch && bestDist <= maxLen * 0.5) {
      return bestMatch;
    }

    return null; // 매칭 실패
  }

  return { classes, getAllSkills, getSkillsByClass, getClassNames, matchSkill, levenshtein };
})();
