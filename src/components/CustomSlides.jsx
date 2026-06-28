import { makeCustomSlide } from '../constants';

export default function CustomSlides({ slides, readOnly, onChange }) {
  const update = (id, patch) =>
    onChange(slides.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div>
      {slides.length === 0 && (
        <p className="hint">No custom slides. Add one if this squad needs anything beyond the mandatory slides.</p>
      )}
      {slides.map((s, i) => (
        <div className="custom-slide-card" key={s.id}>
          <div className="custom-slide-head">
            <span className="slide-badge">Slide {i + 1}</span>
            <input
              className="slide-title-input"
              value={s.title}
              placeholder="Slide title"
              disabled={readOnly}
              onChange={(e) => update(s.id, { title: e.target.value })}
            />
            {!readOnly && (
              <button
                className="icon-btn"
                title="Remove slide"
                onClick={() => onChange(slides.filter((x) => x.id !== s.id))}
              >
                ✕
              </button>
            )}
          </div>
          <textarea
            rows={6}
            value={s.body}
            placeholder={'One bullet point per line.\nStart a line with two spaces for a sub-bullet.'}
            disabled={readOnly}
            onChange={(e) => update(s.id, { body: e.target.value })}
          />
        </div>
      ))}
      {!readOnly && (
        <button className="btn-secondary" onClick={() => onChange([...slides, makeCustomSlide()])}>
          + Add Custom Slide
        </button>
      )}
    </div>
  );
}
