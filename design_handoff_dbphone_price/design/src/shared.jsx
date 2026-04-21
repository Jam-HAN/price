// Shared UI primitives
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const Chip = ({ tone='', children, dot=true }) => (
  <span className={`chip ${tone}`}>{dot && <span className="dot"/>}{children}</span>
);

const CarrierPill = ({ id, compact=false }) => {
  const c = CARRIERS.find(x => x.id===id);
  if(!c) return null;
  return <span className={`carrier ${c.id}`}>{compact ? c.id : c.name}</span>;
};

const PageHeader = ({ crumbs, title, actions }) => (
  <header className="page">
    <div>
      <div className="crumbs">{crumbs.join(' / ')}</div>
      <h1>{title}</h1>
    </div>
    {actions && <div className="toolbar">{actions}</div>}
  </header>
);

const Toast = ({ msg, onClose }) => {
  useEffect(()=>{ const t=setTimeout(onClose, 2400); return ()=> clearTimeout(t); }, []);
  return (
    <div className="toast"><span className="ic">✓</span>{msg}</div>
  );
};

// Hook for managing toasts
function useToast(){
  const [msg, setMsg] = useState(null);
  const push = (m) => setMsg(m);
  const render = msg ? <Toast msg={msg} onClose={()=>setMsg(null)}/> : null;
  return [render, push];
}

const Modal = ({ open, onClose, children }) => {
  if(!open) return null;
  return (
    <div className={`modal-bg on`} onClick={onClose}>
      <div className="modal" onClick={e=> e.stopPropagation()}>{children}</div>
    </div>
  );
};

// Sparkline / tiny bars
const Bars = ({ values, color='#2152ff', max }) => {
  const M = max || Math.max(...values);
  return (
    <span>
      {values.map((v,i)=>(
        <span key={i} className="bar" style={{ width: 4, height: Math.max(2, (v/M)*22), background: color }}/>
      ))}
    </span>
  );
};

const Switch = ({ on, onChange }) => (
  <div className={`switch ${on?'on':''}`} onClick={()=> onChange(!on)}/>
);

Object.assign(window, { Chip, CarrierPill, PageHeader, Toast, useToast, Modal, Bars, Switch });
