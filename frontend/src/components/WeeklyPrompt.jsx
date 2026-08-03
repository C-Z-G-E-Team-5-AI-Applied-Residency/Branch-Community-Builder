// Single prompt's question + answer flow — shared by Prompts.jsx's Current
// and Past tabs (BR-53). The parent owns which prompt is being shown and
// whether has_responded/my_response_id are current; this component owns the
// submit/edit interaction for that one prompt.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export function formatWeekStart(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Full date+time for older answers, just the time for anything posted today
// (same pattern as EventDetail.jsx's announcement timestamps).
function formatResponseTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Discord-style row: initial-letter avatar, username + timestamp on one
// line, answer text below it. The signed-in user's own row shows "You" and
// gets a pencil button in place of the timestamp's neighbor.
function ResponseTile({ username, displayName, text, time, isMine, onEdit }) {
  return (
    <li className={isMine ? "response-mine" : ""}>
      <span className="response-avatar" aria-hidden="true">
        {username?.[0]?.toUpperCase()}
      </span>
      <div className="response-body">
        <div className="response-meta">
          <span className="response-username">{displayName}</span>
          <span className="response-time">{formatResponseTime(time)}</span>
          {isMine && (
            <button type="button" className="response-edit-btn" aria-label="Edit your answer" onClick={onEdit}>
              ✏️
            </button>
          )}
        </div>
        <p className="response-text">{text}</p>
      </div>
    </li>
  );
}

// prompt: {prompt_id, question_text, week_start, has_responded, my_response_id}
// canRespond: whether a not-yet-answered prompt may be answered here (true
// for the current week, false for a past one — past weeks are closed).
// onAnswered: called after a first-time submit so the parent can refresh
// has_responded/my_response_id (this component doesn't own that prop).
export default function WeeklyPrompt({ prompt, canRespond, onAnswered }) {
  const me = useAuth();
  const [responses, setResponses] = useState([]);
  const [responsesLoaded, setResponsesLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingMine, setEditingMine] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setResponses([]);
    setResponsesLoaded(false);
    setEditingMine(false);
    setNotice(null);
    if (prompt.has_responded) {
      api
        .getPromptResponses(prompt.prompt_id)
        .then(setResponses)
        .catch(() => setResponses([]))
        .finally(() => setResponsesLoaded(true));
    }
  }, [prompt.prompt_id, prompt.has_responded]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setNotice(null);
    setSubmitting(true);
    try {
      await api.submitPromptResponse(draft.trim());
      setDraft("");
      onAnswered?.();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit() {
    // The list is username + text only (no response_id), so find "my" row
    // by matching the signed-in username — unique per prompt, so unambiguous.
    const mine = responses.find((r) => r.username === me.username);
    setDraft(mine ? mine.response_text : "");
    setEditingMine(true);
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setNotice(null);
    setSubmitting(true);
    try {
      const updated = await api.editPromptResponse(prompt.my_response_id, draft.trim());
      setResponses((prev) =>
        prev.map((r) =>
          r.username === me.username
            ? { ...r, response_text: updated.response_text, updated_at: updated.updated_at }
            : r
        )
      );
      setEditingMine(false);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="prompt-week">Week of {formatWeekStart(prompt.week_start)}</p>
      <h2>{prompt.question_text}</h2>

      {notice && <p role="alert">{notice}</p>}

      {!prompt.has_responded && canRespond && (
        <>
          <p className="prompt-empty-hint">No one's answered yet — be the first!</p>
          <form className="prompt-form" onSubmit={onSubmit}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share your answer…"
              aria-label="Your answer"
              maxLength={500}
              disabled={submitting}
            />
            <p className="prompt-char-count">{draft.length}/500</p>
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Submit"}
            </button>
          </form>
        </>
      )}

      {!prompt.has_responded && !canRespond && (
        <p>You didn't answer this prompt, so its responses aren't available.</p>
      )}

      {prompt.has_responded && (
        <div className="prompt-responses">
          <h3>Everyone's answers</h3>
          {!responsesLoaded && <p className="prompt-loading">Loading answers…</p>}
          <ul className="prompt-response-list">
            {responses.map((r) => {
              const isMine = r.username === me.username;
              if (isMine && editingMine) {
                return (
                  <li key={r.username} className="response-mine response-editing">
                    <form onSubmit={onSaveEdit}>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        aria-label="Edit your answer"
                        maxLength={500}
                        disabled={submitting}
                      />
                      <p className="prompt-char-count">{draft.length}/500</p>
                      <div className="prompt-form-actions">
                        <button type="submit" disabled={submitting}>
                          {submitting ? "Saving…" : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingMine(false)} disabled={submitting}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </li>
                );
              }
              return (
                <ResponseTile
                  key={r.username}
                  username={r.username}
                  displayName={isMine ? "You" : r.username}
                  text={r.response_text}
                  time={r.updated_at}
                  isMine={isMine}
                  onEdit={isMine ? startEdit : undefined}
                />
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
