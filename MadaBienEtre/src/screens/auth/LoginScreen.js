// src/screens/auth/LoginScreen.js
// ============================================================
// MADA BIEN-ÊTRE — LOGIN SCREEN
// RESPONSIVE WEB + MOBILE + ANDROID
// Design cohérent avec WelcomeScreen
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
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import notificationService from '../../services/notificationService';

/* ============================================================
   COLORS
============================================================ */

const COLORS = {
  primary: '#2E7D32',
  primaryDark: '#164B2A',
  primaryMid: '#1F6B38',
  primaryLight: '#EAF5EC',

  background: '#F6FAF7',
  white: '#FFFFFF',

  text: '#17201A',
  textSoft: '#66736A',
  muted: '#8A948C',

  border: '#DDE7DF',
  borderLight: '#E8EFE9',

  red: '#DC2626',
  redLight: '#FEF2F2',

  blue: '#2563EB',
  blueLight: '#EFF6FF',
};

/* ============================================================
   PLATFORM
============================================================ */

const IS_WEB = Platform.OS === 'web';
const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';

const DESKTOP_BREAKPOINT = 950;

/* ============================================================
   TOAST
============================================================ */

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
      <Animated.View
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
            styles.toastIcon,
            {
              backgroundColor:
                current.iconBackground,
            },
          ]}
        >
          <Ionicons
            name={current.icon}
            size={21}
            color={current.iconColor}
          />
        </View>

        <Text
          style={[
            styles.toastText,
            {
              color: current.text,
            },
          ]}
        >
          {message}
        </Text>

        <Pressable
          onPress={onDismiss}
          style={styles.toastClose}
          hitSlop={10}
        >
          <Ionicons
            name="close"
            size={18}
            color={current.text}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
};

/* ============================================================
   LOGIN SCREEN
============================================================ */

export default function LoginScreen({
  navigation,
}) {
  const { width, height } =
    useWindowDimensions();

  /* ==========================================================
     RESPONSIVE
  ========================================================== */

  const isDesktop =
    IS_WEB &&
    width >= DESKTOP_BREAKPOINT;

  const isSmall =
    width < 380;

  const isVerySmall =
    width < 340;

  const isShort =
    height < 680;

  /* ==========================================================
     AUTH
  ========================================================== */

  const { login } = useAuth();

  /* ==========================================================
     STATES
  ========================================================== */

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [errors, setErrors] =
    useState({});

  const [toast, setToast] =
    useState({
      visible: false,
      type: 'info',
      message: '',
    });

  /* ==========================================================
     REFS
  ========================================================== */

  const emailRef =
    useRef(null);

  const passwordRef =
    useRef(null);

  const toastTimer =
    useRef(null);

  /* ==========================================================
     ANIMATION
  ========================================================== */

  const fadeAnim =
    useRef(
      new Animated.Value(0)
    ).current;

  const slideAnim =
    useRef(
      new Animated.Value(25)
    ).current;

  /* ==========================================================
     SAFE TOP
  ========================================================== */

  const androidStatusBar =
    IS_ANDROID
      ? StatusBar.currentHeight || 0
      : 0;

  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  useEffect(() => {
    Animated.parallel([
      Animated.timing(
        fadeAnim,
        {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }
      ),

      Animated.timing(
        slideAnim,
        {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }
      ),
    ]).start();

    requestNotificationPermission();

    return () => {
      if (toastTimer.current) {
        clearTimeout(
          toastTimer.current
        );
      }
    };
  }, []);

  /* ==========================================================
     NOTIFICATION
  ========================================================== */

  const requestNotificationPermission =
    useCallback(async () => {
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
    }, []);

  /* ==========================================================
     TOAST
  ========================================================== */

  const showToast =
    useCallback(
      (
        type,
        message,
        duration = 3500
      ) => {
        if (toastTimer.current) {
          clearTimeout(
            toastTimer.current
          );
        }

        setToast({
          visible: true,
          type,
          message,
        });

        toastTimer.current =
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
      if (toastTimer.current) {
        clearTimeout(
          toastTimer.current
        );

        toastTimer.current = null;
      }

      setToast(
        previous => ({
          ...previous,
          visible: false,
        })
      );
    }, []);

  /* ==========================================================
     VALIDATION EMAIL
  ========================================================== */

  const validateEmail =
    useCallback((value) => {
      if (!value || !value.trim()) {
        return "L'adresse email est requise";
      }

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          value.trim()
        )
      ) {
        return 'Veuillez saisir une adresse email valide';
      }

      return '';
    }, []);

  /* ==========================================================
     VALIDATION PASSWORD
  ========================================================== */

  const validatePassword =
    useCallback((value) => {
      if (!value) {
        return 'Le mot de passe est requis';
      }

      if (value.length < 8) {
        return 'Le mot de passe doit contenir au moins 8 caractères';
      }

      return '';
    }, []);

  /* ==========================================================
     EMAIL CHANGE
  ========================================================== */

  const handleEmailChange =
    useCallback(
      value => {
        setEmail(value);

        if (errors.email) {
          setErrors(
            previous => ({
              ...previous,
              email:
                validateEmail(value),
            })
          );
        }
      },
      [
        errors.email,
        validateEmail,
      ]
    );

  /* ==========================================================
     PASSWORD CHANGE
  ========================================================== */

  const handlePasswordChange =
    useCallback(
      value => {
        setPassword(value);

        if (errors.password) {
          setErrors(
            previous => ({
              ...previous,
              password:
                validatePassword(
                  value
                ),
            })
          );
        }
      },
      [
        errors.password,
        validatePassword,
      ]
    );

  /* ==========================================================
     EMAIL BLUR
  ========================================================== */

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

  /* ==========================================================
     PASSWORD BLUR
  ========================================================== */

  const handlePasswordBlur =
    useCallback(() => {
      const error =
        validatePassword(
          password
        );

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

  /* ==========================================================
     LOGIN
  ========================================================== */

  const handleLogin =
    useCallback(async () => {
      if (isLoading) {
        return;
      }

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

        if (result?.success) {
          showToast(
            'success',
            'Connexion réussie. Bienvenue sur Mada Bien-être !',
            1800
          );

          /*
           * IMPORTANT
           *
           * On ne fait PAS :
           *
           * navigation.reset()
           * navigation.navigate('Main')
           * navigation.replace('Main')
           *
           * Le AuthContext gère automatiquement
           * le changement d'état d'authentification.
           */

          return;
        }

        showToast(
          'error',
          result?.error ||
            'Email ou mot de passe incorrect.',
          4500
        );
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
      isLoading,
      login,
      validateEmail,
      validatePassword,
      showToast,
    ]);

  /* ==========================================================
     NAVIGATION
  ========================================================== */

  const handleBack =
    useCallback(() => {
      Keyboard.dismiss();

      if (
        navigation?.canGoBack?.()
      ) {
        navigation.goBack();
      }
    }, [navigation]);

  const goToRegister =
    useCallback(() => {
      if (isLoading) {
        return;
      }

      Keyboard.dismiss();

      navigation.navigate(
        'Register'
      );
    }, [
      navigation,
      isLoading,
    ]);

  const goToForgotPassword =
    useCallback(() => {
      if (isLoading) {
        return;
      }

      Keyboard.dismiss();

      navigation.navigate(
        'ForgotPassword'
      );
    }, [
      navigation,
      isLoading,
    ]);

  /* ==========================================================
     INPUT COMPONENT
  ========================================================== */

  const renderInput = ({
    label,
    icon,
    value,
    onChangeText,
    onBlur,
    placeholder,
    keyboardType,
    secureTextEntry,
    returnKeyType,
    onSubmitEditing,
    error,
    inputRef,
    rightAction,
  }) => {
    return (
      <View
        style={styles.inputGroup}
      >
        <Text
          style={styles.inputLabel}
        >
          {label}
        </Text>

        <View
          style={[
            styles.inputWrapper,
            error &&
              styles.inputWrapperError,
          ]}
        >
          <View
            style={[
              styles.inputIconBox,
              error &&
                styles.inputIconBoxError,
            ]}
          >
            <Ionicons
              name={icon}
              size={19}
              color={
                error
                  ? COLORS.red
                  : COLORS.primary
              }
            />
          </View>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={
              onChangeText
            }
            onBlur={onBlur}
            placeholder={
              placeholder
            }
            placeholderTextColor={
              '#9AA59D'
            }
            keyboardType={
              keyboardType
            }
            secureTextEntry={
              secureTextEntry
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType={
              returnKeyType
            }
            onSubmitEditing={
              onSubmitEditing
            }
            editable={!isLoading}
            selectionColor={
              COLORS.primary
            }
            textContentType={
              keyboardType ===
              'email-address'
                ? 'emailAddress'
                : 'password'
            }
            autoComplete={
              keyboardType ===
              'email-address'
                ? 'email'
                : 'password'
            }
            blurOnSubmit={
              keyboardType ===
              'email-address'
                ? false
                : true
            }
          />

          {rightAction}
        </View>

        {error ? (
          <View
            style={
              styles.errorRow
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={14}
              color={COLORS.red}
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

  /* ==========================================================
     FORM
  ========================================================== */

  const renderForm = () => (
    <Animated.View
      style={[
        styles.formContainer,
        isDesktop &&
          styles.formContainerDesktop,
        isSmall &&
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
          style={styles.formIcon}
        >
          <Ionicons
            name="leaf-outline"
            size={25}
            color={COLORS.primary}
          />
        </View>

        <Text
          style={styles.formTitle}
        >
          Bon retour parmi nous
        </Text>

        <Text
          style={styles.formSubtitle}
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
        returnKeyType: 'next',
        onSubmitEditing: () => {
          passwordRef.current?.focus();
        },
        error: errors.email,
        inputRef: emailRef,
      })}

      {/* PASSWORD */}

      {renderInput({
        label: 'Mot de passe',
        icon: 'lock-closed-outline',
        value: password,
        onChangeText:
          handlePasswordChange,
        onBlur:
          handlePasswordBlur,
        placeholder:
          'Votre mot de passe',
        secureTextEntry:
          !showPassword,
        returnKeyType: 'done',
        onSubmitEditing:
          handleLogin,
        error: errors.password,
        inputRef:
          passwordRef,

        rightAction: (
          <Pressable
            onPress={() =>
              setShowPassword(
                previous =>
                  !previous
              )
            }
            style={
              styles.eyeButton
            }
            disabled={isLoading}
            hitSlop={8}
          >
            <Ionicons
              name={
                showPassword
                  ? 'eye-off-outline'
                  : 'eye-outline'
              }
              size={21}
              color={
                COLORS.textSoft
              }
            />
          </Pressable>
        ),
      })}

      {/* FORGOT PASSWORD */}

      <Pressable
        onPress={
          goToForgotPassword
        }
        disabled={isLoading}
        style={
          styles.forgotButton
        }
      >
        <Text
          style={
            styles.forgotText
          }
        >
          Mot de passe oublié ?
        </Text>
      </Pressable>

      {/* LOGIN */}

      <Pressable
        onPress={handleLogin}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.loginButton,
          pressed &&
            styles.loginButtonPressed,
          isLoading &&
            styles.loginButtonDisabled,
        ]}
      >
        {isLoading ? (
          <>
            <ActivityIndicator
              size="small"
              color={
                COLORS.white
              }
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

            <View
              style={
                styles.loginArrow
              }
            >
              <Ionicons
                name="arrow-forward"
                size={18}
                color={
                  COLORS.primary
                }
              />
            </View>
          </>
        )}
      </Pressable>

      {/* DIVIDER */}

      <View
        style={
          styles.dividerContainer
        }
      >
        <View
          style={styles.divider}
        />

        <Text
          style={
            styles.dividerText
          }
        >
          ou continuer avec
        </Text>

        <View
          style={styles.divider}
        />
      </View>

      {/* SOCIAL */}

      <View
        style={styles.socialRow}
      >
        <Pressable
          style={
            styles.socialButton
          }
          onPress={() =>
            showToast(
              'info',
              'La connexion avec Google sera bientôt disponible.',
              3000
            )
          }
        >
          <View
            style={
              styles.googleCircle
            }
          >
            <Text
              style={
                styles.googleG
              }
            >
              G
            </Text>
          </View>

          <Text
            style={
              styles.socialText
            }
          >
            Google
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.socialButton,
            styles.appleButton,
          ]}
          onPress={() =>
            showToast(
              'info',
              'La connexion avec Apple sera bientôt disponible.',
              3000
            )
          }
        >
          <Ionicons
            name="logo-apple"
            size={21}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.appleText
            }
          >
            Apple
          </Text>
        </Pressable>
      </View>

      {/* REGISTER */}

      <View
        style={
          styles.registerContainer
        }
      >
        <Text
          style={
            styles.registerText
          }
        >
          Pas encore de compte ?
        </Text>

        <Pressable
          onPress={
            goToRegister
          }
          disabled={isLoading}
        >
          <Text
            style={
              styles.registerLink
            }
          >
            Créer un compte
          </Text>
        </Pressable>
      </View>

      {/* SECURITY */}

      <View
        style={
          styles.securityBox
        }
      >
        <View
          style={
            styles.securityIcon
          }
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={
              COLORS.primary
            }
          />
        </View>

        <Text
          style={
            styles.securityText
          }
        >
          Vos informations sont
          protégées et sécurisées.
        </Text>
      </View>
    </Animated.View>
  );

  /* ==========================================================
     MOBILE HEADER
  ========================================================== */

  const renderMobileHeader =
    () => (
      <View
        style={[
          styles.mobileHeader,
          {
            paddingTop:
              androidStatusBar +
              (isShort ? 7 : 10),
          },
        ]}
      >
        <Pressable
          onPress={handleBack}
          style={
            styles.backButton
          }
          hitSlop={8}
        >
          <Ionicons
            name="arrow-back"
            size={21}
            color={
              COLORS.primaryDark
            }
          />
        </Pressable>

        <View
          style={
            styles.mobileBrand
          }
        >
          <View
            style={
              styles.mobileLogoBox
            }
          >
            <Image
              source={require('../../../assets/logo.png')}
              style={
                styles.mobileLogo
              }
              resizeMode="contain"
            />
          </View>

          <View
            style={
              styles.mobileBrandText
            }
          >
            <Text
              style={
                styles.mobileBrandName
              }
            >
              Mada Bien-être
            </Text>

            <Text
              style={
                styles.mobileBrandSubtitle
              }
            >
              Votre bien-être, notre priorité
            </Text>
          </View>
        </View>
      </View>
    );

  /* ==========================================================
     MOBILE
  ========================================================== */

  const renderMobile =
    () => (
      <KeyboardAvoidingView
        style={
          styles.mobileRoot
        }
        behavior={
          IS_IOS
            ? 'padding'
            : undefined
        }
      >
        <TouchableWithoutFeedback
          onPress={() =>
            Keyboard.dismiss()
          }
        >
          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              IS_IOS
                ? 'interactive'
                : 'on-drag'
            }
            contentContainerStyle={[
              styles.mobileScrollContent,
              isShort &&
                styles.mobileScrollShort,
            ]}
          >
            {renderMobileHeader()}

            <View
              style={
                styles.mobileHero
              }
            >
              <View
                style={
                  styles.mobileHeroBadge
                }
              >
                <View
                  style={
                    styles.badgeDot
                  }
                />

                <Text
                  style={
                    styles.mobileHeroBadgeText
                  }
                >
                  BIEN-ÊTRE • SANTÉ • SÉRÉNITÉ
                </Text>
              </View>

              <Text
                style={
                  styles.mobileHeroTitle
                }
              >
                Votre bien-être,
                {'\n'}
                <Text
                  style={
                    styles.mobileHeroGreen
                  }
                >
                  commence ici.
                </Text>
              </Text>

              <Text
                style={
                  styles.mobileHeroDescription
                }
              >
                Retrouvez votre espace personnel
                et profitez d'une expérience
                simple, sécurisée et personnalisée.
              </Text>
            </View>

            {renderForm()}

            {/* MOBILE FOOTER */}

            <View
              style={
                styles.mobileFooter
              }
            >
              <View
                style={
                  styles.footerLine
                }
              />

              <View
                style={
                  styles.footerFeatures
                }
              >
                <View
                  style={
                    styles.footerFeature
                  }
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.footerFeatureText
                    }
                  >
                    Sécurisé
                  </Text>
                </View>

                <View
                  style={
                    styles.footerFeature
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.footerFeatureText
                    }
                  >
                    À domicile
                  </Text>
                </View>

                <View
                  style={
                    styles.footerFeature
                  }
                >
                  <Ionicons
                    name="heart-outline"
                    size={16}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.footerFeatureText
                    }
                  >
                    Bien-être
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.footerCopyright
                }
              >
                © 2026 Mada Bien-être
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );

  /* ==========================================================
     WEB
  ========================================================== */

  const renderWeb =
    () => (
      <View
        style={
          styles.webRoot
        }
      >
        {/* ==================================================
            LEFT SIDE
        ================================================== */}

        <View
          style={
            styles.webLeft
          }
        >
          <View
            style={
              styles.webCircleOne
            }
          />

          <View
            style={
              styles.webCircleTwo
            }
          />

          <View
            style={
              styles.webLeftContent
            }
          >
            {/* BRAND */}

            <View
              style={
                styles.webBrand
              }
            >
              <View
                style={
                  styles.webLogoBox
                }
              >
                <Image
                  source={require('../../../assets/logo.png')}
                  style={
                    styles.webLogo
                  }
                  resizeMode="contain"
                />
              </View>

              <View>
                <Text
                  style={
                    styles.webBrandName
                  }
                >
                  Mada Bien-être
                </Text>

                <Text
                  style={
                    styles.webBrandSubtitle
                  }
                >
                  Votre bien-être, notre priorité
                </Text>
              </View>
            </View>

            {/* HERO */}

            <View
              style={
                styles.webHero
              }
            >
              <View
                style={
                  styles.webBadge
                }
              >
                <View
                  style={
                    styles.webBadgeDot
                  }
                />

                <Text
                  style={
                    styles.webBadgeText
                  }
                >
                  BIEN-ÊTRE • SANTÉ • SÉRÉNITÉ
                </Text>
              </View>

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
                  styles.webHeroDescription
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
                    size={21}
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
                    Proche de vous
                  </Text>

                  <Text
                    style={
                      styles.webFeatureText
                    }
                  >
                    Trouvez facilement les
                    services disponibles autour
                    de vous.
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
                    size={21}
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
                    Réservation simple
                  </Text>

                  <Text
                    style={
                      styles.webFeatureText
                    }
                  >
                    Organisez facilement votre
                    moment de détente.
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
                    size={21}
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
                    Vos informations personnelles
                    restent protégées.
                  </Text>
                </View>
              </View>
            </View>

            {/* FOOTER */}

            <View
              style={
                styles.webFooter
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
        </View>

        {/* ==================================================
            RIGHT SIDE
        ================================================== */}

        <View
          style={
            styles.webRight
          }
        >
          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.webRightContent
            }
          >
            <View
              style={
                styles.webFormWrapper
              }
            >
              {renderForm()}
            </View>
          </ScrollView>
        </View>
      </View>
    );

  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <View
      style={
        styles.screen
      }
    >
      <StatusBar
        barStyle={
          isDesktop
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          isDesktop
            ? COLORS.primaryDark
            : COLORS.white
        }
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

      {isDesktop
        ? renderWeb()
        : renderMobile()}
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({

  /* ==========================================================
     GENERAL
  ========================================================== */

  screen: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  /* ==========================================================
     TOAST
  ========================================================== */

  toastOverlay: {
    position: 'absolute',
    top: IS_ANDROID
      ? (StatusBar.currentHeight || 0) + 8
      : 15,
    left: 12,
    right: 12,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },

  toastContainer: {
    width: '100%',
    maxWidth: 560,
    minHeight: 60,
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
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },

  toastIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  toastText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },

  toastClose: {
    width: 34,
    height: 34,
    borderRadius: 17,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,
  },

  /* ==========================================================
     MOBILE ROOT
  ========================================================== */

  mobileRoot: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  mobileScrollContent: {
    flexGrow: 1,
    paddingBottom: 25,
  },

  mobileScrollShort: {
    paddingBottom: 15,
  },

  /* ==========================================================
     MOBILE HEADER
  ========================================================== */

  mobileHeader: {
    width: '100%',
    minHeight: 76,

    paddingHorizontal: 16,
    paddingBottom: 9,

    backgroundColor:
      COLORS.white,

    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.borderLight,

    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,

    backgroundColor:
      COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',

    flex: 1,
  },

  mobileLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,

    backgroundColor:
      COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  mobileLogo: {
    width: 37,
    height: 37,
  },

  mobileBrandText: {
    flex: 1,
  },

  mobileBrandName: {
    color:
      COLORS.primaryDark,

    fontSize: 17,
    fontWeight: '900',
  },

  mobileBrandSubtitle: {
    color:
      COLORS.textSoft,

    fontSize: 9.5,

    marginTop: 2,
  },

  /* ==========================================================
     MOBILE HERO
  ========================================================== */

  mobileHero: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 4,
  },

  mobileHeroBadge: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 11,
    paddingVertical: 7,

    backgroundColor:
      COLORS.white,

    borderRadius: 100,

    borderWidth: 1,
    borderColor:
      COLORS.border,

    marginBottom: 17,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },

  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,

    backgroundColor:
      COLORS.primary,

    marginRight: 7,
  },

  mobileHeroBadgeText: {
    color:
      COLORS.primaryDark,

    fontSize: 9,
    fontWeight: '900',

    letterSpacing: 0.5,
  },

  mobileHeroTitle: {
    color:
      COLORS.text,

    fontSize: 34,
    lineHeight: 40,

    fontWeight: '900',

    letterSpacing: -0.7,
  },

  mobileHeroGreen: {
    color:
      COLORS.primary,
  },

  mobileHeroDescription: {
    color:
      COLORS.textSoft,

    fontSize: 14,
    lineHeight: 21,

    marginTop: 12,

    maxWidth: 440,
  },

  /* ==========================================================
     FORM
  ========================================================== */

  formContainer: {
    width: '100%',

    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 28,
  },

  formContainerSmall: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },

  formContainerDesktop: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,

    maxWidth: 470,
    alignSelf: 'center',
  },

  formHeader: {
    marginBottom: 22,
  },

  formIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,

    backgroundColor:
      COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 13,
  },

  formTitle: {
    color:
      COLORS.text,

    fontSize: 25,
    lineHeight: 31,

    fontWeight: '900',

    letterSpacing: -0.4,
  },

  formSubtitle: {
    color:
      COLORS.textSoft,

    fontSize: 13.5,
    lineHeight: 20,

    marginTop: 6,

    maxWidth: 440,
  },

  /* ==========================================================
     INPUT
  ========================================================== */

  inputGroup: {
    marginBottom: 15,
  },

  inputLabel: {
    color:
      COLORS.text,

    fontSize: 13,
    fontWeight: '800',

    marginBottom: 7,
  },

  inputWrapper: {
    minHeight: 56,

    borderRadius: 14,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    backgroundColor:
      COLORS.white,

    flexDirection: 'row',
    alignItems: 'center',

    paddingLeft: 8,
    paddingRight: 7,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.025,
    shadowRadius: 4,
    elevation: 1,
  },

  inputWrapperError: {
    borderColor:
      COLORS.red,

    backgroundColor:
      '#FFFDFD',
  },

  inputIconBox: {
    width: 39,
    height: 39,
    borderRadius: 11,

    backgroundColor:
      COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 3,
  },

  inputIconBoxError: {
    backgroundColor:
      COLORS.redLight,
  },

  input: {
    flex: 1,

    minHeight: 52,

    color:
      COLORS.text,

    fontSize: 14.5,

    paddingHorizontal: 10,
    paddingVertical: 9,

    outlineStyle: 'none',
  },

  eyeButton: {
    width: 40,
    height: 42,

    alignItems: 'center',
    justifyContent: 'center',
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 5,

    gap: 5,
  },

  errorText: {
    flex: 1,

    color:
      COLORS.red,

    fontSize: 11.5,
    lineHeight: 16,
  },

  /* ==========================================================
     FORGOT
  ========================================================== */

  forgotButton: {
    alignSelf: 'flex-end',

    paddingVertical: 5,

    marginTop: -3,
    marginBottom: 15,
  },

  forgotText: {
    color:
      COLORS.primary,

    fontSize: 12.5,
    fontWeight: '800',
  },

  /* ==========================================================
     LOGIN BUTTON
  ========================================================== */

  loginButton: {
    width: '100%',
    minHeight: 55,

    borderRadius: 14,

    backgroundColor:
      COLORS.primary,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 18,

    gap: 10,

    shadowColor:
      COLORS.primary,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.20,
    shadowRadius: 10,

    elevation: 5,
  },

  loginButtonPressed: {
    opacity: 0.88,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  loginButtonDisabled: {
    opacity: 0.65,
  },

  loginButtonText: {
    color:
      COLORS.white,

    fontSize: 15,
    fontWeight: '900',
  },

  loginArrow: {
    width: 31,
    height: 31,
    borderRadius: 16,

    backgroundColor:
      COLORS.white,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 2,
  },

  /* ==========================================================
     DIVIDER
  ========================================================== */

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    marginVertical: 19,
  },

  divider: {
    flex: 1,
    height: 1,

    backgroundColor:
      COLORS.border,
  },

  dividerText: {
    color:
      COLORS.muted,

    fontSize: 10.5,

    marginHorizontal: 11,
  },

  /* ==========================================================
     SOCIAL
  ========================================================== */

  socialRow: {
    flexDirection: 'row',

    gap: 10,

    marginBottom: 19,
  },

  socialButton: {
    flex: 1,

    minHeight: 49,

    borderRadius: 13,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    backgroundColor:
      COLORS.white,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 8,
  },

  googleCircle: {
    width: 22,
    height: 22,

    borderRadius: 11,

    backgroundColor:
      '#F5F7F5',

    alignItems: 'center',
    justifyContent: 'center',
  },

  googleG: {
    color: '#4285F4',

    fontSize: 15,
    fontWeight: '900',
  },

  socialText: {
    color:
      COLORS.text,

    fontSize: 13,
    fontWeight: '700',
  },

  appleButton: {
    backgroundColor:
      '#111111',

    borderColor:
      '#111111',
  },

  appleText: {
    color:
      COLORS.white,

    fontSize: 13,
    fontWeight: '700',
  },

  /* ==========================================================
     REGISTER
  ========================================================== */

  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    flexWrap: 'wrap',

    marginBottom: 18,
  },

  registerText: {
    color:
      COLORS.textSoft,

    fontSize: 12.5,

    marginRight: 4,
  },

  registerLink: {
    color:
      COLORS.primary,

    fontSize: 12.5,

    fontWeight: '900',
  },

  /* ==========================================================
     SECURITY
  ========================================================== */

  securityBox: {
    minHeight: 47,

    borderRadius: 12,

    borderWidth: 1,

    borderColor:
      COLORS.borderLight,

    backgroundColor:
      '#F9FBF9',

    paddingHorizontal: 11,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,
  },

  securityIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,

    backgroundColor:
      COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',
  },

  securityText: {
    flex: 1,

    color:
      COLORS.textSoft,

    fontSize: 10.5,
    lineHeight: 15,
  },

  /* ==========================================================
     MOBILE FOOTER
  ========================================================== */

  mobileFooter: {
    paddingHorizontal: 20,
    paddingTop: 5,
  },

  footerLine: {
    height: 1,

    backgroundColor:
      COLORS.border,

    marginBottom: 17,
  },

  footerFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',

    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },

  footerFeature: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 5,
  },

  footerFeatureText: {
    color:
      COLORS.textSoft,

    fontSize: 10.5,
    fontWeight: '700',
  },

  footerCopyright: {
    color:
      COLORS.muted,

    fontSize: 9.5,

    textAlign: 'center',

    marginTop: 15,
    marginBottom: 5,
  },

  /* ==========================================================
     WEB ROOT
  ========================================================== */

  webRoot: {
    flex: 1,

    flexDirection: 'row',

    backgroundColor:
      COLORS.background,
  },

  /* ==========================================================
     WEB LEFT
  ========================================================== */

  webLeft: {
    flex: 1,

    maxWidth: '52%',

    minHeight: '100%',

    backgroundColor:
      COLORS.primaryDark,

    overflow: 'hidden',

    position: 'relative',
  },

  webCircleOne: {
    position: 'absolute',

    width: 420,
    height: 420,

    borderRadius: 210,

    right: -160,
    top: -90,

    backgroundColor:
      'rgba(255,255,255,0.06)',
  },

  webCircleTwo: {
    position: 'absolute',

    width: 350,
    height: 350,

    borderRadius: 175,

    left: -160,
    bottom: -130,

    backgroundColor:
      'rgba(67,160,71,0.20)',
  },

  webLeftContent: {
    flex: 1,

    width: '100%',
    maxWidth: 650,

    alignSelf: 'center',

    paddingHorizontal: 48,
    paddingVertical: 38,

    justifyContent:
      'space-between',
  },

  /* ==========================================================
     WEB BRAND
  ========================================================== */

  webBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  webLogoBox: {
    width: 58,
    height: 58,

    borderRadius: 17,

    backgroundColor:
      COLORS.white,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 12,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },

  webLogo: {
    width: 44,
    height: 44,
  },

  webBrandName: {
    color:
      COLORS.white,

    fontSize: 20,
    fontWeight: '900',
  },

  webBrandSubtitle: {
    color:
      'rgba(255,255,255,0.72)',

    fontSize: 10.5,

    marginTop: 3,
  },

  /* ==========================================================
     WEB HERO
  ========================================================== */

  webHero: {
    marginTop: 55,

    marginBottom: 35,
  },

  webBadge: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor:
      'rgba(255,255,255,0.10)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.15)',

    borderRadius: 100,

    paddingHorizontal: 12,
    paddingVertical: 8,

    marginBottom: 20,
  },

  webBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,

    backgroundColor:
      '#8BD394',

    marginRight: 8,
  },

  webBadgeText: {
    color:
      '#D9F0DD',

    fontSize: 9.5,
    fontWeight: '900',

    letterSpacing: 0.7,
  },

  webHeroTitle: {
    color:
      COLORS.white,

    fontSize: 43,
    lineHeight: 52,

    fontWeight: '900',

    letterSpacing: -1,
  },

  webHeroDescription: {
    color:
      'rgba(255,255,255,0.82)',

    fontSize: 15,
    lineHeight: 24,

    marginTop: 17,

    maxWidth: 520,
  },

  /* ==========================================================
     WEB FEATURES
  ========================================================== */

  webFeatures: {
    gap: 18,
  },

  webFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    gap: 13,
  },

  webFeatureIcon: {
    width: 43,
    height: 43,

    borderRadius: 13,

    backgroundColor:
      'rgba(255,255,255,0.13)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  webFeatureContent: {
    flex: 1,
  },

  webFeatureTitle: {
    color:
      COLORS.white,

    fontSize: 13.5,
    fontWeight: '900',

    marginBottom: 3,
  },

  webFeatureText: {
    color:
      'rgba(255,255,255,0.68)',

    fontSize: 11.5,
    lineHeight: 17,

    maxWidth: 410,
  },

  /* ==========================================================
     WEB FOOTER
  ========================================================== */

  webFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',

    borderTopWidth: 1,
    borderTopColor:
      'rgba(255,255,255,0.15)',

    paddingTop: 17,

    marginTop: 30,
  },

  webFooterText: {
    color:
      'rgba(255,255,255,0.55)',

    fontSize: 10,
  },

  /* ==========================================================
     WEB RIGHT
  ========================================================== */

  webRight: {
    flex: 1,

    maxWidth: '48%',

    backgroundColor:
      COLORS.background,
  },

  webRightContent: {
    flexGrow: 1,

    justifyContent: 'center',

    paddingHorizontal: 50,
    paddingVertical: 40,
  },

  webFormWrapper: {
    width: '100%',
    maxWidth: 470,

    alignSelf: 'center',
  },
});