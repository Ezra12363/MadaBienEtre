// src/screens/shared/SOSScreenBase.js
// Écran SOS commun client / thérapeute (les deux écrans étaient identiques).
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import SOSButton from '../../components/sos/SOSButton';
import EmergencyContactCard from '../../components/sos/EmergencyContactCard';
import EmergencyContactForm from '../../components/sos/EmergencyContactForm';
import SafetyCheckCard from '../../components/sos/SafetyCheckCard';
import { confirmAction, notify } from '../../utils/confirm';
import sosService, { EMERGENCY_NUMBERS } from '../../services/sosService';

const SOSScreenBase = ({ route }) => {
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const bookingId = route?.params?.bookingId;

  const [location, setLocation] = useState(null); // { latitude, longitude, address }
  const [locError, setLocError] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadLocation = useCallback(async () => {
    setLocError(null);
    const r = await sosService.getCurrentLocation();
    if (!r.success) {
      setLocError(r.error);
      return;
    }
    const address = await sosService.getAddress(r.data.latitude, r.data.longitude);
    setLocation({ ...r.data, address });
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    const r = await sosService.getContacts();
    if (r.success) setContacts(r.data || []);
    setLoadingContacts(false);
  }, []);

  useEffect(() => {
    loadLocation();
    loadContacts();
  }, [loadLocation, loadContacts]);

  const openAdd = () => {
    setEditing(null);
    setFormError('');
    setFormVisible(true);
  };

  const openEdit = (contact) => {
    setEditing(contact);
    setFormError('');
    setFormVisible(true);
  };

  const saveContact = async (payload) => {
    setSaving(true);
    setFormError('');
    const r = editing ? await sosService.updateContact(editing.id, payload) : await sosService.addContact(payload);
    setSaving(false);
    if (!r.success) {
      setFormError(r.error);
      return;
    }
    setFormVisible(false);
    loadContacts();
  };

  const deleteContact = (contact) => {
    confirmAction({
      title: 'Supprimer le contact',
      message: `Supprimer ${contact.name} de vos contacts d'urgence ?`,
      confirmText: 'Supprimer',
      destructive: true,
      onConfirm: async () => {
        const r = await sosService.deleteContact(contact.id);
        if (!r.success) notify('Erreur', r.error);
        loadContacts();
      },
    });
  };

  const shareMyLocation = async () => {
    if (!location) return Alert.alert('Position', locError || 'Position indisponible pour le moment');
    const link = sosService.getGoogleMapsLink(location.latitude, location.longitude);
    const msg = `Voici ma position${location.address ? ` (${location.address})` : ''} : ${link}`;
    const primary = contacts.find((c) => c.is_primary) || contacts[0];
    Linking.openURL(`sms:${primary ? primary.phone : ''}?body=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir les messages")
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="SOS - Urgence" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SOSButton variant="hero" bookingId={bookingId} />

        <Text style={[styles.description, { color: themeColors.textSecondary }]}>
          Un appui, puis une confirmation : votre position GPS est envoyée à notre équipe et à vos
          contacts d'urgence. Les secours ne sont pas prévenus automatiquement.
        </Text>

        {/* Position */}
        <View style={[styles.locationCard, { backgroundColor: themeColors.surface }]}>
          <Ionicons name={location ? 'location' : 'location-outline'} size={24} color={locError ? colors.error : colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.locationLabel, { color: themeColors.text }]}>Votre position</Text>
            {location ? (
              <>
                {!!location.address && (
                  <Text style={[styles.locationCoords, { color: themeColors.text }]} numberOfLines={2}>
                    {location.address}
                  </Text>
                )}
                <Text style={[styles.locationCoords, { color: themeColors.textSecondary }]}>
                  {sosService.formatCoordinates(location.latitude, location.longitude)}
                </Text>
              </>
            ) : (
              <Text style={[styles.locationCoords, { color: locError ? colors.error : themeColors.textSecondary }]}>
                {locError || 'Localisation en cours...'}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={loadLocation} style={styles.iconBtn}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={shareMyLocation} style={styles.iconBtn}>
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Safety check (si réservation) */}
        <SafetyCheckCard bookingId={bookingId} role={user?.role} />

        {/* Mes contacts d'urgence */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Mes contacts d'urgence</Text>
            <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {loadingContacts ? (
            <ActivityIndicator color={colors.primary} />
          ) : contacts.length === 0 ? (
            <Text style={[styles.empty, { color: themeColors.textSecondary }]}>
              Aucun contact. Ajoutez un proche : il sera prévenu par SMS en cas d'alerte SOS.
            </Text>
          ) : (
            contacts.map((c) => (
              <EmergencyContactCard key={c.id} contact={c} onEdit={openEdit} onDelete={deleteContact} />
            ))
          )}
        </View>

        {/* Numéros d'urgence locaux */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Numéros d'urgence</Text>
          <View style={styles.grid}>
            {EMERGENCY_NUMBERS.map((n) => (
              <TouchableOpacity
                key={n.number}
                style={[styles.numberCard, { backgroundColor: themeColors.surface }]}
                onPress={() => Linking.openURL(`tel:${n.number}`)}
                activeOpacity={0.7}
              >
                <Ionicons name={n.icon} size={28} color={colors.error} />
                <Text style={[styles.numberName, { color: themeColors.text }]}>{n.name}</Text>
                <Text style={styles.numberValue}>{n.number}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.tipsCard, { backgroundColor: colors.error + '10' }]}>
          <Ionicons name="bulb-outline" size={24} color={colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tipsTitle, { color: colors.error }]}>Conseils de sécurité</Text>
            <Text style={[styles.tipsText, { color: themeColors.text }]}>• Restez calme et en sécurité</Text>
            <Text style={[styles.tipsText, { color: themeColors.text }]}>• Envoyez votre position à un proche</Text>
            <Text style={[styles.tipsText, { color: themeColors.text }]}>• Appelez les secours si nécessaire</Text>
          </View>
        </View>
      </ScrollView>

      <EmergencyContactForm
        visible={formVisible}
        contact={editing}
        saving={saving}
        error={formError}
        onSave={saveContact}
        onClose={() => setFormVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  description: {
    textAlign: 'center', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular,
    lineHeight: 22, paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  locationCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 12,
    marginBottom: spacing.md, gap: spacing.sm, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  locationLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  locationCoords: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
  iconBtn: { padding: 6 },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16 },
  addBtnText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  empty: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, lineHeight: 20 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  numberCard: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: 'center', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  numberName: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, marginTop: 4 },
  numberValue: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: colors.error },
  tipsCard: { flexDirection: 'row', padding: spacing.md, borderRadius: 12, marginBottom: spacing.md, gap: spacing.md },
  tipsTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, marginBottom: 4 },
  tipsText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, lineHeight: 22 },
});

export default SOSScreenBase;
