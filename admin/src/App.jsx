import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import GlobalStyles from "./styles/globalStyles";
import { AuthProvider } from "./context/AuthContext";
import { RestaurantProvider } from "./context/RestaurantContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { FeedbackAlertsProvider } from "./context/FeedbackAlertsContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Categories from "./pages/Categories";
import Tables from "./pages/Tables";
import Orders from "./pages/Orders";
import Reservations from "./pages/Reservations";
import Feedbacks from "./pages/Feedbacks";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import { PlanGate } from "./components/PlanGate";

const App = () => (
  <ThemeProvider>
    <LanguageProvider>
    <BrowserRouter>
      <GlobalStyles />
      <AuthProvider>
      <RestaurantProvider>
        <FeedbackAlertsProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Layout>
                  <Categories />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tables"
            element={
              <ProtectedRoute>
                <Layout>
                  <Tables />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Layout>
                  <Orders />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reservations"
            element={
              <ProtectedRoute>
                <Layout>
                  <PlanGate feature="reservations">
                    <Reservations />
                  </PlanGate>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedbacks"
            element={
              <ProtectedRoute>
                <Layout>
                  <Feedbacks />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <Layout>
                  <Support />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
        </FeedbackAlertsProvider>
      </RestaurantProvider>
      </AuthProvider>
    </BrowserRouter>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
