import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("sf_theme") ?? "light");
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sf_theme", theme);
  }, [theme]);

  async function refresh() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      setUser(data.user);
      const invite = sessionStorage.getItem("safeflight_invite");
      if (data.user && invite) {
        await fetch(`/api/invite/${invite}/accept`, {
          method: "POST",
          credentials: "include",
        });
        sessionStorage.removeItem("safeflight_invite");
      }
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
          <Link to="/" className="brand">
            <span className="brand-text">SafeFlight</span>
            <svg className="brand-heart" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20.5S4.5 15.6 2.6 11.7C1 8.4 3 5 6.4 5c2 0 3.5 1.2 4.4 2.7L12 9.5l1.2-1.8C14.1 6.2 15.6 5 17.6 5 21 5 23 8.4 21.4 11.7 19.5 15.6 12 20.5 12 20.5z" />
            </svg>
            <span className="brand-plane" aria-hidden="true">✈</span>
          </Link>
          <nav>
            <button
                className="theme-toggle"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            {user ? (
                <UserMenu user={user} onLogout={logout} />
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

function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
      <div className="user-menu" ref={ref}>
        <button className="user-menu-btn" onClick={() => setOpen((v) => !v)}>
          {user.avatarUrl ? (
              <img className="nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
              <span className="nav-avatar nav-avatar-fallback">{user.name.charAt(0)}</span>
          )}
        </button>
        {open && (
            <div className="user-dropdown">
              <div className="user-dropdown-head">
                {user.avatarUrl ? (
                    <img className="nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                    <span className="nav-avatar nav-avatar-fallback">{user.name.charAt(0)}</span>
                )}
                <div>
                  <div className="user-dropdown-name">{user.name}</div>
                  <div className="user-dropdown-email">{user.email}</div>
                </div>
              </div>
              <Link to="/friends" onClick={() => setOpen(false)}>Friends</Link>
              <button onClick={onLogout}>Sign out</button>
            </div>
        )}
      </div>
  );
}