// Success metrics (admins only). Answers BRANCH's own question — "doors walked
// through" — for the AI matchmaker: of the events it recommended, how many did
// people RSVP to and actually check in to, and do recommended events convert to
// check-ins better than non-recommended ones. Gated by ADMIN_EMAILS (403 -> notice).
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const pct = (rate) => (rate === null || rate === undefined ? "—" : `${Math.round(rate * 100)}%`);

export default function Metrics() {
  const [data, setData] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getRecommendationConversion()
      .then(setData)
      .catch((err) => (err.status === 403 ? setForbidden(true) : setError(err.message)));
  }, []);

  if (forbidden) {
    return (
      <main>
        <h1>Success metrics</h1>
        <p>You don't have access to metrics.</p>
      </main>
    );
  }
  if (error) return <main><h1>Success metrics</h1><p role="alert">{error}</p></main>;
  if (!data) return <main><p>Loading…</p></main>;

  const { funnel, comparison } = data;

  return (
    <main>
      <h1>Success metrics</h1>
      <p>Are the matchmaker's recommendations turning into real-world attendance?</p>

      <h2>Recommendation → check-in funnel</h2>
      <table>
        <tbody>
          <tr>
            <td>Events recommended</td>
            <td><strong>{funnel.recommended}</strong></td>
            <td></td>
          </tr>
          <tr>
            <td>…that were RSVP'd</td>
            <td><strong>{funnel.rsvped}</strong></td>
            <td>{pct(funnel.rsvp_rate)} of recommended</td>
          </tr>
          <tr>
            <td>…that were checked in to</td>
            <td><strong>{funnel.checked_in}</strong></td>
            <td>{pct(funnel.checkin_rate)} of recommended (doors walked through)</td>
          </tr>
        </tbody>
      </table>

      <h2>Does recommending help people show up?</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>RSVPs</th>
            <th>Check-in rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Recommended events</td>
            <td>{comparison.recommended_rsvps}</td>
            <td><strong>{pct(comparison.recommended_checkin_rate)}</strong></td>
          </tr>
          <tr>
            <td>Other events</td>
            <td>{comparison.other_rsvps}</td>
            <td><strong>{pct(comparison.other_checkin_rate)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        <small>
          "Doors walked through," not screen time — a recommended event checking in at a higher rate
          is the signal that intent-based matching is working.
        </small>
      </p>
    </main>
  );
}
