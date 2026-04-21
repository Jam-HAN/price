const Models = ({ go, selected, setSelected, setStep, setStorage, storage }) => {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = MODELS.filter(m => {
    if(query && !m.name.toLowerCase().includes(query.toLowerCase())) return false;
    if(brand !== 'all' && m.brand !== brand) return false;
    return true;
  });

  const pick = (m) => {
    setSelected(m);
    setStorage(m.storages[0]);
  };

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '단가표 생성', 'STEP 1']}
        title="단가표를 만들 단말기를 선택하세요"
        actions={<>
          <button className="btn ghost" onClick={()=> setAddOpen(true)}><Icon name="plus" size={16}/> 단말기 등록</button>
          <button className={`btn primary ${!selected?'':''}`} disabled={!selected} style={{ opacity: selected? 1: 0.4, cursor: selected? 'pointer':'not-allowed' }} onClick={()=>{ if(selected){ setStep(2); go('upload'); }}}>
            다음: 리베이트 업로드 <Icon name="arrowRight" size={16}/>
          </button>
        </>}
      />

      <Steps active={1}/>

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="card" style={{ gridColumn: 'span 4', padding: '14px 18px', display:'flex', alignItems:'center', gap: 12 }}>
          <div style={{ position:'relative', flex: 1, maxWidth: 360 }}>
            <Icon name="search" size={16} className="" />
            <input className="input" placeholder="모델명 또는 모델코드로 검색" value={query} onChange={e=>setQuery(e.target.value)} style={{ paddingLeft: 36 }}/>
            <div style={{ position:'absolute', left: 12, top: '50%', transform:'translateY(-50%)', color:'var(--ink-3)' }}>
              <Icon name="search" size={16}/>
            </div>
          </div>
          <div className="seg">
            <button className={brand==='all'?'on':''} onClick={()=>setBrand('all')}>전체</button>
            <button className={brand==='Samsung'?'on':''} onClick={()=>setBrand('Samsung')}>Samsung</button>
            <button className={brand==='Google'?'on':''} onClick={()=>setBrand('Google')}>Google</button>
            <button className={brand==='Sony'?'on':''} onClick={()=>setBrand('Sony')}>Sony</button>
          </div>
          <button className="btn ghost sm" style={{ marginLeft:'auto' }}><Icon name="filter" size={14}/> 필터</button>
          <div style={{ fontSize: 12, color:'var(--ink-3)' }}>총 <b className="num" style={{ color:'var(--ink)'}}>{filtered.length}</b>개</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected? '1.6fr 1fr': '1fr', gap: 16 }}>
        <div className="grid-3" style={{ alignContent:'start' }}>
          {filtered.map(m => (
            <div key={m.id} className={`model-card ${selected?.id===m.id?'on':''}`} onClick={()=>pick(m)}>
              {m.tag && <span style={{ position:'absolute', top: 14, right: 14, fontSize: 10, padding: '3px 7px', borderRadius: 99, fontWeight:800,
                background: m.tag==='new'?'var(--lime)': m.tag==='hot'?'var(--pink)': m.tag==='premium'?'var(--ink)':'var(--yellow)',
                color: m.tag==='premium'?'#fff': m.tag==='hot'?'#fff':'#0b1020'
              }}>{m.tag==='new'?'NEW': m.tag==='hot'?'HOT': m.tag==='premium'?'PREMIUM':'VALUE'}</span>}
              <div className="img" style={{ background: `linear-gradient(135deg, ${m.accent}22, ${m.accent}08)` }}>
                <svg width="60" height="90" viewBox="0 0 60 90">
                  <rect x="4" y="2" width="52" height="86" rx="8" fill="#0b1020"/>
                  <rect x="7" y="8" width="46" height="74" rx="3" fill={m.accent} opacity="0.85"/>
                  <rect x="26" y="5" width="8" height="2" rx="1" fill="#2a2a2a"/>
                  <text x="30" y="50" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="800" fontFamily="Pretendard Variable">{m.brand[0]}</text>
                </svg>
              </div>
              <div className="name">{m.name}</div>
              <div className="meta">{m.code} · {m.brand} · {m.year}</div>
              <div className="stor">
                {m.storages.map(s => <span key={s}>{s}</span>)}
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>출고가</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: 13 }}>₩{KRW(m.ship)}</span>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ position: 'sticky', top: 22, alignSelf: 'start' }}>
            <div className="card">
              <div className="card-h">
                <h3>선택한 단말기</h3>
                <button className="btn sm ghost" onClick={()=>setSelected(null)}><Icon name="x" size={12}/></button>
              </div>
              <div className="card-b">
                <div style={{ background: `linear-gradient(135deg, ${selected.accent}22, ${selected.accent}05)`, borderRadius: 14, padding: 20, textAlign:'center', marginBottom: 16 }}>
                  <svg width="100" height="140" viewBox="0 0 100 140" style={{ margin: '0 auto', display:'block' }}>
                    <rect x="8" y="4" width="84" height="132" rx="14" fill="#0b1020"/>
                    <rect x="12" y="14" width="76" height="112" rx="6" fill={selected.accent} opacity="0.9"/>
                    <rect x="44" y="8" width="12" height="3" rx="1.5" fill="#2a2a2a"/>
                    <text x="50" y="80" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Pretendard Variable">{selected.brand[0]}</text>
                  </svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color:'var(--ink-3)', marginTop: 2 }}>{selected.code} · {selected.brand}</div>

                <hr style={{ border:'none', borderTop:'1px solid var(--line)', margin:'16px 0' }}/>

                <label className="label">용량</label>
                <div style={{ display:'flex', gap: 6, marginBottom: 14 }}>
                  {selected.storages.map(s => (
                    <button key={s} onClick={()=>setStorage(s)} style={{
                      padding:'8px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                      border: storage===s? '2px solid var(--blue)':'1px solid var(--line)',
                      background: storage===s? 'var(--blue-soft)':'#fff',
                      color: storage===s? 'var(--blue-2)': 'var(--ink)',
                    }}>{s}</button>
                  ))}
                </div>

                <label className="label">색상</label>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap', marginBottom: 14 }}>
                  {selected.colors.map(c => (
                    <span key={c} style={{ fontSize: 11, padding:'4px 10px', background:'#f1f4fa', borderRadius: 99, color: 'var(--ink-2)' }}>{c}</span>
                  ))}
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', padding: '10px 0', borderTop: '1px dashed var(--line)' }}>
                  <span style={{ fontSize: 13, color:'var(--ink-2)' }}>출고가</span>
                  <span className="mono" style={{ fontWeight: 800 }}>₩{KRW(selected.ship)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)}>
        <div className="card-h"><h3>신규 단말기 등록</h3><button onClick={()=>setAddOpen(false)} className="btn sm ghost"><Icon name="x" size={14}/></button></div>
        <div className="card-b">
          <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
            <div><label className="label">모델명</label><input className="input" placeholder="예: Galaxy S Ultra"/></div>
            <div><label className="label">모델 코드</label><input className="input" placeholder="예: SM-S938"/></div>
            <div><label className="label">제조사</label><input className="input" placeholder="Samsung"/></div>
            <div><label className="label">출고가 (원)</label><input className="input" placeholder="1,798,600"/></div>
          </div>
          <label className="label">용량 옵션 (콤마 구분)</label>
          <input className="input" placeholder="256GB, 512GB, 1TB" style={{ marginBottom: 12 }}/>
          <label className="label">색상 옵션 (콤마 구분)</label>
          <input className="input" placeholder="Titanium Black, Silver, Blue" style={{ marginBottom: 16 }}/>
          <div style={{ display:'flex', justifyContent:'flex-end', gap: 8 }}>
            <button className="btn ghost" onClick={()=>setAddOpen(false)}>취소</button>
            <button className="btn primary" onClick={()=>setAddOpen(false)}>등록하기</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const Steps = ({ active=1 }) => (
  <div className="card" style={{ marginBottom: 16, padding: '10px 14px' }}>
    <div className="steps">
      {['단말기 선택','리베이트 업로드','단가표 편집','출력 & 공유'].map((t, i) => {
        const n = i+1;
        const state = n < active ? 'done' : n===active ? 'on' : '';
        return (
          <React.Fragment key={i}>
            <div className={`step ${state}`}>
              <span className="n">{state==='done'? <Icon name="check" size={12}/> : n}</span>
              {t}
            </div>
            {i<3 && <Icon name="chevron" size={14} className="" />}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

Object.assign(window, { Models, Steps });
