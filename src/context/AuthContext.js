import React, { createContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";


// Provide role and user together so components (TopBar, AdminLogin) can share auth/profile data

export const AuthContext = createContext({ role: "", setRole: () => {}, user: null, setUser: () => {} });

export const AuthProvider = ({ children }) => {
	const [role, setRole] = useState("");
	const [user, setUser] = useState(null);

	// Subscribe to Firebase auth state so `user` reflects the signed-in account.
	useEffect(() => {
		// Ensure auth persistence is set to browser local so sessions survive reloads
		// and browser restarts. This helps prevent accidental sign-outs.
		setPersistence(auth, browserLocalPersistence).catch(() => {});

		const unsubscribe = onAuthStateChanged(auth, (u) => {
			if (u) {
				// keep a small, serializable user object for the app UI
				setUser({
					uid: u.uid,
					email: u.email || null,
					displayName: u.displayName || null,
					photoURL: u.photoURL || null,
					providerData: u.providerData || null,
				});

				// Start a token keep-alive refresh loop while signed in.
				// This attempts to refresh the ID token periodically so the session
				// does not expire due to inactivity in long-lived browser sessions.
				try {
					const startTokenRefresh = () => {
						// refresh every 25 minutes (tokens typically are valid for 1 hour)
						const id = setInterval(async () => {
							try { await auth.currentUser?.getIdToken(true); } catch (e) { /* ignore refresh errors */ }
						}, 25 * 60 * 1000);
						return id;
					};
					// attach id to the user object for cleanup reference
					if (!u._tokenRefreshId) {
						u._tokenRefreshId = startTokenRefresh();
					}
				} catch (e) {
					// non-fatal
				}
			} else {
				// When signed out, clear the user state
				setUser(null);
				// clear any refresh interval if present
				try {
					if (auth.currentUser && auth.currentUser._tokenRefreshId) {
						clearInterval(auth.currentUser._tokenRefreshId);
					}
				} catch (e) { /* ignore */ }
			}
		});
		return () => unsubscribe();
	}, []);

	return (
		<AuthContext.Provider value={{ role, setRole, user, setUser }}>
			{children}
		</AuthContext.Provider>
	);
};

