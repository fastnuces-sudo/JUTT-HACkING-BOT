import { useState, useEffect, useRef } from "react";
import type { SessionInfo } from "../App";
import TabOverview from "./tabs/TabOverview";
import TabSessions from "./tabs/TabSessions";
import TabUsers from "./tabs/TabUsers";
import TabLogs from "./tabs/TabLogs";
import TabSettings from "./tabs/TabSettings";
import TabGroups from "./tabs/TabGroups";
import TabBroadcast from "./tabs/TabBroadcast";
import TabAbout from "./tabs/TabAbout";

type TabId = "overview" | "sessions" | "users" | "logs" | "settings" | "groups" | "broadcast" | "about";

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "overview",  icon: "📊", label: "Overview"  },
  { id: "sessions",  icon: "📱", label: "Sessions"  },
  { id: "users",     icon: "👥", label: "Users"     },
  { id: "logs",      icon: "📝", label: "Live Logs" },
  { id: "settings",  icon: "⚙️", label: "Settings"  },
  { id: "groups",    icon: "🏘️", label: "Groups"    },
  { id: "broadcast", icon: "📢", label: "Broadcast" },
  { id: "about",     icon: "ℹ️", label: "About Bot" },
];

const TAB_TITLES: Record<TabId, string> = {
  overview: "Overview", sessions: "Sessions", users: "Users",
  logs: "Live Logs", settings: "Settings", groups: "Groups",
  broadcast: "Broadcast", about: "About Bot",
};

interface Props {
  session: SessionInfo | null;
  adminToken: string | null;
  onLogout: () => void;
}

export default function AdminPanel({ session, adminToken, onLogout }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uptime, setUptime] = useState("--");
  const [botOnline, setBotOnline] = useState(false);
  const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchUptime();
    uptimeRef.current = setInterval(fetchUptime, 30000);
    return () => clearInterval(uptimeRef.current!);
  }, []);

  async function fetchUptime() {
    try {
      const d = await fetch("/api/admin/stats", {
        headers: { "x-admin-token": adminToken || "" },
      }).then((r) => r.json());
      if (d.uptime) setUptime(d.uptime);
      setBotOnline(d.botOnline ?? false);
    } catch {}
  }

  function switchTab(t: TabId) {
    setTab(t);
    setSidebarOpen(false);
  }

  const apiHeaders = { "x-admin-token": adminToken || "" };

  return (
    <div className="admin-panel">
      {/* Overlay */}
      <div
        className={`overlay${sidebarOpen ? " show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Banner Image */}
        <img src="/banner.jpeg" alt="AA MD Bot Banner" className="sidebar-banner" />

        {/* Logo row */}
        <div className="sidebar-logo">
          <img src="/logo.jpeg" alt="AA MD" />
          <div>
            <div className="sidebar-title">AA MD Bot</div>
            <div className="sidebar-sub">Admin Panel</div>
          </div>
        </div>

        {/* Nav */}
        <div className="nav-menu">
          {TABS.map((t) => (
            <div
              key={t.id}
              className={`nav-item${tab === t.id ? " active" : ""}`}
              onClick={() => switchTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span> {t.label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="bot-status">
            <span className={`dot ${botOnline ? "dot-green" : "dot-gray"}`} />
            <span>{botOnline ? "Bot Online" : "Bot Offline"}</span>
          </div>
          {session && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
              +{session.number}
              {session.isOwner && (
                <span className="badge badge-yellow" style={{ marginLeft: 6 }}>
                  👑 Owner
                </span>
              )}
            </div>
          )}
          <button className="logout-btn" onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="main-content">
        <div className="top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h2>{TAB_TITLES[tab]}</h2>
          </div>
          <div className="top-bar-right">
            <div className="uptime-badge">⏱ {uptime}</div>
            <button className="refresh-btn" onClick={fetchUptime}>
              🔄
            </button>
          </div>
        </div>

        <div className="content-area">
          {tab === "overview"  && <TabOverview  apiHeaders={apiHeaders} onTab={switchTab} />}
          {tab === "sessions"  && <TabSessions  apiHeaders={apiHeaders} />}
          {tab === "users"     && <TabUsers     apiHeaders={apiHeaders} />}
          {tab === "logs"      && <TabLogs      apiHeaders={apiHeaders} />}
          {tab === "settings"  && <TabSettings  apiHeaders={apiHeaders} session={session} />}
          {tab === "groups"    && <TabGroups    apiHeaders={apiHeaders} />}
          {tab === "broadcast" && <TabBroadcast apiHeaders={apiHeaders} />}
          {tab === "about"     && <TabAbout     apiHeaders={apiHeaders} />}
        </div>
      </main>
    </div>
  );
}
