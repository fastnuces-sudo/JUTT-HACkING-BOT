import { useState, useEffect, useRef } from "react";
import type { SessionInfo } from "../App";

const CHANNEL_URL = "https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617";
const PREFIX = ".";

interface Props {
  session: SessionInfo;
  onDisconnect: () => void;
}

interface Stats {
  uptime?: string;
  ram?: string;
  totalUsers?: number;
}

const QUICK_CMDS = [
  { cmd: ".menu",        desc: "All commands list" },
  { cmd: ".ai hello",   desc: "Chat with Gemini AI" },
  { cmd: ".islamic_menu", desc: "Islamic commands" },
  { cmd: ".play Tum Hi Ho", desc: "Play audio — Invidious → yt-dlp" },
  { cmd: ".yt <link>",  desc: "YouTube video download" },
  { cmd: ".tiktok <link>", desc: "TikTok download" },
  { cmd: ".sticker",    desc: "Make sticker" },
  { cmd: ".ping",       desc: "Bot ping / status" },
];

const CATEGORIES = [
  { icon: "☪️",  label: "Islamic",   cmds: ["islamic_menu","dua_forgiveness","dua_rizq","dua_health","dua_morning","dua_evening","dua_sleep","zikr_subhanallah","zikr_alhamdulillah","hadith_smile","kalima_tayyiba","darood_sharif","morning_adhkar","evening_adhkar","asmaul_husna","jaffery_menu"] },
  { icon: "🤖",  label: "AI",        cmds: ["ai","imagine","gpt","gemini","dalle"] },
  { icon: "📥",  label: "Download",  cmds: ["yt","ytmp3","tiktok","ig","fb","twitter","pinterest","spotify","soundcloud","mediafire","capcut"] },
  { icon: "🎬",  label: "Media",     cmds: ["play","song","audio","reveal","sticker","toimage","removebg","compress","resize","gifmaker","ptt","screenshot"] },
  { icon: "🔍",  label: "Search",    cmds: ["google","imgsearch","lyrics","movie","shazam","wiki","ytsearch"] },
  { icon: "🎉",  label: "Fun",       cmds: ["joke","meme","quote","roast","truth","dare","love","ship","advice","prank","guess","compliment","character"] },
  { icon: "🔧",  label: "Utility",   cmds: ["weather","calc","currency","qrgen","qrread","password","tempmail","speedtest","shorturl","timezone","randomnum","gdrive","apkdownload"] },
  { icon: "🛠️",  label: "Tools",     cmds: ["base64","tts","fontchanger","textstyle","stealsticker","readmore","fileupload"] },
  { icon: "👥",  label: "Group",     cmds: ["kick","promote","demote","mute","unmute","tagall","hidetag","antilink","antispam","antibadword","antidelete","antiviewonce","antibot","welcome","goodbye","setname","setdesc","groupinfo","link","clear","warn"] },
  { icon: "⚙️",  label: "Settings",  cmds: ["bs","mode","anticall","autostatus","statusview","statusreact","autoreply","autoread","autotyping","recording","setprefix","setnewsletter"] },
  { icon: "📋",  label: "General",   cmds: ["menu","help","ping","uptime","balance","daily","leaderboard","profile","info","report","support","contact","feedback"] },
];

const SETTINGS_REF = [
  { cmd: ".bs",             desc: "Full bot settings panel — all toggles in one place", example: ".bs" },
  { cmd: ".mode public",    desc: "PUBLIC: everyone can use commands",  example: ".mode public" },
  { cmd: ".mode private",   desc: "PRIVATE: only You (self-chat) can use commands", example: ".mode private" },
  { cmd: ".anticall on",    desc: "Reject all incoming calls",          example: ".anticall on" },
  { cmd: ".antidelete on",  desc: "Anti-delete in groups AND DMs globally", example: ".antidelete on" },
  { cmd: ".antiviewonce on",desc: "Reveal view-once in groups AND DMs globally", example: ".antiviewonce on" },
  { cmd: ".autostatus on",  desc: "Auto save & forward statuses to your DM", example: ".autostatus on" },
  { cmd: ".statusview on",  desc: "Auto view all statuses silently",    example: ".statusview on" },
  { cmd: ".statusreact on", desc: "Auto react to all statuses",         example: ".statusreact on" },
  { cmd: ".autoreply on",   desc: "Auto reply to DMs",                  example: ".autoreply on" },
  { cmd: ".autoread on",    desc: "Mark all messages as read",          example: ".autoread on" },
  { cmd: ".autotyping on",  desc: "Show typing indicator on commands",  example: ".autotyping on" },
  { cmd: ".setprefix !",    desc: "Change command prefix",              example: ".setprefix !" },
  { cmd: ".setnewsletter",  desc: "Set Channel JID for real 'View channel' button on all replies", example: ".setnewsletter 120363xxx@newsletter" },
];

export default function ConnectedScreen({ session, onDisconnect }: Props) {
  const [stats, setStats] = useState<Stats>({});
  const [copiedCmd, setCopiedCmd] = useState("");
  const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadStats();
    uptimeRef.current = setInterval(loadStats, 30000);
    return () => clearInterval(uptimeRef.current!);
  }, []);

  async function loadStats() {
    try {
      const d = await fetch("/api/admin/stats").then(r => r.json());
      setStats(d);
    } catch {}
  }

  function copyCmd(cmd: string) {
    navigator.clipboard.writeText(cmd).catch(() => {});
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(""), 1500);
  }

  return (
    <div className="dash">
      {/* Hero with banner */}
      <div className="dash-hero">
        <img src="/banner.jpeg" alt="AA MD Bot" className="dash-banner" />
        <div className="dash-hero-overlay" />
        <div className="dash-hero-content">
          <div className="dash-hero-left">
            <img src="/logo.jpeg" alt="AA MD" className="dash-logo" />
            <div>
              <div className="dash-hero-title">AA MD Bot</div>
              <div className="dash-hero-sub">
                <span className="dot dot-green" />
                +{session.number} — Connected
              </div>
            </div>
          </div>
          <button className="btn-disconnect" onClick={onDisconnect}>Disconnect</button>
        </div>
      </div>

      {/* Channel bar */}
      <div className="channel-bar">
        <span className="channel-bar-text">📢 Stay updated with new features &amp; tips:</span>
        <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn-channel">
          📲 Follow WhatsApp Channel
        </a>
      </div>

      <div className="dash-body">
        {/* Status cards */}
        <div className="status-grid" style={{ marginBottom: 28 }}>
          <div className="status-card">
            <div className="sc-icon">✅</div>
            <div className="sc-value" style={{ color: "var(--green)" }}>Online</div>
            <div className="sc-label">Bot Status</div>
          </div>
          <div className="status-card">
            <div className="sc-icon">⏱️</div>
            <div className="sc-value" style={{ fontSize: 16 }}>{stats.uptime ?? "--"}</div>
            <div className="sc-label">Uptime</div>
          </div>
          <div className="status-card">
            <div className="sc-icon">📦</div>
            <div className="sc-value">100+</div>
            <div className="sc-label">Commands</div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="section">
          <div className="section-head">⚡ Quick Start Commands</div>
          <div className="cmd-grid">
            {QUICK_CMDS.map(c => (
              <div
                key={c.cmd}
                className={`cmd-card${copiedCmd === c.cmd ? " copied" : ""}`}
                onClick={() => copyCmd(c.cmd)}
                title="Click to copy"
              >
                <code>{copiedCmd === c.cmd ? "✅ Copied!" : c.cmd}</code>
                <span>{c.desc}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            💡 Click any command to copy it, then paste in WhatsApp
          </p>
        </div>

        {/* Islamic Menu */}
        <div className="section">
          <div className="section-head">☪️ Islamic Commands</div>
          <div className="islamic-card">
            <div className="islamic-head">
              <span style={{ fontSize: 28 }}>☪️</span>
              <div>
                <div className="islamic-title">Islamic Commands Panel</div>
                <div className="islamic-sub">Duas, Zikr, Hadiths, Kalimas, Adhkar &amp; more</div>
              </div>
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn-channel" style={{ marginLeft: "auto", fontSize: 12, padding: "7px 14px" }}>
                📢 Channel
              </a>
            </div>
            <div className="islamic-sections">
              <div className="islamic-section">
                <div className="islamic-section-title">🤲 Duas</div>
                <div className="islamic-cmds">
                  {[["dua_forgiveness","Forgiveness"],["dua_rizq","Rizq / Provision"],["dua_guidance","Guidance"],["dua_health","Good Health"],["dua_morning","Morning"],["dua_evening","Evening"],["dua_sleep","Before Sleep"],["dua_travel","Travel"],["dua_food","Before Eating"],["dua_after_food","After Eating"],["dua_exam","Studies/Exam"],["dua_anxiety","Anxiety & Stress"],["dua_parents","Parents"]].map(([c, d]) => (
                    <div key={c} className="isl-cmd" onClick={() => copyCmd(PREFIX + c)} style={{ cursor: "pointer" }} title="Click to copy">
                      {PREFIX}{c} <span className="isl-cmd-desc">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="islamic-section">
                <div className="islamic-section-title">📿 Zikr</div>
                <div className="islamic-cmds">
                  {[["zikr_astaghfirullah","Astaghfirullah"],["zikr_alhamdulillah","Alhamdulillah"],["zikr_subhanallah","SubhanAllah"],["zikr_allahuakbar","Allahu Akbar"],["zikr_lailahaillallah","La Ilaha Illallah"],["zikr_lahawla","La Hawla Wa La Quwwata"],["zikr_bismillah","Bismillah"],["zikr_hasbunallah","Hasbunallah"]].map(([c, d]) => (
                    <div key={c} className="isl-cmd" onClick={() => copyCmd(PREFIX + c)} style={{ cursor: "pointer" }} title="Click to copy">
                      {PREFIX}{c} <span className="isl-cmd-desc">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="islamic-section">
                <div className="islamic-section-title">📜 Hadiths</div>
                <div className="islamic-cmds">
                  {[["hadith_good_morals","Good Morals"],["hadith_cleanliness","Cleanliness"],["hadith_truth","Truth"],["hadith_patience","Patience (Sabr)"],["hadith_smile","Smiling is Sadaqah"],["hadith_knowledge","Seeking Knowledge"],["hadith_neighbour","Good Neighbour"]].map(([c, d]) => (
                    <div key={c} className="isl-cmd" onClick={() => copyCmd(PREFIX + c)} style={{ cursor: "pointer" }} title="Click to copy">
                      {PREFIX}{c} <span className="isl-cmd-desc">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="islamic-section">
                <div className="islamic-section-title">☪️ 6 Kalimas</div>
                <div className="islamic-cmds">
                  {[["kalima_tayyiba","1st — Tayyiba"],["kalima_shahadat","2nd — Shahadat"],["kalima_tamjeed","3rd — Tamjeed"],["kalima_tauheed","4th — Tauheed"],["kalima_astaghfar","5th — Astaghfar"],["kalima_radde_kufr","6th — Radde Kufr"]].map(([c, d]) => (
                    <div key={c} className="isl-cmd" onClick={() => copyCmd(PREFIX + c)} style={{ cursor: "pointer" }} title="Click to copy">
                      {PREFIX}{c} <span className="isl-cmd-desc">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="islamic-section">
                <div className="islamic-section-title">💚 Specials & Adhkar</div>
                <div className="islamic-cmds">
                  {[["darood_sharif","Durood Ibrahim"],["morning_adhkar","Morning Adhkar"],["evening_adhkar","Evening Adhkar"],["asmaul_husna","99 Names of Allah"],["islam_fact","Random Islamic Fact"],["quran_reminder","Daily Reminder"],["prayers_info","5 Daily Prayers Info"]].map(([c, d]) => (
                    <div key={c} className="isl-cmd" onClick={() => copyCmd(PREFIX + c)} style={{ cursor: "pointer" }} title="Click to copy">
                      {PREFIX}{c} <span className="isl-cmd-desc">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="islamic-section">
                <div className="islamic-section-title">🌹 Fikra-e-Jaffery (Ahl al-Bayt ع)</div>
                <div className="islamic-cmds">
                  {[
                    ["jaffery_menu","Full Jaffery Menu"],
                    ["dua_kumayl","Dua Kumayl — Imam Ali ع"],
                    ["dua_arafah","Dua Arafah — Imam Husain ع"],
                    ["dua_tawassul","Dua Tawassul"],
                    ["dua_imam_zaman","Dua — Imam Mahdi ع"],
                    ["dua_nudba","Dua Nudba"],
                    ["dua_sabah","Dua Sabah — Imam Ali ع"],
                    ["dua_joshan","Dua Joshan Kabeer"],
                    ["ziyarat_ashura","Ziyarat Ashura"],
                    ["ziyarat_warith","Ziyarat Warith"],
                    ["ziyarat_imam_ali","Ziyarat Imam Ali ع"],
                    ["ziyarat_imam_raza","Ziyarat Imam Raza ع"],
                    ["salawat_aal","Salawat Aal-e-Muhammad"],
                    ["salawat_shaban","Salawat Shabaniyya"],
                    ["masoomeen14","14 Masoomeen ع"],
                    ["karbala_info","Event of Karbala"],
                    ["nahjul_balagha","Nahjul Balagha Quote"],
                    ["ghadeer_info","Event of Ghadeer Khum"],
                  ].map(([c, d]) => (
                    <div key={c} className="isl-cmd" onClick={() => copyCmd(PREFIX + c)} style={{ cursor: "pointer" }} title="Click to copy">
                      {PREFIX}{c} <span className="isl-cmd-desc">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>💡</span> Type <code style={{ color: "var(--green)", fontSize: 11 }}>.islamic_menu</code> in WhatsApp to see the full list with a banner image
            </div>
          </div>
        </div>

        {/* Media Download Guide */}
        <div className="section">
          <div className="section-head">🎬 Media Commands — Details First, Then File</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            <div className="media-flow">
              <div className="media-flow-details">
                <div className="media-flow-title">🎵 Play Audio — .play / .song / .audio</div>
                <div className="media-flow-meta">
                  <span>SoundCloud</span><span>Invidious</span><span>yt-dlp</span>
                </div>
                <div className="media-flow-desc">
                  Search by name or paste a YouTube URL. Bot fetches metadata first (title, artist, thumbnail), then sends the MP3. <strong style={{ color: "var(--green)" }}>Three fallback sources</strong> for best results.
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--green)" }}>
                  .play Tum Hi Ho &nbsp;|&nbsp; .play https://youtu.be/...
                </div>
              </div>
              <div className="media-flow-player">🎵 Audio plays here — details always come first</div>
            </div>
            <div className="media-flow">
              <div className="media-flow-details">
                <div className="media-flow-title">📹 Video Download — .yt / .tiktok / .ig / .fb</div>
                <div className="media-flow-meta">
                  <span>Format: MP4</span><span>Quality: Best</span><span>Max: 100MB</span>
                </div>
                <div className="media-flow-desc">Bot first sends a <strong style={{ color: "var(--text)" }}>details message</strong> (title, size, duration, thumbnail), then sends the actual video file.</div>
              </div>
              <div className="media-flow-player">🎬 Video plays here — details always come first</div>
            </div>
            <div className="media-flow">
              <div className="media-flow-details">
                <div className="media-flow-title">👁️ Reveal View-Once — .reveal / .rv</div>
                <div className="media-flow-meta">
                  <span>Images</span><span>Videos</span><span>Groups &amp; DMs</span>
                </div>
                <div className="media-flow-desc">
                  Reply to any view-once message with <code style={{ color: "var(--green)" }}>.reveal</code> to get it as a normal photo/video. Auto-reveal also works via <code style={{ color: "var(--green)" }}>.antiviewonce on</code>.
                </div>
              </div>
              <div className="media-flow-player">👁️ View-once revealed as normal media</div>
            </div>
          </div>
        </div>

        {/* All Command Categories */}
        <div className="section">
          <div className="section-head">📦 All Command Categories</div>
          <div className="cat-grid">
            {CATEGORIES.map(cat => (
              <div className="cat-card" key={cat.label}>
                <div className="cat-card-head">
                  <span className="cat-icon">{cat.icon}</span>
                  {cat.label}
                </div>
                <div className="cat-cmds">
                  {cat.cmds.map(c => (
                    <span key={c} className="cat-cmd-chip" onClick={() => copyCmd(PREFIX + c)} title="Click to copy">
                      {PREFIX}{c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bot Mode */}
        <div className="section">
          <div className="section-head">🔀 Bot Mode — Private / Public</div>
          <div className="mode-cards">
            <div className="mode-info-card mode-private" onClick={() => copyCmd(".mode private")} title="Click to copy">
              <div className="mode-info-icon">🔒</div>
              <div className="mode-info-title">Private Mode</div>
              <div className="mode-info-desc">Only <strong>You (self-chat)</strong> can use commands. Perfect for personal use — no one else can trigger the bot.</div>
              <code className="mode-info-cmd">.mode private</code>
            </div>
            <div className="mode-info-card mode-public" onClick={() => copyCmd(".mode public")} title="Click to copy">
              <div className="mode-info-icon">🌐</div>
              <div className="mode-info-title">Public Mode</div>
              <div className="mode-info-desc">Everyone can use commands — any number that messages the bot gets a response. Current default.</div>
              <code className="mode-info-cmd">.mode public</code>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            💡 In <strong style={{ color: "var(--text)" }}>Private mode</strong>, only your "Message yourself" (You) chat responds to commands — great for personal automation.
            Click a card to copy the command, then paste in WhatsApp.
          </p>
        </div>

        {/* Bot Settings */}
        <div className="section">
          <div className="section-head">⚙️ Bot Settings — Control via WhatsApp</div>
          <div className="settings-ref">
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span>ℹ️</span>
              All settings are controlled <strong style={{ color: "var(--text)" }}>directly via WhatsApp commands</strong> — no separate admin panel needed.
              Type <code style={{ color: "var(--green)", fontSize: 12 }}>.bs</code> in WhatsApp for the full settings panel.
            </div>
            <div className="settings-grid-ref">
              {SETTINGS_REF.map(s => (
                <div className="setting-ref-item" key={s.cmd} onClick={() => copyCmd(s.example)} style={{ cursor: "pointer" }} title="Click to copy">
                  <div className="setting-ref-cmd">{s.cmd}</div>
                  <div className="setting-ref-desc">{s.desc}</div>
                  <div className="setting-ref-example">e.g. {s.example}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WhatsApp Channel CTA */}
        <div className="section">
          <div className="channel-section">
            <div className="channel-icon">📢</div>
            <div className="channel-title">Follow Our WhatsApp Channel</div>
            <div className="channel-desc">
              Get the latest updates, new commands, tips &amp; tricks, and announcements directly in WhatsApp.
              <br />Join thousands of AA MD Bot users on the official channel.
            </div>
            <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn-channel-big">
              📲 Follow Channel Now
            </a>
            <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,.35)" }}>
              whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617
            </div>
          </div>
        </div>

        {/* About */}
        <div className="about-card">
          <img src="/logo.jpeg" alt="AA MD" className="about-logo" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg,var(--green),var(--green2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              AA MD Bot v3.0
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              WhatsApp Multi-Device Bot — by <strong style={{ color: "var(--text)" }}>Ahsan Ali | AA Mods</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              100+ commands · Baileys MD · Firebase · Gemini AI
            </div>
            <div className="about-badges">
              <span className="badge badge-green">v3.0 Multi-Device</span>
              <span className="badge badge-blue">Baileys MD</span>
              <span className="badge badge-yellow">🔥 Firebase</span>
              <span className="badge badge-purple">Gemini AI</span>
            </div>
          </div>
          <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn-channel" style={{ flexShrink: 0 }}>
            📢 Channel
          </a>
        </div>
      </div>
    </div>
  );
}
