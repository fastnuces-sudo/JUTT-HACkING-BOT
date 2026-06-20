import { useState, useEffect, useRef } from "react";

interface Props { apiHeaders: Record<string, string> }

export default function TabSessions({ apiHeaders }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [asMode, setAsMode] = useState<"pair" | "qr">("pair");
  const [asPhone, setAsPhone] = useState("");
  const [asCode, setAsCode] = useState("----");
  const [asStep, setAsStep] = useState<"form" | "code" | "qr" | "ok">("form");
  const [asErr, setAsErr] = useState("");
  const sessRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const d = await fetch("/api/admin/sessions", { headers: apiHeaders }).then(r => r.json());
      setSessions(d.sessions || []);
    } catch {}
    setLoading(false);
  }

  async function disconnect(sessId: string) {
    if (!confirm("Is session ko disconnect karein?")) return;
    await fetch("/api/bot/disconnect/" + sessId, { method: "DELETE", headers: apiHeaders }).catch(() => {});
    loadSessions();
  }

  async function asStart() {
    setAsErr("");
    const phone = asPhone.replace(/\D/g, "");
    if (asMode === "pair" && (phone.length < 7 || phone.length > 15)) {
      setAsErr("❌ Sahi number dalain");
      return;
    }
    try {
      const d = await fetch("/api/bot/start", {
        method: "POST",
        headers: { ...apiHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, useQR: asMode === "qr" }),
      }).then(r => r.json());
      if (!d.success) { setAsErr("❌ " + (d.error || "Failed")); return; }
      sessRef.current = d.sessionId;
      setAsStep(asMode === "pair" ? "code" : "qr");
      asPoll();
    } catch { setAsErr("❌ Network error"); }
  }

  function asPoll() {
    clearInterval(pollRef.current!);
    pollRef.current = setInterval(async () => {
      if (!sessRef.current) return;
      const d = await fetch("/api/bot/status/" + sessRef.current).then(r => r.json()).catch(() => ({}));
      if (d.pairingCode) setAsCode(d.pairingCode);
      if (d.status === "connected") {
        clearInterval(pollRef.current!);
        setAsStep("ok");
        setTimeout(() => { closeAdd(); loadSessions(); }, 1500);
      }
    }, 1500);
  }

  function closeAdd() {
    clearInterval(pollRef.current!);
    sessRef.current = null;
    setShowAdd(false);
    setAsStep("form");
    setAsCode("----");
    setAsErr("");
    setAsPhone("");
  }

  return (
    <div>
      <div className="tab-header">
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={loadSessions}>🔄 Refresh</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>➕ Naya Connect</button>
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table>
          <thead><tr><th>Number</th><th>Status</th><th>Session ID</th><th>Action</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}><span className="spin" />Loading...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>Koi session nahi mili</td></tr>
            ) : sessions.map((s: any, i: number) => (
              <tr key={i}>
                <td className="td-num">+{s.number || "Unknown"}</td>
                <td>
                  <span className={`badge badge-${s.status === "connected" ? "green" : "gray"}`}>
                    <span className={`dot dot-${s.status === "connected" ? "green" : "gray"}`} style={{ width: 6, height: 6 }} />
                    {s.status}
                  </span>
                </td>
                <td className="td-muted" style={{ fontFamily: "monospace", fontSize: 11 }}>{s.sessionId}</td>
                <td>
                  <button className="btn-ban" onClick={() => disconnect(s.sessionId)}>Disconnect</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Session Box */}
      {showAdd && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, maxWidth: 400 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🔗 Naya Session Connect Karein</div>
          {asStep === "form" && (
            <>
              <div className="mode-toggle" style={{ maxWidth: 320 }}>
                <button className={`mode-btn${asMode === "pair" ? " active" : ""}`} onClick={() => setAsMode("pair")}>🔑 Pairing Code</button>
                <button className={`mode-btn${asMode === "qr" ? " active" : ""}`} onClick={() => setAsMode("qr")}>📷 QR Code</button>
              </div>
              {asMode === "pair" ? (
                <div>
                  <label className="form-label">Phone Number</label>
                  <input className="form-input" type="tel" placeholder="923xxxxxxxxx" value={asPhone} onChange={e => setAsPhone(e.target.value)} maxLength={15} />
                  <p className="form-hint">Country code ke saath</p>
                </div>
              ) : (
                <div className="qr-note">📷 QR code "Start" ke baad dikhega</div>
              )}
              {asErr && <div className="connect-error">{asErr}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button className="btn-primary" onClick={asStart}>Start →</button>
                <button className="btn-ghost" onClick={closeAdd}>Cancel</button>
              </div>
            </>
          )}
          {asStep === "code" && (
            <div>
              <div className="code-box" style={{ maxWidth: 320 }}>
                <div className="code-digits">{asCode}</div>
                <button className="copy-code-btn" onClick={() => navigator.clipboard.writeText(asCode.replace(/-/g, "")).catch(() => {})}>📋 Copy</button>
              </div>
              <div className="pair-status"><span className="dot dot-yellow" />Code darj hone ka intezaar...</div>
            </div>
          )}
          {asStep === "qr" && (
            <div style={{ textAlign: "center" }}>
              <div className="qr-wrap"><div className="qr-placeholder">⏳ QR Load ho raha hai...</div></div>
              <div className="pair-status"><span className="dot dot-yellow" />Scan ka intezaar...</div>
            </div>
          )}
          {asStep === "ok" && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--muted)" }}>Session connected!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
