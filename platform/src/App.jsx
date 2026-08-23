import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { NewRestaurantPage } from "./pages/NewRestaurantPage";
import { RestaurantDetailPage } from "./pages/RestaurantDetailPage";
import { PaymentsPage } from "./pages/PaymentsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }
          >
            <Route index element={<RestaurantsPage />} />
            <Route path="restaurants/new" element={<NewRestaurantPage />} />
            <Route path="restaurants/:id" element={<RestaurantDetailPage />} />
            <Route path="payments" element={<PaymentsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
