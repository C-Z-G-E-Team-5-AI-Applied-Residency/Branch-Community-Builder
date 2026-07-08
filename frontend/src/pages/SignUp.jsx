// Sign-up onboarding: account -> profile -> interest picker -> /discover.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

export default function SignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState("account"); // account -> profile -> interests
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [account, setAccount] = useState({ email: "", username: "", password: "" });
  const [profile, setProfile] = useState({ display_name: "", bio: "", home_zip_code: "" });
  const [user, setUser] = useState(null);

  const [tags, setTags] = useState([]);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (step === "interests") api.listTags().then(setTags).catch(() => setTags([]));
  }, [step]);

  const setA = (f) => (e) => setAccount({ ...account, [f]: e.target.value });
  const setP = (f) => (e) => setProfile({ ...profile, [f]: e.target.value });

  async function onCreateAccount(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.signup(account);
      // signup doesn't start a session — log in to get the cookie
      const u = await api.login({ email: account.email, password: account.password });
      setUser(u);
      setProfile((p) => ({ ...p, display_name: account.username }));
      setStep("profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onCreateProfile(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.createProfile(profile);
      setStep("interests");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFinish() {
    setError(null);
    setBusy(true);
    try {
      for (const tagId of picked) {
        await api.addInterest(user.user_id, tagId);
      }
      navigate("/discover");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Create Account</h1>
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}

      {step === "account" && (
        <form onSubmit={onCreateAccount}>
          <label>
            Email
            <input type="email" value={account.email} onChange={setA("email")} required />
          </label>
          <label>
            Username
            <input value={account.username} onChange={setA("username")} required />
          </label>
          <label>
            Password
            <input type="password" value={account.password} onChange={setA("password")} minLength={8} required />
          </label>
          <button type="submit" disabled={busy}>Continue</button>
          <p>
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
        </form>
      )}

      {step === "profile" && (
        <form onSubmit={onCreateProfile}>
          <h2>Your profile</h2>
          <label>
            Display name
            <input value={profile.display_name} onChange={setP("display_name")} required />
          </label>
          <label>
            Bio
            <textarea value={profile.bio} onChange={setP("bio")} required />
          </label>
          <label>
            Home ZIP code
            <input value={profile.home_zip_code} onChange={setP("home_zip_code")} pattern="\d{5}" required />
          </label>
          <button type="submit" disabled={busy}>Continue</button>
        </form>
      )}

      {step === "interests" && (
        <div>
          <h2>What are you into?</h2>
          {tags.map((tag) => (
            <label key={tag.tag_id} style={{ marginRight: "1rem" }}>
              <input
                type="checkbox"
                checked={picked.includes(tag.tag_id)}
                onChange={() =>
                  setPicked((prev) =>
                    prev.includes(tag.tag_id)
                      ? prev.filter((t) => t !== tag.tag_id)
                      : [...prev, tag.tag_id]
                  )
                }
              />
              {tag.name}
            </label>
          ))}
          <p>
            <button onClick={onFinish} disabled={busy}>
              {picked.length ? "Finish" : "Skip for now"}
            </button>
          </p>
        </div>
      )}
    </main>
  );
}
