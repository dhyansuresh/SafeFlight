export default function Login() {
  return (
    <div className="card center">
      <h1>Sign in</h1>
      <p>Track your flights and share them with friends and family.</p>
      {/* Full page redirect — OAuth cannot happen via fetch/XHR. */}
      <a className="btn" href="/api/auth/google">
        Continue with Google
      </a>
    </div>
  );
}
