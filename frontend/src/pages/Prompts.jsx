// Weekly community prompt: an icebreaker question everyone sees, answer it
// to unlock everyone else's answers. Current tab is the live question (BR-54);
// Past is a read-only archive of prior weeks, reached from Discover's overlay nav.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import WeeklyPrompt, { formatWeekStart } from "../components/WeeklyPrompt.jsx";

export default function Prompts() {
  const [tab, setTab] = useState("current");

  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [notice, setNotice] = useState(null);

  const [pastPrompts, setPastPrompts] = useState([]);
  const [selectedPast, setSelectedPast] = useState(null);

  function loadCurrent() {
    api.getCurrentPrompt().then(setCurrentPrompt).catch((err) => setNotice(err.message));
  }

  useEffect(() => {
    if (tab === "current") loadCurrent();
    else api.listPastPrompts().then(setPastPrompts).catch(() => setPastPrompts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onSelectPast(promptId) {
    setNotice(null);
    try {
      setSelectedPast(await api.getPrompt(promptId));
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
          <WeeklyPrompt prompt={currentPrompt} canRespond onAnswered={loadCurrent} />
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
          <WeeklyPrompt prompt={selectedPast} canRespond={false} />
        </section>
      )}
    </main>
  );
}
