const Editor = ({ go, selected, storage, rebateData, setRebateData, setStep, pushToast }) => {
  const [tab, setTab] = useState('A');
  const [showMargin, setShowMargin] = useState(true);
  const [costBasis, setCostBasis] = useState(selected.ship - 80000); // 대박통신 사입가

  const availableCarriers = CARRIERS.filter(c => rebateData.some(r => r.carrier === c.id));
  useEffect(()=>{ if(!availableCarriers.find(c=>c.id===tab)) setTab(availableCarriers[0]?.id || 'A'); }, [rebateData]);

  const updateCell = (carrier, tier, contract, field, value) => {
    setRebateData(prev => prev.map(r => {
      if(r.carrier===carrier && r.tier===tier && r.contract===contract){
        const n = parseInt(String(value).replace(/[^0-9-]/g,''), 10);
        return { ...r, [field]: isNaN(n) ? 0 : n };
      }
      return r;
    }));
  };

  const rows = rebateData.filter(r => r.carrier === tab);

  // Compute net price (넷가) = 출고가 - 공시 - 추가 - 리베이트 + 부가서비스 등 (간단화)
  const compute = (r) => {
    const totalSupport = (r.gongsi||0) + (r.extra||0) + (r.rebate||0);
    const netPrice = selected.ship - totalSupport;
    const margin = netPrice - costBasis;
    return { totalSupport, netPrice, margin };
  };

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '단가표 생성', 'STEP 3']}
        title="파싱 결과를 확인하고 편집하세요"
        actions={<>
          <button className="btn ghost" onClick={()=>{ setStep(2); go('upload'); }}>이전</button>
          <button className="btn primary" onClick={()=>{ setStep(4); go('output'); pushToast('단가표가 생성되었습니다'); }}>
            단가표 생성 <Icon name="arrowRight" size={16}/>
          </button>
        </>}
      />
      <Steps active={3}/>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span className="pill">출고가</span>
          <div className="label">단말기 출고가</div>
          <div className="value num" style={{ fontSize: 22 }}>₩{KRW(selected.ship)}</div>
          <div className="delta" style={{ color:'var(--ink-3)' }}>{selected.name} · {storage}</div>
        </div>
        <div className="stat">
          <span className="pill" style={{ background:'#ffeaf4', color:'var(--pink)' }}>사입가</span>
          <div className="label">대박통신 매입가 (넷 기준)</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, marginTop: 6, display:'flex', alignItems:'center', gap: 4 }}>
            ₩
            <input className="cell" style={{ width: 130, padding: 2, border:'1px dashed #ffc7e0', background:'transparent', fontWeight: 800 }}
              value={KRW(costBasis)} onChange={e=>{ const n = parseInt(e.target.value.replace(/[^0-9]/g,''),10); setCostBasis(isNaN(n)?0:n); }}/>
          </div>
          <div className="delta" style={{ color:'var(--ink-3)' }}>출고가 대비 -₩{KRW(selected.ship-costBasis)}</div>
        </div>
        <div className="stat">
          <span className="pill" style={{ background:'#f4ffc7', color:'#4f5d07' }}>행</span>
          <div className="label">파싱된 요금제 행</div>
          <div className="value num" style={{ fontSize: 22 }}>{rebateData.length}</div>
          <div className="delta">✓ 자동 추출 완료</div>
        </div>
        <div className="stat">
          <span className="pill" style={{ background:'#ddfbf1', color: 'var(--mint)'}}>평균 마진</span>
          <div className="label">예상 평균 마진</div>
          <div className="value num" style={{ fontSize: 22, color: 'var(--ok)' }}>
            ₩{KRW(Math.round(rows.reduce((s,r)=> s+ compute(r).margin, 0)/Math.max(1,rows.length)))}
          </div>
          <div className="delta">번이 평균 기준</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <h3>리베이트 매트릭스 편집</h3>
            <Chip tone="blue" dot={false}>드래그로 복사 · 엔터로 확정</Chip>
          </div>
          <div className="toolbar">
            <div className="seg">
              {availableCarriers.map(c => (
                <button key={c.id} className={tab===c.id?'on':''} onClick={()=>setTab(c.id)}>{c.name}</button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 8, fontSize: 12 }}>
              <span>마진/넷가 표시</span>
              <Switch on={showMargin} onChange={setShowMargin}/>
            </div>
          </div>
        </div>
        <div style={{ padding: 0, overflow:'auto', maxHeight: 560 }}>
          <table className="edit-t">
            <thead>
              <tr>
                <th className="left" style={{ minWidth: 170 }}>요금제</th>
                <th style={{ minWidth: 80 }}>월 요금</th>
                <th>공시지원금</th>
                <th>추가지원금</th>
                <th>리베이트<br/><span style={{ fontSize:10, color:'var(--ink-3)', textTransform:'none', letterSpacing:0 }}>신규</span></th>
                <th>리베이트<br/><span style={{ fontSize:10, color:'var(--ink-3)', textTransform:'none', letterSpacing:0 }}>번이</span></th>
                <th>리베이트<br/><span style={{ fontSize:10, color:'var(--ink-3)', textTransform:'none', letterSpacing:0 }}>기변</span></th>
                {showMargin && <>
                  <th style={{ background:'#eaf0ff', color:'var(--blue-2)' }}>넷가<br/><span style={{ fontSize:10, textTransform:'none', letterSpacing:0 }}>(번이)</span></th>
                  <th style={{ background:'#f4ffc7', color:'#4f5d07' }}>마진<br/><span style={{ fontSize:10, textTransform:'none', letterSpacing:0 }}>(번이)</span></th>
                </>}
              </tr>
            </thead>
            <tbody>
              {PLAN_TIERS.map(pt => {
                const plan = PLANS.find(p => p.carrier===tab && p.tier===pt.id);
                if(!plan) return null;
                const rowN = rows.find(r => r.tier===pt.id && r.contract==='new');
                const rowP = rows.find(r => r.tier===pt.id && r.contract==='port');
                const rowC = rows.find(r => r.tier===pt.id && r.contract==='change');
                if(!rowP) return null;
                const { netPrice, margin } = compute(rowP);
                return (
                  <tr key={pt.id}>
                    <td className="left">
                      <div style={{ fontWeight: 700 }}>{plan.name}</div>
                      <div style={{ fontSize: 10, color:'var(--ink-3)', marginTop: 2 }}>{pt.label} · {plan.carrier}</div>
                    </td>
                    <td className="mono" style={{ color:'var(--ink-3)' }}>{KRW(pt.price)}</td>
                    <td><input className="cell" value={KRW(rowP.gongsi)} onChange={e=> updateCell(tab, pt.id, 'port', 'gongsi', e.target.value)}/></td>
                    <td><input className="cell" value={KRW(rowP.extra)} onChange={e=> updateCell(tab, pt.id, 'port', 'extra', e.target.value)}/></td>
                    <td><input className="cell" value={KRW(rowN.rebate)} onChange={e=> updateCell(tab, pt.id, 'new', 'rebate', e.target.value)}/></td>
                    <td style={{ background: '#fff7d0' }}><input className="cell" style={{ fontWeight:700 }} value={KRW(rowP.rebate)} onChange={e=> updateCell(tab, pt.id, 'port', 'rebate', e.target.value)}/></td>
                    <td><input className="cell" value={KRW(rowC.rebate)} onChange={e=> updateCell(tab, pt.id, 'change', 'rebate', e.target.value)}/></td>
                    {showMargin && <>
                      <td className="highlight mono" style={{ background:'#eaf0ff', color:'var(--blue-2)', fontWeight: 800 }}>₩{KRW(netPrice)}</td>
                      <td className="highlight mono" style={{ color: margin>=0? 'var(--ok)':'var(--red)', fontWeight: 800 }}>{margin>=0?'+':''}{KRW(margin)}</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center', background: '#fafbff' }}>
          <div style={{ fontSize: 12, color:'var(--ink-3)', display:'flex', gap: 18 }}>
            <span><span style={{ display:'inline-block', width:10, height:10, background:'#fff7d0', border:'1px solid #ffe78b', marginRight:6, verticalAlign:'middle' }}/>번이 리베이트(핵심)</span>
            <span><span style={{ display:'inline-block', width:10, height:10, background:'#eaf0ff', border:'1px solid #d7e1ff', marginRight:6, verticalAlign:'middle' }}/>계산 결과</span>
            <span><span style={{ display:'inline-block', width:10, height:10, background:'#f4ffc7', border:'1px solid #e8f79a', marginRight:6, verticalAlign:'middle' }}/>마진 컬럼</span>
          </div>
          <div style={{ display:'flex', gap: 8 }}>
            <button className="btn sm ghost"><Icon name="copy" size={12}/> 다른 통신사로 복사</button>
            <button className="btn sm ghost"><Icon name="sparkle" size={12}/> AI로 보정</button>
          </div>
        </div>
      </div>
    </>
  );
};
window.Editor = Editor;
