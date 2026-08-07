import { createContext, useContext, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function refresh() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    navigate("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      <header className="nav">
        <Link to="/" className="brand">✈ FlightTrack</Link>
        <nav>
          <Link to="/map">Map</Link>
          {user ? (
            <button onClick={logout}>Sign out ({user.name})</button>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </AuthContext.Provider>
  );
}
