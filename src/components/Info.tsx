import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** An accessible "what does this mean?" disclosure. Opens on click/Enter, closes on Escape. */
export default function Info({ title, children, label = 'What does this mean?' }: { title: string; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="info" ref={ref}>
      <button className="info-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">i</span> {label}
      </button>
      {open && (
        <div className="info-pop" id={id} role="note">
          <p className="info-title">{title}</p>
          {children}
        </div>
      )}
    </div>
  );
}
