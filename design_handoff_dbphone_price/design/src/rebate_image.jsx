// Fake rebate "sheet" image rendered via SVG — simulates a real rebate paper
const RebateImage = ({ model, carrier='A', variant=0 }) => {
  const c = CARRIERS.find(x => x.id===carrier);
  const rows = PLAN_TIERS.slice(0, 5);
  const title = `${c.name} ${model.name} ${model.storages[0]} 리베이트표`;
  return (
    <svg viewBox="0 0 800 520" className="rebate-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="paper" patternUnits="userSpaceOnUse" width="8" height="8">
          <rect width="8" height="8" fill="#fdfcf5"/>
          <circle cx="1" cy="1" r="0.4" fill="#eae4c5"/>
        </pattern>
      </defs>
      <rect width="800" height="520" fill="url(#paper)"/>
      {/* Title bar */}
      <rect x="0" y="0" width="800" height="58" fill={c.color} opacity="0.92"/>
      <text x="24" y="36" fill="#fff" fontFamily="Pretendard Variable, sans-serif" fontSize="20" fontWeight="800">{title}</text>
      <text x="776" y="36" fill="#fff" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="11" opacity="0.8">2026.04.21 / 정책 v4</text>

      {/* Subtitle */}
      <text x="24" y="84" fill="#333" fontFamily="Pretendard Variable, sans-serif" fontSize="12">※ 하기 금액은 공시/추가지원금 + 유통망 리베이트 합산 (단위: 원)</text>

      {/* Column headers */}
      <g fontFamily="Pretendard Variable, sans-serif" fontSize="12" fontWeight="700">
        <rect x="24" y="100" width="752" height="30" fill="#f0e8c0"/>
        <text x="40" y="120" fill="#2b2a1e">요금제</text>
        <text x="220" y="120" fill="#2b2a1e">신규</text>
        <text x="310" y="120" fill="#2b2a1e">번이</text>
        <text x="400" y="120" fill="#2b2a1e">기변</text>
        <text x="490" y="120" fill="#2b2a1e">공시</text>
        <text x="590" y="120" fill="#2b2a1e">추가</text>
        <text x="680" y="120" fill="#2b2a1e">합계</text>
      </g>

      {/* Rows */}
      {rows.map((pt, i) => {
        const y = 140 + i*56;
        const plan = PLANS.find(p => p.carrier===carrier && p.tier===pt.id);
        const seed = variant + i + carrier.charCodeAt(0);
        const n = (a,b) => Math.round((Math.sin(seed*13.7 + a)*0.5+0.5) * (b-a/2) + a);
        const newR = 320000 + (5-i)*40000 + (seed%7)*1000;
        const portR = newR + 60000;
        const chgR = newR - 45000;
        const gs = 480000 + (5-i)*35000;
        const ex = Math.round(gs*0.15/1000)*1000;
        const total = Math.max(newR, portR, chgR) + gs + ex;
        return (
          <g key={i} fontFamily="Pretendard Variable, sans-serif" fontSize="13">
            {i%2===0 && <rect x="24" y={y-20} width="752" height="50" fill="#fff" opacity="0.7"/>}
            <text x="40" y={y} fill="#2b2a1e" fontWeight="700">{plan?.name || pt.label}</text>
            <text x="40" y={y+16} fill="#6b6850" fontSize="11">월 {KRW(pt.price)}원</text>
            <text x="280" y={y+4} textAnchor="end" fill="#2b2a1e" fontFamily="JetBrains Mono, monospace" fontWeight="600">{KRW(newR)}</text>
            <text x="370" y={y+4} textAnchor="end" fill="#c00" fontFamily="JetBrains Mono, monospace" fontWeight="700">{KRW(portR)}</text>
            <text x="460" y={y+4} textAnchor="end" fill="#2b2a1e" fontFamily="JetBrains Mono, monospace" fontWeight="600">{KRW(chgR)}</text>
            <text x="560" y={y+4} textAnchor="end" fill="#2b2a1e" fontFamily="JetBrains Mono, monospace">{KRW(gs)}</text>
            <text x="650" y={y+4} textAnchor="end" fill="#2b2a1e" fontFamily="JetBrains Mono, monospace">{KRW(ex)}</text>
            <text x="760" y={y+4} textAnchor="end" fill="#2152ff" fontFamily="JetBrains Mono, monospace" fontWeight="800">{KRW(total)}</text>
            <line x1="24" y1={y+30} x2="776" y2={y+30} stroke="#d6cf9d" strokeWidth="0.5"/>
          </g>
        );
      })}

      {/* Footer */}
      <g opacity="0.7">
        <rect x="24" y="440" width="752" height="60" fill="#fff" stroke="#d6cf9d"/>
        <text x="36" y="462" fontFamily="Pretendard Variable, sans-serif" fontSize="11" fill="#555">• 6개월 요금제 유지 의무 / 부가서비스 2종 가입 조건</text>
        <text x="36" y="478" fontFamily="Pretendard Variable, sans-serif" fontSize="11" fill="#555">• 추가지원금은 공시지원금의 15% 이내에서 지급 가능</text>
        <text x="36" y="494" fontFamily="Pretendard Variable, sans-serif" fontSize="11" fill="#555">• 본 자료는 대외비이며 유출 시 법적 책임이 따를 수 있습니다</text>
      </g>

      {/* Stamp */}
      <g transform="translate(680, 430) rotate(-8)">
        <circle cx="40" cy="40" r="38" fill="none" stroke={c.color} strokeWidth="3" opacity="0.7"/>
        <text x="40" y="36" textAnchor="middle" fill={c.color} fontFamily="Pretendard Variable, sans-serif" fontSize="11" fontWeight="800" opacity="0.8">CONFIDENTIAL</text>
        <text x="40" y="52" textAnchor="middle" fill={c.color} fontFamily="Pretendard Variable, sans-serif" fontSize="9" opacity="0.8">{c.name}</text>
      </g>
    </svg>
  );
};
window.RebateImage = RebateImage;
