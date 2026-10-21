// src/screens/admin/NotificationScreen.js
//
// Page NOTIFICATIONS dédiée à l'espace Administrateur.
//
// IMPORTANT : cet écran est enregistré sous le nom de route
// "AdminNotifications" (voir AdminNavigator.js), un nom UNIQUE
// pour éviter tout conflit avec "Notifications" (client) et
// "TherapistNotifications" (thérapeute).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

import Header from '../../components/common/Header';
import ChatConfirmHost from '../../components/chat/ChatConfirmHost';
import notificationService from '../../services/notificationService';
import { confirmAsync } from '../../utils/chatImage';
import { notifyInfo } from '../../utils/chatUi';

import { colors, typography, spacing } from '../../theme';

// ✅ Durée écoulée RÉELLE (heure de Madagascar / UTC+3) :
// À l'instant → 12 sec → 2 min → 1 h 25 → 3 j → 2 sem → 2 mois → 1 an
import { formatTimeAgo, useNow } from '../../utils/timeAgo';

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
  const t = String(type || '').toLowerCase();

  if (t.includes('sos') || t.includes('alert') || t.includes('emergency')) {
    return { icon: 'alert-circle-outline', color: DANGER };
  }
  if (t.includes('therapist') || t.includes('approval')) {
    return { icon: 'checkmark-done-outline', color: INFO };
  }
  if (t.includes('payment') || t.includes('refund')) {
    return { icon: 'cash-outline', color: '#2196F3' };
  }
  if (t.includes('review')) {
    return { icon: 'star-outline', color: '#9B59B6' };
  }
  if (t.includes('user')) {
    return { icon: 'person-add-outline', color: PRIMARY };
  }
  if (t.includes('system')) {
    return { icon: 'settings-outline', color: WARNING };
  }
  return { icon: 'notifications-outline', color: PRIMARY };
};

// Catégorie « désactivable » (clé <cat>_enabled du backend) d'un type de notification.
// null = pas d'interrupteur dédié (utiliser l'interrupteur général).
const getCategory = (type) => {
  const t = String(type || '').toLowerCase();

  if (t.includes('sos') || t.includes('emergency')) return 'sos';
  if (t.includes('payment') || t.includes('refund')) return 'payment';
  if (t.includes('review')) return 'review';
  if (t.includes('offer') || t.includes('negotiation')) return 'offer';
  if (t.includes('booking') || t.includes('reservation')) return 'booking';
  if (t.includes('chat') || t.includes('message')) return 'chat';
  return null;
};

const CATEGORY_LABELS = {
  sos: 'SOS',
  payment: 'Paiements',
  review: 'Avis',
  offer: 'Négociations',
  booking: 'Réservations',
  chat: 'Messages',
};

// Écran admin à ouvrir selon le type de notification (routes de AdminNavigator)
const getTargetScreen = (type) => {
  const t = String(type || '').toLowerCase();

  if (t.includes('sos') || t.includes('alert') || t.includes('emergency')) return 'SOSAlerts';
  if (t.includes('therapist') || t.includes('approval')) return 'Approvals';
  if (t.includes('payment') || t.includes('refund')) return 'Payments';
  if (t.includes('review')) return 'Reviews';
  if (t.includes('user')) return 'Users';
  return null;
};

// Le backend renvoie `created_at` (snake_case, UTC sans "Z").
const getNotificationDate = (item) =>
  item?.created_at ?? item?.createdAt ?? item?.date ?? null;

const isNotificationRead = (item) =>
  Boolean(item?.is_read ?? item?.read ?? item?.isRead);

/* ============================================================
   SCREEN
============================================================ */

// Rafraîchissement automatique tant que l'écran est affiché
const AUTO_REFRESH_MS = 15000;

const NotificationScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();

  // Heure actuelle réelle, rafraîchie chaque seconde : les
  // durées (12 sec, 2 min…) avancent en direct.
  const now = useNow(1000);

  // Le contexte global ne fournit QUE le compteur (unreadCount) et
  // des actions ; la liste est chargée directement depuis l'API.
  const { markAsRead, markAllAsRead, loadUnreadCount } = useNotifications() || {};

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [error, setError] = useState(null);
  // Interrupteur général (push_enabled) : false = notifications désactivées
  const [enabled, setEnabled] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);

    try {
      const result = await notificationService.getNotifications({ limit: 100 });
      if (!mountedRef.current) return;

      if (result?.success) {
        const list = [...(result.notifications || [])].sort((a, b) => {
          const da = new Date(getNotificationDate(b) || 0).getTime();
          const db = new Date(getNotificationDate(a) || 0).getTime();
          return da - db;
        });
        setNotifications(list);
        setError(null);
      } else if (!silent) {
        setError(result?.error || 'Impossible de charger les notifications.');
      }
    } catch (e) {
      if (mountedRef.current && !silent) {
        setError(e?.message || 'Impossible de charger les notifications.');
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const res = await notificationService.getPreferences();
      if (mountedRef.current && res?.success && res.data) {
        setEnabled(res.data.push_enabled !== false);
      }
    } catch (e) {
      // préférences illisibles : on garde « activé »
    }
  }, []);

  // Chargement à chaque affichage de l'écran + rafraîchissement automatique
  useFocusEffect(
    useCallback(() => {
      loadPreferences();
      loadNotifications();
      const timer = setInterval(() => loadNotifications({ silent: true }), AUTO_REFRESH_MS);
      return () => clearInterval(timer);
    }, [loadNotifications, loadPreferences])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadNotifications({ silent: true });
      if (typeof loadUnreadCount === 'function') loadUnreadCount();
    } finally {
      setRefreshing(false);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !isNotificationRead(n)).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !isNotificationRead(n)) : notifications),
    [notifications, filter]
  );

  const setReadLocally = (id) =>
    setNotifications((prev) =>
      prev.map((n) => (String(n.id) === String(id) ? { ...n, is_read: true, read: true } : n))
    );

  const handleMarkAllAsRead = async () => {
    // Mise à jour immédiate de l'écran, puis synchronisation serveur
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
    try {
      if (typeof markAllAsRead === 'function') {
        await markAllAsRead();
      } else {
        await notificationService.markAllAsRead();
        if (typeof loadUnreadCount === 'function') loadUnreadCount();
      }
    } catch (e) {
      console.warn('Tout marquer comme lu a échoué :', e?.message || e);
      loadNotifications({ silent: true });
    }
  };

  const handlePressItem = async (item) => {
    if (!isNotificationRead(item)) {
      setReadLocally(item.id);
      try {
        if (typeof markAsRead === 'function') {
          await markAsRead(item.id);
        } else {
          await notificationService.markAsRead(item.id);
          if (typeof loadUnreadCount === 'function') loadUnreadCount();
        }
      } catch (e) {
        console.warn('Marquer comme lue a échoué :', e?.message || e);
      }
    }

    // Destination fournie par le backend, sinon déduite du type
    const target = item?.targetScreen || getTargetScreen(item?.type);
    if (target) {
      try {
        let params = item?.targetParams;
        if (target === 'Payments' && !params) {
          // Ouvre directement l'onglet concerné de la page Paiements
          // (paiement client / demande de retrait / paiement de commission).
          let d = item?.data;
          if (typeof d === 'string') {
            try {
              d = JSON.parse(d);
            } catch (e) {
              d = {};
            }
          }
          d = d || {};
          params = {
            tab: d.commission_payment_id ? 'commissions' : d.withdrawal_id ? 'withdrawals' : 'payments',
            ts: Date.now(),
          };
        }
        navigation.navigate(target, params);
      } catch (e) {
        console.warn('Navigation impossible :', e?.message || e);
      }
    }
  };

  /* ==========================================================
     SUPPRIMER / DÉSACTIVER
  ========================================================== */

  const refreshBadge = () => {
    if (typeof loadUnreadCount === 'function') loadUnreadCount();
  };

  const handleDelete = async (item) => {
    const ok = await confirmAsync(
      'Supprimer cette notification ?',
      'Elle sera définitivement retirée de votre liste.',
      'Supprimer',
      { tone: 'danger', cancelLabel: 'Annuler', icon: 'trash-outline' }
    );
    if (!ok) return;

    setBusyId(item.id);
    const snapshot = notifications;
    // Retrait immédiat de l'écran
    setNotifications((prev) => prev.filter((n) => String(n.id) !== String(item.id)));

    try {
      const res = await notificationService.deleteNotification(item.id);
      if (!res?.success) throw new Error(res?.error || 'Suppression impossible');
      refreshBadge();
    } catch (e) {
      setNotifications(snapshot); // on remet la notification si le serveur refuse
      notifyInfo('Suppression impossible', e?.message || 'Réessayez dans un instant.');
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;

    const ok = await confirmAsync(
      'Supprimer toutes les notifications ?',
      `${notifications.length} notification${notifications.length > 1 ? 's' : ''} seront définitivement supprimée${notifications.length > 1 ? 's' : ''}.`,
      'Tout supprimer',
      { tone: 'danger', cancelLabel: 'Annuler', icon: 'trash-outline' }
    );
    if (!ok) return;

    const snapshot = notifications;
    setNotifications([]);

    try {
      const res = await notificationService.deleteAllNotifications();
      if (!res?.success) throw new Error(res?.error || 'Suppression impossible');
      refreshBadge();
    } catch (e) {
      setNotifications(snapshot);
      notifyInfo('Suppression impossible', e?.message || 'Réessayez dans un instant.');
    }
  };

  // Désactive un TYPE de notification (ex. « Paiements »)
  const handleDisableCategory = async (item) => {
    const category = getCategory(item?.type);
    if (!category) return;
    const label = CATEGORY_LABELS[category];

    const ok = await confirmAsync(
      `Désactiver « ${label} » ?`,
      `Vous ne recevrez plus de notifications « ${label} ». Vous pourrez les réactiver depuis le bouton cloche en haut de la liste.`,
      'Désactiver',
      { tone: 'warning', cancelLabel: 'Annuler', icon: 'notifications-off-outline' }
    );
    if (!ok) return;

    const res = await notificationService.updatePreferences({ [`${category}_enabled`]: false });
    if (res?.success) {
      notifyInfo('Notifications désactivées', `Plus de notifications « ${label} ».`);
    } else {
      notifyInfo('Action impossible', res?.error || 'Réessayez dans un instant.');
    }
  };

  // Interrupteur général : désactiver / réactiver TOUTES les notifications
  const handleToggleEnabled = async () => {
    const next = !enabled;

    if (!next) {
      const ok = await confirmAsync(
        'Désactiver les notifications ?',
        'Vous ne recevrez plus de nouvelles notifications (sauf alertes SOS urgentes).',
        'Désactiver',
        { tone: 'warning', cancelLabel: 'Annuler', icon: 'notifications-off-outline' }
      );
      if (!ok) return;
    }

    setEnabled(next);
    const res = await notificationService.updatePreferences({ push_enabled: next });
    if (!res?.success) {
      setEnabled(!next);
      notifyInfo('Action impossible', res?.error || 'Réessayez dans un instant.');
    }
  };

  /* ==========================================================
     RENDER : UNE NOTIFICATION
  ========================================================== */

  const renderItem = ({ item }) => {
    const visual = getNotificationVisual(item.type);
    const isUnread = !isNotificationRead(item);

    // ⚠️ Web : un bouton ne peut pas contenir d'autres boutons. La carte est une
    // View ; la zone cliquable et les boutons d'action sont FRÈRES.
    return (
      <View
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
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handlePressItem(item)}
          style={styles.itemMain}
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

            {item.message || item.body ? (
              <Text
                numberOfLines={3}
                style={[
                  styles.itemMessage,
                  { color: themeColors.textSecondary || '#718078' },
                ]}
              >
                {item.message || item.body}
              </Text>
            ) : null}

            <Text
              style={[
                styles.itemTime,
                { color: themeColors.textSecondary || '#9AA5A0' },
              ]}
            >
              {formatTimeAgo(getNotificationDate(item), now)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.itemActions}>
          {getCategory(item.type) ? (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => handleDisableCategory(item)}
              accessibilityRole="button"
              accessibilityLabel="Désactiver ce type de notification"
              style={styles.iconBtn}
            >
              <Ionicons
                name="notifications-off-outline"
                size={18}
                color={themeColors.textSecondary || '#9AA5A0'}
              />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => handleDelete(item)}
            disabled={String(busyId) === String(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Supprimer la notification"
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={18} color={DANGER} />
          </TouchableOpacity>
        </View>
      </View>
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
            name={error ? 'cloud-offline-outline' : 'notifications-off-outline'}
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
          {error
            ? error
            : filter === 'unread'
            ? 'Aucune notification non lue'
            : 'Aucune notification pour le moment'}
        </Text>

        {error ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => loadNotifications()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  /* ==========================================================
     BARRE : FILTRES (gauche) + ACTIONS (droite)
     Les boutons ne sont plus dans le header => plus jamais coupés.
  ========================================================== */

  const renderToolbar = () => (
    <View style={styles.toolbar}>
      <View style={styles.filters}>
        {[
          { key: 'all', label: `Toutes (${notifications.length})` },
          { key: 'unread', label: `Non lues (${unreadCount})` },
        ].map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              activeOpacity={0.85}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? PRIMARY : themeColors.surface,
                  borderColor: active ? PRIMARY : themeColors.border || '#E7E9EF',
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.chipText, { color: active ? '#FFFFFF' : themeColors.text }]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.toolbarActions}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleToggleEnabled}
          style={[
            styles.actionButton,
            !enabled && { backgroundColor: `${WARNING}22`, borderColor: `${WARNING}66` },
          ]}
          accessibilityRole="button"
          accessibilityLabel={enabled ? 'Désactiver les notifications' : 'Activer les notifications'}
        >
          <Ionicons
            name={enabled ? 'notifications-outline' : 'notifications-off-outline'}
            size={18}
            color={enabled ? PRIMARY : WARNING}
          />
        </TouchableOpacity>

        {unreadCount > 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleMarkAllAsRead}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Tout marquer comme lu"
          >
            <Ionicons name="checkmark-done-outline" size={18} color={PRIMARY} />
          </TouchableOpacity>
        ) : null}

        {notifications.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDeleteAll}
            style={[
              styles.actionButton,
              { backgroundColor: `${DANGER}12`, borderColor: `${DANGER}44` },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Tout supprimer"
          >
            <Ionicons name="trash-outline" size={18} color={DANGER} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

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
      />

      {!enabled && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleToggleEnabled}
          style={styles.disabledBanner}
        >
          <Ionicons name="notifications-off-outline" size={16} color="#FFFFFF" />
          <Text style={styles.disabledBannerText}>
            Notifications désactivées — toucher pour réactiver
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        style={styles.list}
        data={visibleNotifications}
        // `now` force le rafraîchissement des durées
        extraData={now}
        keyExtractor={(item, index) => String(item?.id ?? index)}
        renderItem={renderItem}
        ListHeaderComponent={renderToolbar}
        contentContainerStyle={
          visibleNotifications.length === 0
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

      {/* Fenêtre de confirmation (web + Android + iOS) */}
      <ChatConfirmHost />
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

  list: {
    flex: 1,
  },

  /* ---------- Barre filtres + actions ---------- */

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },

  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },

  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,138,85,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(22,138,85,0.28)',
  },

  /* ---------- Bannière « désactivées » (dans le flux) ---------- */

  disabledBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WARNING,
  },

  disabledBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ---------- Liste ---------- */

  // ✅ Espace réduit entre le header et la liste (avant : 90 / 100)
  listContent: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 24,
  },

  listContentEmpty: {
    flexGrow: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
  },

  /* ---------- Carte notification ---------- */

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },

  itemMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  itemActions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingLeft: 6,
  },

  iconBtn: {
    padding: 4,
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

  /* ---------- Vide / erreur ---------- */

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

  retryButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});

export default NotificationScreen;