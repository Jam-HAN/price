/**
 * 거래처별로 들쭉날쭉한 모델 코드를 표준형으로 정규화.
 * Samsung: "SM-XNNNN[N|NK][_]?[storage]" → "SM-XNNNN_STORAGE" 또는 "SM-XNNNN"
 * 예:
 *   SM-S948N_512G → SM-S948N_512G
 *   SM-S948N512G  → SM-S948N_512G
 *   SM-S948NK512  → SM-S948N_512G
 *   SM-S948NK     → SM-S948N
 *   SM-S948N1TB   → SM-S948N_1T
 *   S948 512      → SM-S948N_512G (SM- 프리픽스 자동 보정)
 *
 * Apple/기타: 현재는 원본 유지 (벤더 프리픽스가 제각각이라 신뢰 가능한 매핑 어려움)
 */
export function normalizeDeviceCode(raw: string): string {
  if (!raw) return raw;
  const cleaned = raw.toUpperCase().replace(/\s+/g, '');

  // 1) iPhone 패턴: IP{family}[P|PM|E]?_{storage}
  //    OCR 오타/변형 보정: 256GB→256G, 256GG→256G, 1TG→1T, 1TB→1T
  const ip = cleaned.match(/^IP(\d+)(P|PM|PL|E)?[_-]?(\d+)(?:TG|GG|GB|TB|G|T)?$/);
  if (ip) {
    const family = ip[1];
    const suffix = ip[2] ?? '';
    const storageNum = ip[3];
    // "1" or "2" → T 단위 (1T/2T), 그 외 → G 단위
    const storageUnit = Number(storageNum) <= 2 ? 'T' : 'G';
    return `IP${family}${suffix}_${storageNum}${storageUnit}`;
  }
  // IP Air 계열: IPA_256G / IPA_1T
  const ipa = cleaned.match(/^IPA[_-]?(\d+)(?:TG|GG|GB|TB|G|T)?$/);
  if (ipa) {
    const storageNum = ipa[1];
    const storageUnit = Number(storageNum) <= 2 ? 'T' : 'G';
    return `IPA_${storageNum}${storageUnit}`;
  }

  // 2) Samsung 패턴: (SM-)? [A-Z]\d{3}(선택적으로 N/K/S 접미사 — SKT는 S 쓰는 경우 있음) + optional storage
  // family는 반드시 3자리 숫자 (S942, F766, A366 등) — greedy overmatch 방지
  const m = cleaned.match(/^(?:SM-)?([A-Z]\d{3})[NKS]?[_-]?(\d+(?:G|T)?B?)?$/);
  if (!m) return raw; // 인식 실패 → 원본 유지

  const family = m[1];
  let storage: string | null = m[2] ?? null;

  if (storage) {
    // GB/TB → G/T (뒤 B 제거)
    if (storage.endsWith('B')) storage = storage.slice(0, -1);
    // 숫자만 있으면 G 추가 (512 → 512G)
    if (/^\d+$/.test(storage)) storage = storage + 'G';
  }

  return storage ? `SM-${family}N_${storage}` : `SM-${family}N`;
}

/** family code (예: S942) → 시리즈 카테고리 */
const SAMSUNG_FAMILY_SERIES: Record<string, string> = {
  // Galaxy S26
  S942: 'galaxyS26', S947: 'galaxyS26', S948: 'galaxyS26',
  // Galaxy S25
  S731: 'galaxyS25', S931: 'galaxyS25', S936: 'galaxyS25', S937: 'galaxyS25', S938: 'galaxyS25',
  // Z Fold/Flip 7
  F766: 'flip7', F731: 'flip7', F761: 'flip7',
  F966: 'fold7', F961: 'fold7',
  // Z Fold/Flip 6
  F741: 'flip6', F756: 'flip6',
  F946: 'fold6', F956: 'fold6',
  // A·M·Tab·Watch → galaxyEtc으로 묶기 (SERIES_ORDER에서 6위)
  A165: 'galaxyEtc', A166: 'galaxyEtc', A175: 'galaxyEtc', A366: 'galaxyEtc',
  A556: 'galaxyEtc', A566: 'galaxyEtc', A2886: 'galaxyEtc',
  M166: 'galaxyEtc', M366: 'galaxyEtc',
  X216: 'tablet', X236: 'tablet',
  L135: 'wearable', L305: 'wearable', L315: 'wearable', L325: 'wearable',
  L335: 'wearable', L505: 'wearable', L705: 'wearable',
};

/**
 * model_code의 family(예: S942, F766)를 표준 한글 제품명으로 매핑.
 * 매핑이 없는 family는 null 반환 → 호출자가 기존 nickname 유지.
 */
const SAMSUNG_FAMILY_NAMES: Record<string, string> = {
  // Galaxy S26
  S942: '갤럭시 S26',
  S947: '갤럭시 S26+',
  S948: '갤럭시 S26 울트라',
  // Galaxy S25
  S731: '갤럭시 S25 FE',
  S931: '갤럭시 S25',
  S936: '갤럭시 S25+',
  S937: '갤럭시 S25 엣지',
  S938: '갤럭시 S25 울트라',
  // Z Fold/Flip 7
  F766: '갤럭시 Z 플립7',
  F966: '갤럭시 Z 폴드7',
  F761: '갤럭시 Z 플립7 FE',
  F731: '갤럭시 Z 플립7 FE',
  F961: '갤럭시 Z 폴드7',
  // Z Fold/Flip 6
  F741: '갤럭시 Z 플립6',
  F756: '갤럭시 Z 플립6',
  F946: '갤럭시 Z 폴드6',
  F956: '갤럭시 Z 폴드6',
  // A 시리즈
  A165: '갤럭시 A16',
  A166: '갤럭시 A16 LTE',
  A175: '갤럭시 A17',
  A366: '갤럭시 A36',
  A556: '갤럭시 A55',
  A566: '갤럭시 A56',
  // M 시리즈
  M166: '갤럭시 Wide8',
  M366: '갤럭시 M36',
  // Tab
  X216: '갤럭시탭 A9+',
  X236: '갤럭시탭 A11+',
  // Watch / Ring
  L305: '갤럭시 워치8 40mm',
  L325: '갤럭시 워치 40mm',
  L335: '갤럭시 링5 라이트',
  L505: '갤럭시 링5',
  L705: '갤럭시 워치 울트라',
  L135: '갤럭시 링4',
  L315: '갤럭시 링4 UW',
};

/** model_code에서 용량 부분을 한글 표기로 변환 */
function storageLabel(storageRaw: string | null | undefined): string {
  if (!storageRaw) return '';
  const s = storageRaw.toUpperCase();
  if (s === '1T' || s === '1TB') return ' 1TB';
  // 256G → 256G (이미 G 붙어있으면 그대로), 256 → 256G
  if (/^\d+$/.test(s)) return ` ${s}G`;
  return ` ${s}`;
}

/**
 * 문자열에서 Samsung family code 추출 (예: "A175 KP(자조폰)" → "A175").
 * SM- 프리픽스 없고 suffix 지저분해도 가능한 한 인식.
 */
export function extractFamilyCode(raw: string): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  const m = up.match(/([A-Z])(\d{3})/);
  if (!m) return null;
  const key = `${m[1]}${m[2]}`;
  if (SAMSUNG_FAMILY_NAMES[key]) return key;
  return null;
}

/**
 * model_code에서 표준 한글 제품명을 생성.
 * 엄격 매칭(SM-XXXN_YYYG) 우선, 실패 시 family만 인식하고 변형(KP/ZEM/MOM/자조) 접미사 보존.
 * 매핑 없으면 null.
 */
export function canonicalNickname(modelCode: string): string | null {
  // 1) 엄격 패턴
  const strict = modelCode.match(/^SM-([A-Z])(\d{3})N?(?:_(.+))?$/);
  if (strict) {
    const key = `${strict[1]}${strict[2]}`;
    const base = SAMSUNG_FAMILY_NAMES[key];
    if (base) return base + storageLabel(strict[3]);
  }

  // 2) 느슨한 패턴 — vendor raw code (A175 KP, SM-A175NK-KP 등)
  const fam = extractFamilyCode(modelCode);
  if (!fam) return null;
  const base = SAMSUNG_FAMILY_NAMES[fam];
  if (!base) return null;

  const up = modelCode.toUpperCase();
  // 흔한 변형 태그
  if (up.includes('KP') || up.includes('자조')) return `${base} KP`;
  if (up.includes('ZEM')) return `${base} ZEM`;
  if (up.includes('MOM')) return `${base} MOM`;
  if (up.includes('UM') || up.includes('우주')) return `${base} UM`;
  return base;
}

/**
 * 매칭용 candidate 목록 생성 — 용량 미표기는 256G 기본으로 간주.
 * 예: normalizeDeviceCode('SM-S948N') = 'SM-S948N'
 *     canonicalCandidates → ['SM-S948N', 'SM-S948N_256G']
 * sync/autoRegister 단계에서 이 후보를 전부 lookup해 기존 디바이스를 찾음.
 */
export function canonicalCandidates(raw: string): string[] {
  const norm = normalizeDeviceCode(raw);
  const out = [norm];
  // Samsung 패턴 · 용량 미표기(SM-XXXN)는 SM-XXXN_256G와 동일 취급
  if (/^SM-[A-Z]\d{3}N$/.test(norm)) {
    out.push(`${norm}_256G`);
  }
  return out;
}

