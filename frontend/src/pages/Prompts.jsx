// Weekly community prompt: an icebreaker question everyone sees, answer it
// to unlock everyone else's answers. Current tab is the live question (BR-54);
// Past is a read-only archive of prior weeks, reached from Discover's overlay nav.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

function formatWeekStart(dateStr) {
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
// line, answer text below it.
function ResponseTile({ username, text, time }) {
  return (
    <li>
      <span className="response-avatar" aria-hidden="true">
        {username?.[0]?.toUpperCase()}
      </span>
      <div className="response-body">
        <div className="response-meta">
          <span className="response-username">{username}</span>
          <span className="response-time">{formatResponseTime(time)}</span>
        </div>
        <p className="response-text">{text}</p>
      </div>
    </li>
  );
}

export default function Prompts() {
  const me = useAuth();
  const [tab, setTab] = useState("current");

  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [responses, setResponses] = useState([]);
  const [responsesLoaded, setResponsesLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const [pastPrompts, setPastPrompts] = useState([]);
  const [selectedPast, setSelectedPast] = useState(null);
  const [pastResponses, setPastResponses] = useState([]);

  function loadCurrent() {
    api
      .getCurrentPrompt()
      .then((prompt) => {
        setCurrentPrompt(prompt);
        if (prompt.has_responded) {
          setResponsesLoaded(false);
          api
            .getPromptResponses(prompt.prompt_id)
            .then(setResponses)
            .catch(() => setResponses([]))
            .finally(() => setResponsesLoaded(true));
        }
      })
      .catch((err) => setNotice(err.message));
  }

  useEffect(() => {
    if (tab === "current") loadCurrent();
    else api.listPastPrompts().then(setPastPrompts).catch(() => setPastPrompts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onSubmitResponse(e) {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setNotice(null);
    setSubmitting(true);
    try {
      // my_response_id comes straight from the server (survives a reload),
      // so editing works whether this is a fresh answer or a return visit.
      if (currentPrompt?.my_response_id) {
        await api.editPromptResponse(currentPrompt.my_response_id, draft.trim());
      } else {
        await api.submitPromptResponse(draft.trim());
      }
      setEditing(false);
      loadCurrent();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSelectPast(promptId) {
    setNotice(null);
    setPastResponses([]);
    try {
      const prompt = await api.getPrompt(promptId);
      setSelectedPast(prompt);
      if (prompt.has_responded) {
        const list = await api.getPromptResponses(promptId);
        setPastResponses(list);
      }
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <main className="prompt-page">
      <h1>Weekly Prompt</h1>

      <div className="prompt-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "current"}
          className={tab === "current" ? "is-active" : ""}
          onClick={() => {
            setTab("current");
            setSelectedPast(null);
          }}
        >
          Current
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "past"}
          className={tab === "past" ? "is-active" : ""}
          onClick={() => {
            setTab("past");
            setSelectedPast(null);
          }}
        >
          Past
        </button>
      </div>

      {notice && <p role="alert">{notice}</p>}

      {tab === "current" && currentPrompt && (
        <section className="card prompt-card">
          <p className="prompt-week">Week of {formatWeekStart(currentPrompt.week_start)}</p>
          <h2>{currentPrompt.question_text}</h2>

          {(!currentPrompt.has_responded || editing) && (
            <form className="prompt-form" onSubmit={onSubmitResponse}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Share your answer…"
                aria-label="Your answer"
                maxLength={500}
                disabled={submitting}
              />
              <p className="prompt-char-count">{draft.length}/500</p>
              <div className="prompt-form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : editing ? "Save edit" : "Submit"}
                </button>
                {editing && (
                  <button type="button" onClick={() => setEditing(false)} disabled={submitting}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {currentPrompt.has_responded && !editing && (
            <p className="prompt-meta">
              You've answered this week's prompt.
              <button
                type="button"
                disabled={!responsesLoaded}
                onClick={() => {
                  // The list is username + text only (no response_id), so find
                  // "my" row by matching the signed-in username.
                  const mine = responses.find((r) => r.username === me.username);
                  setDraft(mine ? mine.response_text : "");
                  setEditing(true);
                }}
              >
                Edit my answer
              </button>
            </p>
          )}

          {currentPrompt.has_responded && (
            <div className="prompt-responses">
              <h3>Everyone's answers</h3>
              <ul className="prompt-response-list">
                {responses.map((r) => (
                  <ResponseTile key={r.username} username={r.username} text={r.response_text} time={r.updated_at} />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "past" && !selectedPast && (
        <>
          {pastPrompts.length === 0 && <p>No past prompts yet.</p>}
          <ul className="prompt-list">
            {pastPrompts.map((p) => (
              <li key={p.prompt_id}>
                <button type="button" className="prompt-list-item" onClick={() => onSelectPast(p.prompt_id)}>
                  <span className="prompt-week">{formatWeekStart(p.week_start)}</span>
                  <span>{p.question_text}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "past" && selectedPast && (
        <section className="card prompt-card">
          <button type="button" className="prompt-back" onClick={() => setSelectedPast(null)}>
            ← Back to past prompts
          </button>
          <p className="prompt-week">Week of {formatWeekStart(selectedPast.week_start)}</p>
          <h2>{selectedPast.question_text}</h2>

          {selectedPast.has_responded ? (
            <div className="prompt-responses">
              <h3>Everyone's answers</h3>
              <ul className="prompt-response-list">
                {pastResponses.map((r) => (
                  <ResponseTile key={r.username} username={r.username} text={r.response_text} time={r.updated_at} />
                ))}
              </ul>
            </div>
          ) : (
            <p>You didn't answer this prompt, so its responses aren't available.</p>
          )}
        </section>
      )}
    </main>
  );
}
