// src/screens/admin/SOSAlertsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';

const SOSAlertsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [])
  );

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await adminService.getSOSAlerts({ limit: 100 });
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading SOS alerts:', error);
      setAlerts([
        { id: 1, user_id: 5, alert_type: 'client', latitude: -18.8792, longitude: 47.5079, status: 'active', severity: 'high', created_at: '2026-07-20T15:30:00Z' },
        { id: 2, user_id: 3, alert_type: 'therapist', latitude: -18.9006, longitude: 47.5229, status: 'resolved', severity: 'medium', created_at: '2026-07-19T10:15:00Z' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleResolve = async (alertId) => {
    Alert.alert('Résoudre l\'alerte', 'Confirmez-vous la résolution de cette alerte ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Résoudre', onPress: async () => {
        try {
          await adminService.resolveSOSAlert(alertId);
          await loadAlerts();
          Alert.alert('✅ Succès', 'Alerte résolue avec succès');
        } catch (error) {
          Alert.alert('Erreur', 'Impossible de résoudre l\'alerte');
        }
      }}
    ]);
  };

  const getSeverityColor = (severity) => {
    const map = { low: '#4CAF50', medium: '#F5A623', high: '#E74C3C', critical: '#D32F2F' };
    return map[severity] || '#999';
  };

  const getSeverityLabel = (severity) => {
    const map = { low: '🟢 Faible', medium: '🟡 Moyenne', high: '🔴 Élevée', critical: '🔴 Critique' };
    return map[severity] || severity;
  };

  const getStatusLabel = (status) => {
    return status === 'active' ? '🟢 Active' : '✅ Résolue';
  };

  const renderAlert = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: themeColors.surface, borderLeftColor: getSeverityColor(item.severity), borderLeftWidth: 4 }]}
      onPress={() => { setSelectedAlert(item); setShowModal(true); }}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconContainer, { backgroundColor: getSeverityColor(item.severity) + '20' }]}>
            <Ionicons name="alert-circle" size={20} color={getSeverityColor(item.severity)} />
          </View>
          <View>
            <Text style={[styles.alertType, { color: themeColors.text }]}>
              {item.alert_type === 'client' ? '👤 Client' : '💆 Thérapeute'}
            </Text>
            <Text style={[styles.status, { color: item.status === 'active' ? '#E74C3C' : '#27AE60' }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) + '20' }]}>
          <Text style={[styles.severityText, { color: getSeverityColor(item.severity) }]}>
            {getSeverityLabel(item.severity)}
          </Text>
        </View>
      </View>
      <Text style={[styles.date, { color: themeColors.textSecondary }]}>
        {item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : 'N/A'}
      </Text>
      {item.status === 'active' && (
        <TouchableOpacity
          style={[styles.resolveButton, { backgroundColor: colors.success }]}
          onPress={() => handleResolve(item.id)}
        >
          <Text style={styles.resolveButtonText}>Résoudre</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          <Header title="Alertes SOS" showBack />
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
        <Header title="Alertes SOS" showBack />
        {alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Aucune alerte SOS</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Toutes les alertes ont été résolues</Text>
          </View>
        ) : (
          <FlatList
            data={alerts}
            renderItem={renderAlert}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            showsVerticalScrollIndicator={false}
          />
        )}
        <Modal visible={showModal} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)}>
            <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>Détails alerte SOS</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>
              {selectedAlert && (
                <ScrollView>
                  <View style={[styles.modalSeverity, { backgroundColor: getSeverityColor(selectedAlert.severity) + '20' }]}>
                    <Ionicons name="alert-circle" size={32} color={getSeverityColor(selectedAlert.severity)} />
                    <Text style={[styles.modalSeverityText, { color: getSeverityColor(selectedAlert.severity) }]}>
                      {getSeverityLabel(selectedAlert.severity)}
                    </Text>
                  </View>
                  <View style={styles.modalInfo}>
                    <View style={[styles.modalInfoRow, { borderBottomColor: themeColors.border || '#E0E0E0' }]}>
                      <Text style={[styles.modalInfoLabel, { color: themeColors.textSecondary }]}>Type</Text>
                      <Text style={[styles.modalInfoValue, { color: themeColors.text }]}>
                        {selectedAlert.alert_type === 'client' ? '👤 Client' : '💆 Thérapeute'}
                      </Text>
                    </View>
                    <View style={[styles.modalInfoRow, { borderBottomColor: themeColors.border || '#E0E0E0' }]}>
                      <Text style={[styles.modalInfoLabel, { color: themeColors.textSecondary }]}>Statut</Text>
                      <Text style={[styles.modalInfoValue, { color: selectedAlert.status === 'active' ? '#E74C3C' : '#27AE60' }]}>
                        {getStatusLabel(selectedAlert.status)}
                      </Text>
                    </View>
                    <View style={[styles.modalInfoRow, { borderBottomColor: themeColors.border || '#E0E0E0' }]}>
                      <Text style={[styles.modalInfoLabel, { color: themeColors.textSecondary }]}>Position</Text>
                      <Text style={[styles.modalInfoValue, { color: themeColors.text }]}>
                        {selectedAlert.latitude}, {selectedAlert.longitude}
                      </Text>
                    </View>
                    <View style={[styles.modalInfoRow, { borderBottomColor: themeColors.border || '#E0E0E0' }]}>
                      <Text style={[styles.modalInfoLabel, { color: themeColors.textSecondary }]}>Date</Text>
                      <Text style={[styles.modalInfoValue, { color: themeColors.text }]}>
                        {selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString('fr-FR') : 'N/A'}
                      </Text>
                    </View>
                  </View>
                  {selectedAlert.status === 'active' && (
                    <TouchableOpacity
                      style={[styles.modalResolveButton, { backgroundColor: colors.success }]}
                      onPress={() => { setShowModal(false); handleResolve(selectedAlert.id); }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.modalResolveText}>Résoudre l'alerte</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.md },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.md },
  emptyText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.xs },
  listContent: { padding: spacing.md },
  card: { padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  alertType: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  status: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  severityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  severityText: { fontSize: 10, fontFamily: typography.fontFamily.medium },
  date: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 4 },
  resolveButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 8, alignSelf: 'flex-start', marginTop: spacing.sm },
  resolveButtonText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { borderRadius: 20, padding: spacing.lg, width: '92%', maxWidth: 420, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  modalSeverity: { alignItems: 'center', padding: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  modalSeverityText: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.xs },
  modalInfo: { gap: spacing.sm, marginBottom: spacing.md },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1 },
  modalInfoLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  modalInfoValue: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  modalResolveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: 12, gap: 8 },
  modalResolveText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
});

export default SOSAlertsScreen;