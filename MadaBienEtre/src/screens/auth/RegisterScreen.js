// src/screens/auth/RegisterScreen.js
// ============================================================
// MADA BIEN-ÊTRE — REGISTER SCREEN
// Responsive Web + Android + iOS
//
// Design:
// - Même esprit moderne que WelcomeScreen
// - Desktop : panneau vert + formulaire compact
// - Tablet : formulaire centré
// - Mobile/Android : header compact + formulaire scrollable
// - Keyboard Android : le formulaire reste accessible
// - Validation + force du mot de passe
// - Choix Client / Thérapeute
// - Toast
// - Dark mode
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../theme';
import AppHeader from '../../components/common/AppHeader';

// ============================================================
// CONSTANTES
// ============================================================

const GREEN = '#2E7D32';
const GREEN_LIGHT = '#EAF5EC';
const WHITE = '#FFFFFF';

const DESKTOP_BREAKPOINT = 1100;
const TABLET_BREAKPOINT = 700;

// ============================================================
// TOAST
// ============================================================

const CustomToast = ({
  visible,
  type = 'info',
  message,
  onDismiss,
  isDark = false,
}) => {
  const translateY = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

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
  }, [visible, opacity, scale, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastContainer,
        {
          opacity,
          transform: [{ translateY }, { scale }],
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
            styles.toastIcon,
            { backgroundColor: current.iconBackground },
          ]}
        >
          <Ionicons
            name={current.icon}
            size={21}
            color={current.iconColor}
          />
        </View>

        <View style={styles.toastContent}>
          <Text
            style={[
              styles.toastTitle,
              { color: current.textColor },
            ]}
          >
            {current.title}
          </Text>

          <Text
            style={[
              styles.toastMessage,
              { color: current.textColor },
            ]}
            numberOfLines={4}
          >
            {message}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          style={styles.toastClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

const PasswordStrength = ({ password, isDark }) => {
  const strength = useMemo(() => {
    if (!password) return null;

    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const levels = [
      { label: 'Très faible', color: '#EF4444' },
      { label: 'Faible', color: '#EF4444' },
      { label: 'Moyen', color: '#F59E0B' },
      { label: 'Fort', color: '#10B981' },
      { label: 'Très fort', color: '#10B981' },
      { label: 'Excellent', color: '#059669' },
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
          styles.passwordTrack,
          {
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
          },
        ]}
      >
        <View
          style={[
            styles.passwordProgress,
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
          { color: strength.color },
        ]}
      >
        {strength.label}
      </Text>
    </View>
  );
};

// ============================================================
// STEPS
// ============================================================

const StepsIndicator = ({ currentStep, isDark }) => {
  const steps = [
    { title: 'Compte', icon: 'person-outline' },
    { title: 'Vérification', icon: 'mail-outline' },
    { title: 'Terminé', icon: 'checkmark-circle-outline' },
  ];

  return (
    <View style={styles.steps}>
      {steps.map((step, index) => {
        const completed = index < currentStep;
        const active = index === currentStep;

        return (
          <React.Fragment key={step.title}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor:
                      completed || active
                        ? GREEN
                        : isDark
                        ? '#303044'
                        : '#F3F4F6',
                    borderColor:
                      completed || active
                        ? GREEN
                        : isDark
                        ? '#454557'
                        : '#E5E7EB',
                  },
                ]}
              >
                {completed ? (
                  <Ionicons name="checkmark" size={14} color={WHITE} />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={14}
                    color={active ? WHITE : '#9CA3AF'}
                  />
                )}
              </View>

              <Text
                style={[
                  styles.stepText,
                  {
                    color:
                      active || completed
                        ? GREEN
                        : isDark
                        ? '#6B7280'
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
                        ? GREEN
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
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text
          style={[
            styles.fieldLabel,
            { color: isDark ? '#E5E7EB' : '#1F2937' },
          ]}
        >
          {label}
        </Text>

        {error ? (
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
        ) : null}
      </View>

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: isDark ? '#252535' : '#F8FAF8',
            borderColor: error
              ? '#EF4444'
              : isDark
              ? '#3A3A4B'
              : '#E1E9E2',
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={error ? '#EF4444' : GREEN}
        />

        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: isDark ? WHITE : '#17201A',
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
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
          selectionColor={GREEN}
          cursorColor={GREEN}
        />

        {onToggleSecure ? (
          <TouchableOpacity
            onPress={onToggleSecure}
            style={styles.eyeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'}
              size={19}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons
            name="information-circle-outline"
            size={12}
            color="#EF4444"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
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
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[
      styles.roleCard,
      {
        backgroundColor: active
          ? isDark
            ? '#16331D'
            : '#F0F8F1'
          : isDark
          ? '#252535'
          : WHITE,
        borderColor: active
          ? GREEN
          : isDark
          ? '#3A3A4B'
          : '#E1E9E2',
      },
    ]}
  >
    <View
      style={[
        styles.roleIcon,
        {
          backgroundColor: active
            ? isDark
              ? '#204A29'
              : '#E2F2E4'
            : isDark
            ? '#303044'
            : '#F4F6F4',
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={21}
        color={active ? GREEN : '#8A948C'}
      />
    </View>

    <View style={styles.roleInfo}>
      <Text
        style={[
          styles.roleTitle,
          { color: isDark ? WHITE : '#17201A' },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.roleDescription,
          { color: isDark ? '#9CA3AF' : '#66736A' },
        ]}
      >
        {description}
      </Text>
    </View>

    <View
      style={[
        styles.radio,
        { borderColor: active ? GREEN : '#D1D5DB' },
      ]}
    >
      {active ? <View style={styles.radioInner} /> : null}
    </View>
  </TouchableOpacity>
);

// ============================================================
// MAIN
// ============================================================

const RegisterScreen = ({ navigation }) => {
  const window = useWindowDimensions();

  const insets = useSafeAreaInsets();

  const width = window?.width || Dimensions.get('window').width;
  const height = window?.height || Dimensions.get('window').height;

  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const isTablet =
    width >= TABLET_BREAKPOINT && width < DESKTOP_BREAKPOINT;
  const isSmallPhone = width <= 380;
  const isMobileLayout = !isDesktop;

  const { register } = useAuth();
  const { isDark } = useTheme();

  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'CLIENT',
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    type: 'info',
    message: '',
  });

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(22)).current;
  const toastTimer = useRef(null);

  const scrollRef = useRef(null);

  const fullnameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // ----------------------------------------------------------
  // INTRO ANIMATION
  // ----------------------------------------------------------

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [fadeAnim, slideAnim]);

  // ----------------------------------------------------------
  // KEYBOARD
  // ----------------------------------------------------------

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ----------------------------------------------------------
  // TOAST
  // ----------------------------------------------------------

  const showToast = useCallback((type, message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);

    setToast({
      visible: true,
      type,
      message,
    });

    toastTimer.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);

    setToast(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    setErrors(prev => {
      if (!prev[field]) return prev;

      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  const getFieldError = useCallback(
    (field, value, passwordValue = formData.password) => {
      const clean = String(value ?? '');

      switch (field) {
        case 'fullname':
          if (!clean.trim()) return 'Le nom complet est requis.';
          if (clean.trim().length < 2) {
            return 'Le nom doit contenir au moins 2 caractères.';
          }
          return '';

        case 'email': {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          if (!clean.trim()) return "L'adresse email est requise.";
          if (!emailRegex.test(clean.trim())) {
            return 'Veuillez saisir une adresse email valide.';
          }
          return '';
        }

        case 'phone': {
          const phone = clean.replace(/\s/g, '');

          if (!phone) return 'Le numéro de téléphone est requis.';
          if (!/^[0-9+()-]{8,15}$/.test(phone)) {
            return 'Veuillez saisir un numéro de téléphone valide.';
          }
          return '';
        }

        case 'password':
          if (!clean) return 'Le mot de passe est requis.';
          if (clean.length < 8) {
            return 'Le mot de passe doit contenir au moins 8 caractères.';
          }
          return '';

        case 'confirmPassword':
          if (!clean) return 'Veuillez confirmer votre mot de passe.';
          if (clean !== passwordValue) {
            return 'Les mots de passe ne correspondent pas.';
          }
          return '';

        default:
          return '';
      }
    },
    [formData.password]
  );

  const validateField = useCallback(
    (field, value, passwordValue = formData.password) => {
      const message = getFieldError(field, value, passwordValue);

      setErrors(prev => {
        const next = { ...prev };

        if (message) next[field] = message;
        else delete next[field];

        return next;
      });

      return !message;
    },
    [formData.password, getFieldError]
  );

  const validateForm = useCallback(() => {
    const newErrors = {};

    const fields = [
      ['fullname', formData.fullname],
      ['email', formData.email],
      ['phone', formData.phone],
      ['password', formData.password],
      ['confirmPassword', formData.confirmPassword],
    ];

    fields.forEach(([field, value]) => {
      const error = getFieldError(
        field,
        value,
        formData.password
      );

      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }, [formData, getFieldError]);

  // ----------------------------------------------------------
  // SCROLL — IMPORTANT POUR ANDROID
  // ----------------------------------------------------------

  const scrollToInput = useCallback(
    inputRef => {
      if (!isMobileLayout || !inputRef?.current) return;

      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          try {
            const scrollView = scrollRef.current;
            if (!scrollView) return;

            const responder = scrollView.getScrollResponder?.();

            if (
              responder &&
              responder.scrollResponderScrollNativeHandleToKeyboard
            ) {
              responder.scrollResponderScrollNativeHandleToKeyboard(
                inputRef.current,
                Platform.OS === 'android' ? 150 : 90,
                true
              );
              return;
            }

            // Fallback Web
            if (Platform.OS === 'web') {
              inputRef.current?.measureInWindow?.(
                (x, y, inputWidth, inputHeight) => {
                  const visibleHeight = Math.max(300, height - 100);

                  if (y + inputHeight > visibleHeight) {
                    scrollView.scrollTo({
                      y: Math.max(
                        0,
                        y - visibleHeight + inputHeight + 100
                      ),
                      animated: true,
                    });
                  }
                }
              );
            }
          } catch (error) {
            console.log('Scroll input error:', error);
          }
        }, 100);
      });
    },
    [height, isMobileLayout]
  );

  const focusField = useCallback(
    ref => {
      ref?.current?.focus?.();
      scrollToInput(ref);
    },
    [scrollToInput]
  );

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, []);

  const scrollToFirstError = useCallback(
    errorObject => {
      const first = Object.keys(errorObject)[0];

      const refs = {
        fullname: fullnameRef,
        email: emailRef,
        phone: phoneRef,
        password: passwordRef,
        confirmPassword: confirmPasswordRef,
      };

      const ref = refs[first];

      if (ref?.current && isMobileLayout) {
        setTimeout(() => {
          scrollToInput(ref);
          ref.current?.focus?.();
        }, 180);
      } else {
        scrollToTop();
      }
    },
    [isMobileLayout, scrollToInput, scrollToTop]
  );

  // ----------------------------------------------------------
  // REGISTER
  // ----------------------------------------------------------

  const handleRegister = async () => {
    Keyboard.dismiss();

    const valid = validateForm();

    if (!valid) {
      showToast(
        'error',
        'Veuillez corriger les informations indiquées avant de continuer.'
      );

      setTimeout(() => {
        scrollToFirstError(
          Object.fromEntries(
            Object.entries(formData)
              .filter(([key]) =>
                [
                  'fullname',
                  'email',
                  'phone',
                  'password',
                  'confirmPassword',
                ].includes(key)
              )
              .map(([key, value]) => [
                key,
                getFieldError(
                  key,
                  value,
                  formData.password
                ),
              ])
              .filter(([, error]) => error)
          )
        );
      }, 120);

      return;
    }

    setIsLoading(true);
    setCurrentStep(1);
    dismissToast();

    try {
      const result = await register({
        fullname: formData.fullname.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
        role: formData.role,
      });

      if (result?.success) {
        setCurrentStep(2);

        showToast(
          'success',
          'Votre compte a été créé. Vérifiez votre adresse email pour continuer.'
        );

        setTimeout(() => {
          navigation.navigate('OTPVerification', {
            email: formData.email.trim().toLowerCase(),
            fullname: formData.fullname.trim(),
          });
        }, 1300);
      } else {
        setCurrentStep(0);

        showToast(
          'error',
          result?.error ||
            "Impossible de créer votre compte. Veuillez réessayer."
        );
      }
    } catch (error) {
      console.error('Register error:', error);
      setCurrentStep(0);

      showToast(
        'error',
        'Une erreur est survenue. Vérifiez votre connexion puis réessayez.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------
  // FORM
  // ----------------------------------------------------------

  const renderForm = () => (
    <Animated.View
      style={[
        styles.formCard,
        isDesktop && styles.formCardDesktop,
        isTablet && styles.formCardTablet,
        isSmallPhone && styles.formCardSmall,
        {
          backgroundColor: isDark ? '#1E1E2E' : WHITE,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.formIntro}>
        <View
          style={[
            styles.formIcon,
            {
              backgroundColor: isDark ? '#263C2A' : GREEN_LIGHT,
            },
          ]}
        >
          <Ionicons
            name="person-add-outline"
            size={23}
            color={GREEN}
          />
        </View>

        <View style={styles.formIntroText}>
          <Text
            style={[
              styles.formTitle,
              isSmallPhone && styles.formTitleSmall,
              { color: isDark ? WHITE : '#17201A' },
            ]}
          >
            Créer votre compte
          </Text>

          <Text
            style={[
              styles.formDescription,
              { color: isDark ? '#9CA3AF' : '#66736A' },
            ]}
          >
            Inscrivez-vous en quelques secondes.
          </Text>
        </View>
      </View>

      <StepsIndicator
        currentStep={currentStep}
        isDark={isDark}
      />

      <Field
        inputRef={fullnameRef}
        label="Nom complet"
        icon="person-outline"
        value={formData.fullname}
        onChangeText={text => updateField('fullname', text)}
        placeholder="Ex. Jean Rakoto"
        error={errors.fullname}
        onFocus={() => scrollToInput(fullnameRef)}
        onBlur={() =>
          validateField('fullname', formData.fullname)
        }
        isDark={isDark}
        returnKeyType="next"
        onSubmitEditing={() => focusField(emailRef)}
      />

      <Field
        inputRef={emailRef}
        label="Adresse email"
        icon="mail-outline"
        value={formData.email}
        onChangeText={text => updateField('email', text)}
        placeholder="exemple@email.com"
        error={errors.email}
        onFocus={() => scrollToInput(emailRef)}
        onBlur={() =>
          validateField('email', formData.email)
        }
        isDark={isDark}
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() => focusField(phoneRef)}
      />

      <Field
        inputRef={phoneRef}
        label="Numéro de téléphone"
        icon="call-outline"
        value={formData.phone}
        onChangeText={text => updateField('phone', text)}
        placeholder="034 00 000 00"
        error={errors.phone}
        onFocus={() => scrollToInput(phoneRef)}
        onBlur={() =>
          validateField('phone', formData.phone)
        }
        isDark={isDark}
        keyboardType="phone-pad"
        returnKeyType="next"
        onSubmitEditing={() => focusField(passwordRef)}
      />

      <Field
        inputRef={passwordRef}
        label="Mot de passe"
        icon="lock-closed-outline"
        value={formData.password}
        onChangeText={text => updateField('password', text)}
        placeholder="Minimum 8 caractères"
        error={errors.password}
        onFocus={() => scrollToInput(passwordRef)}
        onBlur={() =>
          validateField('password', formData.password)
        }
        isDark={isDark}
        secureTextEntry={!showPassword}
        onToggleSecure={() =>
          setShowPassword(prev => !prev)
        }
        returnKeyType="next"
        onSubmitEditing={() => focusField(confirmPasswordRef)}
      />

      <PasswordStrength
        password={formData.password}
        isDark={isDark}
      />

      <Field
        inputRef={confirmPasswordRef}
        label="Confirmer le mot de passe"
        icon="shield-checkmark-outline"
        value={formData.confirmPassword}
        onChangeText={text =>
          updateField('confirmPassword', text)
        }
        placeholder="Saisissez à nouveau votre mot de passe"
        error={errors.confirmPassword}
        onFocus={() => scrollToInput(confirmPasswordRef)}
        onBlur={() =>
          validateField(
            'confirmPassword',
            formData.confirmPassword,
            formData.password
          )
        }
        isDark={isDark}
        secureTextEntry={!showConfirmPassword}
        onToggleSecure={() =>
          setShowConfirmPassword(prev => !prev)
        }
        returnKeyType="done"
        onSubmitEditing={handleRegister}
      />

      <View style={styles.roleSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Type de compte
            </Text>

            <Text
              style={[
                styles.sectionHint,
                { color: isDark ? '#6B7280' : '#8A948C' },
              ]}
            >
              Choisissez votre profil
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.roleList,
            isDesktop && styles.roleListDesktop,
          ]}
        >
          <RoleCard
            active={formData.role === 'CLIENT'}
            icon="person-outline"
            title="Client"
            description="Réserver un massage"
            onPress={() => updateField('role', 'CLIENT')}
            isDark={isDark}
          />

          <RoleCard
            active={formData.role === 'THERAPIST'}
            icon="medkit-outline"
            title="Thérapeute"
            description="Proposer mes services"
            onPress={() => updateField('role', 'THERAPIST')}
            isDark={isDark}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.registerButton,
          isLoading && styles.registerButtonDisabled,
        ]}
        onPress={handleRegister}
        disabled={isLoading}
        activeOpacity={0.88}
      >
        <View style={styles.registerButtonInner}>
          {isLoading ? (
            <>
              <ActivityIndicator color={WHITE} size="small" />
              <Text style={styles.registerButtonText}>
                Création du compte...
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.registerButtonText}>
                Créer mon compte
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={WHITE}
              />
            </>
          )}
        </View>
      </TouchableOpacity>

      <Text
        style={[
          styles.terms,
          { color: isDark ? '#6B7280' : '#8A948C' },
        ]}
      >
        En créant votre compte, vous acceptez nos conditions
        d'utilisation et notre politique de confidentialité.
      </Text>

      <View style={styles.loginRow}>
        <Text
          style={[
            styles.loginText,
            { color: isDark ? '#9CA3AF' : '#66736A' },
          ]}
        >
          Vous avez déjà un compte ?
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.loginLinkButton}
        >
          <Text style={styles.loginLink}>Se connecter</Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={GREEN}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ----------------------------------------------------------
  // MOBILE / TABLET
  // ----------------------------------------------------------

  const renderMobile = () => (
    <KeyboardAvoidingView
      style={[
        styles.mobileKeyboard,
        { backgroundColor: isDark ? '#121212' : '#F6F9F6' },
      ]}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : Platform.OS === 'android'
          ? 'height'
          : undefined
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios'
          ? 0
          : Platform.OS === 'android'
          ? 24
          : 0
      }
    >
      {/* HEADER FIXE : hors du ScrollView */}
      <AppHeader
        navigation={navigation}
        showBack
      />

      <TouchableWithoutFeedback
        onPress={Keyboard.dismiss}
        accessible={false}
      >
        <ScrollView
          ref={scrollRef}
          style={[
            styles.mobileScrollView,
            { backgroundColor: isDark ? '#121212' : '#F6F9F6' },
          ]}
          contentContainerStyle={[
            styles.mobileScrollContent,
            isTablet && styles.mobileContentTablet,
            {
              // Réserve l'espace du header fixe + la safe area.
              paddingTop:
                insets.top +
                (Platform.OS === 'android' ? 68 : 76),

              // Espace supplémentaire lorsque le clavier est ouvert.
              // Le formulaire reste ainsi entièrement défilable sur Android.
              paddingBottom:
                keyboardVisible
                  ? Platform.OS === 'android'
                    ? 500
                    : 320
                  : 70,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          removeClippedSubviews={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="automatic"
          scrollEventThrottle={16}
          bounces
        >
          {renderForm()}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );

  // ----------------------------------------------------------
  // DESKTOP
  // ----------------------------------------------------------

  const renderDesktop = () => (
    <View
      style={[
        styles.desktopContainer,
        { backgroundColor: isDark ? '#111111' : WHITE },
      ]}
    >
      <View style={styles.desktopBrand}>
        <View style={styles.desktopBrandInner}>
          <View style={styles.desktopBrandTop}>
            <View style={styles.desktopLogo}>
              <Ionicons
                name="leaf-outline"
                size={29}
                color={WHITE}
              />
            </View>

            <Text style={styles.desktopBrandName}>
              Mada Bien-être
            </Text>
          </View>

          <View style={styles.desktopCenter}>
            <View style={styles.pill}>
              <Ionicons
                name="heart-outline"
                size={14}
                color={WHITE}
              />
              <Text style={styles.pillText}>
                ESPACE BIEN-ÊTRE
              </Text>
            </View>

            <Text style={styles.desktopTitle}>
              Votre bien-être,{'\n'}
              commence ici.
            </Text>

            <Text style={styles.desktopDescription}>
              Créez votre compte et profitez d'une expérience
              simple, proche et personnalisée avec Mada Bien-être.
            </Text>

            <View style={styles.desktopFeatures}>
              {[
                {
                  icon: 'location-outline',
                  title: 'Proximité',
                  text: 'Trouvez des thérapeutes à proximité.',
                },
                {
                  icon: 'calendar-outline',
                  title: 'Simplicité',
                  text: 'Réservez vos séances facilement.',
                },
                {
                  icon: 'shield-checkmark-outline',
                  title: 'Confiance',
                  text: 'Une expérience pensée pour vous.',
                },
              ].map(item => (
                <View
                  key={item.title}
                  style={styles.desktopFeature}
                >
                  <View style={styles.desktopFeatureIcon}>
                    <Ionicons
                      name={item.icon}
                      size={19}
                      color={WHITE}
                    />
                  </View>

                  <View style={styles.desktopFeatureText}>
                    <Text style={styles.desktopFeatureTitle}>
                      {item.title}
                    </Text>
                    <Text style={styles.desktopFeatureDescription}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.desktopFooter}>
            <Text style={styles.desktopFooterText}>
              © 2026 Mada Bien-être
            </Text>
            <Text style={styles.desktopFooterText}>
              Bien-être • Confiance • Proximité
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.desktopRight,
          { backgroundColor: isDark ? '#121212' : '#F8FAF8' },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.desktopScroll}
          contentContainerStyle={styles.desktopScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          <View style={styles.desktopFormWrapper}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.desktopBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="arrow-back"
                size={17}
                color={isDark ? '#E5E7EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.desktopBackText,
                  { color: isDark ? '#E5E7EB' : '#64748B' },
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

  // ----------------------------------------------------------
  // RETURN
  // ----------------------------------------------------------

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDark ? '#121212' : WHITE },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={GREEN}
        translucent={false}
      />

      <CustomToast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={dismissToast}
        isDark={isDark}
      />

      {isDesktop ? renderDesktop() : renderMobile()}
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  // ----------------------------------------------------------
  // TOAST
  // ----------------------------------------------------------

  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 12,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  toast: {
    width: '100%',
    maxWidth: 500,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },

  toastIcon: {
    width: 41,
    height: 41,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  toastContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 6,
  },

  toastTitle: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 2,
  },

  toastMessage: {
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: typography.fontFamily.regular,
  },

  toastClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ----------------------------------------------------------
  // MOBILE
  // ----------------------------------------------------------

  mobileKeyboard: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },

  mobileScrollView: {
    flex: 1,
    width: '100%',
  },

  mobileScrollContent: {
    flexGrow: 1,
    width: '100%',
    minHeight: '100%',
  },

  mobileScroll: {
    flex: 1,
    width: '100%',
  },

  mobileContent: {
    flexGrow: 1,
    width: '100%',
    minHeight: '100%',
  },

  mobileContentTablet: {
    alignItems: 'center',
  },

  mobileHeader: {
    width: '100%',
    minHeight: 205,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 22,
    paddingBottom: 28,
    backgroundColor: GREEN,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },

  mobileLogo: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  mobileBrandName: {
    color: WHITE,
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
  },

  mobileHeaderText: {
    marginTop: 19,
  },

  mobileHeaderTitle: {
    color: WHITE,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: typography.fontFamily.bold,
  },

  mobileHeaderSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 3,
    fontFamily: typography.fontFamily.regular,
  },

  headerDecorationOne: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -60,
    top: -65,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },

  headerDecorationTwo: {
    position: 'absolute',
    width: 95,
    height: 95,
    borderRadius: 48,
    right: 20,
    bottom: -55,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },

  // ----------------------------------------------------------
  // FORM CARD
  // ----------------------------------------------------------

  formCard: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 23,
    paddingBottom: 30,
  },

  formCardDesktop: {
    paddingHorizontal: 0,
    paddingTop: 3,
    paddingBottom: 35,
  },

  formCardTablet: {
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 32,
  },

  formCardSmall: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 26,
  },

  formIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  formIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  formIntroText: {
    flex: 1,
    minWidth: 0,
  },

  formTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 2,
  },

  formTitleSmall: {
    fontSize: 21,
    lineHeight: 27,
  },

  formDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: typography.fontFamily.regular,
  },

  // ----------------------------------------------------------
  // STEPS
  // ----------------------------------------------------------

  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 18,
  },

  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepText: {
    fontSize: 10.5,
    marginLeft: 5,
    fontFamily: typography.fontFamily.medium,
  },

  stepLine: {
    flex: 1,
    height: 1,
    minWidth: 8,
    marginHorizontal: 7,
  },

  // ----------------------------------------------------------
  // INPUT
  // ----------------------------------------------------------

  fieldGroup: {
    width: '100%',
    marginBottom: 12,
  },

  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  fieldLabel: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.medium,
  },

  inputWrapper: {
    width: '100%',
    minHeight: 51,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },

  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 49,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    paddingHorizontal: 9,
    paddingVertical: 8,
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
    marginTop: 4,
  },

  errorText: {
    flex: 1,
    marginLeft: 4,
    color: '#EF4444',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: typography.fontFamily.regular,
  },

  // ----------------------------------------------------------
  // PASSWORD
  // ----------------------------------------------------------

  passwordStrength: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -3,
    marginBottom: 12,
  },

  passwordTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },

  passwordProgress: {
    height: '100%',
    borderRadius: 2,
  },

  passwordStrengthText: {
    width: 68,
    textAlign: 'right',
    marginLeft: 7,
    fontSize: 10.5,
    fontFamily: typography.fontFamily.medium,
  },

  // ----------------------------------------------------------
  // ROLE
  // ----------------------------------------------------------

  roleSection: {
    width: '100%',
    marginTop: 3,
    marginBottom: 16,
  },

  sectionHeader: {
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.medium,
  },

  sectionHint: {
    fontSize: 10.5,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },

  roleList: {
    width: '100%',
    gap: 9,
  },

  roleListDesktop: {
    flexDirection: 'row',
  },

  roleCard: {
    flex: 1,
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  roleInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    marginRight: 6,
  },

  roleTitle: {
    fontSize: 13.5,
    fontFamily: typography.fontFamily.bold,
  },

  roleDescription: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },

  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: GREEN,
  },

  // ----------------------------------------------------------
  // BUTTON
  // ----------------------------------------------------------

  registerButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 5,
  },

  registerButtonDisabled: {
    opacity: 0.75,
  },

  registerButtonInner: {
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
  },

  registerButtonText: {
    color: WHITE,
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
  },

  // ----------------------------------------------------------
  // TERMS / LOGIN
  // ----------------------------------------------------------

  terms: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 11,
    paddingHorizontal: 8,
    fontFamily: typography.fontFamily.regular,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 15,
  },

  loginText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
  },

  loginLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5,
    paddingVertical: 3,
  },

  loginLink: {
    color: GREEN,
    fontSize: 12,
    marginRight: 3,
    fontFamily: typography.fontFamily.bold,
  },

  // ----------------------------------------------------------
  // DESKTOP LEFT
  // ----------------------------------------------------------

  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    minHeight: 0,
  },

  desktopBrand: {
    width: '48%',
    minWidth: 0,
    height: '100%',
    backgroundColor: GREEN,
  },

  desktopBrandInner: {
    flex: 1,
    paddingHorizontal: 52,
    paddingVertical: 42,
    justifyContent: 'space-between',
    minHeight: 0,
    backgroundColor: GREEN,
    overflow: 'hidden',
  },

  desktopBrandTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  desktopLogo: {
    width: 55,
    height: 55,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  desktopBrandName: {
    color: WHITE,
    fontSize: 21,
    fontFamily: typography.fontFamily.bold,
  },

  desktopCenter: {
    width: '100%',
    maxWidth: 570,
    alignSelf: 'center',
  },

  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.13)',
    marginBottom: 17,
    gap: 6,
  },

  pillText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 9.5,
    letterSpacing: 1,
    fontFamily: typography.fontFamily.bold,
  },

  desktopTitle: {
    color: WHITE,
    fontSize: 39,
    lineHeight: 47,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 16,
  },

  desktopDescription: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: typography.fontFamily.regular,
    maxWidth: 520,
  },

  desktopFeatures: {
    marginTop: 30,
    gap: 14,
  },

  desktopFeature: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  desktopFeatureIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  desktopFeatureText: {
    flex: 1,
    minWidth: 0,
  },

  desktopFeatureTitle: {
    color: WHITE,
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 2,
  },

  desktopFeatureDescription: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: typography.fontFamily.regular,
  },

  desktopFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  desktopFooterText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
  },

  // ----------------------------------------------------------
  // DESKTOP RIGHT
  // ----------------------------------------------------------

  desktopRight: {
    flex: 1,
    width: '52%',
    minWidth: 0,
    height: '100%',
  },

  desktopScroll: {
    flex: 1,
    width: '100%',
  },

  desktopScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 30,
  },

  desktopFormWrapper: {
    width: '100%',
    maxWidth: 590,
    alignSelf: 'center',
  },

  desktopBack: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 3,
  },

  desktopBackText: {
    fontSize: 12,
    marginLeft: 6,
    fontFamily: typography.fontFamily.medium,
  },
});

export default RegisterScreen;