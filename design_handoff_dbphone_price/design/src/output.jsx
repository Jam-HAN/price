const Output = ({ go, selected, storage, rebateData, setStep, pushToast }) => {
  const [mode, setMode] = useState('net'); // 'net' | 'cust'
  const [carrier, setCarrier] = useState('A');
  const [contract, setContract] = useState('port');
  const [installMonths, setInstallMonths] = useState(24);

  const availableCarriers = CARRIERS.filter(c => rebateData.some(r => r.carrier === c.id));
  useEffect(()=>{ if(!availableCarriers.find(c=>c.id===carrier)) setCarrier(availableCarriers[0]?.id||'A'); }, [rebateData]);

  const rows = rebateData.filter(r => r.carrier===carrier && r.contract===contract);
  const costBasis = selected.ship - 80000;

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '단가표 생성', 'STEP 4']}
        title="단가표 출력 & 공유"
        actions={<>
          <button className="btn ghost" onClick={()=>{ setStep(3); go('editor'); }}>편집</button>
          <button className="btn ghost" onClick={()=> window.print()}><Icon name="print" size={14}/> 인쇄</button>
          <button className="btn ghost" onClick={()=> pushToast('이미지로 저장되었습니다 · /Downloads')}><Icon name="download" size={14}/> 이미지 저장</button>
          <button className="btn primary" onClick={()=> pushToast('단가표 링크가 복사되었습니다')}><Icon name="share" size={14}/> 공유하기</button>
        </>}
      />
      <Steps active={4}/>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16, padding: 14, display:'flex', alignItems:'center', gap: 14, flexWrap:'wrap' }}>
        <div className="seg" style={{ padding: 4 }}>
          <button className={mode==='net'?'on':''} onClick={()=>setMode('net')}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'#0b1020', marginRight:6, verticalAlign:'middle' }}/>
            넷가표 (내부용)
          </button>
          <button className={mode==='cust'?'on':''} onClick={()=>setMode('cust')}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'var(--blue)', marginRight:6, verticalAlign:'middle' }}/>
            고객용 단가표
          </button>
        </div>
        <div style={{ borderLeft: '1px solid var(--line)', height: 28 }}/>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <span style={{ fontSize: 12, color:'var(--ink-3)', fontWeight: 600, marginRight: 4 }}>통신사</span>
          <div className="seg">
            {availableCarriers.map(c=> (
              <button key={c.id} className={carrier===c.id?'on':''} onClick={()=>setCarrier(c.id)}>{c.name}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <span style={{ fontSize: 12, color:'var(--ink-3)', fontWeight: 600, marginRight: 4 }}>계약</span>
          <div className="seg">
            {CONTRACT_TYPES.map(ct => (
              <button key={ct.id} className={contract===ct.id?'on':''} onClick={()=>setContract(ct.id)}>{ct.short}</button>
            ))}
          </div>
        </div>
        {mode==='cust' && (
          <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
            <span style={{ fontSize: 12, color:'var(--ink-3)', fontWeight: 600, marginRight: 4 }}>할부</span>
            <div className="seg">
              {[24,30,36,48].map(m => (
                <button key={m} className={installMonths===m?'on':''} onClick={()=>setInstallMonths(m)}>{m}개월</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginLeft:'auto', fontSize: 12, color:'var(--ink-3)' }}>
          <span className="s-dot"/>실시간 미리보기
        </div>
      </div>

      {mode === 'net' ? (
        <NetSheet selected={selected} storage={storage} carrier={carrier} contract={contract} rows={rows} costBasis={costBasis}/>
      ) : (
        <CustSheet selected={selected} storage={storage} carrier={carrier} contract={contract} rows={rows} months={installMonths}/>
      )}
    </>
  );
};

const NetSheet = ({ selected, storage, carrier, contract, rows, costBasis }) => {
  const c = CARRIERS.find(x=>x.id===carrier);
  const ct = CONTRACT_TYPES.find(x=>x.id===contract);
  return (
    <div className="sheet net">
      <div className="sheet-hd">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
            <span className="chip ink">대외비</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily:'JetBrains Mono, monospace' }}>NET-2026-{String(selected.id).toUpperCase()}-{storage.replace('GB','').replace('TB','T')}</span>
          </div>
          <div className="title">넷가표 · {selected.name} {storage}</div>
          <div className="sub">{c.name} / {ct.label} · 대박통신 내부용 (원가/마진 포함)</div>
        </div>
        <div className="stamp">
          <div style={{ fontSize: 18, fontWeight: 800 }}>대박통신</div>
          <div className="mono">2026.04.21 발행</div>
          <div style={{ color: 'var(--lime)', marginTop: 4 }}>담당: 김민정</div>
        </div>
      </div>
      <div className="sheet-bd">
        {/* Summary bar */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          <div style={{ padding: 12, background:'#f5f7fb', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color:'var(--ink-3)', fontWeight: 700, letterSpacing:'0.06em', textTransform:'uppercase' }}>출고가</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 18 }}>₩{KRW(selected.ship)}</div>
          </div>
          <div style={{ padding: 12, background:'#ffeaf4', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color:'var(--pink)', fontWeight: 700, letterSpacing:'0.06em', textTransform:'uppercase' }}>사입가 (넷 기준)</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 18 }}>₩{KRW(costBasis)}</div>
          </div>
          <div style={{ padding: 12, background:'#eaf0ff', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color:'var(--blue-2)', fontWeight: 700, letterSpacing:'0.06em', textTransform:'uppercase' }}>평균 넷가</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 18 }}>₩{KRW(Math.round(rows.reduce((s,r)=> s + (selected.ship - r.gongsi - r.extra - r.rebate), 0)/Math.max(1,rows.length)))}</div>
          </div>
          <div style={{ padding: 12, background:'#f4ffc7', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color:'#4f5d07', fontWeight: 700, letterSpacing:'0.06em', textTransform:'uppercase' }}>평균 마진</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 18, color:'var(--ok)' }}>₩{KRW(Math.round(rows.reduce((s,r)=> s + (selected.ship - r.gongsi - r.extra - r.rebate - costBasis), 0)/Math.max(1,rows.length)))}</div>
          </div>
        </div>

        <table className="ps-table">
          <thead>
            <tr>
              <th className="left">요금제</th>
              <th>월요금</th>
              <th>공시</th>
              <th>추가</th>
              <th>리베이트</th>
              <th>지원 합계</th>
              <th>넷가</th>
              <th>마진</th>
              <th>마진율</th>
            </tr>
          </thead>
          <tbody>
            <tr className="group"><td colSpan={9}>■ 프리미엄 요금제 (7만원대 이상)</td></tr>
            {rows.filter(r => r.planPrice >= 70000).map((r,i) => {
              const sup = r.gongsi + r.extra + r.rebate;
              const net = selected.ship - sup;
              const margin = net - costBasis;
              const pct = ((margin/net)*100);
              return (
                <tr key={i}>
                  <td className="left">{r.planName}<br/><span style={{ color:'var(--ink-3)', fontSize:10 }}>{r.tier}</span></td>
                  <td>{KRW(r.planPrice)}</td>
                  <td>{KRW(r.gongsi)}</td>
                  <td>{KRW(r.extra)}</td>
                  <td style={{ fontWeight: 700 }}>{KRW(r.rebate)}</td>
                  <td>{KRW(sup)}</td>
                  <td style={{ fontWeight: 700 }}>{KRW(net)}</td>
                  <td className={`acc ${margin>=0?'pos':''}`}>{margin>=0?'+':''}{KRW(margin)}</td>
                  <td className={`${pct>=0?'':'acc'}`}>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
            <tr className="group"><td colSpan={9}>■ 스탠다드 요금제 (4~6만원대)</td></tr>
            {rows.filter(r => r.planPrice < 70000).map((r,i) => {
              const sup = r.gongsi + r.extra + r.rebate;
              const net = selected.ship - sup;
              const margin = net - costBasis;
              const pct = ((margin/net)*100);
              return (
                <tr key={i}>
                  <td className="left">{r.planName}<br/><span style={{ color:'var(--ink-3)', fontSize:10 }}>{r.tier}</span></td>
                  <td>{KRW(r.planPrice)}</td>
                  <td>{KRW(r.gongsi)}</td>
                  <td>{KRW(r.extra)}</td>
                  <td style={{ fontWeight: 700 }}>{KRW(r.rebate)}</td>
                  <td>{KRW(sup)}</td>
                  <td style={{ fontWeight: 700 }}>{KRW(net)}</td>
                  <td className={`acc ${margin>=0?'pos':''}`}>{margin>=0?'+':''}{KRW(margin)}</td>
                  <td className={`${pct>=0?'':'acc'}`}>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 20, padding: 14, borderTop: '2px solid #0b1020', display:'flex', justifyContent:'space-between', fontSize: 11, color:'var(--ink-2)' }}>
          <div>
            <b>📌 조건</b> · 6개월 요금제 유지 · 부가서비스 2종 필수 · 위약금 면제 조건 포함
          </div>
          <div style={{ textAlign:'right', color:'var(--ink-3)' }}>
            본 자료는 대외비이며 유출 시 법적 책임이 따를 수 있습니다
          </div>
        </div>
      </div>
    </div>
  );
};

const CustSheet = ({ selected, storage, carrier, contract, rows, months }) => {
  const c = CARRIERS.find(x=>x.id===carrier);
  const ct = CONTRACT_TYPES.find(x=>x.id===contract);
  return (
    <div className="sheet cust">
      <div className="sheet-hd">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, background:'#fff', color:'var(--blue)', padding:'3px 10px', borderRadius: 99, fontWeight: 800 }}>고객용 단가표</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{months}개월 할부 기준</span>
          </div>
          <div className="title">{selected.name}</div>
          <div className="sub">{storage} · {c.name} · {ct.label}</div>
        </div>
        <div className="stamp" style={{ textAlign:'right' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10, background: 'rgba(255,255,255,0.15)', padding: '10px 14px', borderRadius: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 50, background: 'linear-gradient(135deg, #d4ff3f, #3fe0b0)', display:'grid', placeItems:'center', fontWeight:800, color:'#0b1020' }}>대</div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>대박통신</div>
              <div style={{ fontSize: 10, opacity:0.8 }}>문의 02-123-4567</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 26px', marginTop: -16 }}>
        <div style={{ background:'#fff', borderRadius: 14, padding: 18, boxShadow:'0 4px 16px -8px rgba(33,82,255,0.3)', display:'flex', alignItems:'center', gap: 18 }}>
          <div style={{ width: 80, height: 110, borderRadius: 10, background: `linear-gradient(135deg, ${selected.accent}22, ${selected.accent}08)`, display:'grid', placeItems:'center' }}>
            <svg width="50" height="80" viewBox="0 0 60 90">
              <rect x="4" y="2" width="52" height="86" rx="8" fill="#0b1020"/>
              <rect x="7" y="8" width="46" height="74" rx="3" fill={selected.accent}/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color:'var(--ink-3)', fontWeight: 700 }}>이 달의 추천</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>최저 월 {KRW(Math.round(Math.min(...rows.map(r=> (selected.ship - r.gongsi - r.extra - r.rebate)/months + r.planPrice))/100)*100)}원으로 시작하세요</div>
            <div style={{ fontSize: 12, color:'var(--ink-3)', marginTop: 4 }}>기기할부금 + 월 요금 포함 · 공시지원금 적용가 기준</div>
          </div>
          <div style={{ fontSize: 11, color:'var(--ink-3)' }}>※ 세부 조건은 약관 확인</div>
        </div>
      </div>

      <div className="sheet-bd">
        <table className="ps-table cust">
          <thead>
            <tr>
              <th className="left">요금제</th>
              <th>월 요금</th>
              <th>공시지원금</th>
              <th>추가지원금</th>
              <th>할부원금</th>
              <th>월 할부금</th>
              <th>총 월 납부액</th>
            </tr>
          </thead>
          <tbody>
            <tr className="group"><td colSpan={7}>★ 추천 요금제</td></tr>
            {rows.filter(r => r.planPrice >= 70000).map((r,i)=>{
              const disc = r.gongsi + r.extra;
              const principal = Math.max(0, selected.ship - disc);
              const monthly = Math.round(principal / months / 10) * 10;
              const total = monthly + r.planPrice;
              return (
                <tr key={i}>
                  <td className="left">
                    {r.planName}
                    {r.tier==='t8' && <span className="badge-new" style={{ marginLeft: 6 }}>BEST</span>}
                  </td>
                  <td>{KRW(r.planPrice)}원</td>
                  <td>-{KRW(r.gongsi)}</td>
                  <td>-{KRW(r.extra)}</td>
                  <td>{KRW(principal)}</td>
                  <td style={{ fontWeight: 700 }}>{KRW(monthly)}원</td>
                  <td style={{ fontWeight: 800, color: 'var(--blue-2)' }}>{KRW(total)}원</td>
                </tr>
              );
            })}
            <tr className="group"><td colSpan={7}>일반 요금제</td></tr>
            {rows.filter(r => r.planPrice < 70000).map((r,i)=>{
              const disc = r.gongsi + r.extra;
              const principal = Math.max(0, selected.ship - disc);
              const monthly = Math.round(principal / months / 10) * 10;
              const total = monthly + r.planPrice;
              return (
                <tr key={i}>
                  <td className="left">{r.planName}</td>
                  <td>{KRW(r.planPrice)}원</td>
                  <td>-{KRW(r.gongsi)}</td>
                  <td>-{KRW(r.extra)}</td>
                  <td>{KRW(principal)}</td>
                  <td style={{ fontWeight: 700 }}>{KRW(monthly)}원</td>
                  <td style={{ fontWeight: 800, color:'var(--blue-2)' }}>{KRW(total)}원</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 18, display:'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ padding: 14, background:'#eaf0ff', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color:'var(--blue-2)', fontWeight: 800, marginBottom: 4 }}>📞 상담 문의</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>02-123-4567</div>
            <div style={{ fontSize: 11, color:'var(--ink-3)' }}>평일 10:00 - 20:00</div>
          </div>
          <div style={{ padding: 14, background:'#f4ffc7', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color:'#4f5d07', fontWeight: 800, marginBottom: 4 }}>🎁 가입 혜택</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>액정보험 3개월 무료</div>
            <div style={{ fontSize: 11, color:'var(--ink-3)' }}>당일 개통 시 추가 증정</div>
          </div>
          <div style={{ padding: 14, background:'#ffeaf4', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--pink)', fontWeight: 800, marginBottom: 4 }}>🚚 배송</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>당일 출고 가능</div>
            <div style={{ fontSize: 11, color:'var(--ink-3)' }}>오후 2시 이전 주문 시</div>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color:'var(--ink-3)', lineHeight: 1.6 }}>
          ※ 본 단가표는 2026.04.21 기준이며 통신사 정책에 따라 변경될 수 있습니다 · 6개월 요금제 유지 조건 · 부가서비스 가입 조건 · VAT 포함
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Output });
