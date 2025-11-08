import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// Returns the current authenticated user's uid (or null).
export default function useAuthUid() {
	const { user } = useContext(AuthContext) || {};
	return user && user.uid ? user.uid : null;
}
