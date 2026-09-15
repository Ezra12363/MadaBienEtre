// src/screens/therapist/AvailabilityScreen.js

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
  Animated,
  Modal,
  TextInput,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import availabilityService from '../../services/availabilityService';

// ============================================================
// CONFIGURATION
// ============================================================

const IS_WEB = Platform.OS === 'web';

const PRIMARY = colors.primary || '#168A55';
const DANGER = colors.error || '#DC2626';
const WARNING = '#D97706';

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
// HELPERS DATES
// ============================================================

const startOfLocalDay = (date = new Date()) => {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
};

const formatLocalDate = (date) => {
  if (!date) return '';

  const result = new Date(date);

  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, '0');
  const day = String(result.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateString) => {
  if (!dateString) {
    return startOfLocalDay();
  }

  const parts = String(dateString).split('-').map(Number);

  if (parts.length !== 3) {
    return startOfLocalDay();
  }

  const [year, month, day] = parts;

  return new Date(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0
  );
};

const parseTimeToDate = (timeString = '09:00') => {
  const [hours, minutes] = String(timeString)
    .split(':')
    .map(Number);

  const result = new Date();

  result.setHours(
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );

  return result;
};

const formatDateToTime = (date) => {
  if (!date) return '09:00';

  const result = new Date(date);

  const hours = String(result.getHours()).padStart(2, '0');
  const minutes = String(result.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const timeToMinutes = (timeString) => {
  if (!timeString) return 0;

  const [hours, minutes] = String(timeString)
    .split(':')
    .map(Number);

  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  );
};

const compareDatesOnly = (firstDate, secondDate) => {
  return (
    startOfLocalDay(firstDate).getTime() -
    startOfLocalDay(secondDate).getTime()
  );
};

const getBlockedStart = (item) => {
  return item?.start || item?.start_date || '';
};

const getBlockedEnd = (item) => {
  return item?.end || item?.end_date || '';
};

const getBlockedId = (item) => {
  return item?.id ?? item?.blocked_date_id ?? item?.blockedDateId;
};

// ============================================================
// WEB DATE INPUT
// ============================================================

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
        if (event.target.value) {
          onChange(event.target.value);
        }
      }}
      style={{
        width: '100%',
        height: 46,
        borderRadius: 13,
        border: `1px solid ${
          themeColors.border || '#D1D5DB'
        }`,
        backgroundColor:
          themeColors.background || '#FFFFFF',
        color: themeColors.text || '#111827',
        padding: '0 13px',
        fontSize: 14,
        boxSizing: 'border-box',
        outline: 'none',
      }}
    />
  );
};

// ============================================================
// WEB TIME INPUT
// ============================================================

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
        if (event.target.value) {
          onChange(event.target.value);
        }
      }}
      style={{
        width: '100%',
        height: 46,
        borderRadius: 13,
        border: `1px solid ${
          themeColors.border || '#D1D5DB'
        }`,
        backgroundColor:
          themeColors.background || '#FFFFFF',
        color: themeColors.text || '#111827',
        padding: '0 13px',
        fontSize: 14,
        boxSizing: 'border-box',
        outline: 'none',
      }}
    />
  );
};

// ============================================================
// ANIMATED PRESSABLE BUTTON
// ============================================================

const AnimatedActionButton = ({
  children,
  onPress,
  disabled = false,
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 5,
    }).start();
  };

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale }],
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// TOAST
// ============================================================

const Toast = ({
  visible,
  type = 'success',
  title,
  message,
  onHide,
}) => {
  if (!visible) return null;

  const isError = type === 'error';
  const isWarning = type === 'warning';

  const iconName = isError
    ? 'close-circle'
    : isWarning
      ? 'warning'
      : 'checkmark-circle';

  const iconColor = isError
    ? DANGER
    : isWarning
      ? WARNING
      : PRIMARY;

  return (
    <View
      style={[
        styles.toastContainer,
        {
          borderLeftColor: iconColor,
        },
      ]}
    >
      <View
        style={[
          styles.toastIcon,
          {
            backgroundColor: `${iconColor}18`,
          },
        ]}
      >
        <Ionicons
          name={iconName}
          size={22}
          color={iconColor}
        />
      </View>

      <View style={styles.toastTextWrap}>
        <Text style={styles.toastTitle}>
          {title}
        </Text>

        {!!message && (
          <Text style={styles.toastMessage}>
            {message}
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={onHide}
        hitSlop={{
          top: 10,
          bottom: 10,
          left: 10,
          right: 10,
        }}
      >
        <Ionicons
          name="close"
          size={19}
          color="#777"
        />
      </TouchableOpacity>
    </View>
  );
};

// ============================================================
// CONFIRM DELETE MODAL
// ============================================================

const ConfirmDeleteModal = ({
  visible,
  item,
  loading,
  onCancel,
  onConfirm,
  themeColors,
}) => {
  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.confirmOverlay}>
        <View
          style={[
            styles.confirmModal,
            {
              backgroundColor:
                themeColors.surface || '#FFFFFF',
            },
          ]}
        >
          <View
            style={[
              styles.confirmIcon,
              {
                backgroundColor: `${DANGER}15`,
              },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={28}
              color={DANGER}
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            Supprimer la date bloquée ?
          </Text>

          <Text
            style={[
              styles.confirmMessage,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            Voulez-vous vraiment supprimer cette
            période d'indisponibilité ?
          </Text>

          <View
            style={[
              styles.confirmDateBox,
              {
                backgroundColor:
                  themeColors.background || '#F8FAFC',
                borderColor:
                  themeColors.border || '#E5E7EB',
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={21}
              color={PRIMARY}
            />

            <View style={styles.confirmDateText}>
              <Text
                style={[
                  styles.confirmDate,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {getBlockedStart(item)}
                {' → '}
                {getBlockedEnd(item)}
              </Text>

              {!!item.reason && (
                <Text
                  style={[
                    styles.confirmReason,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {item.reason}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.confirmActions}>
            <AnimatedActionButton
              onPress={onCancel}
              disabled={loading}
              style={styles.actionFlex}
            >
              <View
                style={[
                  styles.confirmButton,
                  styles.confirmCancelButton,
                  {
                    borderColor:
                      themeColors.border || '#D1D5DB',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.confirmCancelText,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </View>
            </AnimatedActionButton>

            <AnimatedActionButton
              onPress={onConfirm}
              disabled={loading}
              style={styles.actionFlex}
            >
              <View
                style={[
                  styles.confirmButton,
                  styles.confirmDeleteButton,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.confirmDeleteText}>
                      Supprimer
                    </Text>
                  </>
                )}
              </View>
            </AnimatedActionButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// COMPONENT
// ============================================================

const AvailabilityScreen = () => {
  const { colors: themeColors } = useTheme();

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isOnline, setIsOnline] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const [weeklySchedule, setWeeklySchedule] = useState(
    availabilityService.getDefaultWeeklySchedule()
  );

  const [blockedDates, setBlockedDates] = useState([]);

  const [toast, setToast] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const toastTimer = useRef(null);

  const [showBlockModal, setShowBlockModal] = useState(false);

  const [blockForm, setBlockForm] = useState({
    start_date: startOfLocalDay(),
    end_date: startOfLocalDay(),
    reason: '',
    is_all_day: true,
  });

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [showEditDayModal, setShowEditDayModal] = useState(false);
  const [editingDay, setEditingDay] = useState(null);

  const [editStartTime, setEditStartTime] = useState(
    parseTimeToDate('09:00')
  );

  const [editEndTime, setEditEndTime] = useState(
    parseTimeToDate('18:00')
  );

  const [showEditStartPicker, setShowEditStartPicker] =
    useState(false);

  const [showEditEndPicker, setShowEditEndPicker] =
    useState(false);

  const [editDaySaving, setEditDaySaving] = useState(false);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback(
    (type, title, message = '') => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast({
        visible: true,
        type,
        title,
        message,
      });

      toastTimer.current = setTimeout(() => {
        setToast((previous) => ({
          ...previous,
          visible: false,
        }));
      }, 3200);
    },
    []
  );

  const hideToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setToast((previous) => ({
      ...previous,
      visible: false,
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // ==========================================================
  // LOAD AVAILABILITY
  // ==========================================================

  const loadAvailability = useCallback(async () => {
    try {
      setLoading(true);

      const result =
        await availabilityService.getMyAvailability();

      console.log(
        '📥 Availability response:',
        result
      );

      if (result.success && result.data) {
        const data = result.data;

        setIsOnline(data.is_online ?? false);
        setIsAvailable(data.is_available ?? false);

        if (
          Array.isArray(data.weekly) &&
          data.weekly.length > 0
        ) {
          const defaults =
            availabilityService.getDefaultWeeklySchedule();

          const merged = defaults.map((defaultDay) => {
            const serverDay = data.weekly.find(
              (item) =>
                Number(item.day) ===
                Number(defaultDay.day)
            );

            return serverDay
              ? {
                  ...defaultDay,
                  ...serverDay,
                }
              : defaultDay;
          });

          setWeeklySchedule(merged);
        }

        if (Array.isArray(data.blocked)) {
          setBlockedDates(data.blocked);
        }
      } else {
        showToast(
          'error',
          'Erreur',
          result.error ||
            'Impossible de charger les disponibilités.'
        );
      }
    } catch (error) {
      console.error(
        '❌ loadAvailability:',
        error
      );

      showToast(
        'error',
        'Erreur',
        'Impossible de charger les disponibilités.'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAvailability();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [loadAvailability, fadeAnim]);

  // ==========================================================
  // TOGGLE ONLINE
  // ==========================================================

  const handleToggleOnline = async () => {
    const previous = isOnline;
    const next = !previous;

    setIsOnline(next);

    try {
      const result =
        await availabilityService.toggleOnline();

      if (!result.success) {
        setIsOnline(previous);

        showToast(
          'error',
          'Erreur',
          result.error ||
            'Impossible de modifier le statut.'
        );

        return;
      }

      const serverValue =
        result.data?.is_online ?? next;

      setIsOnline(serverValue);

      showToast(
        'success',
        serverValue
          ? 'Vous êtes en ligne'
          : 'Vous êtes hors ligne',
        serverValue
          ? 'Vous recevez maintenant les demandes.'
          : 'Vous ne recevrez plus de nouvelles demandes.'
      );
    } catch (error) {
      setIsOnline(previous);

      showToast(
        'error',
        'Erreur',
        error.message || 'Erreur réseau.'
      );
    }
  };

  // ==========================================================
  // TOGGLE GENERAL AVAILABILITY
  // ==========================================================

  const handleToggleAvailable = async () => {
    const previous = isAvailable;
    const next = !previous;

    setIsAvailable(next);

    try {
      const result =
        await availabilityService.toggleAvailable();

      if (!result.success) {
        setIsAvailable(previous);

        showToast(
          'error',
          'Erreur',
          result.error ||
            'Impossible de modifier la disponibilité.'
        );

        return;
      }

      const serverValue =
        result.data?.is_available ?? next;

      setIsAvailable(serverValue);

      showToast(
        'success',
        'Disponibilité mise à jour',
        serverValue
          ? 'Vous êtes maintenant disponible.'
          : 'Vous êtes maintenant indisponible.'
      );
    } catch (error) {
      setIsAvailable(previous);

      showToast(
        'error',
        'Erreur',
        error.message || 'Erreur réseau.'
      );
    }
  };

  // ==========================================================
  // TOGGLE DAY
  // ==========================================================

  const handleToggleDay = async (dayIndex) => {
    const previous = weeklySchedule;

    const updated = weeklySchedule.map((day) =>
      Number(day.day) === Number(dayIndex)
        ? {
            ...day,
            is_available: !day.is_available,
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
        setWeeklySchedule(previous);

        showToast(
          'error',
          'Erreur',
          result.error ||
            'Impossible de mettre à jour le planning.'
        );

        return;
      }

      const updatedDay = updated.find(
        (day) =>
          Number(day.day) === Number(dayIndex)
      );

      showToast(
        'success',
        'Planning mis à jour',
        `${DAY_NAMES[dayIndex]} : ${
          updatedDay?.is_available
            ? 'disponible'
            : 'fermé'
        }.`
      );
    } catch (error) {
      setWeeklySchedule(previous);

      showToast(
        'error',
        'Erreur',
        error.message || 'Erreur réseau.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // EDIT DAY HOURS
  // ==========================================================

  const handleEditDayHours = (dayItem) => {
    setEditingDay(dayItem);

    setEditStartTime(
      parseTimeToDate(dayItem.start || '09:00')
    );

    setEditEndTime(
      parseTimeToDate(dayItem.end || '18:00')
    );

    setShowEditStartPicker(false);
    setShowEditEndPicker(false);
    setShowEditDayModal(true);
  };

  const handleConfirmEditDayHours = async () => {
    if (!editingDay) return;

    const start = formatDateToTime(editStartTime);
    const end = formatDateToTime(editEndTime);

    if (
      timeToMinutes(end) <=
      timeToMinutes(start)
    ) {
      showToast(
        'warning',
        'Heure invalide',
        "L'heure de fin doit être après l'heure de début."
      );

      return;
    }

    const previous = weeklySchedule;

    const updated = weeklySchedule.map((day) =>
      Number(day.day) === Number(editingDay.day)
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
      const result =
        await availabilityService.updateWeeklySchedule(
          updated
        );

      if (!result.success) {
        setWeeklySchedule(previous);

        showToast(
          'error',
          'Erreur',
          result.error ||
            'Impossible de mettre à jour les horaires.'
        );

        return;
      }

      setShowEditDayModal(false);
      setEditingDay(null);
      setShowEditStartPicker(false);
      setShowEditEndPicker(false);

      showToast(
        'success',
        'Horaires enregistrés',
        `Horaires de ${
          DAY_NAMES[editingDay.day]
        } : ${start} → ${end}.`
      );
    } catch (error) {
      setWeeklySchedule(previous);

      showToast(
        'error',
        'Erreur',
        error.message || 'Erreur réseau.'
      );
    } finally {
      setEditDaySaving(false);
    }
  };

  // ==========================================================
  // BLOCKED DATES
  // ==========================================================

  const openBlockModal = () => {
    const today = startOfLocalDay();

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

  const handleStartDateChange = (selectedDate) => {
    if (!selectedDate) return;

    const start = startOfLocalDay(selectedDate);

    setBlockForm((previous) => {
      let end = previous.end_date;

      if (compareDatesOnly(end, start) < 0) {
        end = start;
      }

      return {
        ...previous,
        start_date: start,
        end_date: end,
      };
    });
  };

  const handleEndDateChange = (selectedDate) => {
    if (!selectedDate) return;

    const end = startOfLocalDay(selectedDate);

    setBlockForm((previous) => ({
      ...previous,
      end_date: end,
    }));
  };

  const handleAddBlockedDate = async () => {
    const start = startOfLocalDay(
      blockForm.start_date
    );

    const end = startOfLocalDay(
      blockForm.end_date
    );

    const today = startOfLocalDay();

    if (compareDatesOnly(start, today) < 0) {
      showToast(
        'warning',
        'Date invalide',
        'La date de début ne peut pas être dans le passé.'
      );

      return;
    }

    if (compareDatesOnly(end, start) < 0) {
      showToast(
        'warning',
        'Date invalide',
        'La date de fin doit être égale ou postérieure à la date de début.'
      );

      return;
    }

    const startStr = formatLocalDate(start);
    const endStr = formatLocalDate(end);

    setBlockSaving(true);

    try {
      const payload = {
        start_date: startStr,
        end_date: endStr,
        reason:
          blockForm.reason.trim() || undefined,
        is_all_day: blockForm.is_all_day,
      };

      const result =
        await availabilityService.addBlockedDate(
          payload
        );

      if (!result.success) {
        showToast(
          'error',
          'Erreur',
          result.error ||
            "Impossible d'ajouter la date bloquée."
        );

        return;
      }

      setShowBlockModal(false);

      setBlockForm({
        start_date: startOfLocalDay(),
        end_date: startOfLocalDay(),
        reason: '',
        is_all_day: true,
      });

      if (result.data) {
        setBlockedDates((previous) => [
          ...previous,
          result.data,
        ]);
      } else {
        await loadAvailability();
      }

      showToast(
        'success',
        'Date bloquée ajoutée',
        `${startStr} → ${endStr}`
      );
    } catch (error) {
      showToast(
        'error',
        'Erreur',
        error.message ||
          "Impossible d'ajouter la date bloquée."
      );
    } finally {
      setBlockSaving(false);
    }
  };

  const handleDeleteBlockedDate = (item) => {
    if (!item) return;

    setDeleteTarget(item);
  };

  const cancelDeleteBlockedDate = () => {
    if (deleteSaving) return;

    setDeleteTarget(null);
  };

  const confirmDeleteBlockedDate = async () => {
    if (!deleteTarget) return;

    const item = deleteTarget;
    const itemId = getBlockedId(item);

    if (itemId === undefined || itemId === null) {
      showToast(
        'error',
        'Suppression impossible',
        "L'identifiant de la date bloquée est introuvable."
      );

      setDeleteTarget(null);
      return;
    }

    setDeleteSaving(true);

    try {
      const result =
        await availabilityService.deleteBlockedDate(
          itemId
        );

      if (!result.success) {
        showToast(
          'error',
          'Suppression impossible',
          result.error ||
            'Impossible de supprimer la date bloquée.'
        );

        return;
      }

      setBlockedDates((previous) =>
        previous.filter(
          (blocked) =>
            getBlockedId(blocked) !== itemId
        )
      );

      setDeleteTarget(null);

      showToast(
        'success',
        'Date supprimée',
        'La date bloquée a été supprimée avec succès.'
      );

      await loadAvailability();
    } catch (error) {
      showToast(
        'error',
        'Erreur de suppression',
        error.message ||
          'Erreur réseau lors de la suppression.'
      );
    } finally {
      setDeleteSaving(false);
    }
  };

  const closeBlockModal = () => {
    if (blockSaving) return;

    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowBlockModal(false);
  };

  const closeEditModal = () => {
    if (editDaySaving) return;

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
          color={PRIMARY}
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
      <View
        pointerEvents="box-none"
        style={styles.toastWrapper}
      >
        <Toast
          visible={toast.visible}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onHide={hideToast}
        />
      </View>

      <Header
        title="Disponibilité"
        showBack
        rightComponent={
          saving ? (
            <ActivityIndicator
              size="small"
              color={PRIMARY}
            />
          ) : null
        }
      />

      <Animated.ScrollView
        style={{
          opacity: fadeAnim,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* STATUT EN LIGNE */}

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border || '#E5E7EB',
            },
          ]}
        >
          <View style={styles.cardTopLine}>
            <View
              style={[
                styles.roundIcon,
                {
                  backgroundColor: isOnline
                    ? `${PRIMARY}18`
                    : '#9CA3AF18',
                },
              ]}
            >
              <Ionicons
                name="radio-outline"
                size={22}
                color={isOnline ? PRIMARY : '#6B7280'}
              />
            </View>

            <View style={styles.flex1}>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Statut en ligne
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
                  ? 'Vous recevez les nouvelles demandes.'
                  : 'Vous ne recevez pas de nouvelles demandes.'}
              </Text>
            </View>

            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{
                false: '#D1D5DB',
                true: PRIMARY,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isOnline
                  ? `${PRIMARY}12`
                  : '#6B728012',
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isOnline
                    ? PRIMARY
                    : '#9CA3AF',
                },
              ]}
            />

            <Text
              style={[
                styles.statusPillText,
                {
                  color: isOnline
                    ? PRIMARY
                    : '#6B7280',
                },
              ]}
            >
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
        </View>

        {/* DISPONIBILITÉ GÉNÉRALE */}

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border || '#E5E7EB',
            },
          ]}
        >
          <View style={styles.cardTopLine}>
            <View
              style={[
                styles.roundIcon,
                {
                  backgroundColor: isAvailable
                    ? `${PRIMARY}18`
                    : `${DANGER}15`,
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={isAvailable ? PRIMARY : DANGER}
              />
            </View>

            <View style={styles.flex1}>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: themeColors.text,
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
                  ? 'Vous êtes disponible pour de nouvelles réservations.'
                  : 'Vous êtes actuellement indisponible.'}
              </Text>
            </View>

            <Switch
              value={isAvailable}
              onValueChange={handleToggleAvailable}
              trackColor={{
                false: '#D1D5DB',
                true: PRIMARY,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isAvailable
                  ? `${PRIMARY}12`
                  : `${DANGER}12`,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isAvailable
                    ? PRIMARY
                    : DANGER,
                },
              ]}
            />

            <Text
              style={[
                styles.statusPillText,
                {
                  color: isAvailable
                    ? PRIMARY
                    : DANGER,
                },
              ]}
            >
              {isAvailable
                ? 'Disponible'
                : 'Indisponible'}
            </Text>
          </View>
        </View>

        {/* PLANNING HEBDOMADAIRE */}

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border || '#E5E7EB',
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Planning hebdomadaire
              </Text>

              <Text
                style={[
                  styles.sectionSub,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Définissez vos jours et heures de travail.
              </Text>
            </View>

            {saving && (
              <ActivityIndicator
                size="small"
                color={PRIMARY}
              />
            )}
          </View>

          <View style={styles.scheduleList}>
            {weeklySchedule.map((dayItem, index) => {
              const dayNumber = Number(dayItem.day);
              const dayName =
                DAY_NAMES[dayNumber] ||
                DAY_NAMES[index];

              return (
                <View
                  key={dayItem.day}
                  style={[
                    styles.dayRow,
                    {
                      borderBottomColor:
                        themeColors.border ||
                        '#E5E7EB',
                    },
                  ]}
                >
                  <View style={styles.dayAvatar}>
                    <Text
                      style={[
                        styles.dayAvatarText,
                        {
                          color: dayItem.is_available
                            ? PRIMARY
                            : '#9CA3AF',
                        },
                      ]}
                    >
                      {dayName.charAt(0)}
                    </Text>
                  </View>

                  <View style={styles.dayNameWrap}>
                    <Text
                      style={[
                        styles.dayName,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {dayName}
                    </Text>

                    {dayItem.is_available ? (
                      <TouchableOpacity
                        onPress={() =>
                          handleEditDayHours(dayItem)
                        }
                        activeOpacity={0.75}
                        style={styles.hoursTouchable}
                      >
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={PRIMARY}
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
                          {dayItem.start || '09:00'}
                          {' – '}
                          {dayItem.end || '18:00'}
                        </Text>

                        <Ionicons
                          name="pencil-outline"
                          size={13}
                          color={PRIMARY}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.closedWrap}>
                        <Ionicons
                          name="close-circle-outline"
                          size={14}
                          color={DANGER}
                        />

                        <Text style={styles.dayClosed}>
                          Fermé
                        </Text>
                      </View>
                    )}
                  </View>

                  <Switch
                    value={!!dayItem.is_available}
                    onValueChange={() =>
                      handleToggleDay(dayItem.day)
                    }
                    trackColor={{
                      false: '#D1D5DB',
                      true: PRIMARY,
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* DATES BLOQUÉES */}

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border || '#E5E7EB',
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Dates bloquées
              </Text>

              <Text
                style={[
                  styles.sectionSub,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Gérez vos périodes d'indisponibilité.
              </Text>
            </View>

            <AnimatedActionButton
              onPress={openBlockModal}
              style={styles.addButtonWrapper}
            >
              <View
                style={[
                  styles.addButton,
                  {
                    backgroundColor: PRIMARY,
                  },
                ]}
              >
                <Ionicons
                  name="add"
                  size={21}
                  color="#FFFFFF"
                />
              </View>
            </AnimatedActionButton>
          </View>

          {blockedDates.length === 0 ? (
            <View style={styles.emptyBlocked}>
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      themeColors.background ||
                      '#F8FAFC',
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={30}
                  color={
                    themeColors.textSecondary
                  }
                />
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Aucune date bloquée
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Ajoutez une période pendant laquelle
                vous ne serez pas disponible.
              </Text>
            </View>
          ) : (
            <View style={styles.blockedList}>
              {blockedDates.map((item, index) => {
                const itemId = getBlockedId(item);

                return (
                  <View
                    key={
                      itemId ??
                      `blocked-${index}`
                    }
                    style={[
                      styles.blockedRow,
                      {
                        borderBottomColor:
                          themeColors.border ||
                          '#E5E7EB',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.blockIcon,
                        {
                          backgroundColor:
                            `${DANGER}12`,
                        },
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={19}
                        color={DANGER}
                      />
                    </View>

                    <View style={styles.flex1}>
                      <Text
                        style={[
                          styles.blockedDates,
                          {
                            color:
                              themeColors.text,
                          },
                        ]}
                      >
                        {getBlockedStart(item)}
                        {' → '}
                        {getBlockedEnd(item)}
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

                      {item.is_all_day !== false && (
                        <View
                          style={[
                            styles.allDayBadge,
                            {
                              backgroundColor:
                                `${PRIMARY}12`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.allDayLabel,
                              {
                                color: PRIMARY,
                              },
                            ]}
                          >
                            Toute la journée
                          </Text>
                        </View>
                      )}
                    </View>

                    <AnimatedActionButton
                      onPress={() =>
                        handleDeleteBlockedDate(item)
                      }
                      style={styles.deleteButtonWrapper}
                    >
                      <View
                        style={[
                          styles.deleteButton,
                          {
                            backgroundColor:
                              `${DANGER}10`,
                          },
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={DANGER}
                        />
                      </View>
                    </AnimatedActionButton>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* MODAL AJOUT DATE BLOQUÉE */}

      <Modal
        visible={showBlockModal}
        transparent
        animationType="slide"
        onRequestClose={closeBlockModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  themeColors.surface || '#FFFFFF',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View
                  style={[
                    styles.modalIcon,
                    {
                      backgroundColor:
                        `${PRIMARY}18`,
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={21}
                    color={PRIMARY}
                  />
                </View>

                <View style={styles.flex1}>
                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        color: themeColors.text,
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
                onPress={closeBlockModal}
                hitSlop={{
                  top: 8,
                  bottom: 8,
                  left: 8,
                  right: 8,
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={28}
                  color={
                    themeColors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.modalScrollContent
              }
            >
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
                  min={formatLocalDate(new Date())}
                  themeColors={themeColors}
                  onChange={(value) =>
                    handleStartDateChange(
                      parseLocalDate(value)
                    )
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
                          '#D1D5DB',
                        backgroundColor:
                          themeColors.background ||
                          '#FFFFFF',
                      },
                    ]}
                    onPress={() =>
                      setShowStartPicker(true)
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={PRIMARY}
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
                      value={blockForm.start_date}
                      mode="date"
                      display="default"
                      minimumDate={startOfLocalDay()}
                      onChange={(event, selected) => {
                        setShowStartPicker(false);

                        if (selected) {
                          handleStartDateChange(
                            selected
                          );
                        }
                      }}
                    />
                  )}
                </>
              )}

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
                  themeColors={themeColors}
                  onChange={(value) =>
                    handleEndDateChange(
                      parseLocalDate(value)
                    )
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
                          '#D1D5DB',
                        backgroundColor:
                          themeColors.background ||
                          '#FFFFFF',
                      },
                    ]}
                    onPress={() =>
                      setShowEndPicker(true)
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={PRIMARY}
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
                      value={blockForm.end_date}
                      mode="date"
                      display="default"
                      minimumDate={blockForm.start_date}
                      onChange={(event, selected) => {
                        setShowEndPicker(false);

                        if (selected) {
                          handleEndDateChange(
                            selected
                          );
                        }
                      }}
                    />
                  )}
                </>
              )}

              <View
                style={[
                  styles.infoBox,
                  {
                    backgroundColor:
                      `${PRIMARY}10`,
                    borderColor:
                      `${PRIMARY}30`,
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={19}
                  color={PRIMARY}
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
                  La période sélectionnée sera
                  indisponible pour les nouvelles
                  réservations.
                </Text>
              </View>

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
                <Text style={styles.optionalText}>
                  {' '}
                  (optionnel)
                </Text>
              </Text>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: themeColors.text,
                    borderColor:
                      themeColors.border ||
                      '#D1D5DB',
                    backgroundColor:
                      themeColors.background ||
                      '#FFFFFF',
                  },
                ]}
                placeholder="Ex : Vacances, formation, congé..."
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={blockForm.reason}
                onChangeText={(value) =>
                  setBlockForm((previous) => ({
                    ...previous,
                    reason: value,
                  }))
                }
                maxLength={255}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <AnimatedActionButton
                  onPress={closeBlockModal}
                  disabled={blockSaving}
                  style={styles.actionFlex}
                >
                  <View
                    style={[
                      styles.modalBtn,
                      styles.cancelBtn,
                      {
                        borderColor:
                          themeColors.border ||
                          '#D1D5DB',
                      },
                    ]}
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
                  </View>
                </AnimatedActionButton>

                <AnimatedActionButton
                  onPress={handleAddBlockedDate}
                  disabled={blockSaving}
                  style={styles.actionFlex}
                >
                  <View
                    style={[
                      styles.modalBtn,
                      {
                        backgroundColor: PRIMARY,
                      },
                    ]}
                  >
                    {blockSaving ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color="#FFFFFF"
                        />

                        <Text style={styles.confirmBtnText}>
                          Bloquer la date
                        </Text>
                      </>
                    )}
                  </View>
                </AnimatedActionButton>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL MODIFICATION DES HORAIRES */}

      <Modal
        visible={showEditDayModal}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  themeColors.surface || '#FFFFFF',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View
                  style={[
                    styles.modalIcon,
                    {
                      backgroundColor:
                        `${PRIMARY}18`,
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={21}
                    color={PRIMARY}
                  />
                </View>

                <View style={styles.flex1}>
                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        color: themeColors.text,
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
                      ? DAY_NAMES[editingDay.day]
                      : 'Planning'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={closeEditModal}
                hitSlop={{
                  top: 8,
                  bottom: 8,
                  left: 8,
                  right: 8,
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={28}
                  color={
                    themeColors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.modalScrollContent
              }
            >
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
                  value={formatDateToTime(editStartTime)}
                  themeColors={themeColors}
                  onChange={(value) =>
                    setEditStartTime(
                      parseTimeToDate(value)
                    )
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
                          '#D1D5DB',
                        backgroundColor:
                          themeColors.background ||
                          '#FFFFFF',
                      },
                    ]}
                    onPress={() =>
                      setShowEditStartPicker(true)
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={PRIMARY}
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
                      {formatDateToTime(editStartTime)}
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
                      value={editStartTime}
                      mode="time"
                      is24Hour
                      display="default"
                      onChange={(event, selected) => {
                        setShowEditStartPicker(false);

                        if (selected) {
                          setEditStartTime(selected);
                        }
                      }}
                    />
                  )}
                </>
              )}

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
                  value={formatDateToTime(editEndTime)}
                  min={formatDateToTime(editStartTime)}
                  themeColors={themeColors}
                  onChange={(value) =>
                    setEditEndTime(
                      parseTimeToDate(value)
                    )
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
                          '#D1D5DB',
                        backgroundColor:
                          themeColors.background ||
                          '#FFFFFF',
                      },
                    ]}
                    onPress={() =>
                      setShowEditEndPicker(true)
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={PRIMARY}
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
                      {formatDateToTime(editEndTime)}
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
                      value={editEndTime}
                      mode="time"
                      is24Hour
                      display="default"
                      onChange={(event, selected) => {
                        setShowEditEndPicker(false);

                        if (selected) {
                          setEditEndTime(selected);
                        }
                      }}
                    />
                  )}
                </>
              )}

              <View
                style={[
                  styles.schedulePreview,
                  {
                    backgroundColor:
                      `${PRIMARY}10`,
                    borderColor:
                      `${PRIMARY}30`,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color={PRIMARY}
                />

                <View style={styles.previewTextWrap}>
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
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {formatDateToTime(editStartTime)}
                    {' → '}
                    {formatDateToTime(editEndTime)}
                  </Text>
                </View>
              </View>

              {timeToMinutes(
                formatDateToTime(editEndTime)
              ) <=
                timeToMinutes(
                  formatDateToTime(editStartTime)
                ) && (
                <View style={styles.warningBox}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={DANGER}
                  />

                  <Text style={styles.warningText}>
                    L'heure de fin doit être après
                    l'heure de début.
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <AnimatedActionButton
                  onPress={closeEditModal}
                  disabled={editDaySaving}
                  style={styles.actionFlex}
                >
                  <View
                    style={[
                      styles.modalBtn,
                      styles.cancelBtn,
                      {
                        borderColor:
                          themeColors.border ||
                          '#D1D5DB',
                      },
                    ]}
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
                  </View>
                </AnimatedActionButton>

                <AnimatedActionButton
                  onPress={handleConfirmEditDayHours}
                  disabled={editDaySaving}
                  style={styles.actionFlex}
                >
                  <View
                    style={[
                      styles.modalBtn,
                      {
                        backgroundColor: PRIMARY,
                      },
                    ]}
                  >
                    {editDaySaving ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="save-outline"
                          size={17}
                          color="#FFFFFF"
                        />

                        <Text style={styles.confirmBtnText}>
                          Enregistrer
                        </Text>
                      </>
                    )}
                  </View>
                </AnimatedActionButton>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL CONFIRMATION SUPPRESSION */}

      <ConfirmDeleteModal
        visible={!!deleteTarget}
        item={deleteTarget}
        loading={deleteSaving}
        onCancel={cancelDeleteBlockedDate}
        onConfirm={confirmDeleteBlockedDate}
        themeColors={themeColors}
      />
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
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
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },

  toastWrapper: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 45,
    left: 12,
    right: 12,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
  },

  toastContainer: {
    width: '100%',
    maxWidth: 520,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    paddingHorizontal: 13,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },

  toastIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  toastTextWrap: {
    flex: 1,
    paddingRight: 8,
  },

  toastTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },

  toastMessage: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.045,
    shadowRadius: 7,
    elevation: 2,
  },

  cardTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  roundIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  flex1: {
    flex: 1,
    minWidth: 0,
  },

  cardTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: 3,
  },

  cardSub: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 19,
  },

  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 13,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },

  statusPillText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },

  sectionSub: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
    fontFamily: typography.fontFamily.regular,
  },

  scheduleList: {
    marginTop: 4,
  },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },

  dayAvatar: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  dayAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },

  dayNameWrap: {
    flex: 1,
    minWidth: 0,
  },

  dayName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: 3,
  },

  hoursTouchable: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },

  dayHours: {
    fontSize: 12,
    marginHorizontal: 5,
    fontFamily: typography.fontFamily.regular,
  },

  closedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dayClosed: {
    fontSize: 12,
    color: DANGER,
    marginLeft: 4,
    fontFamily: typography.fontFamily.medium,
  },

  addButtonWrapper: {
    borderRadius: 15,
  },

  addButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBlocked: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 25,
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
  },

  emptyText: {
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    fontFamily: typography.fontFamily.regular,
  },

  blockedList: {
    marginTop: 5,
  },

  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },

  blockIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  blockedDates: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
  },

  blockedReason: {
    fontSize: 12,
    marginTop: 3,
    fontFamily: typography.fontFamily.regular,
  },

  allDayBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 5,
  },

  allDayLabel: {
    fontSize: 10,
    fontFamily: typography.fontFamily.semiBold,
  },

  deleteButtonWrapper: {
    marginLeft: 8,
    borderRadius: 13,
  },

  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + 10,
  },

  modalScrollContent: {
    paddingBottom: spacing.md,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  modalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  modalIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },

  modalSubtitle: {
    fontSize: 12,
    marginTop: 3,
    fontFamily: typography.fontFamily.regular,
  },

  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 7,
    marginTop: spacing.sm,
  },

  optionalText: {
    fontSize: 11,
    opacity: 0.7,
    fontFamily: typography.fontFamily.regular,
  },

  dateButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  dateButtonText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    marginLeft: 9,
    fontFamily: typography.fontFamily.medium,
  },

  textInput: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 13,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 8,
    fontFamily: typography.fontFamily.regular,
  },

  schedulePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  previewTextWrap: {
    marginLeft: spacing.sm,
    flex: 1,
  },

  previewLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
  },

  previewValue: {
    fontSize: 18,
    marginTop: 3,
    fontFamily: typography.fontFamily.bold,
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${DANGER}12`,
    borderWidth: 1,
    borderColor: `${DANGER}40`,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },

  warningText: {
    flex: 1,
    fontSize: 12,
    color: DANGER,
    marginLeft: 8,
    fontFamily: typography.fontFamily.medium,
  },

  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  actionFlex: {
    flex: 1,
  },

  modalBtn: {
    minHeight: 48,
    paddingVertical: spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },

  cancelBtnText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },

  confirmBtnText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  confirmModal: {
    width: '100%',
    maxWidth: 470,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },

  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  confirmTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },

  confirmMessage: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },

  confirmDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginTop: 18,
  },

  confirmDateText: {
    flex: 1,
    marginLeft: 10,
  },

  confirmDate: {
    fontSize: 13,
    fontWeight: '700',
  },

  confirmReason: {
    fontSize: 12,
    marginTop: 4,
  },

  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },

  confirmButton: {
    minHeight: 47,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  confirmCancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },

  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },

  confirmDeleteButton: {
    backgroundColor: DANGER,
  },

  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AvailabilityScreen;