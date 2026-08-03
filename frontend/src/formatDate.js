// Shared date/time formatting so every screen renders event times the same way.
export function formatEventDateTime(dateInput) {
  return new Date(dateInput).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
