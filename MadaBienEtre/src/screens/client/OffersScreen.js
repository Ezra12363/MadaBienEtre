// src/screens/client/OffersScreen.js
//
// ✅ V2 — alignée sur le vrai contrat du backend (app/api/offers.py) :
//
//  - Le statut "actif" d'une offre est "sent", jamais "pending".
//    (v1 vérifiait "pending" → les boutons Accepter/Contre-proposer/
//    Refuser n'apparaissaient donc jamais, silencieusement.)
//  - Le nom de l'autre partie est un champ plat "user_name" (string),
//    pas un objet imbriqué "user.fullname" (qui n'existe pas côté
//    API) → corrigé dans offerService.normalizeOffer.
//  - Chaque offre expire 15 minutes après sa création
//    (Negotiation.expires_at côté backend) → affichage d'un compte
//    à rebours, comme sur l'écran équivalent du thérapeute.
//  - Le modèle Negotiation n'a pas de lien explicite entre une
//    contre-offre du client et le thérapeute visé : on ne tente donc
//    plus de "regrouper par thérapeute" (ça produisait de faux fils
//    de négociation). On affiche : (1) les offres actives à traiter
//    maintenant, (2) l'historique chronologique complet en dessous.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import offerService from '../../services/offerService';
import bookingService from '../../services/bookingService';
import therapistService from '../../services/therapistService';

// ============================================================
// HELPERS
// ============================================================

// ✅ Thème harmonisé avec HomeScreen.js (même vert PRIMARY, même
// orange que les cartes de promotions de l'accueil).
const PRIMARY = colors.primary || '#168A55';
const PRIMARY_DARK = '#0B633C';
const GREEN = '#00A86B'; // SUCCESS (HomeScreen) — statut "accepté"
const ORANGE = '#F28A24'; // même orange que les cartes de HomeScreen

const money = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0 Ar';
  return `${number.toLocaleString('fr-FR')} Ar`;
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDisplayName = (offer, fallback = 'Thérapeute') => {
  return offer?.user_name || offer?.user?.fullname || fallback;
};

// ✅ Le backend renvoie "sent" pour une offre active, jamais "pending".
// On garde "pending" en synonyme au cas où une ancienne donnée traîne,
// mais "sent" est la valeur réelle à traiter.
const isActive = (offer) => offer?.status === 'sent' || offer?.status === 'pending';

const statusLabel = (status) => {
  const map = {
    sent: 'En attente',
    pending: 'En attente',
    accepted: 'Acceptée',
    rejected: 'Refusée',
    expired: 'Expirée',
    cancelled: 'Annulée',
  };
  return map[String(status || '').toLowerCase()] || status || 'En attente';
};

const statusColor = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'accepted') return GREEN;
  if (value === 'rejected' || value === 'expired' || value === 'cancelled') return colors.error;
  return colors.primary;
};

// Secondes restantes avant expiration (offre valable 15 min côté backend)
const getRemainingSeconds = (expiresAt) => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 1000));
};

const formatRemaining = (seconds) => {
  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

// ============================================================
// SCREEN
// ============================================================

const OffersScreen = ({ navigation, route }) => {
  const { bookingId } = route?.params || {};
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();

  const [offers, setOffers] = useState([]);
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [, forceTick] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ✅ Profils thérapeutes RÉELS (photo, nom, téléphone) chargés
  // depuis la base via therapistService, indexés par user_id.
  // Les offres ne contiennent qu'un "user_name" à plat — pas de
  // photo — donc on va chercher le vrai profil complet.
  const [therapistProfiles, setTherapistProfiles] = useState({});
  const fetchedTherapistIdsRef = useRef(new Set());

  const loadData = useCallback(async () => {
    if (!bookingId) {
      setError('Réservation introuvable.');
      setIsLoading(false);
      return;
    }

    try {
      const [offersResult, bookingResult] = await Promise.all([
        offerService.getOffersByBooking(bookingId),
        bookingService.getBooking(bookingId),
      ]);

      if (!offersResult.success) {
        setError(offersResult.error);
        setOffers([]);
      } else {
        setError(null);
        // Plus récent en premier
        const sorted = [...offersResult.data].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        setOffers(sorted);
      }

      if (bookingResult.success) {
        setBooking(bookingResult.data);
      }
    } catch (err) {
      console.error('❌ [OffersScreen] loadData:', err);
      setError('Impossible de charger les offres.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // ✅ Charge le profil thérapeute RÉEL (photo, nom, téléphone)
  // pour chaque offre venant d'un thérapeute, une seule fois
  // par identifiant.
  useEffect(() => {
    const idsToFetch = offers
      .filter((offer) => {
        const mine =
          user?.id && offer?.user_id
            ? String(offer.user_id) === String(user.id)
            : offer?.user_type === 'client';
        return !mine && offer?.user_id;
      })
      .map((offer) => String(offer.user_id))
      .filter(
        (id) => !fetchedTherapistIdsRef.current.has(id)
      );

    const uniqueIds = [...new Set(idsToFetch)];

    if (uniqueIds.length === 0) {
      return;
    }

    uniqueIds.forEach((id) =>
      fetchedTherapistIdsRef.current.add(id)
    );

    (async () => {
      const results = await Promise.all(
        uniqueIds.map((id) => therapistService.getTherapist(id))
      );

      setTherapistProfiles((previous) => {
        const next = { ...previous };
        uniqueIds.forEach((id, index) => {
          const result = results[index];
          if (result?.success && result?.data) {
            next[id] = result.data;
          }
        });
        return next;
      });
    })();
  }, [offers, user]);

  const getTherapistPhoto = (offer) => {
    const profile =
      therapistProfiles[String(offer?.user_id)];

    return (
      profile?.profile_image_url ||
      profile?.profileImageUrl ||
      profile?.avatar_url ||
      profile?.avatarUrl ||
      profile?.photo_url ||
      profile?.photoUrl ||
      profile?.image_url ||
      profile?.imageUrl ||
      profile?.avatar ||
      profile?.photo ||
      ''
    );
  };

  const getTherapistPhone = (offer) => {
    const profile =
      therapistProfiles[String(offer?.user_id)];

    return (
      profile?.phone ||
      profile?.phone_number ||
      profile?.telephone ||
      profile?.mobile ||
      ''
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ✅ Rafraîchit l'affichage du compte à rebours chaque seconde
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const isMine = (offer) => {
    if (user?.id && offer?.user_id) {
      return String(offer.user_id) === String(user.id);
    }
    return offer?.user_type === 'client';
  };

  const handleAccept = (offer) => {
    Alert.alert(
      "Accepter l'offre",
      `Accepter l'offre de ${getDisplayName(offer)} à ${money(offer.price_offered)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            setActioningId(offer.id);
            const result = await offerService.acceptOffer(offer.id);
            setActioningId(null);
            if (!result.success) {
              Alert.alert('Erreur', result.error);
              return;
            }
            Alert.alert('✅ Offre acceptée', 'La réservation est confirmée !');
            await refreshUnreadCount?.();
            navigation.navigate('BookingDetail', { bookingId });
          },
        },
      ]
    );
  };

  const handleReject = (offer) => {
    Alert.alert(
      "Refuser l'offre",
      `Voulez-vous vraiment refuser l'offre de ${getDisplayName(offer)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setActioningId(offer.id);
            const result = await offerService.rejectOffer(offer.id);
            setActioningId(null);
            if (!result.success) {
              Alert.alert('Erreur', result.error);
              return;
            }
            await refreshUnreadCount?.();
            loadData();
          },
        },
      ]
    );
  };

  const handleCounter = (offer) => {
    navigation.navigate('Negotiation', {
      offerId: offer.id,
      bookingId,
      currentPrice: offer.price_offered,
      therapistName: getDisplayName(offer),
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement des offres...
        </Text>
      </View>
    );
  }

  const activeOffers = offers.filter(isActive);
  const historyOffers = offers.filter((o) => !isActive(o));

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={PRIMARY_DARK}
      />

      <Header
        title="Négociations"
        subtitle="Vos offres et contre-propositions"
        showBack
      />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {booking && (
          <Animatable.View animation="fadeInDown" duration={500}>
            <View style={[styles.bookingSummary, { backgroundColor: themeColors.surface }]}>
              <View style={styles.bookingSummaryHeader}>
                <Text style={[styles.bookingSummaryTitle, { color: themeColors.text }]}>
                  Votre demande
                </Text>
                <View style={styles.bookingSummaryPrice}>
                  <Text style={styles.bookingSummaryPriceLabel}>Votre prix proposé</Text>
                  <Text style={styles.bookingSummaryPriceValue}>
                    {money(booking.client_price_proposed)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.bookingSummaryText, { color: themeColors.text }]}>
                {booking.massage_type_name} • {booking.duration_minutes} min
              </Text>
              <Text style={[styles.bookingSummaryText, { color: themeColors.textSecondary }]}>
                📍 {booking.address}
              </Text>
            </View>
          </Animatable.View>
        )}

        {/* -------------------------------------------------- */}
        {/* OFFRES ACTIVES — à traiter maintenant               */}
        {/* -------------------------------------------------- */}
        <View style={styles.offersList}>
          <Text style={[styles.offersTitle, { color: themeColors.text }]}>
            {activeOffers.length > 0
              ? `${activeOffers.length} offre${activeOffers.length > 1 ? 's' : ''} en cours`
              : 'Aucune offre en cours'}
          </Text>

          {activeOffers.map((offer, index) => {
            const mine = isMine(offer);
            const remaining = getRemainingSeconds(offer.expires_at);
            const isExpiringSoon = remaining !== null && remaining < 120;
            const isActioning = actioningId === offer.id;

            return (
              <Animatable.View
                key={offer.id}
                animation="fadeInUp"
                delay={150 * (index + 1)}
                duration={500}
              >
                <View style={[styles.offerCard, { backgroundColor: themeColors.surface }]}>
                  <View style={styles.offerHeader}>
                    <View style={styles.therapistInfo}>
                      <View style={styles.therapistAvatar}>
                        {!mine && getTherapistPhoto(offer) ? (
                          <Image
                            source={{ uri: getTherapistPhoto(offer) }}
                            style={styles.therapistAvatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.therapistAvatarText}>
                            {getDisplayName(offer).charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View>
                        <Text style={[styles.therapistName, { color: themeColors.text }]}>
                          {mine ? 'Votre contre-offre' : getDisplayName(offer)}
                        </Text>

                        {!mine && !!getTherapistPhone(offer) && (
                          <View style={styles.therapistPhoneRow}>
                            <Ionicons name="call-outline" size={11} color={themeColors.textSecondary} />
                            <Text style={[styles.therapistPhoneText, { color: themeColors.textSecondary }]}>
                              {getTherapistPhone(offer)}
                            </Text>
                          </View>
                        )}

                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusColor(offer.status) + '20' },
                          ]}
                        >
                          <Text style={[styles.statusBadgeText, { color: statusColor(offer.status) }]}>
                            {statusLabel(offer.status)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {remaining !== null && (
                      <View
                        style={[
                          styles.timerBadge,
                          isExpiringSoon && styles.timerBadgeUrgent,
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={12}
                          color={isExpiringSoon ? colors.error : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.timerBadgeText,
                            isExpiringSoon && { color: colors.error },
                          ]}
                        >
                          {remaining > 0 ? formatRemaining(remaining) : 'Expirée'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.offerPriceContainer}>
                    <Text style={[styles.offerPrice, { color: colors.primary }]}>
                      {money(offer.price_offered)}
                    </Text>
                    {booking && (
                      <Text style={[styles.offerPriceComparison, { color: themeColors.textSecondary }]}>
                        (votre prix initial : {money(booking.client_price_proposed)})
                      </Text>
                    )}
                  </View>

                  {offer.message ? (
                    <Text style={[styles.offerMessage, { color: themeColors.textSecondary }]}>
                      "{offer.message}"
                    </Text>
                  ) : null}

                  {/* ✅ Indication claire de qui doit agir */}
                  {!mine ? (
                    <View style={styles.turnBanner}>
                      <Ionicons name="hand-left-outline" size={16} color={colors.primary} />
                      <Text style={styles.turnBannerText}>
                        C'est à vous de répondre à cette offre
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.turnBanner, { backgroundColor: '#FFF7E6' }]}>
                      <Ionicons name="time-outline" size={16} color={ORANGE} />
                      <Text style={[styles.turnBannerText, { color: ORANGE }]}>
                        En attente de la réponse du thérapeute
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.offerDate, { color: themeColors.textSecondary }]}>
                    {formatDate(offer.created_at)}
                  </Text>

                  {!mine && (
                    <View style={styles.offerActions}>
                      {isActioning ? (
                        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleAccept(offer)}
                            activeOpacity={0.8}
                          >
                            <LinearGradient
                              colors={[colors.primary, colors.primaryLight]}
                              style={styles.acceptGradient}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                            >
                              <Text style={styles.acceptButtonText}>Accepter</Text>
                            </LinearGradient>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.counterButton}
                            onPress={() => handleCounter(offer)}
                          >
                            <Text style={styles.counterButtonText}>Contre-proposer</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() => handleReject(offer)}
                          >
                            <Ionicons name="close-outline" size={22} color={colors.error} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </Animatable.View>
            );
          })}

          {activeOffers.length === 0 && !error && (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={64} color={themeColors.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>
                Aucune offre pour le moment
              </Text>
              <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                Les thérapeutes à proximité vont bientôt vous répondre
              </Text>
            </View>
          )}
        </View>

        {/* -------------------------------------------------- */}
        {/* HISTORIQUE — tous les échanges passés               */}
        {/* -------------------------------------------------- */}
        {historyOffers.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: themeColors.text }]}>
              Historique des échanges
            </Text>
            {historyOffers.map((h) => (
              <View
                key={h.id}
                style={[styles.historyRow, { backgroundColor: themeColors.surface }]}
              >
                <View
                  style={[
                    styles.historyDot,
                    { backgroundColor: isMine(h) ? colors.secondary : colors.primary },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyRowText, { color: themeColors.text }]}>
                    {isMine(h) ? 'Vous' : getDisplayName(h)} — {money(h.price_offered)}
                  </Text>
                  <Text style={[styles.historyRowDate, { color: themeColors.textSecondary }]}>
                    {formatDate(h.created_at)} · {statusLabel(h.status)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular },
  scrollView: { flex: 1, paddingHorizontal: spacing.md },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error + '15',
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.error, fontSize: typography.fontSize.sm, flex: 1 },
  bookingSummary: {
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bookingSummaryTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  bookingSummaryPrice: { alignItems: 'flex-end' },
  bookingSummaryPriceLabel: { fontSize: typography.fontSize.xs, color: colors.textSecondary },
  bookingSummaryPriceValue: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: colors.primary },
  bookingSummaryText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  offersList: { paddingBottom: spacing.md },
  offersTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginBottom: spacing.md },
  offerCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  therapistInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  therapistAvatar: {
    width: 46, height: 46,
    // ✅ Carré avec bordures légèrement arrondies (au lieu
    // d'un cercle plein) pour la photo de profil.
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  therapistAvatarImage: { width: '100%', height: '100%' },
  therapistAvatarText: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.primary },
  therapistName: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  therapistPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  therapistPhoneText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  statusBadgeText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timerBadgeUrgent: { backgroundColor: colors.error + '15' },
  timerBadgeText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, color: colors.textSecondary },
  offerPriceContainer: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  offerPrice: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold },
  offerPriceComparison: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  offerMessage: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, fontStyle: 'italic', marginTop: spacing.xs },
  turnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  turnBannerText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, color: colors.primary },
  offerDate: { fontSize: typography.fontSize.xs, marginTop: spacing.xs },
  offerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  acceptButton: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  acceptGradient: { paddingVertical: spacing.sm, alignItems: 'center' },
  acceptButtonText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  counterButton: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: 8,
    borderWidth: 1, borderColor: colors.primary, alignItems: 'center',
  },
  counterButtonText: { color: colors.primary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  rejectButton: {
    padding: spacing.sm, borderRadius: 8, borderWidth: 1,
    borderColor: colors.error + '30', alignItems: 'center', justifyContent: 'center',
  },
  historySection: { marginTop: spacing.sm, paddingBottom: spacing.xl },
  historyTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginBottom: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyRowText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  historyRowDate: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  emptyState: { alignItems: 'center', padding: spacing.xl, paddingTop: spacing.xxl },
  emptyStateTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.md },
  emptyStateText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.xs },
});

export default OffersScreen;