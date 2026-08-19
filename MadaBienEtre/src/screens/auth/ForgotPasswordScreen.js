// src/screens/auth/ForgotPasswordScreen.js

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
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import FormInput from '../../components/common/FormInput';


// ============================================================
// FORGOT PASSWORD SCREEN
// ============================================================

const ForgotPasswordScreen = ({ navigation }) => {

  // ==========================================================
  // STATE
  // ==========================================================

  const [email, setEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });


  // ==========================================================
  // REFS
  // ==========================================================

  const toastAnim = useRef(
    new Animated.Value(0)
  ).current;

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  const toastTimer = useRef(null);


  // ==========================================================
  // CONTEXT
  // ==========================================================

  const { forgotPassword } = useAuth();

  const { isDark } = useTheme();


  // ==========================================================
  // DIMENSIONS
  // ==========================================================

  const {
    width,
    height,
  } = useWindowDimensions();


  // ==========================================================
  // RESPONSIVE
  // ==========================================================

  const isWeb = Platform.OS === 'web';

  const isDesktop =
    isWeb &&
    width >= 1100;

  const isTablet =
    width >= 768 &&
    width < 1100;

  const isMobile =
    !isWeb ||
    width < 768;

  const isSmallScreen =
    height < 700;

  const isVerySmallScreen =
    height < 600;


  // ==========================================================
  // TOAST CONFIGURATION
  // ==========================================================

  const toastConfig = {
    success: {
      icon: 'checkmark-circle',
      color: '#00C853',

      background: isDark
        ? '#17351F'
        : '#EAF8EF',

      border: isDark
        ? '#28683C'
        : '#B8E7C7',
    },

    error: {
      icon: 'close-circle',
      color: '#E53935',

      background: isDark
        ? '#3A1C1C'
        : '#FFF0F0',

      border: isDark
        ? '#743737'
        : '#F2BABA',
    },

    warning: {
      icon: 'warning',
      color: '#F59E0B',

      background: isDark
        ? '#3A2E17'
        : '#FFF8E6',

      border: isDark
        ? '#705B2D'
        : '#F3D68B',
    },

    info: {
      icon: 'information-circle',
      color: colors.primary,

      background: isDark
        ? '#18243D'
        : '#EEF4FF',

      border: isDark
        ? '#2D4675'
        : '#C8D8F7',
    },
  };


  // ==========================================================
  // SHOW TOAST
  // ==========================================================

  const showToast = useCallback(
    (
      type,
      title,
      message,
      duration = 3000
    ) => {

      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast({
        visible: true,
        type,
        title,
        message,
      });

      toastAnim.setValue(0);

      Animated.spring(
        toastAnim,
        {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }
      ).start();

      toastTimer.current = setTimeout(() => {

        Animated.timing(
          toastAnim,
          {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }
        ).start(() => {

          setToast((prev) => ({
            ...prev,
            visible: false,
          }));

        });

      }, duration);

    },
    [toastAnim]
  );


  // ==========================================================
  // HIDE TOAST
  // ==========================================================

  const hideToast = useCallback(() => {

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    Animated.timing(
      toastAnim,
      {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }
    ).start(() => {

      setToast((prev) => ({
        ...prev,
        visible: false,
      }));

    });

  }, [toastAnim]);


  // ==========================================================
  // KEYBOARD LISTENER
  // ==========================================================

  useEffect(() => {

    if (Platform.OS === 'web') {
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
  // INITIAL ANIMATION
  // ==========================================================

  useEffect(() => {

    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }
    ).start();

    return () => {

      if (toastTimer.current) {
        clearTimeout(
          toastTimer.current
        );
      }

    };

  }, [fadeAnim]);


  // ==========================================================
  // EMAIL VALIDATION
  // ==========================================================

  const validateEmail = (value) => {

    if (!value.trim()) {

      return 'Veuillez saisir votre adresse email';

    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value.trim())) {

      return 'Veuillez saisir une adresse email valide';

    }

    return null;
  };


  // ==========================================================
  // SEND RESET CODE
  // ==========================================================

  const handleSendResetLink = async () => {

    Keyboard.dismiss();

    const normalizedEmail =
      email.trim().toLowerCase();


    // --------------------------------------------------------
    // EMPTY / INVALID EMAIL
    // --------------------------------------------------------

    const emailError =
      validateEmail(
        normalizedEmail
      );

    if (emailError) {

      showToast(
        'warning',
        'Email incorrect',
        emailError,
        3200
      );

      return;
    }


    // --------------------------------------------------------
    // PREVENT DOUBLE REQUEST
    // --------------------------------------------------------

    if (isLoading) {
      return;
    }


    // --------------------------------------------------------
    // LOADING
    // --------------------------------------------------------

    setIsLoading(true);

    showToast(
      'info',
      'Envoi en cours',
      'Nous préparons votre code de réinitialisation...',
      1800
    );


    // --------------------------------------------------------
    // API
    // --------------------------------------------------------

    try {

      const result =
        await forgotPassword(
          normalizedEmail
        );


      setIsLoading(false);


      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      if (result?.success) {

        showToast(
          'success',
          'Code envoyé',
          'Un code OTP à 6 chiffres a été envoyé à votre adresse email.',
          3500
        );


        setTimeout(() => {

          navigation.navigate(
            'ResetPassword',
            {
              email:
                normalizedEmail,
            }
          );

        }, 1000);


        return;
      }


      // ------------------------------------------------------
      // API ERROR
      // ------------------------------------------------------

      let errorMessage =
        result?.error ||
        'Impossible d’envoyer le code OTP.';


      if (
        typeof errorMessage === 'string' &&
        (
          errorMessage
            .toLowerCase()
            .includes('not found') ||

          errorMessage
            .toLowerCase()
            .includes('user not found') ||

          errorMessage
            .toLowerCase()
            .includes('does not exist')
        )
      ) {

        errorMessage =
          'Aucun compte ne correspond à cette adresse email.';

      }


      showToast(
        'error',
        'Envoi impossible',
        errorMessage,
        4500
      );

    } catch (error) {

      setIsLoading(false);

      console.error(
        'Forgot password error:',
        error
      );


      showToast(
        'error',
        'Erreur',
        error?.message ||
          'Une erreur est survenue lors de l’envoi du code OTP.',
        4500
      );

    }

  };


  // ==========================================================
  // BACK ACTION
  // ==========================================================

  const handleBack = () => {

    Keyboard.dismiss();

    showToast(
      'info',
      'Retour',
      'Retour vers la page précédente...',
      1200
    );

    setTimeout(() => {
      navigation.goBack();
    }, 350);

  };


  // ==========================================================
  // LOGIN ACTION
  // ==========================================================

  const handleBackToLogin = () => {

    Keyboard.dismiss();

    showToast(
      'info',
      'Connexion',
      'Retour vers la page de connexion...',
      1200
    );

    setTimeout(() => {

      navigation.navigate(
        'Login'
      );

    }, 350);

  };


  // ==========================================================
  // TOAST COMPONENT
  // ==========================================================

  const renderToast = () => {

    if (!toast.visible) {
      return null;
    }

    const config =
      toastConfig[toast.type] ||
      toastConfig.info;


    return (
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.toastWrapper,

          isDesktop
            ? styles.toastDesktop
            : styles.toastMobile,

          {
            opacity: toastAnim,

            transform: [

              {
                translateY:
                  toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-35, 0],
                  }),
              },

              {
                scale:
                  toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
              },

            ],
          },
        ]}
      >

        <Pressable
          onPress={hideToast}
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

          {/* ICON */}

          <View
            style={[
              styles.toastIconContainer,
              {
                backgroundColor:
                  `${config.color}18`,
              },
            ]}
          >

            <Ionicons
              name={config.icon}
              size={22}
              color={config.color}
            />

          </View>


          {/* CONTENT */}

          <View
            style={styles.toastContent}
          >

            <Text
              style={[
                styles.toastTitle,
                {
                  color: isDark
                    ? '#FFFFFF'
                    : '#1A1A1A',
                },
              ]}
            >
              {toast.title}
            </Text>


            <Text
              style={[
                styles.toastMessage,
                {
                  color: isDark
                    ? '#C5C5C5'
                    : '#626262',
                },
              ]}
              numberOfLines={4}
            >
              {toast.message}
            </Text>

          </View>


          {/* CLOSE */}

          <TouchableOpacity
            onPress={hideToast}
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
              color={
                isDark
                  ? '#AAAAAA'
                  : '#777777'
              }
            />

          </TouchableOpacity>

        </Pressable>

      </Animated.View>
    );

  };


  // ==========================================================
  // FORM
  // ==========================================================

  const renderForm = () => {

    return (
      <Animatable.View
        animation="fadeInUp"
        delay={180}
        duration={700}
        style={styles.formWrapper}
      >

        {/* ==================================================
            FORM HEADER
        ================================================== */}

        <View
          style={styles.formHeading}
        >

          <View
            style={[
              styles.formHeadingIcon,
              {
                backgroundColor:
                  isDark
                    ? 'rgba(255,255,255,0.08)'
                    : '#E8F3E9',
              },
            ]}
          >

            <Ionicons
              name="key-outline"
              size={23}
              color={colors.primary}
            />

          </View>


          <Text
            style={[
              styles.title,
              {
                color: isDark
                  ? '#FFFFFF'
                  : '#1A1A1A',
              },
            ]}
          >
            Réinitialisation
          </Text>


          <Text
            style={[
              styles.subtitle,
              {
                color: isDark
                  ? '#AAAAAA'
                  : '#757575',
              },
            ]}
          >
            Entrez votre adresse email pour recevoir
            votre code de réinitialisation.
          </Text>

        </View>


        {/* ==================================================
            EMAIL
        ================================================== */}

        <View
          style={styles.inputContainer}
        >

          <FormInput
            label="Adresse email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="exemple@email.com"
            isDark={isDark}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={
              handleSendResetLink
            }
          />

        </View>


        {/* ==================================================
            BUTTON
        ================================================== */}

        <Pressable
          onPress={
            handleSendResetLink
          }
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Envoyer le code de réinitialisation"
          style={({ pressed, hovered, focused }) => [

            styles.resetButton,

            isLoading &&
              styles.resetButtonDisabled,

            hovered &&
              isWeb &&
              styles.resetButtonHover,

            pressed &&
              styles.resetButtonPressed,

            focused &&
              isWeb &&
              styles.resetButtonFocused,

          ]}
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
            style={
              styles.resetGradient
            }
          >

            {isLoading ? (

              <View
                style={
                  styles.loadingContent
                }
              >

                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />

                <Text
                  style={
                    styles.loadingText
                  }
                >
                  Envoi en cours...
                </Text>

              </View>

            ) : (

              <>

                <Text
                  style={
                    styles.resetButtonText
                  }
                >
                  Envoyer le code
                </Text>


                <View
                  style={
                    styles.resetArrow
                  }
                >

                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color="#FFFFFF"
                  />

                </View>

              </>

            )}

          </LinearGradient>

        </Pressable>


        {/* ==================================================
            BACK LOGIN
        ================================================== */}

        <Pressable
          onPress={
            handleBackToLogin
          }
          style={({ pressed }) => [

            styles.backToLogin,

            pressed &&
              styles.backToLoginPressed,

          ]}
        >

          <Ionicons
            name="arrow-back"
            size={17}
            color={
              colors.primary
            }
          />

          <Text
            style={
              styles.backToLoginText
            }
          >
            Retour à la connexion
          </Text>

        </Pressable>


        {/* ==================================================
            INFORMATION
        ================================================== */}

        <View
          style={[
            styles.infoContainer,
            {
              backgroundColor:
                isDark
                  ? '#1B1B1B'
                  : '#F7F9F7',

              borderColor:
                isDark
                  ? '#303030'
                  : '#E5EAE6',
            },
          ]}
        >

          <View
            style={
              styles.infoIcon
            }
          >

            <Ionicons
              name="information-circle"
              size={20}
              color={
                colors.primary
              }
            />

          </View>


          <Text
            style={[
              styles.infoText,
              {
                color: isDark
                  ? '#AAAAAA'
                  : '#757575',
              },
            ]}
          >
            Un code OTP à 6 chiffres sera envoyé à
            votre adresse email. Vérifiez également
            votre dossier spam.
          </Text>

        </View>

      </Animatable.View>
    );
  };


  // ==========================================================
  // MOBILE / TABLET
  // ==========================================================

  const renderMobile = () => {

    const horizontalPadding =
      isTablet
        ? 28
        : 18;


    return (
      <SafeAreaView
        style={
          styles.mobileSafeArea
        }
      >

        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />


        <LinearGradient
          colors={[
            '#164B2A',
            '#1F6B38',
            '#2E7D32',
            '#4CAF50',
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
            styles.mobileGradient
          }
        >

          {/* ==================================================
              DECORATION
          ================================================== */}

          <View
            pointerEvents="none"
            style={[
              styles.circleTop,
              {
                width:
                  isTablet
                    ? 360
                    : 260,

                height:
                  isTablet
                    ? 360
                    : 260,

                borderRadius:
                  isTablet
                    ? 180
                    : 130,
              },
            ]}
          />


          <View
            pointerEvents="none"
            style={[
              styles.circleMiddle,
              {
                width:
                  isTablet
                    ? 240
                    : 180,

                height:
                  isTablet
                    ? 240
                    : 180,

                borderRadius:
                  isTablet
                    ? 120
                    : 90,
              },
            ]}
          />


          <View
            pointerEvents="none"
            style={[
              styles.circleBottom,
              {
                width:
                  isTablet
                    ? 360
                    : 280,

                height:
                  isTablet
                    ? 360
                    : 280,

                borderRadius:
                  isTablet
                    ? 180
                    : 140,
              },
            ]}
          />


          {/* ==================================================
              KEYBOARD AVOIDING
          ================================================== */}

          <KeyboardAvoidingView
            style={
              styles.mobileKeyboardView
            }
            behavior={
              Platform.OS === 'ios'
                ? 'padding'
                : 'height'
            }
            keyboardVerticalOffset={
              Platform.OS === 'ios'
                ? 10
                : 0
            }
          >

            <ScrollView
              style={
                styles.mobileScroll
              }
              contentContainerStyle={[
                styles.mobileScrollContent,

                {
                  paddingTop:
                    keyboardVisible
                      ? 10
                      : isVerySmallScreen
                        ? 12
                        : isSmallScreen
                          ? 18
                          : 28,

                  paddingBottom:
                    keyboardVisible
                      ? 30
                      : 38,

                  paddingHorizontal:
                    horizontalPadding,

                  justifyContent:
                    'flex-start',
                },
              ]}
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === 'ios'
                  ? 'interactive'
                  : 'on-drag'
              }
              automaticallyAdjustKeyboardInsets={
                Platform.OS === 'ios'
              }
            >

              <Animated.View
                style={[
                  styles.mobileWrapper,
                  {
                    opacity:
                      fadeAnim,
                  },
                ]}
              >

                {/* ==================================================
                    BACK
                ================================================== */}

                <Pressable
                  onPress={
                    handleBack
                  }
                  style={({ pressed }) => [

                    styles.mobileBackButton,

                    pressed &&
                      styles.mobileBackButtonPressed,

                  ]}
                >

                  <Ionicons
                    name="arrow-back"
                    size={21}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.mobileBackText
                    }
                  >
                    Retour
                  </Text>

                </Pressable>


                {/* ==================================================
                    HEADER
                ================================================== */}

                {!keyboardVisible && (
                  <Animatable.View
                    animation="fadeInUp"
                    duration={650}
                    delay={150}
                    style={
                      styles.mobileHeaderCard
                    }
                  >

                    <View
                      style={
                        styles.mobileKeyIcon
                      }
                    >

                      <Ionicons
                        name="key"
                        size={30}
                        color="#FFFFFF"
                      />

                    </View>


                    <Text
                      style={
                        styles.mobileHeaderTitle
                      }
                    >
                      Mot de passe oublié
                    </Text>


                    <Text
                      style={
                        styles.mobileHeaderSubtitle
                      }
                    >
                      Nous allons vous aider à récupérer
                      l'accès à votre compte.
                    </Text>

                  </Animatable.View>
                )}


                {/* ==================================================
                    FORM CARD
                ================================================== */}

                <View
                  style={[
                    styles.mobileFormCard,

                    {
                      backgroundColor:
                        isDark
                          ? '#181818'
                          : '#FFFFFF',
                    },

                    keyboardVisible &&
                      styles.mobileFormCardKeyboard,
                  ]}
                >

                  {renderForm()}

                </View>


                {/* ==================================================
                    FOOTER
                ================================================== */}

                {!keyboardVisible && (
                  <View
                    style={
                      styles.mobileFooter
                    }
                  >

                    <Ionicons
                      name="lock-closed-outline"
                      size={13}
                      color="rgba(255,255,255,0.65)"
                    />

                    <Text
                      style={
                        styles.mobileFooterText
                      }
                    >
                      Une expérience bien-être sécurisée
                    </Text>

                  </View>
                )}

              </Animated.View>

            </ScrollView>

          </KeyboardAvoidingView>

        </LinearGradient>

      </SafeAreaView>
    );
  };


  // ==========================================================
  // DESKTOP WEB
  // ==========================================================

  const renderDesktop = () => {

    return (
      <SafeAreaView
        style={
          styles.desktopSafeArea
        }
      >

        <StatusBar
          barStyle="light-content"
          backgroundColor="#164B2A"
        />


        <View
          style={
            styles.desktopContainer
          }
        >

          {/* ==================================================
              LEFT
          ================================================== */}

          <View
            style={
              styles.desktopBrandPanel
            }
          >

            <LinearGradient
              colors={[
                '#2E8B36',
                '#3FA447',
                '#4CAF50',
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
                styles.desktopBrandGradient
              }
            >

              <View
                style={
                  styles.desktopBrandContent
                }
              >

                {/* ICON */}

                <View
                  style={
                    styles.desktopSecurityIcon
                  }
                >

                  <Ionicons
                    name="key"
                    size={34}
                    color="#FFFFFF"
                  />

                </View>


                {/* TITLE */}

                <Text
                  style={
                    styles.desktopBrandTitle
                  }
                >
                  Réinitialisez votre{'\n'}
                  mot de passe{'\n'}
                  en toute sécurité.
                </Text>


                {/* DESCRIPTION */}

                <Text
                  style={
                    styles.desktopBrandDescription
                  }
                >
                  Entrez votre adresse email et
                  recevez instantanément un code
                  de vérification pour récupérer
                  l'accès à votre compte.
                </Text>


                {/* FEATURES */}

                <View
                  style={
                    styles.desktopFeatureList
                  }
                >

                  {/* FEATURE 1 */}

                  <View
                    style={
                      styles.desktopFeatureItem
                    }
                  >

                    <View
                      style={
                        styles.desktopFeatureIcon
                      }
                    >

                      <Ionicons
                        name="mail-outline"
                        size={21}
                        color="#FFFFFF"
                      />

                    </View>


                    <View
                      style={
                        styles.desktopFeatureContent
                      }
                    >

                      <Text
                        style={
                          styles.desktopFeatureTitle
                        }
                      >
                        Code envoyé par email
                      </Text>

                      <Text
                        style={
                          styles.desktopFeatureDescription
                        }
                      >
                        Recevez votre code OTP à 6 chiffres
                      </Text>

                    </View>

                  </View>


                  {/* FEATURE 2 */}

                  <View
                    style={
                      styles.desktopFeatureItem
                    }
                  >

                    <View
                      style={
                        styles.desktopFeatureIcon
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
                        styles.desktopFeatureContent
                      }
                    >

                      <Text
                        style={
                          styles.desktopFeatureTitle
                        }
                      >
                        Vérification sécurisée
                      </Text>

                      <Text
                        style={
                          styles.desktopFeatureDescription
                        }
                      >
                        Votre identité est protégée
                      </Text>

                    </View>

                  </View>


                  {/* FEATURE 3 */}

                  <View
                    style={
                      styles.desktopFeatureItem
                    }
                  >

                    <View
                      style={
                        styles.desktopFeatureIcon
                      }
                    >

                      <Ionicons
                        name="lock-closed-outline"
                        size={21}
                        color="#FFFFFF"
                      />

                    </View>


                    <View
                      style={
                        styles.desktopFeatureContent
                      }
                    >

                      <Text
                        style={
                          styles.desktopFeatureTitle
                        }
                      >
                        Nouveau mot de passe
                      </Text>

                      <Text
                        style={
                          styles.desktopFeatureDescription
                        }
                      >
                        Récupérez votre compte facilement
                      </Text>

                    </View>

                  </View>

                </View>

              </View>


              {/* LEFT FOOTER */}

              <View
                style={
                  styles.desktopBrandFooter
                }
              >

                <Text
                  style={
                    styles.desktopCopyright
                  }
                >
                  © 2026 Tous droits réservés
                </Text>


                <Text
                  style={
                    styles.desktopFooterRight
                  }
                >
                  Bien-être • Confiance • Proximité
                </Text>

              </View>

            </LinearGradient>

          </View>


          {/* ==================================================
              RIGHT
          ================================================== */}

          <View
            style={
              styles.desktopContentPanel
            }
          >

            <ScrollView
              style={
                styles.desktopScroll
              }
              contentContainerStyle={
                styles.desktopScrollContent
              }
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >

              <Animated.View
                style={[
                  styles.desktopContentWrapper,
                  {
                    opacity:
                      fadeAnim,
                  },
                ]}
              >

                {/* BACK */}

                <Animatable.View
                  animation="fadeInDown"
                  duration={500}
                  delay={50}
                >

                  <Pressable
                    onPress={
                      handleBack
                    }
                    style={({
                      hovered,
                      pressed,
                      focused,
                    }) => [

                      styles.desktopBackButton,

                      hovered &&
                        styles.desktopBackButtonHover,

                      pressed &&
                        styles.desktopBackButtonPressed,

                      focused &&
                        styles.desktopBackButtonFocused,

                    ]}
                  >

                    <Ionicons
                      name="arrow-back"
                      size={19}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={
                        styles.desktopBackText
                      }
                    >
                      Retour
                    </Text>

                  </Pressable>

                </Animatable.View>


                {/* FORM */}

                {renderForm()}


                {/* FOOTER */}

                <View
                  style={
                    styles.desktopFooter
                  }
                >

                  <View
                    style={
                      styles.desktopSecure
                    }
                  >

                    <Ionicons
                      name="lock-closed-outline"
                      size={14}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={
                        styles.desktopSecureText
                      }
                    >
                      Une expérience bien-être sécurisée
                    </Text>

                  </View>


                  <Text
                    style={
                      styles.desktopFooterCopyright
                    }
                  >
                    © 2026 Tous droits réservés
                  </Text>

                </View>

              </Animated.View>

            </ScrollView>

          </View>

        </View>

      </SafeAreaView>
    );
  };


  // ==========================================================
  // CONTENT
  // ==========================================================

  const content =
    isDesktop
      ? renderDesktop()
      : renderMobile();


  // ==========================================================
  // RETURN
  // ==========================================================

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor:
            isDark
              ? '#121212'
              : '#FFFFFF',
        },
      ]}
    >

      {Platform.OS !== 'web' ? (

        <TouchableWithoutFeedback
          onPress={
            Keyboard.dismiss
          }
        >

          {content}

        </TouchableWithoutFeedback>

      ) : (

        content

      )}


      {/* GLOBAL TOAST */}

      {renderToast()}

    </View>
  );
};


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  // ==========================================================
  // ROOT
  // ==========================================================

  root: {
    flex: 1,
  },


  // ==========================================================
  // TOAST
  // ==========================================================

  toastWrapper: {
    position: 'absolute',
    zIndex: 99999,
    elevation: 99999,
  },

  toastDesktop: {
    top: 24,
    right: 28,
    width: 390,
  },

  toastMobile: {
    top: 18,
    left: 16,
    right: 16,
  },

  toastContainer: {
    minHeight: 76,

    borderRadius: 17,

    borderWidth: 1,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 14,
    paddingVertical: 12,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 6,
    },

    shadowOpacity: 0.16,

    shadowRadius: 15,

    elevation: 10,
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
    minWidth: 0,
  },

  toastTitle: {
    fontSize: 14.5,

    fontFamily:
      typography.fontFamily.bold,

    marginBottom: 3,
  },

  toastMessage: {
    fontSize: 12.5,

    lineHeight: 18,

    fontFamily:
      typography.fontFamily.regular,
  },

  toastClose: {
    width: 30,
    height: 30,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,
  },


  // ==========================================================
  // MOBILE
  // ==========================================================

  mobileSafeArea: {
    flex: 1,

    backgroundColor: '#164B2A',
  },

  mobileGradient: {
    flex: 1,

    width: '100%',

    minHeight: '100%',
  },

  mobileKeyboardView: {
    flex: 1,
  },

  mobileScroll: {
    flex: 1,
  },

  mobileScrollContent: {
    flexGrow: 1,
  },

  mobileWrapper: {
    width: '100%',

    alignItems: 'center',
  },


  // ==========================================================
  // MOBILE BACKGROUND
  // ==========================================================

  circleTop: {
    position: 'absolute',

    top: -130,

    right: -110,

    backgroundColor:
      'rgba(255,255,255,0.07)',
  },

  circleMiddle: {
    position: 'absolute',

    top: '38%',

    left: -120,

    backgroundColor:
      'rgba(255,255,255,0.035)',
  },

  circleBottom: {
    position: 'absolute',

    bottom: -180,

    right: -120,

    backgroundColor:
      'rgba(255,255,255,0.055)',
  },


  // ==========================================================
  // MOBILE BACK
  // ==========================================================

  mobileBackButton: {
    alignSelf: 'flex-start',

    flexDirection: 'row',

    alignItems: 'center',

    minHeight: 40,

    paddingHorizontal: 10,

    borderRadius: 12,

    marginBottom: 12,
  },

  mobileBackButtonPressed: {
    backgroundColor:
      'rgba(255,255,255,0.12)',

    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  mobileBackText: {
    color: '#FFFFFF',

    fontSize: 14,

    fontFamily:
      typography.fontFamily.medium,

    marginLeft: 7,
  },


  // ==========================================================
  // MOBILE HEADER
  // ==========================================================

  mobileHeaderCard: {
    width: '100%',

    alignItems: 'center',

    paddingVertical: 20,

    paddingHorizontal: 17,

    borderRadius: 20,

    backgroundColor:
      'rgba(255,255,255,0.11)',

    borderWidth: 1,

    borderColor:
      'rgba(255,255,255,0.13)',

    marginBottom: 14,
  },

  mobileKeyIcon: {
    width: 54,
    height: 54,

    borderRadius: 17,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.15)',

    marginBottom: 10,
  },

  mobileHeaderTitle: {
    color: '#FFFFFF',

    fontSize: 19,

    fontFamily:
      typography.fontFamily.bold,

    textAlign: 'center',
  },

  mobileHeaderSubtitle: {
    color:
      'rgba(255,255,255,0.78)',

    fontSize: 12.5,

    lineHeight: 19,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',

    marginTop: 5,
  },


  // ==========================================================
  // MOBILE FORM CARD
  // ==========================================================

  mobileFormCard: {
    width: '100%',

    borderRadius: 22,

    paddingHorizontal: 18,

    paddingVertical: 22,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.13,

    shadowRadius: 20,

    elevation: 7,
  },

  mobileFormCardKeyboard: {
    marginTop: 4,
  },


  // ==========================================================
  // FORM
  // ==========================================================

  formWrapper: {
    width: '100%',
  },

  formHeading: {
    alignItems: 'center',
  },

  formHeadingIcon: {
    width: 46,
    height: 46,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 12,
  },

  title: {
    fontSize:
      typography.fontSize.xl,

    fontFamily:
      typography.fontFamily.bold,

    textAlign: 'center',
  },

  subtitle: {
    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',

    marginTop: spacing.xs,

    marginBottom: spacing.lg,

    lineHeight: 21,

    maxWidth: 600,
  },


  // ==========================================================
  // INPUT
  // ==========================================================

  inputContainer: {
    width: '100%',

    maxWidth: 600,

    alignSelf: 'center',

    marginBottom: spacing.sm,
  },


  // ==========================================================
  // BUTTON
  // ==========================================================

  resetButton: {
    width: '100%',

    maxWidth: 600,

    alignSelf: 'center',

    borderRadius: 15,

    overflow: 'hidden',

    marginTop: spacing.sm,

    marginBottom: spacing.md,

    shadowColor:
      colors.primary,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.24,

    shadowRadius: 10,

    elevation: 5,
  },

  resetButtonDisabled: {
    opacity: 0.7,
  },

  resetButtonHover: {
    shadowOpacity: 0.34,

    shadowRadius: 14,

    transform: [
      {
        translateY: -1,
      },
    ],
  },

  resetButtonPressed: {
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  resetButtonFocused: {
    borderWidth: 2,

    borderColor:
      colors.primary,
  },

  resetGradient: {
    minHeight: 56,

    paddingHorizontal: 18,

    alignItems: 'center',

    justifyContent: 'center',

    position: 'relative',
  },

  resetButtonText: {
    color: '#FFFFFF',

    fontSize:
      typography.fontSize.lg,

    fontFamily:
      typography.fontFamily.bold,
  },

  resetArrow: {
    position: 'absolute',

    right: 12,

    width: 36,
    height: 36,

    borderRadius: 18,

    backgroundColor:
      'rgba(255,255,255,0.16)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingContent: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  loadingText: {
    color: '#FFFFFF',

    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.medium,

    marginLeft: 9,
  },


  // ==========================================================
  // BACK TO LOGIN
  // ==========================================================

  backToLogin: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: spacing.xs,

    marginVertical: spacing.md,

    paddingVertical: 7,

    borderRadius: 10,
  },

  backToLoginPressed: {
    backgroundColor: '#F0F5F1',

    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  backToLoginText: {
    color:
      colors.primary,

    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.medium,
  },


  // ==========================================================
  // INFO
  // ==========================================================

  infoContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 13,

    paddingVertical: 12,

    borderRadius: 14,

    borderWidth: 1,

    marginTop: spacing.md,
  },

  infoIcon: {
    marginRight: 8,
  },

  infoText: {
    flex: 1,

    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,

    lineHeight: 18,
  },


  // ==========================================================
  // MOBILE FOOTER
  // ==========================================================

  mobileFooter: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 18,
  },

  mobileFooterText: {
    color:
      'rgba(255,255,255,0.62)',

    fontSize: 11.5,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',

    marginLeft: 5,
  },


  // ==========================================================
  // DESKTOP
  // ==========================================================

  desktopSafeArea: {
    flex: 1,

    backgroundColor: '#FFFFFF',
  },

  desktopContainer: {
    flex: 1,

    flexDirection: 'row',

    width: '100%',

    height: '100%',

    backgroundColor: '#FFFFFF',
  },


  // ==========================================================
  // DESKTOP LEFT PANEL
  // ==========================================================

  desktopBrandPanel: {
    width: '50%',

    minWidth: 480,

    maxWidth: 920,

    height: '100%',
  },

  desktopBrandGradient: {
    flex: 1,

    paddingHorizontal: 70,

    paddingVertical: 54,

    justifyContent:
      'space-between',
  },

  desktopBrandContent: {
    width: '100%',

    maxWidth: 620,

    alignSelf: 'center',
  },

  desktopSecurityIcon: {
    width: 68,
    height: 68,

    borderRadius: 21,

    backgroundColor:
      'rgba(255,255,255,0.14)',

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 22,

    borderWidth: 1,

    borderColor:
      'rgba(255,255,255,0.12)',
  },

  desktopBrandTitle: {
    color: '#FFFFFF',

    fontSize: 42,

    lineHeight: 51,

    fontFamily:
      typography.fontFamily.bold,

    marginBottom: 22,
  },

  desktopBrandDescription: {
    color:
      'rgba(255,255,255,0.90)',

    fontSize: 15.5,

    lineHeight: 25,

    fontFamily:
      typography.fontFamily.regular,

    maxWidth: 600,
  },


  // ==========================================================
  // DESKTOP FEATURES
  // ==========================================================

  desktopFeatureList: {
    marginTop: 48,

    gap: 20,
  },

  desktopFeatureItem: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  desktopFeatureIcon: {
    width: 47,
    height: 47,

    borderRadius: 14,

    backgroundColor:
      'rgba(255,255,255,0.14)',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 14,
  },

  desktopFeatureContent: {
    flex: 1,
  },

  desktopFeatureTitle: {
    color: '#FFFFFF',

    fontSize: 14,

    fontFamily:
      typography.fontFamily.bold,
  },

  desktopFeatureDescription: {
    color:
      'rgba(255,255,255,0.75)',

    fontSize: 12,

    lineHeight: 18,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 3,
  },


  // ==========================================================
  // DESKTOP LEFT FOOTER
  // ==========================================================

  desktopBrandFooter: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    paddingTop: 18,

    borderTopWidth: 1,

    borderTopColor:
      'rgba(255,255,255,0.20)',
  },

  desktopCopyright: {
    color:
      'rgba(255,255,255,0.72)',

    fontSize: 11,

    fontFamily:
      typography.fontFamily.regular,
  },

  desktopFooterRight: {
    color:
      'rgba(255,255,255,0.72)',

    fontSize: 11,

    fontFamily:
      typography.fontFamily.regular,
  },


  // ==========================================================
  // DESKTOP RIGHT PANEL
  // ==========================================================

  desktopContentPanel: {
    flex: 1,

    backgroundColor: '#FFFFFF',

    minWidth: 0,
  },

  desktopScroll: {
    flex: 1,
  },

  desktopScrollContent: {
    flexGrow: 1,

    minHeight: '100%',

    justifyContent:
      'center',

    paddingHorizontal: 70,

    paddingVertical: 45,
  },

  desktopContentWrapper: {
    width: '100%',

    maxWidth: 570,

    alignSelf: 'center',
  },


  // ==========================================================
  // DESKTOP BACK
  // ==========================================================

  desktopBackButton: {
    alignSelf: 'flex-start',

    flexDirection: 'row',

    alignItems: 'center',

    minHeight: 40,

    paddingHorizontal: 10,

    borderRadius: 11,

    marginBottom: 22,
  },

  desktopBackButtonHover: {
    backgroundColor:
      '#F0F5F1',
  },

  desktopBackButtonPressed: {
    backgroundColor:
      '#E8F1E9',

    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  desktopBackButtonFocused: {
    borderWidth: 2,

    borderColor:
      colors.primary,
  },

  desktopBackText: {
    color:
      colors.primary,

    fontSize: 13.5,

    fontFamily:
      typography.fontFamily.medium,

    marginLeft: 6,
  },


  // ==========================================================
  // DESKTOP FOOTER
  // ==========================================================

  desktopFooter: {
    width: '100%',

    marginTop: 25,

    paddingTop: 15,

    borderTopWidth: 1,

    borderTopColor:
      '#E8ECE9',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',
  },

  desktopSecure: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  desktopSecureText: {
    color: '#7C8780',

    fontSize: 10.5,

    fontFamily:
      typography.fontFamily.regular,

    marginLeft: 6,
  },

  desktopFooterCopyright: {
    color: '#9AA19C',

    fontSize: 10,

    fontFamily:
      typography.fontFamily.regular,
  },

});


export default ForgotPasswordScreen;