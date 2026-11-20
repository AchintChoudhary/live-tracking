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
        try {
          const profile = await authApi.getMe();
          if (profile.data?.success) {
            const currentUser = profile.data.data?.user || profile.data.data || profile.data.user;
            if (currentUser) {
              setToken(storedToken);
              setUser(currentUser);
              setRole(currentUser.role);
              await AsyncStorage.setItem('@transit_user', JSON.stringify(currentUser));
              await AsyncStorage.setItem('@transit_role', currentUser.role);
              return;
            }
          }
        } catch (profileError) {
          console.log('Stored session validation failed:', profileError.response?.data?.message || profileError.message);
          if ([401, 403].includes(profileError.response?.status)) {
            await AsyncStorage.multiRemove(['@transit_token', '@transit_user', '@transit_role']);
          } else {
            const cachedUser = JSON.parse(storedUser);
            setToken(storedToken);
            setUser(cachedUser);
            setRole(cachedUser.role || storedRole);
          }
        }
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

  const registerDriver = async (driverData) => {
    try {
      const res = await authApi.registerDriver(driverData);
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
      return { success: false, message: res.data?.message || 'Driver registration failed' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Network error registering driver account',
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
        registerDriver,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
