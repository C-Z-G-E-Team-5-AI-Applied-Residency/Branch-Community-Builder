// Sign-in page. Wireframe 1a: form on the left (~40%), map/hero preview on the right (~60%).
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import EventMap from "../components/EventMap.jsx";

export default function SignIn() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const u = await api.login(form);
      // Accounts abandoned mid-onboarding have no profile yet — resume there.
      // Backends built before has_profile existed omit the field; look the
      // profile up instead of treating undefined as "no profile".
      let hasProfile = u.has_profile;
      if (hasProfile === undefined) {
        hasProfile = await api
          .getProfile(u.user_id)
          .then(() => true)
          .catch((err) => err.status !== 404);
      }
      if (hasProfile) navigate("/discover");
      else navigate("/signup", { state: { step: "profile" } });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="split split-40-60">
      <section>
        <h1>Sign In</h1>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit">Sign In &rarr;</button>
        </form>
        <p>
          <Link to="/signup">Create an account</Link>
        </p>
      </section>
      <div className="map-panel" aria-hidden="true">
        <EventMap height="100%" />
      </div>
    </main>
  );
}
