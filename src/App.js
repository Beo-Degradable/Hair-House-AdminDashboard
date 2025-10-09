
import React, { useContext, useState } from "react";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import StylistDashboard from "./StylistDashboard";
import { AuthContext } from "./context/AuthContext";

function App() {
  const { role, setRole } = useContext(AuthContext);

  if (!role) {
    return <AdminLogin onLogin={setRole} />;
  }
  if (role === "admin") {
    return <AdminDashboard onLogout={() => setRole("")} />;
  }
  if (role === "stylist") {
    return <StylistDashboard onLogout={() => setRole("")} />;
  }
  return null;
}

export default App;
