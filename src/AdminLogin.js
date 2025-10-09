
import React, { useState } from "react";
import "./AdminLogin.css";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

// Placeholder logo component (replace with actual logo if available)
const Logo = () => (
	<div className="logo-placeholder">LOGO</div>
);

// Ripple background component
const RippleBackground = () => (
	<div className="ripple-bg">
		{[...Array(7)].map((_, i) => (
			<div key={i} className={`ripple ripple-${i}`}></div>
		))}
	</div>
);


const AdminLogin = ({ onLogin }) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	// Email validation: allow only valid email characters
	const handleEmailChange = (e) => {
		const value = e.target.value;
		if (/^[a-zA-Z0-9@._-]*$/.test(value)) {
			setEmail(value);
			setError("");
		} else {
			setError("Invalid character in email.");
		}
	};

	// Password validation: allow standard password chars, reject spaces and some specials
	const handlePasswordChange = (e) => {
		const value = e.target.value;
		if (/^[a-zA-Z0-9!@#$%^&*()_+\-=]*$/.test(value)) {
			setPassword(value);
			setError("");
		} else {
			setError("Invalid character in password.");
		}
	};

		const handleSubmit = async (e) => {
			e.preventDefault();
			setError("");
			setLoading(true);
			try {
				// Firebase Auth sign in
				await signInWithEmailAndPassword(auth, email, password);
				// Query Firestore for user with matching email
				const q = query(collection(db, "users"), where("email", "==", email));
				const querySnapshot = await getDocs(q);
				if (!querySnapshot.empty) {
					const data = querySnapshot.docs[0].data();
					if (data.role === "admin") {
						onLogin("admin");
					} else if (data.role === "stylist") {
						onLogin("stylist");
					} else {
						setError("Role not assigned. Contact admin.");
					}
				} else {
					setError("User role not found.");
				}
			} catch (err) {
				setError(err.message || "Login failed.");
			}
			setLoading(false);
		};

					return (
						<div className="admin-login-bg">
							<RippleBackground />
							<div className="admin-login-center-wrapper">
								<div className="admin-login-header-outer">
									<Logo />
									<h2 className="admin-login-title">Welcome to Hair House Dashboard</h2>
								</div>
								<div className="admin-login-container">
									<form className="admin-login-form" onSubmit={handleSubmit} autoComplete="off">
										<div className="admin-login-desc">Please log in your credentials</div>
										<input
											type="text"
											placeholder="Email"
											value={email}
											onChange={handleEmailChange}
											className="admin-login-input"
											autoComplete="username"
											required
											disabled={loading}
										/>
										<div className="admin-login-password-wrapper">
											<input
												type={showPassword ? "text" : "password"}
												placeholder="Password"
												value={password}
												onChange={handlePasswordChange}
												className="admin-login-input"
												autoComplete="current-password"
												required
												disabled={loading}
											/>
											<span
												className={`eye-icon${showPassword ? " open" : ""}`}
												onClick={() => setShowPassword((v) => !v)}
												tabIndex={0}
												role="button"
												aria-label="Toggle password visibility"
											>
												<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
													<ellipse cx="12" cy="12" rx="8" ry="5" stroke="#FFD700" strokeWidth="2" />
													{showPassword ? (
														<circle cx="12" cy="12" r="2" fill="#FFD700" />
													) : (
														<rect x="10" y="10" width="4" height="4" fill="#FFD700" />
													)}
												</svg>
											</span>
										</div>
										{error && <div className="admin-login-error">{error}</div>}
										<button className="admin-login-btn" type="submit" disabled={loading}>
											{loading ? "Logging in..." : "Enter"}
										</button>
									</form>
								</div>
							</div>
						</div>
					);
};

export default AdminLogin;
