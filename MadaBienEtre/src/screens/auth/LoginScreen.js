// src/screens/auth/LoginScreen.js
// ============================================================
// LOGIN SCREEN — MADA BIEN-ÊTRE
// ============================================================
// RESPONSIVE WEB + MOBILE
//
// THEME GREEN
// -> #2E7D32
//
// WEB >= 1024px
//    -> Interface Desktop
//
// WEB < 1024px
//    -> Interface Mobile
//
// ANDROID / IOS
//    -> Interface Mobile
//
// LOGO
//    -> Cadre blanc/translucide premium
//    -> Padding autour du logo
//    -> Légère ombre
//    -> Adapté Web + Android + iOS
// ============================================================

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
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

import {
  colors,
  typography,
} from '../../theme';

import notificationService from '../../services/notificationService';

// ============================================================
// PLATFORM
// ============================================================

const IS_WEB = Platform.OS === 'web';
const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';

// ============================================================
// THEME
// ============================================================

const GREEN_THEME = '#2E7D32';

const GREEN_DARK = '#1B5E20';

const GREEN_LIGHT = '#43A047';

const WHITE = '#FFFFFF';

// ============================================================
// BREAKPOINT
// ============================================================

const DESKTOP_BREAKPOINT = 1024;
const SMALL_MOBILE_HEIGHT = 700;

// ============================================================
// FONT
// ============================================================

const APP_FONT =
  typography?.fontFamily?.regular ||
  'System';

const APP_FONT_MEDIUM =
  typography?.fontFamily?.medium ||
  APP_FONT;

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
  if (!visible) {
    return null;
  }

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

  const current =
    config[type] || config.info;

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

        <View
          style={styles.toastMessageContainer}
        >
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

const LoginScreen = ({
  navigation,
}) => {
  const {
    width,
    height,
  } = useWindowDimensions();

  // ==========================================================
  // RESPONSIVE
  // ==========================================================

  const isDesktopWeb =
    IS_WEB &&
    width >= DESKTOP_BREAKPOINT;

  const isSmallScreen =
    width < 480;

  const isVerySmallScreen =
    width < 360;

  const isShortScreen =
    height < SMALL_MOBILE_HEIGHT;

  // ==========================================================
  // STATES
  // ==========================================================

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [errors, setErrors] =
    useState({});

  const [isLoading, setIsLoading] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [toast, setToast] =
    useState({
      visible: false,
      type: 'info',
      message: '',
    });

  // ==========================================================
  // REFS
  // ==========================================================

  const toastTimerRef =
    useRef(null);

  const emailInputRef =
    useRef(null);

  const passwordInputRef =
    useRef(null);

  const scrollViewRef =
    useRef(null);

  // ==========================================================
  // CONTEXT
  // ==========================================================

  const { login } =
    useAuth();

  const { isDark } =
    useTheme();

  // ==========================================================
  // ANIMATION
  // ==========================================================

  const fadeAnim =
    useRef(
      new Animated.Value(0)
    ).current;

  const slideAnim =
    useRef(
      new Animated.Value(40)
    ).current;

  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(
        fadeAnim,
        {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }
      ),

      Animated.timing(
        slideAnim,
        {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }
      ),
    ]).start();

    requestNotificationPermission();

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );
      }
    };
  }, []);

  // ==========================================================
  // NOTIFICATION PERMISSION
  // ==========================================================

  const requestNotificationPermission =
    async () => {
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

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast =
    useCallback(
      (
        type,
        message,
        duration = 4000
      ) => {
        if (toastTimerRef.current) {
          clearTimeout(
            toastTimerRef.current
          );
        }

        setToast({
          visible: true,
          type,
          message,
        });

        toastTimerRef.current =
          setTimeout(() => {
            setToast(
              previous => ({
                ...previous,
                visible: false,
              })
            );
          }, duration);
      },
      []
    );

  const dismissToast =
    useCallback(() => {
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );

        toastTimerRef.current =
          null;
      }

      setToast(
        previous => ({
          ...previous,
          visible: false,
        })
      );
    }, []);

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const validateEmail =
    useCallback(value => {
      if (
        !value ||
        !value.trim()
      ) {
        return (
          "L'adresse email est requise"
        );
      }

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          value.trim()
        )
      ) {
        return (
          'Veuillez saisir une adresse email valide'
        );
      }

      return '';
    }, []);

  const validatePassword =
    useCallback(value => {
      if (!value) {
        return (
          'Le mot de passe est requis'
        );
      }

      if (value.length < 8) {
        return (
          'Le mot de passe doit contenir au moins 8 caractères'
        );
      }

      return '';
    }, []);

  // ==========================================================
  // EMAIL CHANGE
  // ==========================================================

  const handleEmailChange =
    useCallback(
      text => {
        setEmail(text);

        if (errors.email) {
          const error =
            validateEmail(text);

          setErrors(
            previous => ({
              ...previous,
              email: error,
            })
          );
        }
      },
      [
        errors.email,
        validateEmail,
      ]
    );

  // ==========================================================
  // PASSWORD CHANGE
  // ==========================================================

  const handlePasswordChange =
    useCallback(
      text => {
        setPassword(text);

        if (errors.password) {
          const error =
            validatePassword(text);

          setErrors(
            previous => ({
              ...previous,
              password: error,
            })
          );
        }
      },
      [
        errors.password,
        validatePassword,
      ]
    );

  // ==========================================================
  // BLUR
  // ==========================================================

  const handleEmailBlur =
    useCallback(() => {
      const error =
        validateEmail(email);

      setErrors(
        previous => ({
          ...previous,
          email: error,
        })
      );
    }, [
      email,
      validateEmail,
    ]);

  const handlePasswordBlur =
    useCallback(() => {
      const error =
        validatePassword(password);

      setErrors(
        previous => ({
          ...previous,
          password: error,
        })
      );
    }, [
      password,
      validatePassword,
    ]);

  // ==========================================================
  // LOGIN
  // ==========================================================

  const handleLogin =
    useCallback(async () => {
      Keyboard.dismiss();

      const emailError =
        validateEmail(email);

      const passwordError =
        validatePassword(password);

      const newErrors = {};

      if (emailError) {
        newErrors.email =
          emailError;
      }

      if (passwordError) {
        newErrors.password =
          passwordError;
      }

      setErrors(newErrors);

      if (
        Object.keys(newErrors)
          .length > 0
      ) {
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
        const result =
          await login(
            email
              .trim()
              .toLowerCase(),
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
    }, [
      email,
      password,
      validateEmail,
      validatePassword,
      login,
      showToast,
    ]);

  // ==========================================================
  // FOCUS
  // ==========================================================

  const focusEmail =
    useCallback(() => {
      requestAnimationFrame(() => {
        emailInputRef.current?.focus();
      });
    }, []);

  const focusPassword =
    useCallback(() => {
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
    }, []);

  // ==========================================================
  // INPUT
  // ==========================================================

  const renderInput =
    ({
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
        <View
          style={styles.inputGroup}
        >
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
                backgroundColor:
                  isDark
                    ? '#252733'
                    : '#F9FAFB',

                borderColor:
                  error
                    ? '#EF4444'
                    : isDark
                    ? '#3A3F4D'
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
                },
              ]}
              value={value}
              onChangeText={
                onChangeText
              }
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
              autoCorrect={autoCorrect}
              returnKeyType={
                returnKeyType
              }
              onSubmitEditing={
                onSubmitEditing
              }
              editable={!isLoading}
              selectionColor={
                GREEN_THEME
              }
              blurOnSubmit={false}
              disableFullscreenUI
              textAlignVertical="center"
            />

            {rightAction}
          </View>

          {error ? (
            <View
              style={
                styles.fieldErrorRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color="#EF4444"
              />

              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>
            </View>
          ) : null}
        </View>
      );
    };

  // ==========================================================
  // LOGIN FORM
  // ==========================================================

  const renderLoginForm =
    () => (
      <Animated.View
        style={[
          styles.formContainer,

          isDesktopWeb &&
            styles.formContainerDesktop,

          isSmallScreen &&
            styles.formContainerSmall,

          {
            opacity: fadeAnim,

            transform: [
              {
                translateY:
                  slideAnim,
              },
            ],
          },
        ]}
      >
        {/* FORM HEADER */}

        <View
          style={styles.formHeader}
        >
          <View
            style={[
              styles.formIcon,
              {
                backgroundColor:
                  GREEN_THEME + '12',
              },
            ]}
          >
            <Ionicons
              name="lock-open-outline"
              size={25}
              color={GREEN_THEME}
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
            Connectez-vous pour accéder
            à votre espace bien-être.
          </Text>
        </View>

        {/* EMAIL */}

        {renderInput({
          label: 'Adresse email',
          icon: 'mail-outline',
          value: email,
          onChangeText:
            handleEmailChange,
          onBlur:
            handleEmailBlur,
          placeholder:
            'exemple@email.com',
          keyboardType:
            'email-address',
          autoCapitalize: 'none',
          autoCorrect: false,
          returnKeyType: 'next',
          error: errors.email,
          inputRef:
            emailInputRef,
          onSubmitEditing:
            focusPassword,
        })}

        {/* PASSWORD */}

        {renderInput({
          label: 'Mot de passe',
          icon:
            'lock-closed-outline',
          value: password,
          onChangeText:
            handlePasswordChange,
          onBlur:
            handlePasswordBlur,
          placeholder:
            'Votre mot de passe',
          secureTextEntry:
            !showPassword,
          autoCapitalize: 'none',
          autoCorrect: false,
          returnKeyType: 'done',
          onSubmitEditing:
            handleLogin,
          error:
            errors.password,
          inputRef:
            passwordInputRef,

          rightAction: (
            <TouchableOpacity
              onPress={() => {
                setShowPassword(
                  previous =>
                    !previous
                );

                showToast(
                  'info',
                  showPassword
                    ? 'Mot de passe masqué.'
                    : 'Mot de passe affiché.',
                  1800
                );
              }}
              style={
                styles.eyeButton
              }
              disabled={
                isLoading
              }
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
          <View
            style={
              styles.loginGradient
            }
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
          </View>
        </TouchableOpacity>

        {/* DIVIDER */}

        <View
          style={
            styles.dividerContainer
          }
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

        {/* SOCIAL */}

        <View
          style={
            styles.socialContainer
          }
        >
          <TouchableOpacity
            style={[
              styles.socialButton,
              {
                backgroundColor:
                  isDark
                    ? '#252733'
                    : '#FFFFFF',

                borderColor:
                  isDark
                    ? '#3A3F4D'
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
              style={
                styles.googleIcon
              }
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
          style={
            styles.registerContainer
          }
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
              backgroundColor:
                isDark
                  ? '#20232D'
                  : '#F8FAFC',

              borderColor:
                isDark
                  ? '#374151'
                  : '#E5E7EB',
            },
          ]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={GREEN_THEME}
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
            Vos informations sont
            protégées et sécurisées.
          </Text>
        </View>
      </Animated.View>
    );

  // ==========================================================
  // MOBILE
  // ==========================================================

  const renderMobile =
    () => (
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          IS_IOS
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            Keyboard.dismiss()
          }
          accessible={false}
        >
          <ScrollView
            ref={scrollViewRef}
            style={
              styles.mobileScroll
            }
            contentContainerStyle={[
              styles.mobileScrollContent,

              isShortScreen &&
                styles.mobileScrollShort,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              IS_IOS
                ? 'interactive'
                : 'on-drag'
            }
            showsVerticalScrollIndicator={
              false
            }
            automaticallyAdjustKeyboardInsets={
              IS_IOS
            }
            contentInsetAdjustmentBehavior="never"
            nestedScrollEnabled
            bounces={false}
            removeClippedSubviews={false}
          >
            {/* MOBILE HEADER */}

            <Animatable.View
              animation="fadeInDown"
              duration={600}
            >
              <View
                style={[
                  styles.mobileHeader,

                  isVerySmallScreen &&
                    styles.mobileHeaderSmall,
                ]}
              >
                <TouchableOpacity
                  style={
                    styles.mobileBackButton
                  }
                  onPress={() => {
                    Keyboard.dismiss();
                    navigation.goBack();
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
                  {/* =================================================
                      LOGO PREMIUM MOBILE
                  ================================================= */}

                  <View
                    style={[
                      styles.mobileLogoFrame,
                      isVerySmallScreen &&
                        styles.mobileLogoFrameSmall,
                    ]}
                  >
                    <Image
                      source={require('../../../assets/logo.png')}
                      style={[
                        styles.mobileLogo,
                        isVerySmallScreen &&
                          styles.mobileLogoSmall,
                      ]}
                      resizeMode="contain"
                    />
                  </View>

                  <Text
                    style={[
                      styles.mobileAppName,
                      isVerySmallScreen &&
                        styles.mobileAppNameSmall,
                    ]}
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
              </View>
            </Animatable.View>

            {renderLoginForm()}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );

  // ==========================================================
  // DESKTOP WEB
  // ==========================================================

  const renderWeb =
    () => (
      <View
        style={
          styles.webContainer
        }
      >
        {/* LEFT PANEL */}

        <View
          style={
            styles.webLeftPanel
          }
        >
          <View
            style={
              styles.webLeftGradient
            }
          >
            <View
              style={
                styles.webLeftContent
              }
            >
              {/* =================================================
                  LOGO PREMIUM WEB
              ================================================= */}

              <View
                style={
                  styles.webLogoContainer
                }
              >
                <View
                  style={
                    styles.webLogoFrame
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
                  Retrouvez votre espace
                  personnel et profitez
                  d'une expérience de
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
                      Trouvez facilement un
                      professionnel près de
                      chez vous.
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
                      Organisez vos séances
                      directement depuis
                      votre compte.
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
                      Vos données personnelles
                      restent protégées.
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
                  Bien-être • Confiance •
                  Proximité
                </Text>
              </View>
            </View>
          </View>
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

  // ==========================================================
  // MAIN
  // ==========================================================

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
        barStyle="light-content"
        backgroundColor={GREEN_THEME}
        translucent={false}
      />

      <Toast
        visible={
          toast.visible
        }
        type={
          toast.type
        }
        message={
          toast.message
        }
        onDismiss={
          dismissToast
        }
      />

      {isDesktopWeb
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

    paddingHorizontal: 14,

    paddingTop: IS_IOS
      ? 52
      : IS_WEB
      ? 22
      : 38,
  },

  toastContainer: {
    width: '100%',
    maxWidth: 560,
    minHeight: 64,

    borderRadius: 16,
    borderWidth: 1,

    paddingHorizontal: 11,
    paddingVertical: 9,

    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.14,
    shadowRadius: 15,

    elevation: 10,
  },

  toastIconContainer: {
    width: 42,
    height: 42,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  toastMessageContainer: {
    flex: 1,
  },

  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily:
      APP_FONT_MEDIUM,
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
    backgroundColor: 'transparent',
  },

  mobileScrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },

  mobileScrollShort: {
    paddingBottom: 110,
  },

  // ==========================================================
  // MOBILE HEADER
  // ==========================================================

  mobileHeader: {
    backgroundColor: GREEN_THEME,

    paddingTop:
      IS_IOS
        ? 48
        : 34,

    paddingBottom: 28,
    paddingHorizontal: 20,

    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  mobileHeaderSmall: {
    paddingTop:
      IS_IOS
        ? 42
        : 28,

    paddingBottom: 22,
  },

  mobileBackButton: {
    width: 42,
    height: 42,

    borderRadius: 21,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.14)',

    marginBottom: 13,
  },

  mobileHeaderContent: {
    alignItems: 'center',
  },

  // ==========================================================
  // LOGO MOBILE PREMIUM
  // ==========================================================

  mobileLogoFrame: {
    width: 82,
    height: 82,

    borderRadius: 23,

    padding: 9,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.96)',

    borderWidth: 1,

    borderColor:
      'rgba(255,255,255,0.70)',

    marginBottom: 10,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,

    elevation: 5,
  },

  mobileLogoFrameSmall: {
    width: 70,
    height: 70,

    borderRadius: 20,

    padding: 8,

    marginBottom: 8,
  },

  mobileLogo: {
    width: 62,
    height: 62,
  },

  mobileLogoSmall: {
    width: 52,
    height: 52,
  },

  mobileAppName: {
    fontSize: 23,

    fontFamily:
      APP_FONT_BOLD,

    color: WHITE,

    letterSpacing: 0.2,
  },

  mobileAppNameSmall: {
    fontSize: 20,
  },

  mobileHeaderSubtitle: {
    fontSize: 12.5,

    fontFamily: APP_FONT,

    color:
      'rgba(255,255,255,0.88)',

    marginTop: 4,

    textAlign: 'center',
  },

  // ==========================================================
  // FORM
  // ==========================================================

  formContainer: {
    width: '100%',

    paddingHorizontal: 20,

    paddingTop: 24,

    paddingBottom: 40,
  },

  formContainerSmall: {
    paddingHorizontal: 16,

    paddingTop: 20,

    paddingBottom: 35,
  },

  formContainerDesktop: {
    paddingHorizontal: 0,

    paddingTop: 0,

    paddingBottom: 0,
  },

  formHeader: {
    marginBottom: 25,
  },

  formIcon: {
    width: 48,
    height: 48,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 14,
  },

  formTitle: {
    fontSize: 25,

    fontFamily:
      APP_FONT_BOLD,

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
    marginBottom: 17,
  },

  inputLabel: {
    fontSize: 13,

    fontFamily:
      APP_FONT_MEDIUM,

    marginBottom: 7,
  },

  inputWrapper: {
    minHeight: 54,

    borderRadius: 13,

    borderWidth: 1.3,

    paddingHorizontal: 14,

    flexDirection: 'row',

    alignItems: 'center',
  },

  inputWrapperError: {
    borderWidth: 1.5,
  },

  input: {
    flex: 1,

    minHeight: 50,

    fontSize: 15,

    fontFamily: APP_FONT,

    paddingHorizontal: 10,

    paddingVertical: 10,

    textAlignVertical: 'center',

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

    flex: 1,
  },

  // ==========================================================
  // FORGOT
  // ==========================================================

  forgotPassword: {
    alignSelf: 'flex-end',

    marginTop: -3,

    marginBottom: 19,

    paddingVertical: 5,
  },

  forgotPasswordText: {
    color: GREEN_THEME,

    fontSize: 13,

    fontFamily:
      APP_FONT_BOLD,
  },

  // ==========================================================
  // LOGIN BUTTON
  // ==========================================================

  loginButton: {
    borderRadius: 14,

    overflow: 'hidden',

    marginBottom: 20,

    backgroundColor: GREEN_THEME,

    shadowColor:
      GREEN_THEME,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.22,

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

    backgroundColor: GREEN_THEME,
  },

  loginButtonText: {
    color: WHITE,

    fontSize: 16,

    fontFamily:
      APP_FONT_BOLD,
  },

  // ==========================================================
  // DIVIDER
  // ==========================================================

  dividerContainer: {
    flexDirection: 'row',

    alignItems: 'center',

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

    gap: 10,

    marginBottom: 23,
  },

  socialButton: {
    flex: 1,

    minHeight: 50,

    borderRadius: 12,

    borderWidth: 1,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,
  },

  googleIcon: {
    width: 20,
    height: 20,
  },

  socialButtonText: {
    fontSize: 14,

    fontFamily:
      APP_FONT_MEDIUM,
  },

  appleButton: {
    backgroundColor: '#000000',

    borderColor: '#000000',
  },

  appleButtonText: {
    color: WHITE,

    fontSize: 14,

    fontFamily:
      APP_FONT_MEDIUM,
  },

  // ==========================================================
  // REGISTER
  // ==========================================================

  registerContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    flexWrap: 'wrap',

    marginBottom: 19,
  },

  registerText: {
    fontSize: 13.5,

    fontFamily: APP_FONT,

    marginRight: 4,
  },

  registerLink: {
    color: GREEN_THEME,

    fontSize: 13.5,

    fontFamily:
      APP_FONT_BOLD,
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
  // WEB DESKTOP
  // ==========================================================

  webContainer: {
    flex: 1,

    flexDirection: 'row',

    backgroundColor:
      '#F8FAFC',

    minHeight: 0,
  },

  webLeftPanel: {
    flex: 1,

    maxWidth: '50%',

    minHeight: '100%',

    overflow: 'hidden',

    backgroundColor: GREEN_THEME,
  },

  // ==========================================================
  // WEB LEFT HEADER / PANEL
  // ==========================================================

  webLeftGradient: {
    flex: 1,

    paddingHorizontal: 55,

    paddingVertical: 45,

    backgroundColor: GREEN_THEME,
  },

  webLeftContent: {
    flex: 1,

    justifyContent:
      'space-between',

    maxWidth: 600,

    alignSelf: 'center',

    width: '100%',
  },

  // ==========================================================
  // LOGO WEB PREMIUM
  // ==========================================================

  webLogoContainer: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  webLogoFrame: {
    width: 66,
    height: 66,

    borderRadius: 18,

    padding: 8,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.96)',

    borderWidth: 1,

    borderColor:
      'rgba(255,255,255,0.75)',

    marginRight: 14,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,

    elevation: 5,
  },

  webLogoImage: {
    width: 49,
    height: 49,
  },

  webLogoText: {
    color: WHITE,

    fontSize: 22,

    fontFamily:
      APP_FONT_BOLD,

    letterSpacing: 0.2,
  },

  // ==========================================================
  // WEB HERO
  // ==========================================================

  webHero: {
    marginVertical: 35,
  },

  webHeroTitle: {
    color: WHITE,

    fontSize: 40,

    lineHeight: 49,

    fontFamily:
      APP_FONT_BOLD,

    marginBottom: 17,
  },

  webHeroSubtitle: {
    color:
      'rgba(255,255,255,0.90)',

    fontSize: 15,

    lineHeight: 25,

    fontFamily: APP_FONT,

    maxWidth: 510,
  },

  // ==========================================================
  // WEB FEATURES
  // ==========================================================

  webFeatures: {
    gap: 17,
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
    color: WHITE,

    fontSize: 14,

    fontFamily:
      APP_FONT_BOLD,

    marginBottom: 3,
  },

  webFeatureText: {
    color:
      'rgba(255,255,255,0.82)',

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

    justifyContent:
      'space-between',

    alignItems: 'center',

    marginTop: 35,

    paddingTop: 18,

    borderTopWidth: 1,

    borderTopColor:
      'rgba(255,255,255,0.20)',
  },

  webFooterText: {
    color:
      'rgba(255,255,255,0.70)',

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

    minHeight: 0,
  },

  webRightScrollContent: {
    flexGrow: 1,

    justifyContent: 'center',

    paddingHorizontal: 55,

    paddingVertical: 50,
  },

  webRightInner: {
    width: '100%',

    maxWidth: 500,

    alignSelf: 'center',
  },
});

export default LoginScreen;