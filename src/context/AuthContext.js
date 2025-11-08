import React, { createContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";


// Provide role and user together so components (TopBar, AdminLogin) can share auth/profile data

export const AuthContext = createContext({ role: "", setRole: () => {}, user: null, setUser: () => {} });

export const AuthProvider = ({ children }) => {
	const [role, setRole] = useState("");
	const [user, setUser] = useState(null);

	// Subscribe to Firebase auth state so `user` reflects the signed-in account.
	useEffect(() => {
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
			} else {
				setUser(null);
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

