import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import GlobalStyles from "./styles/globalStyles";
import CustomerMenu from "./pages/CustomerMenu";

const App = () => (
  <BrowserRouter>
    <GlobalStyles />
    <Routes>
      <Route path="/" element={<Navigate to="/r/invalid/t/invalid" replace />} />
      <Route path="/r/:restaurantId/t/:tableId" element={<CustomerMenu />} />
    </Routes>
  </BrowserRouter>
);

export default App;
