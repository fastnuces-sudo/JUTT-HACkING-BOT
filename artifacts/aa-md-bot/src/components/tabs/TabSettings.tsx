import { useState, useEffect } from "react";
import type { SessionInfo } from "../../App";

interface Props { apiHeaders: Record<string, string>; session: SessionInfo | null }

const OWNER_NUMBER = "923346741532";

export default function TabSettings({ apiHeaders, session }: Props) {
  const [s, setS] = useState<any>({});
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const d = await fetch("/api/admin/settings", { headers: apiHeaders }).then(r => r.json());
      setS(d);
    } catch {}
  }

  async function save() {
    setMsg("");
    try {
      const d = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { ...apiHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(s),
      }).then(r => r.json());
      setMsgOk(d.success !== false);
      setMsg(d.note || (d.success !== false ? "✅ Settings save ho gayi!" : "❌ Save fail"));
      setTimeout(() => setMsg(""), 5000);
    } catch {
      setMsgOk(false);
      setMsg("❌ Network error");
    }
  }

  function up(key: string, val: any) { setS((prev: any) => ({ ...prev, [key]: val })); }

  const Toggle = ({ id, label, sub }: { id: string; label: string; sub?: string }) => (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <label className="toggle-switch">
        <input type="checkbox" checked={!!s[id]} onChange={e => up(id, e.target.checked)} />
        <span className="slider" />
      </label>
    </div>
  );

  return (
    <div>
      <div className="settings-grid">
        {/* Bot Identity */}
        <div className="settings-section">
          <div className="settings-section-title">🤖 Bot Identity</div>
          <div className="setting-row">
            <label>Bot Ka Naam</label>
            <input className="setting-input" value={s.botName || ""} onChange={e => up("botName", e.target.value)} placeholder="AA MD Bot" />
          </div>
          <div className="setting-row">
            <label>Owner Ka Naam</label>
            <input className="setting-input" value={s.ownerName || ""} onChange={e => up("ownerName", e.target.value)} />
          </div>
          <div className="setting-row">
            <label>Command Prefix</label>
            <input className="setting-input" value={s.prefix || "."} onChange={e => up("prefix", e.target.value)} maxLength={5} style={{ width: 90 }} />
          </div>
          <div className="setting-row">
            <label>Owner Number (read-only)</label>
            <input className="setting-input" value={s.ownerNumber || OWNER_NUMBER} readOnly style={{ opacity: .5 }} />
          </div>
        </div>

        {/* Behavior */}
        <div className="settings-section">
          <div className="settings-section-title">⚙️ Bot Behavior</div>
          <Toggle id="autoRead" label="Auto Read Messages" sub="Saare messages padhle mark karein" />
          <Toggle id="autoTyping" label="Auto Typing" sub="Commands par typing indicator dikhao" />
          <Toggle id="autoReply" label="Auto Reply" sub="DMs mein non-command messages ka jawab do" />
          {s.autoReply && (
            <div className="setting-row" style={{ marginTop: 10 }}>
              <label>Auto Reply Message</label>
              <input className="setting-input" value={s.autoReplyMessage || ""} onChange={e => up("autoReplyMessage", e.target.value)} placeholder="Hello! .menu bhejein commands ke liye." />
            </div>
          )}
        </div>

        {/* Auto React & Status */}
        <div className="settings-section">
          <div className="settings-section-title">❤️ Auto React & Status</div>
          <Toggle id="autoReactMessages" label="Auto React Messages" sub="Har incoming message par emoji react karo" />
          {s.autoReactMessages && (
            <div className="setting-row" style={{ marginTop: 8 }}>
              <label>React Emoji</label>
              <input className="setting-input" value={s.autoReactEmoji || "❤️"} onChange={e => up("autoReactEmoji", e.target.value)} style={{ width: 100 }} maxLength={8} />
            </div>
          )}
          <Toggle id="autoStatusView" label="👁️ Auto View Statuses" sub="Saare contacts ke status silently dekho" />
          <Toggle id="autoStatusReact" label="❤️ Auto React Statuses" sub="Saare statuses par emoji react karo" />
          <Toggle id="autoStatus" label="📸 Auto Save Statuses" sub="Contacts ke statuses apne DM mein forward karo" />
        </div>

        {/* Access Mode */}
        <div className="settings-section">
          <div className="settings-section-title">🔒 Access Mode</div>
          <Toggle id="privateMode" label="Private Mode" sub="ON = sirf aap + groups · OFF = sab log (public)" />
          <Toggle id="publicWelcome" label="Welcome New Users" sub="Naye users ko greeting bhejo" />
        </div>

        {/* Protection */}
        <div className="settings-section">
          <div className="settings-section-title">🛡️ Protection</div>
          <Toggle id="antiCall" label="📵 Anti Call" sub="Saari incoming calls reject karo" />
          <Toggle id="antiEdit" label="✏️ Anti Edit" sub="Edited messages detect karo, original dikhao" />
          <Toggle id="autoRecording" label="🎙️ Auto Recording" sub="Commands process karte waqt recording indicator dikhao" />
          {s.antiCall && (
            <div className="setting-row" style={{ marginTop: 10 }}>
              <label>Anti-Call Message</label>
              <input className="setting-input" value={s.antiCallMsg || ""} onChange={e => up("antiCallMsg", e.target.value)} placeholder="Maafi chahta/chahti hoon, calls band hain." />
            </div>
          )}
        </div>

        {/* Spam */}
        <div className="settings-section">
          <div className="settings-section-title">🛡️ Spam & Cooldown</div>
          <div className="setting-row">
            <label>Command Cooldown (ms)</label>
            <input className="setting-input" type="number" value={s.cooldown ?? 3000} onChange={e => up("cooldown", parseInt(e.target.value))} style={{ width: 120 }} />
          </div>
          <div className="setting-row">
            <label>Spam Limit</label>
            <input className="setting-input" type="number" value={s.spamLimit ?? 5} onChange={e => up("spamLimit", parseInt(e.target.value))} style={{ width: 100 }} />
          </div>
        </div>

        {/* Owner Info */}
        {session?.isOwner && (
          <div className="settings-section">
            <div className="settings-section-title">👑 Owner Access</div>
            <div style={{ background: "rgba(37,211,102,.08)", border: "1px solid rgba(37,211,102,.2)", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
              <div style={{ color: "var(--green)", fontWeight: 700, marginBottom: 4 }}>👑 Owner Mode Active</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Number +{OWNER_NUMBER} ko auto admin permissions mili hain.</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn-primary" style={{ padding: "11px 28px", fontSize: 14 }} onClick={save}>
          💾 Settings Save Karein
        </button>
        {msg && (
          <div className={`settings-msg ${msgOk ? "msg-ok" : "msg-err"}`} style={{ marginTop: 10, display: "inline-block", marginLeft: 12 }}>{msg}</div>
        )}
      </div>
    </div>
  );
}
