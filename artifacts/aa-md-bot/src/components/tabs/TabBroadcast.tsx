import { useState, useEffect } from "react";

interface Props { apiHeaders: Record<string, string> }

export default function TabBroadcast({ apiHeaders }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selSession, setSelSession] = useState("");
  const [msgText, setMsgText] = useState("");
  const [userCount, setUserCount] = useState("...");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [resultOk, setResultOk] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const ss = await fetch("/api/admin/sessions", { headers: apiHeaders }).then(r => r.json());
      const connected = (ss.sessions || []).filter((s: any) => s.status === "connected");
      setSessions(connected);
    } catch {}
    try {
      const u = await fetch("/api/admin/users", { headers: apiHeaders }).then(r => r.json());
      const active = (u.users || []).filter((x: any) => !x.banned).length;
      setUserCount(active + " user" + (active !== 1 ? "s" : "") + " ko milega");
    } catch {
      setUserCount("—");
    }
  }

  async function send() {
    if (!msgText.trim()) {
      setResultOk(false); setResult("❌ Pehle message type karein"); return;
    }
    setSending(true); setResult("");
    try {
      const d = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { ...apiHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText.trim(), sessionId: selSession }),
      }).then(r => r.json());
      setResultOk(d.success);
      setResult(d.success
        ? `✅ ${d.sent} user(s) ko bheja (${d.failed} fail, ${d.total} total)`
        : "❌ " + (d.error || "Broadcast fail"));
      if (d.success) setMsgText("");
    } catch {
      setResultOk(false); setResult("❌ Network error — kya bot connected hai?");
    } finally {
      setSending(false);
      setTimeout(() => setResult(""), 8000);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 14 }}>
          📢 Broadcast Message Bhejein
        </div>

        {sessions.length > 0 && (
          <div className="setting-row">
            <label className="form-label">Session</label>
            <select
              className="setting-input"
              value={selSession}
              onChange={e => setSelSession(e.target.value)}
              style={{ background: "#1a2233", color: "var(--text)" }}
            >
              <option value="">Auto (pehla connected)</option>
              {sessions.map((s: any) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.number ? "+" + s.number + " — " : ""}{s.sessionId}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="setting-row">
          <label className="form-label">Message</label>
          <textarea
            className="setting-input"
            rows={6}
            placeholder={"Apna broadcast message type karein...\n\nWhatsApp formatting:\n*bold*  _italic_  ~strikethrough~"}
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            style={{ resize: "vertical", lineHeight: 1.6 }}
          />
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Sirf un users ko bheja jata hai jo pehle bot se baat kar chuke hain
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          <button className="btn-primary" onClick={send} disabled={sending}>
            {sending ? <><span className="spin" />Bhej raha hai...</> : "📤 Broadcast Bhejein"}
          </button>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{userCount}</div>
        </div>

        {result && (
          <div className={`settings-msg ${resultOk ? "msg-ok" : "msg-err"}`} style={{ marginTop: 14 }}>{result}</div>
        )}
      </div>

      {/* Guidelines */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, minWidth: 260 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>
          ⚠️ Guidelines
        </div>
        <ul style={{ fontSize: 13, color: "var(--muted)", lineHeight: 2.2, paddingLeft: 18 }}>
          <li>Sirf un users ko bheja jata hai jo bot se baat kar chuke hain</li>
          <li>Banned users automatically exclude hote hain</li>
          <li>Rate limits se bachne ke liye delay add hota hai</li>
          <li>Zyada broadcasts se number risk mein aa sakta hai</li>
          <li>Formatting: <code style={{ color: "var(--green)" }}>*bold*</code>, <code style={{ color: "var(--green)" }}>_italic_</code>, <code style={{ color: "var(--green)" }}>~strike~</code></li>
        </ul>
      </div>
    </div>
  );
}
