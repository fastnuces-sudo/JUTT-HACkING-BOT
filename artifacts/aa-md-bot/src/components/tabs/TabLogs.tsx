import { useState, useEffect, useRef } from "react";

interface Props { apiHeaders: Record<string, string> }

export default function TabLogs({ apiHeaders }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const feedRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadLogs();
    pollRef.current = setInterval(loadLogs, 5000);
    return () => clearInterval(pollRef.current!);
  }, [filter]);

  async function loadLogs() {
    try {
      const d = await fetch(`/api/admin/logs?filter=${filter}&limit=200`, { headers: apiHeaders }).then(r => r.json());
      const feed = feedRef.current;
      const atBottom = feed ? (feed.scrollHeight - feed.scrollTop <= feed.clientHeight + 60) : true;
      setLogs(d.logs || []);
      if (atBottom && feed) setTimeout(() => { feed.scrollTop = feed.scrollHeight; }, 50);
    } catch {}
  }

  async function clearLogs() {
    if (!confirm("Saare logs clear karein?")) return;
    await fetch("/api/admin/logs", { method: "DELETE", headers: apiHeaders }).catch(() => {});
    setLogs([]);
  }

  function fmtTime(ts: number) {
    if (!ts) return "--:--";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <div>
      <div className="tab-header">
        <div className="filter-btns">
          {["all", "cmd", "system"].map(f => (
            <button key={f} className={`filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "Sab" : f === "cmd" ? "⚡ Commands" : "🔧 System"}
            </button>
          ))}
        </div>
        <button className="btn-danger" onClick={clearLogs}>🗑 Clear</button>
      </div>

      <div className="logs-feed" ref={feedRef}>
        {logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Abhi koi logs nahi...</div>
        ) : logs.map((l: any, i: number) => (
          <div className="log-entry" key={i}>
            <span className="log-time">{fmtTime(l.ts)}</span>
            <span className={`log-type log-type-${l.type === "cmd" ? "cmd" : "sys"}`}>
              {l.type === "cmd" ? "CMD" : "SYS"}
            </span>
            <span className="log-msg">
              {l.type === "cmd" ? (
                <>
                  <span className="log-num">+{l.number === "SELF" ? "Aap" : l.number}</span>
                  {" "}<span style={{ color: "var(--muted)" }}>{l.name || ""}</span>
                  {" → "}<span className="log-cmd">{l.command || ""}{l.args ? " " + l.args : ""}</span>
                  {" "}<span style={{ color: "#374151", fontSize: 10 }}>[{l.chat === "group" ? "group" : "dm"}]</span>
                </>
              ) : (
                <span style={{ color: "var(--muted)" }}>{l.message || ""}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
