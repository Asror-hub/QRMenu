/**
 * Shared card surfaces matching Reservations (works in light + dark via CSS vars).
 * Use inside styled-components: `${cardPanel}`
 */

/** Outer panel (Reservations `Card`, Settings sections, panes, chart cards). */
export const cardPanel = `
  border: 1px solid var(--orders-container-border);
  border-radius: 20px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 96%, #fff 4%),
    color-mix(in srgb, var(--surface) 92%, var(--bg) 8%)
  );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 60%, transparent),
    0 10px 24px color-mix(in srgb, #0f172a 10%, transparent);

  [data-theme="light"] & {
    box-shadow: none;
  }
`;

/** Recessed list well (Reservations `ListSurface`). */
export const listSurface = `
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 72%, var(--bg) 28%),
    color-mix(in srgb, var(--surface) 80%, var(--bg) 20%)
  );
  border: none;
  box-shadow: none;
`;

/** Individual interactive card row/tile (Reservations `ReservationCardTrack`). */
export const cardItem = `
  border-radius: 12px;
  border: 1px solid var(--orders-container-border);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 95%, #fff 5%),
    color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%)
  );
  box-shadow: none;
`;

export const cardItemHover = `
  transition: box-shadow 0.15s ease, border-color 0.15s ease, transform 0.12s ease;

  &:hover {
    box-shadow: none;
    border-color: color-mix(in srgb, var(--orders-container-border) 65%, var(--text) 35%);
    transform: translateY(-1px);
  }
`;

/** Page chrome shell used by Reservations. */
export const pageShell = `
  border-radius: 22px;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg) 6%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent),
    0 16px 34px color-mix(in srgb, #020617 12%, transparent);

  [data-theme="light"] & {
    box-shadow: none;
  }
`;
