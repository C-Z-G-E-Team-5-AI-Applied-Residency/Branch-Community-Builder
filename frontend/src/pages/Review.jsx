// Moderation queue (admins only). One card per held event: what it is (AI
// summary), why it was flagged (AI reason), and approve/reject. The gate is the
// backend ADMIN_EMAILS allowlist — non-admins get a 403 and see a notice here.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

export default function Review() {
  const [events, setEvents] = useState(null);
  const [tags, setTags] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [tagBusyId, setTagBusyId] = useState(null);
  const [notes, setNotes] = useState({}); // optional moderator note per event

  function load() {
    const onErr = (err) => (err.status === 403 ? setForbidden(true) : setError(err.message));
    api.listPendingReview().then(setEvents).catch(onErr);
    api.listPendingTags().then(setTags).catch(onErr);
  }

  useEffect(load, []);

  async function decide(eventId, decision) {
    setBusyId(eventId);
    setError(null);
    try {
      await api.reviewEvent(eventId, decision, notes[eventId]?.trim() || null);
      // Drop it from the queue immediately; no need to refetch.
      setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function decideTag(tagId, action) {
    setTagBusyId(tagId);
    setError(null);
    try {
      if (action === "approve") await api.updateTag(tagId, { status: "approved" });
      else await api.deleteTag(tagId); // reject = remove
      setTags((prev) => prev.filter((t) => t.tag_id !== tagId));
    } catch (err) {
      setError(err.message);
    } finally {
      setTagBusyId(null);
    }
  }

  if (forbidden) {
    return (
      <main>
        <h1>Review queue</h1>
        <p>You don't have access to the moderation queue.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Review queue</h1>
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {events === null ? (
        <p>Loading…</p>
      ) : events.length === 0 ? (
        <p>Nothing waiting for review. 🌿</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {events.map((e) => (
            <li
              key={e.event_id}
              style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
            >
              <h2 style={{ marginTop: 0 }}>
                <Link to={`/events/${e.event_id}`}>{e.title}</Link>
              </h2>
              <p>
                <strong>Summary:</strong> {e.review_summary || "—"}
              </p>
              <p>
                <strong>Why it was flagged:</strong> {e.review_reason || "—"}
              </p>
              <input
                type="text"
                value={notes[e.event_id] || ""}
                onChange={(ev) => setNotes((n) => ({ ...n, [e.event_id]: ev.target.value }))}
                placeholder="Optional note (saved on reject/approve)"
                style={{ display: "block", width: "100%", marginBottom: "0.5rem" }}
              />
              <button
                className="btn btn-primary"
                disabled={busyId === e.event_id}
                onClick={() => decide(e.event_id, "approve")}
              >
                Approve
              </button>{" "}
              <button
                className="btn-danger"
                disabled={busyId === e.event_id}
                onClick={() => decide(e.event_id, "reject")}
              >
                Reject
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Pending tags</h2>
      {tags === null ? (
        <p>Loading…</p>
      ) : tags.length === 0 ? (
        <p>No new tags to review.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {tags.map((t) => (
            <li key={t.tag_id} style={{ marginBottom: "0.5rem" }}>
              <strong>{t.name}</strong>{" "}
              <small>(used {t.usage_count}×)</small>{" "}
              <button
                className="btn btn-primary"
                disabled={tagBusyId === t.tag_id}
                onClick={() => decideTag(t.tag_id, "approve")}
              >
                Approve
              </button>{" "}
              <button
                className="btn-danger"
                disabled={tagBusyId === t.tag_id}
                onClick={() => decideTag(t.tag_id, "reject")}
              >
                Reject
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
