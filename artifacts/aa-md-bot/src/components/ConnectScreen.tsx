import { useState, useRef } from "react";
import type { SessionInfo } from "../App";

const CHANNEL_URL = "https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617";

interface Props {
  onConnected: (info: SessionInfo) => void;
}

type Mode = "pair" | "qr";
type Step = "form" | "code" | "qr" | "done";

export default function ConnectScreen({ onConnected }: Props) {
  const [mode, setMode] = useState<Mode>("pair");
  const [step, setStep] = useState<Step>("form");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("----");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const sessRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    clearInterval(pollRef.current!);
    sessRef.current = null;
    setStep("form");
    setCode("----");
    setError("");
    setLoading(false);
    setPhone("");
    setCopied(false);
  }

  async function connect() {
    setError("");
    const cleaned = phone.replace(/\D/g, "");
    if (mode === "pair" && (cleaned.length < 7 || cleaned.length > 15)) {
      setError("Please enter a valid number with country code (e.g. 923001234567)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: cleaned, useQR: mode === "qr" }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error || "Server error. Please try again.");
        setLoading(false);
        return;
      }
      sessRef.current = d.sessionId;
      setStep(mode === "pair" ? "code" : "qr");
      setLoading(false);
      poll();
    } catch {
      setError("Cannot connect to server. Please check your connection.");
      setLoading(false);
    }
  }

  function poll() {
    clearInterval(pollRef.current!);
    pollRef.current = setInterval(async () => {
      if (!sessRef.current) return;
      try {
        const d = await fetch("/api/bot/status/" + sessRef.current).then(r => r.json());
        if (d.pairingCode && d.pairingCode !== code) setCode(d.pairingCode);
        if (d.status === "connected") {
          clearInterval(pollRef.current!);
          setStep("done");
          setTimeout(() => {
            onConnected({
              sessId: sessRef.current!,
              number: d.botNumber || phone.replace(/\D/g, ""),
              name: d.botName,
            });
          }, 1000);
        }
      } catch {}
    }, 1200);
  }

  function copyCode() {
    navigator.clipboard.writeText(code.replace(/-/g, "")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="cs-wrap">
      {/* Logo */}
      <div className="cs-logo">
        <img src="/logo.jpeg" alt="AA MD Bot" />
        <div>
          <div className="cs-logo-text">AA MD Bot</div>
          <div className="cs-logo-sub">by Ahsan Ali | AA Mods</div>
        </div>
      </div>

      {/* Card */}
      <div className="cs-card">
        {step === "form" && (
          <>
            <div className="cs-title">🤖 Connect WhatsApp Bot</div>
            <div className="cs-sub">Link your number to start the bot</div>

            <div className="mode-tabs">
              <button className={`mode-tab${mode === "pair" ? " active" : ""}`} onClick={() => setMode("pair")}>
                🔑 Pairing Code
              </button>
              <button className={`mode-tab${mode === "qr" ? " active" : ""}`} onClick={() => setMode("qr")}>
                📷 QR Code
              </button>
            </div>

            {mode === "pair" ? (
              <div style={{ marginBottom: 4 }}>
                <label className="field-label">WhatsApp Number</label>
                <input
                  className="field-input"
                  type="tel"
                  placeholder="923001234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  maxLength={15}
                  onKeyDown={e => e.key === "Enter" && connect()}
                />
                <p className="field-hint">Include country code, no + or spaces</p>
              </div>
            ) : (
              <div className="qr-hint">
                📷 A QR code will appear after clicking Start.<br />
                Open <strong>WhatsApp → Linked Devices → Link a Device</strong> and scan it.
              </div>
            )}

            {error && <div className="cs-error">⚠️ {error}</div>}

            <button className="btn-connect" disabled={loading} onClick={connect}>
              {loading ? <><span className="spin" />Connecting...</> : "Start Bot →"}
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <div className="cs-title">🔑 Enter Pairing Code</div>
            <div className="cs-sub">Open WhatsApp and enter this code</div>
            <div className="pair-box">
              <div className="pair-digits">{code}</div>
              <button className="pair-copy" onClick={copyCode}>
                {copied ? "✅ Copied!" : "📋 Copy Code"}
              </button>
            </div>
            <div className="pair-steps">
              <strong>Step 1</strong> — Open WhatsApp on your phone<br />
              <strong>Step 2</strong> — Tap ⋮ Menu → Linked Devices → Link a Device<br />
              <strong>Step 3</strong> — Tap "Link with phone number instead"<br />
              <strong>Step 4</strong> — Enter the code above
            </div>
            <div className="pair-status">
              <span className="dot dot-yellow" />
              Waiting for code to be entered...
            </div>
            <button style={{ width: "100%", marginTop: 14, background: "transparent", border: "1px solid var(--border)", borderRadius: 9, padding: "9px", fontSize: 12, color: "var(--muted)", cursor: "pointer" }} onClick={reset}>
              ← Start Over
            </button>
          </>
        )}

        {step === "qr" && (
          <>
            <div className="cs-title">📷 Scan QR Code</div>
            <div className="cs-sub">Use WhatsApp camera to scan</div>
            <div className="qr-box">
              <div className="qr-wrap">
                <div className="qr-placeholder">
                  <span style={{ fontSize: 32 }}>⏳</span>
                  QR Loading...
                </div>
              </div>
              <div className="pair-status">
                <span className="dot dot-yellow" />
                Waiting for scan...
              </div>
            </div>
            <button style={{ width: "100%", marginTop: 10, background: "transparent", border: "1px solid var(--border)", borderRadius: 9, padding: "9px", fontSize: 12, color: "var(--muted)", cursor: "pointer" }} onClick={reset}>
              ← Start Over
            </button>
          </>
        )}

        {step === "done" && (
          <div className="pair-success">
            <div className="pair-success-icon">✅</div>
            <div className="pair-success-title">Bot Connected!</div>
            <div className="pair-success-sub">Loading your dashboard...</div>
          </div>
        )}
      </div>

      {/* Channel link below card */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn-channel">
          📢 Follow WhatsApp Channel
        </a>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          Get updates, tips & new features
        </div>
      </div>
    </div>
  );
}
