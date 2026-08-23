// src/screens/therapist/UploadDocumentsScreen.js
// ============================================================
// DOCUMENTS DU THÉRAPEUTE
// ============================================================
// ✅ Le thérapeute peut envoyer sa pièce d'identité
//    (CIN / Passeport / Permis de conduire).
//
// ✅ Le thérapeute peut aussi envoyer son certificat professionnel
//    (diplôme / attestation / certification) — champ optionnel,
//    modifiable à tout moment (web et mobile).
//
// ℹ️ Ce certificat professionnel est distinct du "certificat"
//    officiel généré automatiquement par la plateforme après
//    validation APPROVED par l'administrateur (voir plus bas).
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  SafeAreaView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import therapistService from '../../services/therapistService';
import { API_URL } from '../../config/env';
// ✅ Sélecteur de fichier multi-plateforme (corrige l'upload sur le web)
import { pickImageOrPdf } from '../../utils/crossPlatformFilePicker';

// ============================================================
// BUILD FORMDATA
// ============================================================

const buildFileFormData = async (
  asset,
  fieldName,
  defaultBaseName
) => {
  const formData = new FormData();

  const sourceName = asset?.name || asset?.uri || '';

  const uriParts = sourceName.split('.');

  const rawExt =
    (uriParts[uriParts.length - 1] || 'jpg')
      .split('?')[0]
      .toLowerCase();

  const ext = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'pdf',
  ].includes(rawExt)
    ? rawExt
    : 'jpg';

  const mimeType =
    asset?.mimeType ||
    (ext === 'pdf'
      ? 'application/pdf'
      : `image/${ext === 'jpg' ? 'jpeg' : ext}`);

  const filename = `${defaultBaseName}.${ext}`;

  // ----------------------------------------------------------
  // WEB
  // ----------------------------------------------------------

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);

    if (!response.ok) {
      throw new Error(
        "Impossible de lire le fichier sélectionné."
      );
    }

    const blob = await response.blob();

    formData.append(
      fieldName,
      blob,
      filename
    );
  }

  // ----------------------------------------------------------
  // ANDROID / IOS
  // ----------------------------------------------------------

  else {
    formData.append(
      fieldName,
      {
        uri: asset.uri,
        type: mimeType,
        name: filename,
      }
    );
  }

  return formData;
};

// ============================================================
// CARTE DOCUMENT
// ============================================================

const DocumentCard = ({
  icon,
  title,
  subtitle,
  documentUrl,
  isUploading,
  onPick,
  onView,
  themeColors,
  disabledNote,
}) => {
  const isPdf =
    documentUrl &&
    documentUrl
      .toLowerCase()
      .endsWith('.pdf');

  return (
    <View
      style={[
        styles.docCard,
        {
          backgroundColor:
            themeColors.surface,
        },
      ]}
    >

      {/* ------------------------------------------------------
          HEADER
      ------------------------------------------------------ */}

      <View style={styles.docHeader}>

        <View
          style={[
            styles.docIconCircle,
            {
              backgroundColor:
                colors.primary + '15',
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.docHeaderText}>

          <Text
            style={[
              styles.docTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.docSubtitle,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            {subtitle}
          </Text>

        </View>

        {documentUrl ? (
          <View style={styles.docCheckBadge}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#4CAF50"
            />
          </View>
        ) : null}

      </View>

      {/* ------------------------------------------------------
          APERÇU DOCUMENT
      ------------------------------------------------------ */}

      {documentUrl ? (
        <TouchableOpacity
          onPress={onView}
          activeOpacity={0.85}
          style={styles.previewWrapper}
        >

          {isPdf ? (

            <View
              style={[
                styles.pdfPreview,
                {
                  backgroundColor:
                    themeColors.background,
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={36}
                color={colors.primary}
              />

              <Text
                style={[
                  styles.pdfPreviewText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Document PDF — Appuyer pour ouvrir
              </Text>
            </View>

          ) : (

            <Image
              source={{
                uri: documentUrl,
              }}
              style={styles.previewImage}
              resizeMode="cover"
            />

          )}

        </TouchableOpacity>
      ) : null}

      {/* ------------------------------------------------------
          UPLOAD / REMPLACER
      ------------------------------------------------------ */}

      <TouchableOpacity
        style={[
          styles.uploadZone,
          {
            borderColor:
              colors.primary + '55',
          },
        ]}
        onPress={onPick}
        disabled={isUploading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          documentUrl
            ? `Remplacer ${title}`
            : `Télécharger ${title}`
        }
      >

        {isUploading ? (

          <ActivityIndicator
            size="small"
            color={colors.primary}
          />

        ) : (

          <View
            style={
              styles.uploadZoneContent
            }
          >

            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={colors.primary}
            />

            <Text
              style={[
                styles.uploadZoneText,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              {documentUrl
                ? 'Remplacer le document'
                : 'Télécharger'}
            </Text>

          </View>

        )}

      </TouchableOpacity>

      {/* ------------------------------------------------------
          NOTE
      ------------------------------------------------------ */}

      {disabledNote ? (
        <Text
          style={[
            styles.disabledNote,
            {
              color:
                themeColors.textSecondary,
            },
          ]}
        >
          {disabledNote}
        </Text>
      ) : null}

    </View>
  );
};

// ============================================================
// ÉCRAN PRINCIPAL
// ============================================================

const UploadDocumentsScreen = ({
  navigation,
}) => {

  const {
    colors: themeColors,
  } = useTheme();

  const {
    user,
    token,
    refreshUser,
  } = useAuth();

  // ----------------------------------------------------------
  // STATES
  // ----------------------------------------------------------

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    verification,
    setVerification,
  ] = useState(null);

  // ✅ CIN uniquement
  const [
    cinUrl,
    setCinUrl,
  ] = useState(null);

  const [
    isUploadingCin,
    setIsUploadingCin,
  ] = useState(false);

  // ✅ NOUVEAU : Certificat professionnel (diplôme / attestation)
  const [
    certificateProUrl,
    setCertificateProUrl,
  ] = useState(null);

  const [
    isUploadingCertificatePro,
    setIsUploadingCertificatePro,
  ] = useState(false);

  const [
    isDownloadingCertificate,
    setIsDownloadingCertificate,
  ] = useState(false);

  // ==========================================================
  // CHARGER LE STATUT
  // ==========================================================

  const loadStatus = useCallback(
    async () => {

      setIsLoading(true);

      try {

        // ------------------------------------------------------
        // Vérification backend
        // ------------------------------------------------------

        const result =
          await therapistService
            .getMyVerificationStatus();

        if (result.success) {

          setVerification(
            result.data
          );

        }

      } catch (error) {

        console.error(
          '❌ loadStatus:',
          error
        );

      } finally {

        setIsLoading(false);

      }

      // ------------------------------------------------------
      // CIN depuis AuthContext
      // ------------------------------------------------------

      setCinUrl(
        user?.identity_document_url ||
        null
      );

      // ------------------------------------------------------
      // ✅ Certificat professionnel depuis AuthContext
      // ------------------------------------------------------

      setCertificateProUrl(
        user?.certificate_professionnel ||
        null
      );

    },
    [user]
  );

  // ==========================================================
  // RECHARGER À CHAQUE RETOUR SUR L'ÉCRAN
  // ==========================================================

  useFocusEffect(
    useCallback(() => {

      loadStatus();

    }, [loadStatus])
  );

  // ==========================================================
  // UPLOAD CIN
  // ==========================================================

  const pickAndUploadCIN = async () => {

    try {

      // ------------------------------------------------------
      // Choix / sélection du fichier
      // ✅ Fonctionne aussi bien sur Android/iOS (choix Photo/PDF
      // via Alert) que sur le web (sélecteur de fichiers natif du
      // navigateur) — voir crossPlatformFilePicker.js
      // ------------------------------------------------------

      const asset = await pickImageOrPdf({
        title: 'Ajouter une pièce d’identité',
        message: 'Choisissez la source du fichier',
      });

      if (!asset?.uri) {

        return;
      }

      // ------------------------------------------------------
      // UPLOAD
      // ------------------------------------------------------

      setIsUploadingCin(true);

      const formData =
        await buildFileFormData(
          asset,
          'file',
          'cin'
        );

      const result =
        await therapistService
          .uploadCIN(formData);

      if (!result.success) {

        Alert.alert(
          '❌ Erreur',
          result.error ||
            "Impossible d'envoyer la pièce d'identité."
        );

        return;
      }

      // ------------------------------------------------------
      // NOUVELLE URL
      // ------------------------------------------------------

      const newUrl =
        result.data
          ?.identity_document_url ||
        result.data?.url;

      if (newUrl) {

        setCinUrl(
          newUrl
        );

      }

      // ------------------------------------------------------
      // REFRESH USER
      // ------------------------------------------------------

      if (
        typeof refreshUser ===
        'function'
      ) {

        await refreshUser();

      }

      // ------------------------------------------------------
      // MESSAGE
      // ------------------------------------------------------

      Alert.alert(
        '✅ Succès',
        'Votre pièce d’identité a été téléchargée avec succès. Elle sera examinée par notre équipe.'
      );

      await loadStatus();

    } catch (error) {

      console.error(
        '❌ pickAndUploadCIN:',
        error
      );

      Alert.alert(
        '❌ Erreur',
        "Une erreur est survenue lors de l'envoi de la pièce d'identité."
      );

    } finally {

      setIsUploadingCin(false);

    }
  };

  // ==========================================================
  // ✅ UPLOAD CERTIFICAT PROFESSIONNEL (NOUVEAU)
  // ==========================================================

  const pickAndUploadCertificatePro = async () => {

    try {

      // ------------------------------------------------------
      // Choix / sélection du fichier
      // ✅ Fonctionne aussi bien sur Android/iOS (choix Photo/PDF
      // via Alert) que sur le web (sélecteur de fichiers natif du
      // navigateur) — voir crossPlatformFilePicker.js
      // ------------------------------------------------------

      const asset = await pickImageOrPdf({
        title: 'Ajouter le certificat professionnel',
        message: 'Choisissez la source du fichier',
      });

      if (!asset?.uri) {

        return;
      }

      // ------------------------------------------------------
      // UPLOAD
      // ------------------------------------------------------

      setIsUploadingCertificatePro(true);

      const formData =
        await buildFileFormData(
          asset,
          'file',
          'certificate_professionnel'
        );

      const result =
        await therapistService
          .uploadCertificateProfessionnel(formData);

      if (!result.success) {

        Alert.alert(
          '❌ Erreur',
          result.error ||
            "Impossible d'envoyer le certificat professionnel."
        );

        return;
      }

      // ------------------------------------------------------
      // NOUVELLE URL
      // ------------------------------------------------------

      const newUrl =
        result.data
          ?.certificate_professionnel ||
        result.data?.url;

      if (newUrl) {

        setCertificateProUrl(
          newUrl
        );

      }

      // ------------------------------------------------------
      // REFRESH USER
      // ------------------------------------------------------

      if (
        typeof refreshUser ===
        'function'
      ) {

        await refreshUser();

      }

      // ------------------------------------------------------
      // MESSAGE
      // ------------------------------------------------------

      Alert.alert(
        '✅ Succès',
        'Votre certificat professionnel a été téléchargé avec succès.'
      );

      await loadStatus();

    } catch (error) {

      console.error(
        '❌ pickAndUploadCertificatePro:',
        error
      );

      Alert.alert(
        '❌ Erreur',
        "Une erreur est survenue lors de l'envoi du certificat professionnel."
      );

    } finally {

      setIsUploadingCertificatePro(false);

    }
  };

  // ==========================================================
  // VOIR DOCUMENT
  // ==========================================================

  const handleViewDocument = (
    url
  ) => {

    if (!url) {
      return;
    }

    if (
      Platform.OS === 'web'
    ) {

      window.open(
        url,
        '_blank'
      );

    } else {

      Linking.openURL(
        url
      );

    }

  };

  // ==========================================================
  // TÉLÉCHARGER CERTIFICAT AUTOMATIQUE
  // ==========================================================

  const handleDownloadCertificate =
    async () => {

      if (!token) {

        Alert.alert(
          'Erreur d’authentification',
          'Vous devez être connecté.'
        );

        return;
      }

      setIsDownloadingCertificate(
        true
      );

      try {

        const cleanBaseUrl =
          API_URL.replace(
            /\/+$/,
            ''
          );

        const relativeUrl =
          therapistService
            .getCertificateDownloadUrl();

        const url =
          `${cleanBaseUrl}${relativeUrl}`;

        const filename =
          `${
            verification
              ?.certificate
              ?.number ||
            'certificat'
          }.pdf`;

        // ====================================================
        // WEB
        // ====================================================

        if (
          Platform.OS === 'web'
        ) {

          const response =
            await fetch(
              url,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          if (!response.ok) {

            throw new Error(
              `Erreur serveur (${response.status})`
            );

          }

          const blob =
            await response.blob();

          const blobUrl =
            window.URL
              .createObjectURL(
                blob
              );

          const link =
            document.createElement(
              'a'
            );

          link.href =
            blobUrl;

          link.download =
            filename;

          document.body.appendChild(
            link
          );

          link.click();

          document.body.removeChild(
            link
          );

          window.URL.revokeObjectURL(
            blobUrl
          );

        }

        // ====================================================
        // ANDROID / IOS
        // ====================================================

        else {

          const mobileUrl =
            `${url}?token=${token}`;

          const canOpen =
            await Linking
              .canOpenURL(
                mobileUrl
              );

          if (canOpen) {

            await Linking
              .openURL(
                mobileUrl
              );

          } else {

            Alert.alert(
              'Erreur',
              "Impossible d'ouvrir le lien du certificat."
            );

          }

        }

      } catch (error) {

        console.error(
          '❌ handleDownloadCertificate:',
          error
        );

        Alert.alert(
          'Erreur de téléchargement',
          'Une erreur est survenue. Veuillez réessayer.'
        );

      } finally {

        setIsDownloadingCertificate(
          false
        );

      }

    };

  // ==========================================================
  // BANNIÈRE STATUT
  // ==========================================================

  const renderStatusBanner = () => {

    const status =
      verification?.status ||
      'pending';

    // ========================================================
    // APPROVED
    // ========================================================

    if (
      status === 'approved'
    ) {

      return (

        <View
          style={[
            styles.banner,
            styles.bannerApproved,
          ]}
        >

          <View
            style={
              styles.bannerHeader
            }
          >

            <View
              style={[
                styles.bannerIconCircle,
                {
                  backgroundColor:
                    '#E8F5E9',
                },
              ]}
            >

              <Ionicons
                name="checkmark-circle"
                size={26}
                color="#00C853"
              />

            </View>

            <View
              style={
                styles.bannerHeaderText
              }
            >

              <Text
                style={[
                  styles.bannerTitle,
                  {
                    color:
                      '#087F23',
                  },
                ]}
              >
                Documents vérifiés
              </Text>

              <Text
                style={[
                  styles.bannerText,
                  {
                    color:
                      '#388E3C',
                  },
                ]}
              >
                Votre profil professionnel a été validé par l'administration.
              </Text>

            </View>

          </View>

          {/* ==================================================
              CERTIFICAT AUTOMATIQUE
              ================================================== */}

          {verification?.certificate && (

            <View
              style={
                styles.certificateBox
              }
            >

              <View
                style={
                  styles.certificateIcon
                }
              >

                <Ionicons
                  name="ribbon-outline"
                  size={22}
                  color={
                    colors.primary
                  }
                />

              </View>

              <View
                style={
                  styles.certificateInfo
                }
              >

                <Text
                  style={
                    styles.certificateLabel
                  }
                >
                  Certificat professionnel
                </Text>

                <Text
                  style={
                    styles.certificateNumber
                  }
                  numberOfLines={1}
                >
                  {
                    verification
                      .certificate
                      .number
                  }
                </Text>

                <Text
                  style={
                    styles.certificateDate
                  }
                >
                  Délivré le{' '}
                  {new Date(
                    verification
                      .certificate
                      .issued_at
                  ).toLocaleDateString(
                    'fr-FR'
                  )}
                </Text>

                {verification
                  ?.certificate
                  ?.verified_by_name && (

                  <Text
                    style={
                      styles.certificateVerifiedBy
                    }
                    numberOfLines={1}
                  >
                    Validé par :{' '}
                    {
                      verification
                        .certificate
                        .verified_by_name
                    }
                  </Text>

                )}

              </View>

            </View>

          )}

          {/* ==================================================
              DOWNLOAD CERTIFICAT
              ================================================== */}

          {verification?.certificate && (

            <TouchableOpacity
              style={[
                styles.downloadCertButton,
                isDownloadingCertificate &&
                  {
                    opacity: 0.7,
                  },
              ]}
              onPress={
                handleDownloadCertificate
              }
              disabled={
                isDownloadingCertificate
              }
              activeOpacity={0.85}
            >

              {isDownloadingCertificate ? (

                <ActivityIndicator
                  size="small"
                  color="#fff"
                />

              ) : (

                <>
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color="#fff"
                  />

                  <Text
                    style={
                      styles.downloadCertButtonText
                    }
                  >
                    Télécharger le certificat
                  </Text>
                </>

              )}

            </TouchableOpacity>

          )}

        </View>

      );

    }

    // ========================================================
    // REJECTED
    // ========================================================

    if (
      status === 'rejected'
    ) {

      return (

        <View
          style={[
            styles.banner,
            styles.bannerRejected,
          ]}
        >

          <View
            style={
              styles.bannerHeader
            }
          >

            <View
              style={[
                styles.bannerIconCircle,
                {
                  backgroundColor:
                    '#FFEBEE',
                },
              ]}
            >

              <Ionicons
                name="close-circle-outline"
                size={26}
                color="#E53935"
              />

            </View>

            <View
              style={
                styles.bannerHeaderText
              }
            >

              <Text
                style={[
                  styles.bannerTitle,
                  {
                    color:
                      '#C62828',
                  },
                ]}
              >
                Documents non validés
              </Text>

              <Text
                style={[
                  styles.bannerText,
                  {
                    color:
                      '#B71C1C',
                  },
                ]}
              >
                {verification?.rejection_reason
                  ? `Motif : ${verification.rejection_reason}`
                  : 'Veuillez soumettre à nouveau un document lisible.'}
              </Text>

            </View>

          </View>

        </View>

      );

    }

    // ========================================================
    // PENDING
    // ========================================================

    return (

      <View
        style={[
          styles.banner,
          styles.bannerPending,
        ]}
      >

        <View
          style={
            styles.bannerHeader
          }
        >

          <View
            style={[
              styles.bannerIconCircle,
              {
                backgroundColor:
                  '#FFF3E0',
              },
            ]}
          >

            <Ionicons
              name="time-outline"
              size={26}
              color="#F5A623"
            />

          </View>

          <View
            style={
              styles.bannerHeaderText
            }
          >

            <Text
              style={[
                styles.bannerTitle,
                {
                  color:
                    '#E65100',
                },
              ]}
            >
              En attente de vérification
            </Text>

            <Text
              style={[
                styles.bannerText,
                {
                  color:
                    '#795548',
                },
              ]}
            >
              Votre pièce d’identité est en cours de vérification par l'administration.
            </Text>

          </View>

        </View>

      </View>

    );

  };

  // ==========================================================
  // STATUS
  // ==========================================================

  const status =
    verification?.status ||
    'pending';

  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >

      <Header
        title="Mes documents"
        showBack
      />

      {isLoading ? (

        <View
          style={
            styles.loadingContainer
          }
        >

          <ActivityIndicator
            size="large"
            color={
              colors.primary
            }
          />

        </View>

      ) : (

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.scrollContent
          }
        >

          {/* =================================================
              STATUT
              ================================================= */}

          {renderStatusBanner()}

          {/* =================================================
              PIÈCE D'IDENTITÉ UNIQUEMENT
              ================================================= */}

          <DocumentCard

            icon="card-outline"

            title="Pièce d'identité"

            subtitle="CIN, Passeport ou Permis de conduire"

            documentUrl={
              cinUrl
            }

            isUploading={
              isUploadingCin
            }

            onPick={
              pickAndUploadCIN
            }

            onView={() =>
              handleViewDocument(
                cinUrl
              )
            }

            themeColors={
              themeColors
            }

            disabledNote={
              status === 'approved'
                ? '⚠️ Remplacer ce document annulera la vérification en cours'
                : null
            }

          />

          {/* =================================================
              ✅ CERTIFICAT PROFESSIONNEL (NOUVEAU)
              ================================================= */}

          <DocumentCard

            icon="ribbon-outline"

            title="Certificat professionnel"

            subtitle="Diplôme, attestation ou certification (optionnel)"

            documentUrl={
              certificateProUrl
            }

            isUploading={
              isUploadingCertificatePro
            }

            onPick={
              pickAndUploadCertificatePro
            }

            onView={() =>
              handleViewDocument(
                certificateProUrl
              )
            }

            themeColors={
              themeColors
            }

          />

          {/* =================================================
              INFORMATION
              ================================================= */}

          <View
            style={
              styles.infoFooter
            }
          >

            <View
              style={
                styles.infoIconCircle
              }
            >

              <Ionicons
                name="information"
                size={13}
                color="#fff"
              />

            </View>

            <Text
              style={
                styles.infoFooterText
              }
            >
              La pièce d’identité doit être claire et lisible. Formats acceptés : JPG, PNG, PDF.
            </Text>

          </View>

          {/* =================================================
              ✅ INFORMATION CERTIFICAT PROFESSIONNEL
              ================================================= */}

          <View
            style={[
              styles.infoFooter,
              { marginTop: spacing.sm },
            ]}
          >

            <View
              style={
                styles.infoIconCircle
              }
            >

              <Ionicons
                name="information"
                size={13}
                color="#fff"
              />

            </View>

            <Text
              style={
                styles.infoFooterText
              }
            >
              Le certificat professionnel est facultatif et modifiable à tout moment. Formats acceptés : JPG, PNG, PDF.
            </Text>

          </View>

        </ScrollView>

      )}

    </SafeAreaView>

  );
};

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    safeArea: {
      flex: 1,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },

    // ========================================================
    // BANNIÈRE
    // ========================================================

    banner: {
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
    },

    bannerPending: {
      backgroundColor: '#FFF8E1',
      borderColor: '#FFE082',
    },

    bannerRejected: {
      backgroundColor: '#FFEBEE',
      borderColor: '#FFCDD2',
    },

    bannerApproved: {
      backgroundColor: '#F1FFF6',
      borderColor: '#B9F6CA',
    },

    bannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    bannerIconCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },

    bannerHeaderText: {
      flex: 1,
      marginLeft: spacing.sm,
    },

    bannerTitle: {
      fontSize: 15,
      fontFamily:
        typography.fontFamily.bold,
    },

    bannerText: {
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },

    // ========================================================
    // CERTIFICAT AUTOMATIQUE
    // ========================================================

    certificateBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E8F5E9',
    },

    certificateIcon: {
      width: 42,
      height: 42,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.primary + '12',
    },

    certificateInfo: {
      flex: 1,
      marginLeft: spacing.sm,
    },

    certificateLabel: {
      fontSize: 11,
      color: '#777',
    },

    certificateNumber: {
      marginTop: 2,
      fontSize: 14,
      fontFamily:
        typography.fontFamily.bold,
      color: colors.primary,
    },

    certificateDate: {
      marginTop: 2,
      fontSize: 10,
      color: '#888',
    },

    certificateVerifiedBy: {
      marginTop: 2,
      fontSize: 10,
      color: '#4CAF50',
      fontStyle: 'italic',
    },

    downloadCertButton: {
      marginTop: spacing.md,
      minHeight: 46,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.primary,
      gap: spacing.xs,
    },

    downloadCertButtonText: {
      color: '#fff',
      fontSize: 13,
      fontFamily:
        typography.fontFamily.semiBold,
    },

    // ========================================================
    // DOCUMENT CARD
    // ========================================================

    docCard: {
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 1,
      },

      shadowOpacity: 0.05,

      shadowRadius: 3,

      elevation: 1,
    },

    docHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    docIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    docHeaderText: {
      flex: 1,
      marginLeft: spacing.sm,
    },

    docTitle: {
      fontSize: 15,
      fontFamily:
        typography.fontFamily.semiBold,
    },

    docSubtitle: {
      fontSize: 12,
      marginTop: 1,
    },

    docCheckBadge: {
      marginLeft: spacing.xs,
    },

    // ========================================================
    // PREVIEW
    // ========================================================

    previewWrapper: {
      marginTop: spacing.md,
    },

    previewImage: {
      width: '100%',
      height: 160,
      borderRadius: 12,
      backgroundColor: '#f5f5f5',
    },

    pdfPreview: {
      height: 100,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    pdfPreviewText: {
      fontSize: 11,
    },

    // ========================================================
    // UPLOAD
    // ========================================================

    uploadZone: {
      marginTop: spacing.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderRadius: 12,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },

    uploadZoneContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    uploadZoneText: {
      fontSize: 14,
      fontFamily:
        typography.fontFamily.semiBold,
    },

    disabledNote: {
      fontSize: 10,
      marginTop: spacing.xs,
      fontStyle: 'italic',
    },

    // ========================================================
    // FOOTER
    // ========================================================

    infoFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: '#E8F0E9',
      borderRadius: 14,
      padding: spacing.md,
    },

    infoIconCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor:
        colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    infoFooterText: {
      flex: 1,
      fontSize: 11,
      color: '#4a4a4a',
      lineHeight: 16,
    },

  });

export default UploadDocumentsScreen;