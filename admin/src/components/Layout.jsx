import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../context/AuthContext";
import { useRestaurant } from "../context/RestaurantContext";

const Layout = ({ children }) => {
  const { signOut } = useAuth();
  const { restaurant } = useRestaurant();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Shell $sidebarOpen={sidebarOpen}>
      <Sidebar $sidebarOpen={sidebarOpen}>
        <SidebarHeader>
          <Brand>{restaurant?.name ?? "Your Restaurant"}</Brand>
          {sidebarOpen && (
            <SidebarToggle type="button" onClick={() => setSidebarOpen(false)}>
              Hide
            </SidebarToggle>
          )}
        </SidebarHeader>
        <Nav>
          <StyledLink to="/dashboard">Dashboard</StyledLink>
          <StyledLink to="/categories">Categories</StyledLink>
          <StyledLink to="/tables">Tables</StyledLink>
          <StyledLink to="/orders">Orders</StyledLink>
          <StyledLink to="/settings">Settings</StyledLink>
          <StyledLink to="/support">Support</StyledLink>
          <SignOutButton type="button" onClick={handleSignOut}>
            Sign out
          </SignOutButton>
        </Nav>
      </Sidebar>
      <Main>
        <TopBar>
          <TopBarLeft>
            {!sidebarOpen && (
              <ToggleButton type="button" onClick={() => setSidebarOpen(true)}>
                Show menu
              </ToggleButton>
            )}
          </TopBarLeft>
        </TopBar>
        <Content>{children}</Content>
      </Main>
    </Shell>
  );
};

const Shell = styled.div`
  display: grid;
  grid-template-columns: ${({ $sidebarOpen }) => ($sidebarOpen ? "260px 1fr" : "0 1fr")};
  min-height: 100vh;
  background: transparent;
`;

const Sidebar = styled.aside`
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.95), rgba(11, 16, 32, 0.98));
  color: var(--text);
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
  width: 260px;
  border-right: 1px solid var(--border);
  box-shadow: inset -1px 0 0 rgba(15, 23, 42, 0.6);
  opacity: ${({ $sidebarOpen }) => ($sidebarOpen ? 1 : 0)};
  pointer-events: ${({ $sidebarOpen }) => ($sidebarOpen ? "auto" : "none")};
  transition: opacity 0.2s ease;
`;

const Brand = styled.h1`
  font-size: 18px;
  margin: 0;
  font-weight: 600;
  letter-spacing: 0.3px;
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const StyledLink = styled(NavLink)`
  padding: 12px 14px;
  border-radius: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;

  &:hover {
    color: var(--text);
    background: rgba(99, 102, 241, 0.12);
    border-color: rgba(99, 102, 241, 0.2);
  }

  &.active {
    background: rgba(99, 102, 241, 0.2);
    color: #fff;
    border-color: rgba(99, 102, 241, 0.4);
    box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.2);
  }
`;

const Main = styled.main`
  padding: 28px 36px 40px;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
`;

const TopBarLeft = styled.div`
  display: grid;
  gap: 6px;
`;

const ToggleButton = styled.button`
  border: 1px solid var(--border-strong);
  background: rgba(15, 23, 42, 0.4);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 14px;
  width: fit-content;
  cursor: pointer;
`;

const SidebarToggle = styled.button`
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.4);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
`;

const SignOutButton = styled.button`
  background: rgba(15, 23, 42, 0.4);
  color: var(--text-muted);
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: var(--text);
    border-color: rgba(99, 102, 241, 0.4);
  }
`;

const Content = styled.div`
  margin-top: 24px;
  width: 100%;
`;

export default Layout;
