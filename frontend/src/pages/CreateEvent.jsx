// New event form. Address is geocoded client-side (Nominatim) into lat/lng.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, currentUser } from "../api/client.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

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
  const me = currentUser();
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState({
    title: "",
    event_date: "",
    location: "",
    event_zip_code: "",
    event_description: "",
    event_capacity: 10,
    event_image_url: "/images/default_event.png",
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
        event_zip_code: parseInt(form.event_zip_code, 10),
        event_capacity: parseInt(form.event_capacity, 10),
        latitude: point.lat,
        longitude: point.lng,
        tag_ids: selectedTags,
      });
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
      <form onSubmit={onSubmit}>
        <label>
          Title
          <input value={form.title} onChange={set("title")} required />
        </label>
        <label>
          Date &amp; time
          <input type="datetime-local" value={form.event_date} onChange={set("event_date")} required />
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
