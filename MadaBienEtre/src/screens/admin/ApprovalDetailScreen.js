// src/screens/admin/ApprovalDetailScreen.js
//
// PAGE « Dossier de candidature » (remplace l'ancienne modale de
// ApprovalsScreen). Ouverte depuis la liste :
//   navigation.navigate('ApprovalDetail', { therapistId, therapist })
// Approuver / Rejeter (avec motif obligatoire) puis retour à la liste.

import { useState, useCallback, useRef, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';
import adminService from '../../services/adminService';
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
  useAdminToast,
} from '../../components/admin/AdminDetailKit';

const ApprovalDetailScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();

  const initialTherapist = route?.params?.therapist || null;
  const therapistId = route?.params?.therapistId ?? initialTherapist?.id;

  const [therapist, setTherapist] = useState(initialTherapist);
  const [loading, setLoading] = useState(!initialTherapist);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [viewer, setViewer] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'approve' | 'reject' | null
  const [processing, setProcessing] = useState(false);

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
     CHARGEMENT — même source que la liste (getPendingTherapists)
  ---------------------------------------------------------- */

  const fetchTherapist = useCallback(async () => {
    try {
      const data = await adminService.getPendingTherapists();

      if (!mounted.current) return null;

      if (Array.isArray(data)) {
        const found = data.find((t) => String(t.id) === String(therapistId));

        if (found) {
          setTherapist(found);
          setNotFound(false);
          return found;
        }
      }

      // Plus dans la liste des demandes en attente (déjà traitée ailleurs)
      if (!therapistRef.current) setNotFound(true);
    } catch (err) {
      console.error('Erreur chargement demande:', err);
      if (mounted.current && !therapistRef.current) setNotFound(true);
    }

    return null;
  }, [therapistId]);

  useEffect(() => {
    let active = true;

    fetchTherapist().finally(() => {
      if (active && mounted.current) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [fetchTherapist]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTherapist();
    if (mounted.current) setRefreshing(false);
  };

  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('Approvals');
    }
  }, [navigation]);

  /* ----------------------------------------------------------
     APPROUVER / REJETER
  ---------------------------------------------------------- */

  const handleConfirm = async (reason) => {
    if (!therapist?.id || !confirm) return;

    setProcessing(true);

    try {
      if (confirm === 'approve') {
        await adminService.approveTherapist(therapist.id);
      } else {
        await adminService.rejectTherapist(therapist.id, reason);
      }

      // Retour à la liste (qui se recharge au focus)
      if (mounted.current) {
        setConfirm(null);
        setProcessing(false);
      }
      goBack();
    } catch (e) {
      console.error('Erreur action approbation:', e);
      if (mounted.current) {
        setProcessing(false);
        showToast(
          e?.message || 'Une erreur est survenue pendant cette opération.',
          'error'
        );
      }
    }
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
      <DetailScaffold title="Dossier de candidature" toast={toast}>
        <DetailLoading text="Chargement du dossier..." />
      </DetailScaffold>
    );
  }

  if (!therapist) {
    return (
      <DetailScaffold title="Dossier de candidature" toast={toast}>
        <DetailNotFound
          text={
            notFound
              ? 'Cette demande est introuvable ou a déjà été traitée'
              : 'Impossible de charger la demande'
          }
          onBack={goBack}
        />
      </DetailScaffold>
    );
  }

  const displayName = therapist.fullname || 'Nom non renseigné';
  const hasCin = !!therapist.identity_document_url;

  const hero = (
    <ProfileHero
      avatar={
        <DetailAvatar
          uri={therapist.profile_image}
          name={therapist.fullname}
          color={colors.primary}
          size={88}
        />
      }
      name={displayName}
      email={therapist.email || 'Email non renseigné'}
      badges={<Badge label="En attente" color="#F59E0B" dot />}
    />
  );

  const side = (
    <DetailCard title="Décision" icon="checkmark-done-outline">
      <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
        Vérifiez le dossier puis approuvez ou rejetez la candidature. Un motif est obligatoire
        en cas de rejet.
      </Text>

      <ActionRow>
        <ActionButton
          icon="close-circle-outline"
          label="Rejeter"
          color="#DC2626"
          disabled={processing}
          onPress={() => setConfirm('reject')}
        />
        <ActionButton
          icon="checkmark-circle-outline"
          label="Approuver"
          color="#16A34A"
          disabled={processing}
          onPress={() => setConfirm('approve')}
        />
      </ActionRow>
    </DetailCard>
  );

  const main = (
    <>
      <DetailCard title="Informations du candidat" icon="person-outline">
        <InfoGrid>
          <InfoItem icon="mail-outline" label="Email" value={therapist.email} />
          <InfoItem icon="call-outline" label="Téléphone" value={therapist.phone || 'Non renseigné'} />
          <InfoItem icon="card-outline" label="N° CIN" value={therapist.cin_number || 'Non renseigné'} />
          <InfoItem icon="calendar-outline" label="Demande" value={formatDate(therapist.created_at)} />
          <InfoItem
            icon="briefcase-outline"
            label="Expérience"
            value={`${therapist.experience_years || 0} ans`}
          />
          <InfoItem icon="cash-outline" label="Prix de base" value={formatMoney(therapist.base_price)} />
          <InfoItem
            icon="document-text-outline"
            label="Document"
            value={hasCin ? 'CIN disponible' : 'CIN manquante'}
            valueColor={hasCin ? '#16A34A' : '#DC2626'}
          />
          <InfoItem
            icon="location-outline"
            label="Adresse"
            value={therapist.address || 'Non renseignée'}
            full
          />
        </InfoGrid>
      </DetailCard>

      <DetailCard title="Biographie" icon="reader-outline">
        <Text style={[styles.bio, { color: themeColors.text }]} selectable>
          {therapist.bio || 'Aucune biographie renseignée.'}
        </Text>
      </DetailCard>

      <DetailCard title="Pièce d'identité" icon="card-outline">
        <DocumentBlock
          url={therapist.identity_document_url}
          viewerTitle="Pièce d'identité (CIN)"
          fileName={`CIN_${therapist.fullname || 'therapeute'}.jpg`}
          downloadLabel="Télécharger la CIN"
          missingText="Aucun document CIN n'a été téléchargé."
          onOpen={openViewer}
          onDownload={download}
        />
      </DetailCard>

      <DetailCard title="Spécialités" icon="leaf-outline">
        <AdminSpecialtiesManager
          therapistId={therapist.id}
          therapistName={therapist.fullname}
          variant="compact"
        />
      </DetailCard>

      <DetailCard title="Certificat professionnel" icon="ribbon-outline">
        <DocumentBlock
          url={therapist.certificate_professionnel}
          viewerTitle={`Certificat professionnel — ${therapist.fullname || 'Thérapeute'}`}
          fileName={`Certificat_${therapist.fullname || 'therapeute'}.jpg`}
          downloadLabel="Télécharger le certificat"
          missingText="Aucun certificat professionnel n'a été téléchargé."
          onOpen={openViewer}
          onDownload={download}
        />
      </DetailCard>
    </>
  );

  return (
    <DetailScaffold
      title="Dossier de candidature"
      subtitle="Vérification du profil"
      toast={toast}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <DetailColumns top={hero} side={side} main={main} />

      <AdminImageViewer viewer={viewer} onClose={() => setViewer(null)} onDownload={download} />

      <AdminConfirmDialog
        visible={!!confirm}
        title={confirm === 'reject' ? 'Rejeter la demande' : 'Approuver le thérapeute'}
        message={
          confirm === 'reject'
            ? `Indiquez le motif du rejet de la demande de ${therapist.fullname || 'ce thérapeute'}.`
            : `Voulez-vous approuver ${therapist.fullname || 'ce thérapeute'} ?`
        }
        confirmText={confirm === 'reject' ? 'Rejeter' : 'Approuver'}
        destructive={confirm === 'reject'}
        withReason={confirm === 'reject'}
        reasonLabel="Motif du rejet"
        reasonPlaceholder="Saisissez le motif du rejet..."
        loading={processing}
        onConfirm={handleConfirm}
        onCancel={() => !processing && setConfirm(null)}
      />
    </DetailScaffold>
  );
};

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  bio: { fontSize: 14, lineHeight: 22 },
});

export default ApprovalDetailScreen;
