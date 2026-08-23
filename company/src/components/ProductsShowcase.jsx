import { Reveal } from "./Reveal.jsx";
import { ProductPhone, ScreenGuestMenu } from "./Devices.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

function ScreenOrderCart() {
  return (
    <div className="ui-screen ui-screen--guest ui-ps">
      <header className="ui-g__head">
        <div>
          <p className="ui-g__eyebrow">Table 12</p>
          <strong className="ui-g__brand">Your order</strong>
        </div>
        <span className="ui-g__table">3 items</span>
      </header>
      <div className="ui-ps__lines">
        <div>
          <strong>Seared salmon</strong>
          <em>$28</em>
        </div>
        <div>
          <strong>Truffle pasta</strong>
          <em>$24</em>
        </div>
        <div>
          <strong>Sparkling water</strong>
          <em>$4</em>
        </div>
      </div>
      <div className="ui-ps__total">
        <span>Total</span>
        <strong>$56</strong>
      </div>
      <div className="ui-g__cart">Send to kitchen</div>
    </div>
  );
}

function ScreenStaffOrder() {
  return (
    <div className="ui-screen ui-screen--floor ui-ps">
      <header className="ui-f__head">
        <div>
          <p className="ui-f__eyebrow">Staff entry</p>
          <strong>Table 09</strong>
        </div>
        <span className="ui-f__live">
          <i /> Manual
        </span>
      </header>
      <div className="ui-ps__lines">
        <div>
          <strong>Ribeye steak</strong>
          <em>×1</em>
        </div>
        <div>
          <strong>Side salad</strong>
          <em>×1</em>
        </div>
        <div>
          <strong>House red</strong>
          <em>×2</em>
        </div>
      </div>
      <div className="ui-ps__total">
        <span>Staff ticket</span>
        <strong>$74</strong>
      </div>
      <div className="ui-g__cart">Submit order</div>
    </div>
  );
}

function ScreenOrderInbox() {
  return (
    <div className="ui-screen ui-screen--floor ui-ps">
      <header className="ui-f__head">
        <div>
          <p className="ui-f__eyebrow">Incoming</p>
          <strong>Order inbox</strong>
        </div>
        <span className="ui-f__live">
          <i /> 3 new
        </span>
      </header>
      <div className="ui-f__ticket is-hot">
        <div className="ui-f__ticket-top">
          <span>Table 12 · just now</span>
          <b>NEW</b>
        </div>
        <strong>Salmon · Pasta · Water</strong>
        <div className="ui-f__bar" />
      </div>
      <div className="ui-f__ticket is-hot">
        <div className="ui-f__ticket-top">
          <span>Table 07 · 1m</span>
          <b>NEW</b>
        </div>
        <strong>Burger · Fries · Cola</strong>
        <div className="ui-f__bar ui-f__bar--mid" />
      </div>
      <div className="ui-f__ticket">
        <div className="ui-f__ticket-top">
          <span>Table 04 · 4m</span>
          <b>ACK</b>
        </div>
        <strong>Accepted · cooking</strong>
        <div className="ui-f__bar ui-f__bar--dim" />
      </div>
    </div>
  );
}

function ScreenMenuAdmin() {
  return (
    <div className="ui-screen ui-screen--dash ui-ps" style={{ display: "flex", flexDirection: "column", padding: "1rem 0.75rem" }}>
      <header className="ui-g__head">
        <div>
          <p className="ui-g__eyebrow">Admin</p>
          <strong className="ui-g__brand">Live menu</strong>
        </div>
        <span className="ui-g__table">Live</span>
      </header>
      <div className="ui-ps__admin-list">
        <div className="is-on">
          <b>Seared salmon</b>
          <span>Visible · $28</span>
        </div>
        <div className="is-on">
          <b>Truffle pasta</b>
          <span>Visible · $24</span>
        </div>
        <div className="is-off">
          <b>Oyster platter</b>
          <span>Hidden tonight</span>
        </div>
        <div>
          <b>House wine</b>
          <span>Visible · $9</span>
        </div>
      </div>
    </div>
  );
}

function ScreenReservations() {
  return (
    <div className="ui-screen ui-screen--dash ui-ps" style={{ display: "flex", flexDirection: "column", padding: "1rem 0.75rem" }}>
      <header className="ui-g__head">
        <div>
          <p className="ui-g__eyebrow">Tonight</p>
          <strong className="ui-g__brand">Reservations</strong>
        </div>
        <span className="ui-g__table">18</span>
      </header>
      <div className="ui-ps__admin-list">
        <div className="is-on">
          <b>19:00 · Ana K.</b>
          <span>Table 12 · 2 guests</span>
        </div>
        <div>
          <b>19:30 · Mark R.</b>
          <span>Table 04 · 4 guests</span>
        </div>
        <div>
          <b>20:15 · Walk-in hold</b>
          <span>Table 21 · 2 guests</span>
        </div>
      </div>
    </div>
  );
}

function ScreenFeedback() {
  return (
    <div className="ui-screen ui-screen--guest ui-ps">
      <header className="ui-g__head">
        <div>
          <p className="ui-g__eyebrow">After dinner</p>
          <strong className="ui-g__brand">How was it?</strong>
        </div>
      </header>
      <div className="ui-ps__stars" aria-hidden>
        <span className="is-on" />
        <span className="is-on" />
        <span className="is-on" />
        <span className="is-on" />
        <span />
      </div>
      <div className="ui-ps__note">Food was excellent. Service felt smooth.</div>
      <div className="ui-g__cart">Submit feedback</div>
    </div>
  );
}

const products = [
  {
    id: "qr-menu",
    i18n: "online-menu",
    accent: "blue",
    Screen: ScreenGuestMenu,
    src: null,
  },
  {
    id: "table-ordering",
    i18n: "table-ordering",
    accent: "mint",
    Screen: ScreenOrderCart,
    src: null,
  },
  {
    id: "order-receiving",
    i18n: "order-receiving",
    accent: "violet",
    Screen: ScreenOrderInbox,
    src: null,
  },
  {
    id: "menu-admin",
    i18n: "menu-admin",
    accent: "sand",
    Screen: ScreenMenuAdmin,
    src: null,
  },
  {
    id: "staff-orders",
    i18n: "staff-orders",
    accent: "slate",
    Screen: ScreenStaffOrder,
    src: null,
  },
  {
    id: "reservations",
    i18n: "reservations",
    accent: "coral",
    Screen: ScreenReservations,
    src: null,
  },
  {
    id: "feedback",
    i18n: "feedback",
    accent: "sky",
    Screen: ScreenFeedback,
    src: null,
  },
];

export function ProductsShowcase() {
  const { t } = useLanguage();

  return (
    <section className="section section--products" id="product" aria-labelledby="products-title">
      <div className="section__inner section__inner--wide">
        <Reveal className="section__header section__header--center products-intro">
          <p className="eyebrow">{t("products.eyebrow")}</p>
          <h2 id="products-title">{t("products.title")}</h2>
          <p>{t("products.lead")}</p>
        </Reveal>

        <div className="product-panels">
          {products.map((product, index) => {
            const Screen = product.Screen;
            const n = String(index + 1);
            const flip = index % 2 === 1;
            const prefix = `product.${product.i18n}`;
            const points = [1, 2, 3, 4].map((i) => t(`${prefix}.p${i}`));
            return (
              <Reveal key={product.id} className="product-panel-wrap" delay={index * 35}>
                <article
                  className={`product-panel product-panel--${product.accent}${flip ? " product-panel--flip" : ""}`}
                  aria-labelledby={`product-${product.id}-title`}
                >
                  <div className="product-panel__copy">
                    <div className="product-panel__meta">
                      <span className="product-panel__index">{n}</span>
                      <span className="product-panel__kicker">{t(`${prefix}.kicker`)}</span>
                    </div>
                    <h3 id={`product-${product.id}-title`}>{t(`${prefix}.title`)}</h3>
                    <ul className="product-panel__points">
                      {points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <a className="product-panel__details" href="#contact">
                      {t("products.details")}
                      <span aria-hidden>→</span>
                    </a>
                  </div>

                  <div className="product-panel__visual" aria-hidden>
                    <span className="product-panel__bg-num">{n}</span>
                    <div className="product-panel__mat" />
                    <div className="product-panel__device-wrap">
                      <ProductPhone src={product.src} alt="">
                        <Screen />
                      </ProductPhone>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
