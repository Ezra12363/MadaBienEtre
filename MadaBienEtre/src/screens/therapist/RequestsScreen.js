// src/screens/therapist/RequestsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const RequestsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  // ✅ Ataovy azo antoka fa array foana ny requests
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const filters = [
    { id: 'all', label: 'Toutes' },
    { id: 'pending', label: 'En attente' },
    { id: 'negotiating', label: 'Négociation' },
    { id: 'confirmed', label: 'Confirmées' },
  ];

  useEffect(() => {
    loadRequests();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'pending' },
      });
      // ✅ Ataovy azo antoka fa array ny valiny
      const data = Array.isArray(response.data) ? response.data : [];
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
      // ✅ Données mockées (array foana)
      setRequests([
        {
          id: 1,
          client: {
            id: 1,
            fullname: 'Marie L.',
            phone: '+261 34 12 345 67',
          },
          massage_type: 'Massage Relaxant',
          duration: 60,
          address: 'Lot III A 78, Antananarivo',
          client_price_proposed: 30000,
          distance: 0.8,
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
        },
        {
          id: 2,
          client: {
            id: 2,
            fullname: 'Jean R.',
            phone: '+261 32 12 345 67',
          },
          massage_type: 'Massage Thérapeutique',
          duration: 90,
          address: 'Lot IV B 12, Antananarivo',
          client_price_proposed: 45000,
          distance: 2.5,
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        },
        {
          id: 3,
          client: {
            id: 3,
            fullname: 'Sarah M.',
            phone: '+261 33 12 345 67',
          },
          massage_type: 'Massage Sportif',
          duration: 120,
          address: 'Lot V C 45, Antananarivo',
          client_price_proposed: 50000,
          distance: 3.2,
          status: 'negotiating',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleAccept = async (request) => {
    Alert.alert(
      'Accepter la demande',
      `Acceptez-vous la demande de ${request.client.fullname} à ${request.client_price_proposed.toLocaleString()} Ar ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            try {
              await axios.post(
                `${API_URL}/offers/create`,
                {
                  booking_id: request.id,
                  price_offered: request.client_price_proposed,
                  message: 'Offre acceptée',
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('✅ Demande acceptée');
              loadRequests();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'accepter la demande');
            }
          },
        },
      ]
    );
  };

  const handleCounter = (request) => {
    navigation.navigate('Negotiation', {
      bookingId: request.id,
      currentPrice: request.client_price_proposed,
      clientName: request.client.fullname,
    });
  };

  const handleReject = (request) => {
    Alert.alert(
      'Refuser la demande',
      `Voulez-vous vraiment refuser la demande de ${request.client.fullname} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.put(
                `${API_URL}/bookings/cancel/${request.id}`,
                { reason: 'Refusé par le thérapeute' },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('✅ Demande refusée');
              loadRequests();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de refuser la demande');
            }
          },
        },
      ]
    );
  };

  const renderRequest = ({ item }) => {
    const timeLeft = Math.max(0, Math.floor((new Date(item.expires_at) - new Date()) / 60000));
    
    return (
      <Animatable.View animation="fadeInUp" duration={600}>
        <View style={[styles.requestCard, { backgroundColor: themeColors.surface }]}>
          {/* En-tête */}
          <View style={styles.requestHeader}>
            <View style={styles.clientInfo}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarText}>
                  {item.client.fullname.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={[styles.clientName, { color: themeColors.text }]}>
                  {item.client.fullname}
                </Text>
                <Text style={[styles.clientPhone, { color: themeColors.textSecondary }]}>
                  {item.client.phone}
                </Text>
              </View>
            </View>
            <View style={styles.requestMeta}>
              <View style={styles.distanceBadge}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={styles.distanceText}>{item.distance} km</Text>
              </View>
              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={14} color={timeLeft < 5 ? colors.error : colors.textSecondary} />
                <Text style={[styles.timerText, { color: timeLeft < 5 ? colors.error : themeColors.textSecondary }]}>
                  {timeLeft} min
                </Text>
              </View>
            </View>
          </View>

          {/* Détails */}
          <View style={styles.requestDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="spa-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.detailText, { color: themeColors.text }]}>
                {item.massage_type}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.detailText, { color: themeColors.text }]}>
                {item.duration} min
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.detailText, { color: themeColors.text }]} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          </View>

          {/* Prix */}
          <View style={styles.requestFooter}>
            <View>
              <Text style={[styles.priceLabel, { color: themeColors.textSecondary }]}>
                Prix proposé
              </Text>
              <Text style={styles.priceValue}>
                {item.client_price_proposed.toLocaleString()} Ar
              </Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleAccept(item)}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryLight || colors.primary]}
                  style={styles.acceptGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.counterButton]}
                onPress={() => handleCounter(item)}
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleReject(item)}
              >
                <Ionicons name="close" size={18} color={colors.error || '#FF0000'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animatable.View>
    );
  };

  // ✅ Filter miaraka amin'ny fanamarinana fa array ny requests
  const filteredRequests = Array.isArray(requests) ? requests.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  }) : [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Demandes" showBack />

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterButton,
                  filter === f.id && styles.filterButtonActive,
                  { backgroundColor: themeColors.surface }
                ]}
                onPress={() => setFilter(f.id)}
              >
                <Text style={[
                  styles.filterText,
                  filter === f.id && styles.filterTextActive,
                  { color: filter === f.id ? '#fff' : themeColors.text }
                ]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Liste */}
        <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                Chargement des demandes...
              </Text>
            </View>
          ) : filteredRequests.length > 0 ? (
            <FlatList
              data={filteredRequests}
              renderItem={renderRequest}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
              }
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={64} color={themeColors.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>
                Aucune demande
              </Text>
              <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                Les demandes de massage apparaîtront ici
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  requestCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  clientName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  clientPhone: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  requestMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  requestDetails: {
    marginTop: spacing.sm,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  priceLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  priceValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  acceptButton: {
    borderColor: colors.primary,
  },
  acceptGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButton: {
    borderColor: colors.primary + '40',
  },
  rejectButton: {
    borderColor: (colors.error || '#FF0000') + '40',
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

export default RequestsScreen;