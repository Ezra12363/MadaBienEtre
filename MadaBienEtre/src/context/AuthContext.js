// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authService';
import api from '../services/api'; // ✅ Ajout de l'import api

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthStatus = async () => {
    try {
      const storedToken = await authService.getStoredToken();
      const storedUser = await authService.getStoredUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        setIsAuthenticated(true);
        
        // ✅ Rafraîchir le profil depuis le backend
        await refreshUser();
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NOUVELLE FONCTION: Rafraîchir le profil depuis le backend
  const refreshUser = useCallback(async () => {
    try {
      const token = await authService.getStoredToken();
      if (!token) {
        return { success: false, error: 'Token non trouvé' };
      }

      const response = await api.get('/users/me');

      if (response?.data) {
        setUser(response.data);
        await authService.storeUser(response.data);
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: 'Impossible de récupérer le profil',
      };
    } catch (error) {
      console.error('❌ refreshUser error:', error);
      return {
        success: false,
        error: error?.message || 'Erreur lors du rafraîchissement du profil',
      };
    }
  }, []);

  /**
   * Connexion — appelle authService.login()
   */
  const login = useCallback(async (email, password) => {
    try {
      const result = await authService.login(email, password);

      if (result.success) {
        setToken(result.data.access_token);
        setUser(result.data.user);
        setIsAuthenticated(true);
        
        // ✅ Rafraîchir le profil depuis le backend pour avoir les données à jour
        await refreshUser();

        return { success: true, data: result.data };
      }

      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur de connexion' };
    }
  }, [refreshUser]);

  /**
   * Inscription — appelle authService.register()
   */
  const register = useCallback(async (userData) => {
    try {
      const result = await authService.register(userData);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message || "Erreur lors de l'inscription" };
    }
  }, []);

  /**
   * Vérification OTP
   */
  const verifyOTP = useCallback(async (email, otpCode) => {
    try {
      const result = await authService.verifyOTP(email, otpCode);
      return result;
    } catch (error) {
      return { success: false, error: error.message || 'Erreur de vérification' };
    }
  }, []);

  /**
   * Renvoyer OTP
   */
  const resendOTP = useCallback(async (email) => {
    try {
      const result = await authService.resendOTP(email);
      return result;
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du renvoi' };
    }
  }, []);

  /**
   * Mot de passe oublié
   */
  const forgotPassword = useCallback(async (email) => {
    try {
      const result = await authService.forgotPassword(email);
      console.log('📧 Forgot password result:', result);
      return result;
    } catch (error) {
      console.error('❌ Forgot password error:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la demande',
      };
    }
  }, []);

  /**
   * Réinitialiser le mot de passe
   */
  const resetPassword = useCallback(async (email, otpCode, newPassword) => {
    try {
      const result = await authService.resetPassword(email, otpCode, newPassword);
      return result;
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la réinitialisation' };
    }
  }, []);

  /**
   * Changer le mot de passe
   */
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    try {
      const result = await authService.changePassword(oldPassword, newPassword);
      return result;
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du changement' };
    }
  }, []);

  /**
   * Déconnexion
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
    authService.storeUser(userData);
  }, []);

  /**
   * Mettre à jour le profil localement
   */
  const updateProfile = useCallback(async (updates = {}) => {
    try {
      const mergedUser = { ...user, ...updates };
      setUser(mergedUser);
      await authService.storeUser(mergedUser);
      return { success: true, data: mergedUser };
    } catch (error) {
      console.error('❌ updateProfile error:', error?.message || error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la mise à jour du profil',
      };
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated,
      login,
      register,
      verifyOTP,
      resendOTP,
      forgotPassword,
      resetPassword,
      changePassword,
      logout,
      updateUser,
      updateProfile,
      refreshUser, // ✅ EXPOSER refreshUser
    }),
    [
      user,
      token,
      isLoading,
      isAuthenticated,
      login,
      register,
      verifyOTP,
      resendOTP,
      forgotPassword,
      resetPassword,
      changePassword,
      logout,
      updateUser,
      updateProfile,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;