// Mock data for 대박통신 단가표 시스템
// Using generic carrier names (A/B/C) to avoid trademarked branding.

const CARRIERS = [
  { id: 'A', name: 'A텔레콤', color: '#d71f30', bg: '#ffeef0' },
  { id: 'B', name: 'B모바일', color: '#a36a00', bg: '#fff3da' },
  { id: 'C', name: 'C유플', color: '#0a59c7', bg: '#e8f4ff' },
];

const CONTRACT_TYPES = [
  { id: 'new', label: '신규', short: '신규', color: 'mint' },
  { id: 'port', label: '번호이동', short: '번이', color: 'pink' },
  { id: 'change', label: '기기변경', short: '기변', color: 'blue' },
];

const PLAN_TIERS = [
  { id: 't9', label: '9만원대', price: 99000 },
  { id: 't8', label: '8만원대', price: 89000 },
  { id: 't7', label: '7만원대', price: 79000 },
  { id: 't6', label: '6만원대', price: 69000 },
  { id: 't5', label: '5만원대', price: 55000 },
  { id: 't4', label: '4만원대', price: 45000 },
];

const MODELS = [
  {
    id: 'm1', name: 'Galaxy S Ultra', code: 'SM-S938',
    brand: 'Samsung', year: 2026, ship: 1_798_600,
    storages: ['256GB', '512GB', '1TB'], colors: ['Titanium Black','Silver','Blue'],
    tag: 'new', accent: '#7a9bff',
  },
  {
    id: 'm2', name: 'Galaxy Z Flip', code: 'SM-F741',
    brand: 'Samsung', year: 2026, ship: 1_487_200,
    storages: ['256GB', '512GB'], colors: ['Mint','Yellow','Pink'],
    tag: 'hot', accent: '#3fe0b0',
  },
  {
    id: 'm3', name: 'Galaxy Z Fold', code: 'SM-F961',
    brand: 'Samsung', year: 2026, ship: 2_398_000,
    storages: ['256GB', '512GB', '1TB'], colors: ['Black','White'],
    tag: 'premium', accent: '#0b1020',
  },
  {
    id: 'm4', name: 'Galaxy S FE', code: 'SM-S721',
    brand: 'Samsung', year: 2025, ship: 948_200,
    storages: ['128GB', '256GB'], colors: ['Mint','Gray','Blue','Yellow'],
    tag: 'value', accent: '#d4ff3f',
  },
  {
    id: 'm5', name: 'Pixel 10 Pro', code: 'G5P-X01',
    brand: 'Google', year: 2026, ship: 1_550_000,
    storages: ['128GB', '256GB', '512GB'], colors: ['Obsidian','Porcelain','Hazel'],
    tag: 'new', accent: '#ff5fae',
  },
  {
    id: 'm6', name: 'Xperia 1', code: 'XQ-EC72',
    brand: 'Sony', year: 2026, ship: 1_690_000,
    storages: ['256GB','512GB'], colors: ['Black','Platinum'],
    tag: '', accent: '#ffd84a',
  },
];

// Plans per carrier (generic names)
const PLANS = [
  { carrier:'A', tier:'t9', name:'프리미엄 언리미티드 9',  price: 99000 },
  { carrier:'A', tier:'t8', name:'5GX 플래티넘 8',        price: 89000 },
  { carrier:'A', tier:'t7', name:'5GX 프라임 7',           price: 79000 },
  { carrier:'A', tier:'t6', name:'5GX 스탠다드 6',         price: 69000 },
  { carrier:'A', tier:'t5', name:'5GX 라이트 5',           price: 55000 },
  { carrier:'B', tier:'t9', name:'슈퍼플랜 초이스 9',       price: 99000 },
  { carrier:'B', tier:'t8', name:'슈퍼플랜 베이직 8',       price: 89000 },
  { carrier:'B', tier:'t7', name:'Y무제한 7',              price: 79000 },
  { carrier:'B', tier:'t6', name:'5G 슬림 6',              price: 69000 },
  { carrier:'C', tier:'t9', name:'5G 프리미어 9',          price: 99000 },
  { carrier:'C', tier:'t8', name:'5G 시그니처 8',          price: 89000 },
  { carrier:'C', tier:'t7', name:'5G 스탠다드 7',          price: 79000 },
  { carrier:'C', tier:'t6', name:'5G 슈퍼 6',              price: 69000 },
];

// Default rebate matrix for a given model
// Rows = (carrier x contract x plan-tier), values KRW
function defaultRebateFor(model){
  const rows = [];
  const base = model.ship;
  CARRIERS.forEach(c => {
    CONTRACT_TYPES.forEach(ct => {
      PLAN_TIERS.forEach(pt => {
        // public support (공시) varies by tier
        const gongsi = Math.round((pt.price / 99000) * (c.id==='A'? 560000: c.id==='B'? 520000: 600000) / 1000) * 1000;
        // extra support (추가지원)
        const extra = Math.round(gongsi * 0.15 / 1000) * 1000;
        // rebate to store (리베이트)
        const baseReb = c.id==='A' ? 380000 : c.id==='B'? 420000 : 460000;
        const reb = Math.round((pt.price / 79000) * baseReb * (ct.id==='port'? 1.12 : ct.id==='new'? 1.05 : 0.92) / 1000) * 1000;
        rows.push({
          carrier: c.id, contract: ct.id, tier: pt.id,
          gongsi, extra, rebate: reb,
          planName: PLANS.find(p => p.carrier===c.id && p.tier===pt.id)?.name || '',
          planPrice: pt.price,
        });
      });
    });
  });
  return rows;
}

// Recent price sheets for history
const HISTORY = [
  { id:'ps1', model:'Galaxy S Ultra 256GB', date:'2026-04-20', time:'14:32', carrier:'A', creator:'김민정', status:'published', views: 48, deals: 7 },
  { id:'ps2', model:'Galaxy Z Flip 512GB', date:'2026-04-20', time:'11:04', carrier:'B', creator:'박서준', status:'draft', views: 12, deals: 0 },
  { id:'ps3', model:'Pixel 10 Pro 256GB', date:'2026-04-19', time:'17:21', carrier:'C', creator:'이다은', status:'published', views: 31, deals: 4 },
  { id:'ps4', model:'Galaxy S Ultra 512GB', date:'2026-04-19', time:'10:08', carrier:'A', creator:'김민정', status:'published', views: 92, deals: 14 },
  { id:'ps5', model:'Galaxy Z Fold 1TB', date:'2026-04-18', time:'16:45', carrier:'A', creator:'최태양', status:'archived', views: 67, deals: 9 },
  { id:'ps6', model:'Galaxy S FE 256GB', date:'2026-04-18', time:'09:15', carrier:'B', creator:'박서준', status:'published', views: 24, deals: 3 },
  { id:'ps7', model:'Xperia 1 256GB', date:'2026-04-17', time:'13:50', carrier:'C', creator:'이다은', status:'archived', views: 18, deals: 2 },
];

const ACTIVITY = [
  { who:'김민정', action:'Galaxy S Ultra 256GB 단가표 발행', when:'방금 전', type:'publish' },
  { who:'박서준', action:'Galaxy Z Flip 512GB 리베이트 업로드', when:'12분 전', type:'upload' },
  { who:'이다은', action:'Pixel 10 Pro 256GB 고객용 단가표 공유', when:'1시간 전', type:'share' },
  { who:'최태양', action:'Galaxy Z Fold 1TB 단가표 아카이브', when:'2시간 전', type:'archive' },
  { who:'김민정', action:'Galaxy S Ultra 512GB 단가표 수정', when:'오전 10:40', type:'edit' },
];

const KRW = n => (n == null || isNaN(n)) ? '-' : n.toLocaleString('ko-KR');
const KRW_sign = n => { if(n == null || isNaN(n)) return '-'; const s = n<0?'-':''; return s + Math.abs(n).toLocaleString('ko-KR'); };

Object.assign(window, {
  CARRIERS, CONTRACT_TYPES, PLAN_TIERS, MODELS, PLANS, HISTORY, ACTIVITY,
  defaultRebateFor, KRW, KRW_sign,
});
