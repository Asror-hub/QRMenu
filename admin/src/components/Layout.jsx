import { createContext, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styled, { css, keyframes } from "styled-components";
import { useAuth } from "../context/AuthContext";
import { useRestaurant } from "../context/RestaurantContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useFeedbackAlerts } from "../context/FeedbackAlertsContext";
import { hasPlanFeature } from "../utils/planFeatures";

export const TopBarSlotsContext = createContext({ actionsEl: null });

const PAGE_TITLE_KEYS = {
  "/orders": "navOrders",
  "/categories": "navMenuEditor",
  "/dashboard": "navAnalytics",
  "/tables": "navTables",
  "/reservations": "navReservations",
  "/feedbacks": "navFeedbacks",
  "/settings": "navSettings",
  "/support": "navSupport",
};

const Icon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;

  svg {
    width: 100%;
    height: 100%;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const Layout = ({ children }) => {
  const { signOut } = useAuth();
  const { restaurant } = useRestaurant();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { incomingCount } = useFeedbackAlerts();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth > 1368 : true)
  );
  const [topBarActionsEl, setTopBarActionsEl] = useState(null);
  const topBarSlots = useMemo(
    () => ({ actionsEl: topBarActionsEl }),
    [topBarActionsEl]
  );
  const pageTitleKey = PAGE_TITLE_KEYS[pathname] ?? null;
  const pageTitle = pageTitleKey ? t(pageTitleKey) : null;
  const titleCentered = !sidebarOpen;
  const feedbacksAlert = incomingCount > 0;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <TopBarSlotsContext.Provider value={topBarSlots}>
    <Shell $sidebarOpen={sidebarOpen}>
      <Sidebar $sidebarOpen={sidebarOpen}>
        <SidebarHeader>
          <Brand>{restaurant?.name ?? t("yourRestaurant")}</Brand>
          {sidebarOpen && (
            <SidebarToggle type="button" onClick={() => setSidebarOpen(false)} aria-label={t("hideSidebar")}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </SidebarToggle>
          )}
        </SidebarHeader>
        <Nav
          onClick={() => {
            if (typeof window !== "undefined" && window.innerWidth <= 1368) {
              setSidebarOpen(false);
            }
          }}
        >
          <StyledLink to="/orders">
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </Icon>
            {t("navOrders")}
          </StyledLink>
          <StyledLink to="/categories">
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Icon>
            {t("navMenuEditor")}
          </StyledLink>
          <StyledLink to="/dashboard">
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </Icon>
            {t("navAnalytics")}
          </StyledLink>
          <StyledLink to="/tables">
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </Icon>
            {t("navTables")}
          </StyledLink>
          {hasPlanFeature(restaurant, "reservations") ? (
          <StyledLink to="/reservations">
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 2v4M17 2v4M3 9h18" />
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 13h3M8 17h8" />
              </svg>
            </Icon>
            {t("navReservations")}
          </StyledLink>
          ) : null}
          <StyledLink to="/feedbacks" $alert={feedbacksAlert}>
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18l.9-5.4L4.2 8.7l5.4-.8L12 3z" strokeLinejoin="round" />
              </svg>
            </Icon>
            {t("navFeedbacks")}
            {feedbacksAlert ? <NavBadge>{incomingCount}</NavBadge> : null}
          </StyledLink>
          <StyledLink to="/settings">
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Icon>
            {t("navSettings")}
          </StyledLink>
          <StyledLink to="/support">
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Icon>
            {t("navSupport")}
          </StyledLink>
        </Nav>
        <SidebarFooter>
          <ThemeToggle type="button" onClick={toggleTheme} aria-label={theme === "dark" ? t("switchToLight") : t("switchToDark")}>
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
            <span>{theme === "dark" ? t("lightMode") : t("darkMode")}</span>
          </ThemeToggle>
          <SignOutButton type="button" onClick={handleSignOut}>
            <Icon>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Icon>
            {t("signOut")}
          </SignOutButton>
        </SidebarFooter>
      </Sidebar>
      {sidebarOpen && <Backdrop onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
      <Main $sidebarOpen={sidebarOpen}>
        <TopBar>
          <TopBarSide>
            {!sidebarOpen && (
              <ToggleButton type="button" onClick={() => setSidebarOpen(true)} aria-label={t("showSidebar")}>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
                <span>{t("showMenu")}</span>
              </ToggleButton>
            )}
          </TopBarSide>
          <TopBarTitleSlot $sidebarOpen={sidebarOpen}>
            {pageTitle && (
              <PageTitle $centered={titleCentered}>
                <TitleMark $centered={titleCentered} aria-hidden="true" />
                <TitleText>{pageTitle}</TitleText>
              </PageTitle>
            )}
          </TopBarTitleSlot>
          <TopBarSide $align="end" ref={setTopBarActionsEl} />
        </TopBar>
        <Content>{children}</Content>
      </Main>
    </Shell>
    </TopBarSlotsContext.Provider>
  );
};

const Shell = styled.div`
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  background: transparent;
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Sidebar = styled.aside`
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 260px;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;

  ${Nav} {
    flex: 1;
    overflow-y: auto;
  }
  border-right: 1px solid var(--container-border);
  box-shadow: inset -1px 0 0 var(--container-border-subtle);
  opacity: ${({ $sidebarOpen }) => ($sidebarOpen ? 1 : 0)};
  pointer-events: ${({ $sidebarOpen }) => ($sidebarOpen ? "auto" : "none")};
  transform: translateX(${({ $sidebarOpen }) => ($sidebarOpen ? 0 : "-100%")});
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 100;
`;

const Backdrop = styled.div`
  display: none;

  @media (max-width: 1368px) {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(2, 6, 23, 0.5);
    backdrop-filter: blur(1px);
  }
`;

const Main = styled.main`
  margin-left: ${({ $sidebarOpen }) => ($sidebarOpen ? "260px" : "0")};
  transition: margin-left 0.2s ease;
  padding: 28px 36px 28px;
  height: 100dvh;
  max-height: 100dvh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 1368px) {
    /* Sidebar overlays instead of pushing content on tablet and below. */
    margin-left: 0;
    padding: 18px 18px 18px;
  }

  @media (max-width: 600px) {
    padding: 14px 12px 12px;
  }
`;

const Brand = styled.h1`
  font-size: 18px;
  margin: 0;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--sidebar-text);
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const SidebarFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--container-border-subtle);
`;

const navAlertPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.08); }
`;

const StyledLink = styled(NavLink)`
  padding: 12px 14px;
  border-radius: 12px;
  color: var(--sidebar-text);
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  position: relative;

  &:hover {
    color: var(--sidebar-text);
    background: var(--hover-overlay);
    border-color: var(--container-border-strong);
  }

  &.active {
    background: var(--sidebar-orange);
    color: var(--sidebar-text-active);
    border-color: var(--sidebar-orange);
  }

  ${({ $alert }) =>
    $alert &&
    css`
      animation: ${navAlertPulse} 1.8s ease-in-out infinite;
      border-color: rgba(245, 158, 11, 0.55);
      background: color-mix(in srgb, rgba(245, 158, 11, 0.14) 70%, var(--hover-overlay));
    `}
`;

const NavBadge = styled.span`
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  background: #f59e0b;
  color: #111827;
`;

const TopBar = styled.div`
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  min-height: 36px;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  flex-shrink: 0;
`;

const TopBarSide = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: ${({ $align }) => ($align === "end" ? "flex-end" : "flex-start")};
  min-height: 36px;
  margin-left: ${({ $align }) => ($align === "end" ? "auto" : "0")};
  z-index: 1;
`;

const TopBarTitleSlot = styled.div`
  position: absolute;
  top: 50%;
  left: ${({ $sidebarOpen }) => ($sidebarOpen ? "0" : "50%")};
  transform: translate(
    ${({ $sidebarOpen }) => ($sidebarOpen ? "0" : "-50%")},
    -50%
  );
  transition:
    left 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 2;
  pointer-events: none;
  display: flex;
  align-items: center;

  > * {
    pointer-events: auto;
  }
`;

const PageTitle = styled.h1`
  margin: 0;
  display: inline-flex;
  flex-direction: ${({ $centered }) => ($centered ? "column" : "row")};
  align-items: center;
  gap: ${({ $centered }) => ($centered ? "6px" : "10px")};
  line-height: 1;
  transition: gap 0.3s cubic-bezier(0.22, 1, 0.36, 1);
`;

const TitleMark = styled.span`
  border-radius: 999px;
  background: var(--sidebar-orange);
  box-shadow: ${({ $centered }) =>
    $centered
      ? "none"
      : "0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 18%, transparent)"};
  flex-shrink: 0;
  order: ${({ $centered }) => ($centered ? 2 : 0)};
  width: ${({ $centered }) => ($centered ? "100%" : "4px")};
  height: ${({ $centered }) => ($centered ? "3px" : "1.05em")};
  transition:
    width 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1);

  @media (max-width: 1368px) {
    ${({ $centered }) =>
      $centered &&
      css`
        display: none;
      `}
  }
`;

const TitleText = styled.span`
  order: 1;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.035em;
  color: var(--text);
`;

const controlPill = css`
  border: 1px solid var(--container-border);
  background: var(--button-overlay);
  color: var(--text);
  height: 36px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  transition: border-color 0.18s ease, background 0.18s ease,
    color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--sidebar-orange) 55%, var(--container-border));
    background: color-mix(in srgb, var(--sidebar-orange) 8%, var(--button-overlay));
  }

  [data-theme="light"] & {
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(17, 24, 39, 0.05);
  }

  [data-theme="light"] &:hover {
    background: color-mix(in srgb, var(--sidebar-orange) 6%, #ffffff);
    border-color: color-mix(in srgb, var(--sidebar-orange) 45%, var(--container-border));
  }
`;

const ToggleButton = styled.button`
  ${controlPill}
  padding: 0 14px;

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  span {
    font-size: 14px;
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    width: 36px;
    padding: 0;
    gap: 0;

    span {
      display: none;
    }
  }
`;

const SidebarToggle = styled.button`
  ${controlPill}
  width: 36px;

  svg {
    width: 20px;
    height: 20px;
  }
`;

const ThemeToggle = styled.button`
  background: var(--button-overlay);
  color: var(--sidebar-text);
  border: 1px solid var(--container-border);
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;

  &:hover {
    color: var(--sidebar-text);
    border-color: var(--container-border-strong);
  }

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  span {
    font-size: 14px;
  }
`;

const SignOutButton = styled.button`
  background: var(--button-overlay);
  color: var(--sidebar-text);
  border: 1px solid var(--container-border);
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;

  &:hover {
    color: var(--sidebar-text);
    border-color: var(--container-border-strong);
  }
`;

const Content = styled.div`
  margin-top: 24px;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
`;

export default Layout;
