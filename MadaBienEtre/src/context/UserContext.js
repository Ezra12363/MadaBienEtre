// src/context/UserContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedBookings: 0,
    totalSpent: 0,
    rating: 0,
    totalReviews: 0,
  });

  useEffect(() => {
    if (user) {
      setProfile(user);
      loadUserStats();
    }
  }, [user]);

  const loadUserStats = async () => {
    // Simuler le chargement des statistiques
    setStats({
      totalBookings: 5,
      completedBookings: 3,
      totalSpent: 150000,
      rating: 4.8,
      totalReviews: 4,
    });
  };

  const updateProfile = async (data) => {
    try {
      setIsLoading(true);
      // Simuler la mise à jour
      setProfile({ ...profile, ...data });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    profile,
    isLoading,
    stats,
    updateProfile,
    loadUserStats,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;