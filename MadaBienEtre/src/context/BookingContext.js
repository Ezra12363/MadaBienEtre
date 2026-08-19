// src/context/BookingContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const BookingContext = createContext();

export const BookingProvider = ({ children }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  const loadBookings = async () => {
    // Simuler le chargement des réservations
    setBookings([
      { id: 1, massage_type: 'Massage Relaxant', status: 'confirmed', date: '2026-07-15', price: 35000 },
      { id: 2, massage_type: 'Massage Thérapeutique', status: 'completed', date: '2026-07-10', price: 45000 },
      { id: 3, massage_type: 'Massage Sportif', status: 'pending', date: '2026-07-20', price: 40000 },
    ]);
  };

  const createBooking = async (bookingData) => {
    try {
      setIsLoading(true);
      const newBooking = { id: Date.now(), ...bookingData, status: 'pending' };
      setBookings([newBooking, ...bookings]);
      setCurrentBooking(newBooking);
      return { success: true, data: newBooking };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const getBookingDetails = async (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    setCurrentBooking(booking);
    return { success: true, data: booking };
  };

  const cancelBooking = async (bookingId) => {
    setBookings(prev =>
      prev.map(b =>
        b.id === bookingId ? { ...b, status: 'cancelled' } : b
      )
    );
    return { success: true };
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