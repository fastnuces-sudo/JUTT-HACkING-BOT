import { useState, useEffect } from "react";

interface Props { apiHeaders: Record<string, string> }

export default function TabAbout({ apiHeaders }: Props) {
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    fetch("/api/admin/stats", { headers: apiHeaders }).then(r => r.json()).then(d => setStats(d)).catch(() => {});
  }, []);

  const features = [
    { icon: "🤖", label: "AI Chat (Gemini)" },
    { icon: "📥", label: "YouTube / TikTok Download" },
    { icon: "👥", label: "Group Management" },
    { icon: "🛡️", label: "Anti-Link / Anti-Spam" },
    { icon: "🎮", label: "Games & Economy" },
    { icon: "❤️", label: "Auto React / Auto Read" },
    { icon: "📢", label: "Broadcast Messages" },
    { icon: "🔥", label: "Firebase Cloud Database" },
    { icon: "📊", label: "Web Dashboard" },
    { icon: "⚡", label: "Multi-Session Support" },
  ];

  const commands = [
    [".menu", "saari commands"],
    [".ai <text>", "Gemini AI"],
    [".yt <link>", "YouTube download"],
    [".tiktok <link>", "TikTok"],
    [".kick @user", "group se nikalo"],
    [".ban @user", "user ban karo"],
    [".antilink", "anti-link toggle"],
    [".sticker", "sticker banao"],
    [".weather", "mausam info"],
    [".help", "help lo"],
  ];

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Bot Identity Card */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginBottom: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <img src="/logo.jpeg" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", boxShadow: "0 0 24px rgba(37,211,102,.35)", flexShrink: 0 }} alt="Logo" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, background: "linear-gradient(135deg,var(--green),var(--green2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            AA MD Bot
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            WhatsApp Multi-Device Bot — by <strong style={{ color: "var(--text)" }}>Ahsan Ali | AA Mods</strong>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="badge badge-green">v2.0 Multi-Device</span>
            <span className="badge badge-blue">Baileys MD</span>
            <span className="badge badge-yellow">🔥 Firebase</span>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div style={{ marginBottom: 20 }}>
        <img src="/banner.jpeg" alt="AA MD Bot Banner" style={{ width: "100%", borderRadius: 14, objectFit: "cover", maxHeight: 200, border: "1px solid var(--border)" }} />
      </div>

      {/* Live Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { icon: "📦", val: "100+", label: "Commands" },
          { icon: "👥", val: stats.totalUsers ?? "--", label: "Total Users" },
          { icon: "📱", val: stats.activeSessions ?? "--", label: "Sessions" },
          { icon: "⏱", val: stats.uptime ?? "--", label: "Uptime" },
        ].map((c, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{String(c.val)}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Media Download Info */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 14 }}>
          🎬 Media Download — Pehle Details, Phir Media
        </div>
        <div className="media-card">
          <div className="media-details">
            <div className="media-details-title">📹 Video Download</div>
            <div className="media-details-meta">
              <span>Format: MP4</span><span>Quality: Best</span><span>Max: 100MB</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
              Bot pehle video ki <strong style={{ color: "var(--text)" }}>details message</strong> bhejta hai (title, size, duration, thumbnail), phir actual video file download karke bhejta hai.
            </p>
          </div>
          <div className="media-player">
            <div style={{ background: "#0d1525", borderRadius: 8, padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12, border: "1px dashed var(--border)" }}>
              🎬 Video yahan play hogi — details hamesha pehle aati hain
            </div>
          </div>
        </div>
        <div className="media-card" style={{ marginTop: 12 }}>
          <div className="media-details">
            <div className="media-details-title">🎵 Audio / Music Download</div>
            <div className="media-details-meta">
              <span>Format: MP3</span><span>Quality: 128-320kbps</span><span>Max: 50MB</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
              Bot pehle song ki <strong style={{ color: "var(--text)" }}>details message</strong> bhejta hai (title, artist, duration, thumbnail), phir actual audio file download karke bhejta hai.
            </p>
          </div>
          <div className="media-player">
            <div style={{ background: "#0d1525", borderRadius: 8, padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12, border: "1px dashed var(--border)" }}>
              🎵 Audio yahan play hogi — details hamesha pehle aati hain
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 14 }}>✨ Features</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 10 }}>
          {features.map((f, i) => (
            <div key={i} className="feature-item" style={{ background: "#0d1525", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
              <div className="feature-icon">{f.icon}</div>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Commands Quick Ref */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 14 }}>⚡ Quick Commands</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 7 }}>
          {commands.map(([cmd, desc], i) => (
            <div key={i} style={{ background: "#0d1525", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
              <code style={{ color: "var(--green)" }}>{cmd}</code>{" "}
              <span style={{ color: "var(--muted)", fontSize: 12 }}>— {desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 14 }}>🛠 Tech Stack</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["Node.js", "Baileys MD", "🔥 Firebase RTDB", "Express.js", "Gemini AI", "Replit / Railway"].map((t, i) => (
            <span key={i} className={`badge badge-${["green","blue","yellow","green","blue","gray"][i]}`}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
