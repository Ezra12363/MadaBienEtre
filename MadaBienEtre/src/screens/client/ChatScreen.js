// src/screens/client/ChatScreen.js

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
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import Header from '../../components/common/Header';


// ============================================================
// PLATFORM
// ============================================================

const IS_WEB = Platform.OS === 'web';


// ============================================================
// TOAST
// ============================================================

const Toast = ({
  visible,
  type = 'success',
  title,
  message,
  onHide,
  themeColors,
}) => {
  const translateY = useRef(
    new Animated.Value(-25)
  ).current;

  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(
          Easing.cubic
        ),
        useNativeDriver: true,
      }),

      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      hideToast();
    }, 2600);

    return () => clearTimeout(timer);
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -20,
        duration: 220,
        useNativeDriver: true,
      }),

      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  if (!visible) return null;

  const toastConfig = {
    success: {
      icon: 'checkmark-circle',
      iconColor: '#00C853',
    },

    error: {
      icon: 'close-circle',
      iconColor: '#E53935',
    },

    warning: {
      icon: 'warning',
      iconColor: '#FF9800',
    },

    info: {
      icon: 'information-circle',
      iconColor: colors.primary,
    },
  };

  const config =
    toastConfig[type] ||
    toastConfig.success;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastContainer,
        {
          opacity,
          transform: [
            {
              translateY,
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor:
              themeColors.surface,
            borderColor:
              themeColors.border ||
              '#E5E7EB',
          },
        ]}
      >
        {/* ICON */}

        <View
          style={[
            styles.toastIconContainer,
            {
              backgroundColor:
                config.iconColor +
                '16',
            },
          ]}
        >
          <Ionicons
            name={config.icon}
            size={22}
            color={config.iconColor}
          />
        </View>

        {/* CONTENT */}

        <View
          style={styles.toastContent}
        >
          {!!title && (
            <Text
              numberOfLines={1}
              style={[
                styles.toastTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {title}
            </Text>
          )}

          {!!message && (
            <Text
              numberOfLines={2}
              style={[
                styles.toastMessage,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {message}
            </Text>
          )}
        </View>

        {/* CLOSE */}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={hideToast}
          style={styles.toastClose}
        >
          <Ionicons
            name="close"
            size={18}
            color={
              themeColors.textSecondary
            }
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};


// ============================================================
// COMPONENT
// ============================================================

const ChatScreen = ({
  navigation,
  route,
}) => {
  const {
    bookingId,
    therapistId,
    therapistName,
  } = route.params || {};

  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const {
    token,
    user,
  } = useAuth();

  // ==========================================================
  // STATES
  // ==========================================================

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    newMessage,
    setNewMessage,
  ] = useState('');

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSending,
    setIsSending,
  ] = useState(false);

  // ==========================================================
  // TOAST STATES
  // ==========================================================

  const [
    toast,
    setToast,
  ] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // ==========================================================
  // REFS
  // ==========================================================

  const flatListRef =
    useRef(null);

  const inputRef =
    useRef(null);

  // ==========================================================
  // SHOW TOAST
  // ==========================================================

  const showToast = useCallback(
    ({
      type = 'success',
      title = '',
      message = '',
    }) => {
      setToast({
        visible: true,
        type,
        title,
        message,
      });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  // ==========================================================
  // SCROLL TO BOTTOM
  // ==========================================================

  const scrollToBottom = useCallback(
    (animated = true) => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated,
        });
      }, 80);
    },
    []
  );

  // ==========================================================
  // LOAD CHAT
  // ==========================================================

  useEffect(() => {
    loadChatHistory();

    if (IS_WEB) {
      return;
    }

    const keyboardDidShowListener =
      Keyboard.addListener(
        'keyboardDidShow',
        () => {
          scrollToBottom(true);
        }
      );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  // ==========================================================
  // CHAT HISTORY
  // ==========================================================

  const loadChatHistory =
    async () => {
      try {
        setIsLoading(true);

        const mockMessages = [
          {
            id: 1,
            sender_id:
              therapistId || 2,
            sender_name:
              therapistName ||
              'Sarah B.',
            message:
              'Bonjour ! Je suis disponible pour le massage.',
            timestamp:
              new Date(
                Date.now() -
                  3600000
              ).toISOString(),
            is_from_therapist:
              true,
          },

          {
            id: 2,
            sender_id:
              user?.id || 1,
            sender_name:
              user?.fullname ||
              'Vous',
            message:
              'Super ! Je vous attends à 14h.',
            timestamp:
              new Date(
                Date.now() -
                  1800000
              ).toISOString(),
            is_from_therapist:
              false,
          },

          {
            id: 3,
            sender_id:
              therapistId || 2,
            sender_name:
              therapistName ||
              'Sarah B.',
            message:
              "Parfait, à tout à l'heure !",
            timestamp:
              new Date(
                Date.now() -
                  600000
              ).toISOString(),
            is_from_therapist:
              true,
          },
        ];

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              500
            )
        );

        setMessages(
          mockMessages
        );

        setTimeout(() => {
          scrollToBottom(false);
        }, 100);
      } catch (error) {
        console.error(
          'Error loading chat:',
          error
        );

        showToast({
          type: 'error',
          title: 'Erreur',
          message:
            'Impossible de charger la conversation.',
        });
      } finally {
        setIsLoading(false);
      }
    };

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  const sendMessage =
    async () => {
      const messageText =
        newMessage.trim();

      if (
        !messageText ||
        isSending
      ) {
        return;
      }

      setIsSending(true);

      // Clear immediately
      setNewMessage('');

      // Hide keyboard only on mobile.
      // On web we keep focus available.
      if (!IS_WEB) {
        Keyboard.dismiss();
      }

      const tempMessage = {
        id: Date.now(),
        sender_id:
          user?.id || 1,
        sender_name:
          user?.fullname ||
          'Vous',
        message:
          messageText,
        timestamp:
          new Date().toISOString(),
        is_from_therapist:
          false,
        isPending: true,
      };

      setMessages(
        (prev) => [
          ...prev,
          tempMessage,
        ]
      );

      scrollToBottom(true);

      try {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              500
            )
        );

        setMessages(
          (prev) =>
            prev.map(
              (msg) =>
                msg.id ===
                tempMessage.id
                  ? {
                      ...msg,
                      isPending:
                        false,
                    }
                  : msg
            )
        );

        showToast({
          type: 'success',
          title: 'Message envoyé',
          message:
            'Votre message a bien été envoyé.',
        });

        scrollToBottom(true);

        // ======================================================
        // MOCK THERAPIST RESPONSE
        // ======================================================

        setTimeout(() => {
          const replyMessage = {
            id:
              Date.now() +
              1,

            sender_id:
              therapistId ||
              2,

            sender_name:
              therapistName ||
              'Sarah B.',

            message:
              '✅ Message reçu !',

            timestamp:
              new Date().toISOString(),

            is_from_therapist:
              true,
          };

          setMessages(
            (prev) => [
              ...prev,
              replyMessage,
            ]
          );

          scrollToBottom(true);
        }, 1000);
      } catch (error) {
        console.error(
          'Error sending message:',
          error
        );

        setMessages(
          (prev) =>
            prev.map(
              (msg) =>
                msg.id ===
                tempMessage.id
                  ? {
                      ...msg,
                      isPending:
                        false,
                      isError:
                        true,
                    }
                  : msg
            )
        );

        showToast({
          type: 'error',
          title: 'Envoi impossible',
          message:
            'Une erreur est survenue lors de l’envoi.',
        });
      } finally {
        setIsSending(false);
      }
    };

  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  const formatTime =
    (timestamp) => {
      try {
        const date =
          new Date(timestamp);

        return date.toLocaleTimeString(
          'fr-FR',
          {
            hour: '2-digit',
            minute:
              '2-digit',
          }
        );
      } catch (e) {
        return '';
      }
    };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate =
    (timestamp) => {
      try {
        const date =
          new Date(timestamp);

        const today =
          new Date();

        const yesterday =
          new Date(today);

        yesterday.setDate(
          yesterday.getDate() -
            1
        );

        if (
          date.toDateString() ===
          today.toDateString()
        ) {
          return "Aujourd'hui";
        }

        if (
          date.toDateString() ===
          yesterday.toDateString()
        ) {
          return 'Hier';
        }

        return date.toLocaleDateString(
          'fr-FR',
          {
            day: 'numeric',
            month: 'short',
          }
        );
      } catch (e) {
        return '';
      }
    };

  // ==========================================================
  // RENDER MESSAGE
  // ==========================================================

  const renderMessage =
    ({ item, index }) => {
      const isFromTherapist =
        item.is_from_therapist;

      const previousMessage =
        messages[
          index - 1
        ];

      const showDate =
        index === 0 ||
        new Date(
          item.timestamp
        ).toDateString() !==
          new Date(
            previousMessage?.timestamp
          ).toDateString();

      return (
        <View
          key={item.id}
        >
          {/* DATE */}

          {showDate && (
            <View
              style={
                styles.dateContainer
              }
            >
              <View
                style={[
                  styles.dateBadge,
                  {
                    backgroundColor:
                      themeColors.surface,
                    borderColor:
                      themeColors.border ||
                      '#E5E7EB',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dateText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {formatDate(
                    item.timestamp
                  )}
                </Text>
              </View>
            </View>
          )}

          {/* MESSAGE */}

          <View
            style={[
              styles.messageWrapper,
              isFromTherapist
                ? styles.messageWrapperLeft
                : styles.messageWrapperRight,
            ]}
          >
            {/* AVATAR */}

            {isFromTherapist && (
              <View
                style={[
                  styles.avatarContainer,
                  {
                    backgroundColor:
                      colors.primary +
                      '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  {item.sender_name
                    ?.charAt(0)
                    ?.toUpperCase() ||
                    'T'}
                </Text>
              </View>
            )}

            {/* BUBBLE */}

            <View
              style={[
                styles.messageContainer,
                isFromTherapist
                  ? styles.messageLeft
                  : styles.messageRight,
                {
                  backgroundColor:
                    isFromTherapist
                      ? themeColors.surface
                      : colors.primary,

                  borderColor:
                    isFromTherapist
                      ? themeColors.border ||
                        '#E5E7EB'
                      : 'transparent',
                },
              ]}
            >
              {/* SENDER */}

              {isFromTherapist && (
                <Text
                  style={[
                    styles.senderName,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  {item.sender_name}
                </Text>
              )}

              {/* TEXT */}

              <Text
                style={[
                  styles.messageText,
                  {
                    color:
                      isFromTherapist
                        ? themeColors.text
                        : '#fff',
                  },
                ]}
              >
                {item.message}
              </Text>

              {/* FOOTER */}

              <View
                style={
                  styles.messageFooter
                }
              >
                <Text
                  style={[
                    styles.messageTime,
                    {
                      color:
                        isFromTherapist
                          ? themeColors.textSecondary
                          : 'rgba(255,255,255,0.72)',
                    },
                  ]}
                >
                  {formatTime(
                    item.timestamp
                  )}
                </Text>

                {!isFromTherapist &&
                  !item.isPending &&
                  !item.isError && (
                    <Ionicons
                      name="checkmark-done"
                      size={15}
                      color="rgba(255,255,255,0.75)"
                    />
                  )}

                {item.isPending && (
                  <ActivityIndicator
                    size="small"
                    color="rgba(255,255,255,0.75)"
                  />
                )}

                {item.isError && (
                  <Ionicons
                    name="alert-circle"
                    size={15}
                    color="#FF5252"
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      );
    };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (isLoading) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        <StatusBar
          barStyle={
            isDark
              ? 'light-content'
              : 'dark-content'
          }
          backgroundColor={
            themeColors.background
          }
        />

        <View
          style={
            styles.loadingContainer
          }
        >
          <View
            style={[
              styles.loadingIcon,
              {
                backgroundColor:
                  colors.primary +
                  '15',
              },
            ]}
          >
            <Ionicons
              name="chatbubbles"
              size={30}
              color={
                colors.primary
              }
            />
          </View>

          <ActivityIndicator
            size="large"
            color={
              colors.primary
            }
          />

          <Text
            style={[
              styles.loadingText,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            Chargement de la conversation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          themeColors.background
        }
      />

      {/* ==================================================== */}
      {/* TOAST */}
      {/* ==================================================== */}

      <Toast
        visible={
          toast.visible
        }
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onHide={hideToast}
        themeColors={
          themeColors
        }
      />

      {/* ==================================================== */}
      {/* HEADER */}
      {/* ==================================================== */}

      <Header
        title={
          therapistName ||
          'Chat'
        }
        showBack
        rightComponent={
          <TouchableOpacity
            activeOpacity={0.7}
            style={
              styles.headerAction
            }
            onPress={() => {
              if (!bookingId) {
                showToast({
                  type: 'info',
                  title:
                    'Information',
                  message:
                    'Aucune réservation associée à cette conversation.',
                });

                return;
              }

              navigation.navigate(
                'BookingDetail',
                {
                  bookingId,
                }
              );
            }}
          >
            <Ionicons
              name="information-circle-outline"
              size={25}
              color={
                themeColors.text
              }
            />
          </TouchableOpacity>
        }
      />

      {/* ==================================================== */}
      {/* CHAT */}
      {/* ==================================================== */}

      <KeyboardAvoidingView
        style={
          styles.keyboardView
        }
        behavior={
          IS_WEB
            ? undefined
            : Platform.OS ===
              'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={
          Platform.OS ===
          'ios'
            ? 90
            : 0
        }
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor:
                themeColors.background,
            },
          ]}
        >
          {/* ================================================= */}
          {/* MESSAGE LIST */}
          {/* ================================================= */}

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={
              renderMessage
            }
            keyExtractor={(
              item
            ) =>
              item.id.toString()
            }
            contentContainerStyle={[
              styles.messagesList,
              messages.length ===
                0 &&
                styles.emptyMessagesList,
            ]}
            onContentSizeChange={() =>
              scrollToBottom(
                false
              )
            }
            onLayout={() =>
              scrollToBottom(
                false
              )
            }
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              IS_WEB
                ? 'none'
                : 'interactive'
            }
          />

          {/* ================================================= */}
          {/* INPUT AREA */}
          {/* ================================================= */}

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor:
                  themeColors.surface,
                borderTopColor:
                  themeColors.border ||
                  '#E0E0E0',
              },
            ]}
          >
            {/* INPUT */}

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor:
                    themeColors.background,
                  borderColor:
                    themeColors.border ||
                    '#E0E0E0',
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    color:
                      themeColors.text,

                    // IMPORTANT:
                    // Removes browser focus outline
                    // without removing the cursor.
                    ...(IS_WEB
                      ? {
                          outlineStyle:
                            'none',
                          outlineWidth: 0,
                          outlineColor:
                            'transparent',
                        }
                      : {}),
                  },
                ]}
                placeholder="Écrivez un message..."
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={
                  newMessage
                }
                onChangeText={
                  setNewMessage
                }
                multiline
                maxLength={500}
                textAlignVertical="center"
                autoCorrect={
                  !IS_WEB
                }
                autoCapitalize="sentences"
                blurOnSubmit={
                  false
                }
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (
                    newMessage.trim()
                  ) {
                    sendMessage();
                  }
                }}
              />

              {/* CHARACTER COUNTER */}

              {newMessage.length >
                400 && (
                <Text
                  style={[
                    styles.characterCounter,
                    {
                      color:
                        newMessage.length >=
                        500
                          ? '#E53935'
                          : themeColors.textSecondary,
                    },
                  ]}
                >
                  {newMessage.length}
                  /500
                </Text>
              )}
            </View>

            {/* SEND BUTTON */}

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    colors.primary,
                },
                (!newMessage.trim() ||
                  isSending) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={
                sendMessage
              }
              disabled={
                !newMessage.trim() ||
                isSending
              }
            >
              {isSending ? (
                <ActivityIndicator
                  size="small"
                  color="#fff"
                />
              ) : (
                <Ionicons
                  name="send"
                  size={21}
                  color={
                    newMessage.trim()
                      ? '#fff'
                      : 'rgba(255,255,255,0.55)'
                  }
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};


// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({
    // ========================================================
    // GENERAL
    // ========================================================

    safeArea: {
      flex: 1,
    },

    keyboardView: {
      flex: 1,
    },

    container: {
      flex: 1,
    },

    // ========================================================
    // HEADER
    // ========================================================

    headerAction: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 21,
    },

    // ========================================================
    // LOADING
    // ========================================================

    loadingContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        spacing.lg,
    },

    loadingIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        spacing.md,
    },

    loadingText: {
      marginTop:
        spacing.md,
      fontSize:
        typography
          .fontSize.md,
      fontFamily:
        typography
          .fontFamily
          .regular,
      textAlign:
        'center',
    },

    // ========================================================
    // TOAST
    // ========================================================

    toastContainer: {
      position: 'absolute',

      top:
        Platform.OS === 'ios'
          ? 72
          : 54,

      left: 0,
      right: 0,

      alignItems:
        'center',

      zIndex: 99999,

      elevation: 999,

      // Web
      ...(IS_WEB
        ? {
            pointerEvents:
              'box-none',
          }
        : {}),
    },

    toast: {
      width:
        Platform.OS === 'web'
          ? 420
          : '88%',

      maxWidth:
        520,

      minHeight: 64,

      borderRadius: 18,

      borderWidth: 1,

      paddingHorizontal: 12,
      paddingVertical: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      shadowColor:
        '#000',

      shadowOffset: {
        width: 0,
        height: 7,
      },

      shadowOpacity:
        0.16,

      shadowRadius:
        16,

      elevation: 12,
    },

    toastIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight: 10,
    },

    toastContent: {
      flex: 1,
      minWidth: 0,
    },

    toastTitle: {
      fontSize: 14,
      fontFamily:
        typography
          .fontFamily
          .semiBold,
      marginBottom: 2,
    },

    toastMessage: {
      fontSize: 12,
      fontFamily:
        typography
          .fontFamily
          .regular,
      lineHeight: 17,
    },

    toastClose: {
      width: 30,
      height: 30,
      borderRadius: 15,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginLeft: 5,
    },

    // ========================================================
    // MESSAGE LIST
    // ========================================================

    messagesList: {
      paddingHorizontal:
        spacing.md,

      paddingTop:
        spacing.md,

      paddingBottom:
        spacing.md,
    },

    emptyMessagesList: {
      flexGrow: 1,
      justifyContent:
        'center',
    },

    // ========================================================
    // DATE
    // ========================================================

    dateContainer: {
      alignItems:
        'center',

      marginVertical:
        spacing.sm,
    },

    dateBadge: {
      paddingHorizontal:
        spacing.md,

      paddingVertical:
        5,

      borderRadius: 14,

      borderWidth: 1,
    },

    dateText: {
      fontSize:
        typography
          .fontSize.xs,

      fontFamily:
        typography
          .fontFamily
          .medium,
    },

    // ========================================================
    // MESSAGE WRAPPER
    // ========================================================

    messageWrapper: {
      flexDirection:
        'row',

      marginBottom:
        spacing.sm,

      maxWidth:
        '86%',
    },

    messageWrapperLeft: {
      alignSelf:
        'flex-start',
    },

    messageWrapperRight: {
      alignSelf:
        'flex-end',
    },

    // ========================================================
    // AVATAR
    // ========================================================

    avatarContainer: {
      width: 34,
      height: 34,

      borderRadius: 17,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        spacing.xs,

      marginTop: 2,
    },

    avatarText: {
      fontSize:
        typography
          .fontSize.sm,

      fontFamily:
        typography
          .fontFamily
          .bold,
    },

    // ========================================================
    // MESSAGE BUBBLE
    // ========================================================

    messageContainer: {
      paddingHorizontal:
        spacing.md,

      paddingVertical:
        spacing.sm + 2,

      borderRadius: 18,

      maxWidth:
        '90%',

      borderWidth: 1,
    },

    messageLeft: {
      borderBottomLeftRadius:
        5,
    },

    messageRight: {
      borderBottomRightRadius:
        5,

      borderWidth: 0,
    },

    senderName: {
      fontSize:
        typography
          .fontSize.xs,

      fontFamily:
        typography
          .fontFamily
          .semiBold,

      marginBottom: 3,
    },

    messageText: {
      fontSize:
        typography
          .fontSize.md,

      fontFamily:
        typography
          .fontFamily
          .regular,

      lineHeight: 21,
    },

    messageFooter: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'flex-end',

      marginTop: 4,

      gap: 4,
    },

    messageTime: {
      fontSize: 10,

      fontFamily:
        typography
          .fontFamily
          .regular,
    },

    // ========================================================
    // INPUT
    // ========================================================

    inputContainer: {
      flexDirection:
        'row',

      alignItems:
        'flex-end',

      paddingHorizontal:
        spacing.md,

      paddingTop:
        spacing.sm,

      paddingBottom:
        Platform.OS ===
        'ios'
          ? spacing.md
          : spacing.sm,

      borderTopWidth: 1,

      gap: spacing.sm,
    },

    inputWrapper: {
      flex: 1,

      minHeight: 50,

      maxHeight: 125,

      borderRadius: 25,

      borderWidth: 1,

      paddingHorizontal:
        spacing.md,

      justifyContent:
        'center',

      position:
        'relative',

      // Important for Web
      ...(IS_WEB
        ? {
            cursor:
              'text',
          }
        : {}),
    },

    input: {
      width: '100%',

      minHeight: 44,

      maxHeight: 105,

      fontSize:
        typography
          .fontSize.md,

      fontFamily:
        typography
          .fontFamily
          .regular,

      paddingHorizontal: 0,

      paddingVertical:
        Platform.OS ===
        'ios'
          ? 7
          : 5,

      margin: 0,

      // IMPORTANT:
      // No outline on Web, but cursor stays.
      ...(IS_WEB
        ? {
            outlineStyle:
              'none',

            outlineWidth: 0,

            outlineColor:
              'transparent',

            cursor:
              'text',

            // Avoid browser resizing
            resize: 'none',
          }
        : {}),
    },

    characterCounter: {
      position:
        'absolute',

      right: 14,

      bottom: 5,

      fontSize: 9,

      fontFamily:
        typography
          .fontFamily
          .medium,
    },

    // ========================================================
    // SEND
    // ========================================================

    sendButton: {
      width: 50,

      height: 50,

      borderRadius: 25,

      alignItems:
        'center',

      justifyContent:
        'center',

      shadowColor:
        colors.primary,

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity:
        0.25,

      shadowRadius: 7,

      elevation: 5,

      flexShrink: 0,
    },

    sendButtonDisabled: {
      opacity: 0.48,
    },
  });

export default ChatScreen;