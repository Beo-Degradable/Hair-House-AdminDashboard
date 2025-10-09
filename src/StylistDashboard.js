import React from "react";

const StylistDashboard = ({ onLogout }) => (
	<div style={{ color: "#FFD700", background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
		<h1>Stylist Dashboard</h1>
		<button style={{ background: "#FFD700", color: "#111", border: "none", borderRadius: 8, padding: "0.7rem 1.5rem", fontWeight: "bold", marginTop: 24, cursor: "pointer" }} onClick={onLogout}>Logout</button>
	</div>
);

export default StylistDashboard;
