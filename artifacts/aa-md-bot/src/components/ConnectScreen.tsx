import { useState, useRef } from "react";
import type { SessionInfo } from "../App";

const OWNER_NUMBER = "923346741532";

interface Props {
  onConnected: (info: SessionInfo) => void;
  onAdminLogin: (token: string) => void;
}

export default function ConnectScreen({ onConnected, onAdminLogin }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [cmode, setCmode] = useState<"pair" | "qr">("pair");
  const [step, setStep] = useState<"s1" | "s2pair" | "s2qr" | "s3">("s1");
  const [code, setCode] = useState("----");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const sessRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    clearInterval(pollRef.current!);
    sessRef.current = null;
    setStep("s1");
    setCode("----");
    setError("");
    setLoading(false);
    setPhone("");
    setShowAdminLogin(false);
    setCmode("pair");
  }

  async function cStart() {
    setError("");
    const cleaned = phone.replace(/\D/g, "");
    if (cmode === "pair" && (cleaned.length < 7 || cleaned.length > 15)) {
      setError("❌ Sahi number dalain — country code ke saath (e.g. 923001234567)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: cleaned, useQR: cmode === "qr" }),
      });
      const d = await res.json();
      if (!d.success) {
        setError("❌ " + (d.error || "Server error"));
        setLoading(false);
        return;
      }
      sessRef.current = d.sessionId;
      setStep(cmode === "pair" ? "s2pair" : "s2qr");
      setLoading(false);
      startPoll();
    } catch {
      setError("❌ Server se connect nahi ho pa raha. Dobara koshish karein.");
      setLoading(false);
    }
  }

  function startPoll() {
    clearInterval(pollRef.current!);
    pollRef.current = setInterval(async () => {
      if (!sessRef.current) return;
      try {
        const d = await fetch("/api/bot/status/" + sessRef.current).then((r) =>
          r.json()
        );
        if (d.pairingCode) setCode(d.pairingCode);
        if (d.status === "connected") {
          clearInterval(pollRef.current!);
          setStep("s3");
          setTimeout(() => {
            onConnected({
              sessId: sessRef.current!,
              number: d.botNumber || phone.replace(/\D/g, ""),
            });
          }, 1200);
        }
      } catch {}
    }, 1500);
  }

  function copyCode() {
    navigator.clipboard.writeText(code.replace(/-/g, "")).catch(() => {});
  }

  function doAdminLogin() {
    setAdminErr("");
    if (!adminEmail || !adminPass) {
      setAdminErr("Email aur password zaroori hai");
      return;
    }
    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.token) {
          onAdminLogin(d.token);
        } else {
          setAdminErr("❌ " + (d.error || "Login fail — galat credentials"));
        }
      })
      .catch(() => setAdminErr("❌ Network error"));
  }

  return (
    <div className={`connect-screen${panelOpen ? " panel-open" : ""}`}>
      {/* Left — Branding */}
      <div className="connect-left">
        <div className="connect-logo">
          <img src="/logo.jpeg" alt="AA MD Bot" />
          <div>
            <div className="connect-logo-title">AA MD Bot</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              by Ahsan Ali | AA Mods
            </div>
          </div>
        </div>
        <div className="connect-hero">
          <h1>
            Aapka Smart
            <br />
            <span>WhatsApp Assistant</span>
          </h1>
          <p>
            Apna WhatsApp number connect karein aur bot activate karein. 100+
            commands, AI chat, media downloads, group management aur bahut
            kuch — seedha WhatsApp mein.
          </p>
        </div>
        <div className="features-list">
          <div className="feature-item">
            <div className="feature-icon">📥</div>
            <span>
              <strong style={{ color: "var(--text)" }}>Downloader</strong> —
              YouTube, TikTok, Instagram &amp; more
            </span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">👥</div>
            <span>
              <strong style={{ color: "var(--text)" }}>Group Tools</strong> —
              Admin commands, welcome, anti-spam
            </span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🤖</div>
            <span>
              <strong style={{ color: "var(--text)" }}>AI Chat</strong> —
              Gemini AI ke saath chat karein
            </span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🎮</div>
            <span>
              <strong style={{ color: "var(--text)" }}>Games &amp; Economy</strong>{" "}
              — Fun commands, coins, leaderboards
            </span>
          </div>
        </div>
        <button className="btn-cta-connect" onClick={() => setPanelOpen(true)}>
          🚀 Bot Connect Karein →
        </button>
      </div>

      {/* Right — Connect form */}
      <div className="connect-right">
        <button
          className="btn-back-to-about"
          onClick={() => {
            setPanelOpen(false);
            reset();
          }}
        >
          ← Wapas jain
        </button>

        <div className="connect-card">
          <h2>🤖 Bot Connect Karein</h2>
          <p className="sub">
            Apna WhatsApp number enter karein ya QR scan karein
          </p>

          {/* Step 1 */}
          {step === "s1" && !showAdminLogin && (
            <>
              <div className="mode-toggle">
                <button
                  className={`mode-btn${cmode === "pair" ? " active" : ""}`}
                  onClick={() => setCmode("pair")}
                >
                  🔑 Pairing Code
                </button>
                <button
                  className={`mode-btn${cmode === "qr" ? " active" : ""}`}
                  onClick={() => setCmode("qr")}
                >
                  📷 QR Code
                </button>
              </div>

              {cmode === "pair" && (
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="923xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={15}
                  />
                  <p className="form-hint">
                    Country code ke saath, bina + ya spaces ke
                  </p>
                </div>
              )}

              {cmode === "qr" && (
                <div className="qr-note">
                  📷 QR code "Start" button press karne ke baad dikhega.
                  WhatsApp → Linked Devices → Link a Device mein scan karein.
                </div>
              )}

              {error && <div className="connect-error">{error}</div>}

              <button
                className="btn-connect"
                disabled={loading}
                onClick={cStart}
              >
                {loading ? (
                  <>
                    <span className="spin" />
                    Connect ho raha hai...
                  </>
                ) : (
                  "Shuru Karein →"
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  onClick={() => setShowAdminLogin(true)}
                >
                  🔐 Admin Login
                </button>
              </div>
            </>
          )}

          {/* Admin Login Panel */}
          {step === "s1" && showAdminLogin && (
            <div className="fb-login-panel">
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 14,
                  color: "var(--text)",
                }}
              >
                🔐 Admin Panel Login
              </div>
              <div className="setting-row">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="admin@example.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div className="setting-row">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doAdminLogin()}
                />
              </div>
              {adminErr && (
                <div className="connect-error">{adminErr}</div>
              )}
              <button
                className="btn-connect"
                onClick={doAdminLogin}
                style={{ marginBottom: 8 }}
              >
                🔐 Login Karein
              </button>
              <button
                className="btn-ghost"
                style={{ width: "100%", marginTop: 6 }}
                onClick={() => setShowAdminLogin(false)}
              >
                ← Wapas
              </button>
            </div>
          )}

          {/* Step 2 — Pairing Code */}
          {step === "s2pair" && (
            <div>
              <div className="code-box">
                <div className="code-digits">{code}</div>
                <button className="copy-code-btn" onClick={copyCode}>
                  📋 Copy
                </button>
              </div>
              <div className="steps-info">
                <strong>WhatsApp → Linked Devices → Link a Device</strong>
                <br />→ "Link with phone number instead"
                <br />→ Yeh code darj karein
              </div>
              <div className="pair-status">
                <span className="dot dot-yellow" />
                Code darj hone ka intezaar hai...
              </div>
            </div>
          )}

          {/* Step 2 — QR */}
          {step === "s2qr" && (
            <div className="step-qr" style={{ display: "block" }}>
              <div className="qr-wrap">
                <div className="qr-placeholder">⏳ QR Load ho raha hai...</div>
              </div>
              <div className="pair-status">
                <span className="dot dot-yellow" />
                Scan ka intezaar hai...
              </div>
            </div>
          )}

          {/* Step 3 — Success */}
          {step === "s3" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 56 }}>✅</div>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--green)",
                }}
              >
                Bot Connected!
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                Redirect ho raha hai...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
