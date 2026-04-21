const History = ({ go, pushToast }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = HISTORY.filter(h => {
    if(status!=='all' && h.status!==status) return false;
    if(query && !h.model.toLowerCase().includes(query.toLowerCase()) && !h.creator.includes(query)) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '단가표 히스토리']}
        title="저장된 단가표"
        actions={<>
          <button className="btn ghost"><Icon name="download" size={14}/> 전체 내보내기</button>
          <button className="btn primary" onClick={()=>go('models')}><Icon name="plus" size={14}/> 새 단가표</button>
        </>}
      />

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="label">전체 단가표</div>
          <div className="value num">284</div>
          <div className="delta">이번 달 37개 발행</div>
        </div>
        <div className="stat">
          <span className="pill" style={{ background:'#ddfbf1', color:'var(--mint)' }}>발행</span>
          <div className="label">발행중</div>
          <div className="value num">58</div>
          <div className="delta">활성 공유 링크</div>
        </div>
        <div className="stat">
          <span className="pill" style={{ background:'#fff7d0', color:'#7a5a00' }}>초안</span>
          <div className="label">초안</div>
          <div className="value num">12</div>
          <div className="delta">작성 중</div>
        </div>
        <div className="stat">
          <span className="pill">보관</span>
          <div className="label">아카이브</div>
          <div className="value num">214</div>
          <div className="delta">과거 데이터</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div style={{ display:'flex', alignItems:'center', gap: 10, flex: 1 }}>
            <div style={{ position:'relative', flex: 1, maxWidth: 320 }}>
              <div style={{ position:'absolute', left: 12, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)' }}><Icon name="search" size={16}/></div>
              <input className="input" placeholder="모델명 또는 담당자로 검색" value={query} onChange={e=>setQuery(e.target.value)} style={{ paddingLeft: 36 }}/>
            </div>
            <div className="seg">
              <button className={status==='all'?'on':''} onClick={()=>setStatus('all')}>전체</button>
              <button className={status==='published'?'on':''} onClick={()=>setStatus('published')}>발행</button>
              <button className={status==='draft'?'on':''} onClick={()=>setStatus('draft')}>초안</button>
              <button className={status==='archived'?'on':''} onClick={()=>setStatus('archived')}>보관</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color:'var(--ink-3)' }}><b className="num" style={{ color:'var(--ink)' }}>{filtered.length}</b>건</div>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>단가표</th>
              <th>통신사</th>
              <th>담당자</th>
              <th className="right">조회수</th>
              <th className="right">체결</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(h => (
              <tr key={h.id}>
                <td>
                  <div style={{ display:'flex', gap: 10, alignItems:'center' }}>
                    <div className="ph-img" style={{ width: 36, height: 46, borderRadius: 6 }}/>
                    <div>
                      <div style={{ fontWeight: 700 }}>{h.model}</div>
                      <div style={{ fontSize: 11, color:'var(--ink-3)' }}>{h.date} {h.time}</div>
                    </div>
                  </div>
                </td>
                <td><CarrierPill id={h.carrier}/></td>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                    <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{h.creator[0]}</div>
                    <span style={{ fontSize: 12 }}>{h.creator}</span>
                  </div>
                </td>
                <td className="right num">{h.views}</td>
                <td className="right num" style={{ fontWeight: 700 }}>{h.deals}</td>
                <td>
                  {h.status==='published' && <Chip tone="mint">발행중</Chip>}
                  {h.status==='draft' && <Chip tone="yellow">초안</Chip>}
                  {h.status==='archived' && <Chip>보관</Chip>}
                </td>
                <td>
                  <div style={{ display:'flex', gap: 4 }}>
                    <button className="btn sm ghost" onClick={()=>pushToast('단가표 미리보기')}><Icon name="eye" size={12}/></button>
                    <button className="btn sm ghost" onClick={()=>pushToast('복제되었습니다')}><Icon name="copy" size={12}/></button>
                    <button className="btn sm ghost" onClick={()=>pushToast('공유 링크 복사됨')}><Icon name="share" size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
window.History = History;
