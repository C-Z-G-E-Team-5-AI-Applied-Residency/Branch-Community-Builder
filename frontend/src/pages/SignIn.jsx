// Sign-in page. Wireframe: email + password, "Sign In", "Create an account" link.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

export default function SignIn() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.login(form);
      navigate("/discover");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
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
        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Sign In</button>
      </form>
      <p>
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </main>
  );
}
