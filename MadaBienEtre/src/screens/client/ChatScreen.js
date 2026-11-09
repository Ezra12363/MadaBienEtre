// src/screens/client/ChatScreen.js
// Écran de discussion du CLIENT (thérapeute <-> client).
// Toute l'interface et la logique sont dans components/chat/ChatRoomView
// (partagé avec l'écran thérapeute) : web + Android + iOS.
import MessengerChatScreen from '../shared/MessengerChatScreen';

const ChatScreen = ({ navigation, route }) => (
  <MessengerChatScreen navigation={navigation} route={route} />
);

export default ChatScreen;
