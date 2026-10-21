// src/screens/admin/UserDetailScreen.js
//
// PAGE « Détails utilisateur » (remplace l'ancienne modale de UsersScreen).
// Ouverte depuis la liste : navigation.navigate('UserDetail', { userId, user })
//   - la barre de navigation (TopNavBar / onglets) reste affichée ;
//   - toutes les informations et actions de l'ancienne modale sont ici :
//     infos générales, profil thérapeute (CIN, certificat, spécialités, bio),
//     statut du compte, adresse, modifier, activer/désactiver, reset mot de
//     passe, supprimer.

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';
import adminService from '../../services/adminService';
import AdminUserAddressModal from '../../components/admin/AdminUserAddressModal';
import AdminSpecialtiesManager from '../../components/admin/AdminSpecialtiesManager';
import {
  IS_WEB,
  ActionButton,
  ActionRow,
  AdminConfirmDialog,
  AdminImageViewer,
  Badge,
  DetailAvatar,
  DetailCard,
  DetailColumns,
  DetailLoading,
  DetailNotFound,
  DetailScaffold,
  DocumentBlock,
  InfoGrid,
  InfoItem,
  ProfileHero,
  downloadAdminDocument,
  formatDate,
  getFullAddress,
  useAdminToast,
} from '../../components/admin/AdminDetailKit';

/* ============================================================
   HELPERS
============================================================ */

const getRoleColor = (role) => {
  const map = { CLIENT: '#2196F3', THERAPIST: '#4CAF50', ADMIN: '#D32F2F' };
  return map[role] || '#757575';
};

const getRoleLabel = (role) => {
  const map = { CLIENT: 'Client', THERAPIST: 'Thérapeute', ADMIN: 'Admin' };
  return map[role] || role || 'N/A';
};

const getStatusColor = (isActive) => (isActive ? '#27AE60' : '#E74C3C');
const getStatusLabel = (isActive) => (isActive ? 'Actif' : 'Inactif');

const getVerification = (status) => {
  if (status === 'approved') return { label: '✅ Vérifié', color: '#27AE60' };
  if (status === 'pending') return { label: '⏳ En attente', color: '#F5A623' };
  return { label: '❌ Rejeté', color: '#E74C3C' };
};

/* ============================================================
   SCREEN
============================================================ */

const UserDetailScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();

  const initialUser = route?.params?.user || null;
  const userId = route?.params?.userId ?? initialUser?.id;

  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [editMode, setEditMode] = useState(!!route?.params?.edit);
  const [editData, setEditData] = useState({
    fullname: initialUser?.fullname || '',
    email: initialUser?.email || '',
    phone: initialUser?.phone || '',
    bio: initialUser?.bio || '',
  });
  const [saving, setSaving] = useState(false);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [viewer, setViewer] = useState(null);

  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const { toast, showToast } = useAdminToast();

  const mounted = useRef(true);
  const userRef = useRef(initialUser);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /* ----------------------------------------------------------
     CHARGEMENT — même source que la liste (GET /users), pour
     garder exactement les mêmes champs que l'ancienne modale.
  ---------------------------------------------------------- */

  const fetchUser = useCallback(async () => {
    try {
      let found = null;

      for (const showDeleted of [false, true]) {
        const data = await adminService.getUsers({ limit: 200, showDeleted });

        if (Array.isArray(data)) {
          found = data.find((u) => String(u.id) === String(userId));
          if (found) break;
        }
      }

      if (!mounted.current) return null;

      if (found) {
        setUser(found);
        setNotFound(false);
        return found;
      }

      if (!userRef.current) setNotFound(true);
    } catch (err) {
      console.error('❌ Erreur chargement utilisateur:', err);
      if (mounted.current && !userRef.current) setNotFound(true);
    }

    return null;
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      fetchUser().finally(() => {
        if (active && mounted.current) setLoading(false);
      });

      return () => {
        active = false;
      };
    }, [fetchUser])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
    if (mounted.current) setRefreshing(false);
  };

  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('UsersMain');
    }
  }, [navigation]);

  /* ----------------------------------------------------------
     CONFIRMATION GÉNÉRIQUE
  ---------------------------------------------------------- */

  const handleConfirm = async () => {
    if (!confirm) return;

    setConfirmBusy(true);

    try {
      await confirm.run();
    } catch (error) {
      console.error('❌ Action utilisateur:', error);
      if (mounted.current) {
        showToast(
          `${confirm.errorPrefix}: ${error?.message || 'Erreur serveur'}`,
          'error'
        );
      }
    } finally {
      if (mounted.current) {
        setConfirm(null);
        setConfirmBusy(false);
      }
    }
  };

  /* ----------------------------------------------------------
     MODIFIER
  ---------------------------------------------------------- */

  const startEdit = () => {
    setEditData({
      fullname: user?.fullname || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
    });
    setEditMode(true);
  };

  const handleUpdateUser = async () => {
    if (!user?.id) return;

    setSaving(true);

    try {
      await adminService.updateUser(user.id, {
        fullname: editData.fullname || user.fullname,
        email: editData.email || user.email,
        phone: editData.phone || user.phone,
        bio: editData.bio || user.bio,
      });

      setEditMode(false);
      await fetchUser();
      showToast('Utilisateur mis à jour avec succès', 'success');
    } catch (error) {
      showToast(`Impossible de mettre à jour: ${error?.message || 'Erreur serveur'}`, 'error');
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  /* ----------------------------------------------------------
     ACTIVER / DÉSACTIVER
  ---------------------------------------------------------- */

  const requestToggleActive = () => {
    if (!user?.id) return;

    const newStatus = !user.is_active;
    const action = newStatus ? 'activer' : 'désactiver';
    const actionPast = newStatus ? 'activé' : 'désactivé';

    setConfirm({
      title: newStatus ? 'Activer le compte' : 'Désactiver le compte',
      message: `Voulez-vous ${action} le compte de ${user.fullname || 'cet utilisateur'} ?`,
      confirmText: newStatus ? 'Activer' : 'Désactiver',
      destructive: !newStatus,
      errorPrefix: `Impossible de ${action} le compte`,
      run: async () => {
        await adminService.toggleUserStatus(user.id, newStatus, 'Action par admin');
        setUser((prev) => (prev ? { ...prev, is_active: newStatus } : prev));
        await fetchUser();
        showToast(`Compte ${actionPast} avec succès`, 'success');
      },
    });
  };

  /* ----------------------------------------------------------
     RÉINITIALISER LE MOT DE PASSE
  ---------------------------------------------------------- */

  const requestResetPassword = () => {
    if (!user?.id) return;

    setConfirm({
      title: '🔑 Réinitialiser le mot de passe',
      message: `Voulez-vous réinitialiser le mot de passe de ${user.fullname || 'cet utilisateur'} ?\n\nUn nouveau mot de passe sera généré.`,
      confirmText: 'Réinitialiser',
      destructive: false,
      errorPrefix: 'Impossible de réinitialiser',
      run: async () => {
        const result = await adminService.resetUserPassword(user.id, true);

        setUser((prev) => (prev ? { ...prev, ...result } : prev));
        await fetchUser();

        const email = result?.email || user.email || '';
        const newPassword = result?.new_password || 'Vérifiez vos emails';

        if (IS_WEB) {
          window.alert(
            `Mot de passe réinitialisé avec succès.\n\nEmail : ${email}\nNouveau mot de passe : ${newPassword}`
          );
        } else {
          Alert.alert(
            'Succès',
            `Mot de passe réinitialisé avec succès\n\n📧 Email: ${email}\n🔑 Nouveau mot de passe: ${newPassword}`,
            [{ text: 'OK' }]
          );
        }

        showToast('Mot de passe réinitialisé avec succès', 'success');
      },
    });
  };

  /* ----------------------------------------------------------
     SUPPRIMER (définitif) -> retour à la liste
  ---------------------------------------------------------- */

  const requestDelete = () => {
    if (!user?.id) return;

    setConfirm({
      title: '⚠️ Suppression définitive',
      message: `Voulez-vous supprimer définitivement ${user.fullname || 'cet utilisateur'} ?\n\nCette action est irréversible !`,
      confirmText: 'Supprimer',
      destructive: true,
      errorPrefix: 'Impossible de supprimer',
      run: async () => {
        await adminService.deleteUser(user.id, true);
        goBack();
      },
    });
  };

  /* ----------------------------------------------------------
     DOCUMENTS
  ---------------------------------------------------------- */

  const openViewer = (uri, title, fileName) => {
    if (!uri) return;
    setViewer({ uri, title, fileName });
  };

  const download = (url, fileName) => downloadAdminDocument(url, fileName, showToast);

  /* ============================================================
     RENDER
  ============================================================ */

  if (loading) {
    return (
      <DetailScaffold title="Détails utilisateur" toast={toast}>
        <DetailLoading text="Chargement de l'utilisateur..." />
      </DetailScaffold>
    );
  }

  if (!user) {
    return (
      <DetailScaffold title="Détails utilisateur" toast={toast}>
        <DetailNotFound
          text={notFound ? 'Utilisateur introuvable' : 'Impossible de charger l’utilisateur'}
          onBack={goBack}
        />
      </DetailScaffold>
    );
  }

  const isTherapist = user.role === 'THERAPIST';
  const roleColor = getRoleColor(user.role);
  const verification = getVerification(user.verification_status);
  const hasCin = !!(user.cin_number && String(user.cin_number).trim() !== '');
  const displayName = user.fullname || 'Utilisateur';

  /* ---------------- PROFIL ---------------- */

  const hero = (
    <ProfileHero
      avatar={
        <DetailAvatar
          uri={user.profile_image}
          name={user.fullname}
          color={roleColor}
          size={88}
          online={isTherapist ? !!user.is_online : undefined}
        />
      }
      name={displayName}
      email={user.email || 'Email inconnu'}
      deleted={!!user.deleted_at}
      badges={
        <>
          <Badge label={getRoleLabel(user.role)} color={roleColor} />
          <Badge label={getStatusLabel(user.is_active)} color={getStatusColor(user.is_active)} />
          {isTherapist ? (
            <Badge
              label={user.is_online ? 'En ligne' : 'Hors ligne'}
              color={user.is_online ? '#27AE60' : '#999999'}
              dot
            />
          ) : null}
        </>
      }
    />
  );

  /* ---------------- STATUT + ACTIONS ---------------- */

  const side = editMode ? null : (
    <>
      <DetailCard title="Statut du compte" icon="power-outline">
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={[styles.switchTitle, { color: themeColors.text }]}>
              {user.is_active ? 'Compte actif' : 'Compte inactif'}
            </Text>
            <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>
              Activer ou désactiver le compte
            </Text>
          </View>

          <Switch
            value={!!user.is_active}
            onValueChange={requestToggleActive}
            trackColor={{ false: '#D0D0D0', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </DetailCard>

      <DetailCard title="Actions" icon="flash-outline">
        <ActionRow>
          <ActionButton icon="create-outline" label="Modifier" color="#2196F3" onPress={startEdit} />
          <ActionButton
            icon={user.is_active ? 'person-remove-outline' : 'person-add-outline'}
            label={user.is_active ? 'Désactiver' : 'Activer'}
            color={user.is_active ? '#F5A623' : '#27AE60'}
            onPress={requestToggleActive}
          />
          <ActionButton
            icon="key-outline"
            label="Réinitialiser le mot de passe"
            color="#9C27B0"
            onPress={requestResetPassword}
          />
          <ActionButton icon="trash-outline" label="Supprimer" color="#E74C3C" onPress={requestDelete} />
        </ActionRow>
      </DetailCard>
    </>
  );

  /* ---------------- FORMULAIRE DE MODIFICATION ---------------- */

  const inputStyle = [
    styles.input,
    { color: themeColors.text, borderColor: themeColors.border || '#E0E0E0' },
  ];

  const editCard = (
    <DetailCard title="Modifier l'utilisateur" icon="create-outline">
      <Text style={[styles.label, { color: themeColors.textSecondary }]}>Nom complet *</Text>
      <TextInput
        style={inputStyle}
        value={editData.fullname}
        onChangeText={(text) => setEditData((prev) => ({ ...prev, fullname: text }))}
        placeholder="Nom complet"
        placeholderTextColor={themeColors.textSecondary}
      />

      <Text style={[styles.label, { color: themeColors.textSecondary }]}>Email *</Text>
      <TextInput
        style={inputStyle}
        value={editData.email}
        onChangeText={(text) => setEditData((prev) => ({ ...prev, email: text }))}
        placeholder="Email"
        placeholderTextColor={themeColors.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={[styles.label, { color: themeColors.textSecondary }]}>Téléphone *</Text>
      <TextInput
        style={inputStyle}
        value={editData.phone}
        onChangeText={(text) => setEditData((prev) => ({ ...prev, phone: text }))}
        placeholder="Téléphone"
        placeholderTextColor={themeColors.textSecondary}
        keyboardType="phone-pad"
      />

      {isTherapist ? (
        <>
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Biographie</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            value={editData.bio}
            onChangeText={(text) => setEditData((prev) => ({ ...prev, bio: text }))}
            placeholder="Biographie"
            placeholderTextColor={themeColors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </>
      ) : null}

      <View style={styles.editButtons}>
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: themeColors.background }]}
          onPress={() => setEditMode(false)}
          disabled={saving}
        >
          <Text style={[styles.editButtonText, { color: themeColors.text }]}>Annuler</Text>
        </TouchableOpacity>

        <ActionButton
          icon="save-outline"
          label="Enregistrer"
          color={colors.primary}
          onPress={handleUpdateUser}
          loading={saving}
        />
      </View>
    </DetailCard>
  );

  /* ---------------- DÉTAILS ---------------- */

  const detailCards = (
    <>
      <DetailCard title="Informations générales" icon="person-outline">
        <InfoGrid>
          <InfoItem icon="call-outline" label="Téléphone" value={user.phone || 'N/A'} />
          <InfoItem icon="shield-checkmark-outline" label="Rôle" value={getRoleLabel(user.role)} valueColor={roleColor} />
          <InfoItem
            icon="pulse-outline"
            label="Statut"
            value={getStatusLabel(user.is_active)}
            valueColor={getStatusColor(user.is_active)}
          />
          <InfoItem icon="calendar-outline" label="Inscrit le" value={formatDate(user.created_at)} />
          {user.deleted_at ? (
            <InfoItem icon="trash-outline" label="Supprimé le" value={formatDate(user.deleted_at)} valueColor="#E74C3C" />
          ) : null}
          <InfoItem icon="location-outline" label="Adresse" value={getFullAddress(user)} full />
        </InfoGrid>
      </DetailCard>

      {isTherapist ? (
        <>
          <DetailCard title="Profil thérapeute" icon="fitness-outline">
            <InfoGrid>
              <InfoItem
                icon="star-outline"
                label="Note"
                value={`⭐ ${user.rating || 0} (${user.total_reviews || 0} avis)`}
                valueColor="#F5A623"
              />
              <InfoItem
                icon="ribbon-outline"
                label="Vérification"
                value={verification.label}
                valueColor={verification.color}
              />
              <InfoItem
                icon="radio-button-on-outline"
                label="Statut en ligne"
                value={user.is_online ? '🟢 En ligne' : '🔴 Hors ligne'}
                valueColor={user.is_online ? '#27AE60' : '#999999'}
              />
              <InfoItem
                icon="card-outline"
                label="N° CIN"
                value={hasCin ? user.cin_number : 'Non renseigné'}
                valueColor={hasCin ? colors.primary : '#E74C3C'}
              />
              {user.bio ? <InfoItem icon="document-text-outline" label="Biographie" value={user.bio} full /> : null}
            </InfoGrid>
          </DetailCard>

          <DetailCard title="Pièce d'identité — CIN" icon="card-outline">
            <DocumentBlock
              url={user.identity_document_url}
              viewerTitle={`Pièce d'identité (CIN) — ${user.fullname || 'Thérapeute'}`}
              fileName={`CIN_${user.fullname || 'therapeute'}.jpg`}
              downloadLabel="Télécharger la CIN"
              missingText="Aucune photo du CIN n'a été téléversée."
              onOpen={openViewer}
              onDownload={download}
            />
          </DetailCard>

          <DetailCard title="Certificat professionnel" icon="ribbon-outline">
            <DocumentBlock
              url={user.certificate_professionnel}
              viewerTitle={`Certificat professionnel — ${user.fullname || 'Thérapeute'}`}
              fileName={`Certificat_${user.fullname || 'therapeute'}.jpg`}
              downloadLabel="Télécharger le certificat"
              missingText="Aucun certificat professionnel téléversé par ce thérapeute."
              onOpen={openViewer}
              onDownload={download}
            />
          </DetailCard>

          <DetailCard title="Spécialités" icon="leaf-outline">
            <AdminSpecialtiesManager
              therapistId={user.id}
              therapistName={user.fullname}
              variant="compact"
            />
          </DetailCard>
        </>
      ) : null}

      <DetailCard title="Adresse" icon="location-outline">
        <View
          style={[
            styles.addressBox,
            { backgroundColor: colors.primary + '08', borderColor: colors.primary + '25' },
          ]}
        >
          <View style={[styles.addressIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="location" size={21} color={colors.primary} />
          </View>
          <View style={styles.addressTextWrap}>
            <Text style={[styles.addressTitle, { color: themeColors.text }]}>Adresse enregistrée</Text>
            <Text style={[styles.addressText, { color: themeColors.textSecondary }]} selectable>
              {getFullAddress(user)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowAddressModal(true)}
          style={[styles.addressButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="map-outline" size={18} color="#fff" />
          <Text style={styles.addressButtonText}>Modifier l'adresse sur la carte</Text>
        </TouchableOpacity>
      </DetailCard>
    </>
  );

  return (
    <DetailScaffold
      title={editMode ? "Modifier l'utilisateur" : 'Détails utilisateur'}
      subtitle={displayName}
      toast={toast}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <DetailColumns top={hero} side={side} main={editMode ? editCard : detailCards} />

      <AdminImageViewer
        viewer={viewer}
        onClose={() => setViewer(null)}
        onDownload={download}
      />

      <AdminUserAddressModal
        visible={showAddressModal}
        userId={user.id}
        userName={user.fullname}
        onClose={() => setShowAddressModal(false)}
        onSaved={() => {
          fetchUser();
        }}
      />

      <AdminConfirmDialog
        visible={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        destructive={!!confirm?.destructive}
        loading={confirmBusy}
        onConfirm={handleConfirm}
        onCancel={() => !confirmBusy && setConfirm(null)}
      />
    </DetailScaffold>
  );
};

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchTextWrap: { flex: 1 },
  switchTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  switchSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },

  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 10,
    minHeight: 46,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  textArea: { minHeight: 100, paddingTop: 11 },
  editButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  editButton: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: { fontSize: 14, fontWeight: '700' },

  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  addressIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addressTextWrap: { flex: 1, minWidth: 0 },
  addressTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  addressText: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    minHeight: 46,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  addressButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default UserDetailScreen;
