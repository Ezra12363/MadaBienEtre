// src/components/common/AppNavigation.js
//
// Fusionne le header et la barre d'onglets EN UNE SEULE barre de
// navigation en haut, mais UNIQUEMENT sur le web large (>= 900px).
//
//   - Web large   : TopNavBar (logo + "Mada Bien-être" + menu complet
//                   horizontal + profil) tout en haut. AppHeader et
//                   BottomTabBar ne s'affichent plus (ils publient
//                   leurs infos utiles via le "pont" ci-dessous puis
//                   se désactivent).
//   - Web étroit  : comportement identique au mobile (AppHeader en
//                   haut par écran + BottomTabBar en bas).
//   - Android/iOS : STRICTEMENT INCHANGÉ — AppHeader par écran en
//                   haut, BottomTabBar en bas.
//
// Architecture : le Tab.Navigator est la seule source qui connaît
// `state` / `descriptors` / `navigation` (via la prop `tabBar`).
// `TabBarConnector` (branché sur `tabBar`) publie ces informations
// dans un contexte ("pont"), que `TopNavBar` — rendu comme un frère
// normal au-dessus du Tab.Navigator, en flux CSS classique, sans
// aucun positionnement absolu — vient lire pour dessiner le menu.
// Ce choix évite tout risque de chevauchement (contrairement à un
// positionnement absolu + marge).
//
// Utilisation dans un navigator :
//
//   import {
//     NavBridgeProvider,
//     TabBarConnector,
//     TopNavBar,
//   } from '../components/common/AppNavigation';
//
//   <NavBridgeProvider>
//     <SafeAreaView style={styles.container}>
//       <StatusBar .../>
//       <TopNavBar brandLabel="Mada Bien-être" />
//       <Tab.Navigator
//         tabBar={(props) => (
//           <TabBarConnector
//             {...props}
//             visible={tabBarVisible}
//             getIcon={getTabIcon}
//             getLabel={getTabLabel}
//           />
//         )}
//       >
//         ...
//       </Tab.Navigator>
//     </SafeAreaView>
//   </NavBridgeProvider>

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { colors, typography, spacing } from '../../theme';

import BottomTabBar from './BottomTabBar';

// ============================================================
// SEUIL RESPONSIVE
// ============================================================

export const TOPNAV_BREAKPOINT = 900;

// IMPORTANT — pourquoi ce hook ne se contente pas de useWindowDimensions() :
// Sur certains environnements web (preview en iframe, certains navigateurs
// mobiles en mode "desktop site", etc.), useWindowDimensions() ne se met
// PAS toujours à jour de façon fiable lors d'un redimensionnement de la
// fenêtre : `width` reste bloqué sur la valeur mesurée au premier montage,
// donc `isMerged` ne change jamais après coup (le header garde son état
// initial même si on agrandit/rétrécit la fenêtre ensuite).
//
// On ajoute donc, UNIQUEMENT sur web, un `addEventListener('resize', ...)`
// manuel sur `window` qui force un recalcul via un state local. Sur
// natif (Android/iOS), ce code ne s'exécute jamais (`window` n'existe
// pas / Platform.OS !== 'web'), donc AUCUN changement de comportement
// pour le mobile.
const getWebWidth = () =>
  typeof window !== 'undefined' && typeof window.innerWidth === 'number'
    ? window.innerWidth
    : 0;

export const useTopNavLayout = () => {
  const { width: rnWidth } = useWindowDimensions();
  const [webWidth, setWebWidth] = useState(() => getWebWidth());

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    // Recalage immédiat au montage (au cas où la valeur initiale de
    // useState aurait été prise avant que `window` soit pleinement prêt).
    setWebWidth(getWebWidth());

    const handleResize = () => {
      setWebWidth(getWebWidth());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Sur web, `webWidth` (mis à jour en direct par le listener resize
  // ci-dessus) est la source de vérité : il reflète toujours la largeur
  // ACTUELLE de la fenêtre, qu'elle grandisse ou rétrécisse. `rnWidth`
  // ne sert que de repli tant que `webWidth` n'a pas encore été mesuré
  // (tout premier rendu, avant l'exécution du useEffect).
  const effectiveWidth =
    Platform.OS === 'web' ? webWidth || rnWidth : rnWidth;

  const isMerged = Platform.OS === 'web' && effectiveWidth >= TOPNAV_BREAKPOINT;
  return { isMerged };
};

// ============================================================
// CONTEXTE "PONT"
// ============================================================

const NavBridgeContext = createContext(null);

export const NavBridgeProvider = ({ children }) => {
  const [tabData, setTabDataState] = useState(null);
  const [pageContext, setPageContextState] = useState(null);

  // IMPORTANT — anti "Maximum update depth exceeded" :
  // Ces deux setters comparent l'ancienne et la nouvelle valeur avant
  // de déclencher un re-render. Sans ça, un objet littéral tout neuf
  // ({...}) est créé à chaque appel (même avec un contenu identique),
  // ce qui change la référence de `tabData`/`pageContext`, donc de
  // `value` (useMemo ci-dessous), donc de `bridge` reçu par les
  // consommateurs (TabBarConnector, AppHeader...) — qui rappellent
  // alors le setter dans leur useEffect, et ainsi de suite à l'infini.
  const setTabData = useCallback((data) => {
    setTabDataState((prev) => {
      if (
        prev &&
        prev.state === data.state &&
        prev.descriptors === data.descriptors &&
        prev.navigation === data.navigation &&
        prev.getIcon === data.getIcon &&
        prev.getLabel === data.getLabel
      ) {
        return prev;
      }
      return data;
    });
  }, []);

  const setPageContext = useCallback((data) => {
    setPageContextState((prev) => {
      if (
        prev &&
        prev.title === data.title &&
        prev.subtitle === data.subtitle &&
        prev.showBack === data.showBack &&
        prev.onBack === data.onBack
      ) {
        return prev;
      }
      return data;
    });
  }, []);

  const value = useMemo(
    () => ({ tabData, setTabData, pageContext, setPageContext }),
    [tabData, pageContext, setTabData, setPageContext]
  );

  return (
    <NavBridgeContext.Provider value={value}>
      {children}
    </NavBridgeContext.Provider>
  );
};

// Hook "sûr" : renvoie null hors d'un NavBridgeProvider (écrans
// Auth, écrans racine type Chat/Payment) au lieu de lever une erreur.
export const useNavBridge = () => useContext(NavBridgeContext);

// ============================================================
// TAB BAR CONNECTOR — passé en tant que `tabBar` du Tab.Navigator
// ============================================================

export const TabBarConnector = ({
  state,
  descriptors,
  navigation,
  visible = true,
  getIcon,
  getLabel,
}) => {
  const { isMerged } = useTopNavLayout();
  const bridge = useNavBridge();

  // On extrait le setter (référence stable, garantie par useCallback
  // dans NavBridgeProvider) plutôt que de dépendre de `bridge` lui-même,
  // qui change de référence à chaque mise à jour du "pont".
  const setTabData = bridge?.setTabData;

  useEffect(() => {
    if (isMerged && setTabData) {
      setTabData({ state, descriptors, navigation, getIcon, getLabel });
    }
  }, [isMerged, setTabData, state, descriptors, navigation, getIcon, getLabel]);

  if (isMerged) {
    // Le menu est affiché dans TopNavBar : pas de barre du bas.
    return null;
  }

  return (
    <BottomTabBar
      state={state}
      descriptors={descriptors}
      navigation={navigation}
      visible={visible}
      getIcon={getIcon}
      getLabel={getLabel}
    />
  );
};

// ============================================================
// LABEL DE RÔLE (affiché sous le nom, dans le profil)
// ============================================================

const roleLabel = (role) => {
  switch (role) {
    case 'THERAPIST':
      return 'Thérapeute';
    case 'ADMIN':
      return 'Administrateur';
    default:
      return 'Client';
  }
};

// ============================================================
// NOTIFICATIONS / MESSAGES — chaque rôle a son propre écran.
// Le bouton ne s'affiche que si une cible existe pour le rôle
// courant (ex : ADMIN n'a pas de messagerie dédiée pour l'instant).
//
// IMPORTANT — pourquoi un objet { tab, screen } et pas juste un
// nom de route :
// `TherapistNotifications` (et `Notifications` côté client) ne
// sont PAS des écrans du Tab.Navigator ni des écrans racine : ce
// sont des écrans imbriqués DANS le Stack propre à un onglet
// (ex: DashboardStack, monté sous l'onglet "Tableau de bord").
// Un simple `navigation.navigate('TherapistNotifications')`
// appelé depuis la navigation du Tab.Navigator ne descend PAS
// dans cette pile imbriquée (il ne fait que remonter vers les
// navigateurs parents) : le bouton semblait "ne rien faire".
// La syntaxe `navigate(nomOnglet, { screen: nomEcran })` est la
// façon correcte de cibler un écran niché dans un onglet précis,
// quel que soit l'onglet actuellement affiché.
const NOTIFICATIONS_TARGET_BY_ROLE = {
  THERAPIST: { tab: 'Tableau de bord', screen: 'TherapistNotifications' },
  // Côté client, "Notifications" est dupliqué dans la pile de
  // CHAQUE onglet : on peut donc viser l'onglet actuellement actif.
  CLIENT: { screen: 'Notifications' },
  ADMIN: { tab: 'Tableau de bord', screen: 'AdminNotifications' },
};

// `TherapistChat` (écran racine, hors des onglets) et `Messages`
// (onglet direct du Tab.Navigator) sont eux directement joignables
// par un simple nom de route : pas besoin de la syntaxe imbriquée.
const MESSAGES_ROUTE_BY_ROLE = {
  THERAPIST: 'TherapistChat',
  CLIENT: 'Messages',
};

// ============================================================
// TOP NAV BAR — logo + menu complet + profil (web large uniquement)
// ============================================================

export const TopNavBar = ({
  brandLabel = 'Mada Bien-être',
  // Permet à un écran/navigator de fournir son propre compteur de
  // messages non lus s'il en a un (aucun contexte "messages" commun
  // n'existe pour l'instant). Les notifications, elles, viennent
  // toujours de NotificationContext (source unique de vérité).
  messagesUnreadCount = 0,
}) => {
  const { isMerged } = useTopNavLayout();
  const bridge = useNavBridge();
  const { colors: themeColors, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { unreadCount: notificationsUnreadCount } = useNotifications();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!isMerged || !bridge || !bridge.tabData) {
    return null;
  }

  const { state, descriptors, navigation, getIcon, getLabel } = bridge.tabData;
  const pageContext = bridge.pageContext;

  const hasProfileRoute = state.routes.some((r) => r.name === 'Profil');

  // Route de destination propre au rôle connecté : un thérapeute
  // ouvre SES notifications/messages, un client les SIENS, etc.
  const notificationsTarget = NOTIFICATIONS_TARGET_BY_ROLE[user?.role];
  const messagesRoute = MESSAGES_ROUTE_BY_ROLE[user?.role];

  const openNotifications = () => {
    if (!notificationsTarget) {
      return;
    }

    // `tab` fixe (thérapeute) ou onglet actuellement actif (client,
    // où l'écran est dupliqué dans chaque onglet).
    const targetTab = notificationsTarget.tab || state.routes[state.index]?.name;

    if (!targetTab) {
      return;
    }

    navigation.navigate(targetTab, { screen: notificationsTarget.screen });
  };

  const openMessages = () => {
    if (messagesRoute) {
      navigation.navigate(messagesRoute);
    }
  };

  // `profile_image` = champ réel utilisé par ProfileScreen.js pour la
  // vraie photo de l'utilisateur. Les autres clés sont conservées en
  // repli, au cas où une autre partie de l'app les utiliserait encore.
  const avatarSource =
    user?.profile_image ||
    user?.avatarUrl ||
    user?.avatar ||
    user?.photo ||
    user?.photoUrl ||
    null;

  const initial = (user?.fullname || user?.name || 'U').charAt(0).toUpperCase();

  return (
    <View style={styles.wrap}>
      {/* -------------------------------------------------- */}
      {/* BARRE PRINCIPALE */}
      {/* -------------------------------------------------- */}

      <View style={styles.mainBar}>
        {/* Marque */}
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text numberOfLines={1} style={styles.brandText}>
            {brandLabel}
          </Text>
        </View>

        {/* Menu complet */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.menuScroll}
          contentContainerStyle={styles.menuScrollContent}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;

            const label = getLabel
              ? getLabel(route.name)
              : options.tabBarLabel ?? route.name;

            const iconName = getIcon
              ? getIcon(route.name, focused)
              : focused
              ? 'ellipse'
              : 'ellipse-outline';

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                style={({ hovered }) => [
                  styles.menuItem,
                  focused && styles.menuItemActive,
                  !focused && hovered && styles.menuItemHovered,
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={17}
                  color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.82)'}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.menuItemLabel,
                    focused && styles.menuItemLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Notifications + Messages — accès direct, avant le profil */}
        <View style={styles.headerActions}>
          {messagesRoute && (
            <Pressable
              onPress={openMessages}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les messages"
              style={({ hovered }) => [
                styles.headerActionButton,
                hovered && styles.headerActionButtonHovered,
              ]}
            >
              <Ionicons
                name={
                  messagesUnreadCount > 0
                    ? 'chatbubble-ellipses'
                    : 'chatbubble-ellipses-outline'
                }
                size={20}
                color="#FFFFFF"
              />
              {messagesUnreadCount > 0 && (
                <View style={styles.headerActionBadge}>
                  <Text style={styles.headerActionBadgeText}>
                    {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {notificationsTarget && (
            <Pressable
              onPress={openNotifications}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les notifications"
              style={({ hovered }) => [
                styles.headerActionButton,
                hovered && styles.headerActionButtonHovered,
              ]}
            >
              <Ionicons
                name={
                  notificationsUnreadCount > 0
                    ? 'notifications'
                    : 'notifications-outline'
                }
                size={20}
                color="#FFFFFF"
              />
              {notificationsUnreadCount > 0 && (
                <View style={styles.headerActionBadge}>
                  <Text style={styles.headerActionBadgeText}>
                    {notificationsUnreadCount > 99
                      ? '99+'
                      : notificationsUnreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {/* Profil */}
        <View style={styles.profileWrap}>
          <Pressable
            onPress={() => setProfileOpen((prev) => !prev)}
            style={({ hovered }) => [
              styles.profileButton,
              hovered && styles.profileButtonHovered,
            ]}
          >
            <View style={styles.avatar}>
              {avatarSource ? (
                <Image
                  source={{ uri: avatarSource }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>

            <View style={styles.profileTexts}>
              <Text numberOfLines={1} style={styles.profileName}>
                {user?.fullname || user?.name || 'Utilisateur'}
              </Text>
              <Text numberOfLines={1} style={styles.profileRole}>
                {roleLabel(user?.role)}
              </Text>
            </View>

            <Ionicons
              name={profileOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="rgba(255,255,255,0.85)"
            />
          </Pressable>

          {profileOpen && (
            <>
              {/* Zone invisible pour fermer au clic extérieur */}
              <Pressable
                style={styles.dropdownBackdrop}
                onPress={() => setProfileOpen(false)}
              />

              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor:
                      themeColors.border ||
                      (isDark ? 'rgba(255,255,255,0.1)' : '#E7E9EF'),
                  },
                ]}
              >
                {hasProfileRoute && (
                  <Pressable
                    style={styles.dropdownItem}
                    onPress={() => {
                      setProfileOpen(false);
                      navigation.navigate('Profil');
                    }}
                  >
                    <Ionicons
                      name="person-outline"
                      size={16}
                      color={themeColors.text}
                    />
                    <Text style={[styles.dropdownLabel, { color: themeColors.text }]}>
                      Mon profil
                    </Text>
                  </Pressable>
                )}

                <View
                  style={[
                    styles.dropdownDivider,
                    {
                      backgroundColor:
                        themeColors.border ||
                        (isDark ? 'rgba(255,255,255,0.1)' : '#E7E9EF'),
                    },
                  ]}
                />

                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileOpen(false);
                    logout?.();
                  }}
                >
                  <Ionicons name="log-out-outline" size={16} color="#E74C3C" />
                  <Text style={[styles.dropdownLabel, { color: '#E74C3C' }]}>
                    Déconnexion
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>

      {/* -------------------------------------------------- */}
      {/* SOUS-BARRE CONTEXTUELLE (retour + titre d'écran) */}
      {/* -------------------------------------------------- */}

      {pageContext?.showBack && (
        <View
          style={[
            styles.subBar,
            {
              backgroundColor: themeColors.surface,
              borderBottomColor:
                themeColors.border ||
                (isDark ? 'rgba(255,255,255,0.08)' : '#E7E9EF'),
            },
          ]}
        >
          <Pressable
            onPress={pageContext.onBack}
            style={styles.subBarBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={18} color={themeColors.text} />
          </Pressable>

          {pageContext.title ? (
            <Text
              numberOfLines={1}
              style={[styles.subBarTitle, { color: themeColors.text }]}
            >
              {pageContext.title}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

// TopNavBar ne s'affiche QUE sur le web large (voir useTopNavLayout :
// isMerged = Platform.OS === 'web' && width >= TOPNAV_BREAKPOINT).
// Couleurs de marque (thème vert) — mêmes que AppHeader.js (dupliquées
// ici pour éviter un import circulaire AppHeader <-> AppNavigation).
const PRIMARY = '#2E7D32';
const PRIMARY_DARK = '#164B2A';

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    zIndex: 50,
    ...Platform.select({
      web: { position: 'sticky', top: 0 },
      default: {},
    }),
  },

  // ---------- barre principale ----------
  mainBar: {
    width: '100%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderBottomWidth: 1,
    borderBottomColor: PRIMARY_DARK,
    paddingHorizontal: spacing.lg || 24,
    gap: spacing.lg || 24,
    ...Platform.select({
      web: { boxShadow: '0px 3px 14px rgba(0,0,0,0.12)' },
      default: { elevation: 8 },
    }),
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },

  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  logo: {
    width: 28,
    height: 28,
  },

  brandText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    maxWidth: 180,
  },

  // ---------- menu ----------
  menuScroll: {
    flex: 1,
  },

  menuScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },

  menuItemHovered: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  menuItemActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  menuItemLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13.5,
    fontFamily: typography.fontFamily.medium,
  },

  menuItemLabelActive: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.bold,
  },

  // ---------- notifications / messages ----------
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },

  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },

  headerActionButtonHovered: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  headerActionBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerActionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: typography.fontFamily.bold,
  },

  // ---------- profil ----------
  profileWrap: {
    flexShrink: 0,
    position: 'relative',
  },

  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },

  profileButtonHovered: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
  },

  profileTexts: {
    maxWidth: 130,
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  profileRole: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
  },

  dropdownBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
  },

  dropdown: {
    position: 'absolute',
    top: 52,
    right: 0,
    minWidth: 190,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    zIndex: 70,
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(0,0,0,0.16)' },
      default: { elevation: 10 },
    }),
  },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  dropdownLabel: {
    fontSize: 13.5,
    fontFamily: typography.fontFamily.medium,
  },

  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
    marginHorizontal: 10,
  },

  // ---------- sous-barre contextuelle ----------
  subBar: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg || 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  subBarBack: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },

  subBarTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
  },
});