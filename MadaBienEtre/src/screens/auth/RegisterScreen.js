// src/screens/auth/RegisterScreen.js
// ============================================================
// REGISTER SCREEN — RESPONSIVE WEB / MOBILE
// ============================================================
// ✅ Desktop Web >= 1100px : interface 2 colonnes
// ✅ Web < 1100px          : interface Mobile / Android-like
// ✅ Android / iOS         : interface Mobile
// ✅ Header / zones vertes : #2E7D32
// ✅ Texte header vert     : blanc
// ✅ Responsive width / height
// ✅ ScrollView stable
// ✅ Keyboard handling Android
// ✅ Toast responsive
// ✅ Validation
// ✅ Password strength
// ✅ Role selection
// ✅ Dark mode
// ============================================================

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  TextInput,
  Dimensions,
  Easing,
  InteractionManager,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, typography } from '../../theme';

// ============================================================
// PLATFORM
// ============================================================

const isWeb = Platform.OS === 'web';
const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';

// ============================================================
// THEME
// ============================================================

const THEME_GREEN = '#2E7D32';
const THEME_GREEN_DARK = '#1B5E20';
const WHITE = '#FFFFFF';

// Desktop réel uniquement à partir de 1100px.
const DESKTOP_BREAKPOINT = 1100;

// ============================================================
// CUSTOM TOAST
// ============================================================

const CustomToast = ({
  visible,
  type = 'info',
  message,
  onDismiss,
  isDark = false,
}) => {
  const translateY = useRef(
    new Animated.Value(-90)
  ).current;

  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  const scale = useRef(
    new Animated.Value(0.96)
  ).current;

  const config = {
    success: {
      icon: 'checkmark-circle',
      title: 'Succès',
      background: isDark ? '#10251D' : '#ECFDF5',
      border: isDark ? '#176044' : '#A7F3D0',
      iconBackground: isDark ? '#123C2C' : '#D1FAE5',
      iconColor: '#059669',
      textColor: isDark ? '#A7F3D0' : '#065F46',
    },

    error: {
      icon: 'alert-circle',
      title: 'Erreur',
      background: isDark ? '#2B1515' : '#FEF2F2',
      border: isDark ? '#6B2525' : '#FECACA',
      iconBackground: isDark ? '#451B1B' : '#FEE2E2',
      iconColor: '#DC2626',
      textColor: isDark ? '#FECACA' : '#991B1B',
    },

    info: {
      icon: 'information-circle',
      title: 'Information',
      background: isDark ? '#142039' : '#EFF6FF',
      border: isDark ? '#284B82' : '#BFDBFE',
      iconBackground: isDark ? '#1C3155' : '#DBEAFE',
      iconColor: '#2563EB',
      textColor: isDark ? '#BFDBFE' : '#1E40AF',
    },

    warning: {
      icon: 'warning',
      title: 'Attention',
      background: isDark ? '#2B2412' : '#FFFBEB',
      border: isDark ? '#695416' : '#FDE68A',
      iconBackground: isDark ? '#433714' : '#FEF3C7',
      iconColor: '#D97706',
      textColor: isDark ? '#FDE68A' : '#92400E',
    },
  };

  const current = config[type] || config.info;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),

        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -90,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),

        Animated.timing(scale, {
          toValue: 0.96,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    visible,
    opacity,
    scale,
    translateY,
  ]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastContainer,
        {
          opacity,
          transform: [
            {
              translateY,
            },
            {
              scale,
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: current.background,
            borderColor: current.border,
          },
        ]}
      >
        <View
          style={[
            styles.toastIconContainer,
            {
              backgroundColor:
                current.iconBackground,
            },
          ]}
        >
          <Ionicons
            name={current.icon}
            size={22}
            color={current.iconColor}
          />
        </View>

        <View style={styles.toastContent}>
          <Text
            style={[
              styles.toastTitle,
              {
                color: current.textColor,
              },
            ]}
          >
            {current.title}
          </Text>

          <Text
            style={[
              styles.toastMessage,
              {
                color: current.textColor,
              },
            ]}
            numberOfLines={4}
          >
            {message}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          style={styles.toastClose}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
        >
          <Ionicons
            name="close"
            size={18}
            color={current.iconColor}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ============================================================
// PASSWORD STRENGTH
// ============================================================

const PasswordStrength = ({
  password,
  isDark,
}) => {
  const strength = useMemo(() => {
    if (!password) return null;

    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    if (
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password)
    ) {
      score++;
    }

    if (/\d/.test(password)) {
      score++;
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score++;
    }

    const levels = [
      {
        label: 'Faible',
        color: '#EF4444',
      },
      {
        label: 'Faible',
        color: '#EF4444',
      },
      {
        label: 'Moyen',
        color: '#F59E0B',
      },
      {
        label: 'Fort',
        color: '#10B981',
      },
      {
        label: 'Très fort',
        color: '#10B981',
      },
      {
        label: 'Excellent',
        color: '#059669',
      },
    ];

    return {
      score,
      ...levels[Math.min(score, 5)],
    };
  }, [password]);

  if (!strength) return null;

  return (
    <View style={styles.passwordStrength}>
      <View
        style={[
          styles.passwordStrengthTrack,
          {
            backgroundColor: isDark
              ? '#374151'
              : '#E5E7EB',
          },
        ]}
      >
        <View
          style={[
            styles.passwordStrengthProgress,
            {
              width: `${(strength.score / 5) * 100}%`,
              backgroundColor: strength.color,
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.passwordStrengthText,
          {
            color: strength.color,
          },
        ]}
      >
        {strength.label}
      </Text>
    </View>
  );
};

// ============================================================
// STEPS INDICATOR
// ============================================================

const StepsIndicator = ({
  currentStep,
  isDark,
}) => {
  const steps = [
    {
      title: 'Compte',
      icon: 'person-outline',
    },
    {
      title: 'Vérification',
      icon: 'mail-outline',
    },
    {
      title: 'Terminé',
      icon: 'checkmark-circle-outline',
    },
  ];

  return (
    <View style={styles.steps}>
      {steps.map((step, index) => {
        const completed = index < currentStep;
        const active = index === currentStep;

        return (
          <React.Fragment key={step.title}>
            <View style={styles.step}>
              <View
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor:
                      completed || active
                        ? THEME_GREEN
                        : isDark
                        ? '#2D2D3D'
                        : '#F3F4F6',

                    borderColor:
                      completed || active
                        ? THEME_GREEN
                        : isDark
                        ? '#374151'
                        : '#E5E7EB',
                  },
                ]}
              >
                {completed ? (
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color={WHITE}
                  />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={15}
                    color={
                      active
                        ? WHITE
                        : '#9CA3AF'
                    }
                  />
                )}
              </View>

              <Text
                style={[
                  styles.stepText,
                  {
                    color:
                      active || completed
                        ? THEME_GREEN
                        : '#9CA3AF',
                  },
                ]}
              >
                {step.title}
              </Text>
            </View>

            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor:
                      index < currentStep
                        ? THEME_GREEN
                        : isDark
                        ? '#374151'
                        : '#E5E7EB',
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ============================================================
// INPUT FIELD
// ============================================================

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  onFocus,
  onBlur,
  isDark,
  secureTextEntry,
  onToggleSecure,
  keyboardType,
  autoCapitalize = 'sentences',
  returnKeyType = 'next',
  onSubmitEditing,
  inputRef,
}) => {
  const borderColor = error
    ? '#EF4444'
    : isDark
    ? '#374151'
    : '#E5E7EB';

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text
          style={[
            styles.fieldLabel,
            {
              color: isDark
                ? '#E5E7EB'
                : '#1F2937',
            },
          ]}
        >
          {label}
        </Text>

        {error && (
          <Ionicons
            name="alert-circle"
            size={15}
            color="#EF4444"
          />
        )}
      </View>

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: isDark
              ? '#252535'
              : '#F9FAFB',
            borderColor,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            error
              ? '#EF4444'
              : '#9CA3AF'
          }
        />

        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: isDark
                ? WHITE
                : '#111827',
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={
            isDark
              ? '#6B7280'
              : '#9CA3AF'
          }
          onFocus={onFocus}
          onBlur={onBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          spellCheck={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={false}
          underlineColorAndroid="transparent"
          textAlignVertical="center"
          selectionColor={THEME_GREEN}
          cursorColor={THEME_GREEN}
        />

        {onToggleSecure && (
          <TouchableOpacity
            onPress={onToggleSecure}
            style={styles.eyeButton}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
          >
            <Ionicons
              name={
                secureTextEntry
                  ? 'eye-outline'
                  : 'eye-off-outline'
              }
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorRow}>
          <Ionicons
            name="information-circle-outline"
            size={13}
            color="#EF4444"
          />

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============================================================
// ROLE CARD
// ============================================================

const RoleCard = ({
  active,
  icon,
  title,
  description,
  onPress,
  isDark,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.roleCard,
        {
          backgroundColor: active
            ? THEME_GREEN + '08'
            : isDark
            ? '#252535'
            : WHITE,

          borderColor: active
            ? THEME_GREEN
            : isDark
            ? '#374151'
            : '#E5E7EB',
        },
      ]}
    >
      <View
        style={[
          styles.roleIcon,
          {
            backgroundColor: active
              ? THEME_GREEN + '14'
              : isDark
              ? '#303044'
              : '#F3F4F6',
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={23}
          color={
            active
              ? THEME_GREEN
              : '#9CA3AF'
          }
        />
      </View>

      <View style={styles.roleInfo}>
        <Text
          style={[
            styles.roleTitle,
            {
              color: isDark
                ? WHITE
                : '#111827',
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.roleDescription,
            {
              color: isDark
                ? '#9CA3AF'
                : '#6B7280',
            },
          ]}
        >
          {description}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          {
            borderColor: active
              ? THEME_GREEN
              : '#D1D5DB',
          },
        ]}
      >
        {active && (
          <View
            style={[
              styles.radioInner,
              {
                backgroundColor:
                  THEME_GREEN,
              },
            ]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// MAIN SCREEN
// ============================================================

const RegisterScreen = ({
  navigation,
}) => {
  const window = useWindowDimensions();

  const screenWidth =
    window?.width ||
    Dimensions.get('window').width;

  const screenHeight =
    window?.height ||
    Dimensions.get('window').height;

  // ==========================================================
  // RESPONSIVE MODE
  // ==========================================================

  const isDesktop =
    isWeb &&
    screenWidth >= DESKTOP_BREAKPOINT;

  const isMobileLayout =
    !isDesktop;

  const isVerySmall =
    screenWidth <= 380;

  const isTabletWeb =
    isWeb &&
    screenWidth >= 600 &&
    screenWidth < DESKTOP_BREAKPOINT;

  // ==========================================================
  // FORM STATE
  // ==========================================================

  const [formData, setFormData] =
    useState({
      fullname: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'CLIENT',
    });

  const [errors, setErrors] =
    useState({});

  const [isLoading, setIsLoading] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [toast, setToast] =
    useState({
      visible: false,
      type: 'info',
      message: '',
    });

  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  const [currentStep, setCurrentStep] =
    useState(0);

  const { register } = useAuth();
  const { isDark } = useTheme();

  // ==========================================================
  // ANIMATION
  // ==========================================================

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  const slideAnim = useRef(
    new Animated.Value(25)
  ).current;

  const toastTimer =
    useRef(null);

  // ==========================================================
  // SCROLL REFS
  // ==========================================================

  const mobileScrollRef =
    useRef(null);

  const desktopScrollRef =
    useRef(null);

  // ==========================================================
  // INPUT REFS
  // ==========================================================

  const fullnameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // ==========================================================
  // SCREEN ANIMATION
  // ==========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),

      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // ==========================================================
  // KEYBOARD
  // ==========================================================

  useEffect(() => {
    if (!isAndroid && !isWeb) {
      return undefined;
    }

    const showSubscription =
      Keyboard.addListener(
        'keyboardDidShow',
        () => {
          setKeyboardVisible(true);
        }
      );

    const hideSubscription =
      Keyboard.addListener(
        'keyboardDidHide',
        () => {
          setKeyboardVisible(false);
        }
      );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback(
    (type, message) => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast({
        visible: true,
        type,
        message,
      });

      toastTimer.current =
        setTimeout(() => {
          setToast(prev => ({
            ...prev,
            visible: false,
          }));
        }, 4500);
    },
    []
  );

  const dismissToast =
    useCallback(() => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast(prev => ({
        ...prev,
        visible: false,
      }));
    }, []);

  // ==========================================================
  // SCROLL TO INPUT
  // ==========================================================

  const scrollToInput = useCallback(
    inputRef => {
      if (
        !inputRef?.current ||
        !isMobileLayout
      ) {
        return;
      }

      const scrollView =
        mobileScrollRef.current;

      if (!scrollView) {
        return;
      }

      InteractionManager.runAfterInteractions(
        () => {
          setTimeout(() => {
            try {
              const responder =
                scrollView.getScrollResponder?.();

              if (
                responder &&
                responder.scrollResponderScrollNativeHandleToKeyboard
              ) {
                responder.scrollResponderScrollNativeHandleToKeyboard(
                  inputRef.current,
                  isAndroid ? 100 : 80,
                  true
                );

                return;
              }

              if (isWeb) {
                try {
                  inputRef.current?.measureInWindow?.(
                    (x, y, width, height) => {
                      const visibleHeight =
                        screenHeight * 0.72;

                      if (
                        y + height >
                        visibleHeight
                      ) {
                        scrollView.scrollTo({
                          y: Math.max(
                            0,
                            y -
                              visibleHeight +
                              height +
                              80
                          ),
                          animated: true,
                        });
                      }
                    }
                  );
                } catch (e) {
                  // Ignore fallback error.
                }
              }
            } catch (error) {
              console.log(
                'Scroll input error:',
                error
              );
            }
          }, 120);
        }
      );
    },
    [
      isMobileLayout,
      screenHeight,
    ]
  );

  // ==========================================================
  // FIELD FOCUS
  // ==========================================================

  const handleFieldFocus =
    useCallback(
      inputRef => {
        if (isMobileLayout) {
          scrollToInput(inputRef);
        }
      },
      [
        isMobileLayout,
        scrollToInput,
      ]
    );

  // ==========================================================
  // VALIDATE FIELD
  // ==========================================================

  const validateField = useCallback(
    (
      field,
      value,
      passwordValue = formData.password
    ) => {
      let message = '';

      switch (field) {
        case 'fullname':
          if (!value.trim()) {
            message =
              'Le nom complet est requis.';
          } else if (
            value.trim().length < 2
          ) {
            message =
              'Le nom doit contenir au moins 2 caractères.';
          }
          break;

        case 'email': {
          const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          if (!value.trim()) {
            message =
              "L'adresse email est requise.";
          } else if (
            !emailRegex.test(
              value.trim()
            )
          ) {
            message =
              'Veuillez saisir une adresse email valide.';
          }

          break;
        }

        case 'phone': {
          const cleanPhone =
            value.replace(/\s/g, '');

          if (!cleanPhone) {
            message =
              'Le numéro de téléphone est requis.';
          } else if (
            !/^[0-9+()-]{8,15}$/.test(
              cleanPhone
            )
          ) {
            message =
              'Veuillez saisir un numéro valide.';
          }

          break;
        }

        case 'password':
          if (!value) {
            message =
              'Le mot de passe est requis.';
          } else if (
            value.length < 8
          ) {
            message =
              'Le mot de passe doit contenir au moins 8 caractères.';
          }
          break;

        case 'confirmPassword':
          if (!value) {
            message =
              'Veuillez confirmer votre mot de passe.';
          } else if (
            value !== passwordValue
          ) {
            message =
              'Les mots de passe ne correspondent pas.';
          }
          break;

        default:
          break;
      }

      setErrors(prev => {
        const next = { ...prev };

        if (message) {
          next[field] = message;
        } else {
          delete next[field];
        }

        return next;
      });

      return !message;
    },
    [formData.password]
  );

  // ==========================================================
  // UPDATE FIELD
  // ==========================================================

  const updateField = useCallback(
    (field, value) => {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));

      setErrors(prev => {
        if (!prev[field]) {
          return prev;
        }

        const next = { ...prev };
        delete next[field];

        return next;
      });
    },
    []
  );

  // ==========================================================
  // VALIDATE FORM
  // ==========================================================

  const validateForm =
    useCallback(() => {
      const newErrors = {};

      const fullname =
        formData.fullname;

      const email =
        formData.email;

      const phone =
        formData.phone;

      const password =
        formData.password;

      const confirmPassword =
        formData.confirmPassword;

      // FULLNAME
      if (!fullname.trim()) {
        newErrors.fullname =
          'Le nom complet est requis.';
      } else if (
        fullname.trim().length < 2
      ) {
        newErrors.fullname =
          'Le nom doit contenir au moins 2 caractères.';
      }

      // EMAIL
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email.trim()) {
        newErrors.email =
          "L'adresse email est requise.";
      } else if (
        !emailRegex.test(
          email.trim()
        )
      ) {
        newErrors.email =
          'Veuillez saisir une adresse email valide.';
      }

      // PHONE
      const cleanPhone =
        phone.replace(/\s/g, '');

      if (!cleanPhone) {
        newErrors.phone =
          'Le numéro de téléphone est requis.';
      } else if (
        !/^[0-9+()-]{8,15}$/.test(
          cleanPhone
        )
      ) {
        newErrors.phone =
          'Veuillez saisir un numéro valide.';
      }

      // PASSWORD
      if (!password) {
        newErrors.password =
          'Le mot de passe est requis.';
      } else if (
        password.length < 8
      ) {
        newErrors.password =
          'Le mot de passe doit contenir au moins 8 caractères.';
      }

      // CONFIRM PASSWORD
      if (!confirmPassword) {
        newErrors.confirmPassword =
          'Veuillez confirmer votre mot de passe.';
      } else if (
        confirmPassword !== password
      ) {
        newErrors.confirmPassword =
          'Les mots de passe ne correspondent pas.';
      }

      setErrors(newErrors);

      return (
        Object.keys(newErrors).length === 0
      );
    }, [formData]);

  // ==========================================================
  // SCROLL TO TOP
  // ==========================================================

  const scrollToTop =
    useCallback(() => {
      if (isMobileLayout) {
        mobileScrollRef.current?.scrollTo({
          y: 0,
          animated: true,
        });
      } else {
        desktopScrollRef.current?.scrollTo({
          y: 0,
          animated: true,
        });
      }
    }, [isMobileLayout]);

  // ==========================================================
  // REGISTER
  // ==========================================================

  const handleRegister =
    async () => {
      Keyboard.dismiss();

      if (!validateForm()) {
        showToast(
          'error',
          'Veuillez corriger les informations indiquées avant de continuer.'
        );

        setTimeout(() => {
          scrollToTop();
        }, 150);

        return;
      }

      setIsLoading(true);
      setCurrentStep(1);
      dismissToast();

      try {
        const result =
          await register({
            fullname:
              formData.fullname.trim(),

            email:
              formData.email
                .trim()
                .toLowerCase(),

            phone:
              formData.phone.trim(),

            password:
              formData.password,

            role:
              formData.role,
          });

        if (result.success) {
          setCurrentStep(2);

          showToast(
            'success',
            'Votre compte a été créé. Vérifiez votre adresse email pour continuer.'
          );

          setTimeout(() => {
            navigation.navigate(
              'OTPVerification',
              {
                email:
                  formData.email
                    .trim()
                    .toLowerCase(),

                fullname:
                  formData.fullname.trim(),
              }
            );
          }, 1300);
        } else {
          setCurrentStep(0);

          showToast(
            'error',
            result.error ||
              "Impossible de créer votre compte. Veuillez réessayer."
          );
        }
      } catch (error) {
        console.error(
          'Register error:',
          error
        );

        setCurrentStep(0);

        showToast(
          'error',
          'Une erreur est survenue. Vérifiez votre connexion puis réessayez.'
        );
      } finally {
        setIsLoading(false);
      }
    };

  // ==========================================================
  // FORM
  // ==========================================================

  const renderForm = () => (
    <Animated.View
      style={[
        styles.formCard,
        isDesktop &&
          styles.formCardDesktop,
        isTabletWeb &&
          styles.formCardTablet,
        isVerySmall &&
          styles.formCardSmall,
        {
          backgroundColor: isDark
            ? '#1E1E2E'
            : WHITE,

          opacity: fadeAnim,

          transform: [
            {
              translateY: slideAnim,
            },
          ],
        },
      ]}
    >
      {/* ====================================================
          HEADER
      ==================================================== */}

      <View style={styles.formHeader}>
        <View
          style={[
            styles.formHeaderIcon,
            {
              backgroundColor: isDark
                ? '#252535'
                : '#F0F7F0',
            },
          ]}
        >
          <Ionicons
            name="person-add-outline"
            size={24}
            color={THEME_GREEN}
          />
        </View>

        <Text
          style={[
            styles.formTitle,
            isVerySmall &&
              styles.formTitleSmall,
            {
              color: isDark
                ? WHITE
                : '#111827',
            },
          ]}
        >
          Créer votre compte
        </Text>

        <Text
          style={[
            styles.formDescription,
            {
              color: isDark
                ? '#9CA3AF'
                : '#6B7280',
            },
          ]}
        >
          Quelques informations suffisent
          pour commencer votre expérience
          bien-être.
        </Text>
      </View>

      {/* STEPS */}

      <StepsIndicator
        currentStep={currentStep}
        isDark={isDark}
      />

      {/* FULL NAME */}

      <Field
        inputRef={fullnameRef}
        label="Nom complet"
        icon="person-outline"
        value={formData.fullname}
        onChangeText={text =>
          updateField(
            'fullname',
            text
          )
        }
        placeholder="Ex. Jean Rakoto"
        error={errors.fullname}
        onFocus={() =>
          handleFieldFocus(
            fullnameRef
          )
        }
        onBlur={() =>
          validateField(
            'fullname',
            formData.fullname
          )
        }
        isDark={isDark}
        returnKeyType="next"
        onSubmitEditing={() =>
          emailRef.current?.focus()
        }
      />

      {/* EMAIL */}

      <Field
        inputRef={emailRef}
        label="Adresse email"
        icon="mail-outline"
        value={formData.email}
        onChangeText={text =>
          updateField(
            'email',
            text
          )
        }
        placeholder="exemple@email.com"
        error={errors.email}
        onFocus={() =>
          handleFieldFocus(
            emailRef
          )
        }
        onBlur={() =>
          validateField(
            'email',
            formData.email
          )
        }
        isDark={isDark}
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() =>
          phoneRef.current?.focus()
        }
      />

      {/* PHONE */}

      <Field
        inputRef={phoneRef}
        label="Numéro de téléphone"
        icon="call-outline"
        value={formData.phone}
        onChangeText={text =>
          updateField(
            'phone',
            text
          )
        }
        placeholder="034 00 000 00"
        error={errors.phone}
        onFocus={() =>
          handleFieldFocus(
            phoneRef
          )
        }
        onBlur={() =>
          validateField(
            'phone',
            formData.phone
          )
        }
        isDark={isDark}
        keyboardType="phone-pad"
        returnKeyType="next"
        onSubmitEditing={() =>
          passwordRef.current?.focus()
        }
      />

      {/* PASSWORD */}

      <Field
        inputRef={passwordRef}
        label="Mot de passe"
        icon="lock-closed-outline"
        value={formData.password}
        onChangeText={text =>
          updateField(
            'password',
            text
          )
        }
        placeholder="Minimum 8 caractères"
        error={errors.password}
        onFocus={() =>
          handleFieldFocus(
            passwordRef
          )
        }
        onBlur={() =>
          validateField(
            'password',
            formData.password
          )
        }
        isDark={isDark}
        secureTextEntry={!showPassword}
        onToggleSecure={() =>
          setShowPassword(
            prev => !prev
          )
        }
        returnKeyType="next"
        onSubmitEditing={() =>
          confirmPasswordRef.current?.focus()
        }
      />

      <PasswordStrength
        password={formData.password}
        isDark={isDark}
      />

      {/* CONFIRM PASSWORD */}

      <Field
        inputRef={confirmPasswordRef}
        label="Confirmer le mot de passe"
        icon="shield-checkmark-outline"
        value={formData.confirmPassword}
        onChangeText={text =>
          updateField(
            'confirmPassword',
            text
          )
        }
        placeholder="Saisissez à nouveau votre mot de passe"
        error={errors.confirmPassword}
        onFocus={() =>
          handleFieldFocus(
            confirmPasswordRef
          )
        }
        onBlur={() =>
          validateField(
            'confirmPassword',
            formData.confirmPassword,
            formData.password
          )
        }
        isDark={isDark}
        secureTextEntry={
          !showConfirmPassword
        }
        onToggleSecure={() =>
          setShowConfirmPassword(
            prev => !prev
          )
        }
        returnKeyType="done"
        onSubmitEditing={
          handleRegister
        }
      />

      {/* ROLE */}

      <View style={styles.roleSection}>
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: isDark
                  ? '#E5E7EB'
                  : '#1F2937',
              },
            ]}
          >
            Type de compte
          </Text>

          <Text
            style={[
              styles.sectionHint,
              {
                color: isDark
                  ? '#6B7280'
                  : '#9CA3AF',
              },
            ]}
          >
            Choisissez votre profil
          </Text>
        </View>

        <View
          style={[
            styles.roleList,
            isDesktop &&
              styles.roleListWeb,
          ]}
        >
          <RoleCard
            active={
              formData.role ===
              'CLIENT'
            }
            icon="person-outline"
            title="Client"
            description="Je souhaite réserver un massage"
            onPress={() =>
              updateField(
                'role',
                'CLIENT'
              )
            }
            isDark={isDark}
          />

          <RoleCard
            active={
              formData.role ===
              'THERAPIST'
            }
            icon="medical-outline"
            title="Thérapeute"
            description="Je propose mes services de massage"
            onPress={() =>
              updateField(
                'role',
                'THERAPIST'
              )
            }
            isDark={isDark}
          />
        </View>
      </View>

      {/* CTA */}

      <TouchableOpacity
        style={[
          styles.registerButton,
          isLoading &&
            styles.registerButtonDisabled,
        ]}
        onPress={handleRegister}
        disabled={isLoading}
        activeOpacity={0.88}
      >
        <View
          style={styles.registerGradient}
        >
          {isLoading ? (
            <>
              <ActivityIndicator
                color={WHITE}
                size="small"
              />

              <Text
                style={
                  styles.registerButtonText
                }
              >
                Création du compte...
              </Text>
            </>
          ) : (
            <>
              <Text
                style={
                  styles.registerButtonText
                }
              >
                Créer mon compte
              </Text>

              <View
                style={styles.buttonIcon}
              >
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={WHITE}
                />
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>

      {/* TERMS */}

      <Text
        style={[
          styles.termsText,
          {
            color: isDark
              ? '#6B7280'
              : '#9CA3AF',
          },
        ]}
      >
        En créant votre compte, vous
        acceptez nos conditions
        d'utilisation et notre politique
        de confidentialité.
      </Text>

      {/* LOGIN */}

      <View style={styles.loginContainer}>
        <Text
          style={[
            styles.loginText,
            {
              color: isDark
                ? '#9CA3AF'
                : '#6B7280',
            },
          ]}
        >
          Vous avez déjà un compte ?
        </Text>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate(
              'Login'
            )
          }
          style={
            styles.loginButtonLink
          }
        >
          <Text style={styles.loginLink}>
            Se connecter
          </Text>

          <Ionicons
            name="arrow-forward"
            size={14}
            color={THEME_GREEN}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ==========================================================
  // MOBILE / TABLET WEB
  // ==========================================================

  const renderMobile = () => (
    <KeyboardAvoidingView
      behavior={
        isIOS
          ? 'padding'
          : isAndroid
          ? 'height'
          : undefined
      }
      keyboardVerticalOffset={
        isIOS ? 0 : 0
      }
      style={[
        styles.keyboardView,
        {
          backgroundColor: isDark
            ? '#121212'
            : '#F8FAFC',
        },
      ]}
    >
      <TouchableWithoutFeedback
        onPress={Keyboard.dismiss}
        accessible={false}
      >
        <ScrollView
          ref={mobileScrollRef}
          style={[
            styles.mobileScrollView,
            {
              backgroundColor: isDark
                ? '#121212'
                : '#F8FAFC',
            },
          ]}
          contentContainerStyle={[
            styles.mobileScroll,
            isTabletWeb &&
              styles.mobileScrollTablet,
            {
              paddingBottom:
                keyboardVisible
                  ? 300
                  : isVerySmall
                  ? 35
                  : 50,
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={
            isIOS
              ? 'interactive'
              : 'on-drag'
          }
          nestedScrollEnabled
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          bounces
        >
          {/* ==================================================
              MOBILE HEADER
          ================================================== */}

          <View
            style={[
              styles.mobileHeader,
              isVerySmall &&
                styles.mobileHeaderSmall,
              isTabletWeb &&
                styles.mobileHeaderTablet,
            ]}
          >
            <TouchableOpacity
              onPress={() =>
                navigation.goBack()
              }
              style={
                styles.mobileBackButton
              }
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
            >
              <Ionicons
                name="arrow-back"
                size={23}
                color={WHITE}
              />
            </TouchableOpacity>

            <View
              style={
                styles.mobileBrandRow
              }
            >
              <View
                style={
                  styles.mobileLogo
                }
              >
                <Ionicons
                  name="leaf-outline"
                  size={27}
                  color={WHITE}
                />
              </View>

              <Text
                style={
                  styles.mobileBrandName
                }
              >
                Mada Bien-être
              </Text>
            </View>

            <View
              style={
                styles.mobileHeaderContent
              }
            >
              <Text
                style={[
                  styles.mobileHeaderTitle,
                  isVerySmall &&
                    styles.mobileHeaderTitleSmall,
                ]}
              >
                Créer un compte
              </Text>

              <Text
                style={
                  styles.mobileHeaderSubtitle
                }
              >
                Commencez votre expérience
                Mada Bien-être
              </Text>
            </View>
          </View>

          {/* FORM */}

          {renderForm()}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );

  // ==========================================================
  // DESKTOP WEB
  // ==========================================================

  const renderDesktop = () => (
    <View
      style={[
        styles.desktopContainer,
        {
          backgroundColor: isDark
            ? '#111111'
            : WHITE,
        },
      ]}
    >
      {/* ====================================================
          LEFT BRAND PANEL
      ==================================================== */}

      <View
        style={styles.desktopBrand}
      >
        <View
          style={
            styles.desktopBrandGradient
          }
        >
          <View
            style={
              styles.desktopBrandTop
            }
          >
            <View
              style={styles.brandLogo}
            >
              <Ionicons
                name="leaf-outline"
                size={30}
                color={WHITE}
              />
            </View>

            <Text
              style={styles.brandName}
            >
              Mada Bien-être
            </Text>
          </View>

          <View
            style={
              styles.desktopBrandMiddle
            }
          >
            <Text
              style={
                styles.desktopBrandTitle
              }
            >
              Votre bien-être,
              {'\n'}
              commence ici.
            </Text>

            <Text
              style={
                styles.desktopBrandDescription
              }
            >
              Retrouvez votre espace personnel
              et profitez d'une expérience de
              massage à domicile simple,
              sécurisée et personnalisée.
            </Text>

            <View
              style={styles.featureList}
            >
              {[
                {
                  icon: 'location-outline',
                  title:
                    'Thérapeutes à proximité',
                  description:
                    'Trouvez facilement un professionnel près de vous.',
                },
                {
                  icon: 'calendar-outline',
                  title:
                    'Réservation simplifiée',
                  description:
                    'Organisez vos séances directement depuis votre compte.',
                },
                {
                  icon: 'shield-checkmark-outline',
                  title:
                    'Expérience sécurisée',
                  description:
                    'Vos données personnelles restent protégées.',
                },
              ].map(item => (
                <View
                  key={item.title}
                  style={
                    styles.featureItem
                  }
                >
                  <View
                    style={
                      styles.featureIcon
                    }
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={WHITE}
                    />
                  </View>

                  <View
                    style={
                      styles.featureContent
                    }
                  >
                    <Text
                      style={
                        styles.featureTitle
                      }
                    >
                      {item.title}
                    </Text>

                    <Text
                      style={
                        styles.featureDescription
                      }
                    >
                      {item.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View
            style={
              styles.desktopFooter
            }
          >
            <Text
              style={
                styles.desktopCopyright
              }
            >
              © 2026 Mada Bien-être
            </Text>

            <Text
              style={
                styles.desktopFooterRight
              }
            >
              Bien-être • Confiance • Proximité
            </Text>
          </View>
        </View>
      </View>

      {/* ====================================================
          RIGHT FORM
      ==================================================== */}

      <View
        style={[
          styles.desktopRight,
          {
            backgroundColor: isDark
              ? '#121212'
              : WHITE,
          },
        ]}
      >
        <ScrollView
          ref={desktopScrollRef}
          style={
            styles.desktopFormScroll
          }
          contentContainerStyle={
            styles.desktopFormScrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="always"
          removeClippedSubviews={false}
        >
          <View
            style={
              styles.desktopFormWrapper
            }
          >
            <TouchableOpacity
              onPress={() =>
                navigation.goBack()
              }
              style={
                styles.desktopBack
              }
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
            >
              <Ionicons
                name="arrow-back"
                size={18}
                color={
                  isDark
                    ? WHITE
                    : '#64748B'
                }
              />

              <Text
                style={[
                  styles.desktopBackText,
                  {
                    color: isDark
                      ? WHITE
                      : '#64748B',
                  },
                ]}
              >
                Retour
              </Text>
            </TouchableOpacity>

            {renderForm()}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  // ==========================================================
  // RETURN
  // ==========================================================

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: isDark
            ? '#121212'
            : WHITE,
        },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={THEME_GREEN}
        translucent={false}
      />

      <CustomToast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={dismissToast}
        isDark={isDark}
      />

      {isDesktop
        ? renderDesktop()
        : renderMobile()}
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  // ==========================================================
  // GLOBAL
  // ==========================================================

  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  keyboardView: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastContainer: {
    position: 'absolute',
    top: isWeb ? 18 : 12,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },

  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 68,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,

    elevation: 10,
  },

  toastIconContainer: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  toastContent: {
    flex: 1,
    marginLeft: 11,
    marginRight: 7,
    minWidth: 0,
  },

  toastTitle: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.bold,
    marginBottom: 2,
  },

  toastMessage: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.regular,
  },

  toastClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ==========================================================
  // MOBILE SCROLL
  // ==========================================================

  mobileScrollView: {
    flex: 1,
    width: '100%',
  },

  mobileScroll: {
    flexGrow: 1,
    minHeight: '100%',
    width: '100%',
  },

  mobileScrollTablet: {
    alignItems: 'center',
  },

  // ==========================================================
  // MOBILE HEADER
  // ==========================================================

  mobileHeader: {
    width: '100%',
    minHeight: 235,
    paddingHorizontal: 22,
    paddingTop:
      Platform.OS === 'ios'
        ? 28
        : 42,
    paddingBottom: 34,

    backgroundColor: THEME_GREEN,

    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  mobileHeaderTablet: {
    paddingHorizontal: 40,
    paddingTop: 35,
  },

  mobileHeaderSmall: {
    minHeight: 215,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 28,
  },

  mobileBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  mobileLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor:
      'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  mobileBrandName: {
    color: WHITE,
    fontSize: 19,
    fontFamily:
      typography.fontFamily.bold,
  },

  mobileHeaderContent: {
    marginTop: 24,
  },

  mobileHeaderTitle: {
    color: WHITE,
    fontSize: 27,
    lineHeight: 33,
    fontFamily:
      typography.fontFamily.bold,
  },

  mobileHeaderTitleSmall: {
    fontSize: 24,
    lineHeight: 30,
  },

  mobileHeaderSubtitle: {
    color:
      'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    fontFamily:
      typography.fontFamily.regular,
    marginTop: 5,
  },

  // ==========================================================
  // FORM
  // ==========================================================

  formCard: {
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 27,
    paddingBottom: 40,
  },

  formCardDesktop: {
    paddingHorizontal: 0,
    paddingTop: 15,
    paddingBottom: 40,
  },

  formCardTablet: {
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 32,
  },

  formCardSmall: {
    paddingHorizontal: 17,
    paddingTop: 23,
    paddingBottom: 32,
  },

  formHeader: {
    marginBottom: 20,
  },

  formHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  formTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontFamily:
      typography.fontFamily.bold,
    marginBottom: 6,
  },

  formTitleSmall: {
    fontSize: 23,
    lineHeight: 29,
  },

  formDescription: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily:
      typography.fontFamily.regular,
    maxWidth: 560,
  },

  // ==========================================================
  // STEPS
  // ==========================================================

  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 22,
  },

  step: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepText: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.medium,
    marginLeft: 6,
  },

  stepLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
    minWidth: 10,
  },

  // ==========================================================
  // INPUT
  // ==========================================================

  fieldGroup: {
    marginBottom: 15,
    width: '100%',
  },

  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  fieldLabel: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.medium,
  },

  inputWrapper: {
    width: '100%',
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily:
      typography.fontFamily.regular,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 52,

    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          outlineWidth: 0,
        }
      : {}),
  },

  eyeButton: {
    padding: 5,
    flexShrink: 0,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
  },

  errorText: {
    color: '#EF4444',
    fontSize: 12,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.regular,
    marginLeft: 4,
    flex: 1,
  },

  // ==========================================================
  // PASSWORD
  // ==========================================================

  passwordStrength: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -5,
    marginBottom: 14,
  },

  passwordStrengthTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },

  passwordStrengthProgress: {
    height: '100%',
    borderRadius: 2,
  },

  passwordStrengthText: {
    width: 65,
    textAlign: 'right',
    fontSize: 11,
    fontFamily:
      typography.fontFamily.medium,
    marginLeft: 8,
  },

  // ==========================================================
  // ROLE
  // ==========================================================

  roleSection: {
    marginTop: 2,
    marginBottom: 20,
    width: '100%',
  },

  sectionHeader: {
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.medium,
  },

  sectionHint: {
    fontSize: 11,
    marginTop: 2,
    fontFamily:
      typography.fontFamily.regular,
  },

  roleList: {
    width: '100%',
    gap: 10,
  },

  roleListWeb: {
    flexDirection: 'row',
  },

  roleCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 13,
    borderWidth: 1,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  roleIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  roleInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 7,
  },

  roleTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.bold,
  },

  roleDescription: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily:
      typography.fontFamily.regular,
    marginTop: 2,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // ==========================================================
  // BUTTON
  // ==========================================================

  registerButton: {
    width: '100%',
    borderRadius: 13,
    overflow: 'hidden',
    marginTop: 2,

    backgroundColor: THEME_GREEN,

    shadowColor: THEME_GREEN,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.22,
    shadowRadius: 10,

    elevation: 5,
  },

  registerButtonDisabled: {
    opacity: 0.75,
  },

  registerGradient: {
    minHeight: 55,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: THEME_GREEN,
  },

  registerButtonText: {
    color: WHITE,
    fontSize: 15,
    fontFamily:
      typography.fontFamily.bold,
    marginLeft: 8,
  },

  buttonIcon: {
    marginLeft: 9,
  },

  // ==========================================================
  // TERMS
  // ==========================================================

  termsText: {
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 16,
    fontFamily:
      typography.fontFamily.regular,
    marginTop: 13,
    paddingHorizontal: 8,
  },

  // ==========================================================
  // LOGIN
  // ==========================================================

  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 18,
  },

  loginText: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.regular,
  },

  loginButtonLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5,
    paddingVertical: 3,
  },

  loginLink: {
    color: THEME_GREEN,
    fontSize: 13,
    fontFamily:
      typography.fontFamily.bold,
    marginRight: 3,
  },

  // ==========================================================
  // DESKTOP
  // ==========================================================

  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    minHeight: 0,
  },

  desktopBrand: {
    width: '50%',
    minWidth: 0,
    height: '100%',
    backgroundColor: THEME_GREEN,
  },

  desktopBrandGradient: {
    flex: 1,
    paddingHorizontal: 58,
    paddingVertical: 54,
    justifyContent: 'space-between',
    minHeight: 0,
    backgroundColor: THEME_GREEN,
  },

  desktopBrandTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  brandLogo: {
    width: 59,
    height: 59,
    borderRadius: 17,
    backgroundColor:
      'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  brandName: {
    color: WHITE,
    fontSize: 22,
    fontFamily:
      typography.fontFamily.bold,
  },

  desktopBrandMiddle: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },

  desktopBrandTitle: {
    color: WHITE,
    fontSize: 42,
    lineHeight: 52,
    fontFamily:
      typography.fontFamily.bold,
    marginBottom: 22,
  },

  desktopBrandDescription: {
    color:
      'rgba(255,255,255,0.90)',
    fontSize: 15,
    lineHeight: 24,
    fontFamily:
      typography.fontFamily.regular,
    maxWidth: 570,
  },

  // ==========================================================
  // FEATURES
  // ==========================================================

  featureList: {
    marginTop: 45,
    gap: 18,
  },

  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  featureIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    backgroundColor:
      'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  featureContent: {
    flex: 1,
    minWidth: 0,
  },

  featureTitle: {
    color: WHITE,
    fontSize: 14,
    fontFamily:
      typography.fontFamily.bold,
    marginBottom: 3,
  },

  featureDescription: {
    color:
      'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily:
      typography.fontFamily.regular,
  },

  // ==========================================================
  // DESKTOP FOOTER
  // ==========================================================

  desktopFooter: {
    borderTopWidth: 1,
    borderTopColor:
      'rgba(255,255,255,0.22)',
    paddingTop: 19,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  desktopCopyright: {
    color:
      'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontFamily:
      typography.fontFamily.regular,
  },

  desktopFooterRight: {
    color:
      'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontFamily:
      typography.fontFamily.regular,
  },

  // ==========================================================
  // DESKTOP RIGHT
  // ==========================================================

  desktopRight: {
    width: '50%',
    minWidth: 0,
    height: '100%',
    flex: 1,
  },

  desktopFormScroll: {
    flex: 1,
    width: '100%',
  },

  desktopFormScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 58,
    paddingVertical: 45,
  },

  desktopFormWrapper: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },

  desktopBack: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 5,
  },

  desktopBackText: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.medium,
    marginLeft: 7,
  },
});

// ============================================================
// EXPORT
// ============================================================

export default RegisterScreen;