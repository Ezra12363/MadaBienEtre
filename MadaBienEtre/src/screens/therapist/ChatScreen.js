// src/screens/therapist/ChatScreen.js
// Écran de discussion du THÉRAPEUTE (thérapeute <-> client).
// Interface et logique : components/chat/ChatRoomView (partagé avec le client).
//
// Cette enveloppe ne garde que la partie propre à l'écran racine
// "TherapistChat" : sur le web LARGE (>= 900px), la TopNavBar partagée doit
// rester affichée et connaître les onglets du TherapistNavigator.
// Sur mobile / web étroit, la conversation est en plein écran (comme la
// maquette), sans barre d'onglets.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import ChatRoomView from '../../components/chat/ChatRoomView';
import {
  NavBridgeProvider,
  TopNavBar,
  useNavBridge,
  useTopNavLayout,
} from '../../components/common/AppNavigation';

/* =========================================================
   ONGLETS (web large uniquement)
   ---------------------------------------------------------
   ChatScreen est un écran racine ("TherapistChat") : il ne connaît pas
   les onglets du TherapistNavigator. On les découvre dans l'état de
   navigation ; sinon on utilise FALLBACK_TABS.
   -> Adaptez FALLBACK_TABS aux noms réels de vos onglets.
========================================================= */

const FALLBACK_TABS = ['Tableau de bord', 'Profil'];

const discoverTabs = (navigation) => {
  let nav = navigation;
  let guard = 0;

  while (nav && guard < 6) {
    guard += 1;
    const navState = nav.getState?.();

    if (navState?.type === 'tab' && Array.isArray(navState.routes)) {
      return { container: null, routes: navState.routes.map((r) => r.name) };
    }

    if (Array.isArray(navState?.routes)) {
      for (const r of navState.routes) {
        const sub = r.state;
        if (sub && sub.type === 'tab' && Array.isArray(sub.routes) && sub.routes.length > 0) {
          return { container: r.name, routes: sub.routes.map((x) => x.name) };
        }
      }
    }

    nav = nav.getParent?.();
  }

  return null;
};

const getTabIcon = (name, focused) => {
  const n = String(name || '').toLowerCase();
  let base = 'ellipse';

  if (n.includes('tableau') || n.includes('dashboard') || n.includes('accueil')) base = 'grid';
  else if (n.includes('calend') || n.includes('agenda') || n.includes('planning')) base = 'calendar';
  else if (n.includes('réserv') || n.includes('reserv') || n.includes('booking')) base = 'calendar';
  else if (n.includes('message') || n.includes('chat')) base = 'chatbubbles';
  else if (n.includes('revenu') || n.includes('gain') || n.includes('wallet') || n.includes('paie')) base = 'wallet';
  else if (n.includes('offre')) base = 'pricetag';
  else if (n.includes('service') || n.includes('massage')) base = 'leaf';
  else if (n.includes('notif')) base = 'notifications';
  else if (n.includes('stat')) base = 'stats-chart';
  else if (n.includes('profil') || n.includes('profile') || n.includes('compte')) base = 'person';

  return focused ? base : `${base}-outline`;
};

const getTabLabel = (name) => name;

/* =========================================================
   ÉCRAN
   - ouvert DANS un onglet : le pont de navigation existe déjà
     (TopNavBar fournie par le Tab.Navigator) -> "embedded" ;
   - ouvert comme écran racine : on fournit notre propre pont.
========================================================= */

const ChatScreen = (props) => {
  const existingBridge = useNavBridge();

  if (existingBridge) {
    return <ChatScreenInner {...props} embedded />;
  }

  return (
    <NavBridgeProvider>
      <ChatScreenInner {...props} embedded={false} />
    </NavBridgeProvider>
  );
};

const ChatScreenInner = ({ navigation, route, embedded }) => {
  const { isMerged } = useTopNavLayout();
  const bridge = useNavBridge();
  const [meta, setMeta] = useState({ title: 'Conversation', subtitle: '' });

  const handleBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
  }, [navigation]);

  const tabsInfo = useMemo(
    () => discoverTabs(navigation) || { container: null, routes: FALLBACK_TABS },
    [navigation]
  );

  const fakeNavigation = useMemo(
    () => ({
      emit: () => ({ defaultPrevented: false }),
      navigate: (name, params) => {
        const isTab = tabsInfo.routes.includes(name);

        if (isTab && tabsInfo.container) {
          if (params?.screen) {
            navigation.navigate(tabsInfo.container, { screen: name, params });
          } else {
            navigation.navigate(tabsInfo.container, { screen: name });
          }
          return;
        }

        navigation.navigate(name, params);
      },
    }),
    [navigation, tabsInfo]
  );

  const tabData = useMemo(() => {
    const routes = tabsInfo.routes.map((name) => ({ key: name, name }));
    const descriptors = {};
    routes.forEach((r) => {
      descriptors[r.key] = { options: {} };
    });

    return {
      state: { index: -1, routes },
      descriptors,
      navigation: fakeNavigation,
      getIcon: getTabIcon,
      getLabel: getTabLabel,
    };
  }, [tabsInfo, fakeNavigation]);

  const setTabData = bridge?.setTabData;
  const setPageContext = bridge?.setPageContext;

  useEffect(() => {
    if (!embedded && isMerged && setTabData) setTabData(tabData);
  }, [embedded, isMerged, setTabData, tabData]);

  useEffect(() => {
    if (isMerged && setPageContext) {
      setPageContext({
        title: meta.title,
        subtitle: meta.subtitle,
        showBack: true,
        onBack: handleBack,
      });
    }
  }, [isMerged, setPageContext, meta.title, meta.subtitle, handleBack]);

  return (
    <View style={{ flex: 1 }}>
      {isMerged && !embedded ? <TopNavBar brandLabel="Mada Bien-être" /> : null}

      <ChatRoomView
        navigation={navigation}
        route={route}
        compactHeader={isMerged}
        onMeta={setMeta}
      />
    </View>
  );
};

export default ChatScreen;
