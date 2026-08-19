// src/screens/therapist/ChatScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import ChatBubble from '../../components/chat/ChatBubble';
import { API_URL, WS_URL } from '../../config';

const ChatScreen = ({ navigation, route }) => {
  const { bookingId, clientId, clientName } = route.params || {};
  const { colors: themeColors, isDark } = useTheme();
  const { token, user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [ws, setWs] = useState(null);
  const [client, setClient] = useState(null);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadChatHistory();
    setupWebSocket();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const loadChatHistory = async () => {
    setIsLoading(true);
    try {
      // Charger l'historique du chat
      const response = await axios.get(`${API_URL}/chat/history/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data);
      
      // Charger les infos du client
      if (clientId) {
        const clientResponse = await axios.get(`${API_URL}/users/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClient(clientResponse.data);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      // Données mockées
      setMessages([
        {
          id: 1,
          senderId: clientId || 2,
          senderName: clientName || 'Marie L.',
          content: 'Bonjour, je suis disponible pour le massage à 14h30.',
          type: 'text',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          status: 'read',
        },
        {
          id: 2,
          senderId: user?.id || 1,
          senderName: user?.fullname || 'Vous',
          content: 'Parfait, je vous attends !',
          type: 'text',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          status: 'read',
        },
      ]);
      setClient({
        id: clientId,
        fullname: clientName || 'Marie L.',
        profile_image: null,
        is_online: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupWebSocket = () => {
    const wsUrl = `${WS_URL}/chat/${bookingId}?token=${token}`;
    const websocket = new WebSocket(wsUrl);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('Chat WebSocket connected');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        setMessages(prev => [...prev, {
          id: Date.now(),
          senderId: data.user_id,
          senderName: data.username,
          content: data.message,
          type: 'text',
          createdAt: new Date().toISOString(),
          status: 'delivered',
        }]);
        scrollToBottom();
      } else if (data.type === 'typing') {
        setIsTyping(data.is_typing);
      }
    };

    websocket.onerror = (error) => {
      console.error('Chat WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('Chat WebSocket disconnected');
    };
  };

  const sendMessage = () => {
    if (!inputText.trim() || !ws) return;

    const message = {
      type: 'message',
      user_id: user?.id,
      username: user?.fullname || 'Vous',
      message: inputText.trim(),
    };

    ws.send(JSON.stringify(message));
    setMessages(prev => [...prev, {
      id: Date.now(),
      senderId: user?.id,
      senderName: user?.fullname || 'Vous',
      content: inputText.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'sent',
    }]);
    setInputText('');
    scrollToBottom();
  };

  const handleTyping = (isTyping) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: 'typing',
        user_id: user?.id,
        is_typing: isTyping,
      }));
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement du chat...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header personnalisé */}
      <View style={[styles.chatHeader, { 
        backgroundColor: themeColors.surface,
        borderBottomColor: themeColors.border,
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.headerInfo}
          onPress={() => navigation.navigate('ClientProfile', { clientId: client?.id })}
        >
          <View style={styles.headerAvatar}>
            {client?.profile_image ? (
              <Image source={{ uri: client.profile_image }} style={styles.headerAvatarImage} />
            ) : (
              <Text style={styles.headerAvatarText}>
                {client?.fullname?.charAt(0) || 'C'}
              </Text>
            )}
            <View style={[styles.onlineDot, { backgroundColor: client?.is_online ? '#4CAF50' : '#999' }]} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerName, { color: themeColors.text }]}>
              {client?.fullname || 'Client'}
            </Text>
            <Text style={[styles.headerStatus, { color: client?.is_online ? '#4CAF50' : '#999' }]}>
              {client?.is_online ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="call-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <Animated.View style={[styles.messagesContainer, { opacity: fadeAnim }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              isOwn={item.senderId === user?.id}
              timestamp={item.createdAt}
              avatar={item.senderId === user?.id ? user?.profile_image : client?.profile_image}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onLayout={scrollToBottom}
        />
        
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={[styles.typingText, { color: themeColors.textSecondary }]}>
              Le client est en train d'écrire...
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Input */}
      <View style={[styles.inputContainer, { 
        backgroundColor: themeColors.surface,
        borderTopColor: themeColors.border,
      }]}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="add-circle-outline" size={28} color={themeColors.textSecondary} />
          </TouchableOpacity>
          
          <TextInput
            style={[styles.input, { 
              color: themeColors.text,
              backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5',
            }]}
            placeholder="Écrire un message..."
            placeholderTextColor={themeColors.textSecondary}
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              handleTyping(text.length > 0);
            }}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? [colors.primary, colors.primaryLight] : ['#ccc', '#ccc']}
              style={styles.sendGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  headerAvatar: {
    position: 'relative',
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarText: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerText: {
    marginLeft: spacing.sm,
  },
  headerName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  headerStatus: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  headerAction: {
    padding: spacing.xs,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingIndicator: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  typingText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
  },
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  attachButton: {
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    paddingRight: spacing.md,
  },
  sendButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});

export default ChatScreen;