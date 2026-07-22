// Thin fetch wrapper. Sends cookies so the session survives across requests.
// In production the API is same-origin (the static site rewrites /api/* to the
// backend service), so BASE is empty and paths stay relative — this keeps the
// session cookie first-party. Browsers block third-party cookies across
// *.onrender.com subdomains, so never point VITE_API_URL at another domain.
const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

// Backend-served assets (e.g. avatar bytes) need the API origin in dev.
export function apiUrl(path) {
  return `${BASE}${path}`;
}

async function request(path, { method = "GET", body, formData } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    // FormData sets its own multipart Content-Type; only JSON bodies get the header
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) {
    // Session cookie expired/cleared but a user is still remembered locally:
    // forget them and start over at sign-in. (Skipped on the auth pages so a
    // mistyped password doesn't trigger a reload loop.)
    const onAuthPage = ["/signin", "/signup"].includes(window.location.pathname);
    if (res.status === 401 && currentUser() && !onAuthPage) {
      localStorage.removeItem(USER_KEY);
      window.location.assign("/signin");
    }
    const msg = await res.json().catch(() => ({}));
    const err = new Error(msg.detail || msg.message || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// {lat: 1, lng: null} -> "?lat=1" (null/undefined/"" params dropped)
function toQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// The signed-in user ({user_id, username, email}), mirrored in localStorage so
// pages know who "me" is. The session itself lives in the http-only cookie.
const USER_KEY = "branch_user";
export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}
function rememberUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export const api = {
  // auth — signup and login both start a session and remember the user
  signup: (data) =>
    request("/api/auth/signup", { method: "POST", body: data }).then(rememberUser),
  login: (data) =>
    request("/api/auth/login", { method: "POST", body: data }).then(rememberUser),
  logout: () =>
    request("/api/auth/logout", { method: "POST" }).finally(() =>
      localStorage.removeItem(USER_KEY)
    ),
  // events
  listEvents: (filters = {}) => request(`/api/events${toQuery(filters)}`),
  getEvent: (id) => request(`/api/events/${id}`),
  createEvent: (data) => request("/api/events", { method: "POST", body: data }),
  updateEvent: (id, data) => request(`/api/events/${id}`, { method: "PATCH", body: data }),
  deleteEvent: (id) => request(`/api/events/${id}`, { method: "DELETE" }),
  uploadEventFlyer: (eventId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/events/${eventId}/flyer`, { method: "PUT", formData });
  },
  selectFlyerTemplate: (eventId, templateId) =>
    request(`/api/events/${eventId}/flyer/template`, {
      method: "PUT",
      body: { template_id: templateId },
    }),
  removeEventFlyer: (eventId) => request(`/api/events/${eventId}/flyer`, { method: "DELETE" }),
  // rsvps
  rsvp: (eventId) => request(`/api/events/${eventId}/rsvps`, { method: "POST", body: {} }),
  getEventRsvps: (eventId, filters = {}) =>
    request(`/api/events/${eventId}/rsvps${toQuery(filters)}`),
  getUserRsvps: (userId) => request(`/api/users/${userId}/rsvps`),
  updateRsvp: (rsvpId, data) => request(`/api/rsvps/${rsvpId}`, { method: "PATCH", body: data }),
  deleteRsvp: (rsvpId) => request(`/api/rsvps/${rsvpId}`, { method: "DELETE" }),
  checkIn: (eventId, code) =>
    request(`/api/events/${eventId}/check-in`, { method: "POST", body: { code } }),
  // users / profiles
  getUser: (userId) => request(`/api/users/${userId}`),
  deleteAccount: (userId) =>
    request(`/api/users/${userId}`, { method: "DELETE" }).then((res) => {
      localStorage.removeItem(USER_KEY);
      return res;
    }),
  getProfile: (userId) => request(`/api/profiles/${userId}`),
  createProfile: (data) => request("/api/profiles", { method: "POST", body: data }),
  updateProfile: (userId, data) =>
    request(`/api/profiles/${userId}`, { method: "PATCH", body: data }),
  uploadProfilePicture: (userId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/profiles/${userId}/picture`, { method: "PUT", formData });
  },
  removeProfilePicture: (userId) =>
    request(`/api/profiles/${userId}/picture`, { method: "DELETE" }),
  // interests / tags
  listTags: () => request("/api/tags"),
  getUserInterests: (userId) => request(`/api/users/${userId}/interests`),
  addInterest: (userId, tagId) =>
    request(`/api/users/${userId}/interests`, { method: "POST", body: { tag_id: tagId } }),
  removeInterest: (userId, tagId) =>
    request(`/api/users/${userId}/interests/${tagId}`, { method: "DELETE" }),
  // standings / neighborhoods
  getUserStandings: (userId) => request(`/api/users/${userId}/standings`),
  getNeighborhoodStandings: (neighborhoodId, filters = {}) =>
    request(`/api/neighborhoods/${neighborhoodId}/standings${toQuery(filters)}`),
  listNeighborhoods: (filters = {}) => request(`/api/neighborhoods${toQuery(filters)}`),
  // recommendations
  getRecommendations: (userId) => request(`/api/users/${userId}/recommendations`),
  refreshRecommendations: (userId) =>
    request(`/api/users/${userId}/recommendations/refresh`, { method: "POST" }),
};
