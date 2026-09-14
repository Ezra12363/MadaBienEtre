// src/components/client/ClientOnlineStatusCard.js

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import clientStatusService from '../../services/clientStatusService';

/**
 * Carte "Mon statut" — permet au client d'indiquer s'il apparaît
 * comme actif dans l'application. Conçue pour être injectée aussi
 * bien dans HomeScreen que dans ProfileScreen, avec un rendu qui
 * suit la charte visuelle de l'app (cartes arrondies, ombre douce,
 * dégradé de succès sur l'état "en ligne").
 *
 * Props:
 * - variant: 'default' | 'compact' — 'compact' réduit les paddings
 *   pour s'intégrer dans une section déjà encartée (ex: profil).
 * - onStatusChange: callback(isOnline: boolean) optionnel, appelé
 *   après un changement de statut réussi.
 */
export default function ClientOnlineStatusCard({
  variant = 'default',
  onStatusChange,
}) {
  const { colors: themeColors, isDark } = useTheme();

  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;

  const primary = themeColors?.primary || '#16803C';
  const text = themeColors?.text || '#17202A';
  const secondary = themeColors?.textSecondary || '#6B7280';
  const surface =
    themeColors?.surface || themeColors?.card || '#FFFFFF';
  const border = themeColors?.border || '#E5E7EB';

  const onlineBg = isDark ? 'rgba(34,197,94,0.16)' : '#DCFCE7';
  const offlineBg = isDark ? 'rgba(148,163,184,0.14)' : '#F3F4F6';
  const onlineText = isDark ? '#4ADE80' : '#15803D';
  const compact = variant === 'compact';

  /* ==========================================================
     CHARGEMENT DU STATUT
  ========================================================== */

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);

      const result = await clientStatusService.getOnlineStatus();

      setIsOnline(Boolean(result?.is_online));
    } catch (error) {
      console.log(
        'Erreur récupération statut client:',
        error?.response?.data || error?.message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /* ==========================================================
     ANIMATION DU POINT "EN LIGNE"
  ========================================================== */

  useEffect(() => {
    if (!isOnline) {
      pulse.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.5,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [isOnline, pulse]);

  /* ==========================================================
     CHANGEMENT DE STATUT
  ========================================================== */

  const handleChange = async (value) => {
    const previousValue = isOnline;

    setIsOnline(value);
    setSaving(true);

    try {
      const result = await clientStatusService.updateOnlineStatus(
        value
      );

      const nextValue = Boolean(result?.is_online ?? value);

      setIsOnline(nextValue);
      onStatusChange?.(nextValue);
    } catch (error) {
      setIsOnline(previousValue);

      Alert.alert(
        'Erreur',
        error?.response?.data?.detail ||
          'Impossible de modifier votre statut pour le moment.'
      );

      console.log(
        'Erreur modification statut client:',
        error?.response?.data || error?.message
      );
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <View
        style={[
          styles.card,
          compact && styles.cardCompact,
          {
            backgroundColor: surface,
            borderColor: border,
            minHeight: compact ? 64 : 92,
          },
        ]}
      >
        <ActivityIndicator size="small" color={primary} />
      </View>
    );
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        {
          backgroundColor: surface,
          borderColor: isOnline ? `${primary}30` : border,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          compact && styles.iconContainerCompact,
          { backgroundColor: isOnline ? onlineBg : offlineBg },
        ]}
      >
        <Ionicons
          name={isOnline ? 'radio' : 'radio-outline'}
          size={compact ? 19 : 22}
          color={isOnline ? '#16A34A' : '#6B7280'}
        />
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: text, fontSize: compact ? 13.5 : 15 },
          ]}
        >
          Mon statut
        </Text>

        <View style={styles.statusLine}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: isOnline ? '#16A34A' : '#9CA3AF',
                transform: [{ scale: pulse }],
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              { color: isOnline ? onlineText : secondary },
            ]}
          >
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </Text>
        </View>

        {!compact && (
          <Text style={[styles.description, { color: secondary }]}>
            {isOnline
              ? 'Vous apparaissez comme actif dans l’application.'
              : 'Vous n’apparaissez pas comme actif pour le moment.'}
          </Text>
        )}
      </View>

      <View style={styles.switchContainer}>
        {saving ? (
          <ActivityIndicator size="small" color={primary} />
        ) : (
          <Switch
            value={isOnline}
            onValueChange={handleChange}
            trackColor={{
              false: '#D1D5DB',
              true: '#86EFAC',
            }}
            thumbColor={isOnline ? '#16A34A' : '#F9FAFB'}
            ios_backgroundColor="#D1D5DB"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  cardCompact: {
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowOpacity: 0,
    elevation: 0,
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  iconContainerCompact: {
    width: 36,
    height: 36,
    borderRadius: 11,
    marginRight: 10,
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    fontWeight: '700',
    marginBottom: 5,
  },

  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    marginRight: 6,
  },

  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },

  description: {
    fontSize: 11,
    lineHeight: 16,
  },

  switchContainer: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});