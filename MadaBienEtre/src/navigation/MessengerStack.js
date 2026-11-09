// src/navigation/MessengerStack.js
// Écrans de la messagerie, partagés par les trois rôles.
//  - messengerScreens(Stack)  : à insérer dans un Stack existant (Client)
//  - default MessengerStack   : pile autonome (onglet Thérapeute / Admin)
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CallHistoryScreen from '../screens/shared/CallHistoryScreen';
import ConversationsScreen from '../screens/shared/ConversationsScreen';
import GroupInfoScreen from '../screens/shared/GroupInfoScreen';
import MessengerAdminScreen from '../screens/shared/MessengerAdminScreen';
import MessengerChatScreen from '../screens/shared/MessengerChatScreen';
import MessengerListScreen from '../screens/shared/MessengerListScreen';
import MessengerNewScreen from '../screens/shared/MessengerNewScreen';
import MessengerSearchScreen from '../screens/shared/MessengerSearchScreen';

const Stack = createNativeStackNavigator();

/** Écrans secondaires (sans la liste) — « key » obligatoire car retournés dans un tableau. */
export const messengerScreens = (S, { withLegacy = true } = {}) => [
  <S.Screen key="MessengerChat" name="MessengerChat" component={MessengerChatScreen} />,
  <S.Screen key="MessengerNew" name="MessengerNew" component={MessengerNewScreen} />,
  <S.Screen key="GroupInfo" name="GroupInfo" component={GroupInfoScreen} />,
  <S.Screen key="MessengerSearch" name="MessengerSearch" component={MessengerSearchScreen} />,
  <S.Screen key="CallHistory" name="CallHistory" component={CallHistoryScreen} />,
  <S.Screen key="MessengerAdmin" name="MessengerAdmin" component={MessengerAdminScreen} />,
  ...(withLegacy
    ? [<S.Screen key="BookingConversations" name="BookingConversations" component={ConversationsScreen} />]
    : []),
];

const MessengerStack = ({ withLegacy = true }) => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="MessengerList" component={MessengerListScreen} />
    {messengerScreens(Stack, { withLegacy })}
  </Stack.Navigator>
);

export const AdminMessengerStack = () => <MessengerStack withLegacy={false} />;

export default MessengerStack;
