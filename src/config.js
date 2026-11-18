// 말랑포포: 폭신폭신 공성전 (PuffPuff Siege) - 코어 뼈대 & 스킬/모드 설정 모듈
// Clean-IP Original Artillery + Dual-Physics Engine

export const WORLD = {
  WIDTH: 1600,
  HEIGHT: 900,
  CELL_SIZE: 2, // 지형 마스크 해상도 (2px 단위 -> 800x450)
  SEA_LEVEL: 825, // 구름 바다 드롭아웃(낙하 아웃) 기준선
  GRAVITY: 0.26, // 포탄 및 카트 중력 가속도
  WIND_SCALE: 0.0042, // 풍속당 수평 가속도 계수 (강풍 체감 강화)
  HEADWIND_DRAG: 0.0014, // 역풍 시 포탄이 느려지는 공기 저항 계수
  RAIN_GRAVITY_MULT: 1.18, // 비 올 때 빗물 무게로 중력 증가 (사거리 단축)
  RAIN_DRAG: 0.9945, // 비 올 때 공기 저항 감속 (사거리 약 20% 단축)
  MAX_WIND: 15, // 풍속 범위 (-15 ~ +15)
  STRIP_WIDTH: 10, // Matter.js 지형 정적 콜라이더 컬럼 폭
};

export const WEATHER = {
  CLEAR: {
    id: 'CLEAR',
    label: '맑음',
    icon: '☀️',
    desc: '표준 탄도 비행',
  },
  RAIN: {
    id: 'RAIN',
    label: '비 내림',
    icon: '🌧️',
    desc: '빗물 저항으로 사거리 -20%',
  },
};

export const MATERIALS = {
  WOOD: {
    id: 'WOOD',
    label: '초콜렛 바',
    maxHp: 58,
    density: 0.0016,
    friction: 0.7,
    restitution: 0.14,
    crushMultiplier: 1.0,
    fill: '#6D3B1A',
    stroke: '#3B1D0A',
    accent: '#A4643B',
  },
  ICE: {
    id: 'ICE',
    label: '유리 캔디',
    maxHp: 44,
    density: 0.0013,
    friction: 0.25,
    restitution: 0.22,
    crushMultiplier: 0.95,
    fill: '#67E8F9',
    stroke: '#0E7490',
    accent: '#ECFEFF',
  },
  STONE: {
    id: 'STONE',
    label: '초코 쿠키',
    maxHp: 115,
    density: 0.0032,
    friction: 0.8,
    restitution: 0.08,
    crushMultiplier: 1.7,
    fill: '#4A2C2A',
    stroke: '#271312',
    accent: '#FFFBEB',
  },
  JELLY: {
    id: 'JELLY',
    label: '통통 솜사탕',
    maxHp: 999,
    indestructible: true,
    density: 0.0022,
    friction: 0.45,
    restitution: 0.98,
    crushMultiplier: 0.5,
    fill: '#F9A8D4',
    stroke: '#DB2777',
    accent: '#FDF2F8',
  },
  TNT: {
    id: 'TNT',
    label: '팝핑 캔디 폭탄',
    maxHp: 22,
    explosive: true,
    blastRadius: 72,
    blastDamage: 44,
    density: 0.0018,
    friction: 0.6,
    restitution: 0.2,
    crushMultiplier: 1.1,
    fill: '#F43F5E',
    stroke: '#9F1239',
    accent: '#FDE047',
  },
};

// 계급 & 외형 꾸미기 시스템 (성능 차이 0% — 순수 명예 휘장 및 외형 코스메틱)
export const RANKS = [
  { level: 1, minXp: 0, title: '견습 발명가', badge: '🌱', color: '#86EFAC', trailStyle: 'default', hatAcc: 'none' },
  { level: 2, minXp: 100, title: '숲속 석궁수', badge: '🥉', color: '#FDBA74', trailStyle: 'sparkle', hatAcc: 'feather' },
  { level: 3, minXp: 250, title: '구름 조련사', badge: '🥈', color: '#E2E8F0', trailStyle: 'star', hatAcc: 'scarf_glow' },
  { level: 4, minXp: 480, title: '황금 명사수', badge: '🥇', color: '#FDE047', trailStyle: 'rainbow', hatAcc: 'crown' },
  { level: 5, minXp: 800, title: '하늘 대장군', badge: '👑', color: '#F472B6', trailStyle: 'royal', hatAcc: 'royal_aura' },
];

export const SHELLS = {
  ACORN_SPLIT: {
    id: 'ACORN_SPLIT',
    name: '도토리 팝볼',
    badge: '3갈래 분열',
    desc: '비행 중 에어 트리거 입력 시 3갈래 부채꼴로 분열하여 구조물을 철거합니다.',
    weightCost: 100,
    damage: 28,
    craterRadius: 38,
    blockBonus: 1.45,
    windFactor: 1.0,
    bounces: 0,
    color: '#F59E0B',
    coreColor: '#FEF3C7',
    triggerLabel: '3갈래 팝 분열!',
  },
  AQUA_DRILL: {
    id: 'AQUA_DRILL',
    name: '물방울 시추볼',
    badge: '수직 급강하 굴착',
    desc: '에어 트리거 입력 시 수평 비행을 멈추고 수직 급강하하여 지형을 깊게 파냅니다.',
    weightCost: 120,
    damage: 26,
    craterRadius: 58,
    blockBonus: 1.0,
    windFactor: 0.9,
    bounces: 0,
    color: '#38BDF8',
    coreColor: '#E0F2FE',
    triggerLabel: '급강하 시추!',
  },
  CHEESE_BOUNCE: {
    id: 'CHEESE_BOUNCE',
    name: '탱탱 치즈볼',
    badge: '도탄 & 역회전',
    desc: '지형·블록에 최대 2회 튕기며, 에어 트리거 입력 시 역추진 커브로 엄폐물 뒤를 노립니다.',
    weightCost: 110,
    damage: 32,
    craterRadius: 42,
    blockBonus: 1.2,
    windFactor: 1.1,
    bounces: 2,
    color: '#FACC15',
    coreColor: '#FEF9C3',
    triggerLabel: '부메랑 스핀!',
  },
};

// 캐릭터별 고유 전술 스킬 스펙
export const SKILL_MODES = {
  NORMAL: {
    id: 'NORMAL',
    name: '일반 사격',
    badge: '기본 턴 소모',
    damageMult: 1.0,
    radiusMult: 1.0,
    extraWeight: 0,
    extraBounces: 0,
    shots: 1,
    effectId: 'NORMAL',
  },
  // --- 토리 (다람쥐) 전용 스킬 ---
  TORI_SMASH: {
    id: 'TORI_SMASH',
    name: '🌰 도토리 강타',
    badge: '위력+35% · 강진',
    damageMult: 1.35,
    radiusMult: 1.28,
    extraWeight: 35,
    extraBounces: 0,
    shots: 1,
    effectId: 'POWER_BOOST',
    color: '#F97316',
  },
  TORI_DOUBLE: {
    id: 'TORI_DOUBLE',
    name: '⚡ 2연발 속사',
    badge: '연속 2발 · 무게+55',
    damageMult: 0.72,
    radiusMult: 0.9,
    extraWeight: 55,
    extraBounces: 0,
    shots: 2,
    effectId: 'DOUBLE_SNAP',
    color: '#EC4899',
  },
  // --- 뿌꾸 (해달) 전용 스킬 ---
  PPUKKU_DIG: {
    id: 'PPUKKU_DIG',
    name: '💧 아쿠아 시추',
    badge: '굴착 반경+55%',
    damageMult: 1.05,
    radiusMult: 1.55,
    extraWeight: 40,
    extraBounces: 0,
    shots: 1,
    effectId: 'AQUA_DIG',
    color: '#0EA5E9',
  },
  PPUKKU_BUBBLE: {
    id: 'PPUKKU_BUBBLE',
    name: '🫧 버블 부양탄',
    badge: '적 공중 띄우기',
    damageMult: 0.95,
    radiusMult: 1.15,
    extraWeight: 35,
    extraBounces: 0,
    shots: 1,
    effectId: 'BUBBLE_LIFT',
    color: '#38BDF8',
  },
  // --- 치치 (햄스터) 전용 스킬 ---
  CHICHI_BOUNCE: {
    id: 'CHICHI_BOUNCE',
    name: '🧀 치즈 바운스',
    badge: '도탄 +3회 추가',
    damageMult: 1.15,
    radiusMult: 1.05,
    extraWeight: 30,
    extraBounces: 3,
    shots: 1,
    effectId: 'EXTRA_BOUNCE',
    color: '#EAB308',
  },
  CHICHI_MAGNET: {
    id: 'CHICHI_MAGNET',
    name: '🧲 중력 자석탄',
    badge: '적·블록 끌어당김',
    damageMult: 1.1,
    radiusMult: 1.25,
    extraWeight: 40,
    extraBounces: 0,
    shots: 1,
    effectId: 'MAGNET_PULL',
    color: '#A855F7',
  },
};

// 하위 호환 별칭
SKILL_MODES.POWER_BOOST = SKILL_MODES.TORI_SMASH;
SKILL_MODES.DOUBLE_SNAP = SKILL_MODES.TORI_DOUBLE;

// 말랑볼 요정단 (Jelly-Cheek Spirits) 20종 (남 10 · 여 10) 오리지널 라인업
const SKILL_SETS = [
  ['TORI_SMASH', 'TORI_DOUBLE'],
  ['PPUKKU_DIG', 'PPUKKU_BUBBLE'],
  ['CHICHI_BOUNCE', 'CHICHI_MAGNET'],
  ['TORI_SMASH', 'PPUKKU_BUBBLE'],
  ['CHICHI_BOUNCE', 'TORI_DOUBLE'],
  ['PPUKKU_DIG', 'CHICHI_MAGNET'],
];

const DEFAULT_SHELLS = ['ACORN_SPLIT', 'AQUA_DRILL', 'CHEESE_BOUNCE'];

const RAW_SPIRITS = [
  // 남자 10종 (01~10)
  { id: 'M01_MOCHI', num: '01', gender: 'M', name: '모찌웅', species: '꿀벌 아기곰', primary: '#FEF3C7', secondary: '#78350F', outfit: 'bee', jellyCore: 'strawberry', ult: '딸기 시럽 메가 스매시' },
  { id: 'M02_PUDDING', num: '02', gender: 'M', name: '푸딩군', species: '커스터드 푸딩', primary: '#FDE047', secondary: '#78350F', outfit: 'beret', jellyCore: 'pudding', ult: '캐러멜 푸딩 폭격' },
  { id: 'M03_CLOUD', num: '03', gender: 'M', name: '구름몽', species: '구름 강아지', primary: '#BAE6FD', secondary: '#1E3A8A', outfit: 'rainbow_scarf', jellyCore: 'star', ult: '솜사탕 별똥별' },
  { id: 'M04_BAMTOL', num: '04', gender: 'M', name: '밤톨이', species: '아기 다람쥐', primary: '#C68B59', secondary: '#5C3A21', outfit: 'leaf_cape', jellyCore: 'heart', ult: '메가 도토리 해머' },
  { id: 'M05_SODAPIN', num: '05', gender: 'M', name: '아라핀', species: '민트 펭귄', primary: '#99F6E4', secondary: '#0F766E', outfit: 'straw_hat', jellyCore: 'bubble', ult: '탄산 간헐천 웨이브' },
  { id: 'M06_COCONYANG', num: '06', gender: 'M', name: '코코냥', species: '코코아 고양이', primary: '#A67B5B', secondary: '#4A2C2A', outfit: 'overalls', jellyCore: 'heart', ult: '메가 냥냥 꾹꾹이' },
  { id: 'M07_BYEOLJJI', num: '07', gender: 'M', name: '별찌', species: '우주 여우', primary: '#DDD6FE', secondary: '#5B21B6', outfit: 'saturn_band', jellyCore: 'star', ult: '은하수 메테오' },
  { id: 'M08_MELON', num: '08', gender: 'M', name: '메론빵', species: '메론빵 공룡', primary: '#BBF7D0', secondary: '#15803D', outfit: 'melon_hood', jellyCore: 'sparkle', ult: '메론빵 크러시' },
  { id: 'M09_TOTORING', num: '09', gender: 'M', name: '토토링', species: '롭이어 토끼', primary: '#FFFBEB', secondary: '#78350F', outfit: 'carrot_vest', jellyCore: 'heart', ult: '당근 폭격 샤워' },
  { id: 'M10_GAMJA', num: '10', gender: 'M', name: '감자콩', species: '아기 수달', primary: '#E6B89C', secondary: '#5C3A21', outfit: 'shell_brooch', jellyCore: 'bubble', ult: '온천 간헐천 웨이브' },
  // 여자 10종 (11~20)
  { id: 'F11_BERRY', num: '11', gender: 'F', name: '딸기찹', species: '딸기 토끼', primary: '#FCE7F3', secondary: '#9D174D', outfit: 'berry_beret', jellyCore: 'strawberry', ult: '생크림 딸기 해머' },
  { id: 'F12_LEMON', num: '12', gender: 'F', name: '혀니츄', species: '레몬 병아리', primary: '#FEF08A', secondary: '#A16207', outfit: 'ribbon_pin', jellyCore: 'sparkle', ult: '상큼 레몬 스매시' },
  { id: 'F13_PEACH', num: '13', gender: 'F', name: '복숭몽', species: '피치 고양이', primary: '#FECDD3', secondary: '#9F1239', outfit: 'leaf_ribbon', jellyCore: 'heart', ult: '피치 과즙 웨이브' },
  { id: 'F14_LAVENDU', num: '14', gender: 'F', name: '라벤듀', species: '연보라 아기양', primary: '#EDE9FE', secondary: '#6D28D9', outfit: 'flower_crown', jellyCore: 'sparkle', ult: '마시멜로 구름탄' },
  { id: 'F15_CHERRY', num: '15', gender: 'F', name: '체리퐁', species: '체리 햄스터', primary: '#FDA4AF', secondary: '#881337', outfit: 'cherry_pin', jellyCore: 'strawberry', ult: '메가 체리 스매시' },
  { id: 'F16_CHOUX', num: '16', gender: 'F', name: '슈크림', species: '말티즈', primary: '#FFFBEB', secondary: '#78350F', outfit: 'sky_apron', jellyCore: 'pudding', ult: '슈크림 폭신 스매시' },
  { id: 'F17_MACARON', num: '17', gender: 'F', name: '마카롱', species: '마카롱 펭귄', primary: '#A7F3D0', secondary: '#0F766E', outfit: 'pearl_band', jellyCore: 'sparkle', ult: '마카롱 더블 크러시' },
  { id: 'F18_STAR', num: '18', gender: 'F', name: '별사탕', species: '사막여우 요정', primary: '#FEF3C7', secondary: '#B45309', outfit: 'fairy_wings', jellyCore: 'star', ult: '황금 별사탕 샤워' },
  { id: 'F19_COTTON', num: '19', gender: 'F', name: '솜사탕', species: '파스텔 알파카', primary: '#FCE7F3', secondary: '#701A75', outfit: 'gold_bell', jellyCore: 'bubble', ult: '구름 솜사탕 웨이브' },
  { id: 'F20_MILKTEA', num: '20', gender: 'F', name: '밀크티', species: '밀크티 곰', primary: '#E6B89C', secondary: '#5C3A21', outfit: 'check_ribbon', jellyCore: 'boba', ult: '타피오카 버블붐' },
];

export const CHARACTERS = {};
RAW_SPIRITS.forEach((s, idx) => {
  CHARACTERS[s.id] = {
    id: s.id,
    num: s.num,
    gender: s.gender,
    name: s.name,
    species: s.species,
    primaryColor: s.primary,
    secondaryColor: s.secondary,
    outfit: s.outfit,
    jellyCore: s.jellyCore,
    defaultShell: DEFAULT_SHELLS[idx % DEFAULT_SHELLS.length],
    skillSlots: SKILL_SETS[idx % SKILL_SETS.length],
    ultimateName: s.ult,
    ultimateColor: '#F97316',
    maxHp: 120,
    maxFuel: 100,
  };
});

export const CHARACTER_LIST = Object.values(CHARACTERS);

// 하위 호환 별칭
CHARACTERS.TORI = CHARACTERS.M04_BAMTOL;
CHARACTERS.MOMO = CHARACTERS.M06_COCONYANG;
CHARACTERS.PPUKKU = CHARACTERS.M10_GAMJA;
CHARACTERS.DINO = CHARACTERS.M08_MELON;
CHARACTERS.LULU = CHARACTERS.M09_TOTORING;
CHARACTERS.CHICHI = CHARACTERS.F15_CHERRY;
CHARACTERS.BOBA = CHARACTERS.F20_MILKTEA;

export const GAME_MODES = {
  '1v1_ai': { id: '1v1_ai', label: '1:1 AI 대전' },
  '1v1_local': { id: '1v1_local', label: '1:1 친구 로컬' },
  '1v1v1_ffa': { id: '1v1v1_ffa', label: '1:1:1 삼파전 (혼합)' },
  '4p_ffa': { id: '4p_ffa', label: '1:1:1:1 4인 난투' },
  '2v2_team': { id: '2v2_team', label: '2:2 팀 공성전' },
};
