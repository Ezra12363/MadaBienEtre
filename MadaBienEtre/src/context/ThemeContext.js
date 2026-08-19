// src/context/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const ThemeContext = createContext();

// Couleurs pour le mode sombre
const darkColors = {
  ...colors,
  background: '#121212',
  surface: '#1E1E1E',
  surfaceLight: '#2C2C2C',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textLight: '#FFFFFF',
  border: '#333333',
  shadow: 'rgba(0,0,0,0.3)',
  card: '#2C2C2C',
  input: '#2C2C2C',
};

// Couleurs pour le mode clair
const lightColors = {
  ...colors,
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceLight: '#FAFAFA',
  text: '#1A1A1A',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  border: '#E0E0E0',
  shadow: 'rgba(0,0,0,0.1)',
  card: '#FFFFFF',
  input: '#F5F5F5',
};

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeMode] = useState('system');

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    if (themeMode === 'system') {
      setIsDark(systemScheme === 'dark');
    }
  }, [systemScheme, themeMode]);

  const loadThemePreference = async () => {
    try {
      const stored = await AsyncStorage.getItem('@mada_theme');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        setThemeMode(parsed.mode || 'system');
        setIsDark(parsed.isDark || false);
      } else {
        setIsDark(systemScheme === 'dark');
      }
    } catch (error) {
      console.error('Theme load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (mode, isDarkValue) => {
    try {
      await AsyncStorage.setItem(
        '@mada_theme',
        JSON.stringify({ mode, isDark: isDarkValue })
      );
    } catch (error) {
      console.error('Theme save error:', error);
    }
  };

  const toggleTheme = async () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    setThemeMode(newIsDark ? 'dark' : 'light');
    await saveThemePreference(newIsDark ? 'dark' : 'light', newIsDark);
  };

  const setTheme = async (mode) => {
    setThemeMode(mode);
    if (mode === 'system') {
      const newIsDark = systemScheme === 'dark';
      setIsDark(newIsDark);
      await saveThemePreference('system', newIsDark);
    } else if (mode === 'dark') {
      setIsDark(true);
      await saveThemePreference('dark', true);
    } else {
      setIsDark(false);
      await saveThemePreference('light', false);
    }
  };

  const getColors = () => {
    return isDark ? darkColors : lightColors;
  };

  const themeColors = getColors();

  const value = {
    isDark,
    isLoading,
    themeMode,
    colors: themeColors,
    toggleTheme,
    setTheme,
    getColors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;