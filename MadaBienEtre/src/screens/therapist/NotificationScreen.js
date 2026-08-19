// src/screens/therapist/NotificationScreen.js
// (Même code que pour le client, adapté pour le thérapeute)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const NotificationScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  const { unreadCount, markAsRead, markAllAsRead } = useNotifications();
  
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const filters = [
    { id: 'all', label: 'Toutes' },
    { id: 'booking', label: 'Réservations' },
    { id: 'offer', label: 'Offres' },
    { id: 'payment', label: 'Paiements' },
    { id: 'system', label: 'Système' },
  ];

  useEffect(() => {
    loadNotifications();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Données mockées
      setNotifications([
        {
          id: 1,
          title: 'Nouvelle demande de massage',
          body: 'Marie L. cherche un massage Relaxant à 30 000 Ar',
          type: 'booking',
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          data: { booking_id: 1 },
        },
        {
          id: 2,
          title: 'Offre acceptée',
          body: 'Jean R. a accepté votre offre de 45 000 Ar',
          type: 'offer',
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          data: { booking_id: 2 },
        },
        {
          id: 3,
          title: 'Paiement reçu',
          body: 'Vous avez reçu 35 000 Ar de la part de Sarah M.',
          type: 'payment',
          is_read: true,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          data: { booking_id: 1 },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );
    }

    if (notification.data?.booking_id) {
      navigation.navigate('BookingDetail', { bookingId: notification.data.booking_id });
    }
  };

  const handleMarkAllRead = async () => {
    Alert.alert(
      'Marquer tout comme lu',
      'Voulez-vous marquer toutes les notifications comme lues ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui',
          onPress: async () => {
            await markAllAsRead();
            setNotifications(prev =>
              prev.map(n => ({ ...n, is_read: true }))
            );
          },
        },
      ]
    );
  };

  const getIcon = (type) => {
    const map = {
      booking: 'calendar-outline',
      offer: 'pricetag-outline',
      payment: 'card-outline',
      system: 'information-circle-outline',
      sos: 'alert-circle-outline',
    };
    return map[type] || 'notifications-outline';
  };

  const getColor = (type) => {
    const map = {
      booking: '#4CAF50',
      offer: '#FF6F00',
      payment: '#2196F3',
      system: '#757575',
      sos: '#D32F2F',
    };
    return map[type] || '#757575';
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes} min`;
    if (hours < 24) return `${hours} h`;
    return `${days} j`;
  };

  const filteredNotifications = notifications.filter(n => {
    if (selectedFilter === 'all') return true;
    return n.type === selectedFilter;
  });

  const renderNotification = ({ item }) => (
    <Animatable.View animation="fadeInUp" duration={600}>
      <TouchableOpacity
        style={[
          styles.notificationCard,
          { backgroundColor: themeColors.surface },
          !item.is_read && styles.unreadCard,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationLeft}>
          <View style={[styles.notificationIcon, { backgroundColor: getColor(item.type) + '20' }]}>
            <Ionicons name={getIcon(item.type)} size={24} color={getColor(item.type)} />
          </View>
        </View>
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, { color: themeColors.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.notificationTime, { color: themeColors.textSecondary }]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
          <Text style={[styles.notificationBody, { color: themeColors.textSecondary }]}>
            {item.body}
          </Text>
          {!item.is_read && (
            <View style={styles.unreadDot} />
          )}
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header 
        title="Notifications" 
        showBack 
        rightComponent={
          unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
              <Text style={styles.markAllText}>Tout marquer lu</Text>
            </TouchableOpacity>
          )
        }
      />

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterButton,
                selectedFilter === f.id && styles.filterButtonActive,
                { backgroundColor: themeColors.surface }
              ]}
              onPress={() => setSelectedFilter(f.id)}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === f.id && styles.filterTextActive,
                { color: selectedFilter === f.id ? '#fff' : themeColors.text }
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Chargement...
            </Text>
          </View>
        ) : filteredNotifications.length > 0 ? (
          <FlatList
            data={filteredNotifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={themeColors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>
              Aucune notification
            </Text>
            <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
              Vous serez notifié des nouvelles activités
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  markAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.primary + '20',
    borderRadius: 8,
  },
  markAllText: {
    color: colors.primary,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  filtersContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: colors.primary + '05',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notificationLeft: {
    marginRight: spacing.md,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationTime: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  notificationBody: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
    lineHeight: 20,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default NotificationScreen;