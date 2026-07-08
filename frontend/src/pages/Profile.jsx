// User profile: display name, bio, interests, community standing / leader badge.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, currentUser } from "../api/client.js";
import LeaderBadge from "../components/LeaderBadge.jsx";

export default function Profile() {
  const { userId } = useParams();
  const me = currentUser();
  const isOwn = me && me.user_id === Number(userId);

  const [profile, setProfile] = useState(null);
  const [standings, setStandings] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "", home_zip_code: "" });
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
      await api.updateProfile(userId, form);
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <h1>
        {profile.display_name} <LeaderBadge userId={Number(userId)} />
      </h1>
      <img src={profile.profile_picture} alt="" width={96} height={96} />

      {editing ? (
        <form onSubmit={onSave}>
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
          <button type="button" onClick={() => setEditing(false)}>
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
    </main>
  );
}
