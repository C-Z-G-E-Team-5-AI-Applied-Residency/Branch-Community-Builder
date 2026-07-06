// Thin fetch wrapper. Sends cookies so the session survives across requests.
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  // auth
  signup: (data) => request("/api/auth/signup", { method: "POST", body: data }),
  login: (data) => request("/api/auth/login", { method: "POST", body: data }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  // events
  listEvents: (params = "") => request(`/api/events${params}`),
  getEvent: (id) => request(`/api/events/${id}`),
  createEvent: (data) => request("/api/events", { method: "POST", body: data }),
  rsvp: (eventId) => request(`/api/events/${eventId}/rsvps`, { method: "POST", body: {} }),
  checkIn: (eventId, code) =>
    request(`/api/events/${eventId}/check-in`, { method: "POST", body: { code } }),
  // profiles / recommendations / tags
  getProfile: (userId) => request(`/api/profiles/${userId}`),
  getRecommendations: (userId) => request(`/api/users/${userId}/recommendations`),
  refreshRecommendations: (userId) =>
    request(`/api/users/${userId}/recommendations/refresh`, { method: "POST" }),
  listTags: () => request("/api/tags"),
};
