// New event form. Address is geocoded client-side (Nominatim) into lat/lng.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { FLYER_TEMPLATES } from "../flyerTemplates.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// One-time first-host hint, dismissed per user per browser.
const hintKey = (userId) => `branch:hosting-hint-dismissed:${userId}`;

async function geocode(address) {
  const params = new URLSearchParams({ q: address, format: "json", limit: "1" });
  const res = await fetch(`${NOMINATIM_URL}?${params}`);
  if (!res.ok) throw new Error("Geocoding failed");
  const results = await res.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const me = useAuth();
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState({
    title: "",
    event_date: "",
    event_end_date: "",
    location: "",
    event_zip_code: "",
    event_description: "",
    event_capacity: 10,
    event_image_url: "/images/default_event.png",
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(() => me && !localStorage.getItem(hintKey(me.user_id)));
  const [flyerFile, setFlyerFile] = useState(null);
  const [flyerTemplateId, setFlyerTemplateId] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  function dismissHint() {
    localStorage.setItem(hintKey(me.user_id), "1");
    setShowHint(false);
  }

  useEffect(() => {
    api.listTags().then(setTags).catch(() => setTags([]));
  }, []);

  if (!me) {
    return (
      <main>
        <h1>New Event</h1>
        <p>
          You need to <Link to="/signin">sign in</Link> to host an event.
        </p>
      </main>
    );
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const toggleTag = (tagId) =>
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );

  // A created event can only end up with one flyer source, so picking one clears the other.
  function pickFlyerFile(file) {
    setFlyerFile(file);
    if (file) setFlyerTemplateId(null);
  }
  function pickFlyerTemplate(templateId) {
    setFlyerTemplateId(templateId);
    setFlyerFile(null);
  }

  function onFlyerDrop(e) {
    e.preventDefault();
    setDragActive(false);
    pickFlyerFile(e.dataTransfer.files[0] ?? null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const point = await geocode(`${form.location} ${form.event_zip_code}`);
      if (!point) {
        setError("Could not find that address — try adding city/state.");
        return;
      }
      const event = await api.createEvent({
        ...form,
        event_date: new Date(form.event_date).toISOString(),
        event_end_date: new Date(form.event_end_date).toISOString(),
        event_zip_code: parseInt(form.event_zip_code, 10),
        event_capacity: parseInt(form.event_capacity, 10),
        latitude: point.lat,
        longitude: point.lng,
        tag_ids: selectedTags,
      });

      // Flyer needs the event's id, so it can only be attached after creation.
      // Best-effort: the event is already created either way, and the host can
      // manage/retry the flyer from the event page if this fails.
      try {
        if (flyerFile) await api.uploadEventFlyer(event.event_id, flyerFile);
        else if (flyerTemplateId) await api.selectFlyerTemplate(event.event_id, flyerTemplateId);
      } catch {
        // ignored — see comment above
      }

      navigate(`/events/${event.event_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>New Event</h1>
      {showHint && (
        <aside style={{ background: "white", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>First time hosting? 🌿</h2>
          <ul>
            <li>Your title and description are what people see when they tap your pin on the Discover map.</li>
            <li>Use a real street address — we turn it into that map pin automatically.</li>
            <li>Pick tags that fit: the AI matchmaker uses them to recommend your event to the right people.</li>
            <li>
              After creating, open <strong>host check-in (QR)</strong> on your event page — attendees
              scan it at the door, and every check-in builds your community standing.
            </li>
          </ul>
          <button type="button" onClick={dismissHint}>
            Got it — don't show this again
          </button>
        </aside>
      )}
      <form onSubmit={onSubmit}>
        <label>
          Title
          <input value={form.title} onChange={set("title")} required />
        </label>
        <label>
          Start date &amp; time
          <input type="datetime-local" value={form.event_date} onChange={set("event_date")} required />
        </label>
        <label>
          End date &amp; time
          <input type="datetime-local" value={form.event_end_date} onChange={set("event_end_date")} required />
        </label>
        <label>
          Address
          <input
            value={form.location}
            onChange={set("location")}
            placeholder="Washington Square Park, New York"
            required
          />
        </label>
        <label>
          ZIP code
          <input value={form.event_zip_code} onChange={set("event_zip_code")} pattern="\d{5}" required />
        </label>
        <label>
          Description
          <textarea value={form.event_description} onChange={set("event_description")} required />
        </label>
        <label>
          Capacity
          <input type="number" min="1" value={form.event_capacity} onChange={set("event_capacity")} required />
        </label>
        <label>
          Image URL
          <input value={form.event_image_url} onChange={set("event_image_url")} />
        </label>

        <fieldset>
          <legend>Flyer (optional)</legend>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onFlyerDrop}
            style={{
              border: dragActive ? "2px solid #7c9473" : "2px dashed #ccc",
              borderRadius: "8px",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            {flyerFile ? (
              <p>{flyerFile.name}</p>
            ) : (
              <p>Drag &amp; drop a flyer image here, or choose a file below.</p>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => pickFlyerFile(e.target.files[0] ?? null)}
            />
            {flyerFile && (
              <button type="button" onClick={() => pickFlyerFile(null)}>
                Clear
              </button>
            )}
          </div>

          <p>Or pick a template:</p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {FLYER_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickFlyerTemplate(t.id)}
                style={{
                  display: "block",
                  padding: "0.25rem",
                  border: flyerTemplateId === t.id ? "2px solid #7c9473" : "2px solid transparent",
                  background: "none",
                  borderRadius: "4px",
                }}
              >
                <img src={t.src} alt={t.label} width={80} />
                <div>{t.label}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Tags</legend>
          {tags.map((tag) => (
            <label key={tag.tag_id} style={{ marginRight: "1rem" }}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.tag_id)}
                onChange={() => toggleTag(tag.tag_id)}
              />
              {tag.name}
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create Event"}
        </button>
      </form>
    </main>
  );
}
