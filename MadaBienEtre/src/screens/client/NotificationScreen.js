// src/screens/client/NotificationScreen.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  Switch,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import Header from '../../components/common/Header';

// ============================================================
// CONSTANTS
// ============================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const IS_WEB = Platform.OS === 'web';

const TOAST_DURATION = 2600;

// ============================================================
// TOAST COMPONENT
// ============================================================

const Toast = ({
  visible,
  type = 'success',
  title,
  message,
  onHide,
}) => {
  const translateY = useRef(
    new Animated.Value(-30)
  ).current;

  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  const progress = useRef(
    new Animated.Value(1)
  ).current;

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(-30);
    opacity.setValue(0);
    progress.setValue(1);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 9,
      }),

      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -20,
          duration: 180,
          useNativeDriver: true,
        }),

        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onHide?.();
        }
      });
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [
    visible,
    translateY,
    opacity,
    progress,
    onHide,
  ]);

  if (!visible) {
    return null;
  }

  const toastConfig = {
    success: {
      icon: 'checkmark-circle',
      iconColor: '#00C853',
      background: '#E8F5E9',
      titleColor: '#1B5E20',
    },

    error: {
      icon: 'close-circle',
      iconColor: '#E53935',
      background: '#FFEBEE',
      titleColor: '#B71C1C',
    },

    info: {
      icon: 'information-circle',
      iconColor: '#2196F3',
      background: '#E3F2FD',
      titleColor: '#0D47A1',
    },

    warning: {
      icon: 'warning',
      iconColor: '#FF9800',
      background: '#FFF3E0',
      titleColor: '#E65100',
    },
  };

  const config =
    toastConfig[type] || toastConfig.success;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrapper,
        {
          opacity,
          transform: [
            {
              translateY,
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor:
              config.background,
          },
        ]}
      >
        <View
          style={[
            styles.toastIconContainer,
            {
              backgroundColor:
                `${config.iconColor}18`,
            },
          ]}
        >
          <Ionicons
            name={config.icon}
            size={23}
            color={config.iconColor}
          />
        </View>

        <View style={styles.toastContent}>
          {!!title && (
            <Text
              style={[
                styles.toastTitle,
                {
                  color:
                    config.titleColor,
                },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          )}

          {!!message && (
            <Text
              style={[
                styles.toastMessage,
                {
                  color:
                    config.titleColor,
                },
              ]}
              numberOfLines={2}
            >
              {message}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.toastClose}
          activeOpacity={0.7}
          onPress={onHide}
        >
          <Ionicons
            name="close"
            size={18}
            color={config.titleColor}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ============================================================
// COMPONENT
// ============================================================

const NotificationScreen = ({
  navigation,
}) => {
  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const notificationContext =
    useNotifications?.() || {};

  const {
    notification,
    expoPushToken,
    isPushEnabled,
    sendLocalNotification,
    cancelAllNotifications,
  } = notificationContext;

  // ==========================================================
  // STATES
  // ==========================================================

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    activeFilter,
    setActiveFilter,
  ] = useState('all');

  const [
    pushEnabled,
    setPushEnabled,
  ] = useState(
    Boolean(isPushEnabled)
  );

  const [
    toast,
    setToast,
  ] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // ==========================================================
  // MOCK DATA
  // ==========================================================

  useEffect(() => {
    const mockNotifications = [
      {
        id: 1,
        title: 'Nouvelle offre reçue',
        body:
          'Sarah B. a proposé 75 000 Ar pour votre massage.',
        type: 'booking',
        date: '2024-01-15T10:30:00',
        read: false,
      },

      {
        id: 2,
        title: 'Massage confirmé',
        body:
          'Votre massage avec Jean R. est confirmé pour demain à 14h.',
        type: 'booking',
        date: '2024-01-14T08:00:00',
        read: true,
      },

      {
        id: 3,
        title: 'Alerte SOS',
        body:
          'Un SOS a été déclenché par un utilisateur à proximité.',
        type: 'sos',
        date: '2024-01-13T22:15:00',
        read: false,
      },

      {
        id: 4,
        title: 'Promotion -20%',
        body:
          "Offre spéciale massage relaxant jusqu'à la fin du mois.",
        type: 'promo',
        date: '2024-01-12T09:00:00',
        read: true,
      },
    ];

    setNotifications(
      mockNotifications
    );
  }, []);

  // ==========================================================
  // SYNC PUSH STATE
  // ==========================================================

  useEffect(() => {
    if (
      typeof isPushEnabled ===
      'boolean'
    ) {
      setPushEnabled(
        isPushEnabled
      );
    }
  }, [isPushEnabled]);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback(
    ({
      type = 'success',
      title = '',
      message = '',
    }) => {
      setToast({
        visible: true,
        type,
        title,
        message,
      });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((previous) => ({
      ...previous,
      visible: false,
    }));
  }, []);

  // ==========================================================
  // FILTERS
  // ==========================================================

  const filters = useMemo(
    () => [
      {
        id: 'all',
        label: 'Toutes',
        icon: 'apps-outline',
      },

      {
        id: 'booking',
        label: 'Réservations',
        icon: 'calendar-outline',
      },

      {
        id: 'sos',
        label: 'SOS',
        icon: 'alert-circle-outline',
      },

      {
        id: 'promo',
        label: 'Promotions',
        icon: 'pricetag-outline',
      },
    ],
    []
  );

  // ==========================================================
  // FILTERED NOTIFICATIONS
  // ==========================================================

  const filteredNotifications =
    useMemo(() => {
      if (
        activeFilter === 'all'
      ) {
        return notifications;
      }

      return notifications.filter(
        (item) =>
          item.type ===
          activeFilter
      );
    }, [
      notifications,
      activeFilter,
    ]);

  // ==========================================================
  // UNREAD COUNT
  // ==========================================================

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (item) => !item.read
      ).length,
    [notifications]
  );

  // ==========================================================
  // FILTER ACTION
  // ==========================================================

  const handleFilterPress = (
    filterId
  ) => {
    if (
      activeFilter === filterId
    ) {
      return;
    }

    setActiveFilter(filterId);

    const selected =
      filters.find(
        (item) =>
          item.id === filterId
      );

    showToast({
      type: 'info',
      title: 'Filtre appliqué',
      message:
        selected?.label ||
        'Notifications filtrées',
    });
  };

  // ==========================================================
  // GET ICON
  // ==========================================================

  const getIconForType = (
    type
  ) => {
    switch (type) {
      case 'booking':
        return 'calendar';

      case 'sos':
        return 'alert-circle';

      case 'promo':
        return 'pricetag';

      default:
        return 'notifications';
    }
  };

  // ==========================================================
  // GET COLOR
  // ==========================================================

  const getColorForType = (
    type
  ) => {
    switch (type) {
      case 'booking':
        return '#2196F3';

      case 'sos':
        return '#E53935';

      case 'promo':
        return '#FF6F00';

      default:
        return colors.primary;
    }
  };

  // ==========================================================
  // GET TYPE LABEL
  // ==========================================================

  const getTypeLabel = (
    type
  ) => {
    switch (type) {
      case 'booking':
        return 'Réservation';

      case 'sos':
        return 'SOS';

      case 'promo':
        return 'Promotion';

      default:
        return 'Notification';
    }
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatNotificationDate =
    (date) => {
      try {
        return new Date(
          date
        ).toLocaleDateString(
          'fr-FR',
          {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }
        );
      } catch {
        return '';
      }
    };

  // ==========================================================
  // MARK AS READ
  // ==========================================================

  const handleNotificationPress =
    (item) => {
      if (!item.read) {
        setNotifications(
          (previous) =>
            previous.map(
              (notificationItem) =>
                notificationItem.id ===
                item.id
                  ? {
                      ...notificationItem,
                      read: true,
                    }
                  : notificationItem
            )
        );

        showToast({
          type: 'success',
          title: 'Notification lue',
          message:
            'La notification a été marquée comme lue.',
        });

        return;
      }

      showToast({
        type: 'info',
        title: 'Notification',
        message:
          'Cette notification est déjà lue.',
      });
    };

  // ==========================================================
  // MARK ALL AS READ
  // ==========================================================

  const handleMarkAllAsRead =
    () => {
      if (unreadCount === 0) {
        showToast({
          type: 'info',
          title: 'Tout est à jour',
          message:
            'Aucune notification non lue.',
        });

        return;
      }

      setNotifications(
        (previous) =>
          previous.map(
            (item) => ({
              ...item,
              read: true,
            })
          )
      );

      showToast({
        type: 'success',
        title: 'Notifications lues',
        message: `${unreadCount} notification${
          unreadCount > 1
            ? 's ont'
            : ' a'
        } été marquée${
          unreadCount > 1
            ? 's'
            : ''
        } comme lue${
          unreadCount > 1
            ? 's'
            : ''
        }.`,
      });
    };

  // ==========================================================
  // PUSH TOGGLE
  // ==========================================================

  const handlePushToggle =
    async (value) => {
      setPushEnabled(value);

      try {
        if (!value) {
          if (
            typeof cancelAllNotifications ===
            'function'
          ) {
            await cancelAllNotifications();
          }

          showToast({
            type: 'warning',
            title:
              'Notifications désactivées',
            message:
              'Les notifications locales ont été désactivées.',
          });

          return;
        }

        // ----------------------------------------------------
        // Si la fonction existe, on envoie une notification
        // locale de test.
        // ----------------------------------------------------

        if (
          typeof sendLocalNotification ===
          'function'
        ) {
          await sendLocalNotification({
            title:
              'Notifications activées',
            body:
              'Les notifications sont maintenant actives.',
          });
        }

        showToast({
          type: 'success',
          title:
            'Notifications activées',
          message:
            'Vous recevrez les alertes importantes.',
        });
      } catch (error) {
        console.error(
          'Push notification error:',
          error
        );

        setPushEnabled(
          !value
        );

        showToast({
          type: 'error',
          title:
            'Action impossible',
          message:
            "Impossible de modifier les notifications.",
        });
      }
    };

  // ==========================================================
  // RENDER NOTIFICATION
  // ==========================================================

  const renderNotification =
    ({ item }) => {
      const typeColor =
        getColorForType(
          item.type
        );

      return (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() =>
            handleNotificationPress(
              item
            )
          }
          style={[
            styles.notificationCard,
            {
              backgroundColor:
                themeColors.surface,

              borderColor:
                item.read
                  ? themeColors.border ||
                    '#E5E7EB'
                  : `${typeColor}55`,

              borderLeftColor:
                typeColor,
            },

            !item.read &&
              styles.notificationCardUnread,
          ]}
        >
          {/* ICON */}

          <View
            style={[
              styles.notificationIcon,
              {
                backgroundColor:
                  `${typeColor}15`,
              },
            ]}
          >
            <Ionicons
              name={getIconForType(
                item.type
              )}
              size={23}
              color={typeColor}
            />
          </View>

          {/* CONTENT */}

          <View
            style={
              styles.notificationContent
            }
          >
            {/* TOP ROW */}

            <View
              style={
                styles.notificationTopRow
              }
            >
              <View
                style={
                  styles.notificationTitleRow
                }
              >
                <Text
                  style={[
                    styles.notificationTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                {!item.read && (
                  <View
                    style={[
                      styles.unreadDot,
                      {
                        backgroundColor:
                          typeColor,
                      },
                    ]}
                  />
                )}
              </View>
            </View>

            {/* TYPE */}

            <View
              style={
                styles.notificationMetaRow
              }
            >
              <View
                style={[
                  styles.typeBadge,
                  {
                    backgroundColor:
                      `${typeColor}12`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    {
                      color:
                        typeColor,
                    },
                  ]}
                >
                  {getTypeLabel(
                    item.type
                  )}
                </Text>
              </View>

              <Text
                style={[
                  styles.notificationDate,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                {formatNotificationDate(
                  item.date
                )}
              </Text>
            </View>

            {/* BODY */}

            <Text
              style={[
                styles.notificationBody,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {item.body}
            </Text>
          </View>

          {/* CHEVRON */}

          <View
            style={
              styles.notificationChevron
            }
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                themeColors.textSecondary
              }
            />
          </View>
        </TouchableOpacity>
      );
    };

  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  const renderEmpty =
    () => (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor:
              themeColors.surface,
          },
        ]}
      >
        <View
          style={[
            styles.emptyIconContainer,
            {
              backgroundColor:
                `${colors.primary}12`,
            },
          ]}
        >
          <Ionicons
            name="notifications-off-outline"
            size={42}
            color={colors.primary}
          />
        </View>

        <Text
          style={[
            styles.emptyTitle,
            {
              color:
                themeColors.text,
            },
          ]}
        >
          Aucune notification
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
          Vous n'avez aucune notification
          dans cette catégorie pour le
          moment.
        </Text>
      </View>
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          themeColors.background
        }
      />

      {/* =====================================================
          TOAST
      ====================================================== */}

      <Toast
        visible={toast.visible}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onHide={hideToast}
      />

      {/* =====================================================
          HEADER
      ====================================================== */}

      <Header
        title="Notifications"
        showBack
      />

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <View
        style={[
          styles.pageHeader,
          {
            borderBottomColor:
              themeColors.border ||
              '#E5E7EB',
          },
        ]}
      >
        <View style={styles.pageHeaderLeft}>
          <View
            style={[
              styles.pageHeaderIcon,
              {
                backgroundColor:
                  `${colors.primary}12`,
              },
            ]}
          >
            <Ionicons
              name="notifications"
              size={25}
              color={colors.primary}
            />

            {unreadCount > 0 && (
              <View
                style={[
                  styles.headerBadge,
                  {
                    backgroundColor:
                      '#E53935',
                  },
                ]}
              >
                <Text
                  style={
                    styles.headerBadgeText
                  }
                >
                  {unreadCount > 9
                    ? '9+'
                    : unreadCount}
                </Text>
              </View>
            )}
          </View>

          <View>
            <Text
              style={[
                styles.pageTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Centre de notifications
            </Text>

            <Text
              style={[
                styles.pageSubtitle,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Restez informé de vos activités
            </Text>
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={
              handleMarkAllAsRead
            }
            style={[
              styles.markAllButton,
              {
                backgroundColor:
                  `${colors.primary}10`,
              },
            ]}
          >
            <Ionicons
              name="checkmark-done"
              size={18}
              color={colors.primary}
            />

            <Text
              style={[
                styles.markAllText,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              Tout lire
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <View
        style={styles.filtersWrapper}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filtersContainer
          }
        >
          {filters.map(
            (filter) => {
              const active =
                activeFilter ===
                filter.id;

              return (
                <TouchableOpacity
                  key={filter.id}
                  activeOpacity={0.8}
                  onPress={() =>
                    handleFilterPress(
                      filter.id
                    )
                  }
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor:
                        active
                          ? colors.primary
                          : themeColors.surface,

                      borderColor:
                        active
                          ? colors.primary
                          : themeColors.border ||
                            '#E5E7EB',
                    },
                  ]}
                >
                  <Ionicons
                    name={filter.icon}
                    size={17}
                    color={
                      active
                        ? '#fff'
                        : themeColors
                            .textSecondary
                    }
                  />

                  <Text
                    style={[
                      styles.filterText,
                      {
                        color: active
                          ? '#fff'
                          : themeColors.text,
                      },
                    ]}
                  >
                    {filter.label}
                  </Text>

                  {filter.id ===
                    'all' &&
                    unreadCount >
                      0 && (
                      <View
                        style={[
                          styles.filterBadge,
                          {
                            backgroundColor:
                              active
                                ? 'rgba(255,255,255,0.22)'
                                : `${colors.primary}12`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterBadgeText,
                            {
                              color:
                                active
                                  ? '#fff'
                                  : colors.primary,
                            },
                          ]}
                        >
                          {unreadCount}
                        </Text>
                      </View>
                    )}
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      {/* =====================================================
          PUSH NOTIFICATIONS
      ====================================================== */}

      <View
        style={[
          styles.pushCard,
          {
            backgroundColor:
              themeColors.surface,
            borderColor:
              themeColors.border ||
              '#E5E7EB',
          },
        ]}
      >
        <View
          style={styles.pushLeft}
        >
          <View
            style={[
              styles.pushIconContainer,
              {
                backgroundColor:
                  pushEnabled
                    ? `${colors.primary}12`
                    : `${themeColors.textSecondary}12`,
              },
            ]}
          >
            <Ionicons
              name={
                pushEnabled
                  ? 'notifications'
                  : 'notifications-off-outline'
              }
              size={22}
              color={
                pushEnabled
                  ? colors.primary
                  : themeColors.textSecondary
              }
            />
          </View>

          <View
            style={styles.pushTextContainer}
          >
            <Text
              style={[
                styles.pushTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Notifications push
            </Text>

            <Text
              style={[
                styles.pushSubtitle,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {pushEnabled
                ? 'Les alertes sont activées'
                : 'Les alertes sont désactivées'}
            </Text>
          </View>
        </View>

        <Switch
          value={pushEnabled}
          onValueChange={
            handlePushToggle
          }
          trackColor={{
            false: isDark
              ? '#4B5563'
              : '#D1D5DB',

            true: colors.primary,
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={
            isDark
              ? '#4B5563'
              : '#D1D5DB'
          }
        />
      </View>

      {/* =====================================================
          NOTIFICATION LIST
      ====================================================== */}

      <FlatList
        data={filteredNotifications}
        renderItem={
          renderNotification
        }
        keyExtractor={(item) =>
          item.id.toString()
        }
        contentContainerStyle={[
          styles.listContent,

          filteredNotifications.length ===
            0 &&
            styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          filteredNotifications.length >
          0 ? (
            <View
              style={
                styles.listHeader
              }
            >
              <Text
                style={[
                  styles.listHeaderTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                {activeFilter ===
                'all'
                  ? 'Toutes les notifications'
                  : filters.find(
                      (item) =>
                        item.id ===
                        activeFilter
                    )?.label}
              </Text>

              <Text
                style={[
                  styles.listHeaderCount,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                {filteredNotifications.length}{' '}
                notification
                {filteredNotifications.length >
                1
                  ? 's'
                  : ''}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          renderEmpty
        }
      />
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  // ==========================================================
  // CONTAINER
  // ==========================================================

  container: {
    flex: 1,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastWrapper: {
    position: 'absolute',
    top:
      Platform.OS === 'ios'
        ? 58
        : 18,

    left: 0,
    right: 0,

    alignItems: 'center',

    zIndex: 9999,
    elevation: 9999,

    ...(IS_WEB
      ? {
          pointerEvents:
            'box-none',
        }
      : {}),
  },

  toast: {
    width:
      IS_WEB
        ? Math.min(
            460,
            SCREEN_WIDTH - 32
          )
        : SCREEN_WIDTH - 32,

    minHeight: 66,

    borderRadius: 17,

    paddingHorizontal: 12,
    paddingVertical: 10,

    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 14,

    elevation: 12,

    borderWidth: 1,
    borderColor:
      'rgba(0,0,0,0.04)',
  },

  toastIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  toastContent: {
    flex: 1,
    paddingRight: 6,
  },

  toastTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.semiBold,
    marginBottom: 2,
  },

  toastMessage: {
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.regular,
  },

  toastClose: {
    width: 30,
    height: 30,
    borderRadius: 15,

    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==========================================================
  // PAGE HEADER
  // ==========================================================

  pageHeader: {
    paddingHorizontal:
      spacing.md,
    paddingVertical: 13,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',

    borderBottomWidth: 1,
  },

  pageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  pageHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,

    position: 'relative',
  },

  headerBadge: {
    position: 'absolute',

    top: -5,
    right: -5,

    minWidth: 19,
    height: 19,

    paddingHorizontal: 4,

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#fff',
  },

  headerBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  pageTitle: {
    fontSize:
      typography.fontSize.md,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  pageSubtitle: {
    fontSize:
      typography.fontSize.xs,
    fontFamily:
      typography.fontFamily.regular,
    marginTop: 2,
  },

  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 10,
    paddingVertical: 8,

    borderRadius: 10,

    gap: 5,
  },

  markAllText: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  // ==========================================================
  // FILTERS
  // ==========================================================

  filtersWrapper: {
    width: '100%',
  },

  filtersContainer: {
    paddingHorizontal:
      spacing.md,

    paddingTop: 12,
    paddingBottom: 8,

    gap: 8,
  },

  filterButton: {
    minHeight: 40,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 13,

    borderRadius: 13,

    borderWidth: 1,

    gap: 6,
  },

  filterText: {
    fontSize: 12.5,
    fontFamily:
      typography.fontFamily.medium,
  },

  filterBadge: {
    minWidth: 20,
    height: 20,

    paddingHorizontal: 5,

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',
  },

  filterBadgeText: {
    fontSize: 10,
    fontFamily:
      typography.fontFamily.bold,
  },

  // ==========================================================
  // PUSH CARD
  // ==========================================================

  pushCard: {
    marginHorizontal:
      spacing.md,

    marginTop: 4,
    marginBottom: 8,

    minHeight: 68,

    paddingHorizontal: 12,
    paddingVertical: 10,

    borderRadius: 17,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',

    borderWidth: 1,
  },

  pushLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  pushIconContainer: {
    width: 43,
    height: 43,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  pushTextContainer: {
    flex: 1,
  },

  pushTitle: {
    fontSize: 13.5,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  pushSubtitle: {
    fontSize: 11.5,
    fontFamily:
      typography.fontFamily.regular,
    marginTop: 2,
  },

  // ==========================================================
  // LIST
  // ==========================================================

  listContent: {
    paddingHorizontal:
      spacing.md,

    paddingTop: 4,
    paddingBottom: 110,
  },

  listContentEmpty: {
    flexGrow: 1,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',

    marginTop: 7,
    marginBottom: 9,
  },

  listHeaderTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  listHeaderCount: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.regular,
  },

  // ==========================================================
  // NOTIFICATION CARD
  // ==========================================================

  notificationCard: {
    flexDirection: 'row',

    padding: 13,

    minHeight: 96,

    borderRadius: 17,

    marginBottom: 9,

    borderWidth: 1,
    borderLeftWidth: 4,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 5,

    elevation: 1,
  },

  notificationCardUnread: {
    shadowOpacity: 0.07,
    elevation: 2,
  },

  notificationIcon: {
    width: 45,
    height: 45,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  notificationContent: {
    flex: 1,
    minWidth: 0,
  },

  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',

    flex: 1,
  },

  notificationTitle: {
    flex: 1,

    fontSize: 13.5,

    lineHeight: 19,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  unreadDot: {
    width: 8,
    height: 8,

    borderRadius: 4,

    marginLeft: 7,
  },

  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 5,
    marginBottom: 4,
  },

  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,

    borderRadius: 7,

    marginRight: 7,
  },

  typeBadgeText: {
    fontSize: 9.5,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  notificationDate: {
    fontSize: 9.5,

    fontFamily:
      typography.fontFamily.regular,
  },

  notificationBody: {
    fontSize: 11.5,

    lineHeight: 17,

    fontFamily:
      typography.fontFamily.regular,
  },

  notificationChevron: {
    width: 22,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,
  },

  // ==========================================================
  // EMPTY
  // ==========================================================

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 30,
    paddingVertical: 45,

    borderRadius: 20,

    marginTop: 12,
  },

  emptyIconContainer: {
    width: 82,
    height: 82,

    borderRadius: 28,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 16,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  emptyText: {
    fontSize: 12,

    lineHeight: 18,

    textAlign: 'center',

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 7,

    maxWidth: 290,
  },
});

export default NotificationScreen;