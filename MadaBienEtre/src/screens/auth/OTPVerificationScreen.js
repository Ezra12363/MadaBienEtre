// src/screens/auth/OTPVerificationScreen.js

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
  TextInput,
  Platform,
  Keyboard,
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

import notificationService from '../../services/notificationService';


// ============================================================
// OTP VERIFICATION SCREEN
// ============================================================

const OTPVerificationScreen = ({
  route,
  navigation,
}) => {

  const { email, fullname } =
    route.params || {};

  // ==========================================================
  // STATE
  // ==========================================================

  const [otp, setOtp] = useState([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isResending, setIsResending] =
    useState(false);

  const [timer, setTimer] =
    useState(60);

  const [canResend, setCanResend] =
    useState(false);

  const [error, setError] =
    useState('');

  // Toast state
  const [toast, setToast] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const {
    verifyOTP,
    resendOTP,
  } = useAuth();

  const { isDark } =
    useTheme();

  const {
    width,
    height,
  } = useWindowDimensions();

  const inputRefs =
    useRef([]);

  const timerRef =
    useRef(null);

  const toastTimerRef =
    useRef(null);

  const toastAnim =
    useRef(
      new Animated.Value(0)
    ).current;

  const fadeAnim =
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
  // TOAST CONFIGURATION
  // ==========================================================

  const toastConfig = {
    success: {
      icon: 'checkmark-circle',
      color: '#00C853',
      background: isDark
        ? '#16351F'
        : '#EAF8EF',
    },

    error: {
      icon: 'alert-circle',
      color: '#E53935',
      background: isDark
        ? '#3A1C1C'
        : '#FDECEC',
    },

    info: {
      icon: 'information-circle',
      color: colors.primary,
      background: isDark
        ? '#172A45'
        : '#EAF2FF',
    },

    warning: {
      icon: 'warning',
      color: '#F59E0B',
      background: isDark
        ? '#3A2C16'
        : '#FFF6DF',
    },
  };


  // ==========================================================
  // SHOW TOAST
  // ==========================================================

  const showToast = useCallback(
    (
      type = 'info',
      title = '',
      message = '',
      duration = 3000
    ) => {

      // Clear previous toast timer
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );
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

      toastTimerRef.current =
        setTimeout(() => {

          Animated.timing(
            toastAnim,
            {
              toValue: 0,
              duration: 220,
              useNativeDriver: true,
            }
          ).start(() => {

            setToast(prev => ({
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

    if (toastTimerRef.current) {
      clearTimeout(
        toastTimerRef.current
      );
    }

    Animated.timing(
      toastAnim,
      {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }
    ).start(() => {

      setToast(prev => ({
        ...prev,
        visible: false,
      }));

    });

  }, [toastAnim]);


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

    const translateY =
      toastAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-35, 0],
      });

    const scale =
      toastAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1],
      });

    return (
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.toastWrapper,
          isWeb
            ? styles.toastWrapperWeb
            : styles.toastWrapperMobile,
          {
            opacity: toastAnim,
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

        <Pressable
          onPress={hideToast}
          style={[
            styles.toast,
            {
              backgroundColor:
                config.background,
              borderLeftColor:
                config.color,
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
                  color:
                    isDark
                      ? '#FFFFFF'
                      : '#1A1A1A',
                },
              ]}
              numberOfLines={2}
            >
              {toast.title}
            </Text>

            {!!toast.message && (
              <Text
                style={[
                  styles.toastMessage,
                  {
                    color:
                      isDark
                        ? '#C8C8C8'
                        : '#626862',
                  },
                ]}
                numberOfLines={3}
              >
                {toast.message}
              </Text>
            )}

          </View>


          {/* CLOSE */}

          <TouchableOpacity
            onPress={hideToast}
            style={styles.toastClose}
            activeOpacity={0.7}
          >

            <Ionicons
              name="close"
              size={18}
              color={
                isDark
                  ? '#AAAAAA'
                  : '#7A7A7A'
              }
            />

          </TouchableOpacity>

        </Pressable>

      </Animated.View>
    );
  };


  // ==========================================================
  // ANIMATION + INITIALIZATION
  // ==========================================================

  useEffect(() => {

    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }
    ).start();

    startTimer();

    if (!email) {

      showToast(
        'error',
        'Adresse email manquante',
        'Impossible de vérifier votre compte sans adresse email.',
        3500
      );

      setTimeout(() => {
        navigation.replace('Login');
      }, 3600);

      return;
    }

    requestNotificationPermission();

    // Focus first input
    setTimeout(() => {

      inputRefs
        .current[0]
        ?.focus();

    }, 500);


    // Cleanup
    return () => {

      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }

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
          'Notification permission:',
          error
        );

      }
    };


  // ==========================================================
  // TIMER
  // ==========================================================

  const startTimer = () => {

    if (timerRef.current) {

      clearInterval(
        timerRef.current
      );

    }

    setTimer(60);
    setCanResend(false);

    timerRef.current =
      setInterval(() => {

        setTimer(prev => {

          if (prev <= 1) {

            if (timerRef.current) {

              clearInterval(
                timerRef.current
              );

            }

            setCanResend(true);

            return 0;
          }

          return prev - 1;

        });

      }, 1000);
  };


  // ==========================================================
  // OTP CHANGE
  // ==========================================================

  const handleOtpChange = (
    text,
    index
  ) => {

    if (error) {
      setError('');
    }

    const cleanText =
      text.replace(/\D/g, '');

    // --------------------------------------------------------
    // PASTE 6 DIGITS
    // --------------------------------------------------------

    if (cleanText.length > 1) {

      const digits =
        cleanText
          .slice(0, 6)
          .split('');

      const newOtp = [
        '',
        '',
        '',
        '',
        '',
        '',
      ];

      digits.forEach(
        (digit, i) => {
          newOtp[i] = digit;
        }
      );

      setOtp(newOtp);

      const nextIndex =
        Math.min(
          digits.length,
          5
        );

      setTimeout(() => {

        inputRefs
          .current[nextIndex]
          ?.focus();

      }, 50);

      return;
    }

    // --------------------------------------------------------
    // SINGLE DIGIT
    // --------------------------------------------------------

    const newOtp =
      [...otp];

    newOtp[index] =
      cleanText.slice(-1);

    setOtp(newOtp);

    if (
      cleanText &&
      index < 5
    ) {

      inputRefs
        .current[index + 1]
        ?.focus();

    }
  };


  // ==========================================================
  // KEYBOARD
  // ==========================================================

  const handleKeyPress = (
    e,
    index
  ) => {

    if (
      e.nativeEvent.key ===
        'Backspace' &&
      !otp[index] &&
      index > 0
    ) {

      inputRefs
        .current[index - 1]
        ?.focus();

    }
  };


  // ==========================================================
  // VERIFY OTP
  // ==========================================================

  const handleVerify =
    async () => {

      const otpCode =
        otp.join('');


      // ------------------------------------------------------
      // EMPTY
      // ------------------------------------------------------

      if (!otpCode) {

        setError(
          'Veuillez saisir votre code OTP.'
        );

        showToast(
          'warning',
          'Code requis',
          'Veuillez saisir les 6 chiffres reçus par email.',
          3000
        );

        inputRefs
          .current[0]
          ?.focus();

        return;
      }


      // ------------------------------------------------------
      // LENGTH
      // ------------------------------------------------------

      if (
        otpCode.length !== 6
      ) {

        setError(
          'Veuillez saisir les 6 chiffres du code OTP.'
        );

        showToast(
          'warning',
          'Code incomplet',
          'Le code OTP doit contenir exactement 6 chiffres.',
          3000
        );

        return;
      }


      // ------------------------------------------------------
      // ONLY NUMBERS
      // ------------------------------------------------------

      if (
        !/^\d{6}$/.test(
          otpCode
        )
      ) {

        setError(
          'Le code OTP doit contenir uniquement des chiffres.'
        );

        showToast(
          'error',
          'Code invalide',
          'Le code OTP doit contenir uniquement des chiffres.',
          3000
        );

        return;
      }


      // ------------------------------------------------------
      // LOADING
      // ------------------------------------------------------

      setIsLoading(true);
      setError('');

      Keyboard.dismiss();


      try {

        const result =
          await verifyOTP(
            email,
            otpCode
          );


        // ----------------------------------------------------
        // STOP LOADING
        // ----------------------------------------------------

        setIsLoading(false);


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        if (
          result &&
          result.success
        ) {

          showToast(
            'success',
            'Compte vérifié !',
            'Votre compte a été activé avec succès. Redirection vers la connexion...',
            2800
          );


          // Clear OTP
          setOtp([
            '',
            '',
            '',
            '',
            '',
            '',
          ]);


          // --------------------------------------------------
          // AUTOMATIC LOGIN REDIRECTION
          // --------------------------------------------------

          setTimeout(() => {

            navigation.replace(
              'Login'
            );

          }, 2800);

          return;
        }


        // ----------------------------------------------------
        // ERROR FROM API
        // ----------------------------------------------------

        let errorMessage =
          result?.error ||
          'Code OTP invalide.';


        const normalizedError =
          String(
            errorMessage
          ).toLowerCase();


        // Expired
        if (
          normalizedError.includes(
            'expired'
          ) ||
          normalizedError.includes(
            'expir'
          ) ||
          normalizedError.includes(
            'expire'
          )
        ) {

          errorMessage =
            'Le code OTP a expiré. Veuillez demander un nouveau code.';

        }

        // Invalid
        else if (
          normalizedError.includes(
            'invalid'
          ) ||
          normalizedError.includes(
            'incorrect'
          ) ||
          normalizedError.includes(
            'wrong'
          ) ||
          normalizedError.includes(
            'invalide'
          )
        ) {

          errorMessage =
            'Code OTP incorrect. Vérifiez les chiffres saisis et réessayez.';

        }


        setError(
          errorMessage
        );


        showToast(
          'error',
          'Échec de vérification',
          errorMessage,
          3500
        );

      } catch (error) {

        setIsLoading(false);

        const errorMessage =
          error?.message ||
          'Une erreur est survenue lors de la vérification du code.';

        setError(
          errorMessage
        );

        showToast(
          'error',
          'Erreur',
          errorMessage,
          3500
        );

      }

    };


  // ==========================================================
  // RESEND OTP
  // ==========================================================

  const handleResend =
    async () => {

      if (
        !canResend ||
        isResending
      ) {

        if (!canResend) {

          showToast(
            'info',
            'Veuillez patienter',
            `Vous pourrez renvoyer le code dans ${timer}s.`,
            2500
          );

        }

        return;
      }


      setIsResending(true);
      setError('');


      try {

        const result =
          await resendOTP(
            email
          );

        setIsResending(false);


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        if (
          result &&
          result.success
        ) {

          setOtp([
            '',
            '',
            '',
            '',
            '',
            '',
          ]);

          setError('');

          startTimer();


          showToast(
            'success',
            'Nouveau code envoyé',
            'Un nouveau code OTP a été envoyé à votre adresse email.',
            3500
          );


          setTimeout(() => {

            inputRefs
              .current[0]
              ?.focus();

          }, 150);

        }

        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        else {

          const errorMessage =
            result?.error ||
            'Impossible de renvoyer le code OTP.';

          showToast(
            'error',
            'Échec de l’envoi',
            errorMessage,
            3500
          );

        }

      } catch (error) {

        setIsResending(false);

        showToast(
          'error',
          'Erreur',
          'Impossible de renvoyer le code OTP. Veuillez réessayer.',
          3500
        );

      }

    };


  // ==========================================================
  // OTP FORM
  // ==========================================================

  const renderOtpForm = () => {

    const otpInputWidth =
      isTablet
        ? 54
        : isVerySmallScreen
          ? 43
          : 48;

    const otpInputHeight =
      isTablet
        ? 62
        : isVerySmallScreen
          ? 51
          : 56;


    return (

      <Animatable.View
        animation="fadeInUp"
        delay={200}
        duration={700}
        style={
          styles.formWrapper
        }
      >

        {/* ==================================================
            TITLE
        ================================================== */}

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
              name="shield-checkmark-outline"
              size={22}
              color={
                colors.primary
              }
            />

          </View>


          <Text
            style={[
              styles.title,
              {
                color:
                  isDark
                    ? '#FFFFFF'
                    : '#1A1A1A',
              },
            ]}
          >
            Saisissez le code
          </Text>


          <Text
            style={[
              styles.subtitle,
              {
                color:
                  isDark
                    ? '#AAAAAA'
                    : '#757575',
              },
            ]}
          >
            Entrez les 6 chiffres reçus par email
          </Text>

        </View>


        {/* ==================================================
            OTP INPUTS
        ================================================== */}

        <View
          style={[
            styles.otpContainer,
            {
              gap:
                isTablet
                  ? 10
                  : 7,
            },
          ]}
        >

          {otp.map(
            (
              digit,
              index
            ) => (

              <TextInput
                key={index}

                ref={(ref) => {
                  inputRefs.current[index] =
                    ref;
                }}

                style={[
                  styles.otpInput,
                  {
                    width:
                      otpInputWidth,

                    height:
                      otpInputHeight,

                    borderColor:
                      error
                        ? colors.error
                        : digit
                          ? colors.primary
                          : isDark
                            ? '#333333'
                            : '#E0E0E0',

                    backgroundColor:
                      isDark
                        ? '#1E1E1E'
                        : '#FFFFFF',

                    color:
                      isDark
                        ? '#FFFFFF'
                        : '#1A1A1A',
                  },
                ]}

                value={digit}

                onChangeText={(
                  text
                ) =>
                  handleOtpChange(
                    text,
                    index
                  )
                }

                onKeyPress={(
                  e
                ) =>
                  handleKeyPress(
                    e,
                    index
                  )
                }

                keyboardType="number-pad"

                inputMode="numeric"

                maxLength={6}

                autoFocus={
                  index === 0
                }

                selectTextOnFocus

                editable={
                  !isLoading
                }

                textContentType="oneTimeCode"

                autoComplete={
                  Platform.OS === 'web'
                    ? 'one-time-code'
                    : 'sms-otp'
                }
              />

            )
          )}

        </View>


        {/* ==================================================
            ERROR
        ================================================== */}

        {error ? (

          <Animatable.View
            animation="fadeIn"
            style={
              styles.errorContainer
            }
          >

            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={
                colors.error
              }
            />

            <Text
              style={[
                styles.errorText,
                {
                  color:
                    colors.error,
                },
              ]}
            >
              {error}
            </Text>

          </Animatable.View>

        ) : null}


        {/* ==================================================
            TIMER / RESEND
        ================================================== */}

        <View
          style={
            styles.timerContainer
          }
        >

          <View
            style={
              styles.timerLeft
            }
          >

            <Ionicons
              name="time-outline"
              size={16}
              color={
                isDark
                  ? '#AAAAAA'
                  : '#757575'
              }
            />

            <Text
              style={[
                styles.timerText,
                {
                  color:
                    isDark
                      ? '#AAAAAA'
                      : '#757575',
                },
              ]}
            >

              {canResend
                ? (
                  <Text
                    style={
                      styles.resendAvailable
                    }
                  >
                    Vous pouvez renvoyer
                  </Text>
                )
                : (
                  `Renvoyer dans ${timer}s`
                )}

            </Text>

          </View>


          <TouchableOpacity
            onPress={
              handleResend
            }
            disabled={
              !canResend ||
              isResending
            }
            activeOpacity={0.7}
          >

            <Text
              style={[
                styles.resendText,

                canResend &&
                !isResending
                  ? styles.resendActive
                  : styles.resendInactive,
              ]}
            >

              {isResending
                ? 'Envoi...'
                : 'Renvoyer le code'}

            </Text>

          </TouchableOpacity>

        </View>


        {/* ==================================================
            VERIFY BUTTON
        ================================================== */}

        <Pressable
          onPress={
            handleVerify
          }

          disabled={
            isLoading
          }

          accessibilityRole="button"

          accessibilityLabel={
            'Vérifier le code OTP'
          }

          style={({
            pressed,
            hovered,
            focused,
          }) => [

            styles.verifyButton,

            isLoading &&
              styles.verifyButtonDisabled,

            hovered &&
              styles.verifyButtonHover,

            pressed &&
              styles.verifyButtonPressed,

            focused &&
              styles.verifyButtonFocused,

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
              styles.verifyGradient
            }
          >

            {isLoading ? (

              <View
                style={
                  styles.loadingContainer
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
                  Vérification...
                </Text>

              </View>

            ) : (

              <>

                <Text
                  style={
                    styles.verifyButtonText
                  }
                >
                  Vérifier
                </Text>

                <View
                  style={
                    styles.verifyArrow
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
            INFORMATION
        ================================================== */}

        <View
          style={
            styles.infoContainer
          }
        >

          <View
            style={
              styles.infoIcon
            }
          >

            <Ionicons
              name="information-circle"
              size={18}
              color={
                colors.primary
              }
            />

          </View>

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
            Si vous ne recevez pas le code, vérifiez vos spams
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
          ? 28
          : 20;

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

            {/* DECORATIVE CIRCLES */}

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


            {/* TOAST */}

            {renderToast()}


            <ScrollView
              style={
                styles.mobileScroll
              }

              contentContainerStyle={[
                styles.mobileScrollContent,
                {
                  paddingTop:
                    16 +
                    (
                      isSmallScreen
                        ? 5
                        : 15
                    ),

                  paddingBottom:
                    30,

                  paddingHorizontal:
                    horizontalPadding,
                },
              ]}

              showsVerticalScrollIndicator={
                false
              }

              keyboardShouldPersistTaps="handled"
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


                {/* HEADER CARD */}

                <Animatable.View
                  animation="fadeInUp"
                  duration={700}
                  delay={250}
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
                      name="shield-checkmark"
                      size={30}
                      color="#FFFFFF"
                    />

                  </View>


                  <Text
                    style={
                      styles.mobileHeaderTitle
                    }
                  >
                    Vérification OTP
                  </Text>


                  <Text
                    style={
                      styles.mobileHeaderSubtitle
                    }
                  >
                    Un code a été envoyé à {email}
                  </Text>

                </Animatable.View>


                {/* FORM CARD */}

                <View
                  style={[
                    styles.mobileFormCard,
                    {
                      backgroundColor:
                        isDark
                          ? '#151515'
                          : '#FFFFFF',
                    },
                  ]}
                >

                  {renderOtpForm()}

                </View>


                {/* FOOTER */}

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

              </Animated.View>

            </ScrollView>

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


          {/* TOAST */}

          {renderToast()}


          <View
            style={
              styles.desktopContainer
            }
          >

            {/* ==================================================
                LEFT BRAND PANEL
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

                  <View
                    style={
                      styles.desktopSecurityIcon
                    }
                  >

                    <Ionicons
                      name="shield-checkmark"
                      size={34}
                      color="#FFFFFF"
                    />

                  </View>


                  <Text
                    style={
                      styles.desktopBrandTitle
                    }
                  >
                    Vérifiez votre{"\n"}
                    compte en toute{"\n"}
                    sécurité.
                  </Text>


                  <Text
                    style={
                      styles.desktopBrandDescription
                    }
                  >
                    Un code de vérification
                    vous a été envoyé à votre
                    adresse email afin de
                    sécuriser votre compte.
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
                          Votre compte est protégé
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
                          Saisissez les 6 chiffres reçus
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
                          Protection de vos données
                        </Text>

                        <Text
                          style={
                            styles.desktopFeatureDescription
                          }
                        >
                          Une expérience fiable et sécurisée
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
                RIGHT CONTENT
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

                  {renderOtpForm()}


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
  // RETURN
  // ==========================================================

  const content =
    isDesktop
      ? renderDesktop()
      : renderMobile();


  if (
    Platform.OS !== 'web'
  ) {

    return (
      <TouchableWithoutFeedback
        onPress={
          Keyboard.dismiss
        }
      >
        {content}
      </TouchableWithoutFeedback>
    );

  }


  return content;
};


// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

  // ==========================================================
  // TOAST
  // ==========================================================

  toastWrapper: {
    position: 'absolute',
    zIndex: 99999,
    elevation: 99999,
  },

  toastWrapperMobile: {
    top: Platform.OS === 'ios'
      ? 55
      : 35,

    left: 16,
    right: 16,
  },

  toastWrapperWeb: {
    top: 25,
    right: 28,
    width: 390,
  },

  toast: {
    minHeight: 72,

    borderRadius: 16,

    borderLeftWidth: 4,

    flexDirection: 'row',

    alignItems: 'center',

    paddingVertical: 12,
    paddingHorizontal: 13,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.15,

    shadowRadius: 16,

    elevation: 12,
  },

  toastIconContainer: {
    width: 40,
    height: 40,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  toastContent: {
    flex: 1,

    minWidth: 0,
  },

  toastTitle: {
    fontSize: 14,

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
    width: 30,
    height: 30,

    borderRadius: 15,

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
  // BACKGROUND CIRCLES
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
  // FORM CARD
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
  },


  // ==========================================================
  // OTP
  // ==========================================================

  otpContainer: {
    width: '100%',

    flexDirection: 'row',

    justifyContent:
      'center',

    marginBottom:
      spacing.sm,
  },

  otpInput: {
    borderRadius: 13,

    borderWidth: 2,

    textAlign: 'center',

    fontSize:
      typography.fontSize.xxl,

    fontFamily:
      typography.fontFamily.bold,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.04,

    shadowRadius: 4,

    elevation: 1,
  },


  // ==========================================================
  // ERROR
  // ==========================================================

  errorContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 5,

    marginTop: 4,

    marginBottom: 8,
  },

  errorText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',

    marginLeft: 5,

    flexShrink: 1,
  },


  // ==========================================================
  // TIMER
  // ==========================================================

  timerContainer: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    alignItems: 'center',

    marginBottom:
      spacing.lg,

    marginTop: 5,
  },

  timerLeft: {
    flexDirection: 'row',

    alignItems: 'center',

    flexShrink: 1,
  },

  timerText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,

    marginLeft: 5,
  },

  resendAvailable: {
    color:
      colors.error ||
      '#FF0000',

    fontFamily:
      typography.fontFamily.medium,
  },

  resendText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.medium,
  },

  resendInactive: {
    color: '#999',
  },

  resendActive: {
    color:
      colors.primary,
  },


  // ==========================================================
  // VERIFY BUTTON
  // ==========================================================

  verifyButton: {
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

  verifyButtonDisabled: {
    opacity: 0.7,
  },

  verifyButtonHover: {
    shadowOpacity: 0.34,

    shadowRadius: 14,

    transform: [
      {
        translateY: -1,
      },
    ],
  },

  verifyButtonPressed: {
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  verifyButtonFocused: {
    borderWidth: 2,

    borderColor:
      colors.primary,
  },

  verifyGradient: {
    minHeight: 56,

    paddingHorizontal: 18,

    alignItems: 'center',

    justifyContent:
      'center',

    position: 'relative',
  },

  verifyButtonText: {
    color: '#FFFFFF',

    fontSize:
      typography.fontSize.lg,

    fontFamily:
      typography.fontFamily.bold,
  },

  verifyArrow: {
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

  loadingContainer: {
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
  // INFORMATION
  // ==========================================================

  infoContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    paddingHorizontal: 3,

    marginTop:
      spacing.md,
  },

  infoIcon: {
    marginRight: 6,
  },

  infoText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',

    flexShrink: 1,
  },


  // ==========================================================
  // MOBILE FOOTER
  // ==========================================================

  mobileFooter: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

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


  // ==========================================================
  // DESKTOP BRAND CONTENT
  // ==========================================================

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
  // DESKTOP FOOTER LEFT
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


// ============================================================
// EXPORT
// ============================================================

export default OTPVerificationScreen;