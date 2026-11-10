// src/utils/notificationNavigation.js
// ============================================================
// Navigation depuis une notification (liste in-app, Web, Android).
//
//  - ADMIN  : nouvelle inscription / compte à valider
//               thérapeute -> ApprovalDetailScreen  { therapistId }
//               client     -> UserDetailScreen      { userId }
//  - THÉRAPEUTE : compte approuvé / refusé / activé -> page de profil
//
// L'identifiant du compte est lu dans `data` (target_params, therapist_id,
// user_id) : il n'est jamais perdu, même pour une ancienne notification.
// ============================================================
import { Platform } from 'react-native';
import { navigateToAdminDetail } from '../components/admin/AdminDetailKit';

export const getNotificationData = (notification) => {
  let data = notification?.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (_e) {
      data = {};
    }
  }
  return data && typeof data === 'object' ? data : {};
};

const typeOf = (notification) =>
  String(notification?.type || notification?.notification_type || getNotificationData(notification).type || '')
    .toLowerCase()
    .trim();

const pickId = (...values) => {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};

/** Destination ADMIN d'une notification (ou null si ce n'est pas une notification de compte). */
export const resolveAdminAccountTarget = (notification) => {
  const type = typeOf(notification);
  const data = getNotificationData(notification);
  const params = data.target_params || {};
  const screen = data.target_screen;

  const isTherapistFile =
    screen === 'ApprovalDetail' ||
    type.includes('therapist_application') ||
    type.includes('therapist_pending') ||
    type.includes('approval');

  if (isTherapistFile) {
    const therapistId = pickId(params.therapistId, data.therapist_id, data.user_id, params.userId);
    if (therapistId !== null) {
      return { route: 'ApprovalDetail', params: { therapistId, fromNotification: true } };
    }
  }

  const isUserFile = screen === 'UserDetail' || type === 'new_user' || type === 'new_client';
  if (isUserFile) {
    const userId = pickId(params.userId, data.user_id);
    if (userId !== null) {
      return { route: 'UserDetail', params: { userId, fromNotification: true } };
    }
  }

  return null;
};

/** Ouvre la bonne page admin. Retourne true si la notification a été gérée. */
export const openAdminAccountNotification = (navigation, notification) => {
  const target = resolveAdminAccountTarget(notification);
  if (!target) return false;
  return navigateToAdminDetail(navigation, target.route, target.params);
};

/** Décision de l'admin sur le compte du thérapeute (approuvé / refusé / activé). */
export const isAccountDecisionNotification = (notification) => {
  const type = typeOf(notification);
  return (
    type.includes('therapist_approved') ||
    type.includes('therapist_rejected') ||
    type === 'account_activated'
  );
};

/** Ouvre la page de profil du thérapeute (onglet « Profil »). */
export const openTherapistProfile = (navigation) => {
  try {
    navigation.navigate('Profil', { screen: 'ProfileScreen' });
    return true;
  } catch (_e) {
    try {
      navigation.navigate('Profil');
      return true;
    } catch (e2) {
      console.warn('Ouverture du profil impossible :', e2?.message || e2);
      return false;
    }
  }
};

const bookingIdOf = (notification) => {
  const data = getNotificationData(notification);
  return pickId(data.booking_id, data.bookingId, notification?.booking_id);
};

/**
 * Réservation / offre / négociation / en route / rappel calendrier :
 * ouvre l'écran adapté au rôle et au type (clic sur une notification NATIVE).
 * Retourne true si la notification a été gérée.
 */
export const openBookingNotification = (root, role, notification) => {
  const type = typeOf(notification);
  const bookingId = bookingIdOf(notification);
  const data = getNotificationData(notification);
  if (!bookingId || !type) return false;
  // Seulement les notifications de réservation / offre (pas chat, paiement, avis, SOS…)
  if (data.kind === 'chat_message' || !(type.includes('booking') || type.includes('offer'))) return false;

  const isNegotiation = type === 'counter_offer' || type === 'new_offer' || type === 'offer_rejected';
  const go = (name, params) => {
    try {
      root.navigate(name, params);
      return true;
    } catch (e) {
      console.warn('Navigation notification impossible :', e?.message || e);
      return false;
    }
  };

  if (role === 'CLIENT') {
    if (type === 'booking_en_route') return go('Tracking', { bookingId });
    if (isNegotiation) return go('Negotiation', { bookingId, offerId: data.offer_id });
    return go('BookingDetail', { bookingId });
  }

  // THERAPIST
  if (isNegotiation) return go('Negotiation', { bookingId, offerId: data.offer_id });
  return go('Calendrier', { screen: 'BookingDetail', params: { bookingId } });
};

/**
 * Clic sur une notification NATIVE (Android / iOS), app ouverte, en arrière-plan
 * ou lancée à froid. `root` = référence du NavigationContainer.
 * Attend que la navigation soit prête avant de rediriger.
 */
export const handleNativeNotificationTap = (root, role, data, markAsRead) => {
  if (Platform.OS === 'web') return;
  const notification = { type: data?.type, data: data || {} };

  try {
    const nid = data?.notification_id;
    if (nid && typeof markAsRead === 'function') markAsRead(nid);
  } catch (_e) {
    /* ignoré */
  }

  let attempts = 0;
  const run = () => {
    attempts += 1;
    const ready = root?.isReady ? root.isReady() : !!root;
    if (!ready) {
      if (attempts < 30) setTimeout(run, 150);
      return;
    }

    const r = String(role || '').toUpperCase();
    if (r === 'ADMIN') {
      openAdminAccountNotification(root, notification);
    } else if (r === 'THERAPIST' && isAccountDecisionNotification(notification)) {
      openTherapistProfile(root);
    } else if (r === 'THERAPIST' || r === 'CLIENT') {
      openBookingNotification(root, r, notification);
    }
  };
  run();
};
