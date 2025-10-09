import React, { useState } from "react";

const drawerWidth = 260;

const AdminDashboard = ({ onLogout }) => {
	const [drawerOpen, setDrawerOpen] = useState(false);
		// Persist darkMode in localStorage
		const [darkMode, setDarkMode] = useState(() => {
			const stored = localStorage.getItem('darkMode');
			return stored === null ? false : stored === 'true';
		});
		const toggleDarkMode = () => {
			setDarkMode((prev) => {
				localStorage.setItem('darkMode', !prev);
				return !prev;
			});
		};
	const [settingsOpen, setSettingsOpen] = useState(false);

	// Theme variables for dark and light mode
		const theme = darkMode
			? {
					'--bg-main': '#181818',
					'--bg-drawer': '#232323',
					'--text-main': '#FFD700',
					'--text-secondary': '#fffbe6',
					'--border-main': '#bfa14a',
					'--icon-main': '#FFD700',
					'--btn-bg': 'none',
					'--btn-hover': '#333',
					'--logout-bg': '#d32f2f',
					'--logout-color': '#fff',
					'--font-weight-main': 600,
				}
			: {
					'--bg-main': '#fffbe6',
					'--bg-drawer': '#fff',
					'--text-main': '#181818',
					'--text-secondary': '#FFD700',
					'--border-main': '#FFD700',
					'--icon-main': '#181818',
					'--btn-bg': 'none',
					'--btn-hover': '#f5e9b7',
					'--logout-bg': '#d32f2f',
					'--logout-color': '#fff',
					'--font-weight-main': 700,
				};

	return (
		<div
					style={{
						minHeight: "100vh",
						width: "100vw",
						position: "relative",
						color: "var(--text-main)",
						background: "var(--bg-main)",
						fontWeight: "var(--font-weight-main)",
						transition: "background 0.3s, color 0.3s, font-weight 0.3s",
						...theme
					}}
		>
			{/* Drawer overlay */}
			{drawerOpen && (
				<div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.25)", zIndex: 20, transition: "opacity 0.3s" }} />
			)}
			{/* Drawer */}
		<div
			style={{
				position: "fixed",
				top: 0,
				left: drawerOpen ? 0 : -drawerWidth,
				width: drawerWidth,
				height: "100vh",
				background: "var(--bg-drawer)",
				borderRight: "2px solid var(--border-main)",
				boxShadow: drawerOpen ? (darkMode ? "2px 0 16px #0008" : "2px 0 16px #FFD70033") : "none",
				zIndex: 30,
				transition: "left 0.3s cubic-bezier(.4,0,.2,1)",
				display: "flex",
				flexDirection: "column"
			}}
		>
						{/* Burger icon inside drawer with roll animation */}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										padding: "2rem 1.5rem 1rem 1.5rem",
										borderBottom: "1px solid #bfa14a",
										fontWeight: "bold",
										fontSize: 20,
										color: "#FFD700",
										position: "relative",
										minHeight: 40
									}}
								>
												<span
																style={{
																	position: "absolute",
																	left: drawerOpen ? `calc(100% - 48px)` : 0,
																	top: "50%",
																	transform: drawerOpen ? "translateY(-50%) rotate(90deg)" : "translateY(-50%)",
																	transformOrigin: "50% 50%",
																	transition: "left 0.4s cubic-bezier(.4,0,.2,1), transform 0.4s cubic-bezier(.4,0,.2,1)",
																	cursor: "pointer",
																	display: "inline-flex",
																	flexDirection: "column",
																	justifyContent: "center",
																	alignItems: "center",
																	width: 30,
																	height: 30,
																	zIndex: 2
																}}
													title="Close Drawer"
													onClick={() => setDrawerOpen(false)}
												>
													<span style={{ width: 24, height: 2.5, background: "#FFD700", borderRadius: 1, margin: "4px 0" }}></span>
													<span style={{ width: 24, height: 2.5, background: "#FFD700", borderRadius: 1, margin: "4px 0" }}></span>
													<span style={{ width: 24, height: 2.5, background: "#FFD700", borderRadius: 1, margin: "4px 0" }}></span>
												</span>
									{/* Only show 'Menu' text after icon is in position */}
									<span
										style={{
											marginLeft: drawerOpen ? 0 : 48,
											opacity: drawerOpen ? 1 : 0,
											transition: "opacity 0.2s 0.4s, margin-left 0.4s cubic-bezier(.4,0,.2,1)",
											display: "inline-block"
										}}
									>
										Menu
									</span>
								</div>
										{/* Profile */}
			<button style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10 }}>
				<span>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
						<circle cx="12" cy="8" r="4" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
						<path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
					</svg>
				</span>
				Profile
			</button>
										{/* Account Settings */}
			<button style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10 }}>
				<span>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
						<rect x="4" y="7" width="16" height="2" rx="1" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
						<rect x="4" y="15" width="16" height="2" rx="1" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
						<rect x="4" y="11" width="16" height="2" rx="1" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
					</svg>
				</span>
				Account Settings
			</button>
										{/* Notifications */}
			<button style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10 }}>
				<span>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
						<path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-5-6.32V4a1 1 0 1 0-2 0v.68C7.63 5.36 6 7.92 6 11v5l-1.29 1.29A1 1 0 0 0 6 19h12a1 1 0 0 0 .71-1.71L18 16z" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
					</svg>
				</span>
				Notifications
			</button>
												{/* Settings with dark mode toggle */}
					{/* Settings dropdown in drawer */}
					<div style={{ width: "100%" }}>
						<button
							style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10, width: "100%", justifyContent: "space-between" }}
							onClick={() => setSettingsOpen((v) => !v)}
						>
							<span style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
									<circle cx="12" cy="12" r="3" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
									<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 11 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09c.36.13.7.3 1 .51a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
								</svg>
								Settings
							</span>
							<span style={{ transition: "transform 0.2s", transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
									<path d="M8 10l4 4 4-4" stroke="var(--icon-main)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
								</svg>
							</span>
						</button>
						{settingsOpen && (
							<div style={{ paddingLeft: 36, paddingTop: 4, paddingBottom: 4 }}>
								<label style={{ color: "var(--icon-main)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
									<input type="checkbox" checked={darkMode} onChange={toggleDarkMode} style={{ accentColor: "var(--icon-main)" }} />
									Dark Mode
								</label>
							</div>
						)}
					</div>
										{/* Help */}
			<button style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10 }}>
				<span>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
						<circle cx="12" cy="12" r="10" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
						<path d="M12 16v-1c0-1.1.9-2 2-2s2-.9 2-2-.9-2-2-2-2 .9-2 2" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
						<circle cx="12" cy="18" r="1" fill="var(--icon-main)"/>
					</svg>
				</span>
				Help
			</button>
										{/* About */}
			<button style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10 }}>
				<span>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
						<circle cx="12" cy="12" r="10" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
						<path d="M12 8v4" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
						<circle cx="12" cy="16" r="1" fill="var(--icon-main)"/>
					</svg>
				</span>
				About
			</button>
												{/* Logout at bottom, red */}
			<div style={{ position: "absolute", bottom: 30, left: 0, width: "100%", display: "flex", justifyContent: "center" }}>
				<button style={{
					...drawerBtnStyle,
					display: "flex",
					alignItems: "center",
					gap: 10,
					color: "var(--logout-color)",
					background: "var(--logout-bg)",
					border: "none",
					fontWeight: 700,
					width: "90%"
				}} onClick={onLogout}>
					<span>
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
							<path d="M16 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="var(--logout-color)" strokeWidth="1.5" fill="none"/>
							<path d="M21 12H9m0 0l3-3m-3 3l3 3" stroke="var(--logout-color)" strokeWidth="1.5" fill="none"/>
						</svg>
					</span>
					Logout
				</button>
			</div>
						<div style={{ marginTop: "auto", padding: "1.5rem 1.5rem 2rem 1.5rem", borderTop: "1px solid #bfa14a" }}>
							<label style={{ color: "#FFD700", fontWeight: "bold", fontSize: 15 }}>
								<input type="checkbox" checked={darkMode} onChange={() => setDarkMode((v) => !v)} style={{ marginRight: 8 }} />
								Dark Mode
							</label>
							<div style={{ color: "#bfa14a", fontSize: 12, marginTop: 10 }}>v1.0.0</div>
						</div>
					</div>

					{/* Top bar */}
					<div style={{ width: "100%", display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "1.2rem 3.5rem 0.5rem 0", position: "relative" }}>
						{/* Drawer menu icon */}
						<span style={{ marginRight: "auto", marginLeft: 10, cursor: "pointer" }} title="Menu" onClick={() => setDrawerOpen(true)}>
							<svg width="30" height="30" viewBox="0 0 24 24" fill="none">
								<rect y="4" width="24" height="2.5" rx="1" fill="#FFD700" />
								<rect y="11" width="24" height="2.5" rx="1" fill="#FFD700" />
								<rect y="18" width="24" height="2.5" rx="1" fill="#FFD700" />
							</svg>
						</span>
						{/* User icon */}
						<span style={{ marginRight: "1.5rem", cursor: "pointer" }} title="User">
							<svg width="26" height="26" viewBox="0 0 24 24" fill="none">
								<circle cx="12" cy="8" r="4" stroke="#FFD700" strokeWidth="1.5" fill="none"/>
								<path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4" stroke="#FFD700" strokeWidth="1.5" fill="none"/>
							</svg>
						</span>
					</div>
			{/* Main content */}
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
				<h1>Admin Dashboard</h1>
				{/* ...other dashboard content... */}
			</div>
		</div>
	);
};

const drawerBtnStyle = {
	width: "100%",
	background: "var(--btn-bg)",
	color: "var(--text-main)",
	border: "none",
	padding: "1rem 1.5rem",
	textAlign: "left",
	cursor: "pointer",
	fontWeight: "var(--font-weight-main)",
	fontSize: 17,
	outline: "none",
	letterSpacing: 0.5,
	transition: "background 0.2s, color 0.2s, font-weight 0.2s"
};

export default AdminDashboard;
