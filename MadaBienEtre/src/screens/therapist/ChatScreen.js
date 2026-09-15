// src/screens/therapist/ChatScreen.js

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

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
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';

import ChatBubble from '../../components/chat/ChatBubble';
import { API_URL, WS_URL } from '../../config';

const PRIMARY_COLOR = colors.primary || '#168A55';
const PRIMARY_LIGHT = colors.primaryLight || '#39B878';

const getInitial = (name) => {
  if (!name) return 'C';

  return String(name)
    .trim()
    .charAt(0)
    .toUpperCase();
};

const getClientName = (client) => {
  if (!client) return 'Client';

  return (
    client.fullname ||
    client.full_name ||
    client.name ||
    client.username ||
    `${client.first_name || ''} ${client.last_name || ''}`.trim() ||
    'Client'
  );
};

const getClientPhoto = (client) => {
  if (!client) return null;

  const photo =
    client.profile_image ||
    client.profileImage ||
    client.profile_photo ||
    client.profilePhoto ||
    client.avatar ||
    client.avatar_url ||
    client.avatarUrl ||
    client.photo ||
    client.photo_url ||
    client.photoUrl ||
    client.image ||
    client.image_url ||
    client.imageUrl;

  if (!photo || typeof photo !== 'string') {
    return null;
  }

  return photo;
};

const getClientOnlineStatus = (client) => {
  if (!client) return false;

  return Boolean(
    client.is_online ??
      client.isOnline ??
      client.online ??
      false
  );
};

const normalizeMessage = (message, index = 0) => {
  return {
    ...message,
    id:
      message?.id ||
      message?.message_id ||
      message?.messageId ||
      `message-${index}-${Date.now()}`,
    senderId:
      message?.senderId ??
      message?.sender_id ??
      message?.user_id ??
      message?.sender?.id,
    senderName:
      message?.senderName ||
      message?.sender_name ||
      message?.username ||
      message?.sender?.fullname ||
      '',
    content:
      message?.content ||
      message?.message ||
      message?.text ||
      '',
    type: message?.type || 'text',
    createdAt:
      message?.createdAt ||
      message?.created_at ||
      message?.timestamp ||
      new Date().toISOString(),
    status: message?.status || 'delivered',
  };
};

const ChatScreen = ({ navigation, route }) => {
  const {
    bookingId,
    clientId,
    clientName,
    clientPhoto,
  } = route.params || {};

  const { colors: themeColors, isDark } = useTheme();
  const { token, user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const websocketRef = useRef(null);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const clientFullName = getClientName(client) || clientName || 'Client';
  const photoUri = getClientPhoto(client) || clientPhoto || null;
  const isClientOnline = getClientOnlineStatus(client);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({
        animated: true,
      });
    }, 150);
  }, []);

  const loadChatHistory = useCallback(async () => {
    if (!bookingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.get(
        `${API_URL}/chat/history/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const responseData = Array.isArray(response.data)
        ? response.data
        : response.data?.messages || [];

      setMessages(
        responseData.map((item, index) =>
          normalizeMessage(item, index)
        )
      );

      if (clientId) {
        try {
          const clientResponse = await axios.get(
            `${API_URL}/users/${clientId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          setClient(clientResponse.data);
        } catch (clientError) {
          console.warn(
            'Impossible de charger les informations du client:',
            clientError?.message
          );

          setClient({
            id: clientId,
            fullname: clientName || 'Client',
            profile_image: clientPhoto || null,
            is_online: false,
          });
        }
      } else {
        setClient({
          id: clientId,
          fullname: clientName || 'Client',
          profile_image: clientPhoto || null,
          is_online: false,
        });
      }
    } catch (error) {
      console.error(
        'Erreur lors du chargement de l’historique:',
        error?.response?.data || error?.message
      );

      /*
       * En cas d'erreur réseau, on conserve une conversation vide
       * au lieu d'afficher de fausses données dans l'application.
       */
      setMessages([]);

      setClient({
        id: clientId,
        fullname: clientName || 'Client',
        profile_image: clientPhoto || null,
        is_online: false,
      });
    } finally {
      setIsLoading(false);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();

      scrollToBottom();
    }
  }, [
    bookingId,
    clientId,
    clientName,
    clientPhoto,
    token,
    fadeAnim,
    scrollToBottom,
  ]);

  const setupWebSocket = useCallback(() => {
    if (!bookingId || !token || !WS_URL) {
      return;
    }

    try {
      const wsUrl =
        `${WS_URL}/chat/${bookingId}?token=${encodeURIComponent(token)}`;

      const websocket = new WebSocket(wsUrl);

      websocketRef.current = websocket;

      websocket.onopen = () => {
        console.log('Chat WebSocket connecté');
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'message') {
            const receivedMessage = normalizeMessage({
              id: Date.now(),
              senderId:
                data.user_id ??
                data.sender_id ??
                data.senderId,
              senderName:
                data.username ||
                data.sender_name ||
                data.senderName ||
                clientFullName,
              content:
                data.message ||
                data.content ||
                data.text ||
                '',
              type: data.message_type || 'text',
              createdAt: new Date().toISOString(),
              status: 'delivered',
            });

            setMessages((previousMessages) => [
              ...previousMessages,
              receivedMessage,
            ]);

            scrollToBottom();
          }

          if (data.type === 'typing') {
            setIsTyping(Boolean(data.is_typing));
          }
        } catch (error) {
          console.error(
            'Erreur de lecture du message WebSocket:',
            error
          );
        }
      };

      websocket.onerror = (error) => {
        console.warn('Erreur Chat WebSocket:', error);
        setIsConnected(false);
      };

      websocket.onclose = () => {
        console.log('Chat WebSocket déconnecté');
        setIsConnected(false);
      };
    } catch (error) {
      console.error(
        'Impossible de créer le WebSocket:',
        error
      );

      setIsConnected(false);
    }
  }, [bookingId, token, clientFullName, scrollToBottom]);

  useEffect(() => {
    loadChatHistory();
    setupWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
    };
  }, [loadChatHistory, setupWebSocket]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();

    if (!text) {
      return;
    }

    const websocket = websocketRef.current;

    const newMessage = normalizeMessage({
      id: Date.now(),
      senderId: user?.id,
      senderName:
        user?.fullname ||
        user?.full_name ||
        user?.name ||
        'Vous',
      content: text,
      type: 'text',
      createdAt: new Date().toISOString(),
      status: websocket?.readyState === WebSocket.OPEN
        ? 'sent'
        : 'pending',
    });

    if (websocket?.readyState === WebSocket.OPEN) {
      try {
        websocket.send(
          JSON.stringify({
            type: 'message',
            user_id: user?.id,
            username:
              user?.fullname ||
              user?.full_name ||
              user?.name ||
              'Vous',
            message: text,
          })
        );
      } catch (error) {
        console.error(
          'Erreur lors de l’envoi du message:',
          error
        );
      }
    } else {
      Alert.alert(
        'Connexion indisponible',
        'La connexion au chat est momentanément indisponible.'
      );
    }

    setMessages((previousMessages) => [
      ...previousMessages,
      newMessage,
    ]);

    setInputText('');
    setIsTyping(false);
    scrollToBottom();
  }, [inputText, user, scrollToBottom]);

  const handleTyping = useCallback((typing) => {
    const websocket = websocketRef.current;

    setIsTyping(typing);

    if (websocket?.readyState === WebSocket.OPEN) {
      try {
        websocket.send(
          JSON.stringify({
            type: 'typing',
            user_id: user?.id,
            is_typing: typing,
          })
        );
      } catch (error) {
        console.warn(
          'Impossible d’envoyer le statut de saisie:',
          error
        );
      }
    }
  }, [user]);

  const handleOpenClientProfile = () => {
    if (!client?.id && !clientId) {
      return;
    }

    navigation.navigate('ClientProfile', {
      clientId: client?.id || clientId,
      client: client || undefined,
    });
  };

  const renderHeaderAvatar = () => {
    return (
      <View
        style={[
          styles.headerAvatarFrame,
          {
            backgroundColor: isDark
              ? '#26352E'
              : '#E8F5EE',
            borderColor: PRIMARY_COLOR,
          },
        ]}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.headerAvatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[
              styles.headerAvatarText,
              { color: PRIMARY_COLOR },
            ]}
          >
            {getInitial(clientFullName)}
          </Text>
        )}

        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: isClientOnline
                ? '#22C55E'
                : '#9CA3AF',
              borderColor: themeColors.surface,
            },
          ]}
        />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={PRIMARY_COLOR}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color: themeColors.textSecondary,
            },
          ]}
        >
          Chargement du chat...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
        },
      ]}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : Platform.OS === 'android'
            ? 'height'
            : undefined
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? 90 : 0
      }
    >
      {/* HEADER */}
      <View
        style={[
          styles.chatHeader,
          {
            backgroundColor: themeColors.surface,
            borderBottomColor: themeColors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={themeColors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={handleOpenClientProfile}
          activeOpacity={0.8}
        >
          {renderHeaderAvatar()}

          <View style={styles.headerText}>
            <Text
              numberOfLines={1}
              style={[
                styles.headerName,
                {
                  color: themeColors.text,
                },
              ]}
            >
              {clientFullName}
            </Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusSmallDot,
                  {
                    backgroundColor: isClientOnline
                      ? '#22C55E'
                      : '#9CA3AF',
                  },
                ]}
              />

              <Text
                style={[
                  styles.headerStatus,
                  {
                    color: isClientOnline
                      ? '#22C55E'
                      : themeColors.textSecondary,
                  },
                ]}
              >
                {isClientOnline
                  ? 'En ligne'
                  : 'Hors ligne'}
              </Text>

              {isConnected && (
                <Text
                  style={[
                    styles.connectionText,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  • Chat actif
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => {
            Alert.alert(
              'Appel',
              'La fonction d’appel sera disponible prochainement.'
            );
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="call-outline"
            size={23}
            color={PRIMARY_COLOR}
          />
        </TouchableOpacity>
      </View>

      {/* MESSAGES */}
      <Animated.View
        style={[
          styles.messagesContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              isOwn={item.senderId === user?.id}
              timestamp={item.createdAt}
              avatar={
                item.senderId === user?.id
                  ? user?.profile_image ||
                    user?.profileImage ||
                    user?.avatar
                  : photoUri
              }
            />
          )}
          keyExtractor={(item, index) =>
            String(item.id || `message-${index}`)
          }
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.emptyMessagesList,
          ]}
          showsVerticalScrollIndicator={false}
          onLayout={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconContainer,
                  {
                    backgroundColor: isDark
                      ? '#26352E'
                      : '#E8F5EE',
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={34}
                  color={PRIMARY_COLOR}
                />
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Aucun message
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                Commencez une conversation avec le client.
              </Text>
            </View>
          }
        />

        {isTyping && (
          <View style={styles.typingIndicator}>
            <View
              style={[
                styles.typingBubble,
                {
                  backgroundColor: isDark
                    ? '#26352E'
                    : '#E8F5EE',
                },
              ]}
            >
              <View
                style={[
                  styles.typingDot,
                  { backgroundColor: PRIMARY_COLOR },
                ]}
              />
              <View
                style={[
                  styles.typingDot,
                  { backgroundColor: PRIMARY_COLOR },
                ]}
              />
              <View
                style={[
                  styles.typingDot,
                  { backgroundColor: PRIMARY_COLOR },
                ]}
              />
            </View>

            <Text
              style={[
                styles.typingText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              Le client écrit...
            </Text>
          </View>
        )}
      </Animated.View>

      {/* ZONE DE SAISIE */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: themeColors.surface,
            borderTopColor: themeColors.border,
          },
        ]}
      >
        <View style={styles.inputWrapper}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              Alert.alert(
                'Pièce jointe',
                'La fonction de pièce jointe sera disponible prochainement.'
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="add-circle-outline"
              size={27}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text,
                backgroundColor: isDark
                  ? '#1E1E1E'
                  : '#F5F7F6',
                borderColor: isDark
                  ? '#333333'
                  : '#E5E7EB',
              },
            ]}
            placeholder="Écrire un message..."
            placeholderTextColor={
              themeColors.textSecondary
            }
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              handleTyping(text.length > 0);
            }}
            onSubmitEditing={sendMessage}
            multiline
            maxLength={500}
            textAlignVertical="center"
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                inputText.trim()
                  ? [PRIMARY_COLOR, PRIMARY_LIGHT]
                  : ['#BDBDBD', '#BDBDBD']
              }
              style={styles.sendGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name="send"
                size={19}
                color="#FFFFFF"
              />
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
    paddingHorizontal: spacing.lg,
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
    minHeight: 76,
    paddingTop:
      Platform.OS === 'ios'
        ? 48
        : Platform.OS === 'android'
          ? 12
          : 12,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerAvatarFrame: {
    position: 'relative',
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },

  headerAvatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },

  onlineDot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    right: -3,
    bottom: -3,
    borderWidth: 2,
  },

  headerText: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
  },

  headerName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    maxWidth: '100%',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },

  statusSmallDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },

  headerStatus: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },

  connectionText: {
    marginLeft: 5,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },

  headerAction: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },

  messagesContainer: {
    flex: 1,
    minHeight: 0,
  },

  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexGrow: 1,
  },

  emptyMessagesList: {
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },

  emptyIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },

  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: 5,
  },

  emptyText: {
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },

  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },

  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    marginRight: 8,
  },

  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginHorizontal: 2,
    opacity: 0.8,
  },

  typingText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
  },

  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  inputWrapper: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  attachButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? 11 : 10,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    marginLeft: 7,
    marginBottom: 0,
  },

  sendButtonDisabled: {
    opacity: 0.65,
  },

  sendGradient: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;