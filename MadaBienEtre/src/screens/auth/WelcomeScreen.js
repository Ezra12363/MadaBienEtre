// src/screens/auth/WelcomeScreen.js

import React, { useEffect, useRef } from 'react';

import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  Platform,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';

import { typography } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================
// WELCOME SCREEN
// ============================================================

const WelcomeScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ==========================================================
  // RESPONSIVE
  // ==========================================================

  const isWeb = Platform.OS === 'web';

  const isDesktop = isWeb && width >= 1000;

  const isTablet =
    width >= 768 && width < 1000;

  const isMobile =
    !isWeb || width < 768;

  const isSmallScreen =
    height < 700;

  const isVerySmallScreen =
    height < 600;

  // ==========================================================
  // ANIMATION
  // ==========================================================

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 850,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  // ==========================================================
  // MOBILE FEATURES
  // Design inspiré de l'image fournie
  // 3 lignes compactes
  // ==========================================================

  const mobileFeatures = [
    {
      icon: 'body-outline',
      title: 'Praticiens vérifiés',
      description: 'Des professionnels contrôlés et qualifiés',
    },
    {
      icon: 'home-outline',
      title: 'À domicile',
      description: 'Profitez de votre séance directement chez vous',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Service sécurisé',
      description: 'Une expérience pensée pour votre sécurité',
    },
  ];

  // ==========================================================
  // WEB FEATURES
  // 6 fonctionnalités
  // 2 cartes par ligne
  // ==========================================================

  const essentialFeatures = [
    {
      icon: 'calendar-outline',
      title: 'Réservation simple',
      description:
        'Choisissez votre massage, la durée, la date et l’heure.',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Praticiens vérifiés',
      description:
        'Accédez à des professionnels contrôlés et qualifiés.',
    },
    {
      icon: 'cash-outline',
      title: 'Prix négociable',
      description:
        'Proposez votre prix et recevez des offres adaptées.',
    },
    {
      icon: 'location-outline',
      title: 'Géolocalisation',
      description:
        'Trouvez un praticien proche et suivez son arrivée.',
    },
    {
      icon: 'chatbubble-ellipses-outline',
      title: 'Communication directe',
      description:
        'Échangez facilement avec votre praticien avant la séance.',
    },
    {
      icon: 'alert-circle-outline',
      title: 'Sécurité renforcée',
      description:
        'Profitez d’un environnement sécurisé avec assistance SOS.',
    },
  ];

  // ==========================================================
  // WEB FEATURE CARD
  // ==========================================================

  const renderEssentialCard = (feature, index) => {
    return (
      <Animatable.View
        key={`${feature.title}-${index}`}
        animation="fadeInUp"
        duration={600}
        delay={150 + index * 70}
        style={styles.webFeatureCard}
      >
        <View style={styles.webFeatureTop}>
          <View style={styles.webFeatureIcon}>
            <Ionicons
              name={feature.icon}
              size={21}
              color="#2E7D32"
            />
          </View>

          <View style={styles.webFeatureCheck}>
            <Ionicons
              name="checkmark"
              size={13}
              color="#2E7D32"
            />
          </View>
        </View>

        <Text style={styles.webFeatureTitle}>
          {feature.title}
        </Text>

        <Text style={styles.webFeatureDescription}>
          {feature.description}
        </Text>
      </Animatable.View>
    );
  };

  // ==========================================================
  // MOBILE
  // ==========================================================

  const renderMobile = () => {
    const logoSize = isTablet
      ? 118
      : isVerySmallScreen
        ? 82
        : 100;

    const logoImageSize = isTablet
      ? 76
      : isVerySmallScreen
        ? 54
        : 66;

    const horizontalPadding = isTablet
      ? 28
      : 18;

    return (
      <SafeAreaView style={styles.mobileSafeArea}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />

        <LinearGradient
          colors={[
            '#164B2A',
            '#1D6536',
            '#24743A',
            '#2E7D32',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mobileGradient}
        >

          {/* ==================================================
              BACKGROUND DECORATION
          ================================================== */}

          <View
            pointerEvents="none"
            style={[
              styles.circleTop,
              {
                width: isTablet ? 360 : 270,
                height: isTablet ? 360 : 270,
                borderRadius: isTablet ? 180 : 135,
              },
            ]}
          />

          <View
            pointerEvents="none"
            style={[
              styles.circleMiddle,
              {
                width: isTablet ? 240 : 180,
                height: isTablet ? 240 : 180,
                borderRadius: isTablet ? 120 : 90,
              },
            ]}
          />

          <View
            pointerEvents="none"
            style={[
              styles.circleBottom,
              {
                width: isTablet ? 360 : 280,
                height: isTablet ? 360 : 280,
                borderRadius: isTablet ? 180 : 140,
              },
            ]}
          />

          {/* ==================================================
              CONTENT
          ================================================== */}

          <ScrollView
            style={styles.mobileScroll}
            contentContainerStyle={[
              styles.mobileScrollContent,
              {
                paddingTop:
                  Math.max(insets.top, 12) +
                  (isSmallScreen ? 2 : 8),

                paddingBottom:
                  Math.max(insets.bottom, 12) +
                  (isSmallScreen ? 16 : 24),

                paddingHorizontal:
                  horizontalPadding,
              },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >

            <View
              style={[
                styles.mobileMainWrapper,
                {
                  maxWidth: isTablet ? 560 : 520,
                },
              ]}
            >

              {/* ==================================================
                  HERO
              ================================================== */}

              <Animated.View
                style={[
                  styles.mobileHero,
                  {
                    opacity: fadeAnim,
                  },
                ]}
              >

                {/* ==================================================
                    LOGO
                ================================================== */}

                <Animatable.View
                  animation="zoomIn"
                  duration={800}
                  delay={100}
                >
                  <View
                    style={[
                      styles.logoWrapper,
                      {
                        width: logoSize,
                        height: logoSize,
                        borderRadius: isTablet ? 36 : 30,
                      },
                    ]}
                  >
                    <View style={styles.logoInner}>
                      <Image
                        source={require(
                          '../../../assets/logo.png'
                        )}
                        style={{
                          width: logoImageSize,
                          height: logoImageSize,
                        }}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                </Animatable.View>

                {/* ==================================================
                    BRAND
                ================================================== */}

                <Animatable.View
                  animation="fadeInUp"
                  duration={700}
                  delay={300}
                  style={styles.titleBlock}
                >
                  <Text
                    style={[
                      styles.title,
                      {
                        fontSize: isTablet
                          ? 36
                          : isVerySmallScreen
                            ? 28
                            : 32,
                      },
                    ]}
                  >
                    Mada Bien-être
                  </Text>

                  <Text
                    style={[
                      styles.subtitle,
                      {
                        fontSize: isTablet ? 17 : 15,
                      },
                    ]}
                  >
                    Massage à domicile,
                    simple et premium
                  </Text>
                </Animatable.View>

                {/* ==================================================
                    INTRO
                ================================================== */}

                <Animatable.View
                  animation="fadeInUp"
                  duration={700}
                  delay={450}
                  style={styles.introCard}
                >
                  <View style={styles.introIcon}>
                    <Ionicons
                      name="sparkles-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>

                  <View style={styles.introTextContainer}>
                    <Text style={styles.introTitle}>
                      Votre bien-être, notre priorité
                    </Text>

                    <Text style={styles.introText}>
                      Trouvez facilement un professionnel
                      qualifié et profitez d'un massage
                      directement chez vous.
                    </Text>
                  </View>
                </Animatable.View>

                {/* ==================================================
                    MOBILE FEATURES
                    EXACTEMENT 3 LIGNES
                ================================================== */}

                <Animatable.View
                  animation="fadeInUp"
                  duration={700}
                  delay={600}
                  style={styles.mobileFeaturesContainer}
                >

                  {mobileFeatures.map(
                    (feature, index) => (
                      <View
                        key={feature.title}
                        style={[
                          styles.mobileFeatureItem,
                          index ===
                            mobileFeatures.length - 1 &&
                            styles.mobileFeatureItemLast,
                        ]}
                      >

                        {/* ICON */}

                        <View
                          style={
                            styles.mobileFeatureIcon
                          }
                        >
                          <Ionicons
                            name={feature.icon}
                            size={21}
                            color="#FFFFFF"
                          />
                        </View>

                        {/* TEXT */}

                        <View
                          style={
                            styles.mobileFeatureContent
                          }
                        >
                          <Text
                            style={
                              styles.mobileFeatureTitle
                            }
                            numberOfLines={1}
                          >
                            {feature.title}
                          </Text>

                          <Text
                            style={
                              styles.mobileFeatureDescription
                            }
                            numberOfLines={1}
                          >
                            {feature.description}
                          </Text>
                        </View>

                        {/* CHECK */}

                        <View
                          style={
                            styles.mobileFeatureCheck
                          }
                        >
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color="#2E7D32"
                          />
                        </View>

                      </View>
                    )
                  )}

                </Animatable.View>

              </Animated.View>

              {/* ==================================================
                  ACTIONS
              ================================================== */}

              <Animatable.View
                animation="fadeInUp"
                duration={750}
                delay={750}
                style={[
                  styles.mobileBottomContainer,
                  {
                    marginTop: isSmallScreen
                      ? 22
                      : 30,
                  },
                ]}
              >

                {/* ==================================================
                    LOGIN
                ================================================== */}

                <Pressable
                  onPress={handleLogin}
                  accessibilityRole="button"
                  accessibilityLabel="Se connecter"
                  style={({
                    pressed,
                    hovered,
                    focused,
                  }) => [
                    styles.primaryButton,
                    hovered &&
                      styles.primaryButtonHover,
                    pressed &&
                      styles.primaryButtonPressed,
                    focused &&
                      styles.buttonFocused,
                  ]}
                >
                  <View
                    style={
                      styles.primaryButtonContent
                    }
                  >
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Se connecter
                    </Text>

                    <View
                      style={styles.arrowCircle}
                    >
                      <Ionicons
                        name="arrow-forward"
                        size={19}
                        color="#2E7D32"
                      />
                    </View>
                  </View>
                </Pressable>

                {/* ==================================================
                    REGISTER
                ================================================== */}

                <Pressable
                  onPress={handleRegister}
                  accessibilityRole="button"
                  accessibilityLabel="Créer un compte"
                  style={({
                    pressed,
                    hovered,
                    focused,
                  }) => [
                    styles.secondaryButton,
                    hovered &&
                      styles.secondaryButtonHover,
                    pressed &&
                      styles.secondaryButtonPressed,
                    focused &&
                      styles.buttonFocused,
                  ]}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={19}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    Créer un compte
                  </Text>
                </Pressable>

                {/* ==================================================
                    FOOTER
                ================================================== */}

                <View style={styles.footer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={13}
                    color="rgba(255,255,255,0.65)"
                  />

                  <Text style={styles.footerText}>
                    Une expérience bien-être sécurisée
                  </Text>
                </View>

              </Animatable.View>

            </View>

          </ScrollView>

        </LinearGradient>
      </SafeAreaView>
    );
  };

  // ==========================================================
  // WEB / DESKTOP
  // 50% / 50%
  // ==========================================================

  const renderDesktop = () => {
    return (
      <SafeAreaView style={styles.desktopSafeArea}>

        <StatusBar
          barStyle="light-content"
          backgroundColor="#164B2A"
        />

        <View style={styles.desktopContainer}>

          {/* ==================================================
              LEFT PANEL — 50%
          ================================================== */}

          <View style={styles.desktopLeftPanel}>

            <LinearGradient
              colors={[
                '#164B2A',
                '#1F6B38',
                '#2E7D32',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.desktopLeftGradient}
            >

              {/* DECORATION */}

              <View
                pointerEvents="none"
                style={styles.desktopCircleOne}
              />

              <View
                pointerEvents="none"
                style={styles.desktopCircleTwo}
              />

              {/* ==================================================
                  HEADER
              ================================================== */}

              <Animatable.View
                animation="fadeInDown"
                duration={700}
                style={styles.desktopBrandHeader}
              >

                <View style={styles.desktopLogoBox}>
                  <Image
                    source={require(
                      '../../../assets/logo.png'
                    )}
                    style={styles.desktopLogo}
                    resizeMode="contain"
                  />
                </View>

                <View>
                  <Text
                    style={
                      styles.desktopBrandName
                    }
                  >
                    Mada Bien-être
                  </Text>

                  <Text
                    style={
                      styles.desktopBrandSmall
                    }
                  >
                    Votre bien-être, simplement.
                  </Text>
                </View>

              </Animatable.View>

              {/* ==================================================
                  LEFT HERO
              ================================================== */}

              <View style={styles.desktopLeftContent}>

                <Animatable.View
                  animation="fadeInUp"
                  duration={750}
                  delay={150}
                >

                  <View style={styles.webEyebrow}>

                    <Ionicons
                      name="sparkles-outline"
                      size={14}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.webEyebrowText
                      }
                    >
                      BIEN-ÊTRE À DOMICILE
                    </Text>

                  </View>

                  <Text
                    style={
                      styles.desktopBrandTitle
                    }
                  >
                    Le massage à domicile,
                    réinventé.
                  </Text>

                  <Text
                    style={
                      styles.desktopBrandDescription
                    }
                  >
                    Une plateforme simple et intelligente
                    pour réserver un massage à domicile
                    auprès de praticiens vérifiés.
                  </Text>

                </Animatable.View>

                {/* ==================================================
                    VALUE POINTS
                ================================================== */}

                <Animatable.View
                  animation="fadeInUp"
                  duration={700}
                  delay={350}
                  style={styles.desktopValueList}
                >

                  <View
                    style={
                      styles.desktopValueItem
                    }
                  >
                    <View
                      style={
                        styles.desktopValueIcon
                      }
                    >
                      <Ionicons
                        name="flash-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                    </View>

                    <View
                      style={
                        styles.desktopValueContent
                      }
                    >
                      <Text
                        style={
                          styles.desktopValueTitle
                        }
                      >
                        Réservation rapide
                      </Text>

                      <Text
                        style={
                          styles.desktopValueDescription
                        }
                      >
                        Réservez votre séance en quelques
                        étapes.
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.desktopValueItem
                    }
                  >
                    <View
                      style={
                        styles.desktopValueIcon
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
                        styles.desktopValueContent
                      }
                    >
                      <Text
                        style={
                          styles.desktopValueTitle
                        }
                      >
                        Praticiens à proximité
                      </Text>

                      <Text
                        style={
                          styles.desktopValueDescription
                        }
                      >
                        Trouvez facilement un professionnel
                        disponible autour de vous.
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.desktopValueItem
                    }
                  >
                    <View
                      style={
                        styles.desktopValueIcon
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
                        styles.desktopValueContent
                      }
                    >
                      <Text
                        style={
                          styles.desktopValueTitle
                        }
                      >
                        Sécurité renforcée
                      </Text>

                      <Text
                        style={
                          styles.desktopValueDescription
                        }
                      >
                        Profils vérifiés et assistance SOS.
                      </Text>
                    </View>
                  </View>

                </Animatable.View>

              </View>

              {/* ==================================================
                  LEFT FOOTER
              ================================================== */}

              <View
                style={
                  styles.desktopLeftFooter
                }
              >

                <Text
                  style={
                    styles.desktopCopyright
                  }
                >
                  © 2026 Mada Bien-être
                </Text>

                <View
                  style={
                    styles.desktopFooterSecure
                  }
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={13}
                    color="rgba(255,255,255,0.7)"
                  />

                  <Text
                    style={
                      styles.desktopFooterSecureText
                    }
                  >
                    Plateforme sécurisée
                  </Text>
                </View>

              </View>

            </LinearGradient>

          </View>

          {/* ==================================================
              RIGHT PANEL — 50%
          ================================================== */}

          <View style={styles.desktopRightPanel}>

            <ScrollView
              style={styles.desktopScroll}
              contentContainerStyle={
                styles.desktopScrollContent
              }
              showsVerticalScrollIndicator={false}
            >

              <Animated.View
                style={[
                  styles.desktopRightContent,
                  {
                    opacity: fadeAnim,
                  },
                ]}
              >

                {/* ==================================================
                    HEADER
                ================================================== */}

                <Animatable.View
                  animation="fadeInUp"
                  duration={650}
                  delay={100}
                >

                  <Text
                    style={
                      styles.webSectionLabel
                    }
                  >
                    EXPÉRIENCE SIMPLE
                  </Text>

                  <Text
                    style={
                      styles.desktopWelcomeTitle
                    }
                  >
                    Les fonctionnalités essentielles
                  </Text>

                  <Text
                    style={
                      styles.desktopWelcomeSubtitle
                    }
                  >
                    Tout ce dont vous avez besoin,
                    sans fonctionnalités inutiles.
                  </Text>

                </Animatable.View>

                {/* ==================================================
                    6 FEATURES
                    2 COLONNES
                ================================================== */}

                <View
                  style={
                    styles.essentialSection
                  }
                >

                  <View
                    style={
                      styles.featureGrid
                    }
                  >

                    {essentialFeatures.map(
                      (feature, index) =>
                        renderEssentialCard(
                          feature,
                          index
                        )
                    )}

                  </View>

                </View>

                {/* ==================================================
                    ACTIONS
                ================================================== */}

                <Animatable.View
                  animation="fadeInUp"
                  duration={700}
                  delay={600}
                  style={styles.desktopActions}
                >

                  {/* LOGIN */}

                  <Pressable
                    onPress={handleLogin}
                    accessibilityRole="button"
                    accessibilityLabel="Se connecter"
                    style={({
                      pressed,
                      hovered,
                      focused,
                    }) => [
                      styles.desktopPrimaryButton,
                      hovered &&
                        styles.desktopPrimaryButtonHover,
                      pressed &&
                        styles.desktopPrimaryButtonPressed,
                      focused &&
                        styles.desktopButtonFocused,
                    ]}
                  >

                    <Text
                      style={
                        styles.desktopPrimaryButtonText
                      }
                    >
                      Se connecter
                    </Text>

                    <View
                      style={
                        styles.desktopArrowCircle
                      }
                    >
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>

                  </Pressable>

                  {/* REGISTER */}

                  <Pressable
                    onPress={handleRegister}
                    accessibilityRole="button"
                    accessibilityLabel="Créer un compte"
                    style={({
                      pressed,
                      hovered,
                      focused,
                    }) => [
                      styles.desktopSecondaryButton,
                      hovered &&
                        styles.desktopSecondaryButtonHover,
                      pressed &&
                        styles.desktopSecondaryButtonPressed,
                      focused &&
                        styles.desktopButtonFocused,
                    ]}
                  >

                    <Ionicons
                      name="person-add-outline"
                      size={18}
                      color="#2E7D32"
                    />

                    <Text
                      style={
                        styles.desktopSecondaryButtonText
                      }
                    >
                      Créer un compte
                    </Text>

                  </Pressable>

                </Animatable.View>

                {/* ==================================================
                    DOWNLOAD APP
                    WEB UNIQUEMENT
                ================================================== */}

                {isWeb && (
                  <Animatable.View
                    animation="fadeInUp"
                    duration={650}
                    delay={700}
                    style={
                      styles.downloadSection
                    }
                  >

                    <View
                      style={
                        styles.downloadHeader
                      }
                    >

                      <View
                        style={
                          styles.downloadIcon
                        }
                      >
                        <Ionicons
                          name="phone-portrait-outline"
                          size={21}
                          color="#2E7D32"
                        />
                      </View>

                      <View
                        style={
                          styles.downloadHeaderContent
                        }
                      >

                        <Text
                          style={
                            styles.downloadTitle
                          }
                        >
                          Téléchargez l'application
                        </Text>

                        <Text
                          style={
                            styles.downloadSubtitle
                          }
                        >
                          Retrouvez Mada Bien-être
                          sur votre smartphone.
                        </Text>

                      </View>

                    </View>

                    {/* ==================================================
                        MAIN DOWNLOAD BUTTON
                    ================================================== */}

                    <Pressable
                      onPress={() => {}}
                      accessibilityRole="button"
                      accessibilityLabel="Télécharger l'application"
                      style={({
                        pressed,
                        hovered,
                      }) => [
                        styles.downloadMainButton,
                        hovered &&
                          styles.downloadMainButtonHover,
                        pressed &&
                          styles.downloadMainButtonPressed,
                      ]}
                    >

                      <View
                        style={
                          styles.downloadMainIcon
                        }
                      >
                        <Ionicons
                          name="download-outline"
                          size={22}
                          color="#FFFFFF"
                        />
                      </View>

                      <View
                        style={
                          styles.downloadMainContent
                        }
                      >

                        <Text
                          style={
                            styles.downloadMainTitle
                          }
                        >
                          Télécharger l'application
                        </Text>

                        <Text
                          style={
                            styles.downloadMainSubtitle
                          }
                        >
                          Android & iOS
                        </Text>

                      </View>

                      <Ionicons
                        name="arrow-forward"
                        size={20}
                        color="#FFFFFF"
                      />

                    </Pressable>

                    {/* ==================================================
                        STORE BUTTONS
                    ================================================== */}

                    <View
                      style={
                        styles.downloadButtons
                      }
                    >

                      {/* ANDROID */}

                      <Pressable
                        style={({
                          pressed,
                          hovered,
                        }) => [
                          styles.downloadButton,
                          hovered &&
                            styles.downloadButtonHover,
                          pressed &&
                            styles.downloadButtonPressed,
                        ]}
                        onPress={() => {}}
                      >

                        <Ionicons
                          name="logo-google-playstore"
                          size={22}
                          color="#2E7D32"
                        />

                        <View
                          style={
                            styles.downloadButtonTextContainer
                          }
                        >

                          <Text
                            style={
                              styles.downloadSmallText
                            }
                          >
                            DISPONIBLE SUR
                          </Text>

                          <Text
                            style={
                              styles.downloadMainText
                            }
                          >
                            Google Play
                          </Text>

                        </View>

                      </Pressable>

                      {/* IOS */}

                      <Pressable
                        style={({
                          pressed,
                          hovered,
                        }) => [
                          styles.downloadButton,
                          hovered &&
                            styles.downloadButtonHover,
                          pressed &&
                            styles.downloadButtonPressed,
                        ]}
                        onPress={() => {}}
                      >

                        <Ionicons
                          name="logo-apple"
                          size={23}
                          color="#2E7D32"
                        />

                        <View
                          style={
                            styles.downloadButtonTextContainer
                          }
                        >

                          <Text
                            style={
                              styles.downloadSmallText
                            }
                          >
                            TÉLÉCHARGER SUR
                          </Text>

                          <Text
                            style={
                              styles.downloadMainText
                            }
                          >
                            App Store
                          </Text>

                        </View>

                      </Pressable>

                    </View>

                  </Animatable.View>
                )}

                {/* ==================================================
                    FOOTER
                ================================================== */}

                <View
                  style={
                    styles.desktopFooter
                  }
                >

                  <Text
                    style={
                      styles.desktopFooterTechnology
                    }
                  >
                    Bien-être • Confiance • Proximité
                  </Text>

                  <Text
                    style={
                      styles.desktopFooterCopyright
                    }
                  >
                    © 2026 Mada Bien-être
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

  return isDesktop
    ? renderDesktop()
    : renderMobile();
};


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

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
    alignItems: 'center',
  },

  mobileMainWrapper: {
    width: '100%',
    flexGrow: 1,
  },

  // ==========================================================
  // MOBILE BACKGROUND
  // ==========================================================

  circleTop: {
    position: 'absolute',
    top: -135,
    right: -115,
    backgroundColor:
      'rgba(255,255,255,0.055)',
  },

  circleMiddle: {
    position: 'absolute',
    top: '38%',
    left: -120,
    backgroundColor:
      'rgba(255,255,255,0.025)',
  },

  circleBottom: {
    position: 'absolute',
    bottom: -180,
    right: -120,
    backgroundColor:
      'rgba(255,255,255,0.045)',
  },

  // ==========================================================
  // MOBILE HERO
  // ==========================================================

  mobileHero: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 6,
  },

  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.13)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.20)',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },

  logoInner: {
    width: '76%',
    height: '76%',

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.95)',

    borderRadius: 24,
  },

  titleBlock: {
    alignItems: 'center',
    marginTop: 18,
  },

  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily:
      typography.fontFamily.bold,
    letterSpacing: 0.2,
  },

  subtitle: {
    color:
      'rgba(255,255,255,0.86)',
    textAlign: 'center',
    fontFamily:
      typography.fontFamily.regular,
    marginTop: 5,
    lineHeight: 22,
  },

  // ==========================================================
  // MOBILE INTRO
  // ==========================================================

  introCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 23,

    paddingVertical: 14,
    paddingHorizontal: 14,

    borderRadius: 18,

    backgroundColor:
      'rgba(255,255,255,0.095)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.12)',
  },

  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.14)',

    marginRight: 12,
  },

  introTextContainer: {
    flex: 1,
  },

  introTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily:
      typography.fontFamily.bold,
    marginBottom: 3,
  },

  introText: {
    color:
      'rgba(255,255,255,0.73)',
    fontSize: 12,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.regular,
  },

  // ==========================================================
  // MOBILE FEATURES
  // STYLE COMME L'IMAGE
  // ==========================================================

  mobileFeaturesContainer: {
    width: '100%',
    marginTop: 15,

    borderRadius: 16,
    overflow: 'hidden',

    backgroundColor:
      'rgba(18,91,39,0.52)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  mobileFeatureItem: {
    width: '100%',
    minHeight: 57,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 10,

    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255,255,255,0.08)',
  },

  mobileFeatureItemLast: {
    borderBottomWidth: 0,
  },

  // Petit carré blanc comme sur l'image

  mobileFeatureIcon: {
    width: 39,
    height: 39,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.88)',

    marginRight: 10,
  },

  mobileFeatureContent: {
    flex: 1,
    minWidth: 0,
  },

  mobileFeatureTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    lineHeight: 16,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  mobileFeatureDescription: {
    color:
      'rgba(255,255,255,0.62)',

    fontSize: 9.5,
    lineHeight: 13,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 1,
  },

  // Cercle check à droite

  mobileFeatureCheck: {
    width: 18,
    height: 18,

    borderRadius: 9,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.88)',

    marginLeft: 7,
  },

  // ==========================================================
  // MOBILE ACTIONS
  // ==========================================================

  mobileBottomContainer: {
    width: '100%',
  },

  primaryButton: {
    width: '100%',
    minHeight: 55,

    borderRadius: 16,

    backgroundColor: '#FFFFFF',

    justifyContent: 'center',

    paddingHorizontal: 18,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,

    elevation: 6,
  },

  primaryButtonContent: {
    width: '100%',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#2E7D32',
    fontSize: 15.5,

    fontFamily:
      typography.fontFamily.bold,
  },

  arrowCircle: {
    position: 'absolute',
    right: 0,

    width: 37,
    height: 37,

    borderRadius: 19,

    backgroundColor:
      'rgba(46,125,50,0.10)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonHover: {
    transform: [
      {
        translateY: -2,
      },
    ],
    shadowOpacity: 0.25,
    elevation: 9,
  },

  primaryButtonPressed: {
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  secondaryButton: {
    width: '100%',
    minHeight: 53,

    marginTop: 11,

    borderRadius: 16,

    borderWidth: 1.3,
    borderColor:
      'rgba(255,255,255,0.43)',

    backgroundColor:
      'rgba(255,255,255,0.055)',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 9,
  },

  secondaryButtonHover: {
    backgroundColor:
      'rgba(255,255,255,0.12)',

    borderColor:
      'rgba(255,255,255,0.72)',
  },

  secondaryButtonPressed: {
    backgroundColor:
      'rgba(255,255,255,0.16)',

    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  buttonFocused: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 15,

    gap: 5,
  },

  footerText: {
    color:
      'rgba(255,255,255,0.60)',

    fontSize: 11,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',
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
  // LEFT — 50%
  // ==========================================================

  desktopLeftPanel: {
    width: '50%',
    height: '100%',
  },

  desktopLeftGradient: {
    flex: 1,

    paddingHorizontal: 55,
    paddingVertical: 40,

    justifyContent: 'space-between',

    overflow: 'hidden',
  },

  desktopCircleOne: {
    position: 'absolute',

    width: 420,
    height: 420,

    borderRadius: 210,

    right: -210,
    top: -130,

    backgroundColor:
      'rgba(255,255,255,0.045)',
  },

  desktopCircleTwo: {
    position: 'absolute',

    width: 350,
    height: 350,

    borderRadius: 175,

    left: -230,
    bottom: -180,

    backgroundColor:
      'rgba(255,255,255,0.04)',
  },

  desktopBrandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  desktopLogoBox: {
    width: 58,
    height: 58,

    borderRadius: 17,

    backgroundColor:
      'rgba(255,255,255,0.15)',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 14,

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.16)',
  },

  desktopLogo: {
    width: 43,
    height: 43,
  },

  desktopBrandName: {
    color: '#FFFFFF',
    fontSize: 22,

    fontFamily:
      typography.fontFamily.bold,
  },

  desktopBrandSmall: {
    color:
      'rgba(255,255,255,0.65)',

    fontSize: 11,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 2,
  },

  desktopLeftContent: {
    width: '100%',
    maxWidth: 570,

    alignSelf: 'center',
  },

  webEyebrow: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    gap: 7,

    paddingHorizontal: 11,
    paddingVertical: 7,

    borderRadius: 20,

    backgroundColor:
      'rgba(255,255,255,0.11)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.14)',

    marginBottom: 20,
  },

  webEyebrowText: {
    color:
      'rgba(255,255,255,0.88)',

    fontSize: 9.5,

    fontFamily:
      typography.fontFamily.bold,

    letterSpacing: 1,
  },

  desktopBrandTitle: {
    color: '#FFFFFF',

    fontSize: 42,
    lineHeight: 51,

    fontFamily:
      typography.fontFamily.bold,

    marginBottom: 19,
  },

  desktopBrandDescription: {
    color:
      'rgba(255,255,255,0.88)',

    fontSize: 14.5,
    lineHeight: 24,

    fontFamily:
      typography.fontFamily.regular,

    maxWidth: 520,
  },

  desktopValueList: {
    marginTop: 38,
    gap: 16,
  },

  desktopValueItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  desktopValueIcon: {
    width: 44,
    height: 44,

    borderRadius: 14,

    backgroundColor:
      'rgba(255,255,255,0.13)',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 13,
  },

  desktopValueContent: {
    flex: 1,
  },

  desktopValueTitle: {
    color: '#FFFFFF',

    fontSize: 13.5,

    fontFamily:
      typography.fontFamily.bold,
  },

  desktopValueDescription: {
    color:
      'rgba(255,255,255,0.68)',

    fontSize: 11.5,
    lineHeight: 17,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 2,
  },

  desktopLeftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingTop: 17,

    borderTopWidth: 1,
    borderTopColor:
      'rgba(255,255,255,0.16)',
  },

  desktopCopyright: {
    color:
      'rgba(255,255,255,0.62)',

    fontSize: 10.5,

    fontFamily:
      typography.fontFamily.regular,
  },

  desktopFooterSecure: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 5,
  },

  desktopFooterSecureText: {
    color:
      'rgba(255,255,255,0.62)',

    fontSize: 10.5,

    fontFamily:
      typography.fontFamily.regular,
  },

  // ==========================================================
  // RIGHT — 50%
  // ==========================================================

  desktopRightPanel: {
    width: '50%',
    height: '100%',

    backgroundColor: '#F8FAF8',

    minWidth: 0,
  },

  desktopScroll: {
    flex: 1,
  },

  desktopScrollContent: {
    flexGrow: 1,

    paddingHorizontal: 45,
    paddingVertical: 38,
  },

  desktopRightContent: {
    width: '100%',
    maxWidth: 680,

    alignSelf: 'center',
  },

  webSectionLabel: {
    color: '#2E7D32',

    fontSize: 10,

    fontFamily:
      typography.fontFamily.bold,

    letterSpacing: 1.3,

    marginBottom: 9,
  },

  desktopWelcomeTitle: {
    color: '#17201A',

    fontSize: 29,
    lineHeight: 37,

    fontFamily:
      typography.fontFamily.bold,
  },

  desktopWelcomeSubtitle: {
    color: '#66736A',

    fontSize: 13.5,
    lineHeight: 21,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 9,

    maxWidth: 600,
  },

  // ==========================================================
  // WEB FEATURES
  // 2 CARDS / ROW
  // ==========================================================

  essentialSection: {
    width: '100%',
    marginTop: 28,
  },

  featureGrid: {
    width: '100%',

    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: 12,
  },

  webFeatureCard: {
    width: 'calc(50% - 6px)',

    minHeight: 145,

    padding: 16,

    borderRadius: 19,

    backgroundColor: '#FFFFFF',

    borderWidth: 1,
    borderColor: '#E2EAE3',

    shadowColor: '#174B27',

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.055,
    shadowRadius: 12,

    elevation: 3,
  },

  webFeatureTop: {
    width: '100%',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginBottom: 13,
  },

  webFeatureIcon: {
    width: 42,
    height: 42,

    borderRadius: 13,

    backgroundColor: '#EAF5EC',

    alignItems: 'center',
    justifyContent: 'center',
  },

  webFeatureCheck: {
    width: 23,
    height: 23,

    borderRadius: 12,

    backgroundColor: '#EDF7EF',

    alignItems: 'center',
    justifyContent: 'center',
  },

  webFeatureTitle: {
    color: '#26342A',

    fontSize: 13.5,
    lineHeight: 18,

    fontFamily:
      typography.fontFamily.bold,
  },

  webFeatureDescription: {
    color: '#77827A',

    fontSize: 10.8,
    lineHeight: 16.5,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 5,
  },

  // ==========================================================
  // WEB ACTIONS
  // ==========================================================

  desktopActions: {
    width: '100%',

    marginTop: 25,

    gap: 10,
  },

  desktopPrimaryButton: {
    width: '100%',
    minHeight: 56,

    borderRadius: 15,

    backgroundColor: '#31953A',

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',

    shadowColor: '#2E7D32',

    shadowOffset: {
      width: 0,
      height: 6,
    },

    shadowOpacity: 0.18,
    shadowRadius: 10,

    elevation: 5,
  },

  desktopPrimaryButtonText: {
    color: '#FFFFFF',

    fontSize: 15,

    fontFamily:
      typography.fontFamily.bold,
  },

  desktopArrowCircle: {
    position: 'absolute',
    right: 14,

    width: 36,
    height: 36,

    borderRadius: 18,

    backgroundColor:
      'rgba(255,255,255,0.16)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  desktopPrimaryButtonHover: {
    backgroundColor: '#2C8735',

    transform: [
      {
        translateY: -1,
      },
    ],

    shadowOpacity: 0.25,
  },

  desktopPrimaryButtonPressed: {
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  desktopSecondaryButton: {
    width: '100%',
    minHeight: 54,

    borderRadius: 15,

    borderWidth: 1,
    borderColor: '#D9E3DA',

    backgroundColor: '#FFFFFF',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 8,
  },

  desktopSecondaryButtonHover: {
    backgroundColor: '#F2F8F3',
    borderColor: '#B6CCB9',
  },

  desktopSecondaryButtonPressed: {
    backgroundColor: '#EAF2EB',

    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  desktopSecondaryButtonText: {
    color: '#2E7D32',

    fontSize: 14.5,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  desktopButtonFocused: {
    borderWidth: 2,
    borderColor: '#2E7D32',
  },

  // ==========================================================
  // DOWNLOAD WEB ONLY
  // ==========================================================

  downloadSection: {
    width: '100%',

    marginTop: 20,

    padding: 16,

    borderRadius: 17,

    backgroundColor: '#FFFFFF',

    borderWidth: 1,
    borderColor: '#E0E8E1',
  },

  downloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  downloadIcon: {
    width: 42,
    height: 42,

    borderRadius: 12,

    backgroundColor: '#EAF4EB',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 12,
  },

  downloadHeaderContent: {
    flex: 1,
  },

  downloadTitle: {
    color: '#243229',

    fontSize: 13.5,

    fontFamily:
      typography.fontFamily.bold,
  },

  downloadSubtitle: {
    color: '#7A847D',

    fontSize: 11,
    lineHeight: 16,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 2,
  },

  // ==========================================================
  // MAIN DOWNLOAD BUTTON
  // ==========================================================

  downloadMainButton: {
    width: '100%',

    minHeight: 58,

    marginTop: 14,

    borderRadius: 14,

    backgroundColor: '#2E7D32',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 12,

    shadowColor: '#2E7D32',

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.15,
    shadowRadius: 10,

    elevation: 4,
  },

  downloadMainButtonHover: {
    backgroundColor: '#276C2B',

    transform: [
      {
        translateY: -1,
      },
    ],
  },

  downloadMainButtonPressed: {
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  downloadMainIcon: {
    width: 38,
    height: 38,

    borderRadius: 11,

    backgroundColor:
      'rgba(255,255,255,0.14)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  downloadMainContent: {
    flex: 1,

    marginLeft: 10,
  },

  downloadMainTitle: {
    color: '#FFFFFF',

    fontSize: 13.5,

    fontFamily:
      typography.fontFamily.bold,
  },

  downloadMainSubtitle: {
    color:
      'rgba(255,255,255,0.72)',

    fontSize: 10.5,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 2,
  },

  // ==========================================================
  // STORE BUTTONS
  // ==========================================================

  downloadButtons: {
    flexDirection: 'row',

    gap: 9,

    marginTop: 10,
  },

  downloadButton: {
    flex: 1,

    minHeight: 50,

    borderRadius: 12,

    borderWidth: 1,
    borderColor: '#DDE6DF',

    backgroundColor: '#FFFFFF',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 11,
  },

  downloadButtonHover: {
    backgroundColor: '#F3F8F4',
    borderColor: '#BFD1C1',
  },

  downloadButtonPressed: {
    backgroundColor: '#EAF2EB',

    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  downloadButtonTextContainer: {
    marginLeft: 8,
  },

  downloadSmallText: {
    color: '#8A938D',

    fontSize: 7,

    fontFamily:
      typography.fontFamily.medium,

    letterSpacing: 0.4,
  },

  downloadMainText: {
    color: '#243229',

    fontSize: 12.5,

    fontFamily:
      typography.fontFamily.bold,

    marginTop: 1,
  },

  // ==========================================================
  // WEB FOOTER
  // ==========================================================

  desktopFooter: {
    width: '100%',

    marginTop: 20,

    paddingTop: 14,

    borderTopWidth: 1,
    borderTopColor: '#E5EAE6',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  desktopFooterTechnology: {
    color: '#8B948E',

    fontSize: 9.5,

    fontFamily:
      typography.fontFamily.regular,
  },

  desktopFooterCopyright: {
    color: '#9AA19C',

    fontSize: 9.5,

    fontFamily:
      typography.fontFamily.regular,
  },
});


// ============================================================
// EXPORT
// ============================================================

export default WelcomeScreen;