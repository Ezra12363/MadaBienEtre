// src/screens/client/HomeScreen.js
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Animated,
  RefreshControl,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import massageTypeService from '../../services/massageTypeService';
import { getMassageTypeIconMCI } from '../../constants/massageTypeIcons';

const { width } = Dimensions.get('window');

const IS_WEB = Platform.OS === 'web';
const TABLET_BREAKPOINT = 768;

/* ============================================================
   COLORS
============================================================ */

const PRIMARY = colors.primary || '#0D2B7E';
const SECONDARY = colors.secondary || '#1A4FB5';
const SUCCESS = '#00C853';
const DANGER = colors.error || '#E53935';
const WARNING = '#FF9800';
const INFO = '#2196F3';
const ORANGE = '#FF7A00';

/* ============================================================
   MASSAGE TYPES — chargés depuis l'API
============================================================ */

const MASSAGE_CATEGORY_LABELS = {
  relaxant: 'Relaxant',
  therapeutique: 'Thérapeutique',
  sportif: 'Sportif',
  reflexologie: 'Réflexologie',
  prenatal: 'Prénatal',
  personnalise: 'Personnalisé',
};

const getMassageCategoryLabel = (category) =>
  MASSAGE_CATEGORY_LABELS[String(category || '').toLowerCase()] ||
  category ||
  'Massage';

const MASSAGE_TYPE_FALLBACK_ICONS = {
  relaxant: 'spa',
  therapeutique: 'bone',
  sportif: 'run',
  reflexologie: 'foot-print',
  prenatal: 'human-pregnant',
  personnalise: 'auto-fix',
};

const getMassageTypeFallbackIcon = (category) =>
  MASSAGE_TYPE_FALLBACK_ICONS[category] || 'spa';

/* ============================================================
   PROMOTIONS
============================================================ */

const PROMOTIONS = [
  {
    id: 1,
    title: 'Massage Relaxant',
    description: 'Profitez d\'une séance bien-être à prix réduit.',
    discount: 20,
    endDate: '31 août',
    icon: 'spa',
  },
  {
    id: 2,
    title: 'Massage Sportif',
    description: 'Préparez votre corps ou récupérez après l\'effort.',
    discount: 15,
    endDate: '15 sept.',
    icon: 'run',
  },
  {
    id: 3,
    title: 'Pierres Chaudes',
    description: 'Une expérience chaleureuse pour une détente totale.',
    discount: 10,
    endDate: '30 sept.',
    icon: 'fire',
  },
];

/* ============================================================
   BOOKINGS
============================================================ */

const BOOKINGS = [
  {
    id: 1,
    status: 'pending',
    statusLabel: 'En attente',
    type: 'Massage Relaxant',
    date: '15 août 2026',
    time: '14:00',
    price: '35 000 Ar',
    therapist: 'Sarah B.',
  },
  {
    id: 2,
    status: 'confirmed',
    statusLabel: 'Confirmé',
    type: 'Massage Thérapeutique',
    date: '16 août 2026',
    time: '16:30',
    price: '45 000 Ar',
    therapist: 'Jean R.',
  },
];

/* ============================================================
   QUICK ACTIONS
============================================================ */

const QUICK_ACTIONS = [
  {
    id: 'search',
    icon: 'search-outline',
    label: 'Chercher',
    description: 'Trouver un massage',
    color: PRIMARY,
    bg: '#E8EEFF',
    screen: 'SearchMassage',
    toast: 'Recherche de massages',
  },
  {
    id: 'booking',
    icon: 'calendar-outline',
    label: 'Réserver',
    description: 'Nouvelle réservation',
    color: SECONDARY,
    bg: '#E8F1FF',
    screen: 'BookingScreen',
    toast: 'Ouverture des réservations',
  },
  {
    id: 'offers',
    icon: 'pricetag-outline',
    label: 'Mes offres',
    description: 'Voir les propositions',
    color: ORANGE,
    bg: '#FFF3E0',
    screen: 'Réservations',
    toast: 'Consultation de vos offres',
  },
  {
    id: 'sos',
    icon: 'alert-circle-outline',
    label: 'SOS',
    description: 'Assistance urgente',
    color: DANGER,
    bg: '#FFEBEE',
    screen: 'SOS',
    toast: 'Ouverture de l\'assistance SOS',
    type: 'warning',
  },
];

/* ============================================================
   TOAST COMPONENT
============================================================ */

const Toast = ({ visible, message, type = 'info', onHide, isDark }) => {
  const translateY = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 75,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -90,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity, scale]);

  const config = {
    success: {
      icon: 'checkmark-circle',
      color: SUCCESS,
      lightBg: '#EAF9F0',
      darkBg: '#173526',
    },
    error: {
      icon: 'close-circle',
      color: DANGER,
      lightBg: '#FFF0F1',
      darkBg: '#3A2023',
    },
    warning: {
      icon: 'warning',
      color: WARNING,
      lightBg: '#FFF6E8',
      darkBg: '#3B2C17',
    },
    info: {
      icon: 'information-circle',
      color: INFO,
      lightBg: '#EAF4FF',
      darkBg: '#182D43',
    },
  }[type] || {
    icon: 'information-circle',
    color: INFO,
    lightBg: '#EAF4FF',
    darkBg: '#182D43',
  };

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastContainer,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onHide}
        style={[
          styles.toast,
          {
            backgroundColor: isDark ? config.darkBg : config.lightBg,
            borderColor: `${config.color}35`,
          },
        ]}
      >
        <View
          style={[
            styles.toastIcon,
            {
              backgroundColor: `${config.color}18`,
            },
          ]}
        >
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.toastContent}>
          <Text
            numberOfLines={2}
            style={[
              styles.toastMessage,
              {
                color: isDark ? '#FFFFFF' : '#20242C',
              },
            ]}
          >
            {message}
          </Text>
          <Text
            style={[
              styles.toastHint,
              {
                color: isDark ? '#AEB5C2' : '#777E8A',
              },
            ]}
          >
            Appuyez pour fermer
          </Text>
        </View>
        <Ionicons name="close" size={17} color={isDark ? '#AEB5C2' : '#777E8A'} />
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ============================================================
   IMAGE RÉELLE D'UN TYPE DE MASSAGE
============================================================ */

const MassageTypeVisual = ({ imageUrl, iconName, size = 54, tintColor = '#FFFFFF' }) => {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <MaterialCommunityIcons
        name={iconName || 'spa'}
        size={Math.round(size * 0.5)}
        color={tintColor}
      />
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
      }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

/* ============================================================
   HOME SCREEN
============================================================ */

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors: themeColors, isDark } = useTheme();
  const { unreadCount = 0 } = useNotifications() || {};

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info',
  });
  const scrollY = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  /* ==========================================================
     RESPONSIVE
  ========================================================== */

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      } else if (Dimensions.removeEventListener) {
        Dimensions.removeEventListener('change', onChange);
      }
    };
  }, []);

  const isTabletWidth = screenWidth >= TABLET_BREAKPOINT;

  /* ==========================================================
     TYPES DE MASSAGE RÉELS
  ========================================================== */

  const [massageTypes, setMassageTypes] = useState([]);
  const [massageTypesLoading, setMassageTypesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadMassageTypes = async () => {
      try {
        setMassageTypesLoading(true);
        const data = await massageTypeService.getActiveMassageTypes();
        if (!isMounted) return;

        const mapped = (data || []).map((item) => ({
          id: item.id,
          name: item.name,
          shortName: item.name,
          category: item.category,
          categoryLabel: getMassageCategoryLabel(item.category),
          icon: getMassageTypeIconMCI(item.category) || getMassageTypeFallbackIcon(item.category),
          imageUrl: massageTypeService.getMassageImageUrl(item.image_url || item.icon_url),
          duration: item.duration_min && item.duration_max
            ? `${item.duration_min}–${item.duration_max} min`
            : item.duration_min
              ? `${item.duration_min} min`
              : '60 min',
          minPrice: item.min_price ?? item.recommended_price ?? 0,
          description: item.description || '',
        }));

        setMassageTypes(mapped);
      } catch (error) {
        console.error('❌ Erreur chargement types de massage:', error);
        if (isMounted) setMassageTypes([]);
      } finally {
        if (isMounted) setMassageTypesLoading(false);
      }
    };

    loadMassageTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  const massageListRef = useRef(null);
  const massageScrollX = useRef(0);

  const handleMassageScroll = useCallback((event) => {
    massageScrollX.current = event.nativeEvent.contentOffset.x;
  }, []);

  const scrollMassageBy = useCallback((delta) => {
    const nextX = Math.max(0, massageScrollX.current + delta);
    massageListRef.current?.scrollToOffset({
      offset: nextX,
      animated: true,
    });
  }, []);

  /* ==========================================================
     THEME
  ========================================================== */

  const surface = themeColors.surface || (isDark ? '#181B22' : '#FFFFFF');
  const background = themeColors.background || (isDark ? '#101217' : '#F7F9FC');
  const text = themeColors.text || (isDark ? '#FFFFFF' : '#151923');
  const textSecondary = themeColors.textSecondary || (isDark ? '#A6ACB8' : '#737985');
  const border = themeColors.border || (isDark ? '#2A2E38' : '#E8EBF0');

  /* ==========================================================
     CLEANUP TOAST
  ========================================================== */

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  /* ==========================================================
     SHOW TOAST
  ========================================================== */

  const showToast = useCallback((message, type = 'info', duration = 2200) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setToast({ visible: true, message, type });

    toastTimer.current = setTimeout(() => {
      setToast(current => ({ ...current, visible: false }));
    }, duration);
  }, []);

  /* ==========================================================
     HIDE TOAST
  ========================================================== */

  const hideToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast(current => ({ ...current, visible: false }));
  }, []);

  /* ==========================================================
     USER
  ========================================================== */

  const displayName = user?.fullname || user?.name || user?.first_name || 'Utilisateur';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  /* ==========================================================
     NAVIGATION
  ========================================================== */

  const navigate = useCallback((screen, params, message = null, type = 'info') => {
    if (!screen) {
      showToast('Action indisponible.', 'warning');
      return;
    }

    showToast(message || 'Ouverture de la page...', type, 1300);

    setTimeout(() => {
      try {
        navigation.navigate(screen, params);
      } catch (error) {
        console.log(`Navigation vers ${screen} impossible`, error);
        showToast('Cette page est momentanément indisponible.', 'error', 2800);
      }
    }, 160);
  }, [navigation, showToast]);

  /* ==========================================================
     REFRESH
  ========================================================== */

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    showToast('Actualisation des données...', 'info', 1200);
    await new Promise(resolve => setTimeout(resolve, 900));
    setRefreshing(false);
    showToast('Accueil actualisé avec succès.', 'success', 2200);
  }, [showToast]);

  /* ==========================================================
     STATUS
  ========================================================== */

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'pending': return WARNING;
      case 'confirmed': return SUCCESS;
      case 'in_progress': return INFO;
      case 'completed': return '#2E7D32';
      case 'cancelled': return DANGER;
      default: return '#9E9E9E';
    }
  }, []);

  /* ==========================================================
     GREETING
  ========================================================== */

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }, []);

  /* ==========================================================
     QUICK ACTION
  ========================================================== */

  const renderQuickAction = useCallback(
    ({ item, index }) => (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 70}
        duration={450}
        style={styles.quickActionWrapper}
      >
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={() => navigate(item.screen, undefined, item.toast, item.type || 'info')}
          style={[styles.quickAction, { backgroundColor: surface, borderColor: border }]}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: item.bg }]}>
            <Ionicons name={item.icon} size={22} color={item.color} />
          </View>
          <View style={styles.quickActionContent}>
            <Text numberOfLines={1} style={[styles.quickActionLabel, { color: text }]}>
              {item.label}
            </Text>
            <Text numberOfLines={1} style={[styles.quickActionDescription, { color: textSecondary }]}>
              {item.description}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={textSecondary} />
        </TouchableOpacity>
      </Animatable.View>
    ),
    [navigate, surface, border, text, textSecondary]
  );

  /* ==========================================================
     MASSAGE CARD - AVEC ENVOI DU CATEGORY
  ========================================================== */

  const renderMassage = useCallback(
    ({ item }) => (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          showToast(`${item.name} sélectionné`, 'success');
          setTimeout(() => {
            navigate('SearchMassage', {
              massageType: {
                id: item.id,
                name: item.name,
                category: item.category,
                categoryLabel: item.categoryLabel,
                minPrice: item.minPrice,
                duration: item.duration,
                description: item.description,
                icon: item.icon,
                imageUrl: item.imageUrl,
              },
              selectedCategory: item.category, // ✅ Envoi du category
            });
          }, 150);
        }}
        style={[styles.massageCard, { backgroundColor: surface, borderColor: border }]}
      >
        <View style={styles.massageCardTop}>
          {item.imageUrl ? (
            <View style={styles.massagePhotoFrame}>
              <MassageTypeVisual
                imageUrl={item.imageUrl}
                iconName={item.icon}
                size={68}
                tintColor="#FFFFFF"
              />
            </View>
          ) : (
            <LinearGradient
              colors={[PRIMARY, SECONDARY]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.massageIcon, styles.massagePhotoFrame]}
            >
              <MaterialCommunityIcons name={item.icon} size={32} color="#FFFFFF" />
            </LinearGradient>
          )}
          <View style={[styles.smallArrow, { backgroundColor: `${PRIMARY}10` }]}>
            <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
          </View>
        </View>

        <Text numberOfLines={2} style={[styles.massageName, { color: text }]}>
          {item.name}
        </Text>

        <View style={[styles.massageCategoryBadge, { backgroundColor: `${SUCCESS}10`, borderColor: `${SUCCESS}28` }]}>
          <View style={[styles.massageCategoryDot, { backgroundColor: SUCCESS }]} />
          <Text numberOfLines={1} style={[styles.massageCategoryText, { color: SUCCESS }]}>
            {item.categoryLabel}
          </Text>
        </View>

        <Text numberOfLines={1} style={[styles.massageDescription, { color: textSecondary }]}>
          {item.description}
        </Text>

        <View style={styles.massageInfoRow}>
          <View style={[styles.durationBadge, { backgroundColor: `${PRIMARY}0D` }]}>
            <Ionicons name="time-outline" size={12} color={PRIMARY} />
            <Text style={[styles.durationText, { color: PRIMARY }]}>
              {item.duration}
            </Text>
          </View>
        </View>

        <View style={styles.massagePriceRow}>
          <Text style={[styles.priceLabel, { color: textSecondary }]}>À partir de</Text>
          <Text style={styles.massagePrice}>
            {item.minPrice.toLocaleString()} Ar
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [navigate, showToast, surface, border, text, textSecondary]
  );

  /* ==========================================================
     PROMOTION
  ========================================================== */

  const renderPromotion = useCallback(
    ({ item }) => (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          const massage = massageTypes.find(value => value.name === item.title);
          showToast(`Offre ${item.title} sélectionnée`, 'success');
          setTimeout(() => {
            navigate('SearchMassage', {
              massageType: massage,
              selectedCategory: massage?.category || null,
            });
          }, 150);
        }}
        style={styles.promotionCard}
      >
        <LinearGradient
          colors={[PRIMARY, SECONDARY]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promotionGradient}
        >
          <View style={styles.promotionCircleOne} />
          <View style={styles.promotionCircleTwo} />
          <View style={styles.promotionHeader}>
            <View style={styles.promotionIcon}>
              <MaterialCommunityIcons name={item.icon} size={24} color="#FFFFFF" />
            </View>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{item.discount}%</Text>
            </View>
          </View>
          <Text style={styles.promotionTitle}>{item.title}</Text>
          <Text numberOfLines={2} style={styles.promotionDescription}>
            {item.description}
          </Text>
          <View style={styles.promotionFooter}>
            <View>
              <Text style={styles.promotionSmall}>Offre valable jusqu'au</Text>
              <Text style={styles.promotionDate}>{item.endDate}</Text>
            </View>
            <View style={styles.promotionArrow}>
              <Ionicons name="arrow-forward" size={17} color={PRIMARY} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    ),
    [navigate, showToast, massageTypes]
  );

  /* ==========================================================
     BOOKING CARD
  ========================================================== */

  const renderBooking = useCallback(
    ({ item }) => {
      const statusColor = getStatusColor(item.status);
      return (
        <TouchableOpacity
          activeOpacity={0.87}
          onPress={() => navigate('Réservations', undefined, 'Ouverture de vos réservations')}
          style={[styles.bookingCard, { backgroundColor: surface, borderColor: border }]}
        >
          <View style={[styles.bookingIcon, { backgroundColor: `${PRIMARY}10` }]}>
            <MaterialCommunityIcons name="spa" size={23} color={PRIMARY} />
          </View>
          <View style={styles.bookingContent}>
            <View style={styles.bookingStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.bookingStatus, { color: statusColor }]}>
                {item.statusLabel}
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.bookingType, { color: text }]}>
              {item.type}
            </Text>
            <Text numberOfLines={1} style={[styles.bookingTherapist, { color: textSecondary }]}>
              Avec {item.therapist}
            </Text>
            <View style={styles.bookingDateRow}>
              <Ionicons name="calendar-outline" size={13} color={textSecondary} />
              <Text style={[styles.bookingDate, { color: textSecondary }]}>
                {item.date} • {item.time}
              </Text>
            </View>
          </View>
          <View style={styles.bookingRight}>
            <Text style={styles.bookingPrice}>{item.price}</Text>
            <View style={[styles.bookingChevron, { backgroundColor: `${PRIMARY}0D` }]}>
              <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [getStatusColor, navigate, surface, border, text, textSecondary]
  );

  /* ==========================================================
     HEADER ANIMATION
  ========================================================== */

  const headerShadow = scrollY.interpolate({
    inputRange: [0, 70],
    outputRange: [0, 0.12],
    extrapolate: 'clamp',
  });

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={surface}
      />

      {/* GLOBAL TOAST */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        isDark={isDark}
      />

      {/* HEADER */}
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: surface, borderBottomColor: border, shadowOpacity: headerShadow },
        ]}
      >
        <View style={styles.headerContent}>
          {/* PROFILE */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigate('Profil', undefined, 'Ouverture de votre profil')}
            style={styles.profileButton}
          >
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: PRIMARY }]}>
                <Text style={styles.headerAvatarText}>{avatarLetter}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* LOGO */}
          <View style={styles.headerBrand}>
            <View style={styles.headerLogo}>
              <MaterialCommunityIcons name="spa" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: PRIMARY }]}>Mada Bien-être</Text>
              <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                Votre bien-être, notre priorité
              </Text>
            </View>
          </View>

          {/* NOTIFICATIONS */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigate('Notifications', undefined,
              unreadCount > 0
                ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} disponible${unreadCount > 1 ? 's' : ''}`
                : 'Aucune nouvelle notification',
              unreadCount > 0 ? 'success' : 'info'
            )}
            style={[styles.notificationButton, { backgroundColor: isDark ? '#242832' : '#F1F4FA' }]}
          >
            <Ionicons name="notifications-outline" size={22} color={text} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* SCROLL */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* WELCOME */}
        <Animatable.View animation="fadeInDown" duration={550} style={styles.heroWrapper}>
          <LinearGradient
            colors={[PRIMARY, SECONDARY]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroCircleOne} />
            <View style={styles.heroCircleTwo} />
            <View style={styles.heroCircleThree} />

            <View style={styles.heroTop}>
              <View style={styles.heroTextContainer}>
                <View style={styles.clientBadge}>
                  <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                  <Text style={styles.clientBadgeText}>ESPACE CLIENT</Text>
                </View>
                <Text style={styles.heroGreeting}>{greeting} 👋</Text>
                <Text numberOfLines={1} style={styles.heroName}>
                  {displayName}
                </Text>
                <Text style={styles.heroDescription}>
                  Prenez soin de vous. Trouvez un professionnel adapté à vos besoins.
                </Text>
              </View>
              <View style={styles.heroAvatarWrapper}>
                {user?.profile_image ? (
                  <Image source={{ uri: user.profile_image }} style={styles.heroAvatar} />
                ) : (
                  <Text style={styles.heroAvatarText}>{avatarLetter}</Text>
                )}
                <View style={styles.heroOnline} />
              </View>
            </View>

            {/* HERO CTA */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => navigate('SearchMassage', undefined, 'Recherche de thérapeutes disponibles')}
              style={styles.heroCTA}
            >
              <View style={styles.heroCTAIcon}>
                <Ionicons name="search" size={18} color={PRIMARY} />
              </View>
              <View style={styles.heroCTAContent}>
                <Text style={styles.heroCTATitle}>Trouver mon massage</Text>
                <Text style={styles.heroCTASubtitle}>Thérapeutes disponibles près de vous</Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        </Animatable.View>

        {/* QUICK ACTIONS */}
        <Animatable.View animation="fadeInUp" delay={100} duration={500} style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: text }]}>Accès rapide</Text>
              <Text style={[styles.sectionSubtitle, { color: textSecondary }]}>Tout ce dont vous avez besoin</Text>
            </View>
          </View>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((item, index) => renderQuickAction({ item, index }))}
          </View>
        </Animatable.View>

        {/* IA RECOMMENDATION */}
        <Animatable.View animation="fadeInUp" delay={180} duration={500} style={styles.sectionContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigate('SearchMassage', undefined, 'Analyse IA de vos besoins en cours...')}
            style={styles.aiCard}
          >
            <LinearGradient
              colors={isDark ? ['#163A2A', '#142B22'] : ['#EAF8EF', '#F3FBF5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiGradient}
            >
              <View style={styles.aiIconContainer}>
                <MaterialCommunityIcons name="robot-outline" size={29} color={SUCCESS} />
              </View>
              <View style={styles.aiContent}>
                <View style={styles.aiTitleRow}>
                  <Text style={[styles.aiTitle, { color: isDark ? '#FFFFFF' : '#163A25' }]}>
                    Recommandation IA
                  </Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>IA</Text>
                  </View>
                </View>
                <Text numberOfLines={2} style={[styles.aiDescription, { color: isDark ? '#A9C7B3' : '#55705A' }]}>
                  Laissez notre intelligence artificielle trouver le massage et le thérapeute qui vous correspondent.
                </Text>
                <View style={styles.aiFeatures}>
                  <View style={styles.aiFeature}>
                    <Ionicons name="sparkles-outline" size={12} color={SUCCESS} />
                    <Text style={styles.aiFeatureText}>Personnalisé</Text>
                  </View>
                  <View style={styles.aiFeature}>
                    <Ionicons name="location-outline" size={12} color={SUCCESS} />
                    <Text style={styles.aiFeatureText}>Localisé</Text>
                  </View>
                  <View style={styles.aiFeature}>
                    <Ionicons name="flash-outline" size={12} color={SUCCESS} />
                    <Text style={styles.aiFeatureText}>Rapide</Text>
                  </View>
                </View>
              </View>
              <View style={styles.aiArrow}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        {/* MASSAGES */}
        <Animatable.View animation="fadeInUp" delay={260} duration={500} style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: text }]}>Choisissez votre massage</Text>
              <Text style={[styles.sectionSubtitle, { color: textSecondary }]}>Selon vos besoins</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigate('SearchMassage', undefined, 'Affichage de tous les massages')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>Voir tout</Text>
              <Ionicons name="chevron-forward" size={14} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={styles.massagesCarouselWrap}>
            {IS_WEB && isTabletWidth && (
              <TouchableOpacity
                onPress={() => scrollMassageBy(-230)}
                activeOpacity={0.8}
                style={[styles.massagesArrow, styles.massagesArrowLeft, { backgroundColor: surface, borderColor: border }]}
              >
                <Ionicons name="chevron-back" size={18} color={PRIMARY} />
              </TouchableOpacity>
            )}

            {massageTypesLoading && massageTypes.length === 0 ? (
              <View style={styles.massagesLoadingBox}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={[styles.massagesLoadingText, { color: textSecondary }]}>
                  Chargement des massages…
                </Text>
              </View>
            ) : !massageTypesLoading && massageTypes.length === 0 ? (
              <View style={styles.massagesLoadingBox}>
                <Ionicons name="alert-circle-outline" size={20} color={textSecondary} />
                <Text style={[styles.massagesLoadingText, { color: textSecondary }]}>
                  Aucun type de massage actif pour le moment
                </Text>
              </View>
            ) : (
              <FlatList
                ref={massageListRef}
                data={massageTypes}
                renderItem={renderMassage}
                keyExtractor={item => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleMassageScroll}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.horizontalList, isTabletWidth && styles.horizontalListWide]}
              />
            )}

            {IS_WEB && isTabletWidth && (
              <TouchableOpacity
                onPress={() => scrollMassageBy(230)}
                activeOpacity={0.8}
                style={[styles.massagesArrow, styles.massagesArrowRight, { backgroundColor: surface, borderColor: border }]}
              >
                <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
              </TouchableOpacity>
            )}
          </View>
        </Animatable.View>

        {/* LOCATION */}
        <Animatable.View animation="fadeInUp" delay={340} duration={500} style={styles.sectionContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigate('SearchMassage', undefined, 'Recherche des thérapeutes à proximité')}
            style={styles.locationCard}
          >
            <LinearGradient
              colors={isDark ? ['#17233A', '#17253D'] : ['#EEF4FF', '#F8FAFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.locationGradient}
            >
              <View style={styles.locationIcon}>
                <Ionicons name="location" size={27} color={PRIMARY} />
              </View>
              <View style={styles.locationContent}>
                <View style={styles.locationTitleRow}>
                  <Text style={[styles.locationTitle, { color: text }]}>Thérapeutes à proximité</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>EN DIRECT</Text>
                  </View>
                </View>
                <Text numberOfLines={2} style={[styles.locationDescription, { color: textSecondary }]}>
                  Découvrez les professionnels disponibles autour de vous grâce à la géolocalisation.
                </Text>
              </View>
              <View style={styles.locationArrow}>
                <Ionicons name="arrow-forward" size={18} color={PRIMARY} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        {/* PROMOTIONS */}
        <Animatable.View animation="fadeInUp" delay={420} duration={500} style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <View style={styles.titleWithIcon}>
                <Text style={[styles.sectionTitle, { color: text }]}>Offres du moment</Text>
                <Text style={styles.fireEmoji}>🔥</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: textSecondary }]}>Profitez des meilleurs tarifs</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigate('SearchMassage', undefined, 'Affichage de toutes les offres')}
            >
              <Text style={styles.seeAllText}>Tout voir</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={PROMOTIONS}
            renderItem={renderPromotion}
            keyExtractor={item => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </Animatable.View>

        {/* BOOKINGS */}
        <Animatable.View animation="fadeInUp" delay={500} duration={500} style={[styles.sectionContainer, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: text }]}>Mes réservations</Text>
              <Text style={[styles.sectionSubtitle, { color: textSecondary }]}>Suivez vos prochaines séances</Text>
            </View>
            <TouchableOpacity onPress={() => navigate('Réservations', undefined, 'Affichage de toutes vos réservations')}>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {BOOKINGS.map((booking, index) => (
            <Animatable.View key={booking.id} animation="fadeInUp" delay={550 + index * 70}>
              {renderBooking({ item: booking })}
            </Animatable.View>
          ))}
        </Animatable.View>

        {/* SOS */}
        <Animatable.View animation="fadeInUp" delay={600} duration={500} style={styles.sosContainer}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigate('SOS', undefined, 'Ouverture de l\'assistance SOS', 'warning')}
            style={[styles.sosCard, { backgroundColor: isDark ? '#321C20' : '#FFF1F2', borderColor: isDark ? '#562A30' : '#FFD6DA' }]}
          >
            <View style={styles.sosIcon}>
              <Ionicons name="shield-checkmark" size={22} color={DANGER} />
            </View>
            <View style={styles.sosContent}>
              <Text style={[styles.sosTitle, { color: text }]}>Besoin d'assistance ?</Text>
              <Text numberOfLines={2} style={[styles.sosDescription, { color: textSecondary }]}>
                Utilisez le bouton SOS en cas de situation urgente.
              </Text>
            </View>
            <View style={styles.sosButton}>
              <Text style={styles.sosButtonText}>SOS</Text>
            </View>
          </TouchableOpacity>
        </Animatable.View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerLogo}>
            <MaterialCommunityIcons name="spa" size={17} color={PRIMARY} />
          </View>
          <Text style={[styles.footerText, { color: textSecondary }]}>Mada Bien-être</Text>
          <Text style={[styles.footerDot, { color: textSecondary }]}>•</Text>
          <Text style={[styles.footerText, { color: textSecondary }]}>Votre bien-être, notre priorité</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 6, paddingBottom: 120 },
  sectionContainer: { marginTop: 24, paddingHorizontal: 16 },
  lastSection: { marginBottom: 0 },

  /* TOAST */
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : Platform.OS === 'ios' ? 55 : 42,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 999,
    pointerEvents: 'box-none',
  },
  toast: {
    width: Platform.OS === 'web' ? Math.min(430, width - 40) : Math.min(360, width - 32),
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 15,
  },
  toastIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  toastContent: { flex: 1, paddingRight: 7 },
  toastMessage: { fontSize: 12, lineHeight: 17, fontFamily: typography.fontFamily.semiBold },
  toastHint: { fontSize: 8, marginTop: 2, fontFamily: typography.fontFamily.regular },

  /* HEADER */
  header: {
    paddingTop: Platform.OS === 'ios' ? 48 : 30,
    paddingBottom: 10,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 5,
    zIndex: 20,
  },
  headerContent: { height: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  profileButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerAvatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#FFFFFF', fontSize: 16, fontFamily: typography.fontFamily.bold },
  headerBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerLogo: { width: 36, height: 36, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerTitle: { fontSize: 15, fontFamily: typography.fontFamily.bold },
  headerSubtitle: { fontSize: 7.5, marginTop: 1, fontFamily: typography.fontFamily.regular },
  notificationButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', position: 'relative', marginLeft: 8 },
  notificationBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: DANGER, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 8, fontFamily: typography.fontFamily.bold },

  /* HERO */
  heroWrapper: { marginHorizontal: 16, marginTop: 16 },
  heroCard: { minHeight: 265, borderRadius: 28, padding: 20, overflow: 'hidden', shadowColor: PRIMARY, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 9 },
  heroCircleOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -90, top: -100, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroCircleTwo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, right: 45, bottom: -90, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroCircleThree: { position: 'absolute', width: 80, height: 80, borderRadius: 40, left: -45, bottom: 20, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroTextContainer: { flex: 1, paddingRight: 10 },
  clientBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 11 },
  clientBadgeText: { color: 'rgba(255,255,255,0.92)', fontSize: 7.5, letterSpacing: 0.8, marginLeft: 4, fontFamily: typography.fontFamily.bold },
  heroGreeting: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: typography.fontFamily.regular },
  heroName: { color: '#FFFFFF', fontSize: 25, marginTop: 1, fontFamily: typography.fontFamily.bold },
  heroDescription: { color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 17, marginTop: 7, maxWidth: 250, fontFamily: typography.fontFamily.regular },
  heroAvatarWrapper: { width: 65, height: 65, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroAvatar: { width: 61, height: 61, borderRadius: 20 },
  heroAvatarText: { color: '#FFFFFF', fontSize: 26, fontFamily: typography.fontFamily.bold },
  heroOnline: { position: 'absolute', width: 13, height: 13, right: -2, bottom: -2, borderRadius: 7, backgroundColor: SUCCESS, borderWidth: 2, borderColor: '#FFFFFF' },
  heroCTA: { marginTop: 22, minHeight: 66, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  heroCTAIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  heroCTAContent: { flex: 1 },
  heroCTATitle: { color: '#FFFFFF', fontSize: 13, fontFamily: typography.fontFamily.bold },
  heroCTASubtitle: { color: 'rgba(255,255,255,0.68)', fontSize: 9, marginTop: 3, fontFamily: typography.fontFamily.regular },

  /* SECTION */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { fontSize: 17, fontFamily: typography.fontFamily.bold },
  sectionSubtitle: { fontSize: 10, marginTop: 3, fontFamily: typography.fontFamily.regular },
  seeAllButton: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { color: PRIMARY, fontSize: 11, fontFamily: typography.fontFamily.semiBold },

  /* QUICK ACTIONS */
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickActionWrapper: { width: '48.2%', marginBottom: 10 },
  quickAction: { minHeight: 75, borderRadius: 19, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 5, elevation: 2 },
  quickActionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  quickActionContent: { flex: 1 },
  quickActionLabel: { fontSize: 12.5, fontFamily: typography.fontFamily.semiBold },
  quickActionDescription: { fontSize: 8.5, lineHeight: 12, marginTop: 3, fontFamily: typography.fontFamily.regular },

  /* AI */
  aiCard: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,200,83,0.15)' },
  aiGradient: { minHeight: 142, padding: 15, flexDirection: 'row', alignItems: 'center' },
  aiIconContainer: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(0,200,83,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  aiContent: { flex: 1 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center' },
  aiTitle: { fontSize: 14, fontFamily: typography.fontFamily.bold },
  aiBadge: { marginLeft: 7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,200,83,0.12)' },
  aiBadgeText: { color: SUCCESS, fontSize: 7, letterSpacing: 0.5, fontFamily: typography.fontFamily.bold },
  aiDescription: { fontSize: 9.5, lineHeight: 15, marginTop: 5, paddingRight: 3, fontFamily: typography.fontFamily.regular },
  aiFeatures: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 5 },
  aiFeature: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.55)' },
  aiFeatureText: { color: SUCCESS, fontSize: 7.5, marginLeft: 3, fontFamily: typography.fontFamily.medium },
  aiArrow: { width: 38, height: 38, borderRadius: 13, backgroundColor: SUCCESS, alignItems: 'center', justifyContent: 'center', marginLeft: 7 },

  /* MASSAGES */
  horizontalList: { paddingRight: 16 },
  horizontalListWide: { paddingHorizontal: 40 },
  massagesCarouselWrap: { position: 'relative', justifyContent: 'center' },
  massagesArrow: { position: 'absolute', top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  massagesArrowLeft: { left: 4 },
  massagesArrowRight: { right: 4 },
  massagesLoadingBox: { minHeight: 120, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8 },
  massagesLoadingText: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  massageCard: { width: 208, minHeight: 226, borderRadius: 21, borderWidth: 1, padding: 14, marginRight: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.035, shadowRadius: 7, elevation: 2 },
  massageCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  massageIcon: { alignItems: 'center', justifyContent: 'center' },
  massagePhotoFrame: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: `${PRIMARY}12` },
  smallArrow: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  massageName: { fontSize: 14, lineHeight: 18, fontFamily: typography.fontFamily.bold },
  massageCategoryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  massageCategoryDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  massageCategoryText: { fontSize: 8, lineHeight: 10, fontFamily: typography.fontFamily.medium },
  massageDescription: { fontSize: 9.5, marginTop: 5, fontFamily: typography.fontFamily.regular },
  massageInfoRow: { marginTop: 11 },
  durationBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 },
  durationText: { fontSize: 8, marginLeft: 3, fontFamily: typography.fontFamily.medium },
  massagePriceRow: { marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF1F5', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  priceLabel: { fontSize: 8, fontFamily: typography.fontFamily.regular },
  massagePrice: { color: PRIMARY, fontSize: 13, fontFamily: typography.fontFamily.bold },

  /* LOCATION */
  locationCard: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#E5EBF7' },
  locationGradient: { minHeight: 115, padding: 14, flexDirection: 'row', alignItems: 'center' },
  locationIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(13,43,126,0.10)', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  locationContent: { flex: 1 },
  locationTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  locationTitle: { fontSize: 13, fontFamily: typography.fontFamily.bold },
  liveBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 6, marginTop: 2, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,200,83,0.10)' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: SUCCESS, marginRight: 3 },
  liveText: { color: SUCCESS, fontSize: 6.5, fontFamily: typography.fontFamily.bold },
  locationDescription: { fontSize: 9, lineHeight: 14, marginTop: 5, fontFamily: typography.fontFamily.regular },
  locationArrow: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginLeft: 7 },

  /* PROMOTIONS */
  titleWithIcon: { flexDirection: 'row', alignItems: 'center' },
  fireEmoji: { fontSize: 15, marginLeft: 4 },
  promotionCard: { width: 250, height: 170, borderRadius: 22, overflow: 'hidden', marginRight: 12, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 4 },
  promotionGradient: { flex: 1, padding: 16, overflow: 'hidden' },
  promotionCircleOne: { position: 'absolute', width: 125, height: 125, borderRadius: 63, right: -60, top: -60, backgroundColor: 'rgba(255,255,255,0.07)' },
  promotionCircleTwo: { position: 'absolute', width: 90, height: 90, borderRadius: 45, left: -50, bottom: -50, backgroundColor: 'rgba(255,255,255,0.05)' },
  promotionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promotionIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  discountBadge: { backgroundColor: '#FF6F00', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  discountText: { color: '#FFFFFF', fontSize: 10, fontFamily: typography.fontFamily.bold },
  promotionTitle: { color: '#FFFFFF', fontSize: 15, marginTop: 12, fontFamily: typography.fontFamily.bold },
  promotionDescription: { color: 'rgba(255,255,255,0.75)', fontSize: 9, lineHeight: 14, marginTop: 3, maxWidth: 220, fontFamily: typography.fontFamily.regular },
  promotionFooter: { marginTop: 'auto', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  promotionSmall: { color: 'rgba(255,255,255,0.58)', fontSize: 7.5, fontFamily: typography.fontFamily.regular },
  promotionDate: { color: '#FFFFFF', fontSize: 9, marginTop: 2, fontFamily: typography.fontFamily.semiBold },
  promotionArrow: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  /* BOOKINGS */
  bookingCard: { minHeight: 101, borderRadius: 19, borderWidth: 1, padding: 11, marginBottom: 9, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 5, elevation: 2 },
  bookingIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  bookingContent: { flex: 1, minWidth: 0 },
  bookingStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  bookingStatus: { fontSize: 8.5, fontFamily: typography.fontFamily.semiBold },
  bookingType: { fontSize: 12.5, fontFamily: typography.fontFamily.bold },
  bookingTherapist: { fontSize: 8.5, marginTop: 2, fontFamily: typography.fontFamily.regular },
  bookingDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  bookingDate: { fontSize: 8.5, marginLeft: 4, fontFamily: typography.fontFamily.regular },
  bookingRight: { alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 72, marginLeft: 8 },
  bookingPrice: { color: PRIMARY, fontSize: 10.5, fontFamily: typography.fontFamily.bold },
  bookingChevron: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* SOS */
  sosContainer: { paddingHorizontal: 16, marginTop: 18 },
  sosCard: { minHeight: 82, borderRadius: 20, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center' },
  sosIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: 'rgba(229,57,53,0.10)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sosContent: { flex: 1 },
  sosTitle: { fontSize: 12.5, fontFamily: typography.fontFamily.bold },
  sosDescription: { fontSize: 8.5, lineHeight: 13, marginTop: 3, fontFamily: typography.fontFamily.regular },
  sosButton: { minWidth: 49, height: 39, borderRadius: 13, backgroundColor: DANGER, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sosButtonText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 0.5, fontFamily: typography.fontFamily.bold },

  /* FOOTER */
  footer: { marginTop: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  footerLogo: { width: 25, height: 25, borderRadius: 8, backgroundColor: `${PRIMARY}10`, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  footerText: { fontSize: 8, fontFamily: typography.fontFamily.regular },
  footerDot: { fontSize: 10, marginHorizontal: 5 },
});

export default HomeScreen;