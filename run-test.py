"""OCR 자동 테스트 - Python + Tesseract 네이티브
전처리 로직은 JS와 동일하게 포팅
"""
import os, sys, json, re, time
from PIL import Image
import pytesseract

TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
TESSDATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tessdata")
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
os.environ['TESSDATA_PREFIX'] = TESSDATA_DIR

IMAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Images")
CROP_RIGHT = 0.33
CROP_BOTTOM = 0.0

SET_NAMES = ['활력', '마력', '광분', '순수']
TYPE_NAMES = ['성배', '양피지', '나침반', '종', '거울', '천칭']
IGNORE_WORDS = ['강화 단계', '강화단계', '장착 효과', '장착효과', '세트 효과', '세트효과', '성배', '양피지', '나침반', '거울', '천칭']

SKILLS = [
    '암격쇄', '격파쇄', '백열격', '쾌유의 주문', '회전격',
    '타격쇄', '돌진 격파', '열파격', '파동격', '질풍 난무',
    '진동쇄', '충격 해제',
    '공격 준비', '충격 적중', '고취의 주문', '생명의 축복', '대지의 약속',
    '바람의 약속', '생존 의지', '보호진', '격노의 주문', '십자 방어',
]


def crop_image(img):
    w, h = img.size
    return img.crop((0, 0, round(w * (1 - CROP_RIGHT)), round(h * (1 - CROP_BOTTOM))))


def preprocess_image(img):
    w, h = img.size
    scale = max(2, -(-1200 // h))
    nw, nh = w * scale, h * scale
    img = img.resize((nw, nh), Image.LANCZOS)
    pixels = img.load()
    for y in range(nh):
        for x in range(nw):
            r, g, b = pixels[x, y][:3]
            brightness = 0.299 * r + 0.587 * g + 0.114 * b
            mx, mn = max(r, g, b), min(r, g, b)
            sat = (mx - mn) / mx if mx > 0 else 0
            is_text = (brightness > 150 and sat < 0.4) or (brightness > 40 and sat > 0.15)
            pixels[x, y] = (0, 0, 0) if is_text else (255, 255, 255)
    return img


def match_exact(text, lst):
    cleaned = text.replace(' ', '')
    for item in lst:
        if cleaned == item:
            return item
    for item in lst:
        if len(item) >= 2 and (item in cleaned or cleaned in item):
            return item
    return None


def is_ignored(text):
    cleaned = re.sub(r'\s+', ' ', text).strip()
    return any(word in cleaned for word in IGNORE_WORDS)


def clean_skill_name(text):
    return re.sub(r'\s+', ' ', re.sub(r'[^가-힣\s]', '', text)).strip()


def levenshtein(a, b):
    m, n = len(a), len(b)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i
    for j in range(n+1): dp[0][j] = j
    for i in range(1, m+1):
        for j in range(1, n+1):
            dp[i][j] = dp[i-1][j-1] if a[i-1]==b[j-1] else 1+min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])
    return dp[m][n]


def match_skill(ocr_text):
    cleaned = re.sub(r'\s+', ' ', ocr_text).strip()
    if not cleaned: return None
    for s in SKILLS:
        if s == cleaned: return s
    for s in SKILLS:
        if s in cleaned or cleaned in s: return s
    best, best_d = None, float('inf')
    for s in SKILLS:
        d = levenshtein(cleaned, s)
        if d < best_d: best_d, best = d, s
    if best and best_d <= max(len(cleaned), len(best)) * 0.5:
        return best
    return None


def parse_type_name(line):
    m = re.search(r'([가-힣]+)\s*의\s*([가-힣]+)', line)
    if m:
        s = match_exact(m.group(1), SET_NAMES)
        t = match_exact(m.group(2), TYPE_NAMES)
        if s and t: return s, t
    return None, None


def parse_skill_line(text):
    trimmed = text.strip()
    if not trimmed or is_ignored(trimmed): return None
    for pattern in [
        r'([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s*(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)',
        r'([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]*?)\s+\+(\d+)',
    ]:
        m = re.search(pattern, trimmed)
        if m:
            name = clean_skill_name(m.group(1))
            if name and len(name) >= 2 and not is_ignored(name):
                matched = match_skill(name)
                return {'name': matched or name, 'level': '+' + m.group(2)}
    return None


def find_skills_in_raw(raw, existing):
    existing_names = {s['name'] for s in existing}
    found = []
    for skill in sorted(SKILLS, key=len, reverse=True):
        if skill in existing_names: continue
        if len(found) + len(existing) >= 4: break
        if skill in raw:
            found.append({'name': skill, 'level': ''})
            existing_names.add(skill)
    return found


def collect_levels(raw):
    levels = []
    for m in re.finditer(r'(?:Lv|LV|lv|Iv)\s*\+?\s*(\d+)', raw):
        levels.append('+' + m.group(1))
    for m in re.finditer(r'(?:^|\s)\+(\d+)(?:\s|$)', raw, re.MULTILINE):
        levels.append('+' + m.group(1))
    return levels


def parse_full_text(raw):
    lines = [l.strip() for l in raw.split('\n') if l.strip()]
    merged = []
    for i, line in enumerate(lines):
        merged.append(line)
        if i+1 < len(lines): merged.append(line + ' ' + lines[i+1])

    set_name = type_name = ''
    skills = []

    for line in merged:
        if not set_name or not type_name:
            s, t = parse_type_name(line)
            if s and not set_name: set_name = s
            if t and not type_name: type_name = t
        if len(skills) < 4:
            sp = parse_skill_line(line)
            if sp and not any(s['name']==sp['name'] and s['level']==sp['level'] for s in skills):
                skills.append(sp)

    if len(skills) < 4:
        extra = find_skills_in_raw(raw, skills)
        all_lvl = collect_levels(raw)
        used = [s['level'] for s in skills]
        remain = list(all_lvl)
        for u in used:
            if u in remain: remain.remove(u)
        for e in extra:
            if len(skills) >= 4: break
            if remain: e['level'] = remain.pop(0)
            skills.append(e)

    if not set_name or not type_name:
        for line in lines:
            if set_name and type_name: break
            fm = re.search(r'([가-힣]+)\s*의\s*([가-힣]+)', line)
            if fm:
                if not set_name:
                    s = match_exact(fm.group(1), SET_NAMES)
                    if s: set_name = s
                if not type_name:
                    t = match_exact(fm.group(2), TYPE_NAMES)
                    if t: type_name = t
    if not set_name:
        for s in SET_NAMES:
            if s in raw: set_name = s; break
    if not type_name:
        for t in TYPE_NAMES:
            if len(t) >= 2 and t in raw: type_name = t; break

    return {'set': set_name, 'type': type_name, 'skills': skills}


def run_ocr(img):
    return pytesseract.image_to_string(img, lang='kor+eng', config='--psm 6 -c preserve_interword_spaces=1').strip()


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 61
    files = sorted(
        [f for f in os.listdir(IMAGE_DIR) if f.endswith('.jpg')],
        key=lambda x: int(re.search(r'(\d+)', x).group(1))
    )[:count]

    results, logs = [], []
    start = time.time()

    for i, fname in enumerate(files):
        img = Image.open(os.path.join(IMAGE_DIR, fname)).convert('RGB')
        cropped = crop_image(img)
        preprocessed = preprocess_image(cropped)
        raw = run_ocr(preprocessed)
        result = parse_full_text(raw)

        skills_str = ', '.join(f"{s['name']} {s['level']}" for s in result['skills'])
        missing = []
        if not result['set']: missing.append('세트')
        if not result['type']: missing.append('종류')
        if len(result['skills']) < 4: missing.append(f"스킬({len(result['skills'])}/4)")
        tag = 'OK' if not missing else 'MISS'

        # Write to file to avoid encoding issues
        results.append({'file': fname, **result})
        logs.append({'file': fname, 'rawText': raw, 'imageSize': f"{cropped.size[0]}x{cropped.size[1]}", 'parsed': result})

    elapsed = time.time() - start

    ok = sum(1 for r in results if r['set'] and r['type'] and len(r['skills']) == 4)
    miss_set = sum(1 for r in results if not r['set'])
    miss_type = sum(1 for r in results if not r['type'])
    miss_skill = sum(1 for r in results if len(r['skills']) < 4)
    skill_counts = [0]*5
    for r in results:
        skill_counts[min(len(r['skills']), 4)] += 1

    base = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(base, 'test-results.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    with open(os.path.join(base, 'test-logs.json'), 'w', encoding='utf-8') as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)

    # Summary to file
    summary = []
    for r in results:
        skills_str = ', '.join(f"{s['name']} {s['level']}" for s in r['skills'])
        missing = []
        if not r['set']: missing.append('세트')
        if not r['type']: missing.append('종류')
        if len(r['skills']) < 4: missing.append(f"스킬({len(r['skills'])}/4)")
        tag = 'OK' if not missing else 'MISS'
        line = f"[{tag}] {r['file']} -> {r['set'] or '?'}/{r['type'] or '?'} | {skills_str}"
        if missing: line += f"  <- {', '.join(missing)}"
        summary.append(line)

    summary.append(f"\n{'='*60}")
    summary.append(f"완벽: {ok}/{len(results)}")
    summary.append(f"세트 누락: {miss_set}")
    summary.append(f"종류 누락: {miss_type}")
    summary.append(f"스킬 4개 미만: {miss_skill}")
    summary.append(f"스킬 분포: " + ', '.join(f"{i}개={skill_counts[i]}" for i in range(5)))
    summary.append(f"소요시간: {elapsed:.1f}초")
    summary.append(f"{'='*60}")

    with open(os.path.join(base, 'test-summary.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(summary))

    # Also print (may garble on Windows but file is clean)
    for line in summary[-8:]:
        print(line)


if __name__ == '__main__':
    main()
