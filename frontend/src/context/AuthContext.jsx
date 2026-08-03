// Shared auth state so any component gets live sign-in/out updates without a
// route change. client.js fires a "branch:user" event after every localStorage
// write (signup/login/logout/account deletion); we listen once here and fan the
// current user out through context, instead of each component re-registering
// its own window listener (which is how the Header bug slipped in originally).
import { createContext, useContext, useEffect, useState } from "react";
import { currentUser } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(currentUser());

  useEffect(() => {
    const sync = () => setUser(currentUser());
    window.addEventListener("branch:user", sync);
    return () => window.removeEventListener("branch:user", sync);
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

// The signed-in user ({user_id, username, email}) or null. Updates live as the
// auth state changes, so components re-render on sign-in/out without a refresh.
export function useAuth() {
  return useContext(AuthContext);
}
