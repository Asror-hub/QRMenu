import { Reveal } from "./Reveal.jsx";
import {
  Laptop,
  Phone,
  ScreenDashboard,
  ScreenFloorBoard,
  ScreenGuestMenu,
} from "./Devices.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

function QrTableStand({ tableLabel }) {
  return (
    <div className="plat-qr" aria-hidden>
      <div className="plat-qr__plate">
        <span className="plat-qr__brand">SmartQr</span>
        <div className="plat-qr__code">
          <svg viewBox="0 0 80 80" role="presentation">
            <rect width="80" height="80" fill="#fff" />
            <g fill="#0b1f3a">
              <rect x="6" y="6" width="24" height="24" />
              <rect x="10" y="10" width="16" height="16" fill="#fff" />
              <rect x="14" y="14" width="8" height="8" />
              <rect x="50" y="6" width="24" height="24" />
              <rect x="54" y="10" width="16" height="16" fill="#fff" />
              <rect x="58" y="14" width="8" height="8" />
              <rect x="6" y="50" width="24" height="24" />
              <rect x="10" y="54" width="16" height="16" fill="#fff" />
              <rect x="14" y="58" width="8" height="8" />
              <rect x="36" y="36" width="8" height="8" />
              <rect x="48" y="36" width="8" height="8" />
              <rect x="36" y="48" width="8" height="8" />
              <rect x="56" y="48" width="8" height="8" />
              <rect x="48" y="56" width="8" height="8" />
              <rect x="64" y="56" width="8" height="8" />
              <rect x="56" y="64" width="8" height="8" />
              <rect x="36" y="64" width="8" height="8" />
            </g>
          </svg>
        </div>
        <strong className="plat-qr__num">{tableLabel}</strong>
      </div>
    </div>
  );
}

const pieces = [
  {
    id: "mobile",
    index: "01",
    tagKeys: ["platform.mobile.tag1", "platform.mobile.tag2"],
    visual: "phone-staff",
  },
  {
    id: "admin",
    index: "02",
    tagKeys: ["platform.admin.tag1", "platform.admin.tag2"],
    visual: "laptop",
  },
  {
    id: "menu",
    index: "03",
    tagKeys: ["platform.menu.tag1"],
    visual: "phone-guest",
  },
  {
    id: "qr",
    index: "04",
    tagKeys: ["platform.qr.tag1"],
    visual: "qr",
  },
];

function PieceVisual({ type, tableLabel }) {
  if (type === "phone-guest") {
    return (
      <Phone className="plat-row__device" glow>
        <ScreenGuestMenu />
      </Phone>
    );
  }
  if (type === "phone-staff") {
    return (
      <Phone className="plat-row__device">
        <ScreenFloorBoard />
      </Phone>
    );
  }
  if (type === "laptop") {
    return (
      <Laptop className="plat-row__device plat-row__device--laptop">
        <ScreenDashboard />
      </Laptop>
    );
  }
  return <QrTableStand tableLabel={tableLabel} />;
}

export function Platform() {
  const { t } = useLanguage();

  return (
    <section className="section section--platform" id="platform" aria-labelledby="platform-title">
      <div className="section__inner section__inner--wide">
        <Reveal className="platform-head" variant="up">
          <div className="platform-head__copy">
            <p className="eyebrow">{t("platform.eyebrow")}</p>
            <h2 id="platform-title">{t("platform.title")}</h2>
          </div>
          <p className="platform-head__lede">{t("platform.lede")}</p>
        </Reveal>

        <div className="plat-stack" role="list">
          {pieces.map((piece, index) => {
            const flip = index % 2 === 1;
            const prefix = `platform.${piece.id}`;
            return (
              <Reveal
                key={piece.id}
                className={`plat-row plat-row--${piece.id}${flip ? " plat-row--flip" : ""}`}
                variant={flip ? "right" : "left"}
                delay={index * 60}
                role="listitem"
              >
                <div className="plat-row__copy">
                  <div className="plat-row__meta">
                    <span className="plat-row__index">{piece.index}</span>
                    <span className="plat-row__kicker">{t(`${prefix}.kicker`)}</span>
                  </div>
                  <h3>{t(`${prefix}.title`)}</h3>
                  <p>{t(`${prefix}.text`)}</p>
                  <ul className="plat-row__tags" aria-label="Available on">
                    {piece.tagKeys.map((tagKey) => (
                      <li key={tagKey}>{t(tagKey)}</li>
                    ))}
                  </ul>
                </div>
                <div className="plat-row__stage" aria-hidden>
                  <div className="plat-row__glow" />
                  <PieceVisual type={piece.visual} tableLabel={t("platform.table12")} />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
