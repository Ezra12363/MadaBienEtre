// src/context/BookingContext.js
import { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
// ✅ FIXÉ (BUG MAJEUR) : ce contexte ne faisait QUE simuler des
// données (bookings statiques codées en dur, createBooking qui ne
// contactait jamais le serveur). Résultat : une réservation "créée"
// n'existait jamais réellement côté backend, et la liste "Mes
// réservations" n'affichait jamais les vraies données de l'utilisateur.
// On branche maintenant sur le vrai service HTTP (bookingService.js),
// qui appelle les routes réelles définies dans app/api/bookings.py.
import bookingService from '../services/bookingService';

const BookingContext = createContext();

export const BookingProvider = ({ children }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [offers] = useState([]);

  useEffect(() => {
    if (user) {
      loadBookings();
    } else {
      // ✅ Nettoyage à la déconnexion, pour ne jamais laisser les
      // réservations d'un précédent utilisateur visibles.
      setBookings([]);
      setCurrentBooking(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /**
   * ✅ Charge les VRAIES réservations de l'utilisateur connecté
   * (GET /bookings — filtré côté backend par client_id/therapist_id
   * selon le rôle de l'utilisateur, voir app/api/bookings.py).
   */
  const loadBookings = async (params = {}) => {
    try {
      setIsLoading(true);
      const result = await bookingService.getBookings(params);

      if (result.success) {
        setBookings(Array.isArray(result.data) ? result.data : []);
        return { success: true, data: result.data };
      }

      console.warn('⚠️ [BookingContext] loadBookings:', result.error);
      return { success: false, error: result.error };
    } catch (error) {
      console.error('❌ [BookingContext] loadBookings exception:', error.message);
      return { success: false, error: error.message || 'Erreur lors du chargement des réservations' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ✅ Crée réellement la réservation via POST /bookings.
   * En cas de succès, la nouvelle réservation (telle que renvoyée par
   * le backend, avec son vrai `id`) est ajoutée en tête de liste, afin
   * que l'écran "Mes réservations" la reflète immédiatement sans
   * attendre un rechargement complet.
   */
  const createBooking = async (bookingData) => {
    try {
      setIsLoading(true);
      const result = await bookingService.createBooking(bookingData);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const newBooking = result.data;
      setBookings((prev) => [newBooking, ...prev]);
      setCurrentBooking(newBooking);

      return { success: true, data: newBooking };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Erreur lors de la création de la réservation',
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ✅ Récupère le détail réel d'une réservation (GET /bookings/{id}),
   * au lieu de chercher dans un tableau simulé en mémoire.
   */
  const getBookingDetails = async (bookingId) => {
    try {
      setIsLoading(true);
      const result = await bookingService.getBooking(bookingId);

      if (result.success) {
        setCurrentBooking(result.data);
        return { success: true, data: result.data };
      }

      return { success: false, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement de la réservation',
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ✅ Annule réellement la réservation via PUT /bookings/cancel/{id}.
   */
  const cancelBooking = async (bookingId, reason = '') => {
    try {
      setIsLoading(true);
      const result = await bookingService.cancelBooking(bookingId, reason);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const isOwnerClient = user && bookings.find((b) => b.id === bookingId)?.client_id === user.id;
      const nextStatus = isOwnerClient ? 'cancelled_by_client' : 'cancelled_by_therapist';

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: nextStatus } : b))
      );

      setCurrentBooking((prev) =>
        prev && prev.id === bookingId ? { ...prev, status: nextStatus } : prev
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Erreur lors de l'annulation de la réservation",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    bookings,
    currentBooking,
    isLoading,
    offers,
    loadBookings,
    createBooking,
    getBookingDetails,
    cancelBooking,
    setCurrentBooking,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

export default BookingContext;