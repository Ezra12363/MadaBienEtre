// src/screens/therapist/AvailabilityScreen.js
/**
 * ============================================================
 * AVAILABILITY SCREEN
 * ============================================================
 *
 * Gestion complète des disponibilités du thérapeute :
 *
 * 1. Statut En ligne / Hors ligne
 * 2. Disponibilité générale
 * 3. Planning hebdomadaire
 * 4. Modification des heures
 * 5. Dates bloquées
 * 6. Création d'une date bloquée
 * 7. Suppression d'une date bloquée
 *
 * COMPATIBILITÉ :
 * - Android
 * - iOS
 * - Web
 *
 * IMPORTANT :
 * - Android/iOS utilisent @react-native-community/datetimepicker
 * - Web utilise les inputs HTML date/time
 * - Les dates sont formatées en heure locale
 *   afin d'éviter les problèmes de timezone liés à toISOString()
 * ============================================================
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  TextInput,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import availabilityService from '../../services/availabilityService';

// ============================================================
// CONFIG
// ============================================================

const IS_WEB = Platform.OS === 'web';

const DAY_NAMES = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

// ============================================================
// HELPERS DATE
// ============================================================

/**
 * Retourne une date locale sans heure.
 *
 * Exemple :
 * 2026-08-16
 */
const startOfLocalDay = (date = new Date()) => {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
};

/**
 * Format local YYYY-MM-DD.
 *
 * IMPORTANT :
 * Ne pas utiliser toISOString()
 * car cela peut décaler la date selon le timezone.
 */
const formatLocalDate = (date) => {
  if (!date) return '';

  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Parse YYYY-MM-DD en Date locale.
 */
const parseLocalDate = (dateString) => {
  if (!dateString) {
    return new Date();
  }

  const parts = dateString.split('-').map(Number);

  if (parts.length !== 3) {
    return new Date();
  }

  const [year, month, day] = parts;

  const date = new Date(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0
  );

  return date;
};

/**
 * Convertit HH:MM en Date locale.
 */
const parseTimeToDate = (timeStr) => {
  const [h, m] = (timeStr || '09:00')
    .split(':')
    .map(Number);

  const d = new Date();

  d.setHours(
    Number.isFinite(h) ? h : 9,
    Number.isFinite(m) ? m : 0,
    0,
    0
  );

  return d;
};

/**
 * Convertit Date en HH:MM.
 */
const formatDateToTime = (date) => {
  if (!date) return '09:00';

  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');

  return `${h}:${m}`;
};

/**
 * Convertit HH:MM en minutes.
 */
const timeToMinutes = (time) => {
  if (!time) return 0;

  const [hours, minutes] = time
    .split(':')
    .map(Number);

  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  );
};

/**
 * Compare deux dates uniquement sur la partie jour.
 */
const compareDatesOnly = (a, b) => {
  const dateA = startOfLocalDay(a);
  const dateB = startOfLocalDay(b);

  return dateA.getTime() - dateB.getTime();
};

// ============================================================
// WEB DATE INPUT
// ============================================================

/**
 * Input date HTML utilisé uniquement sur Web.
 */
const WebDateInput = ({
  value,
  min,
  onChange,
  themeColors,
}) => {
  if (!IS_WEB) return null;

  return (
    <input
      type="date"
      value={value || ''}
      min={min || undefined}
      onChange={(event) => {
        const value = event.target.value;

        if (value) {
          onChange(value);
        }
      }}
      style={{
        width: '100%',
        height: 44,
        borderRadius: 10,
        border: `1px solid ${
          themeColors.border || '#ddd'
        }`,
        backgroundColor:
          themeColors.background || '#fff',
        color: themeColors.text || '#222',
        padding: '0 12px',
        fontSize: 15,
        boxSizing: 'border-box',
        outline: 'none',
      }}
    />
  );
};

/**
 * Input time HTML utilisé uniquement sur Web.
 */
const WebTimeInput = ({
  value,
  min,
  onChange,
  themeColors,
}) => {
  if (!IS_WEB) return null;

  return (
    <input
      type="time"
      value={value || ''}
      min={min || undefined}
      onChange={(event) => {
        const value = event.target.value;

        if (value) {
          onChange(value);
        }
      }}
      style={{
        width: '100%',
        height: 44,
        borderRadius: 10,
        border: `1px solid ${
          themeColors.border || '#ddd'
        }`,
        backgroundColor:
          themeColors.background || '#fff',
        color: themeColors.text || '#222',
        padding: '0 12px',
        fontSize: 15,
        boxSizing: 'border-box',
        outline: 'none',
      }}
    />
  );
};

// ============================================================
// COMPONENT
// ============================================================

const AvailabilityScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  // ==========================================================
  // MAIN STATES
  // ==========================================================

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isOnline, setIsOnline] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const [
    weeklySchedule,
    setWeeklySchedule,
  ] = useState(
    availabilityService.getDefaultWeeklySchedule()
  );

  const [blockedDates, setBlockedDates] = useState([]);

  // ==========================================================
  // BLOCK DATE MODAL
  // ==========================================================

  const [
    showBlockModal,
    setShowBlockModal,
  ] = useState(false);

  const [blockForm, setBlockForm] = useState({
    start_date: startOfLocalDay(),
    end_date: startOfLocalDay(),
    reason: '',
    is_all_day: true,
  });

  const [
    showStartPicker,
    setShowStartPicker,
  ] = useState(false);

  const [
    showEndPicker,
    setShowEndPicker,
  ] = useState(false);

  const [
    blockSaving,
    setBlockSaving,
  ] = useState(false);

  // ==========================================================
  // EDIT HOURS MODAL
  // ==========================================================

  const [
    showEditDayModal,
    setShowEditDayModal,
  ] = useState(false);

  const [editingDay, setEditingDay] =
    useState(null);

  const [
    editStartTime,
    setEditStartTime,
  ] = useState(parseTimeToDate('09:00'));

  const [
    editEndTime,
    setEditEndTime,
  ] = useState(parseTimeToDate('18:00'));

  const [
    showEditStartPicker,
    setShowEditStartPicker,
  ] = useState(false);

  const [
    showEditEndPicker,
    setShowEditEndPicker,
  ] = useState(false);

  const [
    editDaySaving,
    setEditDaySaving,
  ] = useState(false);

  // ==========================================================
  // LOAD AVAILABILITY
  // ==========================================================

  const loadAvailability = useCallback(
    async () => {
      try {
        setLoading(true);

        const result =
          await availabilityService.getMyAvailability();

        console.log(
          '📥 Availability response:',
          result
        );

        if (
          result.success &&
          result.data
        ) {
          const data = result.data;

          setIsOnline(
            data.is_online ?? false
          );

          setIsAvailable(
            data.is_available ?? false
          );

          // ------------------------------
          // WEEKLY
          // ------------------------------

          if (
            Array.isArray(data.weekly) &&
            data.weekly.length > 0
          ) {
            const defaults =
              availabilityService.getDefaultWeeklySchedule();

            const merged =
              defaults.map((def) => {
                const serverDay =
                  data.weekly.find(
                    (item) =>
                      Number(item.day) ===
                      Number(def.day)
                  );

                return serverDay
                  ? {
                      ...def,
                      ...serverDay,
                    }
                  : def;
              });

            setWeeklySchedule(merged);
          }

          // ------------------------------
          // BLOCKED DATES
          // ------------------------------

          if (
            Array.isArray(data.blocked)
          ) {
            setBlockedDates(
              data.blocked
            );
          }
        } else {
          console.warn(
            '⚠️ Disponibilités non chargées:',
            result.error
          );
        }
      } catch (error) {
        console.error(
          '❌ loadAvailability:',
          error
        );

        Alert.alert(
          'Erreur',
          'Impossible de charger les disponibilités.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  useEffect(() => {
    loadAvailability();

    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }
    ).start();
  }, [
    loadAvailability,
    fadeAnim,
  ]);

  // ==========================================================
  // TOGGLE ONLINE
  // ==========================================================

  const handleToggleOnline =
    async () => {
      const previous = isOnline;

      setIsOnline(!previous);

      try {
        const result =
          await availabilityService.toggleOnline();

        if (!result.success) {
          setIsOnline(previous);

          Alert.alert(
            'Erreur',
            result.error ||
              'Impossible de modifier le statut'
          );

          return;
        }

        setIsOnline(
          result.data?.is_online ??
            !previous
        );
      } catch (error) {
        setIsOnline(previous);

        Alert.alert(
          'Erreur',
          error.message ||
            'Erreur réseau'
        );
      }
    };

  // ==========================================================
  // TOGGLE GENERAL AVAILABILITY
  // ==========================================================

  const handleToggleAvailable =
    async () => {
      const previous =
        isAvailable;

      setIsAvailable(!previous);

      try {
        const result =
          await availabilityService.toggleAvailable();

        if (!result.success) {
          setIsAvailable(previous);

          Alert.alert(
            'Erreur',
            result.error ||
              'Impossible de modifier la disponibilité'
          );

          return;
        }

        setIsAvailable(
          result.data?.is_available ??
            !previous
        );
      } catch (error) {
        setIsAvailable(previous);

        Alert.alert(
          'Erreur',
          error.message ||
            'Erreur réseau'
        );
      }
    };

  // ==========================================================
  // TOGGLE DAY
  // ==========================================================

  const handleToggleDay =
    async (dayIndex) => {
      const previous =
        weeklySchedule;

      const updated =
        weeklySchedule.map(
          (day) =>
            day.day === dayIndex
              ? {
                  ...day,
                  is_available:
                    !day.is_available,
                }
              : day
        );

      setWeeklySchedule(updated);
      setSaving(true);

      try {
        const result =
          await availabilityService.updateWeeklySchedule(
            updated
          );

        if (!result.success) {
          setWeeklySchedule(
            previous
          );

          Alert.alert(
            'Erreur',
            result.error ||
              'Impossible de mettre à jour le planning'
          );
        }
      } catch (error) {
        setWeeklySchedule(
          previous
        );

        Alert.alert(
          'Erreur',
          error.message ||
            'Erreur réseau'
        );
      } finally {
        setSaving(false);
      }
    };

  // ==========================================================
  // OPEN EDIT HOURS MODAL
  // ==========================================================

  const handleEditDayHours =
    (dayItem) => {
      setEditingDay(dayItem);

      setEditStartTime(
        parseTimeToDate(
          dayItem.start || '09:00'
        )
      );

      setEditEndTime(
        parseTimeToDate(
          dayItem.end || '18:00'
        )
      );

      setShowEditStartPicker(
        false
      );

      setShowEditEndPicker(
        false
      );

      setShowEditDayModal(true);
    };

  // ==========================================================
  // WEB EDIT START TIME
  // ==========================================================

  const handleWebStartTimeChange =
    (value) => {
      setEditStartTime(
        parseTimeToDate(value)
      );
    };

  // ==========================================================
  // WEB EDIT END TIME
  // ==========================================================

  const handleWebEndTimeChange =
    (value) => {
      setEditEndTime(
        parseTimeToDate(value)
      );
    };

  // ==========================================================
  // CONFIRM EDIT HOURS
  // ==========================================================

  const handleConfirmEditDayHours =
    async () => {
      if (!editingDay) {
        return;
      }

      const start =
        formatDateToTime(
          editStartTime
        );

      const end =
        formatDateToTime(
          editEndTime
        );

      // ----------------------------------
      // VALIDATION
      // ----------------------------------

      const startMinutes =
        timeToMinutes(start);

      const endMinutes =
        timeToMinutes(end);

      if (
        endMinutes <=
        startMinutes
      ) {
        Alert.alert(
          'Heure invalide',
          "L'heure de fin doit être après l'heure de début."
        );

        return;
      }

      const previous =
        weeklySchedule;

      const updated =
        weeklySchedule.map(
          (day) =>
            day.day === editingDay.day
              ? {
                  ...day,
                  start,
                  end,
                }
              : day
        );

      setWeeklySchedule(updated);
      setEditDaySaving(true);

      try {
        console.log(
          '📤 Updating weekly schedule:',
          updated
        );

        const result =
          await availabilityService.updateWeeklySchedule(
            updated
          );

        if (result.success) {
          setShowEditDayModal(
            false
          );

          setEditingDay(null);

          setShowEditStartPicker(
            false
          );

          setShowEditEndPicker(
            false
          );

          Alert.alert(
            '✅ Succès',
            `Horaires de ${DAY_NAMES[editingDay.day]} mis à jour.`
          );
        } else {
          setWeeklySchedule(
            previous
          );

          Alert.alert(
            'Erreur',
            result.error ||
              'Impossible de mettre à jour les horaires'
          );
        }
      } catch (error) {
        setWeeklySchedule(
          previous
        );

        console.error(
          '❌ updateWeeklySchedule:',
          error
        );

        Alert.alert(
          'Erreur',
          error.message ||
            'Erreur réseau'
        );
      } finally {
        setEditDaySaving(false);
      }
    };

  // ==========================================================
  // OPEN BLOCK DATE MODAL
  // ==========================================================

  const openBlockModal =
    () => {
      const today =
        startOfLocalDay();

      setBlockForm({
        start_date: today,
        end_date: today,
        reason: '',
        is_all_day: true,
      });

      setShowStartPicker(false);
      setShowEndPicker(false);

      setShowBlockModal(true);
    };

  // ==========================================================
  // CHANGE START DATE
  // ==========================================================

  const handleStartDateChange =
    (selectedDate) => {
      if (!selectedDate) {
        return;
      }

      const start =
        startOfLocalDay(
          selectedDate
        );

      setBlockForm(
        (previous) => {
          let end =
            previous.end_date;

          if (
            compareDatesOnly(
              end,
              start
            ) < 0
          ) {
            end = start;
          }

          return {
            ...previous,
            start_date: start,
            end_date: end,
          };
        }
      );
    };

  // ==========================================================
  // CHANGE END DATE
  // ==========================================================

  const handleEndDateChange =
    (selectedDate) => {
      if (!selectedDate) {
        return;
      }

      const end =
        startOfLocalDay(
          selectedDate
        );

      setBlockForm(
        (previous) => ({
          ...previous,
          end_date: end,
        })
      );
    };

  // ==========================================================
  // WEB START DATE
  // ==========================================================

  const handleWebStartDateChange =
    (value) => {
      const selected =
        parseLocalDate(value);

      handleStartDateChange(
        selected
      );
    };

  // ==========================================================
  // WEB END DATE
  // ==========================================================

  const handleWebEndDateChange =
    (value) => {
      const selected =
        parseLocalDate(value);

      handleEndDateChange(
        selected
      );
    };

  // ==========================================================
  // ADD BLOCKED DATE
  // ==========================================================

  const handleAddBlockedDate =
    async () => {
      const start =
        startOfLocalDay(
          blockForm.start_date
        );

      const end =
        startOfLocalDay(
          blockForm.end_date
        );

      // ----------------------------------
      // VALIDATION DATE
      // ----------------------------------

      const today =
        startOfLocalDay();

      if (
        compareDatesOnly(
          start,
          today
        ) < 0
      ) {
        Alert.alert(
          'Date invalide',
          'La date de début ne peut pas être dans le passé.'
        );

        return;
      }

      if (
        compareDatesOnly(
          end,
          start
        ) < 0
      ) {
        Alert.alert(
          'Date invalide',
          'La date de fin doit être égale ou postérieure à la date de début.'
        );

        return;
      }

      const startStr =
        formatLocalDate(start);

      const endStr =
        formatLocalDate(end);

      console.log(
        '📅 Date bloquée:',
        {
          start_date: startStr,
          end_date: endStr,
        }
      );

      setBlockSaving(true);

      try {
        const payload = {
          start_date: startStr,
          end_date: endStr,
          reason:
            blockForm.reason.trim() ||
            undefined,
          is_all_day:
            blockForm.is_all_day,
        };

        console.log(
          '📤 Add blocked date:',
          payload
        );

        const result =
          await availabilityService.addBlockedDate(
            payload
          );

        if (result.success) {
          // --------------------------------
          // Ajouter seulement si API
          // retourne réellement la donnée
          // --------------------------------

          if (result.data) {
            setBlockedDates(
              (previous) => [
                ...previous,
                result.data,
              ]
            );
          } else {
            // Si backend ne retourne pas
            // l'objet, on recharge.
            await loadAvailability();
          }

          setShowBlockModal(false);

          setBlockForm({
            start_date:
              startOfLocalDay(),
            end_date:
              startOfLocalDay(),
            reason: '',
            is_all_day: true,
          });

          Alert.alert(
            '✅ Succès',
            'La date bloquée a été ajoutée avec succès.'
          );
        } else {
          Alert.alert(
            'Erreur',
            result.error ||
              "Impossible d'ajouter la date bloquée"
          );
        }
      } catch (error) {
        console.error(
          '❌ addBlockedDate:',
          error
        );

        Alert.alert(
          'Erreur',
          error.message ||
            "Impossible d'ajouter la date bloquée"
        );
      } finally {
        setBlockSaving(false);
      }
    };

  // ==========================================================
  // DELETE BLOCKED DATE
  // ==========================================================

  const handleDeleteBlockedDate =
    (blockedItem) => {
      Alert.alert(
        'Supprimer la date bloquée',
        `Voulez-vous supprimer la période ${blockedItem.start} → ${blockedItem.end} ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Supprimer',
            style: 'destructive',

            onPress: async () => {
              try {
                const result =
                  await availabilityService.deleteBlockedDate(
                    blockedItem.id
                  );

                if (
                  result.success
                ) {
                  setBlockedDates(
                    (previous) =>
                      previous.filter(
                        (item) =>
                          item.id !==
                          blockedItem.id
                      )
                  );

                  Alert.alert(
                    '✅ Succès',
                    'Date bloquée supprimée.'
                  );
                } else {
                  Alert.alert(
                    'Erreur',
                    result.error ||
                      'Impossible de supprimer'
                  );
                }
              } catch (error) {
                Alert.alert(
                  'Erreur',
                  error.message ||
                    'Erreur réseau'
                );
              }
            },
          },
        ]
      );
    };

  // ==========================================================
  // CLOSE BLOCK MODAL
  // ==========================================================

  const closeBlockModal =
    () => {
      if (blockSaving) {
        return;
      }

      setShowStartPicker(false);
      setShowEndPicker(false);

      setShowBlockModal(false);
    };

  // ==========================================================
  // CLOSE EDIT MODAL
  // ==========================================================

  const closeEditModal =
    () => {
      if (editDaySaving) {
        return;
      }

      setShowEditStartPicker(false);
      setShowEditEndPicker(false);

      setShowEditDayModal(false);

      setEditingDay(null);
    };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                themeColors.textSecondary,
            },
          ]}
        >
          Chargement des disponibilités…
        </Text>
      </View>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >
      <Header
        title="Disponibilité"
        showBack
        rightComponent={
          saving ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />
          ) : null
        }
      />

      <Animated.ScrollView
        style={{
          opacity: fadeAnim,
        }}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* ====================================================
            1. STATUT EN LIGNE
        ==================================================== */}

        <Animatable.View
          animation="fadeInDown"
          duration={500}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={styles.rowBetween}
            >
              <View
                style={styles.flex1}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Statut
                </Text>

                <Text
                  style={[
                    styles.cardSub,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {isOnline
                    ? '🟢 En ligne — vous recevez des demandes'
                    : '⚪ Hors ligne — vous ne recevez pas de demandes'}
                </Text>
              </View>

              <Switch
                value={isOnline}
                onValueChange={
                  handleToggleOnline
                }
                trackColor={{
                  false: '#ccc',
                  true: colors.primary,
                }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </Animatable.View>

        {/* ====================================================
            2. DISPONIBILITÉ GÉNÉRALE
        ==================================================== */}

        <Animatable.View
          animation="fadeInUp"
          delay={100}
          duration={500}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={styles.rowBetween}
            >
              <View
                style={styles.flex1}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Disponibilité générale
                </Text>

                <Text
                  style={[
                    styles.cardSub,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {isAvailable
                    ? '✅ Disponible pour de nouvelles réservations'
                    : '🔴 Non disponible'}
                </Text>
              </View>

              <Switch
                value={isAvailable}
                onValueChange={
                  handleToggleAvailable
                }
                trackColor={{
                  false: '#ccc',
                  true: colors.primary,
                }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </Animatable.View>

        {/* ====================================================
            3. PLANNING HEBDOMADAIRE
        ==================================================== */}

        <Animatable.View
          animation="fadeInUp"
          delay={200}
          duration={500}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={styles.sectionHeader}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Planning hebdomadaire
              </Text>

              {saving && (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.primary
                  }
                />
              )}
            </View>

            {weeklySchedule.map(
              (dayItem) => (
                <View
                  key={dayItem.day}
                  style={[
                    styles.dayRow,
                    {
                      borderBottomColor:
                        themeColors.border ||
                        '#eee',
                    },
                  ]}
                >
                  <View
                    style={
                      styles.dayNameWrap
                    }
                  >
                    <Text
                      style={[
                        styles.dayName,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {
                        DAY_NAMES[
                          dayItem.day
                        ]
                      }
                    </Text>

                    {dayItem.is_available ? (
                      <TouchableOpacity
                        onPress={() =>
                          handleEditDayHours(
                            dayItem
                          )
                        }
                        activeOpacity={
                          0.7
                        }
                      >
                        <View
                          style={
                            styles.hoursTouchable
                          }
                        >
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color={
                              colors.primary
                            }
                          />

                          <Text
                            style={[
                              styles.dayHours,
                              {
                                color:
                                  themeColors.textSecondary,
                              },
                            ]}
                          >
                            {dayItem.start ||
                              '09:00'}{' '}
                            –{' '}
                            {dayItem.end ||
                              '18:00'}
                          </Text>

                          <Ionicons
                            name="pencil-outline"
                            size={13}
                            color={
                              colors.primary
                            }
                          />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={
                          styles.closedWrap
                        }
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={14}
                          color="#e53935"
                        />

                        <Text
                          style={
                            styles.dayClosed
                          }
                        >
                          Fermé
                        </Text>
                      </View>
                    )}
                  </View>

                  <Switch
                    value={
                      !!dayItem.is_available
                    }
                    onValueChange={() =>
                      handleToggleDay(
                        dayItem.day
                      )
                    }
                    trackColor={{
                      false: '#ccc',
                      true: colors.primary,
                    }}
                    thumbColor="#fff"
                  />
                </View>
              )
            )}
          </View>
        </Animatable.View>

        {/* ====================================================
            4. DATES BLOQUÉES
        ==================================================== */}

        <Animatable.View
          animation="fadeInUp"
          delay={300}
          duration={500}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={styles.rowBetween}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Dates bloquées
              </Text>

              <TouchableOpacity
                onPress={
                  openBlockModal
                }
                activeOpacity={0.7}
              >
                <Ionicons
                  name="add-circle"
                  size={30}
                  color={
                    colors.primary
                  }
                />
              </TouchableOpacity>
            </View>

            {blockedDates.length ===
            0 ? (
              <View
                style={
                  styles.emptyBlocked
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={32}
                  color={
                    themeColors.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.emptyText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Aucune date bloquée
                </Text>
              </View>
            ) : (
              blockedDates.map(
                (item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.blockedRow,
                      {
                        borderBottomColor:
                          themeColors.border ||
                          '#eee',
                      },
                    ]}
                  >
                    <View
                      style={
                        styles.blockIcon
                      }
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={
                          colors.error ||
                          '#e53935'
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.flex1
                      }
                    >
                      <Text
                        style={[
                          styles.blockedDates,
                          {
                            color:
                              themeColors.text,
                          },
                        ]}
                      >
                        {item.start ||
                          item.start_date}{' '}
                        →{' '}
                        {item.end ||
                          item.end_date}
                      </Text>

                      {item.reason ? (
                        <Text
                          style={[
                            styles.blockedReason,
                            {
                              color:
                                themeColors.textSecondary,
                            },
                          ]}
                        >
                          {item.reason}
                        </Text>
                      ) : null}

                      {item.is_all_day !==
                        false && (
                        <Text
                          style={[
                            styles.allDayLabel,
                            {
                              color:
                                colors.primary,
                            },
                          ]}
                        >
                          Toute la journée
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        handleDeleteBlockedDate(
                          item
                        )
                      }
                      hitSlop={{
                        top: 8,
                        bottom: 8,
                        left: 8,
                        right: 8,
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={21}
                        color={
                          colors.error ||
                          '#e53935'
                        }
                      />
                    </TouchableOpacity>
                  </View>
                )
              )
            )}
          </View>
        </Animatable.View>
      </Animated.ScrollView>

      {/* ======================================================
          MODAL : CRÉER DATE BLOQUÉE
      ====================================================== */}

      <Modal
        visible={
          showBlockModal
        }
        transparent
        animationType="slide"
        onRequestClose={
          closeBlockModal
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  themeColors.surface ||
                  '#fff',
              },
            ]}
          >
            {/* HEADER */}

            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={
                  styles.modalTitleWrap
                }
              >
                <View
                  style={[
                    styles.modalIcon,
                    {
                      backgroundColor:
                        colors.primary +
                        '18',
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={21}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View>
                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Bloquer une date
                  </Text>

                  <Text
                    style={[
                      styles.modalSubtitle,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Indiquez la période indisponible
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={
                  closeBlockModal
                }
                hitSlop={{
                  top: 8,
                  bottom: 8,
                  left: 8,
                  right: 8,
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={27}
                  color={
                    themeColors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.modalScrollContent
              }
            >
              {/* DATE DÉBUT */}

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Date de début
              </Text>

              {IS_WEB ? (
                <WebDateInput
                  value={formatLocalDate(
                    blockForm.start_date
                  )}
                  min={formatLocalDate(
                    new Date()
                  )}
                  themeColors={
                    themeColors
                  }
                  onChange={
                    handleWebStartDateChange
                  }
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        borderColor:
                          themeColors.border ||
                          '#ddd',
                        backgroundColor:
                          themeColors.background ||
                          '#fff',
                      },
                    ]}
                    onPress={() =>
                      setShowStartPicker(
                        true
                      )
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={[
                        styles.dateButtonText,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {formatLocalDate(
                        blockForm.start_date
                      )}
                    </Text>

                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={
                        themeColors.textSecondary
                      }
                    />
                  </TouchableOpacity>

                  {showStartPicker && (
                    <DateTimePicker
                      value={
                        blockForm.start_date
                      }
                      mode="date"
                      display="default"
                      minimumDate={
                        startOfLocalDay()
                      }
                      onChange={(
                        event,
                        selected
                      ) => {
                        setShowStartPicker(
                          false
                        );

                        if (
                          selected
                        ) {
                          handleStartDateChange(
                            selected
                          );
                        }
                      }}
                    />
                  )}
                </>
              )}

              {/* DATE FIN */}

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Date de fin
              </Text>

              {IS_WEB ? (
                <WebDateInput
                  value={formatLocalDate(
                    blockForm.end_date
                  )}
                  min={formatLocalDate(
                    blockForm.start_date
                  )}
                  themeColors={
                    themeColors
                  }
                  onChange={
                    handleWebEndDateChange
                  }
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        borderColor:
                          themeColors.border ||
                          '#ddd',
                        backgroundColor:
                          themeColors.background ||
                          '#fff',
                      },
                    ]}
                    onPress={() =>
                      setShowEndPicker(
                        true
                      )
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={[
                        styles.dateButtonText,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {formatLocalDate(
                        blockForm.end_date
                      )}
                    </Text>

                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={
                        themeColors.textSecondary
                      }
                    />
                  </TouchableOpacity>

                  {showEndPicker && (
                    <DateTimePicker
                      value={
                        blockForm.end_date
                      }
                      mode="date"
                      display="default"
                      minimumDate={
                        blockForm.start_date
                      }
                      onChange={(
                        event,
                        selected
                      ) => {
                        setShowEndPicker(
                          false
                        );

                        if (
                          selected
                        ) {
                          handleEndDateChange(
                            selected
                          );
                        }
                      }}
                    />
                  )}
                </>
              )}

              {/* INFO */}

              <View
                style={[
                  styles.infoBox,
                  {
                    backgroundColor:
                      colors.primary +
                      '10',
                    borderColor:
                      colors.primary +
                      '30',
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={[
                    styles.infoText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  La période sélectionnée
                  sera indisponible pour
                  les nouvelles réservations.
                </Text>
              </View>

              {/* RAISON */}

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Raison
                <Text
                  style={
                    styles.optionalText
                  }
                >
                  {' '}
                  (optionnel)
                </Text>
              </Text>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    color:
                      themeColors.text,
                    borderColor:
                      themeColors.border ||
                      '#ddd',
                    backgroundColor:
                      themeColors.background,
                  },
                ]}
                placeholder="Ex : Vacances, formation, congé..."
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={
                  blockForm.reason
                }
                onChangeText={(value) =>
                  setBlockForm(
                    (previous) => ({
                      ...previous,
                      reason: value,
                    })
                  )
                }
                maxLength={255}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* ACTIONS */}

              <View
                style={
                  styles.modalActions
                }
              >
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    styles.cancelBtn,
                    {
                      borderColor:
                        themeColors.border ||
                        '#ddd',
                    },
                  ]}
                  onPress={
                    closeBlockModal
                  }
                  disabled={
                    blockSaving
                  }
                >
                  <Text
                    style={[
                      styles.cancelBtnText,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}
                  onPress={
                    handleAddBlockedDate
                  }
                  disabled={
                    blockSaving
                  }
                >
                  {blockSaving ? (
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color="#fff"
                      />

                      <Text
                        style={
                          styles.confirmBtnText
                        }
                      >
                        Bloquer la date
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================
          MODAL : MODIFIER LES HORAIRES
      ====================================================== */}

      <Modal
        visible={
          showEditDayModal
        }
        transparent
        animationType="slide"
        onRequestClose={
          closeEditModal
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  themeColors.surface ||
                  '#fff',
              },
            ]}
          >
            {/* HEADER */}

            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={
                  styles.modalTitleWrap
                }
              >
                <View
                  style={[
                    styles.modalIcon,
                    {
                      backgroundColor:
                        colors.primary +
                        '18',
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={21}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View>
                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Modifier les horaires
                  </Text>

                  <Text
                    style={[
                      styles.modalSubtitle,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    {editingDay
                      ? DAY_NAMES[
                          editingDay.day
                        ]
                      : 'Planning'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={
                  closeEditModal
                }
                hitSlop={{
                  top: 8,
                  bottom: 8,
                  left: 8,
                  right: 8,
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={27}
                  color={
                    themeColors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.modalScrollContent
              }
            >
              {/* HEURE DÉBUT */}

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Heure de début
              </Text>

              {IS_WEB ? (
                <WebTimeInput
                  value={formatDateToTime(
                    editStartTime
                  )}
                  themeColors={
                    themeColors
                  }
                  onChange={
                    handleWebStartTimeChange
                  }
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        borderColor:
                          themeColors.border ||
                          '#ddd',
                        backgroundColor:
                          themeColors.background ||
                          '#fff',
                      },
                    ]}
                    onPress={() =>
                      setShowEditStartPicker(
                        true
                      )
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={[
                        styles.dateButtonText,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {formatDateToTime(
                        editStartTime
                      )}
                    </Text>

                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={
                        themeColors.textSecondary
                      }
                    />
                  </TouchableOpacity>

                  {showEditStartPicker && (
                    <DateTimePicker
                      value={
                        editStartTime
                      }
                      mode="time"
                      is24Hour
                      display="default"
                      onChange={(
                        event,
                        selected
                      ) => {
                        setShowEditStartPicker(
                          false
                        );

                        if (
                          selected
                        ) {
                          setEditStartTime(
                            selected
                          );
                        }
                      }}
                    />
                  )}
                </>
              )}

              {/* HEURE FIN */}

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Heure de fin
              </Text>

              {IS_WEB ? (
                <WebTimeInput
                  value={formatDateToTime(
                    editEndTime
                  )}
                  min={formatDateToTime(
                    editStartTime
                  )}
                  themeColors={
                    themeColors
                  }
                  onChange={
                    handleWebEndTimeChange
                  }
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        borderColor:
                          themeColors.border ||
                          '#ddd',
                        backgroundColor:
                          themeColors.background ||
                          '#fff',
                      },
                    ]}
                    onPress={() =>
                      setShowEditEndPicker(
                        true
                      )
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={[
                        styles.dateButtonText,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {formatDateToTime(
                        editEndTime
                      )}
                    </Text>

                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={
                        themeColors.textSecondary
                      }
                    />
                  </TouchableOpacity>

                  {showEditEndPicker && (
                    <DateTimePicker
                      value={
                        editEndTime
                      }
                      mode="time"
                      is24Hour
                      display="default"
                      onChange={(
                        event,
                        selected
                      ) => {
                        setShowEditEndPicker(
                          false
                        );

                        if (
                          selected
                        ) {
                          setEditEndTime(
                            selected
                          );
                        }
                      }}
                    />
                  )}
                </>
              )}

              {/* PREVIEW */}

              <View
                style={[
                  styles.schedulePreview,
                  {
                    backgroundColor:
                      colors.primary +
                      '10',
                    borderColor:
                      colors.primary +
                      '30',
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color={
                    colors.primary
                  }
                />

                <View
                  style={
                    styles.previewTextWrap
                  }
                >
                  <Text
                    style={[
                      styles.previewLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Nouvel horaire
                  </Text>

                  <Text
                    style={[
                      styles.previewValue,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    {formatDateToTime(
                      editStartTime
                    )}{' '}
                    →{' '}
                    {formatDateToTime(
                      editEndTime
                    )}
                  </Text>
                </View>
              </View>

              {/* WARNING */}

              {timeToMinutes(
                formatDateToTime(
                  editEndTime
                )
              ) <=
                timeToMinutes(
                  formatDateToTime(
                    editStartTime
                  )
                ) && (
                <View
                  style={
                    styles.warningBox
                  }
                >
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color="#E53935"
                  />

                  <Text
                    style={
                      styles.warningText
                    }
                  >
                    L'heure de fin doit
                    être après l'heure
                    de début.
                  </Text>
                </View>
              )}

              {/* ACTIONS */}

              <View
                style={
                  styles.modalActions
                }
              >
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    styles.cancelBtn,
                    {
                      borderColor:
                        themeColors.border ||
                        '#ddd',
                    },
                  ]}
                  onPress={
                    closeEditModal
                  }
                  disabled={
                    editDaySaving
                  }
                >
                  <Text
                    style={[
                      styles.cancelBtnText,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}
                  onPress={
                    handleConfirmEditDayHours
                  }
                  disabled={
                    editDaySaving
                  }
                >
                  {editDaySaving ? (
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="save-outline"
                        size={17}
                        color="#fff"
                      />

                      <Text
                        style={
                          styles.confirmBtnText
                        }
                      >
                        Enregistrer
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: spacing.md,
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.regular,
    },

    scrollContent: {
      paddingHorizontal:
        spacing.md,
      paddingVertical:
        spacing.md,
      paddingBottom:
        spacing.xl * 2,
    },

    // ========================================================
    // CARDS
    // ========================================================

    card: {
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },

    rowBetween: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    flex1: {
      flex: 1,
      marginRight:
        spacing.sm,
    },

    cardTitle: {
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.semiBold,
      marginBottom: 2,
    },

    cardSub: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.regular,
      lineHeight: 19,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.semiBold,
      marginBottom:
        spacing.sm,
    },

    // ========================================================
    // WEEKLY SCHEDULE
    // ========================================================

    dayRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      paddingVertical:
        spacing.sm,
      borderBottomWidth: 1,
    },

    dayNameWrap: {
      flex: 1,
    },

    dayName: {
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.medium,
      marginBottom: 3,
    },

    hoursTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    dayHours: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.regular,
    },

    closedWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    dayClosed: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.medium,
      color: '#e53935',
    },

    // ========================================================
    // BLOCKED DATES
    // ========================================================

    emptyBlocked: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical:
        spacing.lg,
    },

    emptyText: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.regular,
      textAlign: 'center',
      marginTop: 6,
    },

    blockedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical:
        spacing.sm,
      borderBottomWidth: 1,
      gap: spacing.sm,
    },

    blockIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        '#E5393515',
    },

    blockedDates: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.medium,
    },

    blockedReason: {
      fontSize:
        typography.fontSize.xs,
      fontFamily:
        typography.fontFamily.regular,
      marginTop: 3,
    },

    allDayLabel: {
      fontSize: 10,
      fontFamily:
        typography.fontFamily.medium,
      marginTop: 3,
    },

    // ========================================================
    // MODAL
    // ========================================================

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.48)',
      justifyContent: 'flex-end',
    },

    modalContent: {
      width: '100%',
      maxHeight: '92%',

      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,

      paddingHorizontal:
        spacing.lg,
      paddingTop:
        spacing.lg,
      paddingBottom:
        spacing.xl + 10,
    },

    modalScrollContent: {
      paddingBottom:
        spacing.md,
    },

    modalHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom:
        spacing.md,
    },

    modalTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },

    modalIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    modalTitle: {
      fontSize:
        typography.fontSize.lg,
      fontFamily:
        typography.fontFamily.bold,
    },

    modalSubtitle: {
      fontSize: 12,
      marginTop: 2,
      fontFamily:
        typography.fontFamily.regular,
    },

    inputLabel: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.medium,
      marginBottom: 6,
      marginTop: spacing.sm,
    },

    optionalText: {
      fontSize: 11,
      fontFamily:
        typography.fontFamily.regular,
      opacity: 0.7,
    },

    // ========================================================
    // DATE / TIME BUTTON
    // ========================================================

    dateButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,

      borderWidth: 1,
      borderRadius: 10,

      paddingVertical:
        spacing.sm,
      paddingHorizontal:
        spacing.md,
    },

    dateButtonText: {
      flex: 1,
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.medium,
    },

    // ========================================================
    // TEXT INPUT
    // ========================================================

    textInput: {
      minHeight: 90,

      borderWidth: 1,
      borderRadius: 10,

      paddingVertical:
        spacing.sm,
      paddingHorizontal:
        spacing.md,

      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.regular,
    },

    // ========================================================
    // INFO
    // ========================================================

    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,

      borderWidth: 1,
      borderRadius: 12,

      padding: spacing.md,
      marginTop: spacing.md,
    },

    infoText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      fontFamily:
        typography.fontFamily.regular,
    },

    // ========================================================
    // PREVIEW
    // ========================================================

    schedulePreview: {
      flexDirection: 'row',
      alignItems: 'center',

      borderWidth: 1,
      borderRadius: 14,

      padding: spacing.md,
      marginTop: spacing.md,
    },

    previewTextWrap: {
      marginLeft: spacing.sm,
      flex: 1,
    },

    previewLabel: {
      fontSize: 11,
      fontFamily:
        typography.fontFamily.regular,
    },

    previewValue: {
      fontSize: 18,
      fontFamily:
        typography.fontFamily.bold,
      marginTop: 2,
    },

    // ========================================================
    // WARNING
    // ========================================================

    warningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,

      backgroundColor:
        '#E5393512',

      borderWidth: 1,
      borderColor:
        '#E5393540',

      borderRadius: 10,

      padding: spacing.sm,
      marginTop: spacing.sm,
    },

    warningText: {
      flex: 1,
      fontSize: 12,
      color: '#E53935',
      fontFamily:
        typography.fontFamily.medium,
    },

    // ========================================================
    // ACTION BUTTONS
    // ========================================================

    modalActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },

    modalBtn: {
      flex: 1,

      minHeight: 46,

      paddingVertical:
        spacing.md,

      borderRadius: 12,

      alignItems: 'center',
      justifyContent: 'center',

      flexDirection: 'row',
      gap: 7,
    },

    cancelBtn: {
      backgroundColor:
        'transparent',
      borderWidth: 1,
    },

    cancelBtnText: {
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.medium,
    },

    confirmBtnText: {
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.semiBold,
      color: '#fff',
    },
  });

export default AvailabilityScreen;