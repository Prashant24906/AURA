import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { setTokenGetter, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => {
    setTokenGetter(() => accessToken);
  }, [accessToken]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
  }, [handleUnauthorized]);

  // On mount, try to restore session via refresh token
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await authService.refresh();
        setAccessToken(res.data.data.accessToken);
        setUser(res.data.data.user);
      } catch {
        // No valid refresh token — user stays logged out
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const res = await authService.login({ email, password });
    const { user: u, accessToken: token } = res.data.data;
    setUser(u);
    setAccessToken(token);
    return u;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {}
    setUser(null);
    setAccessToken(null);
  };

  const updateUser = (updatedUser) => setUser(updatedUser);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be inside AuthProvider');
  return ctx;
};

export default AuthContext;
