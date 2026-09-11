import React, { useRef, useState } from 'react';

import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  ScrollView,
  Pressable,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/* =========================================================
   CONFIGURATION
========================================================= */

const ANDROID_APK_URL =
  'https://10.78.77.30:8000/downloads/mada-bien-etre.apk';

const GOOGLE_PLAY_URL = '';
const APP_STORE_URL = '';

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  primary: '#2E7D32',
  primaryDark: '#164B2A',
  primaryMid: '#1F6B38',
  primaryLight: '#EAF5EC',

  background: '#F7FAF7',
  white: '#FFFFFF',

  text: '#17201A',
  textSoft: '#66736A',
  border: '#E1E9E2',
  muted: '#8A948C',

  orange: '#F59E0B',
  blue: '#2563EB',
};

/* =========================================================
   DATA
========================================================= */

const advantages = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Praticiens vérifiés',
    text: 'Trouvez des praticiens et prestataires présentés avec des informations claires.',
  },
  {
    icon: 'home-outline',
    title: 'Massage à domicile',
    text: 'Profitez de prestations de bien-être directement dans votre environnement.',
  },
  {
    icon: 'location-outline',
    title: 'Proximité',
    text: 'Recherchez plus facilement les services disponibles autour de vous.',
  },
  {
    icon: 'cash-outline',
    title: 'Prix flexible',
    text: 'Consultez les informations de prestation et échangez directement avec le praticien.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Communication directe',
    text: 'Facilitez les échanges avant et après la réservation.',
  },
  {
    icon: 'alert-circle-outline',
    title: 'Assistance SOS',
    text: 'Accédez rapidement aux informations utiles en cas de besoin.',
  },
];

const services = [
  {
    icon: 'body-outline',
    title: 'Massage à domicile',
    text: 'Réservez facilement une prestation de massage adaptée à vos besoins.',
  },
  {
    icon: 'calendar-outline',
    title: 'Réservation simple',
    text: 'Une interface pensée pour rendre votre recherche et votre réservation plus simples.',
  },
  {
    icon: 'people-outline',
    title: 'Praticiens',
    text: 'Découvrez les profils et les services proposés par les praticiens.',
  },
  {
    icon: 'map-outline',
    title: 'Géolocalisation',
    text: 'Repérez les services disponibles selon votre localisation.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Choisissez',
    text: 'Sélectionnez le type de service de bien-être dont vous avez besoin.',
  },
  {
    number: '02',
    title: 'Trouvez',
    text: 'Découvrez les praticiens et prestations disponibles.',
  },
  {
    number: '03',
    title: 'Réservez',
    text: 'Choisissez une prestation et contactez le praticien.',
  },
  {
    number: '04',
    title: 'Profitez',
    text: 'Bénéficiez de votre moment de bien-être en toute simplicité.',
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function WelcomeScreen({ navigation }) {
  const { width } = useWindowDimensions();

  const scrollRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);

  /*
    IMPORTANT :
    On utilise 850px comme limite mobile.
    Ainsi un écran Android de 720px ne sera plus considéré
    comme tablette.
  */

  const isMobile = width < 850;
  const isTablet = width >= 850 && width < 1100;
  const isDesktop = width >= 1100;

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleLogin = () => {
    setMenuOpen(false);

    if (navigation?.navigate) {
      navigation.navigate('Login');
    }
  };

  const handleRegister = () => {
    setMenuOpen(false);

    if (navigation?.navigate) {
      navigation.navigate('Register');
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  };

  const scrollToSection = (y) => {
    setMenuOpen(false);

    scrollRef.current?.scrollTo({
      y,
      animated: true,
    });
  };

  const openExternalUrl = async (url) => {
    if (!url) return;

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.log('Erreur ouverture URL :', error);
    }
  };

  /* =======================================================
     HEADER
======================================================= */

  const renderHeader = () => (
    <View style={styles.header}>
      <View
        style={[
          styles.headerInner,

          isMobile && styles.headerInnerMobile,
          isTablet && styles.headerInnerTablet,
        ]}
      >
        {/* LOGO */}

        <Pressable
          onPress={scrollToTop}
          style={[
            styles.logoContainer,
            isMobile && styles.logoContainerMobile,
          ]}
        >
          <View
            style={[
              styles.logoBox,
              isMobile && styles.logoBoxMobile,
            ]}
          >
            <Image
              source={require('../../../assets/logo.png')}
              style={[
                styles.logo,
                isMobile && styles.logoMobile,
              ]}
              resizeMode="contain"
            />
          </View>

          <View style={styles.logoTexts}>
            <Text
              style={[
                styles.logoTitle,
                isMobile && styles.logoTitleMobile,
              ]}
              numberOfLines={1}
            >
              Mada Bien-être
            </Text>

            <Text
              style={[
                styles.logoSubtitle,
                isMobile && styles.logoSubtitleMobile,
              ]}
              numberOfLines={1}
            >
              Votre bien-être, notre priorité
            </Text>
          </View>
        </Pressable>

        {/* DESKTOP NAVIGATION */}

        {!isMobile && (
          <View style={styles.desktopNav}>
            <Pressable
              style={styles.navItem}
              onPress={() => scrollToSection(0)}
            >
              <Text style={styles.navText}>
                Accueil
              </Text>
            </Pressable>

            <Pressable
              style={styles.navItem}
              onPress={() => scrollToSection(650)}
            >
              <Text style={styles.navText}>
                Services
              </Text>
            </Pressable>

            <Pressable
              style={styles.navItem}
              onPress={() => scrollToSection(1200)}
            >
              <Text style={styles.navText}>
                Avantages
              </Text>
            </Pressable>

            <Pressable
              style={styles.navItem}
              onPress={() => scrollToSection(1800)}
            >
              <Text style={styles.navText}>
                Comment ça marche
              </Text>
            </Pressable>
          </View>
        )}

        {/* DESKTOP AUTH */}

        {!isMobile && (
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleLogin}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>
                Connexion
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRegister}
              style={styles.registerButton}
            >
              <Text style={styles.registerButtonText}>
                Créer un compte
              </Text>
            </Pressable>
          </View>
        )}

        {/* MOBILE MENU BUTTON */}

        {isMobile && (
          <Pressable
            onPress={() => setMenuOpen(!menuOpen)}
            style={styles.menuButton}
          >
            <Ionicons
              name={menuOpen ? 'close' : 'menu'}
              size={28}
              color={COLORS.primaryDark}
            />
          </Pressable>
        )}
      </View>

      {/* MOBILE MENU */}

      {isMobile && menuOpen && (
        <View style={styles.mobileMenu}>
          <Pressable
            style={styles.mobileNavItem}
            onPress={() => scrollToSection(0)}
          >
            <Ionicons
              name="home-outline"
              size={20}
              color={COLORS.primary}
            />

            <Text style={styles.mobileNavText}>
              Accueil
            </Text>
          </Pressable>

          <Pressable
            style={styles.mobileNavItem}
            onPress={() => scrollToSection(650)}
          >
            <Ionicons
              name="sparkles-outline"
              size={20}
              color={COLORS.primary}
            />

            <Text style={styles.mobileNavText}>
              Services
            </Text>
          </Pressable>

          <Pressable
            style={styles.mobileNavItem}
            onPress={() => scrollToSection(1200)}
          >
            <Ionicons
              name="heart-outline"
              size={20}
              color={COLORS.primary}
            />

            <Text style={styles.mobileNavText}>
              Avantages
            </Text>
          </Pressable>

          <Pressable
            style={styles.mobileNavItem}
            onPress={() => scrollToSection(1800)}
          >
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={COLORS.primary}
            />

            <Text style={styles.mobileNavText}>
              Comment ça marche
            </Text>
          </Pressable>

          <View style={styles.mobileDivider} />

          <Pressable
            onPress={handleLogin}
            style={styles.mobileLogin}
          >
            <Text style={styles.mobileLoginText}>
              Connexion
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRegister}
            style={styles.mobileRegister}
          >
            <Text style={styles.mobileRegisterText}>
              Créer un compte
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  /* =======================================================
     HERO
======================================================= */

  const renderHero = () => (
    <LinearGradient
      colors={[
        '#EAF7ED',
        '#F5FBF6',
        '#FFFFFF',
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.hero,

        isMobile && styles.heroMobile,
        isTablet && styles.heroTablet,
      ]}
    >
      <View
        style={[
          styles.heroInner,

          isMobile && styles.heroInnerMobile,
          isTablet && styles.heroInnerTablet,
        ]}
      >
        {/* HERO TEXT */}

        <View
          style={[
            styles.heroContent,

            isMobile && styles.heroContentMobile,
            isDesktop && styles.heroContentDesktop,
          ]}
        >
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />

            <Text
              style={styles.heroBadgeText}
              numberOfLines={1}
            >
              BIEN-ÊTRE • SANTÉ • SÉRÉNITÉ
            </Text>
          </View>

          <Text
            style={[
              styles.heroTitle,

              isMobile && styles.heroTitleMobile,
              isTablet && styles.heroTitleTablet,
            ]}
          >
            Prenez soin de vous,
            {'\n'}
            <Text style={styles.heroTitleGreen}>
              simplement.
            </Text>
          </Text>

          <Text
            style={[
              styles.heroDescription,
              isMobile && styles.heroDescriptionMobile,
            ]}
          >
            Mada Bien-être vous accompagne pour trouver
            facilement des services de bien-être et de massage
            adaptés à vos besoins, où que vous soyez.
          </Text>

          {/* BUTTONS */}

          <View
            style={[
              styles.heroButtons,

              isMobile && styles.heroButtonsMobile,
            ]}
          >
            <Pressable
              onPress={handleRegister}
              style={[
                styles.primaryHeroButton,

                isMobile &&
                  styles.primaryHeroButtonMobile,
              ]}
            >
              <Text style={styles.primaryHeroButtonText}>
                Commencer maintenant
              </Text>

              <Ionicons
                name="arrow-forward"
                size={19}
                color={COLORS.white}
              />
            </Pressable>

            <Pressable
              onPress={() => scrollToSection(650)}
              style={[
                styles.secondaryHeroButton,

                isMobile &&
                  styles.secondaryHeroButtonMobile,
              ]}
            >
              <Ionicons
                name="play-circle-outline"
                size={21}
                color={COLORS.primary}
              />

              <Text
                style={styles.secondaryHeroButtonText}
              >
                Découvrir nos services
              </Text>
            </Pressable>
          </View>

          {/* TRUST */}

          <View style={styles.heroTrust}>
            <View style={styles.trustItem}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.primary}
              />

              <Text style={styles.trustText}>
                Simple
              </Text>
            </View>

            <View style={styles.trustItem}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.primary}
              />

              <Text style={styles.trustText}>
                Pratique
              </Text>
            </View>

            <View style={styles.trustItem}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.primary}
              />

              <Text style={styles.trustText}>
                Accessible
              </Text>
            </View>
          </View>
        </View>

        {/* HERO VISUAL */}

        <View
          style={[
            styles.heroVisual,

            isMobile && styles.heroVisualMobile,
            isTablet && styles.heroVisualTablet,
          ]}
        >
          <View
            style={[
              styles.heroCircleLarge,

              isMobile &&
                styles.heroCircleLargeMobile,
            ]}
          />

          {/* MAIN CARD */}

          <View
            style={[
              styles.heroMainCard,

              isMobile &&
                styles.heroMainCardMobile,
            ]}
          >
            <LinearGradient
              colors={[
                COLORS.primaryDark,
                COLORS.primary,
              ]}
              style={[
                styles.heroCardGradient,

                isMobile &&
                  styles.heroCardGradientMobile,
              ]}
            >
              <View style={styles.heroCardTop}>
                <View style={styles.heroCardText}>
                  <Text style={styles.heroCardSmall}>
                    MADA BIEN-ÊTRE
                  </Text>

                  <Text
                    style={[
                      styles.heroCardTitle,

                      isMobile &&
                        styles.heroCardTitleMobile,
                    ]}
                  >
                    Votre moment
                  </Text>

                  <Text
                    style={[
                      styles.heroCardTitle,

                      isMobile &&
                        styles.heroCardTitleMobile,
                    ]}
                  >
                    de sérénité
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroCardIcon,

                    isMobile &&
                      styles.heroCardIconMobile,
                  ]}
                >
                  <Ionicons
                    name="leaf"
                    size={30}
                    color={COLORS.primaryDark}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.heroCardStats,

                  isMobile &&
                    styles.heroCardStatsMobile,
                ]}
              >
                <View style={styles.heroStat}>
                  <Ionicons
                    name="heart"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text style={styles.heroStatText}>
                    Bien-être
                  </Text>
                </View>

                <View style={styles.heroStat}>
                  <Ionicons
                    name="home"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text style={styles.heroStatText}>
                    À domicile
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* FLOATING CARD 1 */}

          <View
            style={[
              styles.floatingCard,
              styles.floatingCardOne,

              isMobile &&
                styles.floatingCardOneMobile,
            ]}
          >
            <View style={styles.floatingIcon}>
              <Ionicons
                name="sparkles"
                size={19}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.floatingCardText}>
              <Text style={styles.floatingTitle}>
                Bien-être
              </Text>

              <Text style={styles.floatingText}>
                Au quotidien
              </Text>
            </View>
          </View>

          {/* FLOATING CARD 2 */}

          <View
            style={[
              styles.floatingCard,
              styles.floatingCardTwo,

              isMobile &&
                styles.floatingCardTwoMobile,
            ]}
          >
            <View style={styles.floatingIconBlue}>
              <Ionicons
                name="location"
                size={19}
                color={COLORS.blue}
              />
            </View>

            <View style={styles.floatingCardText}>
              <Text style={styles.floatingTitle}>
                Proche de vous
              </Text>

              <Text style={styles.floatingText}>
                Services disponibles
              </Text>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );

  /* =======================================================
     QUICK ACTIONS
======================================================= */

  const renderQuickActions = () => (
    <View style={styles.quickSection}>
      <View
        style={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
      >
        <View
          style={[
            styles.quickGrid,

            isMobile && styles.quickGridMobile,
          ]}
        >
          {/* CARD 1 */}

          <Pressable
            onPress={handleRegister}
            style={[
              styles.quickCard,

              isMobile && styles.quickCardMobile,
            ]}
          >
            <View style={styles.quickIcon}>
              <Ionicons
                name="search-outline"
                size={25}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.quickContent}>
              <Text style={styles.quickTitle}>
                Trouver un service
              </Text>

              <Text style={styles.quickText}>
                Recherchez rapidement une prestation.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.muted}
            />
          </Pressable>

          {/* CARD 2 */}

          <Pressable
            onPress={handleRegister}
            style={[
              styles.quickCard,

              isMobile && styles.quickCardMobile,
            ]}
          >
            <View
              style={[
                styles.quickIcon,
                styles.quickIconOrange,
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={25}
                color={COLORS.orange}
              />
            </View>

            <View style={styles.quickContent}>
              <Text style={styles.quickTitle}>
                Réserver une séance
              </Text>

              <Text style={styles.quickText}>
                Organisez facilement votre moment de détente.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.muted}
            />
          </Pressable>

          {/* CARD 3 */}

          <Pressable
            onPress={() =>
              openExternalUrl(ANDROID_APK_URL)
            }
            style={[
              styles.quickCard,

              isMobile && styles.quickCardMobile,
            ]}
          >
            <View
              style={[
                styles.quickIcon,
                styles.quickIconBlue,
              ]}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={25}
                color={COLORS.blue}
              />
            </View>

            <View style={styles.quickContent}>
              <Text style={styles.quickTitle}>
                Télécharger l'application
              </Text>

              <Text style={styles.quickText}>
                Installez Mada Bien-être sur Android.
              </Text>
            </View>

            <Ionicons
              name="download-outline"
              size={20}
              color={COLORS.muted}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );

  /* =======================================================
     SECTION TITLE
========================================================= */

  const SectionTitle = ({
    eyebrow,
    title,
    description,
  }) => (
    <View
      style={[
        styles.sectionHeading,

        isMobile &&
          styles.sectionHeadingMobile,
      ]}
    >
      <Text style={styles.sectionEyebrow}>
        {eyebrow}
      </Text>

      <Text
        style={[
          styles.sectionTitle,

          isMobile &&
            styles.sectionTitleMobile,
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.sectionDescription,

          isMobile &&
            styles.sectionDescriptionMobile,
        ]}
      >
        {description}
      </Text>
    </View>
  );

  /* =======================================================
     SERVICES
======================================================= */

  const renderServices = () => (
    <View style={styles.section}>
      <View
        style={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
      >
        <SectionTitle
          eyebrow="NOS SERVICES"
          title="Tout pour votre bien-être"
          description="Mada Bien-être rassemble des solutions simples pour vous aider à rechercher et organiser vos prestations de bien-être."
        />

        <View
          style={[
            styles.serviceGrid,

            isMobile && styles.serviceGridMobile,
            isTablet && styles.serviceGridTablet,
          ]}
        >
          {services.map((service, index) => (
            <View
              key={index}
              style={[
                styles.serviceCard,

                isMobile &&
                  styles.serviceCardMobile,

                isTablet &&
                  styles.serviceCardTablet,
              ]}
            >
              <View style={styles.serviceIcon}>
                <Ionicons
                  name={service.icon}
                  size={28}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.serviceTitle}>
                {service.title}
              </Text>

              <Text style={styles.serviceText}>
                {service.text}
              </Text>

              <Pressable
                onPress={handleRegister}
                style={styles.serviceLink}
              >
                <Text style={styles.serviceLinkText}>
                  En savoir plus
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={COLORS.primary}
                />
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  /* =======================================================
     ADVANTAGES
======================================================= */

  const renderAdvantages = () => (
    <View style={styles.advantagesSection}>
      <View
        style={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
      >
        <SectionTitle
          eyebrow="POURQUOI NOUS CHOISIR"
          title="Une expérience pensée pour vous"
          description="Nous voulons rendre l'accès aux services de bien-être plus simple, plus pratique et plus proche de vos besoins."
        />

        <View
          style={[
            styles.advantagesGrid,

            isMobile &&
              styles.advantagesGridMobile,

            isTablet &&
              styles.advantagesGridTablet,
          ]}
        >
          {advantages.map((item, index) => (
            <View
              key={index}
              style={[
                styles.advantageCard,

                isMobile &&
                  styles.advantageCardMobile,

                isTablet &&
                  styles.advantageCardTablet,
              ]}
            >
              <View style={styles.advantageIcon}>
                <Ionicons
                  name={item.icon}
                  size={24}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.advantageContent}>
                <Text
                  style={styles.advantageTitle}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                <Text style={styles.advantageText}>
                  {item.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  /* =======================================================
     PROCESS
======================================================= */

  const renderProcess = () => (
    <View style={styles.section}>
      <View
        style={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
      >
        <SectionTitle
          eyebrow="COMMENT ÇA MARCHE"
          title="Votre bien-être en quelques étapes"
          description="Une démarche simple pour passer de la recherche à votre moment de détente."
        />

        <View
          style={[
            styles.stepsGrid,

            isMobile &&
              styles.stepsGridMobile,

            isTablet &&
              styles.stepsGridTablet,
          ]}
        >
          {steps.map((step, index) => (
            <View
              key={index}
              style={[
                styles.stepCard,

                isMobile &&
                  styles.stepCardMobile,

                isTablet &&
                  styles.stepCardTablet,
              ]}
            >
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>
                  {step.number}
                </Text>
              </View>

              <Text style={styles.stepTitle}>
                {step.title}
              </Text>

              <Text style={styles.stepText}>
                {step.text}
              </Text>

              {index < steps.length - 1 &&
                !isMobile && (
                  <View style={styles.stepArrow}>
                    <Ionicons
                      name="arrow-forward"
                      size={19}
                      color={COLORS.primary}
                    />
                  </View>
                )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  /* =======================================================
     DOWNLOAD
======================================================= */

  const renderDownload = () => (
    <View style={styles.downloadSection}>
      <View
        style={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
      >
        <LinearGradient
          colors={[
            COLORS.primaryDark,
            COLORS.primary,
            '#3C9147',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.downloadCard,

            isMobile &&
              styles.downloadCardMobile,
          ]}
        >
          <View
            style={[
              styles.downloadContent,

              isMobile &&
                styles.downloadContentMobile,
            ]}
          >
            <View style={styles.downloadBadge}>
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.downloadBadgeText}>
                APPLICATION MOBILE
              </Text>
            </View>

            <Text
              style={[
                styles.downloadTitle,

                isMobile &&
                  styles.downloadTitleMobile,
              ]}
            >
              Emportez votre bien-être partout
            </Text>

            <Text style={styles.downloadText}>
              Téléchargez l'application Mada Bien-être
              pour accéder facilement aux services depuis
              votre téléphone Android.
            </Text>

            <Pressable
              onPress={() =>
                openExternalUrl(ANDROID_APK_URL)
              }
              style={styles.downloadButton}
            >
              <Ionicons
                name="logo-android"
                size={23}
                color={COLORS.primaryDark}
              />

              <View>
                <Text style={styles.downloadButtonSmall}>
                  TÉLÉCHARGER SUR
                </Text>

                <Text style={styles.downloadButtonText}>
                  Android APK
                </Text>
              </View>

              <Ionicons
                name="download-outline"
                size={22}
                color={COLORS.primaryDark}
              />
            </Pressable>
          </View>

          {/* PHONE */}

          <View
            style={[
              styles.downloadVisual,

              isMobile &&
                styles.downloadVisualMobile,
            ]}
          >
            <View style={styles.phone}>
              <View style={styles.phoneNotch} />

              <View style={styles.phoneScreen}>
                <Ionicons
                  name="leaf"
                  size={45}
                  color={COLORS.primary}
                />

                <Text style={styles.phoneTitle}>
                  Mada Bien-être
                </Text>

                <View style={styles.phoneLine} />

                <View style={styles.phoneSmallCard}>
                  <Ionicons
                    name="heart"
                    size={19}
                    color={COLORS.primary}
                  />

                  <Text style={styles.phoneSmallText}>
                    Votre bien-être
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );

  /* =======================================================
     CTA
======================================================= */

  const renderCTA = () => (
    <View style={styles.ctaSection}>
      <View
        style={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
      >
        <View style={styles.ctaCard}>
          <View style={styles.ctaIcon}>
            <Ionicons
              name="heart-outline"
              size={31}
              color={COLORS.primary}
            />
          </View>

          <Text
            style={[
              styles.ctaTitle,

              isMobile &&
                styles.ctaTitleMobile,
            ]}
          >
            Prêt à prendre soin de vous ?
          </Text>

          <Text style={styles.ctaText}>
            Rejoignez Mada Bien-être et découvrez une
            nouvelle façon de prendre soin de votre corps
            et de votre esprit.
          </Text>

          <Pressable
            onPress={handleRegister}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaButtonText}>
              Créer mon compte
            </Text>

            <Ionicons
              name="arrow-forward"
              size={19}
              color={COLORS.white}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );

  /* =======================================================
     FOOTER
======================================================= */

  const renderFooter = () => (
    <View style={styles.footer}>
      <View
        style={[
          styles.container,
          styles.footerInner,

          isMobile &&
            styles.footerInnerMobile,
        ]}
      >
        {/* BRAND */}

        <View style={styles.footerBrand}>
          <View style={styles.footerLogoRow}>
            <View style={styles.footerLogoBox}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.footerLogo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.footerBrandName}>
              Mada Bien-être
            </Text>
          </View>

          <Text style={styles.footerDescription}>
            Votre plateforme dédiée au bien-être,
            aux massages et aux services de détente
            à Madagascar.
          </Text>
        </View>

        {/* NAVIGATION */}

        <View style={styles.footerColumn}>
          <Text style={styles.footerColumnTitle}>
            Navigation
          </Text>

          <Pressable
            onPress={() => scrollToSection(0)}
          >
            <Text style={styles.footerLink}>
              Accueil
            </Text>
          </Pressable>

          <Pressable
            onPress={() => scrollToSection(650)}
          >
            <Text style={styles.footerLink}>
              Services
            </Text>
          </Pressable>

          <Pressable
            onPress={() => scrollToSection(1200)}
          >
            <Text style={styles.footerLink}>
              Avantages
            </Text>
          </Pressable>
        </View>

        {/* APPLICATION */}

        <View style={styles.footerColumn}>
          <Text style={styles.footerColumnTitle}>
            Application
          </Text>

          <Pressable
            onPress={() =>
              openExternalUrl(ANDROID_APK_URL)
            }
          >
            <Text style={styles.footerLink}>
              Télécharger Android
            </Text>
          </Pressable>

          <Pressable onPress={handleLogin}>
            <Text style={styles.footerLink}>
              Connexion
            </Text>
          </Pressable>

          <Pressable onPress={handleRegister}>
            <Text style={styles.footerLink}>
              Inscription
            </Text>
          </Pressable>
        </View>

        {/* CONTACT */}

        <View style={styles.footerColumn}>
          <Text style={styles.footerColumnTitle}>
            Contact
          </Text>

          <View style={styles.footerContact}>
            <Ionicons
              name="mail-outline"
              size={17}
              color="#A7B8AA"
            />

            <Text style={styles.footerContactText}>
              Contactez-nous
            </Text>
          </View>

          <View style={styles.footerContact}>
            <Ionicons
              name="location-outline"
              size={17}
              color="#A7B8AA"
            />

            <Text style={styles.footerContactText}>
              Madagascar
            </Text>
          </View>
        </View>
      </View>

      {/* COPYRIGHT */}

      <View style={styles.footerBottom}>
        <View style={styles.container}>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} Mada Bien-être.
            Tous droits réservés.
          </Text>
        </View>
      </View>
    </View>
  );

  /* =======================================================
     RENDER
======================================================= */

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.white}
        translucent={false}
      />

      <View style={styles.screen}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderHeader()}

          {renderHero()}

          {renderQuickActions()}

          {renderServices()}

          {renderAdvantages()}

          {renderProcess()}

          {renderDownload()}

          {renderCTA()}

          {renderFooter()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  /* =======================================================
     BASE
  ======================================================= */

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 28,
  },

  containerMobile: {
    paddingHorizontal: 18,
  },

  /* =======================================================
     HEADER
  ======================================================= */

  header: {
    width: '100%',
    backgroundColor: COLORS.white,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,

    zIndex: 100,
    elevation: 5,
  },

  headerInner: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',

    minHeight: 76,

    paddingHorizontal: 28,
    paddingVertical: 8,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerInnerMobile: {
    minHeight: 68,

    paddingHorizontal: 16,
    paddingVertical: 7,
  },

  headerInnerTablet: {
    paddingHorizontal: 22,
  },

  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    flexShrink: 1,
  },

  logoContainerMobile: {
    flex: 1,
    marginRight: 12,
  },

  logoBox: {
    width: 50,
    height: 50,

    borderRadius: 14,

    backgroundColor: COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  logoBoxMobile: {
    width: 46,
    height: 46,

    borderRadius: 13,

    marginRight: 9,
  },

  logo: {
    width: 38,
    height: 38,
  },

  logoMobile: {
    width: 35,
    height: 35,
  },

  logoTexts: {
    flexShrink: 1,
  },

  logoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },

  logoTitleMobile: {
    fontSize: 16,
  },

  logoSubtitle: {
    marginTop: 2,

    fontSize: 10,

    color: COLORS.textSoft,
  },

  logoSubtitleMobile: {
    fontSize: 9,
  },

  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 25,

    marginLeft: 20,
    marginRight: 15,
  },

  navItem: {
    paddingVertical: 10,
  },

  navText: {
    fontSize: 14,
    fontWeight: '600',

    color: COLORS.textSoft,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 10,
  },

  loginButton: {
    paddingHorizontal: 17,
    paddingVertical: 11,

    borderRadius: 10,
  },

  loginButtonText: {
    color: COLORS.primaryDark,

    fontSize: 14,
    fontWeight: '700',
  },

  registerButton: {
    backgroundColor: COLORS.primary,

    paddingHorizontal: 18,
    paddingVertical: 12,

    borderRadius: 10,
  },

  registerButtonText: {
    color: COLORS.white,

    fontSize: 14,
    fontWeight: '700',
  },

  /* =======================================================
     MOBILE MENU
  ======================================================= */

  menuButton: {
    width: 45,
    height: 45,

    borderRadius: 12,

    backgroundColor: COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileMenu: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 4,

    backgroundColor: COLORS.white,

    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  mobileNavItem: {
    minHeight: 48,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 12,
  },

  mobileNavText: {
    fontSize: 15,
    fontWeight: '700',

    color: COLORS.text,
  },

  mobileDivider: {
    height: 1,

    backgroundColor: COLORS.border,

    marginVertical: 9,
  },

  mobileLogin: {
    minHeight: 45,

    borderWidth: 1,
    borderColor: COLORS.primary,

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 8,
  },

  mobileLoginText: {
    fontSize: 14,
    fontWeight: '700',

    color: COLORS.primary,
  },

  mobileRegister: {
    minHeight: 45,

    borderRadius: 10,

    backgroundColor: COLORS.primary,

    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileRegisterText: {
    fontSize: 14,
    fontWeight: '700',

    color: COLORS.white,
  },

  /* =======================================================
     HERO
  ======================================================= */

  hero: {
    minHeight: 590,

    justifyContent: 'center',
  },

  heroMobile: {
    minHeight: 760,
  },

  heroTablet: {
    minHeight: 650,
  },

  heroInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',

    paddingHorizontal: 28,
    paddingVertical: 65,

    flexDirection: 'row',
    alignItems: 'center',
  },

  heroInnerMobile: {
    paddingHorizontal: 18,
    paddingVertical: 45,

    flexDirection: 'column',
    alignItems: 'stretch',
  },

  heroInnerTablet: {
    paddingHorizontal: 25,
    paddingVertical: 55,
  },

  heroContent: {
    flex: 1,

    zIndex: 2,
  },

  heroContentMobile: {
    width: '100%',
  },

  heroContentDesktop: {
    paddingRight: 35,
  },

  heroBadge: {
    alignSelf: 'flex-start',

    maxWidth: '100%',

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.white,

    paddingHorizontal: 12,
    paddingVertical: 8,

    borderRadius: 100,

    marginBottom: 20,

    elevation: 2,

    ...Platform.select({
      web: {
        boxShadow: '0px 5px 20px rgba(0,0,0,0.06)',
      },
    }),
  },

  heroBadgeDot: {
    width: 8,
    height: 8,

    borderRadius: 4,

    backgroundColor: COLORS.primary,

    marginRight: 8,
  },

  heroBadgeText: {
    fontSize: 9,
    fontWeight: '800',

    color: COLORS.primaryDark,

    letterSpacing: 0.7,
  },

  heroTitle: {
    fontSize: 53,
    lineHeight: 61,

    fontWeight: '900',

    color: COLORS.text,

    letterSpacing: -1.5,
  },

  heroTitleMobile: {
    fontSize: 38,
    lineHeight: 46,

    letterSpacing: -0.8,
  },

  heroTitleTablet: {
    fontSize: 45,
    lineHeight: 54,
  },

  heroTitleGreen: {
    color: COLORS.primary,
  },

  heroDescription: {
    maxWidth: 590,

    marginTop: 20,

    fontSize: 17,
    lineHeight: 28,

    color: COLORS.textSoft,
  },

  heroDescriptionMobile: {
    fontSize: 15,
    lineHeight: 24,

    marginTop: 18,
  },

  /* =======================================================
     HERO BUTTONS
  ======================================================= */

  heroButtons: {
    flexDirection: 'row',
    alignItems: 'center',

    flexWrap: 'wrap',

    gap: 12,

    marginTop: 28,
  },

  heroButtonsMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',

    width: '100%',

    gap: 10,
  },

  primaryHeroButton: {
    minHeight: 52,

    paddingHorizontal: 20,

    borderRadius: 12,

    backgroundColor: COLORS.primary,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 10,
  },

  primaryHeroButtonMobile: {
    width: '100%',
  },

  primaryHeroButtonText: {
    color: COLORS.white,

    fontSize: 14,
    fontWeight: '800',
  },

  secondaryHeroButton: {
    minHeight: 52,

    paddingHorizontal: 18,

    borderRadius: 12,

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: COLORS.border,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 8,
  },

  secondaryHeroButtonMobile: {
    width: '100%',
  },

  secondaryHeroButtonText: {
    color: COLORS.primaryDark,

    fontSize: 14,
    fontWeight: '700',
  },

  /* =======================================================
     TRUST
  ======================================================= */

  heroTrust: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: 18,

    marginTop: 23,
  },

  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 6,
  },

  trustText: {
    color: COLORS.textSoft,

    fontSize: 12,
    fontWeight: '600',
  },

  /* =======================================================
     HERO VISUAL
  ======================================================= */

  heroVisual: {
    flex: 0.9,

    minHeight: 470,

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  heroVisualMobile: {
    width: '100%',

    minHeight: 360,

    marginTop: 25,
  },

  heroVisualTablet: {
    minHeight: 400,
  },

  heroCircleLarge: {
    position: 'absolute',

    width: 350,
    height: 350,

    borderRadius: 175,

    backgroundColor: '#DDF0E1',

    opacity: 0.9,
  },

  heroCircleLargeMobile: {
    width: 290,
    height: 290,

    borderRadius: 145,
  },

  heroMainCard: {
    width: 310,

    borderRadius: 26,

    overflow: 'hidden',

    transform: [
      {
        rotate: '-4deg',
      },
    ],

    elevation: 10,

    ...Platform.select({
      web: {
        boxShadow:
          '0px 25px 50px rgba(22,75,42,0.18)',
      },
    }),
  },

  heroMainCardMobile: {
    width: 265,

    borderRadius: 22,
  },

  heroCardGradient: {
    minHeight: 300,

    padding: 26,

    justifyContent: 'space-between',
  },

  heroCardGradientMobile: {
    minHeight: 245,

    padding: 20,
  },

  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',

    alignItems: 'flex-start',
  },

  heroCardText: {
    flex: 1,

    paddingRight: 8,
  },

  heroCardSmall: {
    fontSize: 9,
    fontWeight: '800',

    color: '#BFE0C6',

    letterSpacing: 1,

    marginBottom: 11,
  },

  heroCardTitle: {
    color: COLORS.white,

    fontSize: 28,
    lineHeight: 32,

    fontWeight: '900',
  },

  heroCardTitleMobile: {
    fontSize: 22,
    lineHeight: 27,
  },

  heroCardIcon: {
    width: 58,
    height: 58,

    borderRadius: 18,

    backgroundColor: COLORS.white,

    alignItems: 'center',
    justifyContent: 'center',
  },

  heroCardIconMobile: {
    width: 47,
    height: 47,

    borderRadius: 14,
  },

  heroCardStats: {
    flexDirection: 'row',

    gap: 10,
  },

  heroCardStatsMobile: {
    gap: 6,
  },

  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: 'rgba(255,255,255,0.13)',

    paddingHorizontal: 10,
    paddingVertical: 8,

    borderRadius: 12,

    gap: 6,
  },

  heroStatText: {
    color: COLORS.white,

    fontSize: 10,
    fontWeight: '700',
  },

  /* =======================================================
     FLOATING CARDS
  ======================================================= */

  floatingCard: {
    position: 'absolute',

    maxWidth: 190,

    backgroundColor: COLORS.white,

    borderRadius: 15,

    padding: 11,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,

    elevation: 7,

    ...Platform.select({
      web: {
        boxShadow:
          '0px 12px 30px rgba(0,0,0,0.10)',
      },
    }),
  },

  floatingCardOne: {
    left: 0,
    top: 85,
  },

  floatingCardOneMobile: {
    left: 0,
    top: 38,

    maxWidth: 150,

    padding: 9,
  },

  floatingCardTwo: {
    right: 0,
    bottom: 65,
  },

  floatingCardTwoMobile: {
    right: 0,
    bottom: 35,

    maxWidth: 170,

    padding: 9,
  },

  floatingCardText: {
    flexShrink: 1,
  },

  floatingIcon: {
    width: 38,
    height: 38,

    borderRadius: 11,

    backgroundColor: COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',
  },

  floatingIconBlue: {
    width: 38,
    height: 38,

    borderRadius: 11,

    backgroundColor: '#EAF1FF',

    alignItems: 'center',
    justifyContent: 'center',
  },

  floatingTitle: {
    color: COLORS.text,

    fontSize: 11,
    fontWeight: '800',
  },

  floatingText: {
    color: COLORS.muted,

    fontSize: 9,

    marginTop: 2,
  },

  /* =======================================================
     QUICK ACTIONS
  ======================================================= */

  quickSection: {
    backgroundColor: COLORS.white,

    paddingVertical: 22,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: 12,
  },

  quickGridMobile: {
    flexDirection: 'column',

    gap: 10,
  },

  quickCard: {
    flex: 1,

    minWidth: 280,
    minHeight: 84,

    paddingHorizontal: 15,

    borderWidth: 1,
    borderColor: COLORS.border,

    borderRadius: 15,

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.white,

    gap: 12,
  },

  quickCardMobile: {
    width: '100%',

    minWidth: 0,

    minHeight: 76,

    paddingHorizontal: 13,
  },

  quickIcon: {
    width: 48,
    height: 48,

    borderRadius: 13,

    backgroundColor: COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',
  },

  quickIconOrange: {
    backgroundColor: '#FFF6E5',
  },

  quickIconBlue: {
    backgroundColor: '#EAF1FF',
  },

  quickContent: {
    flex: 1,

    minWidth: 0,
  },

  quickTitle: {
    fontSize: 14,
    fontWeight: '800',

    color: COLORS.text,
  },

  quickText: {
    fontSize: 11,
    lineHeight: 16,

    color: COLORS.textSoft,

    marginTop: 3,
  },

  /* =======================================================
     SECTIONS
  ======================================================= */

  section: {
    paddingVertical: 75,

    backgroundColor: COLORS.white,
  },

  advantagesSection: {
    paddingVertical: 75,

    backgroundColor: COLORS.background,
  },

  sectionHeading: {
    alignItems: 'center',

    maxWidth: 720,

    alignSelf: 'center',

    marginBottom: 42,
  },

  sectionHeadingMobile: {
    marginBottom: 30,
  },

  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '900',

    color: COLORS.primary,

    letterSpacing: 1.5,

    marginBottom: 9,
  },

  sectionTitle: {
    textAlign: 'center',

    fontSize: 35,
    lineHeight: 43,

    fontWeight: '900',

    color: COLORS.text,

    letterSpacing: -0.5,
  },

  sectionTitleMobile: {
    fontSize: 27,
    lineHeight: 34,

    paddingHorizontal: 5,
  },

  sectionDescription: {
    textAlign: 'center',

    marginTop: 12,

    color: COLORS.textSoft,

    fontSize: 15,
    lineHeight: 24,
  },

  sectionDescriptionMobile: {
    fontSize: 14,
    lineHeight: 22,

    paddingHorizontal: 2,
  },

  /* =======================================================
     SERVICES
  ======================================================= */

  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: 17,
  },

  serviceGridMobile: {
    flexDirection: 'column',

    gap: 12,
  },

  serviceGridTablet: {
    gap: 14,
  },

  serviceCard: {
    flex: 1,

    minWidth: 250,

    padding: 25,

    borderWidth: 1,
    borderColor: COLORS.border,

    borderRadius: 18,

    backgroundColor: COLORS.white,

    elevation: 2,

    ...Platform.select({
      web: {
        boxShadow:
          '0px 8px 25px rgba(0,0,0,0.04)',
      },
    }),
  },

  serviceCardMobile: {
    width: '100%',

    minWidth: 0,

    padding: 20,
  },

  serviceCardTablet: {
    flexBasis: '47%',

    minWidth: 0,
  },

  serviceIcon: {
    width: 56,
    height: 56,

    borderRadius: 15,

    backgroundColor: COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 17,
  },

  serviceTitle: {
    color: COLORS.text,

    fontSize: 18,
    fontWeight: '800',

    marginBottom: 8,
  },

  serviceText: {
    color: COLORS.textSoft,

    fontSize: 13,
    lineHeight: 21,
  },

  serviceLink: {
    marginTop: 17,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 7,
  },

  serviceLinkText: {
    color: COLORS.primary,

    fontSize: 12,
    fontWeight: '800',
  },

  /* =======================================================
     ADVANTAGES
  ======================================================= */

  advantagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: 15,
  },

  advantagesGridMobile: {
    flexDirection: 'column',

    gap: 12,
  },

  advantagesGridTablet: {
    gap: 14,
  },

  advantageCard: {
    width: '32.1%',

    minHeight: 135,

    backgroundColor: COLORS.white,

    borderRadius: 16,

    padding: 18,

    borderWidth: 1,
    borderColor: COLORS.border,

    flexDirection: 'row',

    gap: 12,
  },

  /*
    IMPORTANT :
    MOBILE = 100% WIDTH
    C'est cette partie qui corrige le problème
    visible dans ta première capture.
  */

  advantageCardMobile: {
    width: '100%',

    minWidth: 0,

    minHeight: 105,

    padding: 16,

    flexDirection: 'row',

    alignItems: 'flex-start',
  },

  advantageCardTablet: {
    width: '48.2%',

    minHeight: 125,
  },

  advantageIcon: {
    width: 46,
    height: 46,

    flexShrink: 0,

    borderRadius: 12,

    backgroundColor: COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',
  },

  advantageContent: {
    flex: 1,

    minWidth: 0,
  },

  advantageTitle: {
    color: COLORS.text,

    fontSize: 14,
    lineHeight: 19,

    fontWeight: '800',

    marginBottom: 5,
  },

  advantageText: {
    color: COLORS.textSoft,

    fontSize: 11,
    lineHeight: 17,
  },

  /* =======================================================
     STEPS
  ======================================================= */

  stepsGrid: {
    flexDirection: 'row',

    gap: 15,
  },

  stepsGridMobile: {
    flexDirection: 'column',

    gap: 12,
  },

  stepsGridTablet: {
    flexWrap: 'wrap',

    gap: 14,
  },

  stepCard: {
    flex: 1,

    padding: 23,

    borderRadius: 17,

    borderWidth: 1,
    borderColor: COLORS.border,

    backgroundColor: COLORS.background,

    position: 'relative',
  },

  stepCardMobile: {
    width: '100%',

    minHeight: 145,
  },

  stepCardTablet: {
    flexBasis: '47%',

    minWidth: 0,
  },

  stepNumber: {
    width: 49,
    height: 49,

    borderRadius: 14,

    backgroundColor: COLORS.primary,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 17,
  },

  stepNumberText: {
    color: COLORS.white,

    fontSize: 14,
    fontWeight: '900',
  },

  stepTitle: {
    color: COLORS.text,

    fontSize: 18,
    fontWeight: '900',

    marginBottom: 7,
  },

  stepText: {
    color: COLORS.textSoft,

    fontSize: 12,
    lineHeight: 19,
  },

  stepArrow: {
    position: 'absolute',

    right: -14,
    top: 37,

    width: 28,
    height: 28,

    borderRadius: 14,

    backgroundColor: COLORS.white,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,
    borderColor: COLORS.border,

    zIndex: 3,
  },

  /* =======================================================
     DOWNLOAD
  ======================================================= */

  downloadSection: {
    paddingVertical: 28,

    backgroundColor: COLORS.background,
  },

  downloadCard: {
    minHeight: 350,

    borderRadius: 28,

    paddingHorizontal: 45,
    paddingVertical: 40,

    flexDirection: 'row',
    alignItems: 'center',

    overflow: 'hidden',
  },

  downloadCardMobile: {
    minHeight: 0,

    flexDirection: 'column',
    alignItems: 'stretch',

    paddingHorizontal: 22,
    paddingVertical: 30,
  },

  downloadContent: {
    flex: 1,

    paddingRight: 25,
  },

  downloadContentMobile: {
    paddingRight: 0,
  },

  downloadBadge: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    gap: 7,

    paddingHorizontal: 11,
    paddingVertical: 7,

    borderRadius: 100,

    backgroundColor: 'rgba(255,255,255,0.12)',

    marginBottom: 16,
  },

  downloadBadgeText: {
    color: '#DCEFE0',

    fontSize: 9,
    fontWeight: '900',

    letterSpacing: 1,
  },

  downloadTitle: {
    color: COLORS.white,

    fontSize: 32,
    lineHeight: 40,

    fontWeight: '900',

    maxWidth: 570,
  },

  downloadTitleMobile: {
    fontSize: 27,
    lineHeight: 34,
  },

  downloadText: {
    color: '#D6E9DA',

    fontSize: 14,
    lineHeight: 23,

    marginTop: 12,

    maxWidth: 570,
  },

  downloadButton: {
    alignSelf: 'flex-start',

    marginTop: 23,

    minHeight: 58,

    paddingHorizontal: 15,

    borderRadius: 13,

    backgroundColor: COLORS.white,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 10,
  },

  downloadButtonSmall: {
    color: COLORS.textSoft,

    fontSize: 8,
    fontWeight: '800',

    letterSpacing: 0.7,
  },

  downloadButtonText: {
    color: COLORS.primaryDark,

    fontSize: 15,
    fontWeight: '900',

    marginTop: 2,
  },

  downloadVisual: {
    width: 330,

    alignItems: 'center',
    justifyContent: 'center',
  },

  downloadVisualMobile: {
    width: '100%',

    marginTop: 28,
  },

  phone: {
    width: 170,
    height: 300,

    backgroundColor: '#102F1B',

    borderRadius: 28,

    padding: 7,

    transform: [
      {
        rotate: '5deg',
      },
    ],

    elevation: 9,

    ...Platform.select({
      web: {
        boxShadow:
          '0px 20px 40px rgba(0,0,0,0.25)',
      },
    }),
  },

  phoneNotch: {
    position: 'absolute',

    top: 8,
    left: 55,

    width: 60,
    height: 15,

    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,

    backgroundColor: '#07170C',

    zIndex: 2,
  },

  phoneScreen: {
    flex: 1,

    borderRadius: 22,

    backgroundColor: '#F5FAF6',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 15,
  },

  phoneTitle: {
    color: COLORS.primaryDark,

    fontSize: 13,
    fontWeight: '900',

    marginTop: 11,

    textAlign: 'center',
  },

  phoneLine: {
    width: 70,
    height: 4,

    borderRadius: 2,

    backgroundColor: COLORS.primary,

    marginTop: 9,
    marginBottom: 18,
  },

  phoneSmallCard: {
    width: '100%',

    padding: 11,

    borderRadius: 12,

    backgroundColor: COLORS.white,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,
  },

  phoneSmallText: {
    fontSize: 10,

    fontWeight: '700',

    color: COLORS.text,
  },

  /* =======================================================
     CTA
  ======================================================= */

  ctaSection: {
    paddingVertical: 70,

    backgroundColor: COLORS.white,
  },

  ctaCard: {
    alignItems: 'center',

    maxWidth: 800,

    alignSelf: 'center',

    paddingHorizontal: 20,
  },

  ctaIcon: {
    width: 68,
    height: 68,

    borderRadius: 22,

    backgroundColor: COLORS.primaryLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 18,
  },

  ctaTitle: {
    textAlign: 'center',

    color: COLORS.text,

    fontSize: 34,
    lineHeight: 42,

    fontWeight: '900',
  },

  ctaTitleMobile: {
    fontSize: 27,
    lineHeight: 34,
  },

  ctaText: {
    textAlign: 'center',

    color: COLORS.textSoft,

    fontSize: 15,
    lineHeight: 24,

    maxWidth: 620,

    marginTop: 12,
  },

  ctaButton: {
    minHeight: 53,

    paddingHorizontal: 23,

    borderRadius: 12,

    backgroundColor: COLORS.primary,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 9,

    marginTop: 24,
  },

  ctaButtonText: {
    color: COLORS.white,

    fontSize: 14,
    fontWeight: '800',
  },

  /* =======================================================
     FOOTER
  ======================================================= */

  footer: {
    backgroundColor: '#102218',
  },

  footerInner: {
    paddingTop: 50,
    paddingBottom: 45,

    flexDirection: 'row',

    gap: 40,
  },

  footerInnerMobile: {
    flexDirection: 'column',

    gap: 28,
  },

  footerBrand: {
    flex: 1.5,
  },

  footerLogoRow: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  footerLogoBox: {
    width: 43,
    height: 43,

    borderRadius: 12,

    backgroundColor: COLORS.white,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  footerLogo: {
    width: 32,
    height: 32,
  },

  footerBrandName: {
    color: COLORS.white,

    fontSize: 17,
    fontWeight: '900',
  },

  footerDescription: {
    maxWidth: 330,

    color: '#A7B8AA',

    fontSize: 12,
    lineHeight: 20,

    marginTop: 14,
  },

  footerColumn: {
    flex: 1,
  },

  footerColumnTitle: {
    color: COLORS.white,

    fontSize: 13,
    fontWeight: '900',

    marginBottom: 14,
  },

  footerLink: {
    color: '#A7B8AA',

    fontSize: 12,

    marginBottom: 11,
  },

  footerContact: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,

    marginBottom: 12,
  },

  footerContactText: {
    color: '#A7B8AA',

    fontSize: 12,
  },

  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',

    paddingVertical: 18,
  },

  copyright: {
    color: '#77877B',

    fontSize: 11,

    textAlign: 'center',
  },
});