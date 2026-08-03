// Flyer catalogs + the single helper (resolveFlyer) every flyer-rendering
// component uses to decide how to show an event's flyer.
// Keep FLYER_TEMPLATES/FLYER_BACKGROUNDS/FLYER_FONTS in sync with
// FLYER_TEMPLATE_IDS/FLYER_BACKGROUND_IDS/FLYER_FONT_IDS in
// backend/app/routers/events.py.

export const FLYER_TEMPLATES = [
  { id: "classic", label: "Classic", theme: "classic", layout: "centered" },
  { id: "bold", label: "Bold", theme: "bold", layout: "banner" },
  { id: "minimal", label: "Minimal", theme: "minimal", layout: "left" },
  { id: "community1", label: "Gathering", theme: "community", layout: "centered" },
  { id: "community2", label: "Block Party", theme: "community", layout: "centered" },
  { id: "nature1", label: "Leaf & Branch", theme: "nature", layout: "centered" },
  { id: "nature2", label: "Sunrise Trail", theme: "nature", layout: "centered" },
];

export const FLYER_BACKGROUNDS = [
  { id: "solid-cream", label: "Cream", kind: "solid", value: "#f4f1ea" },
  { id: "solid-sage", label: "Sage", kind: "solid", value: "#dbe7d3" },
  { id: "solid-charcoal", label: "Charcoal", kind: "solid", value: "#3f4a3a" },
  { id: "solid-white", label: "White", kind: "solid", value: "#ffffff" },
  { id: "gradient-sunset", label: "Sunset", kind: "gradient", stops: ["#f4a261", "#e76f51"] },
  { id: "gradient-meadow", label: "Meadow", kind: "gradient", stops: ["#dbe7d3", "#7c9473"] },
  { id: "gradient-dusk", label: "Dusk", kind: "gradient", stops: ["#3f4a3a", "#26314f"] },
  { id: "pattern-leaves", label: "Leaves", kind: "pattern", base: "#f4f1ea", accent: "#a8c49a" },
  { id: "pattern-dots", label: "Dots", kind: "pattern", base: "#ffffff", accent: "#dbe7d3" },
  { id: "pattern-stripes", label: "Stripes", kind: "pattern", base: "#f4f1ea", accent: "#dbe7d3" },
];

export const FLYER_FONTS = [
  { id: "serif-classic", label: "Classic Serif", css: "Georgia, 'Times New Roman', serif" },
  { id: "sans-bold", label: "Bold Sans", css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: "sans-minimal", label: "Minimal Sans", css: "'Avenir Next', 'Segoe UI', sans-serif" },
  { id: "mono-modern", label: "Modern Mono", css: "'SF Mono', 'Courier New', monospace" },
];

// Filled in for whichever of background/text/font a host doesn't pick.
export const FLYER_TEMPLATE_DEFAULTS = {
  classic: { backgroundId: "solid-cream", textColor: "#3f4a3a", fontId: "serif-classic" },
  bold: { backgroundId: "solid-charcoal", textColor: "#dbe7d3", fontId: "sans-bold" },
  minimal: { backgroundId: "solid-white", textColor: "#3f4a3a", fontId: "sans-minimal" },
  community1: { backgroundId: "gradient-meadow", textColor: "#3f4a3a", fontId: "sans-minimal" },
  community2: { backgroundId: "solid-cream", textColor: "#3f4a3a", fontId: "sans-bold" },
  nature1: { backgroundId: "pattern-leaves", textColor: "#3f4a3a", fontId: "serif-classic" },
  nature2: { backgroundId: "gradient-sunset", textColor: "#ffffff", fontId: "sans-bold" },
};

function byId(list) {
  return Object.fromEntries(list.map((item) => [item.id, item]));
}

export const FLYER_TEMPLATES_BY_ID = byId(FLYER_TEMPLATES);
export const FLYER_BACKGROUNDS_BY_ID = byId(FLYER_BACKGROUNDS);
export const FLYER_FONTS_BY_ID = byId(FLYER_FONTS);

// The single place that decides how to render any event's flyer, so every
// consumer (picker thumbnail, modal, editor, map panel) agrees.
export function resolveFlyer(event) {
  if (!event) return { kind: "none" };

  if (event.flyer_url && event.flyer_url.startsWith("/api/")) {
    return { kind: "upload", imgSrc: event.flyer_url };
  }

  if (event.flyer_template_id) {
    const defaults = FLYER_TEMPLATE_DEFAULTS[event.flyer_template_id] || FLYER_TEMPLATE_DEFAULTS.classic;
    return {
      kind: "template",
      templateId: event.flyer_template_id,
      backgroundId: event.flyer_background_id || defaults.backgroundId,
      textColor: event.flyer_text_color || defaults.textColor,
      fontId: event.flyer_font_id || defaults.fontId,
    };
  }

  if (event.flyer_url) {
    // pre-customization record: flyer_url still points at one of the 3 old
    // static template SVGs (or an event_image_url fallback) — render as-is.
    return { kind: "legacy-static", imgSrc: event.flyer_url };
  }

  return { kind: "none" };
}
