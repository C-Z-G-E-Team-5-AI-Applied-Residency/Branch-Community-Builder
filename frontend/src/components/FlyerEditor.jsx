// Template + background/text-color/font customization for a host's event
// flyer. Draft state is local until "Save flyer style" is clicked.
import { useState } from "react";
import { api } from "../api/client.js";
import {
  FLYER_TEMPLATES,
  FLYER_BACKGROUNDS,
  FLYER_FONTS,
  FLYER_TEMPLATE_DEFAULTS,
  resolveFlyer,
} from "../flyerTemplates.js";
import { formatEventDateTime } from "../formatDate.js";
import FlyerPreview from "./FlyerPreview.jsx";

export default function FlyerEditor({ event, onSaved }) {
  const current = resolveFlyer(event);
  const hasUpload = current.kind === "upload";
  const initial = current.kind === "template"
    ? current
    : { templateId: "classic", ...FLYER_TEMPLATE_DEFAULTS.classic };

  const [templateId, setTemplateId] = useState(initial.templateId);
  const [backgroundId, setBackgroundId] = useState(initial.backgroundId);
  const [textColor, setTextColor] = useState(initial.textColor);
  const [fontId, setFontId] = useState(initial.fontId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Switching templates starts from that template's own default look
  // instead of carrying over a possibly-mismatched background/color/font.
  function pickTemplate(id) {
    const defaults = FLYER_TEMPLATE_DEFAULTS[id];
    setTemplateId(id);
    setBackgroundId(defaults.backgroundId);
    setTextColor(defaults.textColor);
    setFontId(defaults.fontId);
  }

  async function onSave() {
    if (hasUpload && !window.confirm("Saving a template style will replace your uploaded flyer, and it can't be recovered. Continue?")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.selectFlyerTemplate(event.event_id, templateId, { backgroundId, textColor, fontId });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flyer-editor">
      <p>Choose a template:</p>
      <ul className="flyer-editor-templates">
        {FLYER_TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => pickTemplate(t.id)}
              className={`flyer-editor-template-btn${templateId === t.id ? " is-selected" : ""}`}
            >
              <FlyerPreview
                templateId={t.id}
                backgroundId={FLYER_TEMPLATE_DEFAULTS[t.id].backgroundId}
                textColor={FLYER_TEMPLATE_DEFAULTS[t.id].textColor}
                fontId={FLYER_TEMPLATE_DEFAULTS[t.id].fontId}
                title={event.title}
                className="flyer-editor-thumb"
              />
              <div>{t.label}</div>
            </button>
          </li>
        ))}
      </ul>

      <div className="flyer-editor-style-controls">
        <label>
          Background
          <select value={backgroundId} onChange={(e) => setBackgroundId(e.target.value)}>
            {FLYER_BACKGROUNDS.map((bg) => (
              <option key={bg.id} value={bg.id}>
                {bg.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Text color
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
        </label>
        <label>
          Font
          <select value={fontId} onChange={(e) => setFontId(e.target.value)}>
            {FLYER_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p>Preview:</p>
      <FlyerPreview
        templateId={templateId}
        backgroundId={backgroundId}
        textColor={textColor}
        fontId={fontId}
        title={event.title}
        date={formatEventDateTime(event.event_date)}
        location={event.location}
        className="flyer-editor-preview"
      />

      {hasUpload && (
        <p role="alert">Saving a template style will replace your uploaded flyer, and it can't be recovered.</p>
      )}
      <button type="button" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : hasUpload ? "Replace uploaded flyer" : "Save flyer style"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
