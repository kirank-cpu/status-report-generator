export default function BulletList({ items, readOnly, onChange, placeholder = 'Enter a point…', addLabel = '+ Add Point' }) {
  const update = (i, value) => onChange(items.map((it, idx) => (idx === i ? value : it)));

  if (readOnly && items.filter((it) => (it || '').trim()).length === 0) {
    return <p className="hint">NA</p>;
  }

  return (
    <div className="bullet-list">
      {items.map((item, i) => (
        <div className="bullet-row" key={i}>
          <span className="bullet-dot">•</span>
          <input
            value={item}
            placeholder={placeholder}
            disabled={readOnly}
            onChange={(e) => update(i, e.target.value)}
          />
          {!readOnly && (
            <button
              className="icon-btn"
              title="Remove"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button className="btn-secondary" onClick={() => onChange([...items, ''])}>
          {addLabel}
        </button>
      )}
    </div>
  );
}
