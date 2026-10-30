import { Component, useEffect, useState } from "react";
import { auth, isConfigured, signIn, logOut, watchAuth } from "./firebase.js";
import BudgetLedger from "./BudgetLedger.jsx";

// Catches render-time errors so the app shows a message instead of a blank
// screen, and lets you get back in without losing your sign-in.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Budget Ledger crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={styles.center}>
          <div style={styles.card}>
            <div style={styles.title}>Something went wrong</div>
            <p style={styles.text}>{String(this.state.error.message || this.state.error)}</p>
            <button style={styles.signInBtn} onClick={() => { this.setState({ error: null }); location.reload(); }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ConfigWarning() {
  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <div style={styles.title}>Almost there</div>
        <p style={styles.text}>
          This app needs your Firebase project's config in a <code>.env.local</code> file before it can run.
          Open <code>SETUP.md</code> in this project for the step-by-step walkthrough, copy <code>.env.example</code> to <code>.env.local</code>, fill in your values, then restart or rebuild.
        </p>
      </div>
    </div>
  );
}

function SignInScreen({ error }) {
  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <div style={styles.eyebrow}>Personal Ledger</div>
        <div style={styles.title}>Sign in to continue</div>
        <p style={styles.text}>Your budget syncs across every device you sign into with this account.</p>
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.signInBtn} onClick={() => signIn()}>
          <GoogleIcon /> Continue with Google
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.1-11.4-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4.3 5.9l6.5 5.4C40.9 35.9 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [authError, setAuthError] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    if (!isConfigured) return;
    const unsub = watchAuth(setUser);
    return unsub;
  }, []);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (!isConfigured) return <ConfigWarning />;
  if (user === undefined) return <div style={styles.center}><div style={styles.text}>Loading...</div></div>;
  if (!user) return <SignInScreen error={authError} />;

  return (
    <ErrorBoundary>
      <BudgetLedger
        uid={user.uid}
        userEmail={user.email}
        onSignOut={() => logOut()}
        installPrompt={installPrompt}
        onInstall={handleInstall}
      />
    </ErrorBoundary>
  );
}

const styles = {
  center: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF7F0", fontFamily: "'Inter', sans-serif", padding: 20 },
  card: { background: "#fff", border: "1px solid #EFE9DC", borderRadius: 16, padding: "32px 28px", maxWidth: 380, width: "100%", boxShadow: "0 12px 40px rgba(27,42,74,0.08)" },
  eyebrow: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8371", fontWeight: 600, marginBottom: 6 },
  title: { fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, color: "#1B2A4A", marginBottom: 10 },
  text: { fontSize: 13.5, color: "#463F33", lineHeight: 1.6, marginBottom: 20 },
  error: { fontSize: 12.5, color: "#B5502B", marginBottom: 14 },
  signInBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, border: "1px solid #E7E1D3", background: "#fff", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#2A2620", cursor: "pointer" },
};
