// src/screens/admin/TherapistDetailScreen.js
//
// PAGE « Détails du thérapeute » (remplace l'ancienne modale de
// TherapistsScreen). Ouverte depuis la liste :
//   navigation.navigate('TherapistDetail', { therapistId, therapist })
// La barre de navigation reste affichée ; toutes les informations et
// actions de l'ancienne modale sont conservées.

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AdminTherapistReviewsCard from '../../components/reviews/AdminTherapistReviewsCard';

import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';
import adminService from '../../services/adminService';
import AdminUserAddressModal from '../../components/admin/AdminUserAddressModal';
import AdminSpecialtiesManager from '../../components/admin/AdminSpecialtiesManager';
import {
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
  formatMoney,
  getFullAddress,
  getLatitude,
  getLongitude,
  useAdminToast,
} from '../../components/admin/AdminDetailKit';

/* ============================================================
   HELPERS
============================================================ */

const getStatusColor = (status) => {
  const map = { approved: '#27AE60', pending: '#F5A623', rejected: '#E74C3C' };
  return map[status] || '#999999';
};

const getStatusLabel = (status) => {
  const map = { approved: 'Vérifié', pending: 'En attente', rejected: 'Rejeté' };
  return map[status] || 'Non défini';
};

const getActiveStatusColor = (active) => (active ? '#27AE60' : '#E74C3C');
const getActiveStatusLabel = (active) => (active ? 'Actif' : 'Inactif');

/* ============================================================
   SCREEN
============================================================ */

const TherapistDetailScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();

  const initialTherapist = route?.params?.therapist || null;
  const therapistId = route?.params?.therapistId ?? initialTherapist?.id;

  const [therapist, setTherapist] = useState(initialTherapist);
  const [loading, setLoading] = useState(!initialTherapist);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [certificateInfo, setCertificateInfo] = useState(null);
  const [loadingCertificate, setLoadingCertificate] = useState(false);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [viewer, setViewer] = useState(null);

  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const { toast, showToast } = useAdminToast();

  const mounted = useRef(true);
  const therapistRef = useRef(initialTherapist);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    therapistRef.current = therapist;
  }, [therapist]);

  /* ----------------------------------------------------------
     CHARGEMENT — même source que la liste (getTherapists)
  ---------------------------------------------------------- */

  const fetchTherapist = useCallback(async () => {
    try {
      const data = await adminService.getTherapists({ limit: 200 });

      if (!mounted.current) return null;

      if (Array.isArray(data)) {
        const found = data.find((t) => String(t.id) === String(therapistId));

        if (found) {
          setTherapist(found);
          setNotFound(false);
          return found;
        }
      }

      if (!therapistRef.current) setNotFound(true);
    } catch (err) {
      console.error('❌ Erreur chargement thérapeute:', err);
      if (mounted.current && !therapistRef.current) setNotFound(true);
    }

    return null;
  }, [therapistId]);

  const loadCertificateInfo = useCallback(async () => {
    if (!therapistId) return;

    setLoadingCertificate(true);

    try {
      const data = await adminService.getTherapistCertificateInfo(therapistId);
      if (mounted.current) setCertificateInfo(data);
    } catch (err) {
      console.error('❌ Erreur certificat:', err);
      if (mounted.current) setCertificateInfo(null);
    } finally {
      if (mounted.current) setLoadingCertificate(false);
    }
  }, [therapistId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      fetchTherapist().finally(() => {
        if (active && mounted.current) setLoading(false);
      });
      loadCertificateInfo();

      return () => {
        active = false;
      };
    }, [fetchTherapist, loadCertificateInfo])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTherapist(), loadCertificateInfo()]);
    if (mounted.current) setRefreshing(false);
  };

  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('Therapists');
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
      console.error('❌ Action thérapeute:', error);
      if (mounted.current) showToast(confirm.errorMessage, 'error');
    } finally {
      if (mounted.current) {
        setConfirm(null);
        setConfirmBusy(false);
      }
    }
  };

  const requestToggleOnline = () => {
    if (!therapist?.id) return;

    const newStatus = !therapist.is_online;
    const statusText = newStatus ? 'en ligne' : 'hors ligne';

    setConfirm({
      title: newStatus ? 'Mettre en ligne' : 'Mettre hors ligne',
      message: `Voulez-vous mettre ${therapist.fullname || 'ce thérapeute'} ${statusText} ?`,
      confirmText: 'Confirmer',
      destructive: false,
      errorMessage: 'Impossible de modifier le statut',
      run: async () => {
        await adminService.toggleTherapistStatus(therapist.id, newStatus);
        setTherapist((prev) => (prev ? { ...prev, is_online: newStatus } : prev));
        await fetchTherapist();
        showToast(`Thérapeute ${statusText} avec succès`, 'success');
      },
    });
  };

  const requestToggleActive = () => {
    if (!therapist?.id) return;

    const newStatus = !therapist.is_active;
    const action = newStatus ? 'activer' : 'désactiver';

    setConfirm({
      title: `${newStatus ? 'Activer' : 'Désactiver'} le compte`,
      message: `Voulez-vous ${action} le compte de ${therapist.fullname || 'ce thérapeute'} ?`,
      confirmText: newStatus ? 'Activer' : 'Désactiver',
      destructive: !newStatus,
      errorMessage: `Impossible de ${action} le compte`,
      run: async () => {
        await adminService.toggleUserStatus(therapist.id, newStatus);
        setTherapist((prev) => (prev ? { ...prev, is_active: newStatus } : prev));
        await fetchTherapist();
        showToast(`Compte ${newStatus ? 'activé' : 'désactivé'} avec succès`, 'success');
      },
    });
  };

  const requestDelete = () => {
    if (!therapist?.id) return;

    setConfirm({
      title: 'Suppression définitive',
      message: `Voulez-vous supprimer définitivement ${therapist.fullname || 'ce thérapeute'} ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      destructive: true,
      errorMessage: 'Impossible de supprimer le thérapeute',
      run: async () => {
        await adminService.deleteUser(therapist.id, true);
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
      <DetailScaffold title="Détails du thérapeute" toast={toast}>
        <DetailLoading text="Chargement du thérapeute..." />
      </DetailScaffold>
    );
  }

  if (!therapist) {
    return (
      <DetailScaffold title="Détails du thérapeute" toast={toast}>
        <DetailNotFound
          text={notFound ? 'Thérapeute introuvable' : 'Impossible de charger le thérapeute'}
          onBack={goBack}
        />
      </DetailScaffold>
    );
  }

  const displayName = therapist.fullname || 'Thérapeute';
  const hasCin = !!therapist.cin_number;
  const latitude = getLatitude(therapist);
  const longitude = getLongitude(therapist);
  const certificate = certificateInfo?.certificate;

  const hero = (
    <ProfileHero
      avatar={
        <DetailAvatar
          uri={therapist.profile_image}
          name={therapist.fullname}
          color="#4CAF50"
          size={88}
          online={!!therapist.is_online}
        />
      }
      name={displayName}
      email={therapist.email || 'Email inconnu'}
      badges={
        <>
          <Badge
            label={getStatusLabel(therapist.verification_status)}
            color={getStatusColor(therapist.verification_status)}
          />
          <Badge
            label={therapist.is_online ? 'En ligne' : 'Hors ligne'}
            color={therapist.is_online ? '#27AE60' : '#999999'}
            dot
          />
        </>
      }
    />
  );

  const side = (
    <>
      <DetailCard title="Statut en ligne" icon="radio-button-on-outline">
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={[styles.switchTitle, { color: themeColors.text }]}>
              {therapist.is_online ? 'En ligne' : 'Hors ligne'}
            </Text>
            <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>
              Contrôler la disponibilité du thérapeute
            </Text>
          </View>

          <Switch
            value={!!therapist.is_online}
            onValueChange={requestToggleOnline}
            trackColor={{ false: '#D0D0D0', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </DetailCard>

      <DetailCard title="Actions" icon="flash-outline">
        <ActionRow>
          <ActionButton
            icon={therapist.is_active ? 'person-remove-outline' : 'person-add-outline'}
            label={therapist.is_active ? 'Désactiver' : 'Activer'}
            color={therapist.is_active ? '#F5A623' : '#27AE60'}
            onPress={requestToggleActive}
          />
          <ActionButton icon="trash-outline" label="Supprimer" color="#E74C3C" onPress={requestDelete} />
        </ActionRow>
      </DetailCard>
    </>
  );

  const main = (
    <>
      <DetailCard title="Informations générales" icon="person-outline">
        <InfoGrid>
          <InfoItem icon="call-outline" label="Téléphone" value={therapist.phone || 'N/A'} />
          <InfoItem
            icon="ribbon-outline"
            label="Vérification"
            value={getStatusLabel(therapist.verification_status)}
            valueColor={getStatusColor(therapist.verification_status)}
          />
          <InfoItem
            icon="pulse-outline"
            label="Statut compte"
            value={getActiveStatusLabel(therapist.is_active)}
            valueColor={getActiveStatusColor(therapist.is_active)}
          />
          <InfoItem
            icon="star-outline"
            label="Note"
            value={`⭐ ${therapist.rating || 0} (${therapist.total_reviews || 0} avis)`}
            valueColor="#F5A623"
          />
          <InfoItem icon="cash-outline" label="Prix de base" value={formatMoney(therapist.base_price || 0)} />
          <InfoItem icon="briefcase-outline" label="Expérience" value={`${therapist.experience_years || 0} ans`} />
          <InfoItem icon="calendar-outline" label="Inscrit le" value={formatDate(therapist.created_at)} />
          <InfoItem
            icon="card-outline"
            label="N° CIN"
            value={therapist.cin_number || 'Non renseigné'}
            valueColor={hasCin ? colors.primary : '#E74C3C'}
          />
        </InfoGrid>
      </DetailCard>

      <DetailCard title="Avis et évaluations" icon="star-outline">
        <AdminTherapistReviewsCard therapistId={therapist.id} navigation={navigation} />
      </DetailCard>

      {therapist.bio ? (
        <DetailCard title="Biographie" icon="document-text-outline">
          <Text style={[styles.bioText, { color: themeColors.text }]} selectable>
            {therapist.bio}
          </Text>
        </DetailCard>
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
            <Text style={[styles.addressTitle, { color: themeColors.text }]}>Adresse complète</Text>
            <Text style={[styles.addressText, { color: themeColors.textSecondary }]} selectable>
              {getFullAddress(therapist)}
            </Text>
          </View>
        </View>

        {latitude !== null || longitude !== null ? (
          <View style={styles.coordsRow}>
            <Text style={[styles.coordsText, { color: themeColors.textSecondary }]}>
              Latitude : {latitude !== null ? latitude.toFixed(6) : 'N/A'}
            </Text>
            <Text style={[styles.coordsText, { color: themeColors.textSecondary }]}>
              Longitude : {longitude !== null ? longitude.toFixed(6) : 'N/A'}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowAddressModal(true)}
          style={[styles.addressButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="map-outline" size={18} color="#fff" />
          <Text style={styles.addressButtonText}>Modifier l'adresse sur la carte</Text>
        </TouchableOpacity>
      </DetailCard>

      <DetailCard title="Pièce d'identité — CIN" icon="card-outline">
        <View style={styles.cinNumberRow}>
          <Ionicons name="card-outline" size={20} color={colors.primary} />
          <Text style={[styles.cinNumber, { color: themeColors.text }]} selectable>
            {therapist.cin_number || 'Non renseigné'}
          </Text>
        </View>

        <DocumentBlock
          url={therapist.identity_document_url}
          viewerTitle={`Pièce d'identité (CIN) — ${therapist.fullname || 'Thérapeute'}`}
          fileName={`CIN_${therapist.fullname || 'therapeute'}.jpg`}
          downloadLabel="Télécharger le CIN"
          missingText="Aucun document CIN téléchargé"
          onOpen={openViewer}
          onDownload={download}
        />
      </DetailCard>

      <DetailCard title="Certificat professionnel (thérapeute)" icon="ribbon-outline">
        <DocumentBlock
          url={therapist.certificate_professionnel}
          viewerTitle={`Certificat professionnel — ${therapist.fullname || 'Thérapeute'}`}
          fileName={`Certificat_${therapist.fullname || 'therapeute'}.jpg`}
          downloadLabel="Télécharger le certificat"
          missingText="Aucun certificat professionnel téléversé par le thérapeute"
          onOpen={openViewer}
          onDownload={download}
        />
      </DetailCard>

      <DetailCard title="Certificat officiel Zebutech" icon="shield-checkmark-outline" tint="#E8F5E9">
        {loadingCertificate ? (
          <View style={styles.certLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.certLoadingText}>Chargement du certificat...</Text>
          </View>
        ) : certificate ? (
          <>
            <InfoGrid>
              <InfoItem icon="barcode-outline" label="Numéro" value={certificate.certificate_number} />
              <InfoItem icon="calendar-outline" label="Délivré le" value={formatDate(certificate.issued_at)} />
              <InfoItem
                icon="checkmark-circle-outline"
                label="Statut"
                value={certificate.status === 'valid' ? 'Valide' : 'Révoqué'}
                valueColor={certificate.status === 'valid' ? '#27AE60' : '#E74C3C'}
              />
              <InfoItem
                icon="person-circle-outline"
                label="Validé par"
                value={certificate.verified_by || 'Administrateur'}
              />
            </InfoGrid>

            {certificate.download_url ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  download(
                    certificate.download_url,
                    `${certificate.certificate_number || 'certificat'}.pdf`
                  )
                }
                style={[styles.addressButton, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="document-text-outline" size={18} color="#fff" />
                <Text style={styles.addressButtonText}>Télécharger le certificat PDF</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <View style={styles.certLoading}>
            <Ionicons name="information-circle-outline" size={20} color="#2E7D32" />
            <Text style={[styles.certLoadingText, { color: '#2E7D32' }]}>
              Aucun certificat généré pour ce thérapeute
            </Text>
          </View>
        )}
      </DetailCard>

      <DetailCard title="Spécialités (certificat officiel)" icon="leaf-outline">
        <AdminSpecialtiesManager
          therapistId={therapist.id}
          therapistName={therapist.fullname}
          variant="compact"
          onUpdated={loadCertificateInfo}
        />
      </DetailCard>
    </>
  );

  return (
    <DetailScaffold
      title="Détails du thérapeute"
      subtitle={displayName}
      toast={toast}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <DetailColumns top={hero} side={side} main={main} />

      <AdminImageViewer viewer={viewer} onClose={() => setViewer(null)} onDownload={download} />

      <AdminUserAddressModal
        visible={showAddressModal}
        userId={therapist.id}
        userName={therapist.fullname}
        onClose={() => setShowAddressModal(false)}
        onSaved={() => {
          fetchTherapist();
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

  bioText: { fontSize: 14, lineHeight: 22 },

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
  coordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  coordsText: { fontSize: 12, lineHeight: 17 },
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

  cinNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cinNumber: { fontSize: 15, fontWeight: '700' },

  certLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  certLoadingText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#555' },
});

export default TherapistDetailScreen;
