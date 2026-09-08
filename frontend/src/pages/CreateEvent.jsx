// New event form. Address is geocoded client-side (Nominatim) into lat/lng.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

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
    why: "",
    event_capacity: 10,
    event_image_url: "/images/default_event.png",
  });
  const [chosenTags, setChosenTags] = useState([]); // tag names (lowercased)
  const [tagInput, setTagInput] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState(null);
  const [heldEvent, setHeldEvent] = useState(null); // set when the guardrail holds the new event
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(() => me && !localStorage.getItem(hintKey(me.user_id)));

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

  const addTag = (name) => {
    const t = name.trim().toLowerCase();
    if (!t) return;
    setChosenTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };
  const removeTag = (name) => setChosenTags((prev) => prev.filter((t) => t !== name));

  async function onSuggestTags() {
    setSuggesting(true);
    try {
      const { suggestions } = await api.suggestTags({
        title: form.title,
        description: form.event_description,
        why: form.why,
      });
      (suggestions || []).forEach((s) => addTag(s.name));
    } catch {
      // suggestions are best-effort — the host can still type their own tags
    } finally {
      setSuggesting(false);
    }
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
        tag_names: chosenTags,
      });

      // The mission guardrail may hold an event for review; if so, don't drop the
      // host onto a page that looks live — tell them it's pending first.
      if (event.review_status === "pending") {
        setHeldEvent(event);
        return;
      }
      navigate(`/events/${event.event_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (heldEvent) {
    return (
      <main>
        <h1>Thanks — your event is being reviewed</h1>
        <p>
          "{heldEvent.title}" was submitted, but it's held for a quick review before it appears
          publicly on the map. This usually just takes a little while — you'll see it go live once
          it's approved.
        </p>
        <p>
          <Link to={`/events/${heldEvent.event_id}`}>View your event</Link> ·{" "}
          <Link to="/discover">Back to Discover</Link>
        </p>
      </main>
    );
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
            <li>Add tags (or let us suggest them): the AI matchmaker uses them to recommend your event to the right people.</li>
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
          Why this event?
          <textarea
            value={form.why}
            onChange={set("why")}
            placeholder="What's the point — the connection or experience you want people to have? (e.g. a low-key way for new grads to meet people who also just moved here)"
          />
          <small>The matchmaker uses this to recommend your event to the right people.</small>
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
          <legend>Tags</legend>
          <p style={{ marginTop: 0 }}>
            <button type="button" onClick={onSuggestTags} disabled={suggesting || !form.title}>
              {suggesting ? "Suggesting…" : "✨ Suggest tags"}
            </button>{" "}
            <small>Suggested from your title, description, and why — edit freely.</small>
          </p>

          {chosenTags.length > 0 && (
            <ul className="chip-list" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {chosenTags.map((name) => (
                <li key={name} className="chip">
                  {name}{" "}
                  <button type="button" aria-label={`Remove ${name}`} onClick={() => removeTag(name)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
              placeholder="Add a tag and press Enter"
            />
            <button type="button" onClick={() => { addTag(tagInput); setTagInput(""); }}>
              Add
            </button>
          </div>

          {tags.length > 0 && (
            <p>
              <small>Or reuse a common tag: </small>
              {tags.map((tag) => (
                <button
                  key={tag.tag_id}
                  type="button"
                  onClick={() => addTag(tag.name)}
                  style={{ marginRight: "0.25rem", marginBottom: "0.25rem" }}
                >
                  {tag.name}
                </button>
              ))}
            </p>
          )}
        </fieldset>
        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create Event"}
        </button>
      </form>
    </main>
  );
}
