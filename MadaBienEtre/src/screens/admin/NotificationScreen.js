// src/screens/admin/NotificationScreen.js
//
// Page NOTIFICATIONS dédiée à l'espace Administrateur.
//
// IMPORTANT : cet écran est enregistré sous le nom de route
// "AdminNotifications" (voir AdminNavigator.js), un nom UNIQUE
// pour éviter tout conflit avec "Notifications" (client) et
// "TherapistNotifications" (thérapeute).

import { useCallback, useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

import Header from '../../components/common/Header';

import { colors, typography, spacing } from '../../theme';

/* ============================================================
   COULEURS
============================================================ */

const PRIMARY = colors.primary || '#168A55';
const DANGER = colors.error || '#D9363E';
const WARNING = '#E89B22';
const INFO = '#2584D8';

/* ============================================================
   HELPERS
============================================================ */

// Associe un type de notification à une icône + une couleur.
// Le type exact dépend du backend ; on retombe sur une icône
// générique si le type est inconnu ou absent.
const getNotificationVisual = (type) => {
  switch (String(type || '').toLowerCase()) {
    case 'user':
    case 'new_user':
      return { icon: 'person-add-outline', color: PRIMARY };

    case 'therapist':
    case 'therapist_application':
    case 'approval':
      return { icon: 'checkmark-done-outline', color: INFO };

    case 'payment':
      return { icon: 'cash-outline', color: '#2196F3' };

    case 'review':
      return { icon: 'star-outline', color: '#9B59B6' };

    case 'sos':
    case 'alert':
      return { icon: 'alert-circle-outline', color: DANGER };

    case 'system':
      return { icon: 'settings-outline', color: WARNING };

    default:
      return { icon: 'notifications-outline', color: PRIMARY };
  }
};

// Formatage relatif simple ("il y a 5 min", "Hier", ...) sans
// dépendance externe (date-fns / moment).
const formatRelativeTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) {
    return "À l'instant";
  }

  if (diffMin < 60) {
    return `Il y a ${diffMin} min`;
  }

  const diffHours = Math.floor(diffMin / 60);

  if (diffHours < 24) {
    return `Il y a ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 1) {
    return 'Hier';
  }

  if (diffDays < 7) {
    return `Il y a ${diffDays} j`;
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });
};

/* ============================================================
   SCREEN
============================================================ */

const NotificationScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();

  // On protège chaque champ/fonction du contexte au cas où sa
  // forme exacte diffère selon les rôles (le contexte est partagé
  // par toute l'application, pas propre à l'admin).
  const notificationsCtx = useNotifications() || {};

  const {
    notifications = [],
    unreadCount = 0,
    loading = false,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    fetchNotifications,
  } = notificationsCtx;

  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const fn = refreshNotifications || fetchNotifications;

    if (typeof fn === 'function') {
      try {
        await fn();
      } catch (error) {
        console.error('Erreur de rafraîchissement des notifications :', error);
      }
    }
  }, [refreshNotifications, fetchNotifications]);

  useEffect(() => {
    refresh();
    // On ne veut rafraîchir qu'au montage de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAllAsRead = () => {
    if (typeof markAllAsRead === 'function') {
      markAllAsRead();
    }
  };

  const handlePressItem = (item) => {
    if (!item?.read && typeof markAsRead === 'function') {
      markAsRead(item.id);
    }

    // Si le backend fournit une destination (écran + params), on
    // laisse la notification y amener l'admin directement.
    if (item?.targetScreen) {
      navigation.navigate(item.targetScreen, item.targetParams);
    }
  };

  /* ==========================================================
     RENDER : UNE NOTIFICATION
  ========================================================== */

  const renderItem = ({ item }) => {
    const visual = getNotificationVisual(item.type);
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handlePressItem(item)}
        style={[
          styles.item,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border || '#E7E9EF',
          },
          isUnread && {
            borderColor: `${PRIMARY}55`,
            backgroundColor: isDark
              ? 'rgba(22,138,85,0.08)'
              : 'rgba(22,138,85,0.05)',
          },
        ]}
      >
        <View
          style={[
            styles.itemIcon,
            { backgroundColor: `${visual.color}18` },
          ]}
        >
          <Ionicons name={visual.icon} size={20} color={visual.color} />
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.itemTitle,
                { color: themeColors.text },
                isUnread && styles.itemTitleUnread,
              ]}
            >
              {item.title || 'Notification'}
            </Text>

            {isUnread && <View style={styles.unreadDot} />}
          </View>

          {item.message ? (
            <Text
              numberOfLines={2}
              style={[
                styles.itemMessage,
                { color: themeColors.textSecondary || '#718078' },
              ]}
            >
              {item.message}
            </Text>
          ) : null}

          <Text
            style={[
              styles.itemTime,
              { color: themeColors.textSecondary || '#9AA5A0' },
            ]}
          >
            {formatRelativeTime(item.createdAt || item.date)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  /* ==========================================================
     EMPTY / LOADING
  ========================================================== */

  const renderEmpty = () => {
    if (loading && notifications.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={PRIMARY} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name="notifications-off-outline"
            size={30}
            color={themeColors.textSecondary || '#9AA5A0'}
          />
        </View>

        <Text
          style={[
            styles.emptyText,
            { color: themeColors.textSecondary || '#718078' },
          ]}
        >
          Aucune notification pour le moment
        </Text>
      </View>
    );
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.background },
      ]}
    >
      <Header
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
            : 'Tout est à jour'
        }
        showBack
        onBackPress={() => navigation.goBack()}
        rightComponent={
          unreadCount > 0 ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleMarkAllAsRead}
              style={styles.markAllButton}
              accessibilityRole="button"
              accessibilityLabel="Tout marquer comme lu"
            >
              <Ionicons
                name="checkmark-done-outline"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          ) : null
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item, index) =>
          String(item?.id ?? index)
        }
        renderItem={renderItem}
        contentContainerStyle={
          notifications.length === 0
            ? styles.listContentEmpty
            : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingTop: Platform.OS === 'web' ? 90 : 100,
    paddingHorizontal: 14,
    paddingBottom: 24,
  },

  listContentEmpty: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'web' ? 90 : 100,
  },

  markAllButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },

  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  itemContent: {
    flex: 1,
    minWidth: 0,
  },

  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemTitle: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: typography.fontFamily.semiBold || typography.fontFamily.bold,
  },

  itemTitleUnread: {
    fontFamily: typography.fontFamily.bold,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    marginLeft: 8,
  },

  itemMessage: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontFamily: typography.fontFamily.regular,
  },

  itemTime: {
    fontSize: 10.5,
    marginTop: 6,
    fontFamily: typography.fontFamily.regular,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: spacing.sm || 10,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(22,138,85,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  emptyText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
  },
});

export default NotificationScreen;