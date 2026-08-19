// src/screens/admin/SettingsScreen.js
//
// ============================================================
// SETTINGS SCREEN — ADMIN
// ============================================================
// ✅ Responsive Web / Android / iOS
// ✅ Toast custom au lieu de Alert.alert()
// ✅ Modal confirmation déconnexion avec icône log-out
// ✅ Modal suppression photo avec icône trash
// ✅ Upload photo Web + Native
// ✅ Formulaire numérique avec saisie libre
// ✅ Dark mode
// ✅ Grille responsive desktop/tablette
// ✅ Protection contre la perte du rôle utilisateur
// ============================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Animated,
  SafeAreaView,
  Image,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import Header from '../../components/common/Header';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useResponsive from '../../hooks/useResponsive';
import adminService from '../../services/adminService';

const IS_WEB = Platform.OS === 'web';

// ============================================================
// CONFIGURATION
// ============================================================

const SETTINGS_MAX_WIDTH = 920;

const NUMERIC_RULES = {
  commissionRate: {
    min: 0,
    max: 100,
  },

  minPrice: {
    min: 0,
    max: 10000000,
  },

  maxDistance: {
    min: 0,
    max: 200,
  },
};

// ============================================================
// COMPONENT
// ============================================================

const SettingsScreen = ({ navigation }) => {
  const {
    colors: themeColors,
    isDark,
    toggleTheme,
  } = useTheme();

  const {
    user,
    logout,
    updateProfile,
  } = useAuth();

  // ==========================================================
  // RESPONSIVE
  // ==========================================================

  const {
    isTablet,
    isDesktop,
    isLargeScreen,
    horizontalPadding,
  } = useResponsive();

  const useTwoColumnGrid = isLargeScreen;

  // ==========================================================
  // STATES
  // ==========================================================

  const [isLoading, setIsLoading] = useState(false);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] =
    useState(false);

  const [showRemovePhotoConfirm, setShowRemovePhotoConfirm] =
    useState(false);

  const [error, setError] = useState(null);

  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  // ==========================================================
  // PROFILE IMAGE
  // ==========================================================

  const [profileImage, setProfileImage] = useState(
    user?.profile_image || null
  );

  // ==========================================================
  // SETTINGS
  // ==========================================================

  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    smsNotifications: false,
    autoApprove: false,

    commissionRate: 10,
    minPrice: 25000,
    maxDistance: 10,
  });

  // ==========================================================
  // NUMERIC INPUT BUFFER
  // ==========================================================

  const [inputText, setInputText] = useState({
    commissionRate: '10',
    minPrice: '25000',
    maxDistance: '10',
  });

  // ==========================================================
  // ANIMATION
  // ==========================================================

  const fadeAnim =
    useRef(new Animated.Value(0)).current;

  // ==========================================================
  // TOAST
  // ==========================================================

  const [toast, setToast] = useState(null);

  const toastOpacity =
    useRef(new Animated.Value(0)).current;

  const toastTranslateY =
    useRef(new Animated.Value(-20)).current;

  const toastTimer =
    useRef(null);

  // ==========================================================
  // SHOW TOAST
  // ==========================================================

  const showToast = useCallback(
    (
      message,
      type = 'info',
      duration = 3200
    ) => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast({
        message,
        type,
      });

      toastOpacity.setValue(0);
      toastTranslateY.setValue(-20);

      Animated.parallel([
        Animated.timing(
          toastOpacity,
          {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }
        ),

        Animated.spring(
          toastTranslateY,
          {
            toValue: 0,
            tension: 90,
            friction: 9,
            useNativeDriver: true,
          }
        ),
      ]).start();

      toastTimer.current = setTimeout(() => {
        Animated.timing(
          toastOpacity,
          {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }
        ).start(() => {
          setToast(null);
        });
      }, duration);
    },
    [
      toastOpacity,
      toastTranslateY,
    ]
  );

  // ==========================================================
  // CLEANUP TOAST
  // ==========================================================

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // ==========================================================
  // LOAD SETTINGS
  // ==========================================================

  const loadSettings = useCallback(async () => {
    try {
      setError(null);

      const data =
        await adminService
          .getAdminSettings()
          .catch(() => null);

      if (!data) {
        return;
      }

      setSettings((previous) => ({
        ...previous,
        ...data,
      }));

      setInputText({
        commissionRate: String(
          data.commissionRate ?? 0
        ),

        minPrice: String(
          data.minPrice ?? 0
        ),

        maxDistance: String(
          data.maxDistance ?? 0
        ),
      });
    } catch (err) {
      console.error(
        '❌ Error loading settings:',
        err
      );

      setError(
        'Impossible de charger les paramètres.'
      );
    }
  }, []);

  // ==========================================================
  // SCREEN FOCUS
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      loadSettings();

      if (user?.profile_image) {
        setProfileImage(
          user.profile_image
        );
      } else {
        setProfileImage(null);
      }

      fadeAnim.setValue(0);

      Animated.timing(
        fadeAnim,
        {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }
      ).start();

      return () => {};
    }, [
      user,
      loadSettings,
      fadeAnim,
    ])
  );

  // ==========================================================
  // NUMERIC INPUT CHANGE
  // ==========================================================

  const handleNumericChange = (
    id,
    text
  ) => {
    // Autoriser chiffres + point
    const cleaned = text.replace(
      /[^0-9.]/g,
      ''
    );

    // Éviter plusieurs points
    const parts =
      cleaned.split('.');

    const normalized =
      parts.length > 2
        ? `${parts[0]}.${parts.slice(1).join('')}`
        : cleaned;

    setInputText(
      (previous) => ({
        ...previous,
        [id]: normalized,
      })
    );
  };

  // ==========================================================
  // NUMERIC INPUT BLUR
  // ==========================================================

  const handleNumericBlur = (id) => {
    const rule =
      NUMERIC_RULES[id] || {
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
      };

    let value =
      parseFloat(
        inputText[id]
      );

    if (!Number.isFinite(value)) {
      value = rule.min;
    }

    value = Math.min(
      rule.max,
      Math.max(
        rule.min,
        value
      )
    );

    setSettings(
      (previous) => ({
        ...previous,
        [id]: value,
      })
    );

    setInputText(
      (previous) => ({
        ...previous,
        [id]: String(value),
      })
    );
  };

  // ==========================================================
  // UPLOAD PROFILE PHOTO
  // ==========================================================

  const handleUploadPhoto =
    async () => {
      try {
        const permissionResult =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
          showToast(
            "Autorisez l'accès à la galerie pour changer votre photo.",
            'warning'
          );

          return;
        }

        const result =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes:
                ImagePicker
                  .MediaTypeOptions
                  .Images,

              allowsEditing: true,

              aspect: [1, 1],

              quality: 0.8,

              base64: false,
            });

        if (
          result.canceled ||
          !result.assets ||
          !result.assets.length
        ) {
          return;
        }

        const selectedImage =
          result.assets[0];

        // ======================================================
        // FILE NAME / MIME TYPE
        // ======================================================

        let extension = 'jpg';

        let mimeType =
          selectedImage.mimeType;

        if (
          mimeType &&
          mimeType.includes('/')
        ) {
          extension =
            mimeType.split('/')[1] ||
            'jpg';
        } else {
          const guessedExt =
            selectedImage.uri
              .split('.')
              .pop()
              ?.toLowerCase();

          if (
            guessedExt &&
            guessedExt.length <= 5 &&
            [
              'jpg',
              'jpeg',
              'png',
              'gif',
              'webp',
              'heic',
              'bmp',
            ].includes(guessedExt)
          ) {
            extension =
              guessedExt;
          }

          mimeType =
            `image/${
              extension === 'jpg'
                ? 'jpeg'
                : extension
            }`;
        }

        const fileName =
          `profile_${Date.now()}.${extension}`;

        setUploadingPhoto(true);

        // ======================================================
        // WEB
        // ======================================================

        let fileToUpload;

        if (IS_WEB) {
          const response =
            await fetch(
              selectedImage.uri
            );

          const blob =
            await response.blob();

          fileToUpload =
            new File(
              [blob],
              fileName,
              {
                type: mimeType,
              }
            );
        }

        // ======================================================
        // ANDROID / IOS
        // ======================================================

        else {
          fileToUpload = {
            uri: selectedImage.uri,
            type: mimeType,
            name: fileName,
          };
        }

        // ======================================================
        // UPLOAD
        // ======================================================

        const response =
          await adminService
            .uploadProfilePhoto(
              fileToUpload
            );

        if (
          response &&
          response.profile_image
        ) {
          setProfileImage(
            response.profile_image
          );

          // IMPORTANT :
          // updateProfile doit fusionner
          // avec l'utilisateur existant.
          if (updateProfile) {
            await updateProfile({
              profile_image:
                response.profile_image,
            });
          }

          showToast(
            'Photo de profil mise à jour avec succès.',
            'success'
          );
        } else {
          throw new Error(
            'Réponse invalide du serveur : profile_image manquant.'
          );
        }
      } catch (err) {
        console.error(
          '❌ Error uploading photo:',
          err
        );

        showToast(
          `Impossible d'uploader la photo : ${
            err?.message ||
            'Erreur inconnue'
          }`,
          'error'
        );
      } finally {
        setUploadingPhoto(false);
      }
    };

  // ==========================================================
  // REQUEST REMOVE PHOTO
  // ==========================================================

  const requestRemovePhoto =
    () => {
      setShowRemovePhotoConfirm(
        true
      );
    };

  // ==========================================================
  // REMOVE PHOTO
  // ==========================================================

  const confirmRemovePhoto =
    async () => {
      try {
        setUploadingPhoto(true);

        await adminService
          .updateMyProfile({
            profile_image: null,
          });

        setProfileImage(null);

        if (updateProfile) {
          await updateProfile({
            profile_image: null,
          });
        }

        showToast(
          'Photo de profil supprimée.',
          'success'
        );
      } catch (err) {
        console.error(
          '❌ Error removing photo:',
          err
        );

        showToast(
          `Impossible de supprimer la photo : ${
            err?.message ||
            'Erreur inconnue'
          }`,
          'error'
        );
      } finally {
        setUploadingPhoto(false);

        setShowRemovePhotoConfirm(
          false
        );
      }
    };

  // ==========================================================
  // SAVE SETTINGS
  // ==========================================================

  const handleSaveSettings =
    async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Synchroniser les champs numériques
        const normalizedSettings = {
          ...settings,

          commissionRate:
            Number(
              inputText.commissionRate
            ) || 0,

          minPrice:
            Number(
              inputText.minPrice
            ) || 0,

          maxDistance:
            Number(
              inputText.maxDistance
            ) || 0,
        };

        // Respect des bornes
        normalizedSettings.commissionRate =
          Math.min(
            100,
            Math.max(
              0,
              normalizedSettings
                .commissionRate
            )
          );

        normalizedSettings.minPrice =
          Math.min(
            10000000,
            Math.max(
              0,
              normalizedSettings
                .minPrice
            )
          );

        normalizedSettings.maxDistance =
          Math.min(
            200,
            Math.max(
              0,
              normalizedSettings
                .maxDistance
            )
          );

        setSettings(
          normalizedSettings
        );

        setInputText({
          commissionRate:
            String(
              normalizedSettings
                .commissionRate
            ),

          minPrice:
            String(
              normalizedSettings
                .minPrice
            ),

          maxDistance:
            String(
              normalizedSettings
                .maxDistance
            ),
        });

        await adminService
          .updateAdminSettings(
            normalizedSettings
          );

        showToast(
          'Paramètres enregistrés avec succès.',
          'success'
        );
      } catch (err) {
        console.error(
          '❌ Error saving settings:',
          err
        );

        setError(
          "Impossible d'enregistrer les paramètres."
        );

        showToast(
          `Impossible d'enregistrer : ${
            err?.message ||
            'Erreur inconnue'
          }`,
          'error'
        );
      } finally {
        setIsLoading(false);
      }
    };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    async () => {
      if (isLoggingOut) {
        return;
      }

      try {
        setIsLoggingOut(true);

        await logout();

        setShowLogoutConfirm(
          false
        );

        // ====================================================
        // NAVIGATION LOGIN
        // ====================================================

        navigation.reset({
          index: 0,

          routes: [
            {
              name: 'Login',
            },
          ],
        });
      } catch (err) {
        console.error(
          '❌ Logout error:',
          err
        );

        showToast(
          'Impossible de se déconnecter.',
          'error'
        );
      } finally {
        setIsLoggingOut(false);
      }
    };

  // ==========================================================
  // SETTINGS SECTIONS
  // ==========================================================

  const settingSections = [
    {
      id: 'general',

      title: 'Notifications',

      description:
        'Choisissez comment la plateforme vous prévient.',

      icon: 'notifications-outline',

      items: [
        {
          id: 'notifications',
          label: 'Notifications push',
          type: 'switch',
        },

        {
          id: 'emailNotifications',
          label: 'Notifications email',
          type: 'switch',
        },

        {
          id: 'smsNotifications',
          label: 'Notifications SMS',
          type: 'switch',
        },
      ],
    },

    {
      id: 'platform',

      title: 'Plateforme',

      description:
        'Paramètres commerciaux appliqués à toutes les réservations.',

      icon: 'settings-outline',

      items: [
        {
          id: 'commissionRate',
          label: 'Taux de commission',
          suffix: '%',
          type: 'input',
        },

        {
          id: 'minPrice',
          label: 'Prix minimum',
          suffix: 'Ar',
          type: 'input',
        },

        {
          id: 'maxDistance',
          label: 'Distance max',
          suffix: 'km',
          type: 'input',
        },
      ],
    },

    {
      id: 'moderation',

      title: 'Modération',

      description:
        "Contrôle des inscriptions et demandes en attente.",

      icon: 'shield-outline',

      items: [
        {
          id: 'autoApprove',
          label: 'Approbation automatique',
          type: 'switch',
        },
      ],
    },

    {
      id: 'appearance',

      title: 'Apparence',

      description:
        "Adaptez l'affichage à votre confort visuel.",

      icon: isDark
        ? 'moon'
        : 'sunny',

      items: [
        {
          id: '__theme',

          label:
            `Mode ${
              isDark
                ? 'sombre'
                : 'clair'
            }`,

          type: 'theme-switch',
        },
      ],
    },
  ];

  // ==========================================================
  // RENDER SETTING ITEM
  // ==========================================================

  const renderSettingItem =
    (item) => {
      // ======================================================
      // SWITCH
      // ======================================================

      if (
        item.type === 'switch'
      ) {
        return (
          <Switch
            value={
              Boolean(
                settings[item.id]
              )
            }
            onValueChange={
              (value) => {
                setSettings(
                  (previous) => ({
                    ...previous,

                    [item.id]:
                      value,
                  })
                );
              }
            }
            trackColor={{
              false: isDark
                ? '#3A3A3C'
                : '#D8DCE1',

              true:
                colors.primary,
            }}
            thumbColor="#FFFFFF"
            accessibilityLabel={
              item.label
            }
          />
        );
      }

      // ======================================================
      // THEME SWITCH
      // ======================================================

      if (
        item.type ===
        'theme-switch'
      ) {
        return (
          <Switch
            value={isDark}
            onValueChange={
              toggleTheme
            }
            trackColor={{
              false: isDark
                ? '#3A3A3C'
                : '#D8DCE1',

              true:
                colors.primary,
            }}
            thumbColor="#FFFFFF"
            accessibilityLabel={
              item.label
            }
          />
        );
      }

      // ======================================================
      // NUMERIC INPUT
      // ======================================================

      if (
        item.type === 'input'
      ) {
        return (
          <View
            style={
              styles.inputWrapper
            }
          >
            <TextInput
              style={[
                styles.settingInput,

                {
                  color:
                    themeColors.text,

                  borderColor:
                    themeColors.border ||
                    '#E0E0E0',

                  backgroundColor:
                    isDark
                      ? '#1E1E1E'
                      : '#F7F8FA',
                },
              ]}
              value={
                inputText[item.id] ??
                String(
                  settings[item.id] ??
                  0
                )
              }
              onChangeText={
                (text) =>
                  handleNumericChange(
                    item.id,
                    text
                  )
              }
              onBlur={() =>
                handleNumericBlur(
                  item.id
                )
              }
              keyboardType="numeric"
              accessibilityLabel={
                item.label
              }
              placeholder="0"
              placeholderTextColor={
                themeColors
                  .textSecondary
              }
              {...(
                IS_WEB
                  ? {
                      outlineStyle:
                        'none',
                    }
                  : {}
              )}
            />

            {!!item.suffix && (
              <Text
                style={[
                  styles.inputSuffix,
                  {
                    color:
                      themeColors
                        .textSecondary,
                  },
                ]}
              >
                {item.suffix}
              </Text>
            )}
          </View>
        );
      }

      return null;
    };

  // ==========================================================
  // RENDER SECTION CARD
  // ==========================================================

  const renderSectionCard =
    (section) => (
      <View
        key={section.id}
        style={[
          styles.sectionCard,

          useTwoColumnGrid &&
            styles.sectionCardGrid,

          {
            backgroundColor:
              themeColors.surface,

            borderColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(15,23,42,0.05)',
          },
        ]}
      >
        {/* HEADER */}
        <View
          style={
            styles.sectionHeader
          }
        >
          <View
            style={[
              styles.sectionIconBadge,
              {
                backgroundColor:
                  `${colors.primary}16`,
              },
            ]}
          >
            <Ionicons
              name={section.icon}
              size={18}
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
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {section.title}
            </Text>

            {!!section.description && (
              <Text
                style={[
                  styles.sectionDescription,
                  {
                    color:
                      themeColors
                        .textSecondary,
                  },
                ]}
              >
                {section.description}
              </Text>
            )}
          </View>
        </View>

        {/* ITEMS */}
        {section.items.map(
          (item) => (
            <View
              key={item.id}
              style={[
                styles.settingRow,
                {
                  borderBottomColor:
                    themeColors.border ||
                    (
                      isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#EEF0F3'
                    ),
                },
              ]}
            >
              <Text
                style={[
                  styles.settingLabel,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                {item.label}
              </Text>

              {renderSettingItem(
                item
              )}
            </View>
          )
        )}
      </View>
    );

  // ==========================================================
  // TOAST COMPONENT
  // ==========================================================

  const Toast = () => {
    if (!toast) {
      return null;
    }

    let backgroundColor =
      colors.primary;

    let icon =
      'information-circle';

    if (
      toast.type ===
      'success'
    ) {
      backgroundColor =
        '#16A34A';

      icon =
        'checkmark-circle';
    }

    if (
      toast.type ===
      'error'
    ) {
      backgroundColor =
        '#DC2626';

      icon =
        'alert-circle';
    }

    if (
      toast.type ===
      'warning'
    ) {
      backgroundColor =
        '#F59E0B';

      icon =
        'warning';
    }

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
              backgroundColor,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={19}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.toastText
            }
            numberOfLines={3}
          >
            {toast.message}
          </Text>
        </View>
      </Animated.View>
    );
  };

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
      <View
        style={[
          styles.container,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        {/* ====================================================
            HEADER
        ==================================================== */}

        <Header
          title="Paramètres"
          showBack
        />

        {/* ====================================================
            CONTENT
        ==================================================== */}

        <Animated.ScrollView
          style={[
            styles.scrollView,
            {
              opacity:
                fadeAnim,
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingHorizontal:
                horizontalPadding,
            },

            isDesktop &&
              styles.scrollContentDesktop,
          ]}
        >
          <View
            style={[
              styles.contentInner,

              isTablet && {
                maxWidth:
                  SETTINGS_MAX_WIDTH,

                width: '100%',

                alignSelf:
                  'center',
              },
            ]}
          >
            {/* =================================================
                ERROR
            ================================================= */}

            {!!error && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor:
                      '#E74C3C15',

                    borderColor:
                      '#E74C3C40',
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle"
                  size={20}
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
                  onPress={() =>
                    setError(null)
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer le message d'erreur"
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color="#E74C3C"
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* =================================================
                PROFILE
            ================================================= */}

            <View
              style={[
                styles.profileCard,

                {
                  backgroundColor:
                    themeColors.surface,

                  borderColor:
                    isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(15,23,42,0.05)',
                },
              ]}
            >
              {/* AVATAR */}
              <TouchableOpacity
                style={
                  styles.profileAvatarContainer
                }
                onPress={
                  handleUploadPhoto
                }
                disabled={
                  uploadingPhoto
                }
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Changer la photo de profil"
              >
                {profileImage ? (
                  <Image
                    source={{
                      uri: profileImage,
                    }}
                    style={
                      styles.profileAvatarImage
                    }
                  />
                ) : (
                  <View
                    style={[
                      styles.profileAvatar,
                      {
                        backgroundColor:
                          `${colors.primary}20`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.profileAvatarText,
                        {
                          color:
                            colors.primary,
                        },
                      ]}
                    >
                      {user?.fullname
                        ?.charAt(0)
                        ?.toUpperCase() ||
                        'A'}
                    </Text>
                  </View>
                )}

                {/* CAMERA BADGE */}
                <View
                  style={
                    styles.editBadge
                  }
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Ionicons
                      name="camera"
                      size={14}
                      color="#FFFFFF"
                    />
                  )}
                </View>
              </TouchableOpacity>

              {/* PROFILE INFO */}
              <View
                style={
                  styles.profileInfo
                }
              >
                <Text
                  style={[
                    styles.profileName,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {user?.fullname ||
                    'Administrateur'}
                </Text>

                <Text
                  style={[
                    styles.profileEmail,
                    {
                      color:
                        themeColors
                          .textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {user?.email ||
                    'admin@mada-bienetre.com'}
                </Text>

                <View
                  style={
                    styles.profileActions
                  }
                >
                  {/* ADMIN BADGE */}
                  <View
                    style={[
                      styles.profileBadge,
                      {
                        backgroundColor:
                          `${colors.primary}18`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={13}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={[
                        styles.profileBadgeText,
                        {
                          color:
                            colors.primary,
                        },
                      ]}
                    >
                      Administrateur
                    </Text>
                  </View>

                  {/* REMOVE PHOTO */}
                  {!!profileImage && (
                    <TouchableOpacity
                      style={[
                        styles.removePhotoBtn,
                        {
                          backgroundColor:
                            '#E74C3C15',
                        },
                      ]}
                      onPress={
                        requestRemovePhoto
                      }
                      disabled={
                        uploadingPhoto
                      }
                      hitSlop={6}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer la photo de profil"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color="#E74C3C"
                      />

                      <Text
                        style={[
                          styles.removePhotoText,
                          {
                            color:
                              '#E74C3C',
                          },
                        ]}
                      >
                        Supprimer
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* =================================================
                SETTINGS GRID
            ================================================= */}

            <View
              style={[
                styles.sectionsGrid,

                useTwoColumnGrid &&
                  styles.sectionsGridTwoCol,
              ]}
            >
              {settingSections.map(
                renderSectionCard
              )}
            </View>

            {/* =================================================
                ACTIONS
            ================================================= */}

            <View
              style={[
                styles.actionsRow,

                isTablet &&
                  styles.actionsRowDesktop,
              ]}
            >
              {/* SAVE */}
              <TouchableOpacity
                style={[
                  styles.saveButton,

                  isTablet &&
                    styles.saveButtonDesktop,

                  {
                    opacity:
                      isLoading
                        ? 0.7
                        : 1,
                  },
                ]}
                onPress={
                  handleSaveSettings
                }
                disabled={
                  isLoading
                }
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Enregistrer les paramètres"
              >
                <View
                  style={[
                    styles.saveGradient,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                      size="small"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="save-outline"
                        size={18}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.saveText
                        }
                      >
                        Enregistrer les paramètres
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* LOGOUT */}
              <TouchableOpacity
                style={[
                  styles.logoutButton,

                  isTablet &&
                    styles.logoutButtonDesktop,
                ]}
                onPress={() =>
                  setShowLogoutConfirm(
                    true
                  )
                }
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Se déconnecter"
              >
                <View
                  style={[
                    styles.logoutGradient,
                    {
                      backgroundColor:
                        isDark
                          ? 'rgba(231,76,60,0.14)'
                          : '#FDECEA',
                    },
                  ]}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={19}
                    color="#E53935"
                  />

                  <Text
                    style={[
                      styles.logoutText,
                      {
                        color:
                          '#E53935',
                      },
                    ]}
                  >
                    Se déconnecter
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* =================================================
                VERSION
            ================================================= */}

            <View
              style={
                styles.versionContainer
              }
            >
              <Text
                style={[
                  styles.versionText,
                  {
                    color:
                      themeColors
                        .textSecondary,
                  },
                ]}
              >
                Mada Bien-être v1.0.0
              </Text>

              <Text
                style={[
                  styles.versionSubtext,
                  {
                    color:
                      themeColors
                        .textSecondary,
                  },
                ]}
              >
                © 2026 Tous droits réservés
              </Text>
            </View>
          </View>
        </Animated.ScrollView>

        {/* ======================================================
            TOAST
        ====================================================== */}

        <Toast />

        {/* ======================================================
            LOGOUT CONFIRMATION
            ✅ ICON = LOG-OUT
        ====================================================== */}

        <ConfirmDialog
          visible={
            showLogoutConfirm
          }
          title="Déconnexion"
          message="Êtes-vous sûr de vouloir vous déconnecter de votre compte administrateur ?"
          confirmLabel="Se déconnecter"
          cancelLabel="Annuler"

          // IMPORTANT
          tone="logout"
          icon="log-out-outline"

          loading={
            isLoggingOut
          }

          onConfirm={
            handleLogout
          }

          onCancel={() =>
            isLoggingOut
              ? null
              : setShowLogoutConfirm(
                  false
                )
          }

          themeColors={
            themeColors
          }
        />

        {/* ======================================================
            REMOVE PHOTO CONFIRMATION
            ✅ ICON = TRASH
        ====================================================== */}

        <ConfirmDialog
          visible={
            showRemovePhotoConfirm
          }
          title="Supprimer la photo"
          message="Voulez-vous supprimer votre photo de profil ?"
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          tone="danger"
          icon="trash-outline"
          loading={
            uploadingPhoto
          }
          onConfirm={
            confirmRemovePhoto
          }
          onCancel={() =>
            uploadingPhoto
              ? null
              : setShowRemovePhotoConfirm(
                  false
                )
          }
          themeColors={
            themeColors
          }
        />
      </View>
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  // ==========================================================
  // GENERAL
  // ==========================================================

  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom:
      spacing.xl,
  },

  scrollContentDesktop: {
    paddingTop:
      spacing.md,

    paddingBottom:
      spacing.xxl || 48,
  },

  contentInner: {
    width: '100%',
  },

  // ==========================================================
  // ERROR
  // ==========================================================

  errorBanner: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop:
      spacing.sm,

    marginBottom:
      spacing.sm,

    padding:
      spacing.sm,

    borderRadius: 12,

    borderWidth: 1,

    gap: 8,
  },

  errorText: {
    flex: 1,

    fontSize:
      typography.fontSize.sm,

    color: '#E74C3C',

    fontFamily:
      typography.fontFamily.medium,
  },

  // ==========================================================
  // PROFILE
  // ==========================================================

  profileCard: {
    borderRadius: 20,

    borderWidth: 1,

    padding:
      spacing.md,

    flexDirection: 'row',

    alignItems: 'center',

    marginTop:
      spacing.md,

    marginBottom:
      spacing.md,

    ...(IS_WEB
      ? {
          boxShadow:
            '0 2px 8px rgba(15,23,42,0.07)',
        }
      : {
          shadowColor: '#000',

          shadowOffset: {
            width: 0,
            height: 2,
          },

          shadowOpacity: 0.06,

          shadowRadius: 5,

          elevation: 2,
        }),
  },

  profileAvatarContainer: {
    position: 'relative',

    marginRight:
      spacing.md,
  },

  profileAvatar: {
    width: 68,
    height: 68,

    borderRadius: 34,

    alignItems: 'center',

    justifyContent: 'center',
  },

  profileAvatarImage: {
    width: 68,
    height: 68,

    borderRadius: 34,
  },

  profileAvatarText: {
    fontSize:
      typography.fontSize.xxl,

    fontFamily:
      typography.fontFamily.bold,
  },

  editBadge: {
    position: 'absolute',

    bottom: -2,
    right: -2,

    backgroundColor:
      colors.primary,

    width: 27,
    height: 27,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,

    borderColor: '#FFFFFF',
  },

  profileInfo: {
    flex: 1,

    minWidth: 0,
  },

  profileName: {
    fontSize:
      typography.fontSize.lg,

    fontFamily:
      typography.fontFamily.bold,
  },

  profileEmail: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 2,
  },

  profileActions: {
    flexDirection: 'row',

    alignItems: 'center',

    flexWrap: 'wrap',

    gap: 7,

    marginTop: 8,
  },

  profileBadge: {
    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal:
      spacing.sm,

    paddingVertical: 4,

    borderRadius: 999,

    alignSelf: 'flex-start',

    gap: 4,
  },

  profileBadgeText: {
    fontSize: 11,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  removePhotoBtn: {
    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal:
      spacing.sm,

    paddingVertical: 4,

    borderRadius: 999,

    gap: 4,
  },

  removePhotoText: {
    fontSize: 11,

    fontFamily:
      typography.fontFamily.medium,
  },

  // ==========================================================
  // SECTIONS
  // ==========================================================

  sectionsGrid: {
    width: '100%',
  },

  sectionsGridTwoCol: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent:
      'space-between',
  },

  sectionCard: {
    width: '100%',

    borderRadius: 20,

    borderWidth: 1,

    padding:
      spacing.md,

    marginBottom:
      spacing.md,

    ...(IS_WEB
      ? {
          boxShadow:
            '0 2px 7px rgba(15,23,42,0.05)',
        }
      : {
          shadowColor: '#000',

          shadowOffset: {
            width: 0,
            height: 2,
          },

          shadowOpacity: 0.05,

          shadowRadius: 4,

          elevation: 2,
        }),
  },

  sectionCardGrid: {
    width: '48.5%',
  },

  sectionHeader: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    gap: spacing.sm,

    marginBottom:
      spacing.md,
  },

  sectionIconBadge: {
    width: 36,
    height: 36,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  sectionDescription: {
    fontSize:
      typography.fontSize.xs,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 3,

    lineHeight: 16,
  },

  settingRow: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    alignItems: 'center',

    paddingVertical:
      spacing.sm,

    borderBottomWidth: 1,

    gap: spacing.sm,
  },

  settingLabel: {
    flex: 1,

    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.regular,
  },

  // ==========================================================
  // INPUT
  // ==========================================================

  inputWrapper: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,
  },

  settingInput: {
    borderWidth: 1,

    borderRadius: 9,

    paddingHorizontal:
      spacing.sm,

    paddingVertical: 7,

    width: 90,

    minHeight: 38,

    textAlign: 'center',

    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.regular,
  },

  inputSuffix: {
    fontSize:
      typography.fontSize.xs,

    fontFamily:
      typography.fontFamily.medium,

    width: 25,
  },

  // ==========================================================
  // ACTIONS
  // ==========================================================

  actionsRow: {
    width: '100%',

    marginTop:
      spacing.sm,
  },

  actionsRowDesktop: {
    flexDirection: 'row',

    gap: spacing.md,
  },

  saveButton: {
    borderRadius: 13,

    overflow: 'hidden',

    marginTop:
      spacing.md,

    ...(IS_WEB
      ? {
          boxShadow:
            `0 5px 15px ${colors.primary}4D`,
        }
      : {
          shadowColor:
            colors.primary,

          shadowOffset: {
            width: 0,
            height: 4,
          },

          shadowOpacity: 0.3,

          shadowRadius: 8,

          elevation: 5,
        }),
  },

  saveButtonDesktop: {
    flex: 2,

    marginTop: 0,
  },

  saveGradient: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    paddingVertical:
      spacing.md,

    borderRadius: 13,
  },

  saveText: {
    color: '#FFFFFF',

    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.bold,
  },

  logoutButton: {
    borderRadius: 13,

    overflow: 'hidden',

    marginTop:
      spacing.md,
  },

  logoutButtonDesktop: {
    flex: 1,

    marginTop: 0,
  },

  logoutGradient: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    paddingVertical:
      spacing.md,

    gap: spacing.sm,

    borderRadius: 13,
  },

  logoutText: {
    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  // ==========================================================
  // VERSION
  // ==========================================================

  versionContainer: {
    alignItems: 'center',

    marginTop:
      spacing.lg,
  },

  versionText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,
  },

  versionSubtext: {
    fontSize:
      typography.fontSize.xs,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 2,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastWrapper: {
    position: 'absolute',

    top: 14,

    left: 0,
    right: 0,

    alignItems: 'center',

    zIndex: 9999,

    elevation: 9999,

    pointerEvents: 'none',
  },

  toast: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,

    maxWidth: 440,

    marginHorizontal: 16,

    paddingHorizontal: 17,

    paddingVertical: 13,

    borderRadius: 15,

    ...(IS_WEB
      ? {
          boxShadow:
            '0 9px 28px rgba(0,0,0,0.20)',
        }
      : {
          shadowColor: '#000',

          shadowOffset: {
            width: 0,
            height: 4,
          },

          shadowOpacity: 0.18,

          shadowRadius: 10,

          elevation: 6,
        }),
  },

  toastText: {
    color: '#FFFFFF',

    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.medium,

    flexShrink: 1,

    lineHeight: 19,
  },
});

export default SettingsScreen;