// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authService';

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
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Connexion — appelle authService.login() qui gère déjà :
   * - le formulaire OAuth2 (username/password en form-urlencoded)
   * - le stockage des tokens
   * - la récupération de /me (avec le rôle)
   */
  const login = useCallback(async (email, password) => {
    try {
      const result = await authService.login(email, password);

      if (result.success) {
        setToken(result.data.access_token);
        setUser(result.data.user);
        setIsAuthenticated(true);
        return { success: true, data: result.data };
      }

      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur de connexion' };
    }
  }, []);

  /**
   * Inscription — appelle authService.register() (POST /register)
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
   * Vérification OTP — appelle authService.verifyOTP() (POST /verify-otp)
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
   * Renvoyer OTP — appelle authService.resendOTP() (POST /resend-otp)
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
   * Mot de passe oublié — appelle authService.forgotPassword() (POST /forgot-password)
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
   * Réinitialiser le mot de passe — appelle authService.resetPassword() (POST /reset-password)
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
   * Changer le mot de passe — appelle authService.changePassword() (PUT /change-password)
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
   * Déconnexion — appelle authService.logout() (POST /logout + clear storage)
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
   * ✅ Mettre à jour le profil dans l'état local + AsyncStorage.
   *
   * CORRIGÉ : cette fonction était auparavant déclarée EN DEHORS de
   * AuthProvider (donc jamais exposée par useAuth() → `updateProfile`
   * valait `undefined`), d'où l'erreur "TypeError: undefined is not
   * a function" juste après un upload pourtant réussi (200 côté
   * backend).
   *
   * ⚠️ Ne fait PAS d'appel réseau ici : ProfileScreen.js persiste déjà
   * les changements lui-même avant d'appeler cette fonction —
   * `put('/users/${userId}', updateData)` pour le profil complet, et
   * `api.post('/users/upload-profile-photo', formData)` pour la
   * photo (qui sauvegarde déjà `profile_image` en base côté
   * backend). `updateProfile` ne fait donc que fusionner ces valeurs
   * déjà persistées dans l'état local (`user`) + AsyncStorage, pour
   * que tout l'app (Header, écrans, etc.) voie immédiatement les
   * nouvelles données sans refaire une requête.
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
