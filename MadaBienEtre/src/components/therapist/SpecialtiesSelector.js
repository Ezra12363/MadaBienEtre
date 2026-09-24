// src/components/therapist/SpecialtiesSelector.js

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { colors, typography } from '../../theme';
import therapistService from '../../services/therapistService';
import massageTypeService from '../../services/massageTypeService';
import adminService from '../../services/adminService';

const SpecialtiesSelector = ({ 
  onSpecialtiesChange,
  initialSpecialties = [],
  readOnly = false,
}) => {
  const { colors: themeColors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSelectorModal, setShowSelectorModal] = useState(false);

  // ✅ FIXÉ (BOUCLE INFINIE) : ity ref ity dia manakana ny
  // initial-load (useEffect eto ambany) tsy hiverimberina foana.
  // Talohan'ity, ilay useEffect dia niankina tamin'ny
  // `initialSpecialties` (array) sy `loadMySpecialties` (function
  // izay niankina tamin'ny `onSpecialtiesChange`) — raha ny parent
  // (ProfileScreen) dia mandefa reference vaovao amin'ireo isaky ny
  // re-render (ohatra: `initialSpecialties={profileData.specialty_ids || []}`
  // na `onSpecialtiesChange={(ids) => {...}}` tsy voa-`useCallback`),
  // dia mandeha indray hatrany ny effect → miantso
  // `loadMySpecialties()` → GET /therapists/me/specialties →
  // miantso `onSpecialtiesChange` → re-render ny parent → miverina
  // any amin'ny voalohany → boucle infinie → 429 Too many requests.
  const hasInitializedRef = useRef(false);

  // Charger les types de massage disponibles
  const loadMassageTypes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await massageTypeService.getActiveMassageTypes();
      if (result && result.length > 0) {
        setAvailableTypes(result);
      } else {
        // Fallback: utiliser les données initiales si l'API échoue
        setAvailableTypes([
          { id: 1, name: 'Massage Suédois', category: 'relaxant' },
          { id: 2, name: 'Deep Tissue', category: 'therapeutique' },
          { id: 3, name: 'Shiatsu', category: 'relaxant' },
          { id: 4, name: 'Réflexologie', category: 'reflexologie' },
          { id: 5, name: 'Massage Sportif', category: 'sportif' },
          { id: 6, name: 'Massage Prénatal', category: 'prenatal' },
          { id: 7, name: 'Pierres Chaudes', category: 'relaxant' },
        ]);
      }
    } catch (error) {
      console.error('Error loading massage types:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les spécialités du thérapeute
  const loadMySpecialties = useCallback(async () => {
    try {
      const result = await therapistService.getMySpecialties();
      if (result.success && result.data) {
        const ids = result.data.map(s => s.massage_type_id);
        setSelectedIds(ids);
        if (onSpecialtiesChange) {
          onSpecialtiesChange(ids);
        }
      } else if (initialSpecialties.length > 0) {
        setSelectedIds(initialSpecialties);
      }
    } catch (error) {
      console.error('Error loading specialties:', error);
    }
  }, [initialSpecialties, onSpecialtiesChange]);

  // Initialisation
  useEffect(() => {
    loadMassageTypes();
  }, [loadMassageTypes]);

  useEffect(() => {
    if (availableTypes.length === 0) return;
    // ✅ FIXÉ : io "guard" io no manakana ny boucle infinie. Ny
    // fanoloana an'ilay dependency array taloha
    // ([availableTypes, initialSpecialties, loadMySpecialties])
    // ho [availableTypes] fotsiny + ity condition ity dia manome
    // antoka fa ny fampidirana voalohany (initial load) dia
    // hitranga IN-1 MONJA isaky ny mount an'ity component ity, na
    // dia miova reference (array/function) aza ny props alefan'ny
    // parent isaky ny re-render.
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (initialSpecialties.length > 0) {
      // Filtrer les IDs valides
      const validIds = initialSpecialties.filter(id =>
        availableTypes.some(t => t.id === id)
      );
      setSelectedIds(validIds);
    } else {
      loadMySpecialties();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTypes]);

  // Toggle une spécialité
  const toggleSpecialty = (typeId) => {
    if (readOnly) return;
    
    setSelectedIds(prev => {
      if (prev.includes(typeId)) {
        return prev.filter(id => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };

  // Sauvegarder les spécialités
  const saveSpecialties = async () => {
    if (readOnly) return;
    if (selectedIds.length === 0) {
      Alert.alert(
        'Information',
        'Veuillez sélectionner au moins une spécialité.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await therapistService.updateMySpecialties(selectedIds);
      if (result.success) {
        Alert.alert(
          'Succès',
          'Vos spécialités ont été mises à jour avec succès.'
        );
        setShowSelectorModal(false);
        if (onSpecialtiesChange) {
          onSpecialtiesChange(selectedIds);
        }
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de mettre à jour les spécialités.');
      }
    } catch (_error) {
      Alert.alert('Erreur', 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  // Rendu d'un type de massage dans la liste
  const renderMassageTypeItem = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const imageUrl = item.icon_url || item.image_url;
    
    return (
      <TouchableOpacity
        style={[
          styles.typeItem,
          {
            backgroundColor: isSelected 
              ? `${colors.primary}15` 
              : themeColors.surface,
            borderColor: isSelected 
              ? colors.primary 
              : themeColors.border || '#E5E7EB',
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={() => toggleSpecialty(item.id)}
        disabled={readOnly || submitting}
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
            <Text style={[styles.typeName, { color: themeColors.text }]}>
              {item.name}
            </Text>
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

  // Rendu des spécialités sélectionnées (affichage compact)
  const renderSelectedSpecialties = () => {
    const selectedTypes = availableTypes.filter(t => selectedIds.includes(t.id));
    
    if (selectedTypes.length === 0) {
      return (
        <Text style={[styles.noSpecialtyText, { color: themeColors.textSecondary }]}>
          {readOnly ? 'Aucune spécialité définie' : 'Aucune spécialité sélectionnée'}
        </Text>
      );
    }

    return (
      <View style={styles.selectedTags}>
        {selectedTypes.map(type => (
          <View
            key={type.id}
            style={[styles.tag, { backgroundColor: `${colors.primary}12` }]}
          >
            <Text style={[styles.tagText, { color: colors.primary }]}>
              {type.name}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Chargement
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}12` }]}>
            <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: themeColors.text }]}>
              Spécialités
            </Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              {readOnly 
                ? 'Types de massage pratiqués' 
                : 'Sélectionnez vos types de massage'}
            </Text>
          </View>
        </View>

        {!readOnly && (
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: `${colors.primary}10` }]}
            onPress={() => setShowSelectorModal(true)}
            disabled={submitting}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={[styles.editButtonText, { color: colors.primary }]}>
              Modifier
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.specialtiesContainer}>
        {renderSelectedSpecialties()}
      </View>

      {/* Modal de sélection */}
      <Modal
        visible={showSelectorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSelectorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                  Mes spécialités
                </Text>
                <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                  Sélectionnez les types de massage que vous pratiquez
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSelectorModal(false)}
                disabled={submitting}
              >
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableTypes}
              renderItem={renderMassageTypeItem}
              keyExtractor={item => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="fitness-outline" size={40} color={themeColors.textSecondary} />
                  <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                    Aucun type de massage disponible
                  </Text>
                </View>
              }
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: themeColors.border || '#E5E7EB' }]}
                onPress={() => setShowSelectorModal(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalCancelText, { color: themeColors.text }]}>
                  Annuler
                </Text>
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
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.modalSaveText}>
                      Enregistrer ({selectedIds.length})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: typography.fontFamily?.regular || 'System',
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
    gap: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: typography.fontFamily?.bold || 'System',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: typography.fontFamily?.semiBold || 'System',
  },
  specialtiesContainer: {
    minHeight: 44,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: typography.fontFamily?.medium || 'System',
  },
  noSpecialtyText: {
    fontSize: 13,
    fontStyle: 'italic',
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
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: typography.fontFamily?.bold || 'System',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    paddingBottom: 12,
  },
  typeItem: {
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  typeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  typeIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: typography.fontFamily?.semiBold || 'System',
  },
  typeCategory: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: typography.fontFamily?.regular || 'System',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
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
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: typography.fontFamily?.semiBold || 'System',
  },
  modalSaveButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.fontFamily?.bold || 'System',
  },
});

export default SpecialtiesSelector;