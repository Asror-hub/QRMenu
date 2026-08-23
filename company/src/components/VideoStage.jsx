import { useEffect, useRef, useState } from "react";
import { Phone, ScreenGuestMenu } from "./Devices.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

/**
 * Drop your explainer at /public/media/product-demo.mp4
 * and optional poster at /public/media/product-demo-poster.jpg
 * Set MEDIA.ready to true once files exist.
 */
const MEDIA = {
  ready: false,
  src: "/media/product-demo.mp4",
  poster: "/media/product-demo-poster.jpg",
};

const RAIL_KEYS = ["video.rail1", "video.rail2", "video.rail3", "video.rail4", "video.rail5"];

export function VideoStage() {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v || !MEDIA.ready) return;
    if (v.paused) v.play();
    else v.pause();
  };

  return (
    <section className={`video-stage${playing ? " is-playing" : ""}`} id="demo" aria-labelledby="demo-title">
      <div className="video-stage__glow" aria-hidden />
      <div className="video-stage__inner">
        <div className="video-stage__intro">
          <p className="eyebrow">{t("video.eyebrow")}</p>
          <h2 id="demo-title">{t("video.title")}</h2>
          <p>{t("video.lead")}</p>
        </div>

        <div className="video-stage__theater">
          <div className="video-stage__float video-stage__float--left" aria-hidden>
            <Phone className="video-stage__phone">
              <ScreenGuestMenu />
            </Phone>
          </div>

          <div className="video-stage__frame">
            <div className="video-stage__chrome" aria-hidden>
              <span />
              <span />
              <span />
              <em>{t("video.chrome")}</em>
            </div>

            <div className="video-stage__viewport">
              {MEDIA.ready ? (
                <video
                  ref={videoRef}
                  className="video-stage__video"
                  src={MEDIA.src}
                  poster={MEDIA.poster}
                  playsInline
                  preload="metadata"
                  controls={playing}
                />
              ) : (
                <div className="video-stage__placeholder" aria-hidden>
                  <div className="video-stage__placeholder-ui">
                    <div className="video-stage__storyboard">
                      <div className="video-stage__shot">
                        <span>01</span>
                        <strong>{t("video.shot1")}</strong>
                      </div>
                      <div className="video-stage__shot is-mid">
                        <span>02</span>
                        <strong>{t("video.shot2")}</strong>
                      </div>
                      <div className="video-stage__shot">
                        <span>03</span>
                        <strong>{t("video.shot3")}</strong>
                      </div>
                    </div>
                    <p className="video-stage__hint">{t("video.hint")}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="video-stage__play"
                onClick={toggle}
                aria-label={
                  MEDIA.ready ? (playing ? t("video.pause") : t("video.play")) : t("video.soon")
                }
                disabled={!MEDIA.ready}
              >
                <span className="video-stage__play-ring" aria-hidden />
                <span className="video-stage__play-pulse" aria-hidden />
                <span className="video-stage__play-icon" aria-hidden>
                  {playing ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5.5v13l11-6.5-11-6.5z" />
                    </svg>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        <ol className="video-stage__rail">
          {RAIL_KEYS.map((key, i) => (
            <li key={key}>
              <span className="video-stage__rail-dot" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              {t(key)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
