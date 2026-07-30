// User profile: display name, bio, interests, community standing / leader badge.
// Hosted events and RSVPs live only on the dedicated /events and /rsvps
// pages (reached via the map's nav overlay) — not duplicated here.
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api, apiUrl, getNeighborhoodForZip } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import AvatarInput from "../components/AvatarInput.jsx";
import LeaderBadge from "../components/LeaderBadge.jsx";

const DEFAULT_AVATAR = "/images/default_avatar.svg";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const me = useAuth();
  const isOwn = me && me.user_id === Number(userId);

  const [profile, setProfile] = useState(null);
  const [neighborhoodName, setNeighborhoodName] = useState(null);
  const [standings, setStandings] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "", home_zip_code: "", intent: "" });
  const [pictureFile, setPictureFile] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [error, setError] = useState(null);
  const [noProfile, setNoProfile] = useState(false);

  const load = useCallback(() => {
    api
      .getProfile(userId)
      .then((p) => {
        setProfile(p);
        setForm({
          display_name: p.display_name,
          bio: p.bio,
          home_zip_code: p.home_zip_code,
          intent: p.intent ?? "",
        });
      })
      .catch((err) => {
        // Reachable if onboarding was abandoned right after account creation
        // (before the profile step) and the account is later visited directly
        // instead of through SignIn's own has_profile redirect.
        if (err.status === 404) setNoProfile(true);
        else setError(err.message);
      });
    api.getUserStandings(userId).then(setStandings).catch(() => setStandings([]));
  }, [userId]);

  useEffect(load, [load]);

  // Resolves in the background; the raw ZIP still renders below until this
  // lands, and stays put if the lookup comes up empty (no geocode match, or
  // the point falls outside every neighborhood boundary we have).
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setNeighborhoodName(null);
    getNeighborhoodForZip(profile.home_zip_code)
      .then((name) => {
        if (!cancelled) setNeighborhoodName(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile?.home_zip_code]);

  if (noProfile && isOwn) return <Navigate to="/signup?step=profile" replace />;
  if (noProfile) return <main><h1>Profile</h1><p>This user hasn't finished setting up their profile yet.</p></main>;
  if (error) return <main><h1>Profile</h1><p role="alert">{error}</p></main>;
  if (!profile) return <main><p>Loading…</p></main>;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function onSave(e) {
    e.preventDefault();
    try {
      if (pictureFile) await api.uploadProfilePicture(userId, pictureFile);
      await api.updateProfile(userId, form);
      setEditing(false);
      setPictureFile(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onLogout() {
    await api.logout().catch(() => {});
    navigate("/signin");
  }

  async function onDeleteAccount() {
    try {
      await api.deleteAccount(userId);
      navigate("/signin");
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRemovePicture() {
    try {
      await api.removeProfilePicture(userId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // uploaded avatars are served by the API; anything else (old rows, dead
  // paths) falls back to the bundled default via onError
  const hasUpload = profile.profile_picture.startsWith("/api/");
  const avatarSrc = hasUpload ? apiUrl(profile.profile_picture) : profile.profile_picture;

  return (
    <main>
      <h1>
        {profile.display_name} <LeaderBadge userId={Number(userId)} />
      </h1>
      {!editing && (
        <img
          className="avatar"
          src={avatarSrc}
          alt=""
          width={96}
          height={96}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />
      )}

      {editing ? (
        <form onSubmit={onSave}>
          <AvatarInput currentSrc={avatarSrc} onChange={setPictureFile} />
          {hasUpload && (
            <button type="button" onClick={onRemovePicture}>
              Remove photo
            </button>
          )}
          <label>
            Display Name
            <input value={form.display_name} onChange={set("display_name")} required />
          </label>
          <label>
            Bio
            <textarea value={form.bio} onChange={set("bio")} required />
          </label>
          <label>
            Home ZIP
            <input value={form.home_zip_code} onChange={set("home_zip_code")} pattern="\d{5}" required />
          </label>
          <label>
            What do you want to do more of, offline?
            <textarea
              value={form.intent}
              onChange={set("intent")}
              placeholder="e.g. meet people who like hiking, find a weekly study group, just get out of the house more"
            />
            <small>The matchmaker uses this to find events you'll actually show up to.</small>
          </label>
          <button type="submit">Save</button>{" "}
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setPictureFile(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <p>{profile.bio}</p>
          <p>
            {neighborhoodName
              ? `Neighborhood: ${neighborhoodName}`
              : `Home ZIP: ${profile.home_zip_code}`}
          </p>
          {profile.intent && (
            <p>
              <strong>Looking for:</strong> {profile.intent}
            </p>
          )}
          {isOwn && (
            <>
              <button onClick={() => setEditing(true)}>Edit profile</button>{" "}
              <button onClick={() => navigate("/signup?step=tutorial")}>
                Replay tutorial
              </button>
            </>
          )}
        </>
      )}

      <h2>Interests</h2>
      {profile.interests.length ? (
        <ul className="chip-list">
          {profile.interests.map((tag) => (
            <li key={tag.tag_id} className="chip">
              {tag.name}
            </li>
          ))}
        </ul>
      ) : (
        <p>No interests yet.</p>
      )}

      <h2>Community standing</h2>
      {standings.length ? (
        <ul>
          {standings.map((s) => (
            <li key={s.standing_id}>
              {s.neighborhood_name} ({s.city}): hosted {s.events_hosted}, attended{" "}
              {s.events_attended}
              {s.is_leader && " · 🌿 leader"}
            </li>
          ))}
        </ul>
      ) : (
        <p>No community activity yet.</p>
      )}

      {isOwn && (
        <p>
          <button onClick={onLogout}>Sign out</button>
        </p>
      )}

      {isOwn && (
        <section className="danger-zone">
          <h2>Danger zone</h2>
          {confirmingDelete ? (
            <>
              <p>
                This permanently deletes your account, profile, events, and RSVPs. It cannot
                be undone.
              </p>
              <label className="danger-confirm">
                <input
                  type="checkbox"
                  checked={deleteChecked}
                  onChange={(e) => setDeleteChecked(e.target.checked)}
                />{" "}
                I understand — delete my account permanently
              </label>
              <button
                className="btn-danger"
                disabled={!deleteChecked}
                onClick={onDeleteAccount}
              >
                Permanently delete account
              </button>{" "}
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteChecked(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmingDelete(true)}>
              Delete account
            </button>
          )}
        </section>
      )}
    </main>
  );
}
