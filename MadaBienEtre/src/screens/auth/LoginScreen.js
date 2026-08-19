// src/screens/auth/LoginScreen.js

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
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
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import notificationService from '../../services/notificationService';

const { width } = Dimensions.get('window');

const isWeb = Platform.OS === 'web';
const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';
const isLargeScreen = isWeb && width >= 1024;

// ============================================================
// APP FONT
// ============================================================

const APP_FONT =
  typography?.fontFamily?.regular || 'System';

const APP_FONT_MEDIUM =
  typography?.fontFamily?.medium || APP_FONT;

const APP_FONT_SEMIBOLD =
  typography?.fontFamily?.semiBold ||
  typography?.fontFamily?.bold ||
  APP_FONT_MEDIUM;

const APP_FONT_BOLD =
  typography?.fontFamily?.bold ||
  APP_FONT_SEMIBOLD ||
  APP_FONT;

// ============================================================
// TOAST
// ============================================================

const Toast = ({
  visible,
  type,
  message,
  onDismiss,
}) => {
  if (!visible) return null;

  const config = {
    success: {
      background: '#ECFDF5',
      border: '#A7F3D0',
      iconBackground: '#D1FAE5',
      icon: 'checkmark-circle',
      iconColor: '#059669',
      text: '#065F46',
    },

    error: {
      background: '#FEF2F2',
      border: '#FECACA',
      iconBackground: '#FEE2E2',
      icon: 'alert-circle',
      iconColor: '#DC2626',
      text: '#991B1B',
    },

    info: {
      background: '#EFF6FF',
      border: '#BFDBFE',
      iconBackground: '#DBEAFE',
      icon: 'information-circle',
      iconColor: '#2563EB',
      text: '#1E40AF',
    },

    warning: {
      background: '#FFFBEB',
      border: '#FDE68A',
      iconBackground: '#FEF3C7',
      icon: 'warning',
      iconColor: '#D97706',
      text: '#92400E',
    },
  };

  const current = config[type] || config.info;

  return (
    <View
      pointerEvents="box-none"
      style={styles.toastOverlay}
    >
      <Animatable.View
        animation="slideInDown"
        duration={350}
        easing="ease-out"
        style={[
          styles.toastContainer,
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

        <View style={styles.toastMessageContainer}>
          <Text
            style={[
              styles.toastMessage,
              {
                color: current.text,
              },
            ]}
          >
            {message}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          style={styles.toastClose}
          activeOpacity={0.7}
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
            color={current.text}
          />
        </TouchableOpacity>
      </Animatable.View>
    </View>
  );
};

// ============================================================
// LOGIN SCREEN
// ============================================================

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    type: 'info',
    message: '',
  });

  const toastTimerRef = useRef(null);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  const { login } = useAuth();
  const { isDark } = useTheme();

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  const slideAnim = useRef(
    new Animated.Value(40)
  ).current;

  // ============================================================
  // ANIMATION
  // ============================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    requestNotificationPermission();

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // ============================================================
  // NOTIFICATION PERMISSION
  // ============================================================

  const requestNotificationPermission = async () => {
    try {
      const hasPermission =
        await notificationService.checkPermission();

      if (!hasPermission) {
        await notificationService.requestPermission();
      }
    } catch (error) {
      console.log(
        'Notification permission error:',
        error
      );
    }
  };

  // ============================================================
  // SHOW TOAST
  // ============================================================

  const showToast = useCallback(
    (type, message, duration = 4000) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({
        visible: true,
        type,
        message,
      });

      toastTimerRef.current = setTimeout(() => {
        setToast((prev) => ({
          ...prev,
          visible: false,
        }));
      }, duration);
    },
    []
  );

  // ============================================================
  // DISMISS TOAST
  // ============================================================

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToast((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  // ============================================================
  // VALIDATION
  // ============================================================

  const validateEmail = useCallback((value) => {
    if (!value || !value.trim()) {
      return 'L’adresse email est requise';
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value.trim())) {
      return 'Veuillez saisir une adresse email valide';
    }

    return '';
  }, []);

  const validatePassword = useCallback((value) => {
    if (!value) {
      return 'Le mot de passe est requis';
    }

    if (value.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères';
    }

    return '';
  }, []);

  // ============================================================
  // EMAIL CHANGE
  // ============================================================

  const handleEmailChange = useCallback(
    (text) => {
      setEmail(text);

      if (errors.email) {
        const error = validateEmail(text);

        setErrors((prev) => ({
          ...prev,
          email: error,
        }));
      }
    },
    [errors.email, validateEmail]
  );

  // ============================================================
  // PASSWORD CHANGE
  // ============================================================

  const handlePasswordChange = useCallback(
    (text) => {
      setPassword(text);

      if (errors.password) {
        const error = validatePassword(text);

        setErrors((prev) => ({
          ...prev,
          password: error,
        }));
      }
    },
    [errors.password, validatePassword]
  );

  // ============================================================
  // BLUR VALIDATION
  // ============================================================

  const handleEmailBlur = () => {
    const error = validateEmail(email);

    setErrors((prev) => ({
      ...prev,
      email: error,
    }));
  };

  const handlePasswordBlur = () => {
    const error = validatePassword(password);

    setErrors((prev) => ({
      ...prev,
      password: error,
    }));
  };

  // ============================================================
  // LOGIN
  // ============================================================

  const handleLogin = async () => {
    Keyboard.dismiss();

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    const newErrors = {};

    if (emailError) {
      newErrors.email = emailError;
    }

    if (passwordError) {
      newErrors.password = passwordError;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      showToast(
        'error',
        'Veuillez corriger les informations indiquées.'
      );

      return;
    }

    setIsLoading(true);

    showToast(
      'info',
      'Connexion en cours...',
      1500
    );

    try {
      const result = await login(
        email.trim().toLowerCase(),
        password
      );

      if (result.success) {
        showToast(
          'success',
          'Connexion réussie. Bienvenue sur Mada Bien-être !',
          4500
        );
      } else {
        showToast(
          'error',
          result.error ||
            'Email ou mot de passe incorrect.',
          4500
        );
      }
    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      showToast(
        'error',
        'Une erreur est survenue. Veuillez réessayer.',
        4500
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // FOCUS EMAIL
  // ============================================================

  const focusEmail = () => {
    requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
  };

  // ============================================================
  // FOCUS PASSWORD
  // ============================================================

  const focusPassword = () => {
    requestAnimationFrame(() => {
      passwordInputRef.current?.focus();
    });
  };

  // ============================================================
  // INPUT COMPONENT
  // ============================================================

  const renderInput = ({
    field,
    label,
    icon,
    value,
    onChangeText,
    onBlur,
    placeholder,
    keyboardType,
    secureTextEntry,
    autoCapitalize,
    autoCorrect,
    returnKeyType,
    onSubmitEditing,
    error,
    rightAction,
    inputRef,
  }) => {
    return (
      <View style={styles.inputGroup}>
        <Text
          style={[
            styles.inputLabel,
            {
              color: isDark
                ? '#E5E7EB'
                : '#1F2937',
            },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.inputWrapper,

            error &&
              styles.inputWrapperError,

            {
              backgroundColor: isDark
                ? '#2D2D3D'
                : '#F9FAFB',

              borderColor: error
                ? '#EF4444'
                : isDark
                ? '#374151'
                : '#E5E7EB',
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
                  ? '#FFFFFF'
                  : '#1F2937',

                fontFamily: APP_FONT,
              },
            ]}
            value={value}
            onChangeText={onChangeText}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={
              isDark
                ? '#6B7280'
                : '#9CA3AF'
            }
            keyboardType={keyboardType}
            secureTextEntry={
              secureTextEntry
            }
            autoCapitalize={
              autoCapitalize
            }
            autoCorrect={
              autoCorrect
            }
            returnKeyType={
              returnKeyType
            }
            onSubmitEditing={
              onSubmitEditing
            }
            editable={!isLoading}
            selectionColor={
              colors.primary
            }

            /*
             * IMPORTANT ANDROID
             *
             * Tsy misy focusedField intsony.
             * Tsy mitahiry focus ao amin'ny state.
             */
            blurOnSubmit={false}

            /*
             * Manakana React Native tsy hanova
             * comportement rehefa miverina amin'ny champ.
             */
            disableFullscreenUI={true}

            /*
             * Android text input optimizations.
             */
            textAlignVertical="center"
          />

          {rightAction}
        </View>

        {error ? (
          <View
            style={styles.fieldErrorRow}
          >
            <Ionicons
              name="alert-circle-outline"
              size={14}
              color="#EF4444"
            />

            <Text
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ============================================================
  // LOGIN FORM
  // ============================================================

  const renderLoginForm = () => (
    <Animated.View
      style={[
        styles.formContainer,

        isLargeScreen &&
          styles.formContainerLarge,

        {
          opacity: fadeAnim,

          transform: [
            {
              translateY: slideAnim,
            },
          ],
        },
      ]}
    >
      {/* FORM HEADER */}

      <View style={styles.formHeader}>
        <View
          style={[
            styles.formIcon,
            {
              backgroundColor:
                colors.primary + '12',
            },
          ]}
        >
          <Ionicons
            name="lock-open-outline"
            size={25}
            color={colors.primary}
          />
        </View>

        <Text
          style={[
            styles.formTitle,
            {
              color: isDark
                ? '#FFFFFF'
                : '#111827',
            },
          ]}
        >
          Bon retour parmi nous
        </Text>

        <Text
          style={[
            styles.formSubtitle,
            {
              color: isDark
                ? '#9CA3AF'
                : '#6B7280',
            },
          ]}
        >
          Connectez-vous pour accéder à votre espace bien-être.
        </Text>
      </View>

      {/* EMAIL */}

      {renderInput({
        field: 'email',
        label: 'Adresse email',
        icon: 'mail-outline',
        value: email,
        onChangeText: handleEmailChange,
        onBlur: handleEmailBlur,
        placeholder: 'exemple@email.com',
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        returnKeyType: 'next',
        error: errors.email,
        inputRef: emailInputRef,

        onSubmitEditing: () => {
          focusPassword();
        },
      })}

      {/* PASSWORD */}

      {renderInput({
        field: 'password',
        label: 'Mot de passe',
        icon: 'lock-closed-outline',
        value: password,
        onChangeText: handlePasswordChange,
        onBlur: handlePasswordBlur,
        placeholder: 'Votre mot de passe',
        secureTextEntry: !showPassword,
        autoCapitalize: 'none',
        autoCorrect: false,
        returnKeyType: 'done',
        onSubmitEditing: handleLogin,
        error: errors.password,
        inputRef: passwordInputRef,

        rightAction: (
          <TouchableOpacity
            onPress={() => {
              setShowPassword(
                (prev) => !prev
              );

              showToast(
                'info',
                showPassword
                  ? 'Mot de passe masqué.'
                  : 'Mot de passe affiché.',
                1800
              );
            }}
            style={styles.eyeButton}
            disabled={isLoading}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
          >
            <Ionicons
              name={
                showPassword
                  ? 'eye-off-outline'
                  : 'eye-outline'
              }
              size={21}
              color={
                isDark
                  ? '#9CA3AF'
                  : '#6B7280'
              }
            />
          </TouchableOpacity>
        ),
      })}

      {/* FORGOT PASSWORD */}

      <TouchableOpacity
        style={
          styles.forgotPassword
        }
        onPress={() => {
          Keyboard.dismiss();

          showToast(
            'info',
            'Ouverture de la récupération du mot de passe...',
            1500
          );

          setTimeout(() => {
            navigation.navigate(
              'ForgotPassword'
            );
          }, 250);
        }}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Text
          style={
            styles.forgotPasswordText
          }
        >
          Mot de passe oublié ?
        </Text>
      </TouchableOpacity>

      {/* LOGIN BUTTON */}

      <TouchableOpacity
        style={[
          styles.loginButton,
          isLoading &&
            styles.loginButtonDisabled,
        ]}
        onPress={handleLogin}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[
            colors.primary,
            colors.primaryLight,
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 0,
          }}
          style={styles.loginGradient}
        >
          {isLoading ? (
            <>
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
              />

              <Text
                style={
                  styles.loginButtonText
                }
              >
                Connexion...
              </Text>
            </>
          ) : (
            <>
              <Text
                style={
                  styles.loginButtonText
                }
              >
                Se connecter
              </Text>

              <Ionicons
                name="arrow-forward"
                size={20}
                color="#FFFFFF"
              />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* DIVIDER */}

      <View
        style={styles.dividerContainer}
      >
        <View
          style={[
            styles.divider,
            {
              backgroundColor:
                isDark
                  ? '#374151'
                  : '#E5E7EB',
            },
          ]}
        />

        <Text
          style={[
            styles.dividerText,
            {
              color: isDark
                ? '#6B7280'
                : '#9CA3AF',
            },
          ]}
        >
          ou continuer avec
        </Text>

        <View
          style={[
            styles.divider,
            {
              backgroundColor:
                isDark
                  ? '#374151'
                  : '#E5E7EB',
            },
          ]}
        />
      </View>

      {/* SOCIAL LOGIN */}

      <View
        style={styles.socialContainer}
      >
        <TouchableOpacity
          style={[
            styles.socialButton,
            {
              backgroundColor:
                isDark
                  ? '#2D2D3D'
                  : '#FFFFFF',

              borderColor:
                isDark
                  ? '#374151'
                  : '#E5E7EB',
            },
          ]}
          activeOpacity={0.8}
          onPress={() =>
            showToast(
              'info',
              'La connexion avec Google sera bientôt disponible.',
              3500
            )
          }
        >
          <Image
            source={require('../../../assets/icons/google.png')}
            style={styles.googleIcon}
          />

          <Text
            style={[
              styles.socialButtonText,
              {
                color: isDark
                  ? '#FFFFFF'
                  : '#1F2937',
              },
            ]}
          >
            Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.socialButton,
            styles.appleButton,
          ]}
          activeOpacity={0.8}
          onPress={() =>
            showToast(
              'info',
              'La connexion avec Apple sera bientôt disponible.',
              3500
            )
          }
        >
          <Ionicons
            name="logo-apple"
            size={22}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.appleButtonText
            }
          >
            Apple
          </Text>
        </TouchableOpacity>
      </View>

      {/* REGISTER */}

      <View
        style={styles.registerContainer}
      >
        <Text
          style={[
            styles.registerText,
            {
              color: isDark
                ? '#9CA3AF'
                : '#6B7280',
            },
          ]}
        >
          Pas encore de compte ?
        </Text>

        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();

            showToast(
              'info',
              'Ouverture de la création de compte...',
              1500
            );

            setTimeout(() => {
              navigation.navigate(
                'Register'
              );
            }, 250);
          }}
          disabled={isLoading}
        >
          <Text
            style={
              styles.registerLink
            }
          >
            Créer un compte
          </Text>
        </TouchableOpacity>
      </View>

      {/* SECURITY */}

      <View
        style={[
          styles.securityBox,
          {
            backgroundColor: isDark
              ? '#252535'
              : '#F8FAFC',

            borderColor: isDark
              ? '#374151'
              : '#E5E7EB',
          },
        ]}
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={18}
          color={colors.primary}
        />

        <Text
          style={[
            styles.securityText,
            {
              color: isDark
                ? '#9CA3AF'
                : '#64748B',
            },
          ]}
        >
          Vos informations sont protégées et sécurisées.
        </Text>
      </View>
    </Animated.View>
  );

  // ============================================================
  // MOBILE
  // ============================================================

  const renderMobile = () => (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={
        isIOS
          ? 'padding'
          : 'height'
      }
      keyboardVerticalOffset={
        isIOS
          ? 0
          : 0
      }
    >
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
        }}
        accessible={false}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.mobileScroll}
          contentContainerStyle={
            styles.mobileScrollContent
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            isIOS
              ? 'interactive'
              : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={
            isIOS
          }
          automaticallyAdjustContentInsets={
            false
          }
          contentInsetAdjustmentBehavior="never"
          nestedScrollEnabled={true}
          bounces={false}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
        >
          {/* MOBILE HEADER */}

          <Animatable.View
            animation="fadeInDown"
            duration={650}
          >
            <LinearGradient
              colors={[
                colors.primary,
                colors.primaryLight,
              ]}
              start={{
                x: 0,
                y: 0,
              }}
              end={{
                x: 1,
                y: 1,
              }}
              style={
                styles.mobileHeader
              }
            >
              <TouchableOpacity
                style={
                  styles.mobileBackButton
                }
                onPress={() => {
                  Keyboard.dismiss();

                  showToast(
                    'info',
                    'Retour...',
                    1000
                  );

                  setTimeout(() => {
                    navigation.goBack();
                  }, 150);
                }}
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
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <View
                style={
                  styles.mobileHeaderContent
                }
              >
                <Image
                  source={require('../../../assets/logo.png')}
                  style={
                    styles.mobileLogo
                  }
                  resizeMode="contain"
                />

                <Text
                  style={
                    styles.mobileAppName
                  }
                >
                  Mada Bien-être
                </Text>

                <Text
                  style={
                    styles.mobileHeaderSubtitle
                  }
                >
                  Massage à domicile premium
                </Text>
              </View>
            </LinearGradient>
          </Animatable.View>

          {/* FORM */}

          {renderLoginForm()}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );

  // ============================================================
  // WEB
  // ============================================================

  const renderWeb = () => (
    <View
      style={styles.webContainer}
    >
      {/* LEFT PANEL */}

      <View
        style={styles.webLeftPanel}
      >
        <LinearGradient
          colors={[
            colors.primary,
            colors.primaryLight,
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={
            styles.webLeftGradient
          }
        >
          <View
            style={
              styles.webLeftContent
            }
          >
            {/* LOGO */}

            <View
              style={
                styles.webLogoContainer
              }
            >
              <View
                style={
                  styles.webLogoIcon
                }
              >
                <Image
                  source={require('../../../assets/logo.png')}
                  style={
                    styles.webLogoImage
                  }
                  resizeMode="contain"
                />
              </View>

              <Text
                style={
                  styles.webLogoText
                }
              >
                Mada Bien-être
              </Text>
            </View>

            {/* HERO */}

            <View
              style={
                styles.webHero
              }
            >
              <Text
                style={
                  styles.webHeroTitle
                }
              >
                Votre bien-être,
                {'\n'}
                commence ici.
              </Text>

              <Text
                style={
                  styles.webHeroSubtitle
                }
              >
                Retrouvez votre espace personnel
                et profitez d'une expérience de
                massage à domicile simple,
                sécurisée et personnalisée.
              </Text>
            </View>

            {/* FEATURES */}

            <View
              style={
                styles.webFeatures
              }
            >
              <View
                style={
                  styles.webFeature
                }
              >
                <View
                  style={
                    styles.webFeatureIcon
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={
                    styles.webFeatureContent
                  }
                >
                  <Text
                    style={
                      styles.webFeatureTitle
                    }
                  >
                    Thérapeutes à proximité
                  </Text>

                  <Text
                    style={
                      styles.webFeatureText
                    }
                  >
                    Trouvez facilement un professionnel près de vous.
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.webFeature
                }
              >
                <View
                  style={
                    styles.webFeatureIcon
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={
                    styles.webFeatureContent
                  }
                >
                  <Text
                    style={
                      styles.webFeatureTitle
                    }
                  >
                    Réservation simplifiée
                  </Text>

                  <Text
                    style={
                      styles.webFeatureText
                    }
                  >
                    Organisez vos séances directement depuis votre compte.
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.webFeature
                }
              >
                <View
                  style={
                    styles.webFeatureIcon
                  }
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={
                    styles.webFeatureContent
                  }
                >
                  <Text
                    style={
                      styles.webFeatureTitle
                    }
                  >
                    Expérience sécurisée
                  </Text>

                  <Text
                    style={
                      styles.webFeatureText
                    }
                  >
                    Vos données personnelles restent protégées.
                  </Text>
                </View>
              </View>
            </View>

            {/* FOOTER */}

            <View
              style={
                styles.webLeftFooter
              }
            >
              <Text
                style={
                  styles.webFooterText
                }
              >
                © 2026 Mada Bien-être
              </Text>

              <Text
                style={
                  styles.webFooterText
                }
              >
                Bien-être • Confiance • Proximité
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* RIGHT PANEL */}

      <ScrollView
        style={
          styles.webRightPanel
        }
        contentContainerStyle={
          styles.webRightScrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={
            styles.webRightInner
          }
        >
          {renderLoginForm()}
        </View>
      </ScrollView>
    </View>
  );

  // ============================================================
  // MAIN
  // ============================================================

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            isDark
              ? '#121212'
              : '#F8FAFC',
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor="transparent"
        translucent
      />

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={dismissToast}
      />

      {isLargeScreen
        ? renderWeb()
        : renderMobile()}
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

  keyboardView: {
    flex: 1,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastOverlay: {
    position: 'absolute',

    top: 0,
    left: 0,
    right: 0,

    zIndex: 99999,

    elevation: 99999,

    alignItems: 'center',

    pointerEvents: 'box-none',

    paddingHorizontal: 16,

    paddingTop:
      isIOS
        ? 52
        : isWeb
        ? 22
        : 38,
  },

  toastContainer: {
    width: '100%',

    maxWidth: 520,

    minHeight: 66,

    borderRadius: 17,

    borderWidth: 1,

    paddingHorizontal: 12,
    paddingVertical: 10,

    flexDirection: 'row',

    alignItems: 'center',

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.14,

    shadowRadius: 16,

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

  toastMessageContainer: {
    flex: 1,

    justifyContent: 'center',
  },

  toastMessage: {
    fontSize: 13.5,

    lineHeight: 19,

    fontFamily: APP_FONT_MEDIUM,
  },

  toastClose: {
    width: 34,
    height: 34,

    borderRadius: 17,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,
  },

  // ==========================================================
  // MOBILE SCROLL
  // ==========================================================

  mobileScroll: {
    flex: 1,

    /*
     * IMPORTANT:
     * Mamela ScrollView hitazona tsara ny formulaire
     * rehefa miseho/miafina ny clavier Android.
     */
    backgroundColor: 'transparent',
  },

  mobileScrollContent: {
    flexGrow: 1,

    /*
     * Espace fanampiny ambany mba tsy hifatratra amin'ny
     * clavier ny bouton farany.
     */
    paddingBottom: 100,

    /*
     * Manome toerana ahafahana manao scroll tsara
     * rehefa misokatra ny clavier.
     */
    paddingTop: 0,
  },

  // ==========================================================
  // MOBILE HEADER
  // ==========================================================

  mobileHeader: {
    paddingTop:
      isIOS
        ? 52
        : 34,

    paddingBottom: 30,
    paddingHorizontal: 20,

    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  mobileBackButton: {
    width: 42,
    height: 42,

    borderRadius: 21,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.14)',

    marginBottom: 14,
  },

  mobileHeaderContent: {
    alignItems: 'center',
  },

  mobileLogo: {
    width: 64,
    height: 64,

    marginBottom: 8,
  },

  mobileAppName: {
    fontSize: 23,

    fontFamily: APP_FONT_BOLD,

    color: '#FFFFFF',

    letterSpacing: 0.3,
  },

  mobileHeaderSubtitle: {
    fontSize: 13,

    fontFamily: APP_FONT,

    color:
      'rgba(255,255,255,0.82)',

    marginTop: 4,
  },

  // ==========================================================
  // FORM
  // ==========================================================

  formContainer: {
    width: '100%',

    paddingHorizontal: 20,

    paddingTop: 24,

    /*
     * IMPORTANT ANDROID:
     * Espace ampy ambany hahafahan'ny utilisateur
     * mahita ny bouton rehefa misokatra ny clavier.
     */
    paddingBottom: 40,
  },

  formContainerLarge: {
    paddingHorizontal: 0,

    paddingTop: 0,

    paddingBottom: 0,
  },

  formHeader: {
    marginBottom: 26,
  },

  formIcon: {
    width: 48,
    height: 48,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 15,
  },

  formTitle: {
    fontSize: 25,

    fontFamily: APP_FONT_BOLD,

    lineHeight: 32,

    marginBottom: 7,
  },

  formSubtitle: {
    fontSize: 14,

    fontFamily: APP_FONT,

    lineHeight: 21,

    maxWidth: 500,
  },

  // ==========================================================
  // INPUT
  // ==========================================================

  inputGroup: {
    marginBottom: 18,
  },

  inputLabel: {
    fontSize: 13,

    fontFamily: APP_FONT_MEDIUM,

    marginBottom: 7,
  },

  inputWrapper: {
    minHeight: 54,

    borderRadius: 13,

    borderWidth: 1.4,

    paddingHorizontal: 14,

    flexDirection: 'row',

    alignItems: 'center',
  },

  /*
   * IMPORTANT:
   * Tsy misy intsony inputWrapperFocused.
   * Tsy misy border rehefa focused.
   */

  inputWrapperError: {
    shadowColor: '#EF4444',

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.08,

    shadowRadius: 3,
  },

  input: {
    flex: 1,

    minHeight: 50,

    fontSize: 15,

    fontFamily: APP_FONT,

    paddingHorizontal: 11,

    paddingVertical: 10,

    /*
     * Android:
     * manampy amin'ny vertical alignment.
     */
    textAlignVertical: 'center',

    /*
     * Web only.
     */
    outlineStyle: 'none',
  },

  eyeButton: {
    width: 36,
    height: 36,

    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldErrorRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 5,

    gap: 4,
  },

  errorText: {
    color: '#EF4444',

    fontSize: 12,

    fontFamily: APP_FONT,

    lineHeight: 17,
  },

  // ==========================================================
  // FORGOT PASSWORD
  // ==========================================================

  forgotPassword: {
    alignSelf: 'flex-end',

    marginTop: -4,

    marginBottom: 20,

    paddingVertical: 5,
  },

  forgotPasswordText: {
    color: colors.primary,

    fontSize: 13,

    fontFamily: APP_FONT_BOLD,
  },

  // ==========================================================
  // LOGIN BUTTON
  // ==========================================================

  loginButton: {
    borderRadius: 14,

    overflow: 'hidden',

    marginBottom: 20,

    shadowColor: colors.primary,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.24,

    shadowRadius: 10,

    elevation: 5,
  },

  loginButtonDisabled: {
    opacity: 0.75,
  },

  loginGradient: {
    minHeight: 56,

    paddingHorizontal: 20,

    alignItems: 'center',

    justifyContent: 'center',

    flexDirection: 'row',

    gap: 10,
  },

  loginButtonText: {
    color: '#FFFFFF',

    fontSize: 16,

    fontFamily: APP_FONT_BOLD,
  },

  // ==========================================================
  // DIVIDER
  // ==========================================================

  dividerContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    marginVertical: 4,

    marginBottom: 20,
  },

  divider: {
    flex: 1,

    height: 1,
  },

  dividerText: {
    marginHorizontal: 12,

    fontSize: 12,

    fontFamily: APP_FONT,
  },

  // ==========================================================
  // SOCIAL
  // ==========================================================

  socialContainer: {
    flexDirection: 'row',

    gap: 12,

    marginBottom: 24,
  },

  socialButton: {
    flex: 1,

    minHeight: 50,

    borderRadius: 12,

    borderWidth: 1,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 9,
  },

  googleIcon: {
    width: 20,
    height: 20,
  },

  socialButtonText: {
    fontSize: 14,

    fontFamily: APP_FONT_MEDIUM,
  },

  appleButton: {
    backgroundColor: '#000000',

    borderColor: '#000000',
  },

  appleButtonText: {
    color: '#FFFFFF',

    fontSize: 14,

    fontFamily: APP_FONT_MEDIUM,
  },

  // ==========================================================
  // REGISTER
  // ==========================================================

  registerContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    flexWrap: 'wrap',

    marginBottom: 20,
  },

  registerText: {
    fontSize: 14,

    fontFamily: APP_FONT,

    marginRight: 4,
  },

  registerLink: {
    color: colors.primary,

    fontSize: 14,

    fontFamily: APP_FONT_BOLD,
  },

  // ==========================================================
  // SECURITY
  // ==========================================================

  securityBox: {
    minHeight: 46,

    borderRadius: 11,

    borderWidth: 1,

    paddingHorizontal: 12,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,
  },

  securityText: {
    flex: 1,

    fontSize: 11,

    lineHeight: 16,

    fontFamily: APP_FONT,
  },

  // ==========================================================
  // WEB
  // ==========================================================

  webContainer: {
    flex: 1,

    flexDirection: 'row',

    backgroundColor: '#F8FAFC',
  },

  // ==========================================================
  // WEB LEFT
  // ==========================================================

  webLeftPanel: {
    flex: 1,

    minHeight: '100vh',

    maxWidth: '50%',
  },

  webLeftGradient: {
    flex: 1,

    paddingHorizontal: 60,

    paddingVertical: 50,
  },

  webLeftContent: {
    flex: 1,

    justifyContent: 'space-between',

    maxWidth: 600,

    alignSelf: 'center',

    width: '100%',
  },

  webLogoContainer: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  webLogoIcon: {
    width: 54,
    height: 54,

    borderRadius: 15,

    backgroundColor:
      'rgba(255,255,255,0.15)',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 13,
  },

  webLogoImage: {
    width: 38,
    height: 38,
  },

  webLogoText: {
    color: '#FFFFFF',

    fontSize: 22,

    fontFamily: APP_FONT_BOLD,

    letterSpacing: 0.2,
  },

  // ==========================================================
  // WEB HERO
  // ==========================================================

  webHero: {
    marginVertical: 40,
  },

  webHeroTitle: {
    color: '#FFFFFF',

    fontSize: 42,

    lineHeight: 50,

    fontFamily: APP_FONT_BOLD,

    marginBottom: 18,
  },

  webHeroSubtitle: {
    color:
      'rgba(255,255,255,0.84)',

    fontSize: 16,

    lineHeight: 26,

    fontFamily: APP_FONT,

    maxWidth: 520,
  },

  // ==========================================================
  // WEB FEATURES
  // ==========================================================

  webFeatures: {
    gap: 18,
  },

  webFeature: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    gap: 13,
  },

  webFeatureIcon: {
    width: 42,
    height: 42,

    borderRadius: 12,

    backgroundColor:
      'rgba(255,255,255,0.14)',

    alignItems: 'center',

    justifyContent: 'center',
  },

  webFeatureContent: {
    flex: 1,
  },

  webFeatureTitle: {
    color: '#FFFFFF',

    fontSize: 14,

    fontFamily: APP_FONT_BOLD,

    marginBottom: 3,
  },

  webFeatureText: {
    color:
      'rgba(255,255,255,0.72)',

    fontSize: 12,

    lineHeight: 18,

    fontFamily: APP_FONT,

    maxWidth: 400,
  },

  // ==========================================================
  // WEB FOOTER
  // ==========================================================

  webLeftFooter: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginTop: 40,

    paddingTop: 20,

    borderTopWidth: 1,

    borderTopColor:
      'rgba(255,255,255,0.15)',
  },

  webFooterText: {
    color:
      'rgba(255,255,255,0.55)',

    fontSize: 11,

    fontFamily: APP_FONT,
  },

  // ==========================================================
  // WEB RIGHT
  // ==========================================================

  webRightPanel: {
    flex: 1,

    maxWidth: '50%',

    backgroundColor: '#FFFFFF',
  },

  webRightScrollContent: {
    flexGrow: 1,

    justifyContent: 'center',

    paddingHorizontal: 60,

    paddingVertical: 60,
  },

  webRightInner: {
    width: '100%',

    maxWidth: 500,

    alignSelf: 'center',
  },
});

export default LoginScreen;