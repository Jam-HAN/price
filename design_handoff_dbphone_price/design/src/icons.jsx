// Minimal icon set (stroke-style), 18px default
const Icon = ({ name, size=18, className='', strokeWidth=1.8 }) => {
  const s = { width: size, height: size };
  const props = { fill:'none', stroke:'currentColor', strokeWidth, strokeLinecap:'round', strokeLinejoin:'round' };
  const paths = {
    dashboard: <g {...props}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></g>,
    phone: <g {...props}><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 18h4"/></g>,
    upload: <g {...props}><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/></g>,
    edit: <g {...props}><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/></g>,
    document: <g {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/></g>,
    history: <g {...props}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></g>,
    search: <g {...props}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></g>,
    plus: <g {...props}><path d="M12 5v14M5 12h14"/></g>,
    check: <g {...props}><path d="M5 12l5 5 9-11"/></g>,
    x: <g {...props}><path d="M6 6l12 12M18 6L6 18"/></g>,
    download: <g {...props}><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></g>,
    share: <g {...props}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></g>,
    print: <g {...props}><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="1.5"/><path d="M6 15h12v5H6z"/></g>,
    image: <g {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-6-5-8 9"/></g>,
    sparkle: <g {...props}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></g>,
    bell: <g {...props}><path d="M6 16V10a6 6 0 1 1 12 0v6"/><path d="M4 16h16"/><path d="M10 20a2 2 0 1 0 4 0"/></g>,
    chevron: <g {...props}><path d="M9 6l6 6-6 6"/></g>,
    chevronDown: <g {...props}><path d="M6 9l6 6 6-6"/></g>,
    arrowRight: <g {...props}><path d="M5 12h14M13 5l7 7-7 7"/></g>,
    arrowUp: <g {...props}><path d="M12 19V5M5 12l7-7 7 7"/></g>,
    arrowDown: <g {...props}><path d="M12 5v14M5 12l7 7 7-7"/></g>,
    eye: <g {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g>,
    copy: <g {...props}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></g>,
    trash: <g {...props}><path d="M4 7h16"/><path d="M10 3h4v4h-4z"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></g>,
    filter: <g {...props}><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/></g>,
    settings: <g {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9A1.7 1.7 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g>,
    calendar: <g {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></g>,
    user: <g {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></g>,
    scan: <g {...props}><path d="M4 8V6a2 2 0 0 1 2-2h2M20 8V6a2 2 0 0 0-2-2h-2M4 16v2a2 2 0 0 0 2 2h2M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M4 12h16"/></g>,
    folder: <g {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></g>,
    trend: <g {...props}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></g>,
    bolt: <g {...props}><path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z"/></g>,
    lock: <g {...props}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g>,
    logout: <g {...props}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></g>,
  };
  return <svg viewBox="0 0 24 24" style={s} className={className}>{paths[name]}</svg>;
};
window.Icon = Icon;
