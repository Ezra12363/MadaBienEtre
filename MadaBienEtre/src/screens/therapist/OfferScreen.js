// src/screens/therapist/OfferScreen.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import bookingService from '../../services/bookingService';
import offerService from '../../services/offerService';

import Header from '../../components/common/Header';

// ============================================================
// COLORS
// ============================================================

const COLORS = {
  primary: '#0D2B7E',
  secondary: '#1A4FB5',
  green: '#00C853',
  red: '#E53935',
  orange: '#F59E0B',
  purple: '#7C3AED',
  white: '#FFFFFF',
  black: '#111827',
  gray900: '#1F2937',
  gray700: '#374151',
  gray600: '#4B5563',
  gray500: '#6B7280',
  gray400: '#9CA3AF',
  gray300: '#D1D5DB',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
};

// ============================================================
// HELPERS
// ============================================================

const money = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0 Ar';
  }

  return `${number.toLocaleString('fr-FR')} Ar`;
};

const dateText = (value) => {
  if (!value) {
    return 'Non renseignée';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    'fr-FR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
};

const getRemaining = (expiresAt) => {
  if (!expiresAt) {
    return 0;
  }

  const expiration =
    new Date(
      expiresAt
    ).getTime();

  if (!Number.isFinite(expiration)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (expiration - Date.now()) /
        1000
    )
  );
};

const formatRemaining = (
  seconds
) => {
  const total =
    Math.max(
      0,
      Number(seconds || 0)
    );

  const days =
    Math.floor(
      total / 86400
    );

  const hours =
    Math.floor(
      (total % 86400) / 3600
    );

  const minutes =
    Math.floor(
      (total % 3600) / 60
    );

  const secs =
    total % 60;

  if (days > 0) {
    return `${days}j ${String(hours).padStart(
      2,
      '0'
    )}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(secs).padStart(
      2,
      '0'
    )}`;
  }

  return `${String(hours).padStart(
    2,
    '0'
  )}:${String(minutes).padStart(
    2,
    '0'
  )}:${String(secs).padStart(
    2,
    '0'
  )}`;
};

// ✅ NORME INTERNATIONALE — numéro de téléphone au format
// international E.164 lisible : "+261 34 12 345 67" au lieu
// d'un numéro local brut ("034 12 345 67" / "0341234567").
const formatPhoneInternational = (raw) => {
  if (!raw) {
    return 'Non renseigné';
  }

  const digits = String(raw).replace(/\D/g, '');

  if (!digits) {
    return String(raw);
  }

  const national = digits.startsWith('261')
    ? digits.slice(3)
    : digits.startsWith('0')
    ? digits.slice(1)
    : digits;

  if (national.length !== 9) {
    // Format inattendu : on préfère afficher la valeur telle
    // quelle plutôt que de la déformer avec un découpage faux.
    return String(raw);
  }

  const p1 = national.slice(0, 2);
  const p2 = national.slice(2, 4);
  const p3 = national.slice(4, 7);
  const p4 = national.slice(7, 9);

  return `+261 ${p1} ${p2} ${p3} ${p4}`;
};

// Durée lisible ("1 h 30" plutôt que "90 min") — plus proche
// des conventions internationales d'affichage de durée.
const formatDurationHuman = (minutes) => {
  const total = Number(minutes);

  if (!Number.isFinite(total) || total <= 0) {
    return '-';
  }

  const h = Math.floor(total / 60);
  const m = total % 60;

  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
};

// ✅ AFFICHAGE — le champ brut venant du backend ("male",
// "female", "any", "indifferent", ...) ne doit jamais être
// affiché tel quel : on le traduit toujours en libellé lisible.
const genderLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();

  const labels = {
    male: 'Homme',
    homme: 'Homme',
    m: 'Homme',
    female: 'Femme',
    femme: 'Femme',
    f: 'Femme',
    any: 'Peu importe',
    indifferent: 'Peu importe',
    indifférent: 'Peu importe',
    no_preference: 'Peu importe',
    '': 'Non précisé',
  };

  return labels[key] || 'Non précisé';
};

const statusLabel = (
  status
) => {
  const value =
    String(
      status || ''
    ).toLowerCase();

  const labels = {
    sent: 'En attente',
    pending: 'En attente',
    accepted: 'Acceptée',
    rejected: 'Refusée',
    expired: 'Expirée',
    confirmed: 'Confirmée',
    negotiating: 'Négociation',
    completed: 'Terminée',
    cancelled: 'Annulée',
    cancelled_by_client:
      'Annulée par le client',
    cancelled_by_therapist:
      'Annulée par le thérapeute',
  };

  return (
    labels[value] ||
    status ||
    'Inconnu'
  );
};

const statusColor = (
  status
) => {
  const value =
    String(
      status || ''
    ).toLowerCase();

  if (
    value === 'accepted' ||
    value === 'confirmed' ||
    value === 'completed'
  ) {
    return COLORS.green;
  }

  if (
    value === 'rejected' ||
    value === 'expired' ||
    value === 'cancelled'
  ) {
    return COLORS.red;
  }

  return COLORS.orange;
};

const getOfferUserName = (
  offer
) => {
  return (
    offer?.therapist?.fullname ||
    offer?.therapist?.name ||
    offer?.client?.fullname ||
    offer?.client?.name ||
    offer?.user?.fullname ||
    offer?.user?.name ||
    offer?.user_name ||
    offer?.therapist_name ||
    offer?.client_name ||
    'Utilisateur'
  );
};

// ============================================================
// SCREEN
// ============================================================

export default function OfferScreen({
  route,
  navigation,
}) {
  const bookingId =
    route?.params?.bookingId ??
    route?.params?.booking?.id;

  const initialBooking =
    route?.params?.booking ??
    null;

  const [
    booking,
    setBooking,
  ] = useState(
    initialBooking
  );

  const [
    offers,
    setOffers,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    price,
    setPrice,
  ] = useState('');

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    remainingTime,
    setRemainingTime,
  ] = useState(
    getRemaining(
      initialBooking?.expires_at
    )
  );

  const [
    toast,
    setToast,
  ] = useState(null);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast =
    useCallback(
      (
        type,
        text
      ) => {
        setToast({
          type,
          text,
        });

        setTimeout(
          () => {
            setToast(null);
          },
          3000
        );
      },
      []
    );

  // ==========================================================
  // MERGE BOOKING
  // ==========================================================

  const mergeBooking = (
    oldBooking,
    newBooking
  ) => {
    if (!newBooking) {
      return oldBooking;
    }

    return {
      ...(oldBooking || {}),
      ...(newBooking || {}),

      client: {
        ...(oldBooking?.client || {}),
        ...(newBooking?.client || {}),
      },

      massage_type: {
        ...(oldBooking?.massage_type || {}),
        ...(newBooking?.massage_type || {}),
      },

      my_offer:
        newBooking?.my_offer ??
        oldBooking?.my_offer ??
        null,
    };
  };

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData =
    useCallback(
      async (
        refresh = false
      ) => {
        if (!bookingId) {
          showToast(
            'error',
            'Réservation introuvable.'
          );

          setLoading(false);
          return;
        }

        try {
          if (refresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          // --------------------------------------------------
          // Get booking + offers
          // --------------------------------------------------

          const [
            bookingResult,
            offersResult,
          ] = await Promise.all([
            bookingService.getBooking(
              bookingId
            ),
            offerService.getOffersByBooking(
              bookingId
            ),
          ]);

          // --------------------------------------------------
          // IMPORTANT:
          // MERGE, don't replace.
          // --------------------------------------------------

          if (
            bookingResult?.success &&
            bookingResult?.data
          ) {
            setBooking(
              (current) =>
                mergeBooking(
                  current,
                  bookingResult.data
                )
            );
          }

          // --------------------------------------------------
          // OFFERS
          // --------------------------------------------------

          if (
            offersResult?.success
          ) {
            const offerData =
              Array.isArray(
                offersResult?.data
              )
                ? offersResult.data
                : [];

            setOffers(
              offerData
            );
          }

          // --------------------------------------------------
          // ERROR
          // --------------------------------------------------

          if (
            !bookingResult?.success &&
            !offersResult?.success
          ) {
            showToast(
              'error',
              bookingResult?.error ||
                offersResult?.error ||
                'Erreur de chargement.'
            );
          }

        } catch (error) {
          console.error(
            '❌ OfferScreen loadData:',
            error
          );

          showToast(
            'error',
            error?.message ||
              'Erreur de chargement.'
          );

        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        bookingId,
        showToast,
      ]
    );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(
    () => {
      loadData(false);
    },
    [loadData]
  );

  // ==========================================================
  // AUTO REFRESH
  // ==========================================================

  useEffect(
    () => {
      const interval =
        setInterval(
          () => {
            loadData(true);
          },
          10000
        );

      return () =>
        clearInterval(
          interval
        );
    },
    [loadData]
  );

  // ==========================================================
  // COUNTDOWN
  // ==========================================================

  useEffect(
    () => {
      const update =
        () => {
          setRemainingTime(
            getRemaining(
              booking?.expires_at
            )
          );
        };

      update();

      const interval =
        setInterval(
          update,
          1000
        );

      return () =>
        clearInterval(
          interval
        );
    },
    [
      booking?.expires_at,
    ]
  );

  // ==========================================================
  // BOOKING DATA
  // ==========================================================

  const client =
    booking?.client || {};

  const massage =
    booking?.massage_type || {};

  const clientName =
    client?.fullname ||
    client?.name ||
    booking?.client_fullname ||
    booking?.client_name ||
    'Client';

  const clientPhone =
    client?.phone ||
    booking?.client_phone ||
    booking?.phone ||
    'Non renseigné';

  const clientEmail =
    client?.email ||
    booking?.client_email ||
    booking?.email ||
    'Non renseigné';

  const massageName =
    massage?.name ||
    booking?.massage_type_name ||
    'Massage';

  const category =
    massage?.category ||
    booking?.massage_category ||
    booking?.category ||
    null;

  const clientPrice =
    Number(
      booking?.client_price_proposed ??
      booking?.proposed_price ??
      booking?.price ??
      0
    );

  const therapistPrice =
    booking?.therapist_initial_price ??
    booking?.therapist_price ??
    null;

  const finalPrice =
    booking?.final_price ??
    null;

  const duration =
    booking?.scheduled_duration_minutes ??
    booking?.duration_minutes ??
    booking?.duration ??
    60;

  const distance =
    booking?.distance_km ??
    booking?.distanceKm ??
    null;

  const eta =
    booking?.eta_minutes ??
    booking?.etaMinutes ??
    null;

  const scheduledDate =
    booking?.scheduled_date ??
    booking?.scheduledDate ??
    null;

  const address =
    booking?.address ||
    booking?.client_location ||
    'Adresse non renseignée';

  const latitude =
    booking?.client_latitude ??
    booking?.latitude ??
    null;

  const longitude =
    booking?.client_longitude ??
    booking?.longitude ??
    null;

  const gender =
    booking?.preferred_gender ??
    'Non précisé';

  // ✅ Toujours le libellé lisible ("Homme"/"Femme"/"Peu importe")
  // pour l'affichage — jamais le code brut ("male"/"female").
  const genderDisplay = genderLabel(gender);

  const instructions =
    booking?.special_instructions ||
    null;

  const createdAt =
    booking?.created_at ??
    booking?.createdAt ??
    null;

  const expiresAt =
    booking?.expires_at ??
    booking?.expiresAt ??
    null;

  const offersCount =
    Number(
      booking?.offers_count ??
      booking?.offersCount ??
      offers.length ??
      0
    );

  // ✅ FIX AFFICHAGE : booking.has_my_offer / booking.my_offer viennent de
  // GET /bookings/available (au moment où on a ouvert cet écran depuis la
  // liste) et ne sont PLUS renvoyés par GET /bookings/{id} (utilisé pour le
  // rafraîchissement toutes les 10s). Sans ce correctif, "Mon offre" restait
  // figée sur sa valeur initiale même après une nouvelle offre / contre-offre.
  // On identifie mon fil de négociation via l'id capturé une seule fois au
  // premier chargement (booking.my_offer.user_id), puis on reconstruit
  // toujours "myOffer" à partir du tableau `offers` (rafraîchi en temps réel).
  const myTherapistId =
    booking?.my_offer?.user_id ??
    booking?.myOffer?.user_id ??
    null;

  const myThreadOffers =
    useMemo(
      () =>
        offers.filter((offer) => {
          const type = String(
            offer?.user_type || ''
          ).toLowerCase();

          if (type === 'therapist') {
            // Seules MES propres offres de thérapeute (id connu ci-dessus,
            // ou la toute première offre si je n'ai pas encore d'id capturé).
            return myTherapistId
              ? Number(offer?.user_id) ===
                  Number(myTherapistId)
              : true;
          }

          // Contre-offres du client : approximation raisonnable tant que le
          // backend ne rattache pas explicitement chaque ligne à un fil de
          // négociation par thérapeute (voir NOTE backend plus bas).
          return true;
        }),
      [offers, myTherapistId]
    );

  const myOffer =
    myThreadOffers[0] ??
    booking?.my_offer ??
    booking?.myOffer ??
    null;

  const hasMyOffer = Boolean(myOffer);

  const bookingStatus =
    String(
      booking?.status ||
      'pending'
    ).toLowerCase();

  const isExpired =
    remainingTime <= 0;

  const canNegotiate =
    !isExpired &&
    ![
      'confirmed',
      'completed',
      'expired',
      'cancelled',
      'cancelled_by_client',
      'cancelled_by_therapist',
    ].includes(
      bookingStatus
    );

  // ==========================================================
  // OFFER FILTER
  // ==========================================================

  const therapistOffers =
    useMemo(
      () =>
        offers.filter(
          (offer) =>
            String(
              offer?.user_type ||
              ''
            ).toLowerCase() ===
            'therapist'
        ),
      [offers]
    );

  const clientOffers =
    useMemo(
      () =>
        offers.filter(
          (offer) =>
            String(
              offer?.user_type ||
              ''
            ).toLowerCase() ===
            'client'
        ),
      [offers]
    );

  // ==========================================================
  // SEND OFFER
  // ==========================================================

  const sendOffer =
    async () => {
      if (!canNegotiate) {
        showToast(
          'error',
          'Cette réservation n’est plus disponible.'
        );
        return;
      }

      const numericPrice =
        Number(
          String(price)
            .replace(/\s/g, '')
            .replace(',', '.')
        );

      if (
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <= 0
      ) {
        showToast(
          'error',
          'Veuillez saisir un prix valide.'
        );
        return;
      }

      try {
        setSubmitting(true);

        const result =
          await offerService.sendOffer(
            bookingId,
            numericPrice,
            message
          );

        if (!result?.success) {
          showToast(
            'error',
            result?.error ||
              'Impossible d’envoyer l’offre.'
          );
          return;
        }

        setPrice('');
        setMessage('');

        showToast(
          'success',
          'Votre offre a été envoyée.'
        );

        await loadData(true);

      } catch (error) {
        showToast(
          'error',
          error?.message ||
            'Erreur lors de l’envoi.'
        );
      } finally {
        setSubmitting(false);
      }
    };

  // ==========================================================
  // ACCEPT CLIENT PRICE
  // ==========================================================

  const acceptClientPrice =
    () => {
      if (!canNegotiate) {
        return;
      }

      const execute =
        async () => {
          try {
            setSubmitting(true);

            const result =
              await offerService.acceptClientPrice(
                bookingId,
                clientPrice
              );

            if (!result?.success) {
              showToast(
                'error',
                result?.error ||
                  'Impossible d’accepter le prix.'
              );
              return;
            }

            showToast(
              'success',
              'Prix client accepté.'
            );

            await loadData(true);

          } catch (error) {
            showToast(
              'error',
              error?.message ||
                'Erreur.'
            );
          } finally {
            setSubmitting(false);
          }
        };

      if (
        Platform.OS === 'web'
      ) {
        execute();
        return;
      }

      Alert.alert(
        'Accepter le prix',
        `Accepter ${money(
          clientPrice
        )} pour cette réservation ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Accepter',
            onPress: execute,
          },
        ]
      );
    };

  // ==========================================================
  // COUNTER OFFER
  // ==========================================================

  const sendCounterOffer =
    (offer) => {
      if (!canNegotiate) {
        return;
      }

      const execute =
        async () => {
          const numericPrice =
            Number(
              String(price)
                .replace(/\s/g, '')
                .replace(',', '.')
            );

          if (
            !Number.isFinite(
              numericPrice
            ) ||
            numericPrice <= 0
          ) {
            showToast(
              'error',
              'Saisissez un montant valide.'
            );
            return;
          }

          try {
            setSubmitting(true);

            const result =
              await offerService.counterOffer(
                offer?.id,
                numericPrice,
                message
              );

            if (!result?.success) {
              showToast(
                'error',
                result?.error ||
                  'Impossible d’envoyer la contre-offre.'
              );
              return;
            }

            setPrice('');
            setMessage('');

            showToast(
              'success',
              'Contre-offre envoyée.'
            );

            await loadData(true);

          } catch (error) {
            showToast(
              'error',
              error?.message ||
                'Erreur.'
            );
          } finally {
            setSubmitting(false);
          }
        };

      if (
        Platform.OS === 'web'
      ) {
        execute();
        return;
      }

      Alert.alert(
        'Contre-offre',
        `Envoyer ${money(
          Number(price || 0)
        )} ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Envoyer',
            onPress: execute,
          },
        ]
      );
    };

  // ==========================================================
  // OFFER CARD
  // ==========================================================

  const renderOffer =
    (offer) => {
      const isTherapist =
        String(
          offer?.user_type ||
          ''
        ).toLowerCase() ===
        'therapist';

      const status =
        String(
          offer?.status ||
          'pending'
        ).toLowerCase();

      const offerName =
        getOfferUserName(
          offer
        );

      const color =
        statusColor(
          status
        );

      return (
        <View
          key={
            String(
              offer?.id ??
              Math.random()
            )
          }
          style={[
            styles.offerCard,
            isTherapist
              ? styles.therapistOffer
              : styles.clientOffer,
          ]}
        >
          <View
            style={
              styles.offerHeader
            }
          >
            <View
              style={[
                styles.offerAvatar,
                {
                  backgroundColor:
                    isTherapist
                      ? '#E8EEFF'
                      : '#E9F9EF',
                },
              ]}
            >
              <Ionicons
                name={
                  isTherapist
                    ? 'person'
                    : 'person-outline'
                }
                size={20}
                color={
                  isTherapist
                    ? COLORS.primary
                    : COLORS.green
                }
              />
            </View>

            <View
              style={
                styles.offerUser
              }
            >
              <Text
                style={
                  styles.offerUserName
                }
              >
                {offerName}
              </Text>

              <Text
                style={
                  styles.offerRole
                }
              >
                {isTherapist
                  ? 'Thérapeute'
                  : 'Client'}
              </Text>
            </View>

            <View
              style={[
                styles.offerStatus,
                {
                  backgroundColor:
                    `${color}18`,
                },
              ]}
            >
              <Text
                style={[
                  styles.offerStatusText,
                  {
                    color,
                  },
                ]}
              >
                {statusLabel(
                  status
                )}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.offerPriceBox
            }
          >
            <Text
              style={
                styles.offerPriceLabel
              }
            >
              Prix proposé
            </Text>

            <Text
              style={
                styles.offerPrice
              }
            >
              {money(
                offer?.price_offered ??
                offer?.price ??
                0
              )}
            </Text>
          </View>

          {offer?.message ? (
            <View
              style={
                styles.messageBox
              }
            >
              <Ionicons
                name="chatbox-outline"
                size={17}
                color={
                  COLORS.gray500
                }
              />

              <Text
                style={
                  styles.offerMessage
                }
              >
                {offer.message}
              </Text>
            </View>
          ) : null}

          <View
            style={
              styles.offerFooter
            }
          >
            <Text
              style={
                styles.offerDate
              }
            >
              {dateText(
                offer?.created_at
              )}
            </Text>

            <Text
              style={[
                styles.offerStatusFooter,
                {
                  color,
                },
              ]}
            >
              {statusLabel(
                status
              )}
            </Text>
          </View>

          {/* COUNTER BUTTON */}
          {canNegotiate &&
          !isTherapist &&
          status === 'sent' ? (
            <TouchableOpacity
              disabled={
                submitting
              }
              onPress={() =>
                sendCounterOffer(
                  offer
                )
              }
              style={[
                styles.counterButton,
                submitting &&
                  styles.disabled,
              ]}
            >
              <Ionicons
                name="swap-horizontal"
                size={19}
                color={
                  COLORS.primary
                }
              />

              <Text
                style={
                  styles.counterButtonText
                }
              >
                Envoyer une contre-offre
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading &&
    !booking
  ) {
    return (
      <SafeAreaView
        style={
          styles.safe
        }
      >
        <View
          style={
            styles.center
          }
        >
          <ActivityIndicator
            size="large"
            color={
              COLORS.primary
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Chargement de la réservation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <SafeAreaView
      style={
        styles.safe
      }
    >
      {toast ? (
        <View
          style={[
            styles.toast,
            toast.type ===
              'success'
              ? styles.toastSuccess
              : styles.toastError,
          ]}
        >
          <Ionicons
            name={
              toast.type ===
              'success'
                ? 'checkmark-circle'
                : 'alert-circle'
            }
            size={20}
            color={
              COLORS.white
            }
          />

          <Text
            style={
              styles.toastText
            }
          >
            {toast.text}
          </Text>
        </View>
      ) : null}

      {/* ✅ Header commun (mitovy amin'ny écran hafa rehetra —
          jereo Header.js) fa tsy header manokana intsony. */}
      <Header
        title="Détails et négociation"
        subtitle={`Réservation #${booking?.id || bookingId}`}
        showBack
        onBackPress={() => navigation?.goBack?.()}
        rightComponent={
          <TouchableOpacity
            onPress={() => loadData(true)}
            disabled={refreshing}
            style={styles.refreshButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="refresh" size={21} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={
          styles.flex
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          style={
            styles.flex
          }
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={() =>
                loadData(true)
              }
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >

          {/* =================================================
              STATUS
          ================================================= */}

          <View
            style={
              styles.statusCard
            }
          >
            <View
              style={
                styles.statusLeft
              }
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      statusColor(
                        bookingStatus
                      ),
                  },
                ]}
              />

              <View>
                <Text
                  style={
                    styles.statusLabel
                  }
                >
                  STATUT
                </Text>

                <Text
                  style={[
                    styles.statusValue,
                    {
                      color:
                        statusColor(
                          bookingStatus
                        ),
                    },
                  ]}
                >
                  {statusLabel(
                    bookingStatus
                  )}
                </Text>
              </View>
            </View>

            {expiresAt ? (
              <View
                style={[
                  styles.timerBox,
                  isExpired &&
                    styles.timerDanger,
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={19}
                  color={
                    isExpired
                      ? COLORS.red
                      : COLORS.orange
                  }
                />

                <View>
                  <Text
                    style={
                      styles.timerLabel
                    }
                  >
                    Temps restant
                  </Text>

                  <Text
                    style={[
                      styles.timer,
                      isExpired &&
                        styles.timerDangerText,
                    ]}
                  >
                    {isExpired
                      ? 'EXPIRÉ'
                      : formatRemaining(
                          remainingTime
                        )}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* =================================================
              GRID PLEIN ÉCRAN (WEB) : 2 colonnes
          ================================================= */}

          <View style={styles.webGrid}>

          {/* =================================================
              CLIENT
          ================================================= */}

          <Section
            title="Client"
            style={styles.gridItem}
          >
            <View
              style={
                styles.profileHeader
              }
            >
              <View
                style={
                  styles.profileAvatarFrame
                }
              >
                {client?.avatar_url ||
                client?.avatar ||
                client?.photo_url ||
                client?.photo ||
                client?.profile_photo_url ? (
                  <Image
                    source={{
                      uri:
                        client?.avatar_url ||
                        client?.avatar ||
                        client?.photo_url ||
                        client?.photo ||
                        client?.profile_photo_url,
                    }}
                    style={
                      styles.profileAvatarImage
                    }
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={28}
                    color={
                      COLORS.primary
                    }
                  />
                )}
              </View>

              <View
                style={
                  styles.profileInfo
                }
              >
                <Text
                  style={
                    styles.profileName
                  }
                >
                  {clientName}
                </Text>

                <Text
                  style={
                    styles.profileId
                  }
                >
                  Client #
                  {booking?.client_id ??
                    client?.id ??
                    '-'}
                </Text>
              </View>
            </View>

            <InfoRow
              icon="call-outline"
              label="Téléphone"
              value={
                clientPhone
              }
            />

            <InfoRow
              icon="mail-outline"
              label="Email"
              value={
                clientEmail
              }
            />
          </Section>

          {/* =================================================
              SERVICE
          ================================================= */}

          <Section
            title="Service demandé"
            style={styles.gridItem}
          >
            <View
              style={
                styles.serviceHeader
              }
            >
              <View
                style={
                  styles.serviceIcon
                }
              >
                <Ionicons
                  name="heart-outline"
                  size={25}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.serviceInfo
                }
              >
                <Text
                  style={
                    styles.serviceName
                  }
                >
                  {massageName}
                </Text>

                {category ? (
                  <Text
                    style={
                      styles.serviceCategory
                    }
                  >
                    Catégorie :{' '}
                    {category}
                  </Text>
                ) : null}
              </View>
            </View>

            <InfoRow
              icon="cash-outline"
              label="Prix proposé par le client"
              value={
                money(
                  clientPrice
                )
              }
              valueStyle={
                styles.priceValue
              }
            />

            {therapistPrice !==
            null ? (
              <InfoRow
                icon="person-outline"
                label="Prix thérapeute"
                value={
                  money(
                    therapistPrice
                  )
                }
              />
            ) : null}

            {finalPrice !==
            null ? (
              <InfoRow
                icon="checkmark-circle-outline"
                label="Prix final"
                value={
                  money(
                    finalPrice
                  )
                }
                valueStyle={
                  styles.finalPrice
                }
              />
            ) : null}

            <InfoRow
              icon="time-outline"
              label="Durée"
              value={`${duration} minutes`}
            />
          </Section>

          {/* =================================================
              RENDEZ-VOUS
          ================================================= */}

          <Section
            title="Rendez-vous"
            style={styles.gridItem}
          >
            <InfoRow
              icon="calendar-outline"
              label="Date prévue"
              value={
                dateText(
                  scheduledDate
                )
              }
            />

            <InfoRow
              icon="location-outline"
              label="Adresse"
              value={
                address
              }
            />

            <InfoRow
              icon="navigate-outline"
              label="Distance"
              value={
                distance !==
                  null &&
                distance !==
                  undefined
                  ? `${Number(
                      distance
                    ).toFixed(
                      2
                    )} km`
                  : 'Non disponible'
              }
            />

            <InfoRow
              icon="car-outline"
              label="ETA approximatif"
              value={
                eta !==
                  null &&
                eta !==
                  undefined
                  ? `${eta} minutes`
                  : 'Non disponible'
              }
            />

            <InfoRow
              icon="male-female"
              label="Genre préféré"
              value={
                genderDisplay
              }
            />

            <InfoRow
              icon="map-outline"
              label="GPS client"
              value={
                latitude !==
                  null &&
                longitude !==
                  null
                  ? `${latitude}, ${longitude}`
                  : 'Coordonnées non disponibles'
              }
            />
          </Section>

          {/* =================================================
              DATES / EXPIRATION
          ================================================= */}

          <Section
            title="Informations système"
            style={styles.gridItem}
          >
            <InfoRow
              icon="add-circle-outline"
              label="Créée le"
              value={
                dateText(
                  createdAt
                )
              }
            />

            <InfoRow
              icon="hourglass-outline"
              label="Expire le"
              value={
                dateText(
                  expiresAt
                )
              }
            />

            <InfoRow
              icon="chatbubbles-outline"
              label="Nombre d'offres"
              value={
                String(
                  offersCount
                )
              }
            />

            <InfoRow
              icon={
                hasMyOffer
                  ? 'checkmark-circle-outline'
                  : 'close-circle-outline'
              }
              label="Mon offre"
              value={
                hasMyOffer
                  ? 'Déjà envoyée'
                  : 'Aucune offre'
              }
              valueStyle={
                hasMyOffer
                  ? styles.successValue
                  : styles.mutedValue
              }
            />
          </Section>

          </View>
          {/* fin GRID PLEIN ÉCRAN */}

          {/* =================================================
              SPECIAL INSTRUCTIONS
          ================================================= */}

          {instructions ? (
            <Section
              title="Instructions spéciales"
            >
              <View
                style={
                  styles.instructions
                }
              >
                <Ionicons
                  name="document-text-outline"
                  size={23}
                  color={
                    COLORS.secondary
                  }
                />

                <Text
                  style={
                    styles.instructionsText
                  }
                >
                  {instructions}
                </Text>
              </View>
            </Section>
          ) : null}

          {/* =================================================
              MY OFFER
          ================================================= */}

          {myOffer ? (
            <Section
              title="Mon offre actuelle"
            >
              <View
                style={
                  styles.myOfferCard
                }
              >
                <View>
                  <Text
                    style={
                      styles.myOfferLabel
                    }
                  >
                    Montant proposé
                  </Text>

                  <Text
                    style={
                      styles.myOfferPrice
                    }
                  >
                    {money(
                      myOffer?.price_offered ??
                      myOffer?.price ??
                      0
                    )}
                  </Text>
                </View>

                {myOffer?.status ? (
                  <View
                    style={[
                      styles.offerStatus,
                      {
                        backgroundColor:
                          `${statusColor(
                            myOffer.status
                          )}18`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.offerStatusText,
                        {
                          color:
                            statusColor(
                              myOffer.status
                            ),
                        },
                      ]}
                    >
                      {statusLabel(
                        myOffer.status
                      )}
                    </Text>
                  </View>
                ) : null}
              </View>

              {myOffer?.message ? (
                <Text
                  style={
                    styles.myOfferMessage
                  }
                >
                  {myOffer.message}
                </Text>
              ) : null}
            </Section>
          ) : null}

          {/* =================================================
              MAKE OFFER
          ================================================= */}

          {canNegotiate ? (
            <Section
              title="Faire une offre"
            >
              <Text
                style={
                  styles.helper
                }
              >
                Proposez votre tarif au
                client ou acceptez
                directement son prix.
              </Text>

              <TextInput
                value={
                  price
                }
                onChangeText={
                  setPrice
                }
                placeholder="Ex : 50000"
                placeholderTextColor={
                  COLORS.gray400
                }
                keyboardType="numeric"
                style={
                  styles.input
                }
              />

              <TextInput
                value={
                  message
                }
                onChangeText={
                  setMessage
                }
                placeholder="Message au client (optionnel)"
                placeholderTextColor={
                  COLORS.gray400
                }
                multiline
                numberOfLines={
                  4
                }
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.messageInput,
                ]}
              />

              <TouchableOpacity
                disabled={
                  submitting
                }
                onPress={
                  sendOffer
                }
                style={[
                  styles.primaryButton,
                  submitting &&
                    styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator
                    color={
                      COLORS.white
                    }
                  />
                ) : (
                  <>
                    <Ionicons
                      name="send"
                      size={19}
                      color={
                        COLORS.white
                      }
                    />

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Envoyer mon offre
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                disabled={
                  submitting ||
                  clientPrice <=
                    0
                }
                onPress={
                  acceptClientPrice
                }
                style={[
                  styles.acceptButton,
                  submitting &&
                    styles.disabled,
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={
                    COLORS.white
                  }
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Accepter{' '}
                  {money(
                    clientPrice
                  )}
                </Text>
              </TouchableOpacity>
            </Section>
          ) : null}

          {/* =================================================
              NEGOTIATION
          ================================================= */}

          <Section
            title="Historique de négociation"
          >
            {offers.length ===
            0 ? (
              <View
                style={
                  styles.noOffers
                }
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={42}
                  color={
                    COLORS.gray400
                  }
                />

                <Text
                  style={
                    styles.noOffersTitle
                  }
                >
                  Aucune offre
                </Text>

                <Text
                  style={
                    styles.noOffersText
                  }
                >
                  La négociation
                  commencera
                  lorsqu’une offre
                  sera envoyée.
                </Text>
              </View>
            ) : (
              offers.map(
                renderOffer
              )
            )}
          </Section>

          <View
            style={{
              height: 40,
            }}
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// SECTION
// ============================================================

function Section({
  title,
  children,
  style,
}) {
  return (
    <View
      style={[
        styles.section,
        style,
      ]}
    >
      <Text
        style={
          styles.sectionTitle
        }
      >
        {title}
      </Text>

      {children}
    </View>
  );
}

// ============================================================
// INFO ROW
// ============================================================

function InfoRow({
  icon,
  label,
  value,
  valueStyle,
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <View
        style={
          styles.infoIcon
        }
      >
        <Ionicons
          name={icon}
          size={19}
          color={
            COLORS.secondary
          }
        />
      </View>

      <View
        style={
          styles.infoContent
        }
      >
        <Text
          style={
            styles.infoLabel
          }
        >
          {label}
        </Text>

        <Text
          style={[
            styles.infoValue,
            valueStyle,
          ]}
        >
          {value ===
          null ||
          value ===
            undefined ||
          value === ''
            ? 'Non renseigné'
            : String(value)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    safe: {
      flex: 1,
      backgroundColor:
        COLORS.gray50,
    },

    flex: {
      flex: 1,
    },

    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.gray50,
    },

    loadingText: {
      marginTop: 12,
      color:
        COLORS.gray500,
      fontSize: 11,
    },

    // --------------------------------------------------------
    // TOAST
    // --------------------------------------------------------

    toast: {
      position:
        'absolute',
      zIndex: 1000,
      top: 12,
      left: 14,
      right: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      padding: 14,
      borderRadius: 15,
      elevation: 5,
      shadowColor:
        '#000',
      shadowOpacity:
        0.15,
      shadowRadius:
        8,
      shadowOffset: {
        width: 0,
        height: 3,
      },
    },

    toastSuccess: {
      backgroundColor:
        '#159447',
    },

    toastError: {
      backgroundColor:
        COLORS.red,
    },

    toastText: {
      flex: 1,
      marginLeft: 9,
      color:
        COLORS.white,
      fontWeight:
        '700',
    },

    // --------------------------------------------------------
    // HEADER
    // --------------------------------------------------------

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      paddingVertical:
        11,
      backgroundColor:
        COLORS.white,
      borderBottomWidth:
        1,
      borderBottomColor:
        COLORS.gray200,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EEF3FF',
    },

    refreshButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.3)',
    },

    headerTitleBox: {
      flex: 1,
      marginLeft: 12,
    },

    headerTitle: {
      fontSize: 15,
      fontWeight:
        '900',
      color:
        COLORS.black,
    },

    headerSubtitle: {
      marginTop: 2,
      fontSize: 11,
      color:
        COLORS.gray500,
    },

    // --------------------------------------------------------
    // CONTENT
    // --------------------------------------------------------

    content: {
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'stretch',
      padding:
        Platform.OS === 'web'
          ? 24
          : 14,
      paddingBottom: 50,
    },

    // --------------------------------------------------------
    // WEB GRID (plein écran, 2 colonnes)
    // --------------------------------------------------------

    webGrid: Platform.select({
      web: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      },
      default: {},
    }),

    gridItem: Platform.select({
      web: {
        width: '49%',
      },
      default: {
        width: '100%',
      },
    }),

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    statusCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      padding: 15,
      borderRadius: 18,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.gray200,
    },

    statusLeft: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flex: 1,
    },

    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 10,
    },

    statusLabel: {
      fontSize: 10,
      color:
        COLORS.gray500,
      fontWeight:
        '700',
    },

    statusValue: {
      marginTop: 3,
      fontSize: 15,
      fontWeight:
        '900',
    },

    timerBox: {
      flexDirection:
        'row',
      alignItems:
        'center',
      padding: 9,
      borderRadius: 12,
      backgroundColor:
        '#FFF7E8',
    },

    timerDanger: {
      backgroundColor:
        '#FFF0F0',
    },

    timerLabel: {
      marginLeft: 6,
      fontSize: 9,
      color:
        COLORS.gray500,
    },

    timer: {
      marginLeft: 6,
      marginTop: 1,
      fontSize: 13,
      fontWeight:
        '900',
      color:
        COLORS.orange,
    },

    timerDangerText: {
      color:
        COLORS.red,
    },

    // --------------------------------------------------------
    // SECTION
    // --------------------------------------------------------

    section: {
      marginTop: 14,
      padding: 15,
      backgroundColor:
        COLORS.white,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        COLORS.gray200,
    },

    sectionTitle: {
      fontSize: 13,
      fontWeight:
        '900',
      color:
        COLORS.gray900,
      marginBottom: 14,
    },

    // --------------------------------------------------------
    // PROFILE
    // --------------------------------------------------------

    profileHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 12,
    },

    profileAvatarFrame: {
      width: 64,
      height: 64,
      borderRadius: 16,
      overflow: 'hidden',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#E8EEFF',
      borderWidth: 1,
      borderColor:
        COLORS.gray200,
    },

    profileAvatarImage: {
      width: '100%',
      height: '100%',
    },

    profileInfo: {
      marginLeft: 12,
      flex: 1,
    },

    profileName: {
      fontSize: 15,
      fontWeight:
        '900',
      color:
        COLORS.gray900,
    },

    profileId: {
      marginTop: 3,
      fontSize: 10,
      color:
        COLORS.gray500,
    },

    // --------------------------------------------------------
    // INFO ROW
    // --------------------------------------------------------

    infoRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingVertical: 10,
      borderBottomWidth:
        1,
      borderBottomColor:
        COLORS.gray100,
    },

    infoIcon: {
      width: 35,
      alignItems:
        'center',
      paddingTop: 1,
    },

    infoContent: {
      flex: 1,
      marginLeft: 7,
    },

    infoLabel: {
      fontSize: 10,
      fontWeight:
        '700',
      color:
        COLORS.gray500,
      textTransform:
        'uppercase',
    },

    infoValue: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 19,
      fontWeight:
        '600',
      color:
        COLORS.gray900,
    },

    priceValue: {
      fontSize: 13,
      fontWeight:
        '900',
      color:
        COLORS.primary,
    },

    finalPrice: {
      fontSize: 13,
      fontWeight:
        '900',
      color:
        COLORS.green,
    },

    successValue: {
      color:
        COLORS.green,
      fontWeight:
        '800',
    },

    mutedValue: {
      color:
        COLORS.gray500,
    },

    // --------------------------------------------------------
    // SERVICE
    // --------------------------------------------------------

    serviceHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 5,
    },

    serviceIcon: {
      width: 52,
      height: 52,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EEF3FF',
    },

    serviceInfo: {
      flex: 1,
      marginLeft: 12,
    },

    serviceName: {
      fontSize: 15,
      fontWeight:
        '900',
      color:
        COLORS.gray900,
    },

    serviceCategory: {
      marginTop: 4,
      fontSize: 10,
      color:
        COLORS.gray500,
    },

    // --------------------------------------------------------
    // INSTRUCTIONS
    // --------------------------------------------------------

    instructions: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      padding: 13,
      borderRadius: 13,
      backgroundColor:
        '#F5F8FF',
    },

    instructionsText: {
      flex: 1,
      marginLeft: 10,
      fontSize: 11,
      lineHeight: 20,
      color:
        COLORS.gray700,
    },

    // --------------------------------------------------------
    // MY OFFER
    // --------------------------------------------------------

    myOfferCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        '#F5F8FF',
      borderWidth: 1,
      borderColor:
        '#DCE5FF',
    },

    myOfferLabel: {
      fontSize: 10,
      color:
        COLORS.gray500,
      fontWeight:
        '700',
    },

    myOfferPrice: {
      marginTop: 4,
      fontSize: 20,
      fontWeight:
        '900',
      color:
        COLORS.primary,
    },

    myOfferMessage: {
      marginTop: 10,
      fontSize: 11,
      lineHeight: 19,
      color:
        COLORS.gray700,
    },

    // --------------------------------------------------------
    // INPUT
    // --------------------------------------------------------

    helper: {
      fontSize: 11,
      lineHeight: 18,
      color:
        COLORS.gray500,
      marginBottom: 12,
    },

    input: {
      minHeight: 48,
      paddingHorizontal: 13,
      paddingVertical: 11,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        COLORS.gray300,
      borderRadius: 12,
      backgroundColor:
        COLORS.white,
      color:
        COLORS.gray900,
      fontSize: 12,
    },

    messageInput: {
      minHeight: 100,
    },

    primaryButton: {
      minHeight: 49,
      borderRadius: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.primary,
      marginTop: 3,
    },

    acceptButton: {
      minHeight: 49,
      borderRadius: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.green,
      marginTop: 10,
    },

    primaryButtonText: {
      marginLeft: 8,
      color:
        COLORS.white,
      fontSize: 12,
      fontWeight:
        '900',
    },

    disabled: {
      opacity: 0.55,
    },

    // --------------------------------------------------------
    // OFFERS
    // --------------------------------------------------------

    noOffers: {
      alignItems:
        'center',
      paddingVertical: 25,
    },

    noOffersTitle: {
      marginTop: 9,
      fontSize: 13,
      fontWeight:
        '900',
      color:
        COLORS.gray700,
    },

    noOffersText: {
      marginTop: 5,
      textAlign:
        'center',
      fontSize: 11,
      lineHeight: 18,
      color:
        COLORS.gray500,
      maxWidth: 280,
    },

    offerCard: {
      padding: 13,
      marginBottom: 11,
      borderRadius: 15,
      borderWidth: 1,
      backgroundColor:
        COLORS.white,
    },

    therapistOffer: {
      borderColor:
        '#D7E1FF',
      backgroundColor:
        '#F8FAFF',
    },

    clientOffer: {
      borderColor:
        '#D9F1E1',
      backgroundColor:
        '#FAFFFC',
    },

    offerHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    offerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    offerUser: {
      flex: 1,
      marginLeft: 10,
    },

    offerUserName: {
      fontSize: 12,
      fontWeight:
        '900',
      color:
        COLORS.gray900,
    },

    offerRole: {
      marginTop: 2,
      fontSize: 10,
      color:
        COLORS.gray500,
    },

    offerStatus: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
    },

    offerStatusText: {
      fontSize: 10,
      fontWeight:
        '800',
    },

    offerPriceBox: {
      marginTop: 12,
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        COLORS.gray50,
    },

    offerPriceLabel: {
      fontSize: 10,
      color:
        COLORS.gray500,
    },

    offerPrice: {
      marginTop: 3,
      fontSize: 18,
      fontWeight:
        '900',
      color:
        COLORS.primary,
    },

    messageBox: {
      flexDirection:
        'row',
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor:
        COLORS.gray50,
    },

    offerMessage: {
      flex: 1,
      marginLeft: 8,
      fontSize: 11,
      lineHeight: 18,
      color:
        COLORS.gray700,
    },

    offerFooter: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginTop: 10,
    },

    offerDate: {
      flex: 1,
      fontSize: 10,
      color:
        COLORS.gray500,
    },

    offerStatusFooter: {
      fontSize: 10,
      fontWeight:
        '800',
    },

    counterButton: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 11,
      paddingVertical: 11,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        '#C9D5F5',
      backgroundColor:
        '#F5F8FF',
    },

    counterButtonText: {
      marginLeft: 7,
      color:
        COLORS.primary,
      fontSize: 11,
      fontWeight:
        '800',
    },

  });