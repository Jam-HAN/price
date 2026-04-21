const Dashboard = ({ go }) => {
  const stats = [
    { label: '오늘 발행된 단가표', value: 14, delta: '+3 vs 어제', up:true, color:'var(--blue)', pill:'TODAY' },
    { label: '이번 주 체결 건', value: 37, delta: '+12% WoW', up:true, color:'var(--lime)', pill:'WEEKLY' },
    { label: '활성 모델 수', value: 24, delta: '신규 2종', up:true, color:'var(--pink)', pill:'MODELS' },
    { label: '미처리 리베이트', value: 3, delta: '-2 오늘', up:false, color:'var(--yellow)', pill:'PENDING' },
  ];
  const bars = [4,7,5,8,6,9,11,8,12,14,10,13];
  return (
    <>
      <PageHeader
        crumbs={['대박통신', '대시보드']}
        title="오늘의 한눈에 보기"
        actions={<>
          <button className="btn ghost"><Icon name="calendar" size={16}/> 2026.04.21 월</button>
          <button className="btn primary" onClick={()=>go('models')}><Icon name="plus" size={16}/> 단가표 생성</button>
        </>}
      />

      <div className="grid-4" style={{ marginBottom: 16 }}>
        {stats.map((s,i)=>(
          <div className="stat" key={i}>
            <span className="pill" style={{ background: s.color==='var(--lime)'? '#f4ffc7' : s.color==='var(--pink)'? '#ffeaf4': s.color==='var(--yellow)'? '#fff7d0':'var(--blue-soft)', color: s.color }}>{s.pill}</span>
            <div className="label">{s.label}</div>
            <div className="value num">{s.value}</div>
            <div className={`delta ${s.up?'':'down'}`}>
              <Icon name={s.up?'arrowUp':'arrowDown'} size={12}/>{s.delta}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>주간 단가표 발행 추이</h3>
            <div className="seg">
              <button className="on">주간</button>
              <button>월간</button>
              <button>분기</button>
            </div>
          </div>
          <div className="card-b">
            <div style={{ display:'flex', alignItems:'flex-end', gap: 6, height: 160, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              {bars.map((v,i)=>{
                const isToday = i===bars.length-1;
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>{v}</div>
                    <div style={{
                      width: '100%', height: `${v*10}px`, borderRadius: '6px 6px 0 0',
                      background: isToday ? 'var(--blue)' : 'linear-gradient(180deg, #b9c9ff, #eaf0ff)',
                      border: isToday? 'none':'1px solid #d7e1ff'
                    }}/>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{['월','화','수','목','금','토','일','월','화','수','목','금'][i]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:'flex', gap: 16, padding:'12px 2px 0', fontSize: 12, color: 'var(--ink-3)' }}>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'var(--blue)', marginRight: 6 }}/>오늘</span>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#b9c9ff', marginRight: 6 }}/>지난 주</span>
              <span style={{ marginLeft:'auto' }}>총 발행: <b className="num" style={{ color:'var(--ink)' }}>107건</b></span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>통신사별 체결 비중</h3></div>
          <div className="card-b">
            {CARRIERS.map((c,i)=>{
              const pct = [42, 33, 25][i];
              return (
                <div key={c.id} style={{ marginBottom: 14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight:600 }}><CarrierPill id={c.id}/></span>
                    <span className="mono" style={{ fontSize: 13, fontWeight:700 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f4fa', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: c.color, borderRadius: 99 }}/>
                  </div>
                </div>
              );
            })}
            <hr style={{ border:'none', borderTop:'1px solid var(--line)', margin:'18px 0 12px' }}/>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>가장 많이 팔린 모델</div>
            <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
              <div className="ph-img" style={{ width: 40, height: 52, borderRadius: 6 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Galaxy S Ultra 256GB</div>
                <div style={{ fontSize: 11, color:'var(--ink-3)' }}>이번 주 14건 체결</div>
              </div>
              <Chip tone="lime">🔥 HOT</Chip>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>최근 발행된 단가표</h3>
            <button className="btn sm ghost" onClick={()=>go('history')}>전체보기 <Icon name="arrowRight" size={12}/></button>
          </div>
          <table className="t">
            <thead>
              <tr><th>모델</th><th>통신사</th><th>담당</th><th className="right">조회</th><th className="right">체결</th><th>상태</th></tr>
            </thead>
            <tbody>
              {HISTORY.slice(0,5).map(h => (
                <tr key={h.id}>
                  <td>
                    <div style={{ fontWeight:600 }}>{h.model}</div>
                    <div style={{ fontSize:11, color:'var(--ink-3)' }}>{h.date} {h.time}</div>
                  </td>
                  <td><CarrierPill id={h.carrier}/></td>
                  <td style={{ fontSize: 12 }}>{h.creator}</td>
                  <td className="right num">{h.views}</td>
                  <td className="right num" style={{ fontWeight: 700 }}>{h.deals}</td>
                  <td>
                    {h.status==='published' && <Chip tone="mint">발행됨</Chip>}
                    {h.status==='draft' && <Chip tone="yellow">초안</Chip>}
                    {h.status==='archived' && <Chip>보관</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-h"><h3>활동 로그</h3></div>
          <div className="card-b" style={{ padding: 0 }}>
            <div style={{ padding: '6px 0' }}>
              {ACTIVITY.map((a,i) => {
                const iconColor = { publish:'var(--ok)', upload:'var(--blue)', share:'var(--pink)', archive:'var(--ink-3)', edit:'var(--yellow)'}[a.type];
                return (
                  <div key={i} style={{ display:'flex', gap: 12, padding: '12px 20px', borderBottom: i<ACTIVITY.length-1? '1px solid var(--line-2)':'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f1f4fa', display:'grid', placeItems:'center', color: iconColor, flexShrink: 0 }}>
                      <Icon name={a.type==='publish'?'check': a.type==='upload'?'upload': a.type==='share'?'share': a.type==='archive'?'folder':'edit'} size={14}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}><b>{a.who}</b>님이 {a.action}</div>
                      <div style={{ fontSize: 11, color:'var(--ink-3)', marginTop: 2 }}>{a.when}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
window.Dashboard = Dashboard;
