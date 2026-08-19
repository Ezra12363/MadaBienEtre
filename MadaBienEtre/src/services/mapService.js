// src/services/mapService.js
import { get, post, handleApiError } from './api';
import * as Location from 'expo-location';

class MapService {
  /**
   * Mettre à jour la position de l'utilisateur
   */
  async updateLocation(latitude, longitude) {
    try {
      const response = await post('/geolocation/update', { latitude, longitude });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la mise à jour' };
    }
  }

  /**
   * Obtenir la position d'un utilisateur
   */
  async getUserLocation(userId) {
    try {
      const response = await get(`/geolocation/current/${userId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les thérapeutes à proximité
   */
  async getNearbyTherapists(latitude, longitude, radius = 10) {
    try {
      const response = await get('/geolocation/nearby-therapists', {
        latitude,
        longitude,
        radius_km: radius,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir la position actuelle de l'utilisateur
   */
  async getCurrentPosition() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, error: 'Permission de localisation refusée' };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        success: true,
        data: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
        },
      };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la localisation' };
    }
  }

  /**
   * Obtenir les positions client et thérapeute pour une réservation
   */
  async getBookingLocations(bookingId) {
    try {
      const response = await get(`/geolocation/booking/${bookingId}/location`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Calculer la distance entre deux points (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convertir degrés en radians
   */
  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Obtenir l'adresse à partir des coordonnées (reverse geocoding)
   */
  async getAddressFromCoords(latitude, longitude) {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (address) {
        return {
          success: true,
          data: {
            street: address.street,
            city: address.city,
            region: address.region,
            country: address.country,
            postalCode: address.postalCode,
            formatted: `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim(),
          },
        };
      }
      return { success: false, error: 'Adresse non trouvée' };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du géocodage' };
    }
  }

  /**
   * Obtenir les coordonnées à partir d'une adresse
   */
  async getCoordsFromAddress(address) {
    try {
      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        return {
          success: true,
          data: {
            latitude: results[0].latitude,
            longitude: results[0].longitude,
          },
        };
      }
      return { success: false, error: 'Coordonnées non trouvées' };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du géocodage' };
    }
  }
}

export default new MapService();