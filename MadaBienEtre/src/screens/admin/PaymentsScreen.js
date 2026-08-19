// src/screens/admin/PaymentsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';

const PaymentsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'completed', label: '✅ Complétés' },
    { id: 'pending', label: '⏳ En attente' },
    { id: 'failed', label: '❌ Échoués' },
    { id: 'refunded', label: '🔄 Remboursés' },
  ];

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [])
  );

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================
  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, statsData] = await Promise.all([
        adminService.getPayments({ limit: 100 }),
        adminService.getPaymentStats ? adminService.getPaymentStats() : null
      ]);
      
      if (Array.isArray(data) && data.length > 0) {
        setPayments(data);
        setFilteredPayments(data);
      } else {
        setPayments([]);
        setFilteredPayments([]);
        setError('Aucun paiement trouvé');
      }
      
      if (statsData) {
        setStats(statsData);
      } else {
        // Calculer les stats à partir des données
        const total = data.length || 0;
        const completed = data.filter(p => p.status === 'completed').length;
        const pending = data.filter(p => p.status === 'pending').length;
        const totalAmount = data.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        setStats({
          total_payments: total,
          completed_payments: completed,
          pending_payments: pending,
          failed_payments: data.filter(p => p.status === 'failed').length,
          refunded_payments: data.filter(p => p.status === 'refunded').length,
          total_amount: totalAmount
        });
      }
    } catch (error) {
      console.error('❌ Error loading payments:', error);
      setError(`Erreur: ${error.message || 'Impossible de charger'}`);
      setPayments([]);
      setFilteredPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  // ============================================================
  // RECHERCHE ET FILTRES
  // ============================================================
  const handleSearch = (text) => {
    setSearchQuery(text);
    filterPayments(text, selectedFilter);
  };

  const handleFilter = (filter) => {
    setSelectedFilter(filter);
    filterPayments(searchQuery, filter);
  };

  const filterPayments = (query, filter) => {
    let filtered = [...payments];
    
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.id?.toString().includes(q) ||
        p.user_id?.toString().includes(q) ||
        p.method?.toLowerCase().includes(q)
      );
    }
    
    if (filter !== 'all') {
      filtered = filtered.filter(p => p.status === filter);
    }
    
    setFilteredPayments(filtered);
  };

  // ============================================================
  // FONCTIONS UTILITAIRES
  // ============================================================
  const getStatusColor = (status) => {
    const map = { completed: '#27AE60', pending: '#F5A623', failed: '#E74C3C', refunded: '#9B59B6' };
    return map[status] || '#999';
  };

  const getStatusLabel = (status) => {
    const map = { completed: '✅ Complété', pending: '⏳ En attente', failed: '❌ Échoué', refunded: '🔄 Remboursé' };
    return map[status] || status;
  };

  const getMethodIcon = (method) => {
    const map = { mobile_money: 'phone-portrait-outline', card: 'card-outline', vanila_pay: 'wallet-outline' };
    return map[method] || 'cash-outline';
  };

  const getMethodLabel = (method) => {
    const map = { mobile_money: 'Mobile Money', card: 'Carte bancaire', vanila_pay: 'Vanila Pay' };
    return map[method] || method;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (amount) => {
    if (!amount) return '0 Ar';
    return amount.toLocaleString() + ' Ar';
  };

  // ============================================================
  // RENDU
  // ============================================================
  const renderPayment = ({ item }) => (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={[styles.methodIcon, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons name={getMethodIcon(item.method)} size={20} color={getStatusColor(item.status)} />
          </View>
          <View>
            <Text style={[styles.amount, { color: themeColors.text }]}>
              {formatPrice(item.amount)}
            </Text>
            <Text style={[styles.method, { color: themeColors.textSecondary }]}>
              {getMethodLabel(item.method)} • #{item.booking_id || 'N/A'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      <Text style={[styles.date, { color: themeColors.textSecondary }]}>
        {formatDate(item.created_at)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          <Header title="Paiements" showBack />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Chargement...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Paiements" showBack />

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#E74C3C20', borderColor: '#E74C3C' }]}>
            <Ionicons name="alert-circle" size={20} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Statistiques */}
        {stats && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
            <View style={[styles.statsCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.statsValue, { color: themeColors.text }]}>{stats.total_payments || 0}</Text>
              <Text style={[styles.statsLabel, { color: themeColors.textSecondary }]}>Total</Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.statsValue, { color: '#27AE60' }]}>{stats.completed_payments || 0}</Text>
              <Text style={[styles.statsLabel, { color: themeColors.textSecondary }]}>Complétés</Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.statsValue, { color: '#F5A623' }]}>{stats.pending_payments || 0}</Text>
              <Text style={[styles.statsLabel, { color: themeColors.textSecondary }]}>En attente</Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.statsValue, { color: colors.primary }]}>
                {formatPrice(stats.total_amount || 0)}
              </Text>
              <Text style={[styles.statsLabel, { color: themeColors.textSecondary }]}>Montant total</Text>
            </View>
          </ScrollView>
        )}

        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Rechercher un paiement..."
              placeholderTextColor={themeColors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterButton,
                  selectedFilter === f.id && styles.filterButtonActive,
                  { backgroundColor: selectedFilter === f.id ? colors.primary : themeColors.surface }
                ]}
                onPress={() => handleFilter(f.id)}
              >
                <Text style={[
                  styles.filterText,
                  { color: selectedFilter === f.id ? '#fff' : themeColors.text }
                ]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Liste */}
        {filteredPayments.length > 0 ? (
          <FlatList
            data={filteredPayments}
            renderItem={renderPayment}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[colors.primary]} 
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={64} color={themeColors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              {error ? 'Erreur de chargement' : 'Aucun paiement'}
            </Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              {error || 'Aucun paiement trouvé'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: '#E74C3C',
    fontFamily: typography.fontFamily.medium,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.md },
  statsContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  statsCard: { 
    padding: spacing.md, 
    borderRadius: 12, 
    marginRight: spacing.sm, 
    minWidth: 80, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statsValue: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  statsLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  searchContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, fontSize: typography.fontSize.md },
  filtersContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  filterButton: { 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.sm, 
    borderRadius: 20, 
    marginRight: spacing.sm, 
    borderWidth: 1, 
    borderColor: 'transparent' 
  },
  filterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  listContent: { padding: spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.md },
  emptyText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.xs },
  card: { 
    padding: spacing.md, 
    borderRadius: 16, 
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  methodIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  amount: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  method: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontFamily: typography.fontFamily.medium },
  date: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 4 },
});

export default PaymentsScreen;