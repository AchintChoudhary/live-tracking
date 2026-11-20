import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore stored session on startup
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('@transit_token');
      const storedUser = await AsyncStorage.getItem('@transit_user');
      const storedRole = await AsyncStorage.getItem('@transit_role');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setRole(storedRole);
      }
    } catch (e) {
      console.log('Error restoring auth storage:', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, expectedRole) => {
    try {
      const res = await authApi.login({ email, password });
      if (res.data?.success) {
        const { token: jwtToken, user: authUser } = res.data;

        // Role enforcement check
        if (expectedRole && authUser.role !== expectedRole) {
          return {
            success: false,
            message: `Access denied. This account is registered as ${authUser.role}, not ${expectedRole}.`,
          };
        }

        setToken(jwtToken);
        setUser(authUser);
        setRole(authUser.role);

        await AsyncStorage.setItem('@transit_token', jwtToken);
        await AsyncStorage.setItem('@transit_user', JSON.stringify(authUser));
        await AsyncStorage.setItem('@transit_role', authUser.role);

        return { success: true, user: authUser };
      }
      return { success: false, message: res.data?.message || 'Login failed' };
    } catch (err) {
      console.log('Auth login exception:', err.message);
      return {
        success: false,
        message: err.response?.data?.message || 'Network error connecting to backend API',
      };
    }
  };

  const register = async (userData) => {
    try {
      const res = await authApi.register(userData);
      if (res.data?.success) {
        const { token: jwtToken, user: authUser } = res.data;
        setToken(jwtToken);
        setUser(authUser);
        setRole(authUser.role);

        await AsyncStorage.setItem('@transit_token', jwtToken);
        await AsyncStorage.setItem('@transit_user', JSON.stringify(authUser));
        await AsyncStorage.setItem('@transit_role', authUser.role);

        return { success: true, user: authUser };
      }
      return { success: false, message: res.data?.message || 'Registration failed' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Network error registering account',
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@transit_token');
      await AsyncStorage.removeItem('@transit_user');
      await AsyncStorage.removeItem('@transit_role');
      setToken(null);
      setUser(null);
      setRole(null);
    } catch (e) {
      console.log('Error clearing storage:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
