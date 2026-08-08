import { Navigate } from "react-router-dom";
import { useAuth } from "../App";

export default function Login() {
    const { user, loading } = useAuth();
    if (!loading && user) return <Navigate to="/" replace />;
    return (
        <div className="login-wrap">
            <div className="login-card">
                <div className="login-brand">
                    <span className="login-title">SafeFlight</span>
                    <svg className="login-heart" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20.5S4.5 15.6 2.6 11.7C1 8.4 3 5 6.4 5c2 0 3.5 1.2 4.4 2.7L12 9.5l1.2-1.8C14.1 6.2 15.6 5 17.6 5 21 5 23 8.4 21.4 11.7 19.5 15.6 12 20.5 12 20.5z" />
                    </svg>
                </div>
                <p className="login-tag">Know they landed safe.</p>
                <p className="login-sub">
                    Worry no longer! SafeFlight provides you with the ability to track the flights of your
                    loved ones. Make sure they have a safe flight anywhere they go.
                </p>

                <a className="google-btn" href="/api/auth/google">
                    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
                        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.93v2.33A9 9 0 0 0 9 18z" />
                        <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.93a9 9 0 0 0 0 8.1l3.04-2.33z" />
                        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .93 4.95l3.04 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                    </svg>
                    Continue with Google
                </a>

                <div className="login-points">
                    <div className="login-point">
                        Live route &amp; position on a map
                    </div>
                    <div className="login-point">
                        Follow friends &amp; family automatically
                    </div>
                    <div className="login-point">
                        Share any flight with one link
                    </div>
                </div>
            </div>
        </div>
    );
}