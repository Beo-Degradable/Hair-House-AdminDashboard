import React, { createContext, useState } from "react";

export const AuthContext = createContext({ role: "", setRole: () => {} });

export const AuthProvider = ({ children }) => {
	const [role, setRole] = useState("");
	return (
		<AuthContext.Provider value={{ role, setRole }}>
			{children}
		</AuthContext.Provider>
	);
};
