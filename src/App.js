import React, { useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./pages/LogIn/AdminLogin";
import AdminDashboard from "./pages/AdminSide/AdminDashboard";
import StylistLayout from "./pages/StylistSide/StylistLayout";
// Stylist appointment page — import from the correct folder where the
// component actually lives. Previously the path referenced
// `AppointmentPage` which doesn't exist and prevented the route from
// rendering. Use the StylistAppointmentPage folder instead.
import StylistAppointmentPage from "./pages/StylistSide/StylistAppointmentPage";
import StylistAccountPage from "./pages/StylistSide/StylistAccountPage";
import StylistSettingsPage from "./pages/StylistSide/StylistSettingsPage";
import StylistHelpPage from "./pages/StylistSide/StylistHelpPage";
import StylistAboutPage from "./pages/StylistSide/StylistAboutPage";
import StylistHome from "./pages/StylistSide/StylistHome";
import TodayList from "./pages/StylistSide/TodayList";
import AccountSettingsPage from "./pages/AdminSide/AccountSettingsPage";
import NotificationsPage from "./pages/AdminSide/NotificationsPage";
import HelpPage from "./pages/AdminSide/HelpPage";
import AboutPage from "./pages/AdminSide/AboutPage";
import AdminAppointmentPage from "./pages/AdminSide/AppointmentPage/AppointmentPage";
import ProductPage from "./pages/AdminSide/ProductPage/ProductPage";
import ServicePage from "./pages/AdminSide/ServicePage/ServicePage";
import ServiceTypePage from "./pages/AdminSide/ServicePage/ServiceTypePage";
import PromotionsPage from "./pages/AdminSide/PromotionsPage/PromotionsPage";
import InventoryPage from "./pages/AdminSide/InventoryPage/InventoryPage";
import UsersPage from "./pages/AdminSide/UsersPage/UsersPage";
import RoleListingPage from "./pages/AdminSide/UsersPage/RoleListingPage";
import PaymentProfilesPage from "./pages/AdminSide/PaymentProfilesPage";
import { AuthContext } from "./context/AuthContext";
import SessionAlert from './components/SessionAlert';

function App() {
  const { role, setRole } = useContext(AuthContext);

  return (
    <BrowserRouter>
      <SessionAlert />
      {!role && <AdminLogin onLogin={setRole} />}
      {role === "stylist" && (
        <Routes>
          <Route path="/stylist/*" element={<StylistLayout onLogout={() => setRole("")} />}>
            <Route index element={<StylistHome />} />
            <Route path="appointments" element={<StylistAppointmentPage />} />
            <Route path="today" element={<TodayList />} />
            {/* Unified account page routes */}
            <Route path="account" element={<StylistAccountPage />} />
            <Route path="profile" element={<StylistAccountPage />} />
            <Route path="account-settings" element={<StylistAccountPage />} />
            <Route path="settings" element={<StylistSettingsPage />} />
            <Route path="help" element={<StylistHelpPage />} />
            <Route path="about" element={<StylistAboutPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/stylist" replace />} />
        </Routes>
      )}
      {role === "admin" && (
        <Routes>
          <Route path="/" element={<AdminDashboard onLogout={() => setRole("")} />}/>
          <Route path="/profile" element={<Navigate to="/account-settings" replace />} />
          <Route path="/account-settings" element={<AdminDashboard onLogout={() => setRole("")} page={<AccountSettingsPage />} />} />
          <Route path="/notifications" element={<AdminDashboard onLogout={() => setRole("")} page={<NotificationsPage />} />} />
          <Route path="/appointments" element={<AdminDashboard onLogout={() => setRole("") } page={<AdminAppointmentPage />} />} />
          <Route path="/products" element={<AdminDashboard onLogout={() => setRole("")} page={<ProductPage />} />} />
          <Route path="/services" element={<AdminDashboard onLogout={() => setRole("")} page={<ServicePage />} />} />
          <Route path="/services/type/:type" element={<AdminDashboard onLogout={() => setRole("")} page={<ServiceTypePage />} />} />
          <Route path="/promotions" element={<AdminDashboard onLogout={() => setRole("")} page={<PromotionsPage />} />} />
          <Route path="/inventory" element={<AdminDashboard onLogout={() => setRole("")} page={<InventoryPage />} />} />
          <Route path="/users" element={<AdminDashboard onLogout={() => setRole("")} page={<UsersPage />} />} />
          <Route path="/users/role/:role" element={<AdminDashboard onLogout={() => setRole("")} page={<RoleListingPage />} />} />
            <Route path="/profiles" element={<AdminDashboard onLogout={() => setRole("")} page={<PaymentProfilesPage />} />} />
          <Route path="/help" element={<AdminDashboard onLogout={() => setRole("")} page={<HelpPage />} />} />
          <Route path="/about" element={<AdminDashboard onLogout={() => setRole("")} page={<AboutPage />} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
