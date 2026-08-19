// src/services/authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { post, get, put, handleApiError } from './api';

// Clés de stockage
const TOKEN_KEY = '@mada_token';
const REFRESH_TOKEN_KEY = '@mada_refresh_token';
const USER_KEY = '@mada_user';

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   * Backend: POST /register (JSON)
   */
  async register(userData) {
    try {
      const response = await post('/register', userData);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || "Erreur lors de l'inscription" };
    }
  }

  /**
   * Connexion utilisateur
   * ⚠️ Backend: POST /login attend un formulaire OAuth2
   * (application/x-www-form-urlencoded avec les champs "username" et "password")
   */
  async login(email, password) {
    try {
      const formBody = new URLSearchParams();
      formBody.append('username', email);
      formBody.append('password', password);

      const response = await post('/login', formBody.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      const { access_token, refresh_token } = response.data;

      // Stocker les tokens
      await this.storeTokens(access_token, refresh_token);

      // Récupérer les infos utilisateur
      const userResponse = await this.getCurrentUser();
      if (userResponse.success) {
        await this.storeUser(userResponse.data);
      }

      return {
        success: true,
        data: {
          ...response.data,
          user: userResponse.success ? userResponse.data : null,
        },
      };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur de connexion' };
    }
  }

  /**
   * Vérification OTP
   * Backend: POST /verify-otp
   */
  async verifyOTP(email, otpCode) {
    try {
      const response = await post('/verify-otp', { email, otp_code: otpCode });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur de vérification' };
    }
  }

  /**
   * Renvoyer OTP
   * Backend: POST /resend-otp
   */
  async resendOTP(email) {
    try {
      const response = await post(`/resend-otp?email=${encodeURIComponent(email)}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du renvoi' };
    }
  }

  /**
   * Mot de passe oublié
   * Backend: POST /forgot-password
   */
  // src/services/authService.js
async forgotPassword(email) {
  try {
    console.log('📧 Sending forgot password request for:', email);
    const response = await post('/forgot-password', { email });
    console.log('📧 Forgot password response:', response);
    
    if (response.error) {
      return { success: false, error: response.error.message };
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    return { 
      success: false, 
      error: error.message || 'Erreur lors de la demande' 
    };
  }
}

  /**
   * Réinitialisation du mot de passe
   * Backend: POST /reset-password
   */
  async resetPassword(email, otpCode, newPassword) {
    try {
      const response = await post('/reset-password', {
        email,
        otp_code: otpCode,
        new_password: newPassword,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la réinitialisation' };
    }
  }

  /**
   * Changer le mot de passe
   * Backend: PUT /change-password
   */
  async changePassword(oldPassword, newPassword) {
    try {
      const response = await put('/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du changement' };
    }
  }

  /**
   * Obtenir les informations de l'utilisateur connecté
   * Backend: GET /me
   */
  async getCurrentUser() {
    try {
      const response = await get('/me');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la récupération' };
    }
  }

  /**
   * Rafraîchir le token
   * Backend: POST /refresh-token
   */
  async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        return { success: false, error: 'Aucun refresh token' };
      }

      const response = await post('/refresh-token', { refresh_token: refreshToken });
      if (response.error) {
        return { success: false, error: response.error.message };
      }

      const { access_token, refresh_token } = response.data;
      await this.storeTokens(access_token, refresh_token);

      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du rafraîchissement' };
    }
  }

  /**
   * Déconnexion
   * Backend: POST /logout
   */
  async logout() {
    try {
      await post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearStorage();
    }
  }

  // ============================================
  // ✅ GESTION DU STOCKAGE
  // ============================================

  async storeTokens(accessToken, refreshToken) {
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  async storeUser(user) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  async getStoredUser() {
    try {
      const userStr = await AsyncStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  }

  async getStoredToken() {
    return await AsyncStorage.getItem(TOKEN_KEY);
  }

  async getStoredRefreshToken() {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  }

  async isAuthenticated() {
    const token = await this.getStoredToken();
    return !!token;
  }

  async clearStorage() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }

  // ============================================
  // ✅ FANAMARINANA NY TOKENS
  // ============================================

  async getAuthHeader() {
    const token = await this.getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

export default new AuthService();