import type { SessionInfo } from "../App";

interface Props {
  session: SessionInfo;
  onBack: () => void;
  onAdminLogin: (token: string) => void;
}

export default function SuccessScreen({ session, onBack }: Props) {
  const num = session.number;

  function openWA() {
    const clean = num.replace(/\D/g, "");
    window.open("https://wa.me/" + clean, "_blank");
  }

  return (
    <div className="success-screen">
      <div className="suc-outer">
        {/* Banner */}
        <div className="suc-banner">
          <div className="suc-banner-inner">
            <img src="/logo.jpeg" alt="AA MD Bot" className="suc-logo" />
            <div className="suc-check">✅</div>
            <div className="suc-title">Connected!</div>
            <div className="suc-subtitle">
              <span className="suc-num-hl">+{num}</span> — AA MD Bot chal raha
              hai
            </div>
          </div>
        </div>

        <div className="suc-body">
          {/* Session info */}
          <div className="suc-section">
            <div className="suc-section-head">📱 Active Session</div>
            <div className="suc-sess-row">
              <div className="suc-sess-info">
                <span className="dot dot-green" />
                <div>
                  <div className="suc-sess-num">+{num}</div>
                  <div className="suc-sess-sub">
                    Connected · AA MD Bot chal raha hai
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Commands */}
          <div className="suc-section">
            <div className="suc-section-head">⚡ Quick Start Commands</div>
            <div className="cmd-grid">
              <div className="cmd-chip">
                <code>.menu</code>
                <span>Saari commands ki list</span>
              </div>
              <div className="cmd-chip">
                <code>.ai hello</code>
                <span>Gemini AI se baat karein</span>
              </div>
              <div className="cmd-chip">
                <code>.yt &lt;link&gt;</code>
                <span>YouTube download</span>
              </div>
              <div className="cmd-chip">
                <code>.tiktok &lt;link&gt;</code>
                <span>TikTok download</span>
              </div>
              <div className="cmd-chip">
                <code>.sticker</code>
                <span>Image/video se sticker</span>
              </div>
              <div className="cmd-chip">
                <code>.help</code>
                <span>Help &amp; info</span>
              </div>
            </div>
            <div className="suc-tip">
              💡 Ye commands apne{" "}
              <strong style={{ color: "var(--text)" }}>"You"</strong> chat,
              kisi bhi group ya private message mein use karein
            </div>
          </div>

          {/* Media Info (details FIRST, then media) */}
          <div className="suc-section">
            <div className="suc-section-head">🎬 Media Download Guide</div>
            <div className="media-card">
              <div className="media-details">
                <div className="media-details-title">
                  📹 Video Download — .yt / .tiktok / .ig
                </div>
                <div className="media-details-meta">
                  <span>Format: MP4</span>
                  <span>Quality: Best Available</span>
                  <span>Max: 100MB</span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    marginTop: 8,
                    lineHeight: 1.6,
                  }}
                >
                  Pehle video ki details send hoti hai (title, size, duration),
                  phir actual video file download hogi.
                </p>
              </div>
              <div className="media-player">
                <div
                  style={{
                    background: "#0d1525",
                    borderRadius: 8,
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: 13,
                    border: "1px dashed var(--border)",
                  }}
                >
                  🎬 Video yahan play hoga — pehle details, phir video
                </div>
              </div>
            </div>
            <div className="media-card">
              <div className="media-details">
                <div className="media-details-title">
                  🎵 Audio Download — .ytmp3 / .music
                </div>
                <div className="media-details-meta">
                  <span>Format: MP3</span>
                  <span>Quality: 128-320kbps</span>
                  <span>Max: 50MB</span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    marginTop: 8,
                    lineHeight: 1.6,
                  }}
                >
                  Pehle song ki details send hoti hai (title, artist, duration,
                  thumbnail), phir actual audio file download hogi.
                </p>
              </div>
              <div className="media-player">
                <div
                  style={{
                    background: "#0d1525",
                    borderRadius: 8,
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: 13,
                    border: "1px dashed var(--border)",
                  }}
                >
                  🎵 Audio yahan play hoga — pehle details, phir audio
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <button className="btn-wa" onClick={openWA}>
            📱 WhatsApp Abhi Kholein →
          </button>
          <button className="btn-back-full" onClick={onBack}>
            ← Doosra Number Connect Karein
          </button>
        </div>
      </div>
    </div>
  );
}
