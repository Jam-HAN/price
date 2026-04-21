const Upload = ({ go, selected, storage, rebateImages, setRebateImages, setRebateData, setStep }) => {
  const [drag, setDrag] = useState(false);
  const [parsing, setParsing] = useState(null); // {carrier, progress}
  const inputRef = useRef();

  const simulateUpload = (carrier) => {
    // Create a fake "image" placeholder with our SVG
    setParsing({ carrier, progress: 0 });
    let p = 0;
    const tick = () => {
      p += 8 + Math.random()*12;
      if(p >= 100){
        setRebateImages(prev => ({ ...prev, [carrier]: { model: selected, carrier, ts: Date.now(), variant: Math.floor(Math.random()*5) }}));
        setParsing(null);
      } else {
        setParsing({ carrier, progress: Math.min(p, 100) });
        setTimeout(tick, 180);
      }
    };
    setTimeout(tick, 200);
  };

  const pendingCarriers = CARRIERS.filter(c => !rebateImages[c.id]);
  const doneCarriers = CARRIERS.filter(c => rebateImages[c.id]);
  const ready = doneCarriers.length > 0;

  const applyAndContinue = () => {
    // Build initial rebate data from uploaded carriers
    const rows = [];
    Object.values(rebateImages).forEach(img => {
      defaultRebateFor(selected).forEach(r => {
        if(r.carrier === img.carrier) rows.push({ ...r });
      });
    });
    setRebateData(rows);
    setStep(3);
    go('editor');
  };

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '단가표 생성', 'STEP 2']}
        title="리베이트 이미지를 업로드하세요"
        actions={<>
          <button className="btn ghost" onClick={()=>{ setStep(1); go('models'); }}><Icon name="arrowRight" size={14}/> 이전</button>
          <button className="btn primary" disabled={!ready} style={{ opacity: ready?1:0.4, cursor: ready?'pointer':'not-allowed' }} onClick={applyAndContinue}>
            파싱 결과로 편집 <Icon name="arrowRight" size={16}/>
          </button>
        </>}
      />

      <Steps active={2}/>

      <div style={{ display:'grid', gridTemplateColumns:'1.15fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>통신사별 리베이트 업로드</h3>
            <Chip tone="blue">{selected?.name} {storage}</Chip>
          </div>
          <div className="card-b">
            <div className="alert info" style={{ marginBottom: 16 }}>
              <Icon name="sparkle" size={16}/>
              <div>
                <b>자동 파싱 지원</b> · 업로드한 이미지를 OCR로 분석해 요금제별 리베이트, 공시지원금, 추가지원금을 자동 추출합니다.
              </div>
            </div>

            <div className={`dz ${drag?'drag':''}`}
              onDragOver={e=>{ e.preventDefault(); setDrag(true); }}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{ e.preventDefault(); setDrag(false); if(pendingCarriers[0]) simulateUpload(pendingCarriers[0].id); }}
              onClick={()=>{ if(pendingCarriers[0]) simulateUpload(pendingCarriers[0].id); }}>
              <div className="ic" style={{ background: 'var(--blue-soft)' }}>
                <Icon name="upload" size={26}/>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>리베이트 이미지를 여기에 드래그</div>
              <div style={{ fontSize: 12, color:'var(--ink-3)', marginTop: 6 }}>또는 <b style={{ color:'var(--blue)' }}>클릭해서 파일 선택</b> · PNG, JPG, PDF 지원 (최대 10MB)</div>
              <input type="file" ref={inputRef} style={{ display:'none' }}/>
              <div style={{ marginTop: 16, display:'flex', justifyContent:'center', gap: 8 }}>
                {CARRIERS.map(c => (
                  <button key={c.id} className="btn sm ghost"
                    onClick={e=>{ e.stopPropagation(); if(!rebateImages[c.id]) simulateUpload(c.id); }}
                    disabled={!!rebateImages[c.id] || parsing}
                    style={{ opacity: rebateImages[c.id]? 0.5: 1 }}>
                    <CarrierPill id={c.id} compact/> {rebateImages[c.id]? '업로드됨' : '샘플 업로드'}
                  </button>
                ))}
              </div>
            </div>

            {/* Uploaded list */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 10 }}>
                <b style={{ fontSize: 13 }}>업로드 진행 상황</b>
                <span style={{ fontSize: 12, color:'var(--ink-3)' }}>{doneCarriers.length} / {CARRIERS.length} 완료</span>
              </div>
              {CARRIERS.map(c => {
                const done = rebateImages[c.id];
                const isParsing = parsing?.carrier === c.id;
                return (
                  <div key={c.id} style={{
                    display:'flex', alignItems:'center', gap: 12, padding: '12px 14px',
                    border: '1px solid var(--line)', borderRadius: 12, marginBottom: 8,
                    background: done? '#fafcff': '#fff'
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, color: c.color, display:'grid', placeItems:'center', fontWeight: 800 }}>{c.id}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name} 리베이트표</div>
                      {done && <div style={{ fontSize: 11, color:'var(--ok)', display:'flex', alignItems:'center', gap: 4 }}><Icon name="check" size={12}/> 15개 요금제 파싱 완료 · 4.2MB</div>}
                      {!done && !isParsing && <div style={{ fontSize: 11, color:'var(--ink-3)' }}>업로드 대기중</div>}
                      {isParsing && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--blue)', display:'flex', alignItems:'center', gap: 4 }}>
                            <span className="spin" style={{ display:'inline-block', width: 10, height: 10, border:'2px solid var(--blue)', borderTopColor:'transparent', borderRadius: '50%' }}/>
                            OCR 분석 중... {Math.round(parsing.progress)}%
                          </div>
                          <div style={{ height: 4, background:'#f1f4fa', borderRadius: 99, marginTop: 4 }}>
                            <div style={{ height:'100%', width: `${parsing.progress}%`, background:'var(--blue)', borderRadius: 99, transition: 'width .2s' }}/>
                          </div>
                        </div>
                      )}
                    </div>
                    {done && <>
                      <button className="btn sm ghost" onClick={()=>setRebateImages(prev=>{ const x={...prev}; delete x[c.id]; return x; })}>
                        <Icon name="trash" size={12}/>
                      </button>
                    </>}
                    {!done && !isParsing && (
                      <button className="btn sm primary" onClick={()=>simulateUpload(c.id)}>
                        <Icon name="upload" size={12}/> 업로드
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: preview */}
        <div className="card" style={{ position:'sticky', top: 22, alignSelf:'start', maxHeight: 'calc(100vh - 44px)', overflow: 'hidden', display: 'flex', flexDirection:'column' }}>
          <div className="card-h">
            <h3>이미지 미리보기</h3>
            <div className="seg">
              {CARRIERS.map(c => (
                <button key={c.id} className={doneCarriers[0]?.id===c.id?'on':''} onClick={()=>{}} disabled={!rebateImages[c.id]}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 20, overflow:'auto', flex: 1 }}>
            {doneCarriers.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: '#f1f4fa', margin: '0 auto 12px', display: 'grid', placeItems: 'center' }}>
                  <Icon name="image" size={32}/>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>업로드된 이미지가 없습니다</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>좌측에서 리베이트 이미지를 업로드하면<br/>이곳에 자동으로 표시됩니다</div>
              </div>
            ) : (
              <div className="shot" style={{ position:'relative' }}>
                <span className="tag">{CARRIERS.find(c=>c.id===doneCarriers[0].id).name} · 원본</span>
                {parsing && <div className="scan-line"/>}
                <RebateImage model={selected} carrier={doneCarriers[0].id} variant={rebateImages[doneCarriers[0].id].variant}/>
              </div>
            )}

            {doneCarriers.length > 0 && (
              <div style={{ marginTop: 14, padding: 12, background:'#f7f9ff', borderRadius: 10, border:'1px dashed #c7d0e3' }}>
                <div style={{ fontSize: 12, fontWeight:700, marginBottom: 8, display:'flex', alignItems:'center', gap: 6 }}>
                  <Icon name="scan" size={14}/> AI 추출 결과 (프리뷰)
                </div>
                <div style={{ fontSize: 11, color:'var(--ink-2)', lineHeight: 1.6 }}>
                  ✓ 요금제 5종 인식<br/>
                  ✓ 계약 구분 3종 (신규/번이/기변) 인식<br/>
                  ✓ 공시지원금 범위: ₩420K ~ ₩560K<br/>
                  ✓ 추가지원금 계산식 자동 적용 (15%)<br/>
                  <span style={{ color: 'var(--ink-3)' }}>⚠ 조건 문구 2개는 수동 확인 필요</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
window.Upload = Upload;
