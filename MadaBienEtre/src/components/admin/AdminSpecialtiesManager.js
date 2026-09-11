// src/components/admin/AdminSpecialtiesManager.js
//
// ✅ NOUVEAU COMPOSANT
// Affiche, dans le panneau admin, toutes les spécialités (types de
// massage) d'un thérapeute donné, et permet à l'administrateur de
// les modifier (remplace donc l'affichage "brut" + l'absence totale
// de gestion des spécialités côté admin).
//
// Utilisation :
//   <AdminSpecialtiesManager
//     therapistId={selected.id}
//     therapistName={selected.fullname}
//     variant="compact"        // "compact" (Approvals) | "card" (Therapists)
//     onUpdated={(ids) => {...}} // optionnel
//   />
//
// Dépend de :
//   - therapistService.getTherapistSpecialties(therapistId)  (GET, déjà existant)
//   - adminService.updateTherapistSpecialties(therapistId, ids) (PUT, nouveau)
//   - massageTypeService.getActiveMassageTypes()             (déjà existant)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, typography, spacing } from '../../theme';
import therapistService from '../../services/therapistService';
import massageTypeService from '../../services/massageTypeService';
import adminService from '../../services/adminService';

const AdminSpecialtiesManager = ({
  therapistId,
  therapistName = '',
  variant = 'card', // 'card' (fond dédié + titre) | 'compact' (s'intègre dans une section existante)
  onUpdated,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [specialties, setSpecialties] = useState([]); // [{id, massage_type_id, massage_type_name}]
  const [availableTypes, setAvailableTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);

  // ============================================================
  // CHARGER LES SPÉCIALITÉS ACTUELLES DU THÉRAPEUTE
  // ============================================================
  const loadSpecialties = useCallback(async () => {
    if (!therapistId) {
      setSpecialties([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await therapistService.getTherapistSpecialties(therapistId);
      if (result.success && Array.isArray(result.data)) {
        setSpecialties(result.data);
      } else {
        setSpecialties([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement spécialités (admin):', error);
      setSpecialties([]);
    } finally {
      setLoading(false);
    }
  }, [therapistId]);

  useEffect(() => {
    loadSpecialties();
  }, [loadSpecialties]);

  // ============================================================
  // CHARGER LES TYPES DE MASSAGE DISPONIBLES (pour l'édition)
  // ============================================================
  const loadAvailableTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const result = await massageTypeService.getActiveMassageTypes();
      setAvailableTypes(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('❌ Erreur chargement types de massage:', error);
      setAvailableTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const openEditModal = () => {
    setSelectedIds(specialties.map((s) => s.massage_type_id));
    setShowEditModal(true);
    if (availableTypes.length === 0) {
      loadAvailableTypes();
    }
  };

  const toggleType = (typeId) => {
    setSelectedIds((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  };

  // ============================================================
  // ENREGISTRER (ADMIN)
  // ============================================================
  const saveSpecialties = async () => {
    setSubmitting(true);
    try {
      const result = await adminService.updateTherapistSpecialties(therapistId, selectedIds);
      if (result.success) {
        setShowEditModal(false);
        await loadSpecialties();
        if (onUpdated) onUpdated(selectedIds);
        Alert.alert(
          'Succès',
          result.data?.certificate_regenerated
            ? `Spécialités mises à jour pour ${therapistName || 'ce thérapeute'}. Le certificat officiel a été régénéré.`
            : `Spécialités mises à jour pour ${therapistName || 'ce thérapeute'}.`
        );
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de mettre à jour les spécialités.');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // RENDU : TAGS DES SPÉCIALITÉS ACTUELLES
  // ============================================================
  const renderTags = () => {
    if (loading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Chargement des spécialités...
          </Text>
        </View>
      );
    }

    if (specialties.length === 0) {
      return (
        <Text style={[styles.noSpecialtyText, { color: themeColors.textSecondary }]}>
          Aucune spécialité déclarée par ce thérapeute.
        </Text>
      );
    }

    return (
      <View style={styles.tagsWrap}>
        {specialties.map((s) => (
          <View key={s.id} style={[styles.tag, { backgroundColor: `${colors.primary}12` }]}>
            <Text style={[styles.tagText, { color: colors.primary }]}>
              {s.massage_type_name || `Type #${s.massage_type_id}`}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // ============================================================
  // RENDU D'UN ITEM DE LA LISTE DE SÉLECTION (modal d'édition)
  // ============================================================
  const renderMassageTypeItem = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const imageUrl = item.icon_url || item.image_url;

    return (
      <TouchableOpacity
        style={[
          styles.typeItem,
          {
            backgroundColor: isSelected ? `${colors.primary}15` : themeColors.surface,
            borderColor: isSelected ? colors.primary : themeColors.border || '#E5E7EB',
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={() => toggleType(item.id)}
        disabled={submitting}
        activeOpacity={0.75}
      >
        <View style={styles.typeItemContent}>
          {imageUrl ? (
            <Image
              source={{ uri: adminService.getMassageImageUrl(imageUrl) }}
              style={styles.typeIcon}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.typeIconPlaceholder, { backgroundColor: `${colors.primary}12` }]}>
              <Ionicons name="fitness-outline" size={20} color={colors.primary} />
            </View>
          )}

          <View style={styles.typeInfo}>
            <Text style={[styles.typeName, { color: themeColors.text }]}>{item.name}</Text>
            {item.category && (
              <Text style={[styles.typeCategory, { color: themeColors.textSecondary }]}>
                {item.category}
              </Text>
            )}
          </View>

          {isSelected ? (
            <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.emptyCheckmark} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {variant === 'card' && (
            <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}12` }]}>
              <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
            </View>
          )}
          <Text
            style={[
              variant === 'card' ? styles.title : styles.compactTitle,
              { color: themeColors.text },
            ]}
          >
            Spécialités
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: `${colors.primary}10` }]}
          onPress={openEditModal}
          disabled={loading || submitting}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={[styles.editButtonText, { color: colors.primary }]}>Modifier</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tagsContainer}>{renderTags()}</View>

      {/* Modal d'édition (admin) */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border || '#E5E7EB' },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                  Gérer les spécialités
                </Text>
                <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                  {therapistName || 'Thérapeute'} — modification administrateur
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                disabled={submitting}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            {loadingTypes ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                  Chargement des types de massage...
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableTypes}
                renderItem={renderMassageTypeItem}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalList}
                style={{ maxHeight: 380 }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="fitness-outline" size={36} color={themeColors.textSecondary} />
                    <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                      Aucun type de massage disponible
                    </Text>
                  </View>
                }
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: themeColors.border || '#E5E7EB' }]}
                onPress={() => setShowEditModal(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalCancelText, { color: themeColors.text }]}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, { backgroundColor: colors.primary }]}
                onPress={saveSpecialties}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSaveText}>Enregistrer ({selectedIds.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  if (variant === 'compact') {
    return <View style={styles.compactContainer}>{content}</View>;
  }

  return (
    <View
      style={[
        styles.cardContainer,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FAFAFA', borderColor: themeColors.border || '#E5E7EB' },
      ]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  compactContainer: {
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.fontFamily?.bold || 'System',
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fontFamily?.bold || 'System',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: typography.fontFamily?.semiBold || 'System',
  },
  tagsContainer: {
    minHeight: 30,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: typography.fontFamily?.medium || 'System',
  },
  noSpecialtyText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: typography.fontFamily?.bold || 'System',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 3,
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    paddingBottom: 8,
  },
  typeItem: {
    borderRadius: 12,
    marginBottom: 8,
    padding: 10,
  },
  typeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  typeIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: typography.fontFamily?.semiBold || 'System',
  },
  typeCategory: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: typography.fontFamily?.semiBold || 'System',
  },
  modalSaveButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fontFamily?.bold || 'System',
  },
});

export default AdminSpecialtiesManager;