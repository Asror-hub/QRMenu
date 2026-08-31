/**
 * Device frames for product screenshots.
 * Pass `src` when you have a real screen image; otherwise children render as the screen.
 */
export function Phone({ src, alt = "", children, className = "", glow = false }) {
  return (
    <div className={`device device--phone${glow ? " device--glow" : ""}${className ? ` ${className}` : ""}`.trim()}>
      <div className="device__bezel">
        <div className="device__speaker" aria-hidden />
        <div className="device__screen">
          {src ? <img src={src} alt={alt} loading="lazy" /> : children}
        </div>
        <div className="device__home" aria-hidden />
      </div>
    </div>
  );
}

export function Tablet({ src, alt = "", children, className = "" }) {
  return (
    <div className={`device device--tablet${className ? ` ${className}` : ""}`.trim()}>
      <div className="device__bezel">
        <div className="device__cam-dot" aria-hidden />
        <div className="device__screen">
          {src ? <img src={src} alt={alt} loading="lazy" /> : children}
        </div>
      </div>
    </div>
  );
}


export function Laptop({ src, alt = "", children, className = "" }) {
  return (
    <div className={`device device--laptop${className ? ` ${className}` : ""}`.trim()}>
      <div className="device__lid">
        <div className="device__bezel">
          <div className="device__camera" aria-hidden />
          <div className="device__screen">
            {src ? <img src={src} alt={alt} loading="lazy" /> : children}
          </div>
        </div>
      </div>
      <div className="device__base" aria-hidden>
        <div className="device__notch-base" />
      </div>
      <div className="device__shadow" aria-hidden />
    </div>
  );
}

/** Stand-in UIs until real screenshots land in /public/media */
export function ScreenGuestMenu() {
  return (
    <div className="ui-screen ui-screen--guest">
      <header className="ui-g__head">
        <div>
          <p className="ui-g__eyebrow">Tonight</p>
          <strong className="ui-g__brand">Bistro Luna</strong>
        </div>
        <span className="ui-g__table">T12</span>
      </header>
      <div className="ui-g__hero">
        <span>Chef specials</span>
        <strong>Wood-fired plates</strong>
      </div>
      <div className="ui-g__cats" aria-hidden>
        <span className="is-on">Mains</span>
        <span>Drinks</span>
        <span>Sides</span>
      </div>
      <article className="ui-g__item">
        <div className="ui-g__thumb ui-g__thumb--a" />
        <div className="ui-g__meta">
          <strong>Seared salmon</strong>
          <p>Citrus · fennel · herb oil</p>
          <em>$28</em>
        </div>
      </article>
      <article className="ui-g__item">
        <div className="ui-g__thumb ui-g__thumb--b" />
        <div className="ui-g__meta">
          <strong>Truffle pasta</strong>
          <p>Egg yolk · pecorino</p>
          <em>$24</em>
        </div>
      </article>
      <div className="ui-g__cart">View order · $52</div>
    </div>
  );
}

export function ScreenFloorBoard() {
  return (
    <div className="ui-screen ui-screen--floor">
      <header className="ui-f__head">
        <div>
          <p className="ui-f__eyebrow">Service</p>
          <strong>Main dining</strong>
        </div>
        <span className="ui-f__live">
          <i /> Live
        </span>
      </header>
      <div className="ui-f__stats" aria-hidden>
        <div>
          <em>Open</em>
          <strong>14</strong>
        </div>
        <div>
          <em>In cook</em>
          <strong>6</strong>
        </div>
        <div>
          <em>Ready</em>
          <strong>3</strong>
        </div>
      </div>
      <div className="ui-f__ticket is-hot">
        <div className="ui-f__ticket-top">
          <span>Table 12</span>
          <b>8m</b>
        </div>
        <strong>Mains fired · dessert waiting</strong>
        <div className="ui-f__bar" />
      </div>
      <div className="ui-f__ticket">
        <div className="ui-f__ticket-top">
          <span>Table 04</span>
          <b>3m</b>
        </div>
        <strong>Order received · walk-in</strong>
        <div className="ui-f__bar ui-f__bar--mid" />
      </div>
      <div className="ui-f__ticket">
        <div className="ui-f__ticket-top">
          <span>Table 21</span>
          <b>—</b>
        </div>
        <strong>Seated · browsing menu</strong>
        <div className="ui-f__bar ui-f__bar--dim" />
      </div>
    </div>
  );
}

export function ScreenDashboard() {
  return (
    <div className="ui-screen ui-screen--dash">
      <aside className="ui-d__nav" aria-hidden>
        <span className="ui-d__logo" />
        <span />
        <span className="is-on" />
        <span />
        <span />
      </aside>
      <div className="ui-d__main">
        <header className="ui-d__head">
          <div>
            <p>Dashboard</p>
            <strong>Tonight’s service</strong>
          </div>
          <em>42 covers · $3,184</em>
        </header>
        <div className="ui-d__cards" aria-hidden>
          <div className="ui-d__card">
            <span>Orders</span>
            <strong>67</strong>
            <i className="ui-d__spark" />
          </div>
          <div className="ui-d__card is-accent">
            <span>Avg ticket</span>
            <strong>$48</strong>
            <i className="ui-d__spark ui-d__spark--light" />
          </div>
          <div className="ui-d__card">
            <span>Turn time</span>
            <strong>54m</strong>
            <i className="ui-d__spark" />
          </div>
        </div>
        <div className="ui-d__panel">
          <div className="ui-d__panel-head">
            <strong>Live tables</strong>
            <span>Floor view</span>
          </div>
          <div className="ui-d__rows">
            <div>
              <b>T12</b>
              <span>Mains</span>
              <em>Active</em>
            </div>
            <div>
              <b>T04</b>
              <span>New</span>
              <em>Queue</em>
            </div>
            <div>
              <b>T21</b>
              <span>Menu</span>
              <em>Seated</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
