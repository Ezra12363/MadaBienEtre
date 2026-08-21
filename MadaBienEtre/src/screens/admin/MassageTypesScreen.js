// src/screens/admin/MassageTypesScreen.js

import React, {
  useState,
  useCallback,
  useMemo,
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
  TextInput,
  ScrollView,
  SafeAreaView,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Image,
  Alert,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';
import useResponsive from '../../hooks/useResponsive';

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_FORM = {
  name: '',
  description: '',
  duration_min: '60',
  duration_max: '120',
  min_price: '30000',
  recommended_price: '',
  category: 'relaxant',
  icon_url: '',
  image_url: '',
  is_active: true,
  display_order: '0',
};

const CATEGORIES = [
  {
    value: 'relaxant',
    label: 'Relaxant',
  },
  {
    value: 'therapeutique',
    label: 'Thérapeutique',
  },
  {
    value: 'sportif',
    label: 'Sportif',
  },
  {
    value: 'reflexologie',
    label: 'Réflexologie',
  },
  {
    value: 'prenatal',
    label: 'Prénatal',
  },
  {
    value: 'personnalise',
    label: 'Personnalisé',
  },
];

const ITEMS_PER_PAGE = 8;

// Hauteur approximative du menu inférieur
// pour éviter que la dernière ligne soit cachée.
const MOBILE_BOTTOM_SAFE_SPACE = 125;
const WEB_BOTTOM_SAFE_SPACE = 55;

// ============================================================
// HELPERS
// ============================================================

const getErrorMessage = (
  error,
  fallback = 'Une erreur est survenue'
) => {
  if (!error) return fallback;

  const data = error?.response?.data;

  if (typeof data === 'string') {
    return data;
  }

  if (data?.detail) {
    if (typeof data.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map(
          (item) =>
            item?.msg ||
            item?.message ||
            JSON.stringify(item)
        )
        .join('\n');
    }

    if (typeof data.detail === 'object') {
      return JSON.stringify(data.detail);
    }
  }

  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (error?.message) return error.message;

  return fallback;
};

const normalizeUrl = (value) => {
  if (!value) return '';
  return String(value).trim();
};

const isValidHttpUrl = (value) => {
  if (!value) return true;

  try {
    const url = new URL(value);

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    );
  } catch {
    return false;
  }
};

const formatPrice = (price) => {
  const number = Number(price);

  if (!Number.isFinite(number)) {
    return '0 Ar';
  }

  return `${number.toLocaleString('fr-FR')} Ar`;
};

const getCategoryLabel = (value) => {
  const category = CATEGORIES.find(
    (item) => item.value === value
  );

  return category?.label || value || 'Général';
};

// ============================================================
// COMPONENT
// ============================================================

const MassageTypesScreen = ({ navigation }) => {
  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  // Layout responsive baseé sur la largeur RÉELLE de l'écran/fenêtre
  // (et non sur Platform.OS) : le tableau large ne s'affiche que
  // s'il y a vraiment la place, sinon on bascule sur les cartes
  // mobiles à tout moment, y compris sur le web en fenêtre étroite.
  const { isDesktop } = useResponsive();

  // ==========================================================
  // STATES
  // ==========================================================

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] =
    useState(1);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [formData, setFormData] =
    useState(DEFAULT_FORM);

  // ✅ NOUVEAU : fichier local choisi par l'utilisateur (pas encore uploadé).
  // formData.icon_url / image_url ne contient que le chemin déjà en base
  // (pour l'aperçu en mode édition) ; le fichier à envoyer est ici.
  const [iconFile, setIconFile] =
    useState(null);

  const [imageFile, setImageFile] =
    useState(null);

  // Permet de supprimer une image existante sans la remplacer
  const [removeIcon, setRemoveIcon] =
    useState(false);

  const [removeImage, setRemoveImage] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [
    deleteModalVisible,
    setDeleteModalVisible,
  ] = useState(false);

  const [selectedItem, setSelectedItem] =
    useState(null);

  const [
    deleteProcessing,
    setDeleteProcessing,
  ] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback(
    (
      message,
      type = 'success',
      title = null,
      duration = 3000
    ) => {
      setToast({
        visible: true,
        type,
        title:
          title ||
          (type === 'success'
            ? 'Succès'
            : type === 'error'
            ? 'Erreur'
            : type === 'warning'
            ? 'Attention'
            : 'Information'),
        message,
      });

      setTimeout(() => {
        setToast((previous) => ({
          ...previous,
          visible: false,
        }));
      }, duration);
    },
    []
  );

  // ==========================================================
  // FORM RESET
  // ==========================================================

  const resetForm = () => {
    setFormData({
      ...DEFAULT_FORM,
    });

    setEditingId(null);
    setIconFile(null);
    setImageFile(null);
    setRemoveIcon(false);
    setRemoveImage(false);
  };

  // ==========================================================
  // SÉLECTION D'IMAGE (icon / image) — remplace les champs URL
  // ==========================================================

  /**
   * ✅ CORRIGÉ (bug : upload fonctionne sur Android/iOS mais échoue
   * en 422 sur le Web) :
   *
   * Sur React Native (Android/iOS), `expo-image-picker` renvoie une
   * URI locale de type "file://..." et le réseau natif de React
   * Native sait convertir un objet `{ uri, name, type }` en partie
   * multipart valide — c'est un comportement SPÉCIFIQUE à RN.
   *
   * Sur le Web, `expo-image-picker` renvoie une URI "blob:" ou
   * "data:" et on utilise le VRAI `FormData` du navigateur, qui
   * n'accepte que des chaînes ou des `Blob`/`File` comme valeur.
   * Lui passer un simple objet `{ uri, name, type }` le transforme
   * silencieusement en texte "[object Object]" → le backend reçoit
   * "icon"/"image" comme un champ TEXTE et non comme un fichier,
   * d'où l'erreur 422 (UploadFile attendu, str reçu) — uniquement
   * sur Web.
   *
   * Le correctif : sur Web, on `fetch()` l'URI locale pour obtenir
   * un vrai `Blob`, qu'on stocke en plus de `{ uri, name, type }`.
   * `buildFormData` (plus bas) utilise ensuite `fd.append(field,
   * blob, name)` sur Web, et `fd.append(field, { uri, name, type })`
   * sur natif — chaque plateforme avec le format qu'elle sait gérer.
   */
  const pickImage = async (field) => {
    if (submitting) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (Platform.OS !== 'web' && !permission.granted) {
        Alert.alert(
          'Permission requise',
          "L'accès à la galerie est nécessaire pour choisir une image."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType?.Images || ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
        selectionLimit: 1,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      let blob = null;

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        blob = await response.blob();
      }

      const mimeType =
        blob?.type ||
        asset.mimeType ||
        'image/jpeg';

      const mimeToExtension = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };

      const extensionFromName =
        /\.(jpe?g|png|webp)$/i.exec(
          asset.fileName || ''
        )?.[1]?.toLowerCase();

      const extension =
        extensionFromName ||
        mimeToExtension[mimeType] ||
        'jpg';

      const filename =
        (
          asset.fileName &&
          /\.(jpe?g|png|webp)$/i.test(asset.fileName)
        )
          ? asset.fileName
          : `${field}_${Date.now()}.${extension}`;

      let fileObject;

      if (Platform.OS === 'web') {
        const normalizedBlob =
          blob && blob.type === mimeType
            ? blob
            : new Blob(
                [blob],
                { type: mimeType }
              );

        let browserFile = normalizedBlob;

        try {
          if (typeof File !== 'undefined') {
            browserFile = new File(
              [normalizedBlob],
              filename,
              { type: mimeType }
            );
          }
        } catch (fileError) {
          console.warn(
            '⚠️ Impossible de construire File Web, utilisation du Blob:',
            fileError
          );
        }

        fileObject = {
          uri: asset.uri,
          name: filename,
          type: mimeType,
          blob: normalizedBlob,
          file: browserFile,
        };
      } else {
        fileObject = {
          uri: asset.uri,
          name: filename,
          type: mimeType,
        };
      }

      if (field === 'icon') {
        setIconFile(fileObject);
        setRemoveIcon(false);
      } else {
        setImageFile(fileObject);
        setRemoveImage(false);
      }
    } catch (err) {
      console.error('pickImage error:', err);
      showToast(
        "Impossible d'ouvrir ou de lire l'image sélectionnée.",
        'error',
        'Erreur'
      );
    }
  };


  const clearPickedImage = (field) => {
    if (submitting) return;

    if (field === 'icon') {
      setIconFile(null);
      setRemoveIcon(true);
      updateField('icon_url', '');
    } else {
      setImageFile(null);
      setRemoveImage(true);
      updateField('image_url', '');
    }
  };

  // ==========================================================
  // LOAD
  // ==========================================================

  const loadTypes = useCallback(
    async () => {
      setError(null);

      try {
        const data =
          await adminService.getMassageTypes();

        let result = [];

        if (Array.isArray(data)) {
          result = data;
        } else if (
          Array.isArray(data?.data)
        ) {
          result = data.data;
        } else if (
          Array.isArray(data?.items)
        ) {
          result = data.items;
        }

        setTypes(result);
        setCurrentPage(1);
      } catch (err) {
        console.error(
          'Load massage types error:',
          err
        );

        setTypes([]);

        const message =
          getErrorMessage(
            err,
            'Impossible de charger les types de massage'
          );

        setError(message);

        showToast(
          message,
          'error',
          'Chargement impossible'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  // ==========================================================
  // FOCUS
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadTypes();
    }, [loadTypes])
  );

  // ==========================================================
  // REFRESH
  // ==========================================================

  const onRefresh = async () => {
    setRefreshing(true);

    await loadTypes();

    showToast(
      'La liste des types de massage a été actualisée.',
      'success',
      'Actualisation'
    );
  };

  // ==========================================================
  // SEARCH
  // ==========================================================

  const filteredTypes = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    if (!query) {
      return types;
    }

    return types.filter((item) => {
      const name = String(
        item?.name || ''
      ).toLowerCase();

      const description = String(
        item?.description || ''
      ).toLowerCase();

      const category = String(
        item?.category || ''
      ).toLowerCase();

      return (
        name.includes(query) ||
        description.includes(query) ||
        category.includes(query)
      );
    });
  }, [types, searchQuery]);

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredTypes.length /
        ITEMS_PER_PAGE
    )
  );

  const paginatedTypes = useMemo(() => {
    const start =
      (currentPage - 1) *
      ITEMS_PER_PAGE;

    return filteredTypes.slice(
      start,
      start + ITEMS_PER_PAGE
    );
  }, [
    filteredTypes,
    currentPage,
  ]);

  const goToPage = (page) => {
    const safePage = Math.max(
      1,
      Math.min(page, totalPages)
    );

    setCurrentPage(safePage);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    setCurrentPage(1);
  };

  // ==========================================================
  // FORM
  // ==========================================================

  const updateField = (
    field,
    value
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setIconFile(null);
    setImageFile(null);
    setRemoveIcon(false);
    setRemoveImage(false);

    setFormData({
      name: item.name ?? '',
      description:
        item.description ?? '',

      duration_min:
        item.duration_min !==
          null &&
        item.duration_min !==
          undefined
          ? String(
              item.duration_min
            )
          : '60',

      duration_max:
        item.duration_max !==
          null &&
        item.duration_max !==
          undefined
          ? String(
              item.duration_max
            )
          : '120',

      min_price:
        item.min_price !==
          null &&
        item.min_price !==
          undefined
          ? String(item.min_price)
          : '30000',

      recommended_price:
        item.recommended_price !==
          null &&
        item.recommended_price !==
          undefined
          ? String(
              item.recommended_price
            )
          : '',

      category:
        item.category ||
        'relaxant',

      icon_url:
        item.icon_url || '',

      image_url:
        item.image_url || '',

      is_active:
        item.is_active !==
        undefined
          ? Boolean(
              item.is_active
            )
          : true,

      display_order:
        item.display_order !==
          null &&
        item.display_order !==
          undefined
          ? String(
              item.display_order
            )
          : '0',
    });

    setModalVisible(true);
  };

  const closeModal = () => {
    if (submitting) return;

    setModalVisible(false);
    resetForm();
  };

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const validateForm = () => {
    const name =
      formData.name.trim();

    if (!name) {
      return 'Le nom du type de massage est obligatoire.';
    }

    const durationMin =
      Number(
        formData.duration_min
      );

    const durationMax =
      Number(
        formData.duration_max
      );

    const minPrice =
      Number(formData.min_price);

    const recommendedPrice =
      formData.recommended_price.trim() !==
      ''
        ? Number(
            formData.recommended_price
          )
        : null;

    const displayOrder =
      Number(
        formData.display_order
      );

    if (
      !Number.isFinite(
        durationMin
      ) ||
      durationMin < 15
    ) {
      return 'La durée minimale doit être au moins de 15 minutes.';
    }

    if (
      !Number.isFinite(
        durationMax
      ) ||
      durationMax < 15
    ) {
      return 'La durée maximale doit être au moins de 15 minutes.';
    }

    if (
      durationMin >
      durationMax
    ) {
      return 'La durée minimale doit être inférieure ou égale à la durée maximale.';
    }

    if (
      !Number.isFinite(
        minPrice
      ) ||
      minPrice < 0
    ) {
      return 'Le prix minimum est invalide.';
    }

    if (
      recommendedPrice !==
        null &&
      (!Number.isFinite(
        recommendedPrice
      ) ||
        recommendedPrice < 0)
    ) {
      return 'Le prix recommandé est invalide.';
    }

    if (
      recommendedPrice !==
        null &&
      recommendedPrice <
        minPrice
    ) {
      return 'Le prix recommandé doit être supérieur ou égal au prix minimum.';
    }

    if (
      !Number.isFinite(
        displayOrder
      ) ||
      displayOrder < 0
    ) {
      return "L'ordre d'affichage est invalide.";
    }

    if (
      !CATEGORIES.some(
        (category) =>
          category.value ===
          formData.category
      )
    ) {
      return 'La catégorie sélectionnée est invalide.';
    }

    // ✅ icon_url / image_url ne sont plus saisis en texte : ce sont des
    // fichiers (iconFile / imageFile), optionnels, validés côté backend
    // (format et taille) au moment de l'upload.

    return null;
  };

  // ==========================================================
  // PAYLOAD
  // ==========================================================

  const buildFormData = () => {
    const fd = new FormData();

    const appendText = (key, value) => {
      if (
        value !== undefined &&
        value !== null
      ) {
        fd.append(key, String(value));
      }
    };

    appendText('name', formData.name.trim());
    appendText('description', formData.description.trim());
    appendText('duration_min', Number(formData.duration_min));
    appendText('duration_max', Number(formData.duration_max));
    appendText('min_price', Number(formData.min_price));

    // Ne jamais envoyer recommended_price="" :
    // FastAPI ne peut pas convertir une chaîne vide en float.
    if (formData.recommended_price.trim() !== '') {
      appendText(
        'recommended_price',
        Number(formData.recommended_price)
      );
    }

    appendText('category', formData.category);
    appendText('is_active', Boolean(formData.is_active));
    appendText(
      'display_order',
      Number(formData.display_order)
    );

    const appendImageFile = (
      fieldName,
      fileObject
    ) => {
      if (!fileObject) return;

      if (Platform.OS === 'web') {
        const browserFile =
          fileObject.file ||
          fileObject.blob;

        if (!(browserFile instanceof Blob)) {
          throw new Error(
            `Le fichier ${fieldName} n'est pas un Blob/File Web valide.`
          );
        }

        fd.append(
          fieldName,
          browserFile,
          fileObject.name || `${fieldName}.jpg`
        );
        return;
      }

      fd.append(
        fieldName,
        fileObject
      );
    };

    appendImageFile('icon', iconFile);
    appendImageFile('image', imageFile);

    if (editingId !== null) {
      appendText('remove_icon', Boolean(removeIcon));
      appendText('remove_image', Boolean(removeImage));
    }

    return fd;
  };


  // ==========================================================
  // SAVE
  // ==========================================================

  const handleSave = async () => {
    if (submitting) return;

    const validationError =
      validateForm();

    if (validationError) {
      showToast(
        validationError,
        'warning',
        'Données invalides',
        4000
      );

      return;
    }

    const formPayload =
      buildFormData();

    setSubmitting(true);

    try {
      if (
        editingId !== null
      ) {
        await adminService.updateMassageType(
          editingId,
          formPayload
        );

        setModalVisible(false);
        resetForm();

        showToast(
          'Le type de massage a été mis à jour avec succès.',
          'success',
          'Modification réussie'
        );
      } else {
        await adminService.createMassageType(
          formPayload
        );

        setModalVisible(false);
        resetForm();

        showToast(
          'Le type de massage a été créé avec succès.',
          'success',
          'Création réussie'
        );
      }

      await loadTypes();
    } catch (err) {
      console.error(
        'Save massage type error:',
        err
      );

      showToast(
        getErrorMessage(
          err,
          "Impossible d'enregistrer le type de massage."
        ),
        'error',
        'Enregistrement impossible',
        5000
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = (
    item
  ) => {
    if (!item?.id) return;

    setSelectedItem(item);
    setDeleteModalVisible(true);
  };

  const closeDeleteModal = () => {
    if (deleteProcessing)
      return;

    setDeleteModalVisible(false);
    setSelectedItem(null);
  };

  const executeDelete = async (
    item,
    permanent
  ) => {
    if (
      !item?.id ||
      deleteProcessing
    ) {
      return;
    }

    setDeleteProcessing(true);

    try {
      await adminService.deleteMassageType(
        item.id,
        permanent
      );

      setDeleteModalVisible(false);
      setSelectedItem(null);

      showToast(
        permanent
          ? 'Le type de massage a été supprimé définitivement.'
          : 'Le type de massage a été désactivé.',
        'success',
        permanent
          ? 'Suppression réussie'
          : 'Désactivation réussie'
      );

      await loadTypes();
    } catch (err) {
      console.error(
        'Delete massage type error:',
        err
      );

      showToast(
        getErrorMessage(
          err,
          permanent
            ? 'Impossible de supprimer le type de massage.'
            : 'Impossible de désactiver le type de massage.'
        ),
        'error',
        'Action impossible',
        5000
      );
    } finally {
      setDeleteProcessing(false);
    }
  };

  // ==========================================================
  // TOAST
  // ==========================================================

  const renderToast = () => {
    if (!toast.visible)
      return null;

    const toastConfig = {
      success: {
        icon: 'checkmark-circle',
        iconColor: '#16A34A',
        background:
          isDark
            ? '#102B1B'
            : '#F0FDF4',
        border: '#22C55E',
      },

      error: {
        icon: 'close-circle',
        iconColor: '#DC2626',
        background:
          isDark
            ? '#321414'
            : '#FEF2F2',
        border: '#EF4444',
      },

      warning: {
        icon: 'warning',
        iconColor: '#D97706',
        background:
          isDark
            ? '#30250F'
            : '#FFFBEB',
        border: '#F59E0B',
      },

      info: {
        icon:
          'information-circle',
        iconColor:
          colors.primary,
        background:
          isDark
            ? '#101F3A'
            : '#EFF6FF',
        border:
          colors.primary,
      },
    };

    const config =
      toastConfig[
        toast.type
      ] ||
      toastConfig.success;

    return (
      <View
        pointerEvents="box-none"
        style={styles.toastLayer}
      >
        <View
          style={[
            styles.toastContainer,
            {
              backgroundColor:
                config.background,
              borderColor:
                config.border,
            },
          ]}
        >
          <View
            style={[
              styles.toastIconContainer,
              {
                backgroundColor:
                  `${config.iconColor}18`,
              },
            ]}
          >
            <Ionicons
              name={config.icon}
              size={22}
              color={
                config.iconColor
              }
            />
          </View>

          <View
            style={
              styles.toastContent
            }
          >
            <Text
              style={[
                styles.toastTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
              numberOfLines={1}
            >
              {toast.title}
            </Text>

            <Text
              style={[
                styles.toastMessage,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
              numberOfLines={3}
            >
              {toast.message}
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.toastClose
            }
            onPress={() =>
              setToast(
                (previous) => ({
                  ...previous,
                  visible: false,
                })
              )
            }
          >
            <Ionicons
              name="close"
              size={18}
              color={
                themeColors.textSecondary
              }
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const renderPagination =
    () => {
      if (
        filteredTypes.length ===
          0 ||
        totalPages <= 1
      ) {
        return null;
      }

      const pages = [];

      if (totalPages <= 5) {
        for (
          let i = 1;
          i <= totalPages;
          i++
        ) {
          pages.push(i);
        }
      } else {
        pages.push(1);

        if (currentPage > 3) {
          pages.push('...');
        }

        const start = Math.max(
          2,
          currentPage - 1
        );

        const end = Math.min(
          totalPages - 1,
          currentPage + 1
        );

        for (
          let i = start;
          i <= end;
          i++
        ) {
          pages.push(i);
        }

        if (
          currentPage <
          totalPages - 2
        ) {
          pages.push('...');
        }

        pages.push(totalPages);
      }

      return (
        <View
          style={[
            styles.paginationContainer,
            {
              borderTopColor:
                themeColors.border ||
                '#E5E7EB',
              backgroundColor:
                themeColors.background,
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
            {filteredTypes.length}{' '}
            type
            {filteredTypes.length >
            1
              ? 's'
              : ''}{' '}
            • Page{' '}
            {currentPage} /{' '}
            {totalPages}
          </Text>

          <View
            style={
              styles.pagination
            }
          >
            <TouchableOpacity
              style={[
                styles.pageArrow,
                {
                  borderColor:
                    themeColors.border ||
                    '#E5E7EB',
                  opacity:
                    currentPage ===
                    1
                      ? 0.4
                      : 1,
                },
              ]}
              disabled={
                currentPage ===
                1
              }
              onPress={() =>
                goToPage(
                  currentPage - 1
                )
              }
            >
              <Ionicons
                name="chevron-back"
                size={17}
                color={
                  themeColors.text
                }
              />
            </TouchableOpacity>

            {pages.map(
              (
                page,
                index
              ) => {
                if (
                  page ===
                  '...'
                ) {
                  return (
                    <View
                      key={`ellipsis-${index}`}
                      style={
                        styles.ellipsis
                      }
                    >
                      <Text
                        style={[
                          styles.ellipsisText,
                          {
                            color:
                              themeColors.textSecondary,
                          },
                        ]}
                      >
                        …
                      </Text>
                    </View>
                  );
                }

                const selected =
                  page ===
                  currentPage;

                return (
                  <TouchableOpacity
                    key={page}
                    style={[
                      styles.pageButton,
                      {
                        backgroundColor:
                          selected
                            ? colors.primary
                            : 'transparent',
                        borderColor:
                          selected
                            ? colors.primary
                            : themeColors.border ||
                              '#E5E7EB',
                      },
                    ]}
                    onPress={() =>
                      goToPage(
                        page
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.pageButtonText,
                        {
                          color:
                            selected
                              ? '#FFFFFF'
                              : themeColors.text,
                        },
                      ]}
                    >
                      {page}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}

            <TouchableOpacity
              style={[
                styles.pageArrow,
                {
                  borderColor:
                    themeColors.border ||
                    '#E5E7EB',
                  opacity:
                    currentPage ===
                    totalPages
                      ? 0.4
                      : 1,
                },
              ]}
              disabled={
                currentPage ===
                totalPages
              }
              onPress={() =>
                goToPage(
                  currentPage + 1
                )
              }
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

  // ==========================================================
  // ACTIONS
  // ==========================================================

  const renderActions = (
    item
  ) => {
    return (
      <View
        style={
          styles.actionsContainer
        }
      >
        <TouchableOpacity
          onPress={() =>
            openEditModal(item)
          }
          style={[
            styles.actionButton,
            styles.editButton,
          ]}
          activeOpacity={0.75}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color={
              colors.primary
            }
          />

          {Platform.OS ===
            'web' && (
            <Text
              style={[
                styles.actionButtonText,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              Modifier
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            handleDelete(item)
          }
          style={[
            styles.actionButton,
            styles.deleteButton,
          ]}
          activeOpacity={0.75}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={
              colors.error
            }
          />

          {Platform.OS ===
            'web' && (
            <Text
              style={[
                styles.actionButtonText,
                {
                  color:
                    colors.error,
                },
              ]}
            >
              Supprimer
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ==========================================================
  // MOBILE CARD
  // ==========================================================

  const renderMobileCard =
    ({ item }) => {
      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border ||
                '#E5E7EB',
            },
          ]}
        >
          <View
            style={
              styles.cardHeader
            }
          >
            <View
              style={[
                styles.cardThumbnailBox,
                {
                  backgroundColor: `${colors.primary}12`,
                  borderColor: themeColors.border || '#E5E7EB',
                },
              ]}
            >
              {(item.icon_url || item.image_url) ? (
                <Image
                  source={{
                    uri: adminService.getMassageImageUrl(
                      item.icon_url || item.image_url
                    ),
                  }}
                  style={styles.cardThumbnailImage}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons
                  name="fitness-outline"
                  size={20}
                  color={colors.primary}
                />
              )}
            </View>

            <View
              style={
                styles.cardTitleContainer
              }
            >
              <Text
                style={[
                  styles.cardName,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                numberOfLines={2}
              >
                {item.name}
              </Text>

              <Text
                style={[
                  styles.cardPrice,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                {formatPrice(
                  item.min_price
                )}
              </Text>
            </View>

            <View
              style={
                styles.mobileStatusActions
              }
            >
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      item.is_active
                        ? '#4CAF5020'
                        : '#E74C3C20',
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        item.is_active
                          ? '#4CAF50'
                          : '#E74C3C',
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        item.is_active
                          ? '#4CAF50'
                          : '#E74C3C',
                    },
                  ]}
                >
                  {item.is_active
                    ? 'Actif'
                    : 'Inactif'}
                </Text>
              </View>
            </View>
          </View>

          {item.description ? (
            <Text
              style={[
                styles.cardDescription,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
              numberOfLines={3}
            >
              {
                item.description
              }
            </Text>
          ) : null}

          <View
            style={
              styles.cardInfoGrid
            }
          >
            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor:
                    `${colors.primary}0C`,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={
                  colors.primary
                }
              />

              <View>
                <Text
                  style={[
                    styles.infoLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Durée
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {
                    item.duration_min
                  }{' '}
                  –{' '}
                  {
                    item.duration_max
                  }{' '}
                  min
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor:
                    `${colors.primary}0C`,
                },
              ]}
            >
              <Ionicons
                name="pricetag-outline"
                size={18}
                color={
                  colors.primary
                }
              />

              <View>
                <Text
                  style={[
                    styles.infoLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Catégorie
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {getCategoryLabel(
                    item.category
                  )}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor:
                    `${colors.primary}0C`,
                },
              ]}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={
                  colors.primary
                }
              />

              <View>
                <Text
                  style={[
                    styles.infoLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Ordre
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {
                    item.display_order ??
                    0
                  }
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.mobileActions,
              {
                borderTopColor:
                  themeColors.border ||
                  '#E5E7EB',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.mobileAction,
                {
                  backgroundColor:
                    `${colors.primary}10`,
                },
              ]}
              onPress={() =>
                openEditModal(
                  item
                )
              }
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={
                  colors.primary
                }
              />

              <Text
                style={[
                  styles.mobileActionText,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                Modifier
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mobileAction,
                {
                  backgroundColor:
                    '#EF444410',
                },
              ]}
              onPress={() =>
                handleDelete(item)
              }
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color="#EF4444"
              />

              <Text
                style={[
                  styles.mobileActionText,
                  {
                    color:
                      '#EF4444',
                  },
                ]}
              >
                Supprimer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

  // ==========================================================
  // WEB TABLE HEADER
  // ==========================================================

  const renderWebTableHeader =
    () => {
      return (
        <View
          style={[
            styles.tableHeader,
            {
              backgroundColor:
                isDark
                  ? '#16213A'
                  : '#F7F9FC',
              borderColor:
                themeColors.border ||
                '#E5E7EB',
            },
          ]}
        >
          <View
            style={[
              styles.tableCell,
              styles.colName,
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
              TYPE DE MASSAGE
            </Text>
          </View>

          <View
            style={[
              styles.tableCell,
              styles.colPrice,
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
              PRIX MINIMUM
            </Text>
          </View>

          <View
            style={[
              styles.tableCell,
              styles.colDuration,
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
              DURÉE
            </Text>
          </View>

          <View
            style={[
              styles.tableCell,
              styles.colCategory,
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
              CATÉGORIE
            </Text>
          </View>

          <View
            style={[
              styles.tableCell,
              styles.colOrder,
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
              ORDRE
            </Text>
          </View>

          <View
            style={[
              styles.tableCell,
              styles.colStatus,
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
              STATUT
            </Text>
          </View>

          <View
            style={[
              styles.tableCell,
              styles.colActions,
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
              ACTIONS
            </Text>
          </View>
        </View>
      );
    };

  // ==========================================================
  // WEB TABLE ROW
  // ==========================================================

  const renderWebTableRow =
    ({ item, index }) => {
      return (
        <View
          style={[
            styles.tableRow,
            {
              backgroundColor:
                index % 2 === 0
                  ? themeColors.surface
                  : isDark
                  ? '#111B2D'
                  : '#FBFCFE',

              borderColor:
                themeColors.border ||
                '#E5E7EB',
            },
          ]}
        >
          {/* NAME */}
          <View
            style={[
              styles.tableCell,
              styles.colName,
            ]}
          >
            <View
              style={
                styles.webNameContainer
              }
            >
              <View
                style={[
                  styles.webTypeIcon,
                  {
                    backgroundColor:
                      `${colors.primary}12`,
                    overflow: 'hidden',
                  },
                ]}
              >
                {(item.icon_url || item.image_url) ? (
                  <Image
                    source={{
                      uri: adminService.getMassageImageUrl(
                        item.icon_url || item.image_url
                      ),
                    }}
                    style={styles.webTypeIconImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name="fitness-outline"
                    size={19}
                    color={
                      colors.primary
                    }
                  />
                )}
              </View>

              <View
                style={
                  styles.webNameContent
                }
              >
                <Text
                  style={[
                    styles.webName,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>

                {item.description ? (
                  <Text
                    style={[
                      styles.webDescription,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {
                      item.description
                    }
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.webDescription,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Aucune description
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* PRICE */}
          <View
            style={[
              styles.tableCell,
              styles.colPrice,
            ]}
          >
            <Text
              style={[
                styles.webPrice,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              {formatPrice(
                item.min_price
              )}
            </Text>

            {item.recommended_price !==
              null &&
              item.recommended_price !==
                undefined && (
                <Text
                  style={[
                    styles.webRecommended,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Rec.{' '}
                  {formatPrice(
                    item.recommended_price
                  )}
                </Text>
              )}
          </View>

          {/* DURATION */}
          <View
            style={[
              styles.tableCell,
              styles.colDuration,
            ]}
          >
            <View
              style={
                styles.tableInline
              }
            >
              <Ionicons
                name="time-outline"
                size={17}
                color={
                  colors.primary
                }
              />

              <Text
                style={[
                  styles.tableValue,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                {
                  item.duration_min
                }{' '}
                –{' '}
                {
                  item.duration_max
                }{' '}
                min
              </Text>
            </View>
          </View>

          {/* CATEGORY */}
          <View
            style={[
              styles.tableCell,
              styles.colCategory,
            ]}
          >
            <View
              style={[
                styles.categoryBadge,
                {
                  backgroundColor:
                    `${colors.primary}12`,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryBadgeText,
                  {
                    color:
                      colors.primary,
                  },
                ]}
                numberOfLines={1}
              >
                {getCategoryLabel(
                  item.category
                )}
              </Text>
            </View>
          </View>

          {/* ORDER */}
          <View
            style={[
              styles.tableCell,
              styles.colOrder,
            ]}
          >
            <Text
              style={[
                styles.tableValue,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {
                item.display_order ??
                0
              }
            </Text>
          </View>

          {/* STATUS */}
          <View
            style={[
              styles.tableCell,
              styles.colStatus,
            ]}
          >
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.is_active
                      ? '#4CAF5020'
                      : '#E74C3C20',
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      item.is_active
                        ? '#4CAF50'
                        : '#E74C3C',
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.is_active
                        ? '#4CAF50'
                        : '#E74C3C',
                  },
                ]}
              >
                {item.is_active
                  ? 'Actif'
                  : 'Inactif'}
              </Text>
            </View>
          </View>

          {/* ACTIONS */}
          <View
            style={[
              styles.tableCell,
              styles.colActions,
            ]}
          >
            {renderActions(
              item
            )}
          </View>
        </View>
      );
    };

  // ==========================================================
  // FORM MODAL
  // ==========================================================

  const renderModal = () => {
    const inputStyle = {
      color:
        themeColors.text,

      borderColor:
        themeColors.border ||
        '#D1D5DB',

      backgroundColor:
        isDark
          ? '#101827'
          : '#FFFFFF',
    };

    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closeModal
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalOverlay
          }
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={
                  styles.modalTitleContainer
                }
              >
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {editingId !==
                  null
                    ? 'Modifier le type'
                    : 'Nouveau type de massage'}
                </Text>

                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {editingId !==
                  null
                    ? 'Modifiez les informations puis enregistrez.'
                    : 'Ajoutez un nouveau type de massage.'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={
                  closeModal
                }
                disabled={
                  submitting
                }
                style={
                  styles.closeButton
                }
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={
                    themeColors.text
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={
                styles.modalScroll
              }
              contentContainerStyle={
                styles.modalContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                true
              }
            >
              {/* NOM */}
              <View
                style={styles.field}
              >
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Nom *
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    inputStyle,
                  ]}
                  value={
                    formData.name
                  }
                  onChangeText={(
                    text
                  ) =>
                    updateField(
                      'name',
                      text
                    )
                  }
                  placeholder="Ex : Massage relaxant"
                  placeholderTextColor={
                    themeColors.textSecondary
                  }
                  editable={
                    !submitting
                  }
                  autoCapitalize="sentences"
                  autoCorrect={
                    false
                  }
                />
              </View>

              {/* DESCRIPTION */}
              <View
                style={styles.field}
              >
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Description
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.textarea,
                    inputStyle,
                  ]}
                  value={
                    formData.description
                  }
                  onChangeText={(
                    text
                  ) =>
                    updateField(
                      'description',
                      text
                    )
                  }
                  placeholder="Description du massage..."
                  placeholderTextColor={
                    themeColors.textSecondary
                  }
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={
                    !submitting
                  }
                />
              </View>

              {/* DUREE */}
              <View
                style={
                  styles.formRow
                }
              >
                <View
                  style={[
                    styles.field,
                    styles.halfField,
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Durée min
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      inputStyle,
                    ]}
                    value={String(
                      formData.duration_min
                    )}
                    onChangeText={(
                      text
                    ) =>
                      updateField(
                        'duration_min',
                        text.replace(
                          /[^0-9]/g,
                          ''
                        )
                      )
                    }
                    keyboardType="numeric"
                    editable={
                      !submitting
                    }
                  />
                </View>

                <View
                  style={[
                    styles.field,
                    styles.halfField,
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Durée max
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      inputStyle,
                    ]}
                    value={String(
                      formData.duration_max
                    )}
                    onChangeText={(
                      text
                    ) =>
                      updateField(
                        'duration_max',
                        text.replace(
                          /[^0-9]/g,
                          ''
                        )
                      )
                    }
                    keyboardType="numeric"
                    editable={
                      !submitting
                    }
                  />
                </View>
              </View>

              {/* PRIX */}
              <View
                style={
                  styles.formRow
                }
              >
                <View
                  style={[
                    styles.field,
                    styles.halfField,
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Prix minimum (Ar)
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      inputStyle,
                    ]}
                    value={String(
                      formData.min_price
                    )}
                    onChangeText={(
                      text
                    ) =>
                      updateField(
                        'min_price',
                        text.replace(
                          /[^0-9.]/g,
                          ''
                        )
                      )
                    }
                    keyboardType="numeric"
                    editable={
                      !submitting
                    }
                  />
                </View>

                <View
                  style={[
                    styles.field,
                    styles.halfField,
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Prix recommandé (Ar)
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      inputStyle,
                    ]}
                    value={
                      formData.recommended_price
                    }
                    onChangeText={(
                      text
                    ) =>
                      updateField(
                        'recommended_price',
                        text.replace(
                          /[^0-9.]/g,
                          ''
                        )
                      )
                    }
                    keyboardType="numeric"
                    placeholder="Optionnel"
                    placeholderTextColor={
                      themeColors.textSecondary
                    }
                    editable={
                      !submitting
                    }
                  />
                </View>
              </View>

              {/* CATEGORIE */}
              <View
                style={styles.field}
              >
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Catégorie *
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  contentContainerStyle={
                    styles.categoryContainer
                  }
                >
                  {CATEGORIES.map(
                    (
                      category
                    ) => {
                      const selected =
                        formData.category ===
                        category.value;

                      return (
                        <TouchableOpacity
                          key={
                            category.value
                          }
                          onPress={() =>
                            updateField(
                              'category',
                              category.value
                            )
                          }
                          disabled={
                            submitting
                          }
                          style={[
                            styles.categoryButton,
                            {
                              borderColor:
                                selected
                                  ? colors.primary
                                  : themeColors.border ||
                                    '#D1D5DB',

                              backgroundColor:
                                selected
                                  ? `${colors.primary}15`
                                  : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              {
                                color:
                                  selected
                                    ? colors.primary
                                    : themeColors.text,
                              },
                            ]}
                          >
                            {
                              category.label
                            }
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </ScrollView>
              </View>

              {/* ORDRE */}
              <View
                style={styles.field}
              >
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Ordre d'affichage
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    inputStyle,
                  ]}
                  value={String(
                    formData.display_order
                  )}
                  onChangeText={(
                    text
                  ) =>
                    updateField(
                      'display_order',
                      text.replace(
                        /[^0-9]/g,
                        ''
                      )
                    )
                  }
                  keyboardType="numeric"
                  editable={
                    !submitting
                  }
                />
              </View>

              {/* ICÔNE (fichier) */}
              <View
                style={styles.field}
              >
                <Text
                  style={[
                    styles.label,
                    { color: themeColors.text },
                  ]}
                >
                  Icône
                </Text>

                <View style={styles.imagePickerRow}>
                  <View
                    style={[
                      styles.imagePreviewBox,
                      { borderColor: themeColors.border || '#D1D5DB' },
                    ]}
                  >
                    {iconFile?.uri || formData.icon_url ? (
                      <Image
                        source={{
                          uri:
                            iconFile?.uri ||
                            adminService.getMassageImageUrl(formData.icon_url),
                        }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="image-outline"
                        size={24}
                        color={themeColors.textSecondary}
                      />
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.imagePickerButton,
                      { borderColor: themeColors.border || '#D1D5DB' },
                    ]}
                    onPress={() => pickImage('icon')}
                    disabled={submitting}
                  >
                    <Ionicons
                      name="cloud-upload-outline"
                      size={16}
                      color={themeColors.text}
                    />
                    <Text
                      style={[
                        styles.imagePickerButtonText,
                        { color: themeColors.text },
                      ]}
                    >
                      {iconFile || formData.icon_url
                        ? "Changer l'icône"
                        : 'Choisir une icône'}
                    </Text>
                  </TouchableOpacity>

                  {(iconFile || formData.icon_url) && (
                    <TouchableOpacity
                      style={styles.imageRemoveButton}
                      onPress={() => clearPickedImage('icon')}
                      disabled={submitting}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.error || '#DC2626'}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* IMAGE (fichier) */}
              <View
                style={styles.field}
              >
                <Text
                  style={[
                    styles.label,
                    { color: themeColors.text },
                  ]}
                >
                  Image
                </Text>

                <View style={styles.imagePickerRow}>
                  <View
                    style={[
                      styles.imagePreviewBox,
                      { borderColor: themeColors.border || '#D1D5DB' },
                    ]}
                  >
                    {imageFile?.uri || formData.image_url ? (
                      <Image
                        source={{
                          uri:
                            imageFile?.uri ||
                            adminService.getMassageImageUrl(formData.image_url),
                        }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="image-outline"
                        size={24}
                        color={themeColors.textSecondary}
                      />
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.imagePickerButton,
                      { borderColor: themeColors.border || '#D1D5DB' },
                    ]}
                    onPress={() => pickImage('image')}
                    disabled={submitting}
                  >
                    <Ionicons
                      name="cloud-upload-outline"
                      size={16}
                      color={themeColors.text}
                    />
                    <Text
                      style={[
                        styles.imagePickerButtonText,
                        { color: themeColors.text },
                      ]}
                    >
                      {imageFile || formData.image_url
                        ? "Changer l'image"
                        : 'Choisir une image'}
                    </Text>
                  </TouchableOpacity>

                  {(imageFile || formData.image_url) && (
                    <TouchableOpacity
                      style={styles.imageRemoveButton}
                      onPress={() => clearPickedImage('image')}
                      disabled={submitting}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.error || '#DC2626'}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* ACTIVE */}
              <View
                style={[
                  styles.activeRow,
                  {
                    borderColor:
                      themeColors.border ||
                      '#D1D5DB',
                  },
                ]}
              >
                <View
                  style={
                    styles.activeTextContainer
                  }
                >
                  <Text
                    style={[
                      styles.activeTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Type actif
                  </Text>

                  <Text
                    style={[
                      styles.activeSubtitle,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Visible et disponible dans l'application
                  </Text>
                </View>

                <Switch
                  value={
                    formData.is_active
                  }
                  onValueChange={(
                    value
                  ) =>
                    updateField(
                      'is_active',
                      value
                    )
                  }
                  disabled={
                    submitting
                  }
                  trackColor={{
                    false: '#D1D5DB',
                    true: colors.primary,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* SAVE */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor:
                      colors.primary,
                    opacity:
                      submitting
                        ? 0.6
                        : 1,
                  },
                ]}
                onPress={
                  handleSave
                }
                disabled={
                  submitting
                }
              >
                {submitting ? (
                  <>
                    <ActivityIndicator
                      color="#FFFFFF"
                      size="small"
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Enregistrement...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={
                        editingId !==
                        null
                          ? 'checkmark-circle-outline'
                          : 'add-circle-outline'
                      }
                      size={21}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      {editingId !==
                      null
                        ? 'Mettre à jour'
                        : 'Créer le type'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* CANCEL */}
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {
                    borderColor:
                      themeColors.border ||
                      '#D1D5DB',
                  },
                ]}
                onPress={
                  closeModal
                }
                disabled={
                  submitting
                }
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ==========================================================
  // DELETE MODAL
  // ==========================================================

  const renderDeleteModal =
    () => {
      if (!selectedItem)
        return null;

      return (
        <Modal
          visible={
            deleteModalVisible
          }
          transparent
          animationType="fade"
          onRequestClose={
            closeDeleteModal
          }
        >
          <View
            style={
              styles.confirmOverlay
            }
          >
            <View
              style={[
                styles.confirmContainer,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.confirmIcon,
                  {
                    backgroundColor:
                      '#EF444418',
                  },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={30}
                  color="#EF4444"
                />
              </View>

              <Text
                style={[
                  styles.confirmTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Gérer ce type de massage
              </Text>

              <Text
                style={[
                  styles.confirmMessage,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Que souhaitez-vous faire avec{' '}
                <Text
                  style={[
                    styles.confirmName,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  "{selectedItem.name}"
                </Text>
                ?
              </Text>

              {/* DESACTIVER */}
              <TouchableOpacity
                style={[
                  styles.confirmAction,
                  {
                    backgroundColor:
                      '#F59E0B14',
                    borderColor:
                      '#F59E0B45',
                  },
                ]}
                disabled={
                  deleteProcessing
                }
                onPress={() =>
                  executeDelete(
                    selectedItem,
                    false
                  )
                }
              >
                <View
                  style={[
                    styles.confirmActionIcon,
                    {
                      backgroundColor:
                        '#F59E0B20',
                    },
                  ]}
                >
                  <Ionicons
                    name="pause-circle-outline"
                    size={22}
                    color="#D97706"
                  />
                </View>

                <View
                  style={
                    styles.confirmActionContent
                  }
                >
                  <Text
                    style={[
                      styles.confirmActionTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Désactiver
                  </Text>

                  <Text
                    style={[
                      styles.confirmActionSubtitle,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Masquer temporairement ce type
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={
                    themeColors.textSecondary
                  }
                />
              </TouchableOpacity>

              {/* SUPPRESSION */}
              <TouchableOpacity
                style={[
                  styles.confirmAction,
                  {
                    backgroundColor:
                      '#EF444414',
                    borderColor:
                      '#EF444445',
                  },
                ]}
                disabled={
                  deleteProcessing
                }
                onPress={() =>
                  executeDelete(
                    selectedItem,
                    true
                  )
                }
              >
                <View
                  style={[
                    styles.confirmActionIcon,
                    {
                      backgroundColor:
                        '#EF444420',
                    },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color="#DC2626"
                  />
                </View>

                <View
                  style={
                    styles.confirmActionContent
                  }
                >
                  <Text
                    style={[
                      styles.confirmActionTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Supprimer définitivement
                  </Text>

                  <Text
                    style={[
                      styles.confirmActionSubtitle,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Cette action est irréversible
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={
                    themeColors.textSecondary
                  }
                />
              </TouchableOpacity>

              {deleteProcessing && (
                <View
                  style={
                    styles.deleteLoading
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.deleteLoadingText,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Traitement en cours...
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.confirmCancelButton,
                  {
                    borderColor:
                      themeColors.border ||
                      '#D1D5DB',
                  },
                ]}
                disabled={
                  deleteProcessing
                }
                onPress={
                  closeDeleteModal
                }
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
            </View>
          </View>
        </Modal>
      );
    };

  // ==========================================================
  // EMPTY
  // ==========================================================

  const renderEmpty = () => {
    return (
      <View
        style={
          styles.emptyContainer
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
            name="fitness-outline"
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
          {searchQuery.trim()
            ? 'Aucun résultat'
            : 'Aucun type de massage'}
        </Text>

        <Text
          style={[
            styles.emptySubText,
            {
              color:
                themeColors.textSecondary,
            },
          ]}
        >
          {searchQuery.trim()
            ? 'Aucun type ne correspond à votre recherche.'
            : 'Cliquez sur « Nouveau type » pour commencer.'}
        </Text>

        {searchQuery.trim() && (
          <TouchableOpacity
            style={[
              styles.clearSearchEmpty,
              {
                borderColor:
                  colors.primary,
              },
            ]}
            onPress={() =>
              handleSearchChange(
                ''
              )
            }
          >
            <Ionicons
              name="close-circle-outline"
              size={18}
              color={
                colors.primary
              }
            />

            <Text
              style={[
                styles.clearSearchEmptyText,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              Effacer la recherche
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ==========================================================
  // MAIN
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
      {renderToast()}

      <View
        style={[
          styles.container,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        {/* HEADER */}
        <Header
          title="Types de massage"
          showBack
        />

        {/* TOOLBAR */}
        <View
          style={
            styles.toolbarWrapper
          }
        >
          <View
            style={
              styles.topToolbar
            }
          >
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border ||
                    '#E5E7EB',
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={21}
                color={
                  themeColors.textSecondary
                }
              />

              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                value={
                  searchQuery
                }
                onChangeText={
                  handleSearchChange
                }
                placeholder="Rechercher un type de massage..."
                placeholderTextColor={
                  themeColors.textSecondary
                }
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />

              {searchQuery.length >
                0 && (
                <TouchableOpacity
                  onPress={() =>
                    handleSearchChange(
                      ''
                    )
                  }
                  style={
                    styles.clearSearchButton
                  }
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={
                      themeColors.textSecondary
                    }
                  />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.addButton,
                {
                  backgroundColor:
                    colors.primary,
                },
              ]}
              onPress={
                openCreateModal
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="add"
                size={21}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.addButtonText
                }
              >
                Nouveau type
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH RESULT */}
        {searchQuery.trim()
          .length > 0 && (
          <View
            style={
              styles.searchResultInfo
            }
          >
            <Ionicons
              name="search"
              size={15}
              color={
                colors.primary
              }
            />

            <Text
              style={[
                styles.searchResultText,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {filteredTypes.length}{' '}
              résultat
              {filteredTypes.length >
              1
                ? 's'
                : ''}{' '}
              pour "
              {
                searchQuery.trim()
              }
              "
            </Text>
          </View>
        )}

        {/* ERROR */}
        {error && !loading ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor:
                  '#E74C3C15',
                borderColor:
                  '#E74C3C',
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={21}
              color="#E74C3C"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setLoading(true);
                loadTypes();
              }}
            >
              <Text
                style={[
                  styles.retryText,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                Réessayer
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* LOADING */}
        {loading &&
        !refreshing ? (
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

            <Text
              style={[
                styles.loadingText,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Chargement...
            </Text>
          </View>
        ) : (
          <View
            style={
              styles.listArea
            }
          >
            {/* ==================================================
                WEB
            ================================================== */}
            {isDesktop ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  true
                }
                contentContainerStyle={
                  styles.webHorizontalContent
                }
              >
                <View
                  style={
                    styles.webTableContainer
                  }
                >
                  {renderWebTableHeader()}

                  {paginatedTypes.length >
                  0 ? (
                    <FlatList
                      data={
                        paginatedTypes
                      }
                      renderItem={
                        renderWebTableRow
                      }
                      keyExtractor={(
                        item
                      ) =>
                        String(
                          item.id
                        )
                      }
                      showsVerticalScrollIndicator={
                        true
                      }
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
                      contentContainerStyle={[
                        styles.webListContent,
                        {
                          paddingBottom:
                            WEB_BOTTOM_SAFE_SPACE,
                        },
                      ]}
                      ListEmptyComponent={
                        renderEmpty
                      }
                    />
                  ) : (
                    renderEmpty()
                  )}
                </View>
              </ScrollView>
            ) : (
              /* ==================================================
                 MOBILE / ANDROID / IOS
              ================================================== */
              <FlatList
                data={
                  paginatedTypes
                }
                renderItem={
                  renderMobileCard
                }
                keyExtractor={(
                  item
                ) =>
                  String(
                    item.id
                  )
                }
                showsVerticalScrollIndicator={
                  false
                }
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
                contentContainerStyle={[
                  styles.mobileListContent,
                  {
                    paddingBottom:
                      MOBILE_BOTTOM_SAFE_SPACE,
                  },
                  paginatedTypes.length ===
                    0 &&
                    styles.mobileEmptyList,
                ]}
                ListEmptyComponent={
                  renderEmpty
                }
              />
            )}

            {/* PAGINATION */}
            {renderPagination()}
          </View>
        )}

        {renderModal()}
        {renderDeleteModal()}
      </View>
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
    minHeight: 0,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastLayer: {
    position: 'absolute',
    top:
      Platform.OS === 'web'
        ? 18
        : 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999,
  },

  toastContainer: {
    width:
      Platform.OS === 'web'
        ? 'min(92%, 560px)'
        : '92%',

    maxWidth: 560,
    minHeight: 68,

    borderWidth: 1,
    borderRadius: 16,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 13,
    paddingVertical: 11,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
  },

  toastIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  toastContent: {
    flex: 1,
    paddingRight: 8,
  },

  toastTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily
        .semiBold,
    marginBottom: 2,
  },

  toastMessage: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily
        .regular,
  },

  toastClose: {
    width: 32,
    height: 32,
    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==========================================================
  // TOOLBAR
  // ==========================================================

  toolbarWrapper: {
    width: '100%',
  },

  topToolbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',

    gap: 10,

    paddingHorizontal:
      Platform.OS === 'web'
        ? 24
        : spacing.md,

    paddingTop: 10,
    paddingBottom: 10,
  },

  searchContainer: {
    flex: 1,
    minHeight: 46,

    borderRadius: 12,
    borderWidth: 1,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 13,
  },

  searchInput: {
    flex: 1,

    minHeight: 44,

    paddingHorizontal: 9,
    paddingVertical: 8,

    fontSize: 14,

    fontFamily:
      typography.fontFamily
        .regular,

    ...(Platform.OS ===
    'web'
      ? {
          outlineStyle:
            'none',
        }
      : {}),
  },

  clearSearchButton: {
    width: 34,
    height: 34,

    alignItems: 'center',
    justifyContent: 'center',
  },

  addButton: {
    minHeight: 46,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 17,

    borderRadius: 11,

    gap: 7,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontFamily:
      typography.fontFamily
        .semiBold,
    fontSize: 13,
  },

  // ==========================================================
  // SEARCH INFO
  // ==========================================================

  searchResultInfo: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 6,

    paddingHorizontal:
      Platform.OS === 'web'
        ? 24
        : spacing.md,

    paddingBottom: 5,
  },

  searchResultText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily
        .medium,
  },

  // ==========================================================
  // LIST AREA
  // ==========================================================

  listArea: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },

  // ==========================================================
  // MOBILE LIST
  // ==========================================================

  mobileListContent: {
    paddingHorizontal:
      spacing.md,
    paddingTop: 7,
  },

  mobileEmptyList: {
    flexGrow: 1,
  },

  // ==========================================================
  // WEB TABLE
  // ==========================================================

  webHorizontalContent: {
    minWidth: '100%',
    flexGrow: 1,
  },

  webTableContainer: {
    width: '100%',
    minWidth: 980,
    flex: 1,
  },

  tableHeader: {
    minHeight: 50,

    flexDirection: 'row',
    alignItems: 'center',

    borderWidth: 1,
    borderBottomWidth: 0,

    marginHorizontal: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,

    paddingHorizontal: 4,
  },

  tableRow: {
    minHeight: 76,

    flexDirection: 'row',
    alignItems: 'center',

    borderWidth: 1,
    borderTopWidth: 0,

    paddingHorizontal: 4,
  },

  tableCell: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  colName: {
    flex: 2.5,
    minWidth: 280,
  },

  colPrice: {
    flex: 1.15,
    minWidth: 135,
  },

  colDuration: {
    flex: 1.15,
    minWidth: 135,
  },

  colCategory: {
    flex: 1.25,
    minWidth: 145,
  },

  colOrder: {
    flex: 0.65,
    minWidth: 70,
  },

  colStatus: {
    flex: 0.9,
    minWidth: 100,
  },

  colActions: {
    flex: 1.35,
    minWidth: 170,
  },

  tableHeaderText: {
    fontSize: 10,
    fontFamily:
      typography.fontFamily
        .bold,
    letterSpacing: 0.4,
  },

  webNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  webTypeIcon: {
    width: 40,
    height: 40,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  webTypeIconImage: {
    width: '100%',
    height: '100%',
  },

  webNameContent: {
    flex: 1,
    minWidth: 0,
  },

  webName: {
    fontSize: 14,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  webDescription: {
    fontSize: 11,

    marginTop: 3,

    maxWidth: 390,
  },

  webPrice: {
    fontSize: 13,

    fontFamily:
      typography.fontFamily
        .bold,
  },

  webRecommended: {
    fontSize: 10,
    marginTop: 3,
  },

  tableInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  tableValue: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily
        .medium,
  },

  categoryBadge: {
    alignSelf: 'flex-start',

    paddingHorizontal: 9,
    paddingVertical: 6,

    borderRadius: 8,

    maxWidth: 135,
  },

  categoryBadgeText: {
    fontSize: 10,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  actionButton: {
    minHeight: 36,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 9,

    paddingHorizontal: 9,

    gap: 5,
  },

  editButton: {
    backgroundColor:
      '#0D2B7E10',
  },

  deleteButton: {
    backgroundColor:
      '#EF444410',
  },

  actionButtonText: {
    fontSize: 10,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  webListContent: {
    paddingBottom:
      WEB_BOTTOM_SAFE_SPACE,
  },

  // ==========================================================
  // MOBILE CARD
  // ==========================================================

  card: {
    borderRadius: 16,
    borderWidth: 1,

    padding: 14,

    marginBottom: 10,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,

    elevation: 1,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent:
      'space-between',
  },

  cardThumbnailBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.sm,
  },

  cardThumbnailImage: {
    width: '100%',
    height: '100%',
  },

  cardTitleContainer: {
    flex: 1,
    paddingRight: 8,
  },

  cardName: {
    fontSize: 16,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  cardPrice: {
    fontSize: 13,

    marginTop: 4,

    fontFamily:
      typography.fontFamily
        .bold,
  },

  mobileStatusActions: {
    alignItems: 'flex-end',
  },

  cardDescription: {
    fontSize: 12,
    lineHeight: 18,

    marginTop: 9,
  },

  cardInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: 7,

    marginTop: 11,
  },

  infoBox: {
    flex: 1,

    minWidth: 95,

    minHeight: 53,

    borderRadius: 11,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 9,
    gap: 7,
  },

  infoLabel: {
    fontSize: 9,
    marginBottom: 2,
  },

  infoValue: {
    fontSize: 11,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  mobileActions: {
    flexDirection: 'row',

    gap: 8,

    borderTopWidth: 1,

    marginTop: 12,
    paddingTop: 11,
  },

  mobileAction: {
    flex: 1,

    minHeight: 40,

    borderRadius: 10,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 6,
  },

  mobileActionText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',

    alignSelf: 'flex-start',

    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 8,

    gap: 5,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 10,

    fontFamily:
      typography.fontFamily
        .medium,
  },

  // ==========================================================
  // PAGINATION
  // ==========================================================

  paginationContainer: {
    minHeight: 58,

    borderTopWidth: 1,

    paddingHorizontal:
      Platform.OS === 'web'
        ? 24
        : spacing.md,

    paddingVertical: 10,

    flexDirection:
      Platform.OS === 'web'
        ? 'row'
        : 'column',

    alignItems: 'center',

    justifyContent:
      Platform.OS === 'web'
        ? 'space-between'
        : 'center',

    gap: 9,
  },

  paginationInfo: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily
        .medium,
  },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 5,
  },

  pageArrow: {
    width: 36,
    height: 36,

    borderRadius: 10,
    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },

  pageButton: {
    width: 36,
    height: 36,

    borderRadius: 10,
    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },

  pageButtonText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  ellipsis: {
    width: 22,
    height: 36,

    alignItems: 'center',
    justifyContent: 'center',
  },

  ellipsisText: {
    fontSize: 18,
  },

  // ==========================================================
  // EMPTY
  // ==========================================================

  emptyContainer: {
    flexGrow: 1,

    minHeight: 260,

    justifyContent:
      'center',
    alignItems: 'center',

    paddingTop: 55,
    paddingBottom: 55,
    paddingHorizontal: 25,
  },

  emptyIcon: {
    width: 82,
    height: 82,

    borderRadius: 25,

    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    fontSize:
      typography.fontSize
        .md,

    fontFamily:
      typography.fontFamily
        .semiBold,

    marginTop: spacing.md,
  },

  emptySubText: {
    fontSize: 13,

    marginTop: 6,

    textAlign: 'center',

    lineHeight: 19,

    maxWidth: 400,
  },

  clearSearchEmpty: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 6,

    marginTop: 18,

    paddingHorizontal: 14,
    paddingVertical: 9,

    borderWidth: 1,
    borderRadius: 10,
  },

  clearSearchEmptyText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  // ==========================================================
  // ERROR
  // ==========================================================

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',

    marginHorizontal:
      Platform.OS === 'web'
        ? 24
        : spacing.md,

    padding: spacing.sm,

    borderRadius: 10,
    borderWidth: 1,

    marginBottom: spacing.sm,

    gap: 8,
  },

  errorText: {
    flex: 1,

    color: '#E74C3C',

    fontSize: 13,
  },

  retryText: {
    fontFamily:
      typography.fontFamily
        .semiBold,

    fontSize: 13,
  },

  // ==========================================================
  // LOADING
  // ==========================================================

  loadingContainer: {
    flex: 1,

    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: spacing.sm,

    fontSize:
      typography.fontSize
        .md,
  },

  // ==========================================================
  // FORM MODAL
  // ==========================================================

  modalOverlay: {
    flex: 1,

    backgroundColor:
      'rgba(0,0,0,0.58)',

    justifyContent:
      'center',

    alignItems:
      'center',

    padding: 15,
  },

  modalContainer: {
    width:
      Platform.OS === 'web'
        ? 'min(94%, 820px)'
        : '94%',

    maxWidth: 820,

    maxHeight:
      Platform.OS === 'web'
        ? '92%'
        : '94%',

    borderRadius: 20,

    overflow: 'hidden',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.22,
    shadowRadius: 18,

    elevation: 15,
  },

  modalHeader: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    alignItems: 'center',

    paddingHorizontal:
      spacing.lg,

    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },

  modalTitleContainer: {
    flex: 1,
    paddingRight: 10,
  },

  modalTitle: {
    fontSize:
      typography.fontSize
        .lg,

    fontFamily:
      typography.fontFamily
        .bold,
  },

  modalSubtitle: {
    marginTop: 4,

    fontSize: 12,
  },

  closeButton: {
    width: 40,
    height: 40,

    borderRadius: 20,

    justifyContent: 'center',
    alignItems: 'center',
  },

  modalScroll: {
    flexGrow: 0,
  },

  modalContent: {
    paddingHorizontal:
      spacing.lg,

    paddingBottom:
      spacing.xl,
  },

  // ==========================================================
  // FORM
  // ==========================================================

  field: {
    marginBottom:
      spacing.md,
  },

  // ✅ NOUVEAU : sélecteur d'image (icon_url / image_url en fichier)
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  imagePreviewBox: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  imagePreview: {
    width: '100%',
    height: '100%',
  },

  imagePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },

  imagePickerButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily?.medium,
  },

  imageRemoveButton: {
    padding: spacing.xs,
  },

  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  halfField: {
    flex: 1,
  },

  label: {
    fontSize:
      typography.fontSize
        .sm,

    fontFamily:
      typography.fontFamily
        .medium,

    marginBottom: 6,
  },

  input: {
    borderWidth: 1,

    borderRadius: 10,

    paddingHorizontal:
      spacing.md,

    paddingVertical: 10,

    minHeight: 44,

    fontSize:
      typography.fontSize
        .md,

    fontFamily:
      typography.fontFamily
        .regular,

    ...(Platform.OS ===
    'web'
      ? {
          outlineStyle:
            'none',
        }
      : {}),
  },

  textarea: {
    minHeight: 100,
    paddingTop: 12,
  },

  categoryContainer: {
    gap: 7,
    paddingVertical: 2,
  },

  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,

    borderRadius: 9,

    borderWidth: 1,
  },

  categoryText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily
        .medium,
  },

  activeRow: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    alignItems: 'center',

    borderWidth: 1,

    borderRadius: 12,

    paddingHorizontal: 14,
    paddingVertical: 10,

    marginBottom:
      spacing.md,
  },

  activeTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  activeTitle: {
    fontSize: 14,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  activeSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  saveButton: {
    minHeight: 48,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    flexDirection: 'row',

    gap: 8,

    marginTop: 4,
  },

  saveButtonText: {
    color: '#FFFFFF',

    fontSize:
      typography.fontSize
        .md,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  cancelButton: {
    minHeight: 46,

    borderRadius: 12,

    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 10,
  },

  cancelButtonText: {
    fontSize:
      typography.fontSize
        .md,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  // ==========================================================
  // DELETE MODAL
  // ==========================================================

  confirmOverlay: {
    flex: 1,

    backgroundColor:
      'rgba(0,0,0,0.58)',

    alignItems: 'center',
    justifyContent: 'center',

    padding: 20,
  },

  confirmContainer: {
    width:
      Platform.OS === 'web'
        ? 'min(94%, 500px)'
        : '94%',

    maxWidth: 500,

    borderRadius: 22,

    padding: 22,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.22,
    shadowRadius: 20,

    elevation: 15,
  },

  confirmIcon: {
    width: 62,
    height: 62,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    alignSelf: 'center',

    marginBottom: 14,
  },

  confirmTitle: {
    textAlign: 'center',

    fontSize: 18,

    fontFamily:
      typography.fontFamily
        .bold,
  },

  confirmMessage: {
    textAlign: 'center',

    fontSize: 13,

    lineHeight: 19,

    marginTop: 7,
    marginBottom: 18,
  },

  confirmName: {
    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  confirmAction: {
    flexDirection: 'row',
    alignItems: 'center',

    borderWidth: 1,

    borderRadius: 14,

    padding: 11,

    marginBottom: 9,
  },

  confirmActionIcon: {
    width: 42,
    height: 42,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  confirmActionContent: {
    flex: 1,
  },

  confirmActionTitle: {
    fontSize: 13,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },

  confirmActionSubtitle: {
    fontSize: 11,

    marginTop: 3,
  },

  deleteLoading: {
    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'center',

    gap: 8,

    marginVertical: 8,
  },

  deleteLoadingText: {
    fontSize: 12,
  },

  confirmCancelButton: {
    minHeight: 46,

    borderWidth: 1,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 6,
  },

  confirmCancelText: {
    fontSize: 13,

    fontFamily:
      typography.fontFamily
        .semiBold,
  },
});

export default MassageTypesScreen;