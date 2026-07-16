// Sign-up onboarding: account -> profile -> tutorial -> interest picker -> /discover.
// Sign-in redirects profile-less accounts here with state {step: "profile"}
// so abandoned onboarding resumes instead of leaving a user with no profile.
// Profile's "Replay tutorial" enters at {step: "tutorial"}; replays exit to /discover.
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, currentUser } from "../api/client.js";
import MapSlide from "../components/tutorial/MapSlide.jsx";
import RsvpSlide from "../components/tutorial/RsvpSlide.jsx";
import CheckInSlide from "../components/tutorial/CheckInSlide.jsx";
import RecsSlide from "../components/tutorial/RecsSlide.jsx";

// Interactive walkthrough — each slide is a hands-on demo on fake data, no API writes.
const TUTORIAL_SLIDES = [
  { title: "Discover events near you", component: MapSlide },
  { title: "RSVP in one tap", component: RsvpSlide },
  { title: "Check in when you arrive", component: CheckInSlide },
  { title: "Recommendations that learn", component: RecsSlide },
];

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const resumeStep = location.state?.step;
  const me = resumeStep === "profile" || resumeStep === "tutorial" ? currentUser() : null;
  const replay = Boolean(me) && resumeStep === "tutorial";

  const [step, setStep] = useState(me ? resumeStep : "account"); // account -> profile -> tutorial -> interests
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [account, setAccount] = useState({ email: "", username: "", password: "" });
  const [profile, setProfile] = useState({
    display_name: me?.username ?? "",
    bio: "",
    home_zip_code: "",
  });
  const [user, setUser] = useState(me);

  const [tags, setTags] = useState([]);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (step === "interests") api.listTags().then(setTags).catch(() => setTags([]));
  }, [step]);

  const setA = (f) => (e) => setAccount({ ...account, [f]: e.target.value });
  const setP = (f) => (e) => setProfile({ ...profile, [f]: e.target.value });

  const TutorialSlide = TUTORIAL_SLIDES[slide].component;
  const exitTutorial = () => (replay ? navigate("/discover") : setStep("interests"));

  async function onCreateAccount(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await api.signup(account); // starts the session too
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
      try {
        await api.createProfile(profile);
      } catch (err) {
        if (err.status === 401 && account.password) {
          // session cookie went missing mid-onboarding — re-login and retry
          await api.login({ email: account.email, password: account.password });
          await api.createProfile(profile);
        } else if (err.status === 401) {
          navigate("/signin");
          return;
        } else if (err.status === 409) {
          // profile already exists (e.g. double submit) — nothing to create
        } else {
          throw err;
        }
      }
      setStep("tutorial");
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
      <h1>
        {step === "account"
          ? "Create Account"
          : step === "tutorial"
            ? "How Branch Works"
            : "Set Up Your Profile"}
      </h1>
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

      {step === "tutorial" && (
        <div>
          <h2>{TUTORIAL_SLIDES[slide].title}</h2>
          <TutorialSlide />
          <p>
            {slide + 1} of {TUTORIAL_SLIDES.length}
          </p>
          <p>
            {slide > 0 && (
              <button type="button" onClick={() => setSlide(slide - 1)} style={{ marginRight: "0.5rem" }}>
                Back
              </button>
            )}
            {slide < TUTORIAL_SLIDES.length - 1 ? (
              <>
                <button type="button" onClick={() => setSlide(slide + 1)} style={{ marginRight: "0.5rem" }}>
                  Next
                </button>
                <button type="button" onClick={exitTutorial}>
                  {replay ? "Exit tutorial" : "Skip tutorial"}
                </button>
              </>
            ) : (
              <button type="button" onClick={exitTutorial}>
                {replay ? "Done" : "Continue"}
              </button>
            )}
          </p>
        </div>
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
