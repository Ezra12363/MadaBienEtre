// src/screens/admin/ApprovalsScreen.js

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  SafeAreaView,
  Image,
  TextInput,
  Platform,
  Pressable,
  Animated,
  useWindowDimensions,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// npm install xlsx  ->  nécessaire pour l'export Excel (web uniquement)
import * as XLSX from 'xlsx';
// npm install @react-native-community/datetimepicker  ->  nécessaire pour le calendrier natif (iOS / Android)
import DateTimePicker from '@react-native-community/datetimepicker';
// npx expo install expo-file-system expo-sharing  ->  nécessaire pour l'export Excel sur Android / iOS
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';
import { API_URL } from '../../config/env';

const IS_WEB = Platform.OS === 'web';

/* ============================================================
   CONFIRMATION MODAL
   IMPORTANT:
   Ce composant doit rester HORS de ApprovalsScreen.

   Pourquoi ?
   Si ConfirmationModal est déclaré dans ApprovalsScreen,
   chaque setRejectReason() provoque un render du parent et
   React peut recréer/remonter le composant.

   Résultat avant correction :
   - l'utilisateur écrit 1 caractère
   - re-render
   - TextInput perd le focus
   - curseur disparaît
   - impossible d'écrire normalement

   Cette version conserve donc un composant stable.
============================================================ */

const ConfirmationModal = ({
  confirmation,
  processing,
  rejectReason,
  setRejectReason,
  themeColors,
  isDark,
  confirmAction,
  onCancel,
}) => {
  const isReject =
    confirmation?.type === 'reject';

  const handleChangeReason = useCallback(
    (text) => {
      setRejectReason(
        String(text || '').slice(0, 500)
      );
    },
    [setRejectReason]
  );

  const handleRequestClose = useCallback(() => {
    if (!processing) {
      onCancel();
    }
  }, [processing, onCancel]);

  return (
    <Modal
      visible={!!confirmation}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView
        style={styles.confirmKeyboardWrapper}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View
          style={styles.confirmOverlay}
        >
          <View
            style={[
              styles.confirmContainer,
              {
                backgroundColor:
                  themeColors.surface,
                borderColor:
                  themeColors.border ||
                  'rgba(15,23,42,0.08)',
              },
            ]}
          >
            {/* ==================================================
                ICON
            ================================================== */}

            <View
              style={[
                styles.confirmIcon,
                {
                  backgroundColor:
                    isReject
                      ? '#DC262614'
                      : '#16A34A14',
                },
              ]}
            >
              <Ionicons
                name={
                  isReject
                    ? 'close-circle-outline'
                    : 'checkmark-circle-outline'
                }
                size={32}
                color={
                  isReject
                    ? '#DC2626'
                    : '#16A34A'
                }
              />
            </View>

            {/* ==================================================
                TITLE
            ================================================== */}

            <Text
              style={[
                styles.confirmTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {isReject
                ? 'Rejeter la demande ?'
                : 'Approuver la demande ?'}
            </Text>

            {/* ==================================================
                USER
            ================================================== */}

            <Text
              style={[
                styles.confirmUser,
                {
                  color:
                    themeColors.text,
                },
              ]}
              numberOfLines={1}
            >
              {confirmation?.therapist
                ?.fullname ||
                'Thérapeute'}
            </Text>

            {/* ==================================================
                MESSAGE
            ================================================== */}

            <Text
              style={[
                styles.confirmMessage,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {isReject
                ? 'Cette demande sera rejetée. Veuillez indiquer clairement le motif afin que le thérapeute puisse comprendre la raison du rejet.'
                : 'Cette demande sera approuvée et le compte professionnel pourra être activé.'}
            </Text>

            {/* ==================================================
                REJECTION FORM
            ================================================== */}

            {isReject && (
              <View
                style={
                  styles.rejectInputWrapper
                }
              >
                <View
                  style={
                    styles.rejectInputHeader
                  }
                >
                  <Text
                    style={
                      styles.rejectInputLabel
                    }
                  >
                    Description du rejet *
                  </Text>

                  <Text
                    style={
                      styles.rejectInputCounter
                    }
                  >
                    {rejectReason.length}/500
                  </Text>
                </View>

                <TextInput
                  value={rejectReason}
                  onChangeText={
                    handleChangeReason
                  }
                  placeholder="Ex. Votre pièce d'identité est illisible. Veuillez télécharger une nouvelle copie claire de votre CIN."
                  placeholderTextColor={
                    themeColors.textSecondary
                  }
                  multiline
                  numberOfLines={5}
                  scrollEnabled
                  textAlignVertical="top"
                  editable={!processing}
                  autoCorrect={false}
                  spellCheck={false}
                  autoCapitalize="sentences"
                  blurOnSubmit={false}
                  returnKeyType="default"
                  selectionColor={
                    colors.primary
                  }
                  {...(IS_WEB
                    ? {}
                    : {
                        cursorColor:
                          colors.primary,
                        underlineColorAndroid:
                          'transparent',
                      })}
                  style={[
                    styles.rejectInput,
                    {
                      color:
                        themeColors.text,
                      backgroundColor:
                        isDark
                          ? '#111827'
                          : '#FFFFFF',
                      borderColor:
                        rejectReason.trim()
                          ? '#DC262680'
                          : themeColors.border ||
                            '#E2E8F0',
                    },
                  ]}
                />

                {!rejectReason.trim() && (
                  <Text
                    style={
                      styles.requiredText
                    }
                  >
                    Le motif est obligatoire.
                  </Text>
                )}
              </View>
            )}

            {/* ==================================================
                BUTTONS
            ================================================== */}

            <View
              style={
                styles.confirmActions
              }
            >
              <TouchableOpacity
                disabled={processing}
                onPress={onCancel}
                activeOpacity={0.8}
                style={[
                  styles.confirmCancel,
                  {
                    backgroundColor:
                      isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#F1F5F9',
                    opacity:
                      processing ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.confirmCancelText,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={
                  processing ||
                  (isReject &&
                    !rejectReason.trim())
                }
                onPress={
                  confirmAction
                }
                activeOpacity={0.8}
                style={[
                  styles.confirmSubmit,
                  {
                    backgroundColor:
                      isReject
                        ? '#DC2626'
                        : '#16A34A',
                    opacity:
                      processing ||
                      (isReject &&
                        !rejectReason.trim())
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                {processing ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name={
                        isReject
                          ? 'close-outline'
                          : 'checkmark-outline'
                      }
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.confirmSubmitText
                      }
                    >
                      Confirmer
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ============================================================
   CHAMP DATE (saisie clavier + calendrier automatique)
   IMPORTANT :
   Comme pour ConfirmationModal, ce composant reste HORS de
   ApprovalsScreen pour éviter tout remount / perte de focus
   pendant la saisie.

   Comportement :
   - Web      : <input type="date"> natif du navigateur.
                L'utilisateur peut TAPER la date (JJ/MM/AAAA)
                OU cliquer l'icône calendrier fournie
                automatiquement par le navigateur.
   - Mobile   : champ tactile qui ouvre le calendrier natif
                iOS / Android (@react-native-community/datetimepicker).
                Sur Android le sélecteur natif s'affiche
                directement ; sur iOS il s'affiche dans une
                petite feuille avec un bouton "Valider".
============================================================ */

const DateField = ({
  value,
  onChange,
  placeholder,
  themeColors,
  isDark,
}) => {
  const [showPicker, setShowPicker] =
    useState(false);

  const [tempDate, setTempDate] =
    useState(
      value ? new Date(value) : new Date()
    );

  const toISODate = (d) =>
    d.toISOString().slice(0, 10);

  const openPicker = useCallback(() => {
    setTempDate(
      value ? new Date(value) : new Date()
    );
    setShowPicker(true);
  }, [value]);

  const handleNativeChange = useCallback(
    (event, selectedDate) => {
      if (Platform.OS === 'android') {
        setShowPicker(false);
        if (
          event.type === 'set' &&
          selectedDate
        ) {
          onChange(toISODate(selectedDate));
        }
        return;
      }

      if (selectedDate) {
        setTempDate(selectedDate);
      }
    },
    [onChange]
  );

  const confirmIOS = useCallback(() => {
    onChange(toISODate(tempDate));
    setShowPicker(false);
  }, [tempDate, onChange]);

  const cancelIOS = useCallback(() => {
    setShowPicker(false);
  }, []);

  if (IS_WEB) {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 108,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 11,
          fontFamily:
            typography.fontFamily.regular,
          color: themeColors.text,
          colorScheme: isDark
            ? 'dark'
            : 'light',
        }}
      />
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.7}
        style={styles.dateFieldTouchable}
      >
        <Text
          style={[
            styles.dateFilterInput,
            {
              color: value
                ? themeColors.text
                : themeColors.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
      </TouchableOpacity>

      {showPicker &&
        Platform.OS === 'android' && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleNativeChange}
          />
        )}

      {showPicker &&
        Platform.OS === 'ios' && (
          <Modal
            transparent
            animationType="fade"
            visible={showPicker}
            onRequestClose={cancelIOS}
          >
            <View
              style={
                styles.iosDatePickerOverlay
              }
            >
              <View
                style={[
                  styles.iosDatePickerSheet,
                  {
                    backgroundColor:
                      themeColors.surface,
                  },
                ]}
              >
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={
                    handleNativeChange
                  }
                  textColor={
                    themeColors.text
                  }
                />

                <View
                  style={
                    styles.iosDatePickerActions
                  }
                >
                  <TouchableOpacity
                    onPress={cancelIOS}
                    activeOpacity={0.8}
                    style={
                      styles.iosDatePickerCancel
                    }
                  >
                    <Text
                      style={
                        styles.iosDatePickerCancelText
                      }
                    >
                      Annuler
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={confirmIOS}
                    activeOpacity={0.8}
                    style={
                      styles.iosDatePickerConfirm
                    }
                  >
                    <Text
                      style={
                        styles.iosDatePickerConfirmText
                      }
                    >
                      Valider
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
    </>
  );
};

/* ============================================================
   SCREEN
============================================================ */

const ApprovalsScreen = () => {
  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const {
    width: windowWidth,
    height: windowHeight,
  } = useWindowDimensions();

  /* ==========================================================
     RESPONSIVE
  ========================================================== */

  const isMobile =
    !IS_WEB || windowWidth < 700;

  const isVerySmallMobile =
    !IS_WEB && windowWidth < 390;

  const isTablet =
    IS_WEB &&
    windowWidth >= 700 &&
    windowWidth < 1100;

  /* ==========================================================
     DATA
  ========================================================== */

  const [therapists, setTherapists] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [selected, setSelected] =
    useState(null);

  /* ==========================================================
     DETAILS MODAL
  ========================================================== */

  const [showModal, setShowModal] =
    useState(false);

  /* ==========================================================
     ✅ VISIONNEUSE PLEIN ÉCRAN (certificat professionnel)
  ========================================================== */

  const [showImageViewer, setShowImageViewer] =
    useState(false);

  const [viewerImage, setViewerImage] = useState({
    uri: null,
    title: '',
    fileName: 'document.jpg',
  });

  const openImageViewer = (uri, title, fileName) => {
    if (!uri) return;
    setViewerImage({ uri, title, fileName });
    setShowImageViewer(true);
  };

  const closeImageViewer = () => {
    setShowImageViewer(false);
  };

  /* ==========================================================
     ACTION MODAL
  ========================================================== */

  const [confirmation, setConfirmation] =
    useState(null);

  /* ==========================================================
     SEARCH / FILTER
  ========================================================== */

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  /* ==========================================================
     ✅ FILTRE PAR DATE DE DEMANDE
  ========================================================== */

  const [dateFrom, setDateFrom] =
    useState('');

  const [dateTo, setDateTo] =
    useState('');

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  /* ==========================================================
     ✅ EXPORT EXCEL (état de chargement, web + mobile)
  ========================================================== */

  const [exportingExcel, setExportingExcel] =
    useState(false);

  /* ==========================================================
     PAGINATION
  ========================================================== */

  const [currentPage, setCurrentPage] =
    useState(1);

  const PAGE_SIZE = 10;

  /* ==========================================================
     REJECTION DESCRIPTION
  ========================================================== */

  const [
    rejectReason,
    setRejectReason,
  ] = useState('');

  /* ==========================================================
     TOAST
  ========================================================== */

  const [toast, setToast] =
    useState(null);

  const toastOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const toastTranslateY = useRef(
    new Animated.Value(-25)
  ).current;

  /* ==========================================================
     TOAST
  ========================================================== */

  const showToast = useCallback(
    (message, type = 'info') => {
      setToast({
        message,
        type,
      });

      toastOpacity.stopAnimation();
      toastTranslateY.stopAnimation();

      toastOpacity.setValue(0);
      toastTranslateY.setValue(-25);

      Animated.parallel([
        Animated.timing(
          toastOpacity,
          {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }
        ),

        Animated.spring(
          toastTranslateY,
          {
            toValue: 0,
            tension: 90,
            friction: 8,
            useNativeDriver: true,
          }
        ),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(
            toastOpacity,
            {
              toValue: 0,
              duration: 180,
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            toastTranslateY,
            {
              toValue: -15,
              duration: 180,
              useNativeDriver: true,
            }
          ),
        ]).start(() => {
          setToast(null);
        });
      }, 3200);
    },
    [
      toastOpacity,
      toastTranslateY,
    ]
  );

  /* ==========================================================
     ✅ TÉLÉCHARGEMENT DE DOCUMENT (certificat professionnel, CIN...)
  ========================================================== */

  // Récupère le token JWT stocké côté client, quelle que soit la clé
  // utilisée par le AuthContext.
  const getAuthToken = async () => {
    const possibleKeys = [
      'authToken',
      'token',
      'accessToken',
      'access_token',
      'jwt',
      'userToken',
    ];

    try {
      for (const key of possibleKeys) {
        const value = await AsyncStorage.getItem(key);

        if (value) {
          try {
            const parsed = JSON.parse(value);

            if (parsed && typeof parsed === 'object' && parsed.token) {
              return parsed.token;
            }
          } catch {
            // value n'est pas du JSON, c'est probablement le token brut
          }

          return value;
        }
      }
    } catch (err) {
      console.warn('Impossible de récupérer le token auth:', err);
    }

    return null;
  };

  const handleDownload = async (
    url,
    suggestedFileName = 'document.pdf'
  ) => {
    if (!url) {
      showToast('Document indisponible', 'error');
      return;
    }

    try {
      const fullUrl = url.startsWith('http')
        ? url
        : `${API_URL}${url}`;

      if (IS_WEB) {
        // Sur le web, window.open() ne joint pas le header
        // Authorization : on récupère le fichier en blob nous-même.
        const token = await getAuthToken();

        const response = await fetch(fullUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              "Accès refusé : vous devez être connecté en tant qu'administrateur"
            );
          }

          throw new Error(`Erreur ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        let fileName = suggestedFileName;
        const disposition = response.headers.get('content-disposition');

        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/);

          if (match && match[1]) {
            fileName = match[1];
          }
        }

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(blobUrl);

        showToast('Téléchargement démarré', 'success');
      } else {
        const canOpen = await Linking.canOpenURL(fullUrl);

        if (canOpen) {
          await Linking.openURL(fullUrl);
        } else {
          showToast("Impossible d'ouvrir le document", 'error');
        }
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast(err?.message || 'Échec du téléchargement', 'error');
    }
  };

  /* ==========================================================
     LOAD
  ========================================================== */

  const load = useCallback(
    async () => {
      setLoading(true);

      try {
        const data =
          await adminService.getPendingTherapists();

        setTherapists(
          Array.isArray(data)
            ? data
            : []
        );

        setCurrentPage(1);
      } catch (e) {
        console.error(
          'Erreur chargement approbations:',
          e
        );

        setTherapists([]);

        showToast(
          e?.message ||
            'Impossible de charger les demandes.',
          'error'
        );
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /* ==========================================================
     REFRESH
  ========================================================== */

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await load();

      showToast(
        'Liste actualisée avec succès.',
        'success'
      );
    } finally {
      setRefreshing(false);
    }
  };

  /* ==========================================================
     FORMAT DATE
  ========================================================== */

  const formatDate = (
    dateString
  ) => {
    if (!dateString) {
      return 'N/A';
    }

    const d =
      new Date(dateString);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return 'N/A';
    }

    return `${d.getFullYear()}-${String(
      d.getMonth() + 1
    ).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  /* ==========================================================
     FORMAT MONEY
  ========================================================== */

  const formatMoney = (
    value
  ) => {
    const number =
      Number(value || 0);

    return `${number.toLocaleString(
      'fr-FR'
    )} Ar`;
  };

  /* ==========================================================
     ✅ STATUT DE LA DEMANDE
  ========================================================== */

  const getRequestStatus = (
    item
  ) => {
    const raw = String(
      item?.status ||
        item?.approval_status ||
        item?.request_status ||
        'pending'
    ).toLowerCase();

    if (
      raw.includes('approuv') ||
      raw.includes('approved') ||
      raw.includes('active')
    ) {
      return {
        key: 'approved',
        label: 'Approuvée',
        color: '#16A34A',
        background: '#16A34A14',
        icon: 'checkmark-circle',
      };
    }

    if (
      raw.includes('reject') ||
      raw.includes('refus')
    ) {
      return {
        key: 'rejected',
        label: 'Rejetée',
        color: '#DC2626',
        background: '#DC262614',
        icon: 'close-circle',
      };
    }

    return {
      key: 'pending',
      label: 'En attente',
      color: '#F59E0B',
      background: '#F59E0B14',
      icon: 'time-outline',
    };
  };

  /* ==========================================================
     SEARCH / FILTER
  ========================================================== */

  const filteredTherapists =
    therapists.filter((item) => {
      const query =
        search
          .trim()
          .toLowerCase();

      const matchesSearch =
        !query ||
        String(
          item.fullname || ''
        )
          .toLowerCase()
          .includes(query) ||
        String(
          item.email || ''
        )
          .toLowerCase()
          .includes(query) ||
        String(
          item.phone || ''
        )
          .toLowerCase()
          .includes(query) ||
        String(
          item.cin_number || ''
        )
          .toLowerCase()
          .includes(query);

      let matchesFilter =
        true;

      if (
        filter ===
        'with_document'
      ) {
        matchesFilter =
          !!item.identity_document_url;
      }

      if (
        filter ===
        'without_document'
      ) {
        matchesFilter =
          !item.identity_document_url;
      }

      let matchesDate = true;

      const itemDate = formatDate(
        item.created_at
      );

      if (
        dateFrom &&
        itemDate !== 'N/A'
      ) {
        matchesDate =
          matchesDate &&
          itemDate >= dateFrom;
      }

      if (
        dateTo &&
        itemDate !== 'N/A'
      ) {
        matchesDate =
          matchesDate &&
          itemDate <= dateTo;
      }

      if (
        (dateFrom || dateTo) &&
        itemDate === 'N/A'
      ) {
        matchesDate = false;
      }

      return (
        matchesSearch &&
        matchesFilter &&
        matchesDate
      );
    });

  /* ==========================================================
     PAGINATION
  ========================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredTherapists.length /
          PAGE_SIZE
      )
    );

  const paginatedTherapists =
    IS_WEB
      ? filteredTherapists.slice(
          (currentPage - 1) *
            PAGE_SIZE,
          currentPage *
            PAGE_SIZE
        )
      : filteredTherapists;

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, dateFrom, dateTo]);

  /* ==========================================================
     ✅ EXPORT EXCEL (liste filtrée, y compris le filtre de date)
  ========================================================== */

  const handleExportExcel = async () => {
    if (!filteredTherapists.length) {
      showToast(
        'Aucune donnée à exporter pour ces filtres.',
        'warning'
      );
      return;
    }

    if (exportingExcel) {
      return;
    }

    setExportingExcel(true);

    try {
      const rows = filteredTherapists.map(
        (item, index) => {
          const status =
            getRequestStatus(item);

          return {
            'N°': index + 1,
            ID: item.id ?? '',
            'Nom complet':
              item.fullname || '',
            Email: item.email || '',
            Téléphone: item.phone || '',
            CIN: item.cin_number || '',
            'Date de la demande':
              formatDate(item.created_at),
            'Statut de la demande':
              status.label,
            'Document CIN':
              item.identity_document_url
                ? 'Disponible'
                : 'Manquante',
            'Certificat professionnel':
              item.certificate_professionnel
                ? 'Disponible'
                : 'Manquant',
          };
        }
      );

      const worksheet =
        XLSX.utils.json_to_sheet(rows);

      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 8 },
        { wch: 26 },
        { wch: 28 },
        { wch: 16 },
        { wch: 16 },
        { wch: 15 },
        { wch: 17 },
        { wch: 15 },
        { wch: 22 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Demandes'
      );

      const dateSuffix = new Date()
        .toISOString()
        .slice(0, 10);

      const fileName = `demandes_therapeutes_${dateSuffix}.xlsx`;

      /* ------------------------------------------------------
         WEB : téléchargement direct via un lien Blob
      ------------------------------------------------------ */

      if (IS_WEB) {
        const wbout = XLSX.write(
          workbook,
          {
            bookType: 'xlsx',
            type: 'array',
          }
        );

        const blob = new Blob(
          [wbout],
          {
            type: 'application/octet-stream',
          }
        );

        const blobUrl =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement('a');

        link.href = blobUrl;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(
          blobUrl
        );
      } else {
        /* ------------------------------------------------------
           ANDROID / iOS : écriture du fichier puis partage natif
        ------------------------------------------------------ */

        const wbout = XLSX.write(
          workbook,
          {
            bookType: 'xlsx',
            type: 'base64',
          }
        );

        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(
          fileUri,
          wbout,
          {
            encoding:
              FileSystem.EncodingType
                .Base64,
          }
        );

        const canShare =
          await Sharing.isAvailableAsync();

        if (!canShare) {
          showToast(
            "Le partage de fichiers n'est pas disponible sur cet appareil. Le fichier a été enregistré dans le cache de l'application.",
            'warning'
          );
        } else {
          await Sharing.shareAsync(
            fileUri,
            {
              mimeType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              dialogTitle:
                'Exporter Excel',
              UTI: 'com.microsoft.excel.xlsx',
            }
          );
        }
      }

      showToast(
        `Export Excel généré (${filteredTherapists.length} ligne${
          filteredTherapists.length > 1
            ? 's'
            : ''
        }).`,
        'success'
      );
    } catch (err) {
      console.error(
        'Export Excel error:',
        err
      );

      showToast(
        "Échec de l'export Excel.",
        'error'
      );
    } finally {
      setExportingExcel(false);
    }
  };

  /* ==========================================================
     OPEN DETAILS
  ========================================================== */

  const openDetails = (
    therapist
  ) => {
    setSelected(therapist);
    setRejectReason('');
    setShowModal(true);
  };

  const closeDetails = () => {
    if (processing) {
      return;
    }

    setShowModal(false);
    setRejectReason('');
  };

  /* ==========================================================
     APPROVE
  ========================================================== */

  const requestApprove = (
    therapist
  ) => {
    setShowModal(false);

    setConfirmation({
      type: 'approve',
      therapist,
      reason: '',
    });
  };

  /* ==========================================================
     REJECT
  ========================================================== */

  const requestReject = (
    therapist
  ) => {
    setShowModal(false);

    setRejectReason('');

    setConfirmation({
      type: 'reject',
      therapist,
      reason: '',
    });
  };

  /* ==========================================================
     CANCEL CONFIRMATION
  ========================================================== */

  const cancelConfirmation =
    useCallback(() => {
      if (processing) {
        return;
      }

      setConfirmation(null);
      setRejectReason('');
    }, [processing]);

  /* ==========================================================
     CONFIRM ACTION
  ========================================================== */

  const confirmAction =
    useCallback(
      async () => {
        if (
          !confirmation ||
          !confirmation.therapist
        ) {
          return;
        }

        const therapist =
          confirmation.therapist;

        const type =
          confirmation.type;

        if (
          type === 'reject' &&
          !rejectReason.trim()
        ) {
          showToast(
            'Veuillez saisir le motif du rejet.',
            'warning'
          );

          return;
        }

        setProcessing(true);

        try {
          if (
            type === 'approve'
          ) {
            await adminService.approveTherapist(
              therapist.id
            );

            showToast(
              'Thérapeute approuvé avec succès.',
              'success'
            );
          }

          if (
            type === 'reject'
          ) {
            await adminService.rejectTherapist(
              therapist.id,
              rejectReason.trim()
            );

            showToast(
              'Demande rejetée avec succès.',
              'success'
            );
          }

          setConfirmation(null);
          setSelected(null);
          setShowModal(false);
          setRejectReason('');

          await load();
        } catch (e) {
          console.error(
            'Erreur action approbation:',
            e
          );

          showToast(
            e?.message ||
              'Une erreur est survenue pendant cette opération.',
            'error'
          );
        } finally {
          setProcessing(false);
        }
      },
      [
        confirmation,
        rejectReason,
        showToast,
        load,
      ]
    );

  /* ==========================================================
     AVATAR
  ========================================================== */

  const Avatar = ({
    item,
    size = 48,
  }) => {
    const firstLetter =
      item?.fullname
        ?.trim()
        ?.charAt(0)
        ?.toUpperCase() ||
      '?';

    const frameSize = size + 6;

    if (
      item?.profile_image
    ) {
      return (
        <View
          style={[
            styles.avatarFrame,
            {
              width: frameSize,
              height: frameSize,
              borderRadius: 15,
              borderColor:
                isDark
                  ? 'rgba(255,255,255,0.14)'
                  : '#FFFFFF',
              backgroundColor:
                isDark
                  ? 'rgba(255,255,255,0.06)'
                  : '#F1F5F9',
            },
          ]}
        >
          <Image
            source={{
              uri: item.profile_image,
            }}
            style={{
              width: size,
              height: size,
              borderRadius: 12,
            }}
          />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.avatarFrame,
          {
            width: frameSize,
            height: frameSize,
            borderRadius: 15,
            borderColor:
              isDark
                ? 'rgba(255,255,255,0.14)'
                : '#FFFFFF',
            backgroundColor:
              isDark
                ? 'rgba(255,255,255,0.06)'
                : '#F1F5F9',
          },
        ]}
      >
        <View
          style={[
            styles.avatarPlaceholder,
            {
              width: size,
              height: size,
              borderRadius: 12,
              backgroundColor:
                `${colors.primary}16`,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              {
                color:
                  colors.primary,
                fontSize:
                  size * 0.38,
              },
            ]}
          >
            {firstLetter}
          </Text>
        </View>
      </View>
    );
  };

  /* ==========================================================
     TOAST
  ========================================================== */

  const Toast = () => {
    if (!toast) {
      return null;
    }

    const configs = {
      success: {
        icon: 'checkmark-circle',
        background:
          '#16A34A',
      },

      error: {
        icon: 'alert-circle',
        background:
          '#DC2626',
      },

      warning: {
        icon: 'warning',
        background:
          '#F59E0B',
      },

      info: {
        icon: 'information-circle',
        background:
          colors.primary,
      },
    };

    const config =
      configs[toast.type] ||
      configs.info;

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toastWrapper,
          {
            opacity:
              toastOpacity,
            transform: [
              {
                translateY:
                  toastTranslateY,
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.toast,
            {
              backgroundColor:
                config.background,
            },
          ]}
        >
          <Ionicons
            name={config.icon}
            size={21}
            color="#FFFFFF"
          />

          <Text
            style={styles.toastText}
            numberOfLines={3}
          >
            {toast.message}
          </Text>
        </View>
      </Animated.View>
    );
  };

  /* ==========================================================
     FILTER BUTTON
  ========================================================== */

  const FilterButton = ({
    value,
    label,
    icon,
  }) => {
    const active =
      filter === value;

    return (
      <TouchableOpacity
        onPress={() =>
          setFilter(value)
        }
        activeOpacity={0.8}
        style={[
          styles.filterButton,
          {
            backgroundColor:
              active
                ? colors.primary
                : themeColors.surface,
            borderColor:
              active
                ? colors.primary
                : themeColors.border ||
                  'rgba(15,23,42,0.08)',
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={15}
          color={
            active
              ? '#FFFFFF'
              : themeColors.textSecondary
          }
        />

        <Text
          style={[
            styles.filterButtonText,
            {
              color:
                active
                  ? '#FFFFFF'
                  : themeColors.text,
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ==========================================================
     SEARCH
  ========================================================== */

  const SearchAndFilters =
    () => (
      <View
        style={styles.toolbar}
      >
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border ||
                'rgba(15,23,42,0.08)',
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={19}
            color={
              themeColors.textSecondary
            }
          />

          <TextInput
            value={search}
            onChangeText={
              setSearch
            }
            placeholder="Rechercher nom, email, téléphone, CIN..."
            placeholderTextColor={
              themeColors.textSecondary
            }
            style={[
              styles.searchInput,
              {
                color:
                  themeColors.text,
              },
            ]}
          />

          {!!search && (
            <TouchableOpacity
              onPress={() =>
                setSearch('')
              }
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={
                  themeColors.textSecondary
                }
              />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filters
          }
        >
          <FilterButton
            value="all"
            label="Toutes"
            icon="apps-outline"
          />

          <FilterButton
            value="with_document"
            label="CIN disponible"
            icon="document-text-outline"
          />

          <FilterButton
            value="without_document"
            label="Sans CIN"
            icon="alert-circle-outline"
          />
        </ScrollView>
      </View>
    );

  /* ==========================================================
     ✅ BARRE DE FILTRE PAR DATE + EXPORT EXCEL
  ========================================================== */

  const DateFilterBar = () => (
    <View
      style={styles.dateFilterBar}
    >
      <View
        style={[
          styles.dateFilterField,
          {
            backgroundColor:
              themeColors.surface,
            borderColor:
              themeColors.border ||
              'rgba(15,23,42,0.08)',
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={15}
          color={
            themeColors.textSecondary
          }
        />

        <DateField
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="Du (AAAA-MM-JJ)"
          themeColors={themeColors}
          isDark={isDark}
        />
      </View>

      <Text
        style={[
          styles.dateFilterSeparator,
          {
            color:
              themeColors.textSecondary,
          },
        ]}
      >
        →
      </Text>

      <View
        style={[
          styles.dateFilterField,
          {
            backgroundColor:
              themeColors.surface,
            borderColor:
              themeColors.border ||
              'rgba(15,23,42,0.08)',
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={15}
          color={
            themeColors.textSecondary
          }
        />

        <DateField
          value={dateTo}
          onChange={setDateTo}
          placeholder="Au (AAAA-MM-JJ)"
          themeColors={themeColors}
          isDark={isDark}
        />
      </View>

      {(!!dateFrom || !!dateTo) && (
        <TouchableOpacity
          onPress={clearDateFilter}
          activeOpacity={0.8}
          style={[
            styles.dateFilterClear,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border ||
                'rgba(15,23,42,0.08)',
            },
          ]}
        >
          <Ionicons
            name="close-circle-outline"
            size={15}
            color={
              themeColors.textSecondary
            }
          />

          <Text
            style={[
              styles.dateFilterClearText,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            Effacer
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleExportExcel}
        disabled={exportingExcel}
        activeOpacity={0.85}
        style={[
          styles.exportExcelButton,
          {
            opacity: exportingExcel
              ? 0.7
              : 1,
          },
        ]}
      >
        {exportingExcel ? (
          <ActivityIndicator
            size="small"
            color="#FFFFFF"
          />
        ) : (
          <Ionicons
            name="download-outline"
            size={16}
            color="#FFFFFF"
          />
        )}

        <Text
          style={
            styles.exportExcelButtonText
          }
        >
          {exportingExcel
            ? 'Export en cours…'
            : 'Exporter Excel'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  /* ==========================================================
     MOBILE CARD
  ========================================================== */

  const renderMobileCard =
    ({ item }) => (
      <Pressable
        onPress={() =>
          openDetails(item)
        }
        style={({
          pressed,
        }) => [
          styles.mobileCard,
          {
            backgroundColor:
              themeColors.surface,
            borderColor:
              themeColors.border ||
              'rgba(15,23,42,0.06)',
            opacity: pressed
              ? 0.92
              : 1,
          },
        ]}
      >
        <Avatar item={item} />

        <View
          style={
            styles.mobileCardContent
          }
        >
          <View
            style={
              styles.mobileCardHeader
            }
          >
            <View
              style={
                styles.mobileCardIdentity
              }
            >
              <Text
                style={[
                  styles.mobileName,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {item.fullname ||
                  'Nom non renseigné'}
              </Text>

              <Text
                style={[
                  styles.mobileEmail,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {item.email ||
                  'Email non renseigné'}
              </Text>

              <View
                style={[
                  styles.idBadge,
                  {
                    marginTop: 4,
                    backgroundColor:
                      isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#F1F5F9',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.idBadgeText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  ID #{item.id ?? '—'}
                </Text>
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={19}
              color={
                themeColors.textSecondary
              }
            />
          </View>

          <View
            style={
              styles.mobileMetaRow
            }
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={
                themeColors.textSecondary
              }
            />

            <Text
              style={[
                styles.mobileMeta,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {formatDate(
                item.created_at
              )}
            </Text>
          </View>

          <View
            style={
              styles.mobileBottomRow
            }
          >
            <View
              style={[
                styles.documentBadge,
                {
                  backgroundColor:
                    item.identity_document_url
                      ? '#16A34A14'
                      : '#DC262614',
                },
              ]}
            >
              <Ionicons
                name={
                  item.identity_document_url
                    ? 'checkmark-circle-outline'
                    : 'alert-circle-outline'
                }
                size={14}
                color={
                  item.identity_document_url
                    ? '#16A34A'
                    : '#DC2626'
                }
              />

              <Text
                style={[
                  styles.documentBadgeText,
                  {
                    color:
                      item.identity_document_url
                        ? '#16A34A'
                        : '#DC2626',
                  },
                ]}
              >
                {item.identity_document_url
                  ? 'CIN disponible'
                  : 'CIN manquante'}
              </Text>
            </View>

            {(() => {
              const requestStatus =
                getRequestStatus(item);

              return (
                <View
                  style={[
                    styles.documentBadge,
                    {
                      backgroundColor:
                        requestStatus.background,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      requestStatus.icon
                    }
                    size={14}
                    color={
                      requestStatus.color
                    }
                  />

                  <Text
                    style={[
                      styles.documentBadgeText,
                      {
                        color:
                          requestStatus.color,
                      },
                    ]}
                  >
                    {requestStatus.label}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
      </Pressable>
    );

  /* ==========================================================
     WEB TABLE ROW
  ========================================================== */

  const TableRow = ({
    item,
    index,
  }) => {
    const [
      hovered,
      setHovered,
    ] = useState(false);

    return (
      <View
        style={[
          styles.tableRow,
          {
            backgroundColor:
              hovered
                ? isDark
                  ? 'rgba(255,255,255,0.035)'
                  : '#F8FAFC'
                : 'transparent',

            borderBottomColor:
              isDark
                ? 'rgba(255,255,255,0.05)'
                : '#EEF1F5',
          },
        ]}
        onMouseEnter={() =>
          setHovered(true)
        }
        onMouseLeave={() =>
          setHovered(false)
        }
      >
        <View
          style={[
            styles.tableCell,
            styles.cellIndex,
          ]}
        >
          <Text
            style={[
              styles.tableText,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            {index + 1}
          </Text>
        </View>

        <View
          style={[
            styles.tableCell,
            styles.cellId,
          ]}
        >
          <View
            style={[
              styles.idBadge,
              {
                backgroundColor:
                  isDark
                    ? 'rgba(255,255,255,0.06)'
                    : '#F1F5F9',
              },
            ]}
          >
            <Text
              style={[
                styles.idBadgeText,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              #{item.id ?? '—'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() =>
            openDetails(item)
          }
          style={[
            styles.tableCell,
            styles.cellTherapist,
          ]}
        >
          <Avatar
            item={item}
            size={40}
          />

          <View
            style={
              styles.tableIdentity
            }
          >
            <Text
              style={[
                styles.tableName,
                {
                  color:
                    themeColors.text,
                },
              ]}
              numberOfLines={1}
            >
              {item.fullname ||
                'Nom non renseigné'}
            </Text>

            <Text
              style={[
                styles.tableEmail,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {item.email ||
                'Email non renseigné'}
            </Text>
          </View>
        </Pressable>

        <View
          style={[
            styles.tableCell,
            styles.cellPhone,
          ]}
        >
          <Text
            style={[
              styles.tableText,
              {
                color:
                  themeColors.text,
              },
            ]}
            numberOfLines={1}
          >
            {item.phone ||
              'Non renseigné'}
          </Text>
        </View>

        <View
          style={[
            styles.tableCell,
            styles.cellCIN,
          ]}
        >
          <Text
            style={[
              styles.tableText,
              {
                color:
                  themeColors.text,
              },
            ]}
            numberOfLines={1}
          >
            {item.cin_number ||
              'Non renseignée'}
          </Text>
        </View>

        <View
          style={[
            styles.tableCell,
            styles.cellDate,
          ]}
        >
          <Text
            style={[
              styles.tableText,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            {formatDate(
              item.created_at
            )}
          </Text>
        </View>

        <View
          style={[
            styles.tableCell,
            styles.cellDocument,
          ]}
        >
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.identity_document_url
                    ? '#16A34A14'
                    : '#DC262614',
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    item.identity_document_url
                      ? '#16A34A'
                      : '#DC2626',
                },
              ]}
            />

            <Text
              style={[
                styles.statusText,
                {
                  color:
                    item.identity_document_url
                      ? '#16A34A'
                      : '#DC2626',
                },
              ]}
            >
              {item.identity_document_url
                ? 'Disponible'
                : 'Manquante'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.tableCell,
            styles.cellStatus,
          ]}
        >
          {(() => {
            const requestStatus =
              getRequestStatus(item);

            return (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      requestStatus.background,
                  },
                ]}
              >
                <Ionicons
                  name={
                    requestStatus.icon
                  }
                  size={12}
                  color={
                    requestStatus.color
                  }
                />

                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        requestStatus.color,
                    },
                  ]}
                >
                  {requestStatus.label}
                </Text>
              </View>
            );
          })()}
        </View>

        <View
          style={[
            styles.tableCell,
            styles.cellAction,
          ]}
        >
          <View
            style={
              styles.webActionGroup
            }
          >
            <TouchableOpacity
              onPress={() =>
                requestApprove(item)
              }
              disabled={processing}
              activeOpacity={0.75}
              style={[
                styles.webActionIcon,
                {
                  backgroundColor:
                    '#16A34A14',
                },
              ]}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color="#16A34A"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                requestReject(item)
              }
              disabled={processing}
              activeOpacity={0.75}
              style={[
                styles.webActionIcon,
                {
                  backgroundColor:
                    '#DC262614',
                },
              ]}
            >
              <Ionicons
                name="close"
                size={18}
                color="#DC2626"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                openDetails(item)
              }
              disabled={processing}
              activeOpacity={0.75}
              style={[
                styles.webActionIcon,
                {
                  backgroundColor:
                    `${colors.primary}10`,
                },
              ]}
            >
              <Ionicons
                name="eye-outline"
                size={17}
                color={
                  colors.primary
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /* ==========================================================
     TABLE HEADER
  ========================================================== */

  const TableHeader = ({
    title,
    style,
  }) => (
    <View
      style={[
        styles.tableHeaderCell,
        style,
      ]}
    >
      <Text
        style={[
          styles.tableHeaderText,
          {
            color:
              themeColors.textSecondary,
          },
        ]}
      >
        {title}
      </Text>
    </View>
  );

  /* ==========================================================
     WEB TABLE
  ========================================================== */

  const WebTable = () => (
    <View
      style={[
        styles.tableWrapper,
        {
          backgroundColor:
            themeColors.surface,
          borderColor:
            themeColors.border ||
            'rgba(15,23,42,0.06)',
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
      >
        <View
          style={[
            styles.table,
            {
              minWidth: Math.max(
                isTablet ? 1080 : 1340,
                windowWidth - 48
              ),
            },
          ]}
        >
          <View
            style={[
              styles.tableHeader,
              {
                backgroundColor:
                  isDark
                    ? '#111827'
                    : '#F8FAFC',
                borderBottomColor:
                  isDark
                    ? 'rgba(255,255,255,0.06)'
                    : '#E8EDF3',
              },
            ]}
          >
            <TableHeader
              title="#"
              style={
                styles.cellIndex
              }
            />

            <TableHeader
              title="ID"
              style={
                styles.cellId
              }
            />

            <TableHeader
              title="THÉRAPEUTE"
              style={
                styles.cellTherapist
              }
            />

            <TableHeader
              title="TÉLÉPHONE"
              style={
                styles.cellPhone
              }
            />

            <TableHeader
              title="CIN"
              style={
                styles.cellCIN
              }
            />

            <TableHeader
              title="DEMANDE"
              style={
                styles.cellDate
              }
            />

            <TableHeader
              title="DOCUMENT"
              style={
                styles.cellDocument
              }
            />

            <TableHeader
              title="STATUT"
              style={
                styles.cellStatus
              }
            />

            <TableHeader
              title="ACTIONS"
              style={
                styles.cellAction
              }
            />
          </View>

          <ScrollView
            style={[
              styles.tableVerticalScroll,
              {
                maxHeight:
                  isTablet
                    ? windowHeight -
                      350
                    : windowHeight -
                      330,
              },
            ]}
            showsVerticalScrollIndicator
          >
            {paginatedTherapists.map(
              (
                item,
                index
              ) => (
                <TableRow
                  key={String(
                    item.id
                  )}
                  item={item}
                  index={
                    (currentPage -
                      1) *
                      PAGE_SIZE +
                    index
                  }
                />
              )
            )}

            {paginatedTherapists.length ===
              0 && (
              <View
                style={
                  styles.tableEmpty
                }
              >
                <Ionicons
                  name="search-outline"
                  size={44}
                  color={
                    themeColors.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.emptyText,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Aucune demande trouvée
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );

  /* ==========================================================
     PAGINATION
  ========================================================== */

  const Pagination = () => {
    if (!IS_WEB) {
      return null;
    }

    if (
      filteredTherapists.length <=
      PAGE_SIZE
    ) {
      return null;
    }

    return (
      <View
        style={[
          styles.pagination,
          {
            borderTopColor:
              themeColors.border ||
              'rgba(15,23,42,0.06)',
          },
        ]}
      >
        <Text
          style={[
            styles.paginationInfo,
            {
              color:
                themeColors.textSecondary,
            },
          ]}
        >
          {filteredTherapists.length}{' '}
          demande(s)
        </Text>

        <View
          style={
            styles.paginationButtons
          }
        >
          <TouchableOpacity
            disabled={
              currentPage <= 1
            }
            onPress={() =>
              setCurrentPage(
                (page) =>
                  Math.max(
                    1,
                    page - 1
                  )
              )
            }
            style={[
              styles.pageButton,
              {
                opacity:
                  currentPage <= 1
                    ? 0.4
                    : 1,
                backgroundColor:
                  themeColors.surface,
                borderColor:
                  themeColors.border ||
                  'rgba(15,23,42,0.08)',
              },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={17}
              color={
                themeColors.text
              }
            />
          </TouchableOpacity>

          <View
            style={[
              styles.pageCurrent,
              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          >
            <Text
              style={
                styles.pageCurrentText
              }
            >
              {currentPage}
            </Text>
          </View>

          <Text
            style={[
              styles.pageTotal,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            / {totalPages}
          </Text>

          <TouchableOpacity
            disabled={
              currentPage >=
              totalPages
            }
            onPress={() =>
              setCurrentPage(
                (page) =>
                  Math.min(
                    totalPages,
                    page + 1
                  )
              )
            }
            style={[
              styles.pageButton,
              {
                opacity:
                  currentPage >=
                  totalPages
                    ? 0.4
                    : 1,
                backgroundColor:
                  themeColors.surface,
                borderColor:
                  themeColors.border ||
                  'rgba(15,23,42,0.08)',
              },
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={17}
              color={
                themeColors.text
              }
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ==========================================================
     DETAILS MODAL
  ========================================================== */

  const DetailsModal =
    () => {
      if (!selected) {
        return null;
      }

      return (
        <Modal
          visible={showModal}
          transparent
          animationType="fade"
          onRequestClose={
            closeDetails
          }
        >
          <View
            style={[
              styles.modalOverlay,
              {
                paddingHorizontal:
                  isVerySmallMobile
                    ? 8
                    : 12,
              },
            ]}
          >
            <View
              style={[
                styles.detailsModal,
                {
                  width: isMobile
                    ? '100%'
                    : 'min(900px, 92vw)',
                  maxWidth: isMobile
                    ? 430
                    : 900,
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border ||
                    'rgba(15,23,42,0.08)',
                },
              ]}
            >
              {/* HEADER */}

              <View
                style={[
                  styles.modalHeader,
                  {
                    borderBottomColor:
                      themeColors.border ||
                      'rgba(15,23,42,0.06)',
                  },
                ]}
              >
                <View
                  style={
                    styles.modalHeaderLeft
                  }
                >
                  <View
                    style={[
                      styles.modalHeaderIcon,
                      {
                        backgroundColor:
                          `${colors.primary}12`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={
                        isMobile
                          ? 18
                          : 20
                      }
                      color={
                        colors.primary
                      }
                    />
                  </View>

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={[
                        styles.modalTitle,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      Dossier de candidature
                    </Text>

                    <Text
                      style={[
                        styles.modalSubtitle,
                        {
                          color:
                            themeColors.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      Vérification du profil
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={
                    closeDetails
                  }
                  disabled={
                    processing
                  }
                  style={[
                    styles.closeButton,
                    {
                      backgroundColor:
                        isDark
                          ? 'rgba(255,255,255,0.06)'
                          : '#F1F5F9',
                    },
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={
                      themeColors.text
                    }
                  />
                </TouchableOpacity>
              </View>

              {/* CONTENT */}

              <ScrollView
                style={
                  styles.detailsScroll
                }
                contentContainerStyle={[
                  styles.detailsContent,
                  {
                    padding:
                      isVerySmallMobile
                        ? 11
                        : isMobile
                        ? 14
                        : 22,
                  },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={
                  false
                }
              >
                {/* PROFILE */}

                <View
                  style={
                    styles.profileCompact
                  }
                >
                  <Avatar
                    item={selected}
                    size={
                      isVerySmallMobile
                        ? 54
                        : isMobile
                        ? 62
                        : 72
                    }
                  />

                  <View
                    style={
                      styles.profileCompactInfo
                    }
                  >
                    <Text
                      style={[
                        styles.modalName,
                        {
                          color:
                            themeColors.text,
                          fontSize:
                            isMobile
                              ? 15
                              : 18,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selected.fullname ||
                        'Nom non renseigné'}
                    </Text>

                    <Text
                      style={[
                        styles.modalEmail,
                        {
                          color:
                            themeColors.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selected.email ||
                        'Email non renseigné'}
                    </Text>

                    <View
                      style={[
                        styles.pendingBadge,
                        {
                          backgroundColor:
                            '#F59E0B14',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.pendingDot,
                          {
                            backgroundColor:
                              '#F59E0B',
                          },
                        ]}
                      />

                      <Text
                        style={
                          styles.pendingText
                        }
                      >
                        En attente
                      </Text>
                    </View>
                  </View>
                </View>

                {/* INFORMATION GRID */}

                <View
                  style={
                    styles.detailsGrid
                  }
                >
                  <CompactInfo
                    icon="mail-outline"
                    label="Email"
                    value={
                      selected.email
                    }
                    themeColors={
                      themeColors
                    }
                  />

                  <CompactInfo
                    icon="call-outline"
                    label="Téléphone"
                    value={
                      selected.phone ||
                      'Non renseigné'
                    }
                    themeColors={
                      themeColors
                    }
                  />

                  <CompactInfo
                    icon="card-outline"
                    label="N° CIN"
                    value={
                      selected.cin_number ||
                      'Non renseigné'
                    }
                    themeColors={
                      themeColors
                    }
                  />

                  <CompactInfo
                    icon="location-outline"
                    label="Adresse"
                    value={
                      selected.address ||
                      'Non renseignée'
                    }
                    themeColors={
                      themeColors
                    }
                  />

                  <CompactInfo
                    icon="calendar-outline"
                    label="Demande"
                    value={formatDate(
                      selected.created_at
                    )}
                    themeColors={
                      themeColors
                    }
                  />

                  <CompactInfo
                    icon="briefcase-outline"
                    label="Expérience"
                    value={`${selected.experience_years || 0} ans`}
                    themeColors={
                      themeColors
                    }
                  />

                  <CompactInfo
                    icon="cash-outline"
                    label="Prix de base"
                    value={formatMoney(
                      selected.base_price
                    )}
                    themeColors={
                      themeColors
                    }
                  />

                  <CompactInfo
                    icon="document-text-outline"
                    label="Document"
                    value={
                      selected.identity_document_url
                        ? 'CIN disponible'
                        : 'CIN manquante'
                    }
                    valueColor={
                      selected.identity_document_url
                        ? '#16A34A'
                        : '#DC2626'
                    }
                    themeColors={
                      themeColors
                    }
                  />
                </View>

                {/* BIO */}

                <View
                  style={
                    styles.compactBioSection
                  }
                >
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Biographie
                  </Text>

                  <View
                    style={[
                      styles.compactBioBox,
                      {
                        backgroundColor:
                          isDark
                            ? 'rgba(255,255,255,0.035)'
                            : '#F8FAFC',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bioTextCompact,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {selected.bio ||
                        'Aucune biographie renseignée.'}
                    </Text>
                  </View>
                </View>

                {/* DOCUMENT */}

                <View
                  style={
                    styles.documentCompact
                  }
                >
                  <View
                    style={
                      styles.documentHeader
                    }
                  >
                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color:
                            themeColors.text,
                          marginBottom: 0,
                        },
                      ]}
                    >
                      Pièce d'identité
                    </Text>

                    <View
                      style={[
                        styles.documentStatus,
                        {
                          backgroundColor:
                            selected.identity_document_url
                              ? '#16A34A14'
                              : '#DC262614',
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          selected.identity_document_url
                            ? 'checkmark-circle'
                            : 'alert-circle'
                        }
                        size={13}
                        color={
                          selected.identity_document_url
                            ? '#16A34A'
                            : '#DC2626'
                        }
                      />

                      <Text
                        style={[
                          styles.documentStatusText,
                          {
                            color:
                              selected.identity_document_url
                                ? '#16A34A'
                                : '#DC2626',
                          },
                        ]}
                      >
                        {selected.identity_document_url
                          ? 'Disponible'
                          : 'Manquante'}
                      </Text>
                    </View>
                  </View>

                  {selected.identity_document_url ? (
                    <>
                      <TouchableOpacity
                        onPress={() =>
                          openImageViewer(
                            selected.identity_document_url,
                            "Pièce d'identité (CIN)",
                            `CIN_${selected.fullname || 'therapeute'}.jpg`
                          )
                        }
                        activeOpacity={0.9}
                        style={[
                          styles.cinPreview,
                          {
                            backgroundColor:
                              isDark
                                ? '#111827'
                                : '#F1F5F9',
                          },
                        ]}
                      >
                        <Image
                          source={{
                            uri: selected.identity_document_url,
                          }}
                          style={
                            styles.cinPreviewImage
                          }
                          resizeMode="contain"
                        />

                        <View style={styles.certZoomBadge}>
                          <Ionicons
                            name="expand-outline"
                            size={13}
                            color="#FFFFFF"
                          />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          handleDownload(
                            selected.identity_document_url,
                            `CIN_${selected.fullname || 'therapeute'}.jpg`
                          )
                        }
                        style={styles.certDownloadButton}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="download-outline"
                          size={19}
                          color="#FFFFFF"
                        />

                        <Text
                          style={
                            styles.certDownloadButtonText
                          }
                        >
                          Télécharger la CIN
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View
                      style={[
                        styles.noCinCompact,
                        {
                          backgroundColor:
                            isDark
                              ? 'rgba(220,38,38,0.08)'
                              : '#FEF2F2',
                        },
                      ]}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={20}
                        color="#DC2626"
                      />

                      <Text
                        style={
                          styles.noCinCompactText
                        }
                      >
                        Aucun document CIN n'a été téléchargé.
                      </Text>
                    </View>
                  )}
                </View>

                {/* ✅ CERTIFICAT PROFESSIONNEL (uploadé par le thérapeute) */}

                <View
                  style={
                    styles.documentCompact
                  }
                >
                  <View
                    style={
                      styles.documentHeader
                    }
                  >
                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color:
                            themeColors.text,
                          marginBottom: 0,
                        },
                      ]}
                    >
                      Certificat professionnel
                    </Text>

                    <View
                      style={[
                        styles.documentStatus,
                        {
                          backgroundColor:
                            selected.certificate_professionnel
                              ? '#16A34A14'
                              : '#DC262614',
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          selected.certificate_professionnel
                            ? 'checkmark-circle'
                            : 'alert-circle'
                        }
                        size={13}
                        color={
                          selected.certificate_professionnel
                            ? '#16A34A'
                            : '#DC2626'
                        }
                      />

                      <Text
                        style={[
                          styles.documentStatusText,
                          {
                            color:
                              selected.certificate_professionnel
                                ? '#16A34A'
                                : '#DC2626',
                          },
                        ]}
                      >
                        {selected.certificate_professionnel
                          ? 'Disponible'
                          : 'Manquant'}
                      </Text>
                    </View>
                  </View>

                  {selected.certificate_professionnel ? (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                          openImageViewer(
                            selected.certificate_professionnel,
                            `Certificat professionnel — ${selected.fullname || 'Thérapeute'}`,
                            `Certificat_${selected.fullname || 'therapeute'}.jpg`
                          )
                        }
                        style={[
                          styles.certPreview,
                          {
                            backgroundColor:
                              isDark
                                ? '#111827'
                                : '#F1F5F9',
                          },
                        ]}
                      >
                        {selected.certificate_professionnel
                          .toLowerCase()
                          .endsWith('.pdf') ? (
                          <View
                            style={
                              styles.certPdfBox
                            }
                          >
                            <Ionicons
                              name="document-text-outline"
                              size={32}
                              color={colors.primary}
                            />

                            <Text
                              style={[
                                styles.certPdfText,
                                {
                                  color:
                                    themeColors.textSecondary,
                                },
                              ]}
                            >
                              Document PDF — Appuyer pour agrandir
                            </Text>
                          </View>
                        ) : (
                          <Image
                            source={{
                              uri: selected.certificate_professionnel,
                            }}
                            style={
                              styles.certPreviewImage
                            }
                            resizeMode="contain"
                          />
                        )}

                        <View style={styles.certZoomBadge}>
                          <Ionicons
                            name="expand-outline"
                            size={13}
                            color="#FFFFFF"
                          />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          handleDownload(
                            selected.certificate_professionnel,
                            `Certificat_${selected.fullname || 'therapeute'}.jpg`
                          )
                        }
                        style={styles.certDownloadButton}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="download-outline"
                          size={19}
                          color="#FFFFFF"
                        />

                        <Text
                          style={
                            styles.certDownloadButtonText
                          }
                        >
                          Télécharger le certificat
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View
                      style={[
                        styles.noCinCompact,
                        {
                          backgroundColor:
                            isDark
                              ? 'rgba(220,38,38,0.08)'
                              : '#FEF2F2',
                        },
                      ]}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={20}
                        color="#DC2626"
                      />

                      <Text
                        style={
                          styles.noCinCompactText
                        }
                      >
                        Aucun certificat professionnel n'a été téléchargé.
                      </Text>
                    </View>
                  )}
                </View>

                {/* ACTIONS */}

                <View
                  style={[
                    styles.actions,
                    {
                      marginTop:
                        isVerySmallMobile
                          ? 8
                          : 12,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.rejectButton,
                    ]}
                    onPress={() =>
                      requestReject(
                        selected
                      )
                    }
                    disabled={
                      processing
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.actionText
                      }
                    >
                      Rejeter
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.approveButton,
                    ]}
                    onPress={() =>
                      requestApprove(
                        selected
                      )
                    }
                    disabled={
                      processing
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.actionText
                      }
                    >
                      Approuver
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      );
    };

  /* ==========================================================
     ✅ VISIONNEUSE PLEIN ÉCRAN — certificat professionnel
     Affiche l'image en grand (remplit la modale) et permet
     de la télécharger directement.
  ========================================================== */

  const ImageViewerModal = () => (
    <Modal
      visible={showImageViewer}
      transparent
      animationType="fade"
      onRequestClose={closeImageViewer}
    >
      <View style={styles.viewerOverlay}>
        <View
          style={[
            styles.viewerContainer,
            {
              backgroundColor: themeColors.surface,
            },
          ]}
        >
          <View style={styles.viewerHeader}>
            <Text
              style={[
                styles.viewerTitle,
                { color: themeColors.text },
              ]}
              numberOfLines={1}
            >
              {viewerImage.title ||
                'Document'}
            </Text>

            <TouchableOpacity
              onPress={closeImageViewer}
              style={styles.viewerCloseButton}
              activeOpacity={0.8}
            >
              <Ionicons
                name="close"
                size={20}
                color={themeColors.text}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.viewerImageWrapper}>
            {viewerImage.uri &&
            viewerImage.uri.toLowerCase().endsWith('.pdf') ? (
              <View style={styles.viewerPdfBox}>
                <Ionicons
                  name="document-text-outline"
                  size={64}
                  color={colors.primary}
                />

                <Text
                  style={[
                    styles.viewerPdfText,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  Ce document est un PDF. Utilisez le bouton
                  ci-dessous pour le télécharger et l'ouvrir.
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri: viewerImage.uri }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            )}
          </View>

          <TouchableOpacity
            onPress={() =>
              handleDownload(
                viewerImage.uri,
                viewerImage.fileName
              )
            }
            style={styles.viewerDownloadButton}
            activeOpacity={0.85}
          >
            <Ionicons
              name="download-outline"
              size={18}
              color="#FFFFFF"
            />

            <Text style={styles.viewerDownloadButtonText}>
              Télécharger
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ==========================================================
     STABLE CONFIRMATION MODAL INSTANCE
  ========================================================== */

  const confirmationModal = (
    <ConfirmationModal
      confirmation={confirmation}
      processing={processing}
      rejectReason={rejectReason}
      setRejectReason={
        setRejectReason
      }
      themeColors={themeColors}
      isDark={isDark}
      confirmAction={
        confirmAction
      }
      onCancel={
        cancelConfirmation
      }
    />
  );

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
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
          title="Demandes en attente"
          showBack
        />

        <View
          style={
            styles.loadingContainer
          }
        >
          <View
            style={[
              styles.loadingIcon,
              {
                backgroundColor:
                  `${colors.primary}12`,
              },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={
                colors.primary
              }
            />
          </View>

          <Text
            style={[
              styles.loadingTitle,
              {
                color:
                  themeColors.text,
              },
            ]}
          >
            Chargement des demandes
          </Text>

          <Text
            style={[
              styles.loadingSubtitle,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            Récupération des candidatures...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ==========================================================
     MAIN
  ========================================================== */

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
        title="Demandes en attente"
        showBack
      />

      <Toast />

      <View
        style={styles.page}
      >
        {/* TOP */}

        <View
          style={[
            styles.pageTop,
            isMobile &&
              styles.pageTopMobile,
          ]}
        >
          <View
            style={
              styles.pageTitleContainer
            }
          >
            <Text
              style={[
                styles.pageTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Validation des thérapeutes
            </Text>

            <Text
              style={[
                styles.pageSubtitle,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Vérifiez et validez les demandes de création de comptes professionnels.
            </Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={[
              styles.refreshButton,
              {
                backgroundColor:
                  themeColors.surface,
                borderColor:
                  themeColors.border ||
                  'rgba(15,23,42,0.08)',
              },
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={
                colors.primary
              }
            />

            {!isMobile && (
              <Text
                style={[
                  styles.refreshText,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Actualiser
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SEARCH */}

        <SearchAndFilters />

        {/* ✅ FILTRE PAR DATE + EXPORT EXCEL */}

        <DateFilterBar />

        {/* COUNTER */}

        <View
          style={
            styles.counterRow
          }
        >
          <View
            style={
              styles.counterLeft
            }
          >
            <View
              style={[
                styles.counterIcon,
                {
                  backgroundColor:
                    `${colors.primary}12`,
                },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={17}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={[
                styles.counterText,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {filteredTherapists.length}{' '}
              demande
              {filteredTherapists.length >
              1
                ? 's'
                : ''}
            </Text>
          </View>

          {IS_WEB && (
            <Text
              style={[
                styles.counterHint,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              ✓ Approuver · ✕ Rejeter · 👁 Consulter
            </Text>
          )}
        </View>

        {/* CONTENT */}

        <View
          style={styles.content}
        >
          {IS_WEB ? (
            <WebTable />
          ) : (
            <FlatList
              data={
                paginatedTherapists
              }
              renderItem={
                renderMobileCard
              }
              keyExtractor={(item) =>
                String(item.id)
              }
              contentContainerStyle={[
                styles.mobileList,
                paginatedTherapists.length ===
                  0 &&
                  styles.mobileListEmpty,
              ]}
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={
                    refreshing
                  }
                  onRefresh={
                    onRefresh
                  }
                  colors={[
                    colors.primary,
                  ]}
                  tintColor={
                    colors.primary
                  }
                />
              }
              ListEmptyComponent={
                <View
                  style={
                    styles.emptyState
                  }
                >
                  <View
                    style={[
                      styles.emptyIcon,
                      {
                        backgroundColor:
                          `${colors.primary}12`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-done-outline"
                      size={40}
                      color={
                        colors.primary
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.emptyText,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Aucune demande en attente
                  </Text>

                  <Text
                    style={[
                      styles.emptySubtext,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Les nouvelles demandes de thérapeutes apparaîtront ici.
                  </Text>
                </View>
              }
            />
          )}
        </View>

        <Pagination />
      </View>

      <DetailsModal />

      <ImageViewerModal />

      {confirmationModal}
    </SafeAreaView>
  );
};

/* ============================================================
   COMPACT INFO
============================================================ */

const CompactInfo = ({
  icon,
  label,
  value,
  valueColor,
  themeColors,
}) => (
  <View
    style={[
      styles.compactInfo,
      {
        backgroundColor:
          themeColors.background ||
          '#F8FAFC',
        borderColor:
          themeColors.border ||
          'rgba(15,23,42,0.06)',
      },
    ]}
  >
    <View
      style={
        styles.compactInfoIcon
      }
    >
      <Ionicons
        name={icon}
        size={14}
        color={colors.primary}
      />
    </View>

    <View
      style={
        styles.compactInfoContent
      }
    >
      <Text
        style={[
          styles.compactInfoLabel,
          {
            color:
              themeColors.textSecondary,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.compactInfoValue,
          {
            color:
              valueColor ||
              themeColors.text,
          },
        ]}
        numberOfLines={2}
      >
        {value ||
          'Non renseigné'}
      </Text>
    </View>
  </View>
);

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  page: {
    flex: 1,
    width: '100%',
    paddingHorizontal:
      IS_WEB
        ? 24
        : spacing.md,
    paddingTop:
      IS_WEB
        ? 18
        : spacing.sm,
  },

  /* ==========================================================
     TOP
  ========================================================== */

  pageTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginBottom: 18,
  },

  pageTopMobile: {
    alignItems:
      'flex-start',
  },

  pageTitleContainer: {
    flex: 1,
    paddingRight: 14,
  },

  pageTitle: {
    fontSize:
      IS_WEB ? 25 : 21,
    fontFamily:
      typography.fontFamily.bold,
    letterSpacing: -0.35,
  },

  pageSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily:
      typography.fontFamily.regular,
  },

  refreshButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'center',
    gap: 7,
  },

  refreshText: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     TOOLBAR
  ========================================================== */

  toolbar: {
    width: '100%',
    flexDirection:
      IS_WEB
        ? 'row'
        : 'column',
    alignItems:
      IS_WEB
        ? 'center'
        : 'stretch',
    gap: 10,
    marginBottom: 12,
  },

  searchBox: {
    flex:
      IS_WEB
        ? 1
        : undefined,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchInput: {
    flex: 1,
    marginLeft: 9,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily:
      typography.fontFamily.regular,
    outlineStyle: 'none',
  },

  filters: {
    gap: 7,
    alignItems: 'center',
  },

  filterButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  filterButtonText: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     ✅ FILTRE PAR DATE / EXPORT EXCEL
  ========================================================== */

  dateFilterBar: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  dateFilterField: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  dateFilterInput: {
    minWidth: 108,
    paddingVertical: 6,
    fontSize: 11,
    fontFamily:
      typography.fontFamily.regular,
    outlineStyle: 'none',
  },

  dateFieldTouchable: {
    flex: 1,
    minWidth: 108,
    paddingVertical: 6,
  },

  iosDatePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor:
      'rgba(8,10,20,0.45)',
  },

  iosDatePickerSheet: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },

  iosDatePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },

  iosDatePickerCancel: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },

  iosDatePickerCancelText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily:
      typography.fontFamily.semiBold,
  },

  iosDatePickerConfirm: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  iosDatePickerConfirmText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily:
      typography.fontFamily.bold,
  },

  dateFilterSeparator: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  dateFilterClear: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  dateFilterClearText: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  exportExcelButton: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,

    shadowColor: '#16A34A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 3,
  },

  exportExcelButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily:
      typography.fontFamily.bold,
  },

  /* ==========================================================
     COUNTER
  ========================================================== */

  counterRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginBottom: 10,
  },

  counterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  counterIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  counterText: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.bold,
  },

  counterHint: {
    fontSize: 10,
    fontFamily:
      typography.fontFamily.regular,
  },

  /* ==========================================================
     CONTENT
  ========================================================== */

  content: {
    flex: 1,
    minHeight: 0,
  },

  /* ==========================================================
     MOBILE
  ========================================================== */

  mobileList: {
    paddingBottom: 24,
  },

  mobileListEmpty: {
    flexGrow: 1,
  },

  mobileCard: {
    width: '100%',
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.035,
    shadowRadius: 7,
    elevation: 1,
  },

  mobileCardContent: {
    flex: 1,
    marginLeft: 11,
    minWidth: 0,
  },

  mobileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  mobileCardIdentity: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },

  mobileName: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.bold,
  },

  mobileEmail: {
    marginTop: 2,
    fontSize: 11,
    fontFamily:
      typography.fontFamily.regular,
  },

  mobileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },

  mobileMeta: {
    fontSize: 10,
    fontFamily:
      typography.fontFamily.regular,
  },

  mobileBottomRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  documentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
  },

  documentBadgeText: {
    fontSize: 9,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  idBadge: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  idBadgeText: {
    fontSize: 10,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  avatarFrame: {
    alignItems: 'center',
    justifyContent:
      'center',
    flexShrink: 0,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },

  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent:
      'center',
    flexShrink: 0,
  },

  avatarText: {
    fontFamily:
      typography.fontFamily.bold,
  },

  /* ==========================================================
     TABLE
  ========================================================== */

  tableWrapper: {
    flex: 1,
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },

  table: {
    width: '100%',
  },

  tableHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },

  tableHeaderCell: {
    height: '100%',
    justifyContent:
      'center',
    paddingHorizontal: 13,
  },

  tableHeaderText: {
    fontSize: 10,
    fontFamily:
      typography.fontFamily.bold,
    letterSpacing: 0.35,
  },

  tableVerticalScroll: {
    flex: 1,
  },

  tableRow: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },

  tableCell: {
    minHeight: 67,
    justifyContent:
      'center',
    paddingHorizontal: 13,
  },

  cellIndex: {
    width: 44,
    alignItems: 'center',
  },

  cellId: {
    width: 84,
    alignItems: 'center',
  },

  cellTherapist: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cellPhone: {
    width: 150,
  },

  cellCIN: {
    width: 155,
  },

  cellDate: {
    width: 120,
  },

  cellDocument: {
    width: 130,
    alignItems: 'center',
  },

  cellStatus: {
    width: 150,
    alignItems: 'center',
  },

  cellAction: {
    width: 135,
    alignItems: 'center',
  },

  tableIdentity: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  tableName: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.bold,
  },

  tableEmail: {
    marginTop: 3,
    fontSize: 10,
    fontFamily:
      typography.fontFamily.regular,
  },

  tableText: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.regular,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 9,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     WEB ACTIONS
  ========================================================== */

  webActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'center',
    gap: 6,
  },

  webActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  tableEmpty: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent:
      'center',
    paddingHorizontal: 30,
  },

  /* ==========================================================
     PAGINATION
  ========================================================== */

  pagination: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    borderTopWidth: 1,
    marginTop: 8,
  },

  paginationInfo: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.medium,
  },

  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  pageButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  pageCurrent: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  pageCurrentText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily:
      typography.fontFamily.bold,
  },

  pageTotal: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.medium,
  },

  /* ==========================================================
     DETAILS MODAL
  ========================================================== */

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(2,6,23,0.70)',
    alignItems: 'center',
    justifyContent:
      'center',
    paddingVertical: 12,
  },

  detailsModal: {
    maxHeight: '94%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 15,
  },

  detailsScroll: {
    width: '100%',
  },

  modalHeader: {
    minHeight: 62,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    borderBottomWidth: 1,
  },

  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  modalHeaderIcon: {
    width: 39,
    height: 39,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent:
      'center',
    marginRight: 10,
  },

  modalTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.bold,
  },

  modalSubtitle: {
    marginTop: 2,
    fontSize: 9,
    fontFamily:
      typography.fontFamily.regular,
  },

  closeButton: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  detailsContent: {
    width: '100%',
  },

  /* ==========================================================
     PROFILE
  ========================================================== */

  profileCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  profileCompactInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
  },

  modalName: {
    fontFamily:
      typography.fontFamily.bold,
  },

  modalEmail: {
    marginTop: 3,
    fontSize: 10,
    fontFamily:
      typography.fontFamily.regular,
  },

  pendingBadge: {
    alignSelf:
      'flex-start',
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  pendingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  pendingText: {
    color: '#D97706',
    fontSize: 8,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     DETAILS GRID
  ========================================================== */

  detailsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  compactInfo: {
    width: IS_WEB
      ? 'calc(50% - 4px)'
      : '48.8%',
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  compactInfoIcon: {
    width: 27,
    height: 27,
    borderRadius: 8,
    backgroundColor:
      `${colors.primary}10`,
    alignItems: 'center',
    justifyContent:
      'center',
    marginRight: 7,
  },

  compactInfoContent: {
    flex: 1,
    minWidth: 0,
  },

  compactInfoLabel: {
    fontSize: 8,
    fontFamily:
      typography.fontFamily.medium,
  },

  compactInfoValue: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     BIO
  ========================================================== */

  compactBioSection: {
    marginTop: 9,
  },

  sectionTitle: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.bold,
    marginBottom: 6,
  },

  compactBioBox: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },

  bioTextCompact: {
    fontSize: 9,
    lineHeight: 13,
    fontFamily:
      typography.fontFamily.regular,
  },

  /* ==========================================================
     DOCUMENT
  ========================================================== */

  documentCompact: {
    marginTop: 9,
  },

  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginBottom: 6,
  },

  documentStatus: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  documentStatusText: {
    fontSize: 8,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  cinPreview: {
    width: '100%',
    height: IS_WEB
      ? 220
      : 170,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent:
      'center',
    marginBottom: 10,
  },

  cinPreviewImage: {
    width: '100%',
    height: '100%',
  },

  noCinCompact: {
    minHeight: 52,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  noCinCompactText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 9,
    lineHeight: 13,
    fontFamily:
      typography.fontFamily.medium,
  },

  /* ==========================================================
     ACTIONS
  ========================================================== */

  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },

  actionButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'center',
    gap: 6,
  },

  approveButton: {
    backgroundColor:
      '#16A34A',
  },

  rejectButton: {
    backgroundColor:
      '#DC2626',
  },

  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily:
      typography.fontFamily.bold,
  },

  /* ==========================================================
     CONFIRMATION MODAL
  ========================================================== */

  confirmKeyboardWrapper: {
    flex: 1,
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(2,6,23,0.68)',
    alignItems: 'center',
    justifyContent:
      'center',
    padding: 16,
  },

  confirmContainer: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    borderRadius: 21,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 15,
  },

  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  confirmTitle: {
    marginTop: 13,
    fontSize: 17,
    fontFamily:
      typography.fontFamily.bold,
    textAlign: 'center',
  },

  confirmUser: {
    marginTop: 4,
    fontSize: 12,
    fontFamily:
      typography.fontFamily.bold,
    textAlign: 'center',
  },

  confirmMessage: {
    marginTop: 7,
    fontSize: 10,
    lineHeight: 15,
    fontFamily:
      typography.fontFamily.regular,
    textAlign: 'center',
    maxWidth: 390,
  },

  /* ==========================================================
     REJECTION FORM
  ========================================================== */

  rejectInputWrapper: {
    width: '100%',
    marginTop: 13,
  },

  rejectInputHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  rejectInputLabel: {
    color: '#DC2626',
    fontSize: 10,
    fontFamily:
      typography.fontFamily.bold,
  },

  rejectInputCounter: {
    color: '#64748B',
    fontSize: 8,
    fontFamily:
      typography.fontFamily.regular,
  },

  rejectInput: {
    width: '100%',
    minHeight: 105,
    maxHeight: 170,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 11,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.regular,

    /*
      Important pour Web:
      empêcher les styles navigateur par défaut
      de provoquer des comportements étranges.
    */
    ...(IS_WEB
      ? {
          outlineStyle:
            'none',
          resize: 'none',
        }
      : {}),
  },

  requiredText: {
    marginTop: 4,
    color: '#DC2626',
    fontSize: 8,
    fontFamily:
      typography.fontFamily.medium,
  },

  /* ==========================================================
     CONFIRM BUTTONS
  ========================================================== */

  confirmActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 15,
  },

  confirmCancel: {
    flex: 1,
    minHeight: 43,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  confirmCancelText: {
    fontSize: 10,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  confirmSubmit: {
    flex: 1,
    minHeight: 43,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent:
      'center',
    flexDirection: 'row',
    gap: 5,
  },

  confirmSubmitText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily:
      typography.fontFamily.bold,
  },

  /* ==========================================================
     EMPTY
  ========================================================== */

  emptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent:
      'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  emptyText: {
    marginTop: 16,
    fontSize: 15,
    fontFamily:
      typography.fontFamily.bold,
    textAlign: 'center',
  },

  emptySubtext: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.regular,
    textAlign: 'center',
  },

  /* ==========================================================
     LOADING
  ========================================================== */

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent:
      'center',
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  loadingTitle: {
    marginTop: 17,
    fontSize: 16,
    fontFamily:
      typography.fontFamily.bold,
    textAlign: 'center',
  },

  loadingSubtitle: {
    marginTop: 5,
    fontSize: 12,
    fontFamily:
      typography.fontFamily.regular,
    textAlign: 'center',
  },

  /* ==========================================================
     TOAST
  ========================================================== */

  toastWrapper: {
    position: 'absolute',
    top:
      IS_WEB ? 18 : 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
  },

  toast: {
    minWidth:
      IS_WEB
        ? 330
        : '80%',
    maxWidth:
      IS_WEB
        ? 540
        : '92%',
    minHeight: 49,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 13,
    elevation: 10,
  },

  toastText: {
    flex: 1,
    marginLeft: 9,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     ✅ CERTIFICAT PROFESSIONNEL
  ========================================================== */

  certPreview: {
    width: '100%',
    height: IS_WEB ? 220 : 170,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  certPreviewImage: {
    width: '100%',
    height: '100%',
  },

  certPdfBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },

  certPdfText: {
    fontSize: 11,
    textAlign: 'center',
    fontFamily: typography.fontFamily.medium,
  },

  certZoomBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  certDownloadButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 13,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 4,

    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 4,
  },

  certDownloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 0.2,
    fontFamily: typography.fontFamily.bold,
  },

  /* ==========================================================
     ✅ VISIONNEUSE PLEIN ÉCRAN
  ========================================================== */

  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,10,20,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: IS_WEB ? 24 : 10,
  },

  viewerContainer: {
    width: IS_WEB ? 'min(720px, 94vw)' : '100%',
    height: IS_WEB ? 'min(88vh, 800px)' : '92%',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
  },

  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  viewerTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
    marginRight: 8,
  },

  viewerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.18)',
  },

  viewerImageWrapper: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },

  viewerImage: {
    width: '100%',
    height: '100%',
  },

  viewerPdfBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },

  viewerPdfText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: typography.fontFamily.medium,
  },

  viewerDownloadButton: {
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,

    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 4,
  },

  viewerDownloadButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.2,
    fontFamily: typography.fontFamily.bold,
  },
});

export default ApprovalsScreen;