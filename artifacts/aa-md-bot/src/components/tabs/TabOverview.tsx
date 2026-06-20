import { useState, useEffect } from "react";

type TabId = "overview" | "sessions" | "users" | "logs" | "settings" | "groups" | "broadcast" | "about";

interface Props {
  apiHeaders: Record<string, string>;
  onTab: (t: TabId) => void;
}

interface Stats {
  totalUsers?: number;
  activeSessions?: number;
  commandsToday?: number;
  uptime?: string;
  bannedUsers?: number;
  ramUsage?: string;
}

export default function TabOverview({ apiHeaders, onTab }: Props) {
  const [stats, setStats] = useState<Stats>({});
  const [recentCmds, setRecentCmds] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const d = await fetch("/api/admin/stats", { headers: apiHeaders }).then(r => r.json());
      setStats(d);
    } catch {}
    try {
      const d = await fetch("/api/admin/recent-commands", { headers: apiHeaders }).then(r => r.json());
      setRecentCmds(d.commands || []);
    } catch {}
    try {
      const d = await fetch("/api/admin/sessions", { headers: apiHeaders }).then(r => r.json());
      setSessions(d.sessions || []);
    } catch {}
  }

  function fmtTime(ts: number) {
    if (!ts) return "--";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  }

  const statCards = [
    { icon: "👥", value: stats.totalUsers ?? "--", label: "Total Users" },
    { icon: "📱", value: stats.activeSessions ?? "--", label: "Active Sessions" },
    { icon: "⚡", value: stats.commandsToday ?? "--", label: "Commands Today" },
    { icon: "⏱", value: stats.uptime ?? "--", label: "Uptime", small: true },
    { icon: "🚫", value: stats.bannedUsers ?? "--", label: "Banned Users" },
    { icon: "💾", value: stats.ramUsage ?? "--", label: "RAM Usage", small: true },
  ];

  return (
    <div>
      {/* Stats Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {statCards.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={s.small ? { fontSize: 18 } : {}}>{String(s.value)}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="section-title">⚡ Quick Actions</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 24 }}>
        {[
          { label: "📢 Broadcast", tab: "broadcast" },
          { label: "📱 Sessions", tab: "sessions" },
          { label: "👥 Users", tab: "users" },
          { label: "⚙️ Settings", tab: "settings" },
          { label: "📝 Live Logs", tab: "logs" },
          { label: "🏘️ Groups", tab: "groups" },
        ].map(q => (
          <button key={q.tab} className="qa-btn" onClick={() => onTab(q.tab as TabId)}>
            {q.label}
          </button>
        ))}
      </div>

      {/* Active Sessions */}
      <div className="section-title">📱 Active Sessions</div>
      <div style={{ marginBottom: 24 }}>
        {sessions.length === 0 ? (
          <div className="empty-state">Koi active session nahi hai</div>
        ) : (
          sessions.map((s: any, i: number) => (
            <div className="session-mini" key={i}>
              <span className={`dot dot-${s.status === "connected" ? "green" : "gray"}`} />
              <span style={{ fontWeight: 700 }}>+{s.number || s.sessionId}</span>
              <span className={`badge badge-${s.status === "connected" ? "green" : "gray"}`} style={{ marginLeft: "auto" }}>
                {s.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Recent Commands */}
      <div className="section-title">📜 Recent Commands</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time</th><th>Number</th><th>Name</th><th>Command</th><th>Chat</th></tr>
          </thead>
          <tbody>
            {recentCmds.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>Koi commands nahi</td></tr>
            ) : (
              recentCmds.map((c: any, i: number) => (
                <tr key={i}>
                  <td className="td-muted">{fmtTime(c.ts)}</td>
                  <td className="td-num">+{c.number}</td>
                  <td className="td-name">{c.name || "Unknown"}</td>
                  <td><code style={{ color: "var(--green)", fontSize: 12 }}>{c.command}</code></td>
                  <td>
                    <span className={`badge badge-${c.chat === "group" ? "blue" : "gray"}`}>
                      {c.chat === "group" ? "👥 Group" : "💬 DM"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
