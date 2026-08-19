// src/screens/auth/ResetPasswordScreen.js

import React, {
  useState,
  useRef,
  useEffect,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
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
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import { useTheme } from '../../context/ThemeContext';
import {
  colors,
  spacing,
  typography,
} from '../../theme';

import authService from '../../services/authService';
import FormInput from '../../components/common/FormInput';


// ============================================================
// RESET PASSWORD SCREEN
// ============================================================

const ResetPasswordScreen = ({
  route,
  navigation,
}) => {

  const { email } =
    route.params || {};

  const {
    width,
    height,
  } = useWindowDimensions();

  const { isDark } =
    useTheme();


  // ==========================================================
  // STATE
  // ==========================================================

  const [otpCode, setOtpCode] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [isLoading, setIsLoading] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  // Toast
  const [toast, setToast] =
    useState(null);

  const toastTimeout =
    useRef(null);

  // Animation
  const fadeAnim =
    useRef(
      new Animated.Value(0)
    ).current;

  const toastAnim =
    useRef(
      new Animated.Value(0)
    ).current;


  // ==========================================================
  // RESPONSIVE
  // ==========================================================

  const isWeb =
    Platform.OS === 'web';

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
  // ANIMATION
  // ==========================================================

  useEffect(() => {

    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }
    ).start();

    return () => {
      if (toastTimeout.current) {
        clearTimeout(
          toastTimeout.current
        );
      }
    };

  }, []);


  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = (
    type,
    title,
    message,
    duration = 3000
  ) => {

    if (toastTimeout.current) {
      clearTimeout(
        toastTimeout.current
      );
    }

    setToast({
      type,
      title,
      message,
    });

    toastAnim.setValue(0);

    Animated.spring(
      toastAnim,
      {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }
    ).start();

    toastTimeout.current =
      setTimeout(() => {

        Animated.timing(
          toastAnim,
          {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }
        ).start(() => {
          setToast(null);
        });

      }, duration);
  };


  // ==========================================================
  // TOAST CONFIG
  // ==========================================================

  const getToastConfig = () => {

    if (!toast) {
      return {
        icon: 'information-circle',
        background: '#333333',
        iconBackground:
          'rgba(255,255,255,0.15)',
      };
    }

    switch (toast.type) {

      case 'success':
        return {
          icon: 'checkmark-circle',
          background: '#15803D',
          iconBackground:
            'rgba(255,255,255,0.16)',
        };

      case 'error':
        return {
          icon: 'close-circle',
          background: '#DC2626',
          iconBackground:
            'rgba(255,255,255,0.16)',
        };

      case 'warning':
        return {
          icon: 'warning',
          background: '#D97706',
          iconBackground:
            'rgba(255,255,255,0.16)',
        };

      case 'info':
      default:
        return {
          icon: 'information-circle',
          background: '#2563EB',
          iconBackground:
            'rgba(255,255,255,0.16)',
        };
    }
  };


  // ==========================================================
  // PASSWORD VALIDATION
  // ==========================================================

  const validatePassword = (
    password
  ) => {

    if (password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Le mot de passe doit contenir au moins une majuscule';
    }

    if (!/[a-z]/.test(password)) {
      return 'Le mot de passe doit contenir au moins une minuscule';
    }

    if (!/[0-9]/.test(password)) {
      return 'Le mot de passe doit contenir au moins un chiffre';
    }

    if (
      !/[!@#$%^&*(),.?":{}|<>]/.test(
        password
      )
    ) {
      return 'Le mot de passe doit contenir au moins un caractère spécial';
    }

    return null;
  };


  // ==========================================================
  // RESET PASSWORD
  // ==========================================================

  const handleResetPassword =
    async () => {

      Keyboard.dismiss();

      // ------------------------------------------------------
      // EMAIL
      // ------------------------------------------------------

      if (!email) {

        showToast(
          'error',
          'Erreur',
          'Adresse email introuvable. Veuillez recommencer.'
        );

        return;
      }


      // ------------------------------------------------------
      // EMPTY FIELDS
      // ------------------------------------------------------

      if (
        !otpCode.trim() ||
        !newPassword ||
        !confirmPassword
      ) {

        showToast(
          'warning',
          'Champs incomplets',
          'Veuillez remplir tous les champs.'
        );

        return;
      }


      // ------------------------------------------------------
      // OTP
      // ------------------------------------------------------

      const cleanOtp =
        otpCode
          .replace(/\D/g, '');

      if (
        cleanOtp.length !== 6
      ) {

        showToast(
          'error',
          'Code OTP invalide',
          'Le code OTP doit contenir exactement 6 chiffres.'
        );

        return;
      }


      // ------------------------------------------------------
      // PASSWORD MATCH
      // ------------------------------------------------------

      if (
        newPassword !==
        confirmPassword
      ) {

        showToast(
          'error',
          'Mots de passe différents',
          'Les deux mots de passe ne correspondent pas.'
        );

        return;
      }


      // ------------------------------------------------------
      // PASSWORD VALIDATION
      // ------------------------------------------------------

      const passwordError =
        validatePassword(
          newPassword
        );

      if (passwordError) {

        showToast(
          'warning',
          'Mot de passe non valide',
          passwordError
        );

        return;
      }


      // ------------------------------------------------------
      // REQUEST
      // ------------------------------------------------------

      setIsLoading(true);

      try {

        const result =
          await authService.resetPassword(
            email,
            cleanOtp,
            newPassword
          );

        setIsLoading(false);


        // ====================================================
        // SUCCESS
        // ====================================================

        if (
          result &&
          result.success
        ) {

          showToast(
            'success',
            'Mot de passe réinitialisé',
            'Votre mot de passe a été modifié avec succès.',
            2200
          );

          // Navigation automatique vers Login
          setTimeout(() => {

            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'Login',
                },
              ],
            });

          }, 2300);

          return;
        }


        // ====================================================
        // BACKEND ERROR
        // ====================================================

        let errorMessage =
          result?.error ||
          'Une erreur est survenue lors de la réinitialisation.';


        const lowerError =
          String(
            errorMessage
          ).toLowerCase();


        if (
          lowerError.includes('otp') &&
          (
            lowerError.includes('invalid') ||
            lowerError.includes('incorrect') ||
            lowerError.includes('wrong')
          )
        ) {

          errorMessage =
            'Le code OTP est incorrect. Vérifiez le code reçu par email.';

        } else if (
          lowerError.includes('expired') ||
          lowerError.includes('expire')
        ) {

          errorMessage =
            'Le code OTP a expiré. Veuillez demander un nouveau code.';

        } else if (
          lowerError.includes('password')
        ) {

          errorMessage =
            'Le mot de passe ne peut pas être utilisé.';

        }


        showToast(
          'error',
          'Réinitialisation impossible',
          errorMessage
        );

      } catch (error) {

        setIsLoading(false);

        console.error(
          'Reset password error:',
          error
        );

        showToast(
          'error',
          'Erreur de connexion',
          error?.message ||
            'Impossible de réinitialiser le mot de passe. Veuillez réessayer.'
        );
      }
    };


  // ==========================================================
  // PASSWORD REQUIREMENT
  // ==========================================================

  const PasswordRequirement = ({
    valid,
    children,
  }) => {

    return (
      <View
        style={
          styles.requirementRow
        }
      >

        <Ionicons
          name={
            valid
              ? 'checkmark-circle'
              : 'ellipse-outline'
          }
          size={17}
          color={
            valid
              ? colors.success
              : '#999999'
          }
        />

        <Text
          style={[
            styles.requirementText,
            {
              color:
                isDark
                  ? '#AAAAAA'
                  : '#757575',
            },
          ]}
        >
          {children}
        </Text>

      </View>
    );
  };


  // ==========================================================
  // TOAST COMPONENT
  // ==========================================================

  const renderToast = () => {

    if (!toast) {
      return null;
    }

    const config =
      getToastConfig();

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            backgroundColor:
              config.background,

            opacity:
              toastAnim,

            transform: [
              {
                translateY:
                  toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      -35,
                      0,
                    ],
                  }),
              },
              {
                scale:
                  toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      0.96,
                      1,
                    ],
                  }),
              },
            ],
          },
        ]}
      >

        <View
          style={[
            styles.toastIcon,
            {
              backgroundColor:
                config.iconBackground,
            },
          ]}
        >

          <Ionicons
            name={config.icon}
            size={22}
            color="#FFFFFF"
          />

        </View>


        <View
          style={
            styles.toastContent
          }
        >

          <Text
            style={
              styles.toastTitle
            }
          >
            {toast.title}
          </Text>

          <Text
            style={
              styles.toastMessage
            }
          >
            {toast.message}
          </Text>

        </View>

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
        delay={200}
        duration={700}
        style={
          styles.formWrapper
        }
      >

        {/* ====================================================
            FORM HEADER
        ==================================================== */}

        <View
          style={
            styles.formHeading
          }
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
              name="lock-open-outline"
              size={23}
              color={
                colors.primary
              }
            />

          </View>


          <Text
            style={[
              styles.formTitle,
              {
                color:
                  isDark
                    ? '#FFFFFF'
                    : '#1A1A1A',
              },
            ]}
          >
            Nouveau mot de passe
          </Text>


          <Text
            style={[
              styles.formSubtitle,
              {
                color:
                  isDark
                    ? '#AAAAAA'
                    : '#757575',
              },
            ]}
          >
            Entrez le code reçu par email et créez votre nouveau mot de passe.
          </Text>

        </View>


        {/* ====================================================
            OTP
        ==================================================== */}

        <View
          style={
            styles.inputContainer
          }
        >

          <FormInput
            label="Code OTP"
            icon="key-outline"
            value={otpCode}
            onChangeText={(text) =>
              setOtpCode(
                text
                  .replace(/\D/g, '')
                  .slice(0, 6)
              )
            }
            placeholder="Entrez les 6 chiffres"
            isDark={isDark}
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="next"
          />

        </View>


        {/* ====================================================
            NEW PASSWORD
        ==================================================== */}

        <View
          style={
            styles.inputContainer
          }
        >

          <FormInput
            label="Nouveau mot de passe"
            icon="lock-closed-outline"
            value={newPassword}
            onChangeText={
              setNewPassword
            }
            placeholder="Minimum 8 caractères"
            isDark={isDark}
            secureTextEntry={
              !showNewPassword
            }
            showToggle
            onToggleSecure={() =>
              setShowNewPassword(
                (prev) => !prev
              )
            }
            returnKeyType="next"
          />

        </View>


        {/* ====================================================
            CONFIRM PASSWORD
        ==================================================== */}

        <View
          style={
            styles.inputContainer
          }
        >

          <FormInput
            label="Confirmer le mot de passe"
            icon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={
              setConfirmPassword
            }
            placeholder="Confirmez votre mot de passe"
            isDark={isDark}
            secureTextEntry={
              !showConfirmPassword
            }
            showToggle
            onToggleSecure={() =>
              setShowConfirmPassword(
                (prev) => !prev
              )
            }
            returnKeyType="done"
            onSubmitEditing={
              handleResetPassword
            }
          />

        </View>


        {/* ====================================================
            PASSWORD REQUIREMENTS
        ==================================================== */}

        <View
          style={
            styles.passwordRequirements
          }
        >

          <Text
            style={[
              styles.requirementTitle,
              {
                color:
                  isDark
                    ? '#FFFFFF'
                    : '#333333',
              },
            ]}
          >
            Votre mot de passe doit contenir :
          </Text>


          <PasswordRequirement
            valid={
              newPassword.length >= 8
            }
          >
            Au moins 8 caractères
          </PasswordRequirement>


          <PasswordRequirement
            valid={
              /[A-Z]/.test(
                newPassword
              )
            }
          >
            Une majuscule
          </PasswordRequirement>


          <PasswordRequirement
            valid={
              /[a-z]/.test(
                newPassword
              )
            }
          >
            Une minuscule
          </PasswordRequirement>


          <PasswordRequirement
            valid={
              /[0-9]/.test(
                newPassword
              )
            }
          >
            Un chiffre
          </PasswordRequirement>


          <PasswordRequirement
            valid={
              /[!@#$%^&*(),.?":{}|<>]/.test(
                newPassword
              )
            }
          >
            Un caractère spécial
          </PasswordRequirement>

        </View>


        {/* ====================================================
            RESET BUTTON
        ==================================================== */}

        <Pressable
          onPress={
            handleResetPassword
          }
          disabled={
            isLoading
          }
          accessibilityRole="button"
          accessibilityLabel="Réinitialiser le mot de passe"
          style={({
            pressed,
            hovered,
            focused,
          }) => [

            styles.resetButton,

            isLoading &&
              styles.resetButtonDisabled,

            hovered &&
              styles.resetButtonHover,

            pressed &&
              styles.resetButtonPressed,

            focused &&
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
                  Réinitialisation...
                </Text>

              </View>

            ) : (

              <>

                <Text
                  style={
                    styles.resetButtonText
                  }
                >
                  Réinitialiser
                </Text>

                <View
                  style={
                    styles.buttonIcon
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


        {/* ====================================================
            BACK TO LOGIN
        ==================================================== */}

        <TouchableOpacity
          style={
            styles.backToLogin
          }
          onPress={() =>
            navigation.navigate(
              'Login'
            )
          }
          activeOpacity={0.7}
        >

          <Ionicons
            name="arrow-back"
            size={16}
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

        </TouchableOpacity>


        {/* ====================================================
            SECURITY INFO
        ==================================================== */}

        <View
          style={
            styles.infoContainer
          }
        >

          <Ionicons
            name="shield-checkmark-outline"
            size={17}
            color={
              colors.primary
            }
          />

          <Text
            style={[
              styles.infoText,
              {
                color:
                  isDark
                    ? '#AAAAAA'
                    : '#757575',
              },
            ]}
          >
            Votre compte et votre mot de passe sont protégés.
          </Text>

        </View>

      </Animatable.View>
    );
  };


  // ==========================================================
  // MOBILE / TABLET
  // ==========================================================

  const renderMobile =
    () => {

      const horizontalPadding =
        isTablet
          ? 30
          : 18;

      const topPadding =
        isVerySmallScreen
          ? 10
          : isSmallScreen
            ? 15
            : 22;

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

            {/* DECORATION */}

            <View
              pointerEvents="none"
              style={[
                styles.circleTop,
                {
                  width:
                    isTablet
                      ? 360
                      : 250,

                  height:
                    isTablet
                      ? 360
                      : 250,

                  borderRadius:
                    isTablet
                      ? 180
                      : 125,
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
                      ? 250
                      : 180,

                  height:
                    isTablet
                      ? 250
                      : 180,

                  borderRadius:
                    isTablet
                      ? 125
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
                      ? 370
                      : 280,

                  height:
                    isTablet
                      ? 370
                      : 280,

                  borderRadius:
                    isTablet
                      ? 185
                      : 140,
                },
              ]}
            />


            {/* =================================================
                KEYBOARD SAFE SCROLL
            ================================================= */}

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
                  ? 0
                  : 20
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
                      topPadding,

                    paddingBottom:
                      Platform.OS === 'android'
                        ? 55
                        : 35,

                    paddingHorizontal:
                      horizontalPadding,
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

                  {/* BACK */}

                  <Pressable
                    onPress={() =>
                      navigation.goBack()
                    }
                    style={({
                      pressed,
                    }) => [
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


                  {/* HEADER CARD */}

                  <Animatable.View
                    animation="fadeInUp"
                    duration={700}
                    delay={150}
                    style={
                      styles.mobileHeaderCard
                    }
                  >

                    <View
                      style={
                        styles.mobileShieldIcon
                      }
                    >

                      <Ionicons
                        name="lock-open"
                        size={30}
                        color="#FFFFFF"
                      />

                    </View>


                    <Text
                      style={
                        styles.mobileHeaderTitle
                      }
                    >
                      Nouveau mot de passe
                    </Text>


                    <Text
                      style={
                        styles.mobileHeaderSubtitle
                      }
                    >
                      Créez un nouveau mot de passe sécurisé
                    </Text>

                  </Animatable.View>


                  {/* FORM CARD */}

                  <View
                    style={
                      styles.mobileFormCard
                    }
                  >

                    {renderForm()}

                  </View>


                  {/* FOOTER */}

                  <View
                    style={
                      styles.mobileFooter
                    }
                  >

                    <Ionicons
                      name="shield-checkmark-outline"
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

  const renderDesktop =
    () => {

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

            {/* =================================================
                LEFT PANEL
            ================================================= */}

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

                  <View
                    style={
                      styles.desktopSecurityIcon
                    }
                  >

                    <Ionicons
                      name="lock-open"
                      size={34}
                      color="#FFFFFF"
                    />

                  </View>


                  <Text
                    style={
                      styles.desktopBrandTitle
                    }
                  >
                    Créez un nouveau{"\n"}
                    mot de passe{"\n"}
                    sécurisé.
                  </Text>


                  <Text
                    style={
                      styles.desktopBrandDescription
                    }
                  >
                    Utilisez le code OTP reçu
                    par email pour sécuriser
                    votre compte et définir
                    un nouveau mot de passe.
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
                          name="key-outline"
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
                          Vérification par OTP
                        </Text>

                        <Text
                          style={
                            styles.desktopFeatureDescription
                          }
                        >
                          Utilisez les 6 chiffres reçus par email
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
                          Protection renforcée
                        </Text>

                        <Text
                          style={
                            styles.desktopFeatureDescription
                          }
                        >
                          Votre compte reste protégé
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
                          Mot de passe sécurisé
                        </Text>

                        <Text
                          style={
                            styles.desktopFeatureDescription
                          }
                        >
                          Minimum 8 caractères et règles de sécurité
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


            {/* =================================================
                RIGHT PANEL
            ================================================= */}

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
                      onPress={() =>
                        navigation.goBack()
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
      style={
        styles.root
      }
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


      {/* ======================================================
          GLOBAL TOAST
      ====================================================== */}

      {renderToast()}

    </View>
  );
};


// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

  // ==========================================================
  // ROOT
  // ==========================================================

  root: {
    flex: 1,
  },


  // ==========================================================
  // TOAST
  // ==========================================================

  toast: {
    position: 'absolute',

    top:
      Platform.OS === 'web'
        ? 24
        : 45,

    left: 16,
    right: 16,

    minHeight: 68,

    borderRadius: 16,

    paddingHorizontal: 14,
    paddingVertical: 11,

    flexDirection: 'row',

    alignItems: 'center',

    zIndex: 999999,

    elevation: 20,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.25,

    shadowRadius: 14,

    ...(Platform.OS === 'web'
      ? {
          maxWidth: 460,
          alignSelf: 'center',
          left: '50%',
          right: undefined,
          transform: [
            {
              translateX: -230,
            },
          ],
        }
      : {}),
  },

  toastIcon: {
    width: 42,
    height: 42,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  toastContent: {
    flex: 1,

    paddingRight: 4,
  },

  toastTitle: {
    color: '#FFFFFF',

    fontSize: 14,

    fontFamily:
      typography.fontFamily.bold,

    marginBottom: 2,
  },

  toastMessage: {
    color:
      'rgba(255,255,255,0.88)',

    fontSize: 12,

    lineHeight: 17,

    fontFamily:
      typography.fontFamily.regular,
  },


  // ==========================================================
  // MOBILE
  // ==========================================================

  mobileSafeArea: {
    flex: 1,

    backgroundColor:
      '#164B2A',
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
  // MOBILE DECORATION
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
    alignSelf:
      'flex-start',

    flexDirection:
      'row',

    alignItems:
      'center',

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

    paddingVertical: 19,

    paddingHorizontal: 17,

    borderRadius: 20,

    backgroundColor:
      'rgba(255,255,255,0.11)',

    borderWidth: 1,

    borderColor:
      'rgba(255,255,255,0.13)',

    marginBottom: 14,
  },

  mobileShieldIcon: {
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

    backgroundColor: '#FFFFFF',

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


  // ==========================================================
  // FORM
  // ==========================================================

  formWrapper: {
    width: '100%',
  },

  formHeading: {
    alignItems: 'center',

    marginBottom: 4,
  },

  formHeadingIcon: {
    width: 46,
    height: 46,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 11,
  },

  formTitle: {
    fontSize:
      typography.fontSize.xl,

    fontFamily:
      typography.fontFamily.bold,

    textAlign: 'center',
  },

  formSubtitle: {
    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',

    marginTop: spacing.xs,

    marginBottom:
      spacing.lg,

    lineHeight: 20,

    maxWidth: 570,
  },


  // ==========================================================
  // INPUT
  // ==========================================================

  inputContainer: {
    width: '100%',

    maxWidth: 600,

    alignSelf: 'center',

    marginBottom:
      spacing.sm,
  },


  // ==========================================================
  // PASSWORD REQUIREMENTS
  // ==========================================================

  passwordRequirements: {
    width: '100%',

    maxWidth: 600,

    alignSelf: 'center',

    marginTop: spacing.xs,

    marginBottom:
      spacing.lg,

    paddingHorizontal:
      spacing.xs,
  },

  requirementTitle: {
    fontSize: 13,

    fontFamily:
      typography.fontFamily.medium,

    marginBottom: 6,
  },

  requirementRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.sm,

    marginVertical: 2.5,
  },

  requirementText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,

    flexShrink: 1,
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

    marginBottom:
      spacing.md,

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

    justifyContent:
      'center',

    position: 'relative',
  },

  resetButtonText: {
    color: '#FFFFFF',

    fontSize:
      typography.fontSize.lg,

    fontFamily:
      typography.fontFamily.bold,
  },

  buttonIcon: {
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

    fontSize: 14,

    fontFamily:
      typography.fontFamily.medium,

    marginLeft: 9,
  },


  // ==========================================================
  // BACK LOGIN
  // ==========================================================

  backToLogin: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: spacing.xs,

    marginVertical:
      spacing.md,

    paddingVertical:
      spacing.xs,
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

    justifyContent: 'center',

    paddingHorizontal:
      spacing.sm,

    marginTop: spacing.sm,
  },

  infoText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',

    flexShrink: 1,

    marginLeft: 6,
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
  // DESKTOP LEFT
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
  // DESKTOP RIGHT
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
    alignSelf:
      'flex-start',

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


// ============================================================
// EXPORT
// ============================================================

export default ResetPasswordScreen;