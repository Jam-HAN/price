// Top-level app with navigation
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primaryBlue": "#2152ff",
  "accentLime": "#d4ff3f",
  "compactMode": false
}/*EDITMODE-END*/;

function App(){
  const [route, setRoute] = useState(()=> localStorage.getItem('dbp:route') || 'dashboard');
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [storage, setStorage] = useState('256GB');
  const [rebateImages, setRebateImages] = useState({});
  const [rebateData, setRebateData] = useState([]);
  const [toastNode, pushToast] = useToast();
  const [tweaksOn, setTweaksOn] = useState(false);
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);

  useEffect(()=>{ localStorage.setItem('dbp:route', route); }, [route]);

  // Edit mode wiring
  useEffect(()=>{
    const handler = (e) => {
      if(e.data?.type === '__activate_edit_mode') setTweaksOn(true);
      if(e.data?.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(()=>{
    document.documentElement.style.setProperty('--blue', tweaks.primaryBlue);
    document.documentElement.style.setProperty('--lime', tweaks.accentLime);
  }, [tweaks]);

  const go = (r) => setRoute(r);

  const nav = [
    { section:'메인' },
    { id:'dashboard', icon:'dashboard', label:'대시보드' },
    { section:'단가표' },
    { id:'models', icon:'phone', label:'단말기 선택', badge: step>1 && step<=4 ? `STEP ${step}` : null },
    { id:'upload', icon:'upload', label:'리베이트 업로드', disabled: !selected },
    { id:'editor', icon:'edit', label:'매트릭스 편집', disabled: rebateData.length===0 },
    { id:'output', icon:'document', label:'출력 & 공유', disabled: rebateData.length===0 },
    { section:'관리' },
    { id:'history', icon:'history', label:'단가표 히스토리' },
  ];

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">대</div>
          <div>
            <div className="name">대박통신</div>
            <div className="sub">PRICE STUDIO v2.4</div>
          </div>
        </div>
        <div className="nav">
          {nav.map((n, i) => n.section ? (
            <div key={i} className="nav-section">{n.section}</div>
          ) : (
            <a key={n.id} className={`nav-item ${route===n.id?'active':''}`}
              onClick={()=>{ if(!n.disabled) go(n.id); }}
              style={{ opacity: n.disabled? 0.4 : 1, cursor: n.disabled? 'not-allowed':'pointer' }}>
              <span className="icon"><Icon name={n.icon} size={16}/></span>
              {n.label}
              {n.badge && <span className="badge">{n.badge}</span>}
            </a>
          ))}
        </div>
        <div className="sidebar-foot">
          <div style={{ background: '#141a33', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 6 }}>
              <Icon name="bolt" size={14} className=""/>
              <b style={{ fontSize: 12 }}>실시간 정책 동기화</b>
            </div>
            <div style={{ fontSize: 10, color:'#8a93ad', marginBottom: 8 }}>통신사 3사 최신 정책 자동 반영</div>
            <div style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 10 }}>
              <span className="s-dot"/> <span style={{ color:'#c8cee1' }}>동기화됨 · 방금 전</span>
            </div>
          </div>
          <div className="user-chip">
            <div className="avatar">김</div>
            <div className="meta">
              <div className="n">김민정 매니저</div>
              <div className="r">강남 2호점 · ADMIN</div>
            </div>
          </div>
        </div>
      </aside>
      <main>
        {route==='dashboard' && <Dashboard go={go}/>}
        {route==='models' && <Models go={go} selected={selected} setSelected={setSelected} setStep={setStep} setStorage={setStorage} storage={storage}/>}
        {route==='upload' && selected && <Upload go={go} selected={selected} storage={storage} rebateImages={rebateImages} setRebateImages={setRebateImages} setRebateData={setRebateData} setStep={setStep}/>}
        {route==='editor' && selected && <Editor go={go} selected={selected} storage={storage} rebateData={rebateData} setRebateData={setRebateData} setStep={setStep} pushToast={pushToast}/>}
        {route==='output' && selected && <Output go={go} selected={selected} storage={storage} rebateData={rebateData} setStep={setStep} pushToast={pushToast}/>}
        {route==='history' && <History go={go} pushToast={pushToast}/>}
      </main>

      {/* Tweaks panel */}
      <div id="tweaks" className={tweaksOn? 'on':''}>
        <h4 style={{ display:'flex', justifyContent:'space-between' }}>
          Tweaks
          <button style={{ color:'#fff' }} onClick={()=>setTweaksOn(false)}><Icon name="x" size={14}/></button>
        </h4>
        <div className="row">
          <span>Primary</span>
          <div className="swatches">
            {['#2152ff','#7a3fff','#d71f30','#059669'].map(c => (
              <div key={c} className={`sw ${tweaks.primaryBlue===c?'on':''}`} style={{ background: c }}
                onClick={()=>{
                  const next = { ...tweaks, primaryBlue: c };
                  setTweaks(next);
                  window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { primaryBlue: c } }, '*');
                }}/>
            ))}
          </div>
        </div>
        <div className="row">
          <span>Accent</span>
          <div className="swatches">
            {['#d4ff3f','#ffd84a','#ff5fae','#3fe0b0'].map(c => (
              <div key={c} className={`sw ${tweaks.accentLime===c?'on':''}`} style={{ background: c }}
                onClick={()=>{
                  const next = { ...tweaks, accentLime: c };
                  setTweaks(next);
                  window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { accentLime: c } }, '*');
                }}/>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10, color:'#8a93ad', marginTop: 10, lineHeight: 1.5 }}>
          브랜드 컬러와 포인트 컬러를 바꿔보세요. 좌측 사이드바의 대시보드 · STEP 뱃지 등에 즉시 반영됩니다.
        </div>
      </div>

      {toastNode}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root').parentNode.getElementById? null : document.getElementById('root'));
root.render(<App/>);
