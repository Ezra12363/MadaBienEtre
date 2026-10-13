// src/screens/client/ChatScreen.js
// Écran de discussion du CLIENT (thérapeute <-> client).
// Toute l'interface et la logique sont dans components/chat/ChatRoomView
// (partagé avec l'écran thérapeute) : web + Android + iOS.
import ChatRoomView from '../../components/chat/ChatRoomView';

const ChatScreen = ({ navigation, route }) => (
  <ChatRoomView navigation={navigation} route={route} />
);

export default ChatScreen;
