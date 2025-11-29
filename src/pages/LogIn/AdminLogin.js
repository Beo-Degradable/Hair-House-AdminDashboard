
import React, { useState, useContext } from "react";
import { useNavigate } from 'react-router-dom';
import "./AdminLogin.css";
import { auth, db } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

// Logo component that loads the image from the public folder.
// Put your image at `public/LogoH.png`.
const Logo = () => {
	const [err, setErr] = React.useState(false);
	// show only the image (no text) and make it slightly larger for better visibility
	if (!err) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
				<img
					src="/LogoH.png"
					alt="Hair House"
					onError={() => setErr(true)}
					style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 12 }}
				/>
			</div>
		);
	}
	// fallback: show a larger SVG placeholder without text
	return (
		<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
			<div style={{ width: 120, height: 120, borderRadius: 12, background: 'var(--bg-drawer)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-main)' }}>
				<svg width="72" height="72" viewBox="0 0 24 24" fill="none">
					<path d="M12 2 L15 8 L22 9 L17 14 L18 21 L12 18 L6 21 L7 14 L2 9 L9 8 Z" fill="#e6d49a" />
				</svg>
			</div>
		</div>
	);
};

// Ripple background component
const RippleBackground = () => (
	<div className="ripple-bg">
		{[...Array(7)].map((_, i) => (
			<div key={i} className={`ripple ripple-${i}`}></div>
		))}
	</div>
);


import { AuthContext } from "../../context/AuthContext";
import { validateForm } from '../../utils/validators';

const AdminLogin = ({ onLogin }) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
    const { setUser } = useContext(AuthContext);

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

		const navigate = useNavigate();

		const handleSubmit = async (e) => {
			e.preventDefault();
			setError("");
			// quick form validation
			const v = validateForm(e.target);
			if (!v.ok) { setError(v.message || 'Invalid input'); return; }
			setLoading(true);
			try {
						// Firebase Auth sign in
						await signInWithEmailAndPassword(auth, email, password);
				// Query Firestore for user with matching email
				const q = query(collection(db, "users"), where("email", "==", email));
				const querySnapshot = await getDocs(q);
				if (!querySnapshot.empty) {
					const data = querySnapshot.docs[0].data();
					// populate context user for TopBar avatar/menu
					try {
						const userObj = {
							name: data.name || data.displayName || auth.currentUser?.displayName || "",
							email: data.email || auth.currentUser?.email || email,
							avatar: data.avatar || data.photoURL || auth.currentUser?.photoURL || "",
						};
						setUser && setUser(userObj);
					} catch (ctxErr) {
						// non-fatal: continue without context
						console.warn("Failed to set user in context:", ctxErr);
					}

										if (data.role === "admin") {
												onLogin("admin");
												// after role is set, navigate to saved redirect if present
												try {
													const r = localStorage.getItem('postAuthRedirect');
													if (r) {
														localStorage.removeItem('postAuthRedirect');
														navigate(r, { replace: true });
													}
												} catch (e) {}
										} else if (data.role === "stylist") {
												onLogin("stylist");
												try {
													const r = localStorage.getItem('postAuthRedirect');
													if (r) {
														localStorage.removeItem('postAuthRedirect');
														navigate(r, { replace: true });
													}
												} catch (e) {}
										} else {
												setError("Role not assigned. Contact admin.");
										}
				} else {
					// If there's no user doc, still try to populate user from auth profile
					if (auth.currentUser) {
						setUser && setUser({
							name: auth.currentUser.displayName || "",
							email: auth.currentUser.email || email,
							avatar: auth.currentUser.photoURL || "",
						});
					}
					setError("User role not found.");
				}
			} catch (err) {
				// Map common Firebase Auth errors to friendly messages so we don't
				// show raw error codes like "auth/invalid-credential" to users.
				const code = err && (err.code || (err.error && err.error.code));
				let friendly = "Login failed. Please try again.";
				if (code) {
					switch (code) {
						case "auth/wrong-password":
					case "auth/invalid-credential":
					case "auth/user-not-found":
					case "auth/invalid-email":
							friendly = "Email or password is incorrect. Please try again.";
							break;
						case "auth/too-many-requests":
							friendly = "Too many failed attempts. Try again later.";
							break;
						default:
							friendly = "Login failed. Please try again.";
					}
				} else if (err && typeof err === "string") {
					// sometimes an error string is passed
					friendly = err;
				}
				console.warn("Login error:", err);
				setError(friendly);
			}
			setLoading(false);
		};



					return (
						<div
							className="admin-login-bg"
							style={{
								backgroundImage: `url(${process.env.PUBLIC_URL}/hxhbg.jpg)`,
								backgroundPosition: 'center center',
								backgroundSize: 'cover',
								backgroundRepeat: 'no-repeat',
							}}
						>
							<div className="admin-login-center-wrapper">
								<div className="admin-login-container">
									{/* Logo and greeting moved inside the container per UI request */}
									<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: '0.8rem' }}>
										<Logo />
										<h2 className="admin-login-title">Welcome to Hair House Dashboard</h2>
									</div>
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
													<ellipse cx="12" cy="12" rx="8" ry="5" stroke="#e6d49a" strokeWidth="2" />
													{showPassword ? (
														<circle cx="12" cy="12" r="2" fill="#e6d49a" />
													) : (
														<rect x="10" y="10" width="4" height="4" fill="#e6d49a" />
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
