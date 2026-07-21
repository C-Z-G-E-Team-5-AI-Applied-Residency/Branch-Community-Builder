// User profile: display name, bio, interests, community standing / leader badge.
// Hosted events and RSVPs live only on the dedicated /events and /rsvps
// pages (reached via the map's nav overlay) — not duplicated here.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiUrl, currentUser } from "../api/client.js";
import LeaderBadge from "../components/LeaderBadge.jsx";

const DEFAULT_AVATAR = "/images/default_avatar.svg";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const me = currentUser();
  const isOwn = me && me.user_id === Number(userId);

  const [profile, setProfile] = useState(null);
  const [standings, setStandings] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "", home_zip_code: "" });
  const [pictureFile, setPictureFile] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api
      .getProfile(userId)
      .then((p) => {
        setProfile(p);
        setForm({ display_name: p.display_name, bio: p.bio, home_zip_code: p.home_zip_code });
      })
      .catch((err) => setError(err.message));
    api.getUserStandings(userId).then(setStandings).catch(() => setStandings([]));
  }, [userId]);

  useEffect(load, [load]);

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
      <img
        src={avatarSrc}
        alt=""
        width={96}
        height={96}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = DEFAULT_AVATAR;
        }}
      />

      {editing ? (
        <form onSubmit={onSave}>
          <label>
            Profile picture
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setPictureFile(e.target.files[0] ?? null)}
            />
          </label>
          {hasUpload && (
            <button type="button" onClick={onRemovePicture}>
              Remove photo
            </button>
          )}
          <label>
            Display name
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
          <p>Home ZIP: {profile.home_zip_code}</p>
          {isOwn && <button onClick={() => setEditing(true)}>Edit profile</button>}
        </>
      )}

      <h2>Interests</h2>
      {profile.interests.length ? (
        <ul>
          {profile.interests.map((tag) => (
            <li key={tag.tag_id}>{tag.name}</li>
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
