// src/components/chat/ChatRoomView.js
// ============================================================================
// Écran de discussion PARTAGÉ client <-> thérapeute (maquette « Conversation »).
// Les écrans client/ChatScreen et therapist/ChatScreen sont de simples
// enveloppes autour de ce composant : un seul code, deux rôles, web + Android.
//
// Données : useChatRoom (historique REST + WebSocket + envoi optimiste +
// accusés de lecture + images + suppression) — inchangé.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import AddressMapPickerModal from '../map/AddressMapPickerModal';
import Header from '../common/Header';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import useChatImageSending from '../../hooks/useChatImageSending';
import useChatPeer from '../../hooks/useChatPeer';
import useChatRoom from '../../hooks/useChatRoom';
import useShareLocation from '../../hooks/useShareLocation';
import chatService from '../../services/chatService';
import { typography } from '../../theme';
import { confirmAsync } from '../../utils/chatImage';
import { buildChatRows, getFirstName, notifyInfo } from '../../utils/chatUi';

import ChatActionSheet from './ChatActionSheet';
import ChatConfirmHost from './ChatConfirmHost';
import { ChatTrackingProvider } from './ChatTrackingContext';
import ChatComposer from './ChatComposer';
import ChatImagePreviewModal from './ChatImagePreviewModal';
import MessageBubble from './MessageBubble';
import PeerBar from './PeerBar';
import { CHAT_MAX_WIDTH, getChatPalette, useChatSidePadding } from './chatTheme';

const NEAR_BOTTOM_PX = 140;

const ChatRoomView = ({
  navigation,
  route,
  compactHeader = false, // web large : la barre du haut gère déjà retour + titre
  onMeta, // ({ title, subtitle }) => void  (pour la TopNavBar du thérapeute)
}) => {
  const params = route?.params || {};
  const bookingId = params.bookingId;

  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const { token, user } = useAuth();
  const { setActiveChatBookingId } = useNotifications();
  const side = useChatSidePadding(); // padding latéral responsive (plein écran)

  /* ----------------------------- interlocuteur ----------------------------- */
  const peer = useChatPeer({
    bookingId,
    token,
    fallbackId: params.otherUserId ?? params.clientId ?? params.therapistId ?? params.userId,
    fallbackName:
      params.otherName ?? params.clientName ?? params.therapistName ?? params.userName,
    fallbackPhoto:
      params.otherPhoto ?? params.clientPhoto ?? params.therapistPhoto ?? params.userPhoto,
  });

  /* -------------------------------- messages -------------------------------- */
  const {
    messages,
    isLoading,
    isConnected,
    isTyping,
    fatalError,
    sendMessage,
    sendImage,
    sendLocation,
    deleteMessage,
    deleteAllMine,
    retryMessage,
    notifyTyping,
    reload,
  } = useChatRoom({
    bookingId,
    token,
    user,
    onActiveChange: setActiveChatBookingId,
  });

  const [text, setText] = useState('');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  const lastIdRef = useRef(null);

  const myId = user?.id;
  const rows = useMemo(() => buildChatRows(messages), [messages]);

  /* --------------------------- statut dans l'en-tête --------------------------- */
  const status = useMemo(() => {
    if (!isConnected) return { text: 'Reconnexion…', color: palette.warning };
    if (isTyping) return { text: 'écrit un message…', color: palette.online };
    if (peer.isOnline === true) return { text: 'Actif maintenant', color: palette.online };
    if (peer.isOnline === false) return { text: 'Hors ligne', color: palette.offline };
    return { text: '', color: palette.online };
  }, [isConnected, isTyping, peer.isOnline, palette]);

  useEffect(() => {
    onMeta?.({ title: peer.name || 'Conversation', subtitle: status.text });
  }, [onMeta, peer.name, status.text]);

  /* ------------------------------- navigation ------------------------------- */
  const handleBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
  }, [navigation]);

  /* ------------------------ supprimer mes messages ------------------------ */
  const myCount = useMemo(
    () => messages.filter((m) => String(m.senderId) === String(myId) && !m.deleted).length,
    [messages, myId]
  );

  const handleDeleteAll = useCallback(async () => {
    if (myCount === 0) return;
    const who = peer.name ? ` à ${peer.name}` : '';
    const ok = await confirmAsync(
      'Supprimer tous vos messages ?',
      `Les ${myCount} message${myCount > 1 ? 's' : ''} que vous avez envoyé${myCount > 1 ? 's' : ''}${who} ` +
        'seront supprimés pour tout le monde. Cette action est irréversible.',
      'Tout supprimer'
    );
    if (!ok) return;
    const result = await deleteAllMine();
    if (!result.ok) {
      notifyInfo('Suppression impossible', 'Vérifiez votre connexion puis réessayez.');
    }
  }, [myCount, peer.name, deleteAllMine]);

  const menuActions = useMemo(() => {
    const list = [];
    if (myCount > 0) {
      list.push({
        key: 'delete-all',
        label: `Supprimer tous mes messages (${myCount})`,
        icon: 'trash-outline',
        destructive: true,
        onPress: handleDeleteAll,
      });
    }
    list.push({
      key: 'refresh',
      label: 'Actualiser la conversation',
      icon: 'refresh-outline',
      onPress: () => reload?.(),
    });
    return list;
  }, [myCount, handleDeleteAll, reload]);

  /* ------------------------- partage de position ------------------------- */
  // Client    -> lieu de la réservation (adresse + GPS enregistrés)
  // Thérapeute -> sa position actuelle (GPS du téléphone) en route
  // Dans les deux cas : carte de confirmation, puis envoi avec latitude,
  // longitude, adresse et location_type ('booking' | 'live').
  const { getCurrentPosition } = useShareLocation();
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [picker, setPicker] = useState(null); // { mode, coord }
  const isTherapist = String(user?.role || '').toUpperCase().includes('THERAPIST');

  const handleShareBooking = useCallback(async () => {
    const res = await chatService.getBookingLocation(bookingId);
    const d = res.success ? res.data : null;
    const hasCoord = d && d.latitude != null && d.longitude != null;
    if (!hasCoord) {
      notifyInfo(
        'Lieu de la réservation',
        'Aucune position GPS enregistrée pour cette réservation : choisissez le lieu sur la carte.'
      );
    }
    setPicker({
      mode: 'booking',
      coord: hasCoord ? { latitude: d.latitude, longitude: d.longitude } : null,
    });
  }, [bookingId]);

  const handleShareLive = useCallback(async () => {
    const res = await getCurrentPosition();
    if (!res.ok) {
      notifyInfo('Position', `${res.message} Vous pouvez choisir un lieu sur la carte.`);
      setPicker({ mode: 'live', coord: null });
      return;
    }
    setPicker({ mode: 'live', coord: { latitude: res.latitude, longitude: res.longitude } });
  }, [getCurrentPosition]);

  const shareActions = useMemo(() => {
    const booking = {
      key: 'share-booking',
      label: 'Partager le lieu du rendez-vous',
      icon: 'home-outline',
      onPress: handleShareBooking,
    };
    const live = {
      key: 'share-live',
      label: 'Partager ma position actuelle',
      icon: 'navigate-outline',
      onPress: handleShareLive,
    };
    return isTherapist ? [live, booking] : [booking, live];
  }, [isTherapist, handleShareBooking, handleShareLive]);

  const handleConfirmLocation = useCallback(
    ({ address, latitude, longitude }) => {
      const mode = picker?.mode || 'live';
      setPicker(null);
      nearBottomRef.current = true;
      sendLocation({ latitude, longitude, address, locationType: mode });
    },
    [picker, sendLocation]
  );

  /* ---------------------------------- images ---------------------------------- */
  const { pendingAsset, pickImage, cancelPreview, confirmSend } = useChatImageSending({
    sendImage,
    onError: (message) => notifyInfo('Image', message),
  });

  /* ---------------------------------- scroll ---------------------------------- */
  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleScroll = useCallback((e) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distance = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const near = distance < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    if (near) {
      setShowJump((prev) => (prev ? false : prev));
      setNewCount((prev) => (prev ? 0 : prev));
    }
  }, []);

  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  const lastId = lastMessage ? String(lastMessage.id) : null;

  // Nouveau message : on descend si c'est moi ou si on est déjà en bas,
  // sinon on affiche un bouton « nouveau message ».
  useEffect(() => {
    if (!lastId || lastIdRef.current === lastId) return;
    const firstLoad = lastIdRef.current === null;
    lastIdRef.current = lastId;

    const mine = String(lastMessage.senderId) === String(myId);
    if (firstLoad || mine || nearBottomRef.current) {
      nearBottomRef.current = true;
      scrollToBottom(!firstLoad);
    } else {
      setNewCount((c) => c + 1);
      setShowJump(true);
    }
  }, [lastId, lastMessage, myId, scrollToBottom]);

  // Clavier ouvert (mobile) : on reste collé au dernier message
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const evt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(evt, () => {
      if (nearBottomRef.current) scrollToBottom(true);
    });
    return () => sub.remove();
  }, [scrollToBottom]);

  /* ----------------------------------- envoi ----------------------------------- */
  const handleChangeText = useCallback(
    (value) => {
      setText(value);
      notifyTyping(value);
    },
    [notifyTyping]
  );

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    nearBottomRef.current = true;
    // Si l'envoi échoue, la bulle passe en « Échec » : un appui dessus relance l'envoi.
    await sendMessage(content);
    scrollToBottom(true);
  }, [text, sendMessage, scrollToBottom]);

  /* ---------------------------------- rendu ---------------------------------- */
  const renderRow = useCallback(
    ({ item }) => {
      if (item.rowType === 'date') {
        return (
          <View style={styles.dateWrap}>
            <View style={[styles.datePill, { backgroundColor: palette.pillBg }]}>
              <Text style={[styles.dateText, { color: palette.pillText }]}>{item.label}</Text>
            </View>
          </View>
        );
      }
      const { message } = item;
      return (
        <MessageBubble
          message={message}
          isOwn={String(message.senderId) === String(myId)}
          showTime={item.showTime}
          isGroupStart={item.isGroupStart}
          palette={palette}
          token={token}
          onDelete={deleteMessage}
          onRetry={retryMessage}
        />
      );
    },
    [palette, myId, token, deleteMessage, retryMessage]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const empty = (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.primarySoft }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={34} color={palette.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>Aucun message</Text>
      <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
        Commencez la conversation{peer.name ? ` avec ${peer.name}` : ''}.
      </Text>
    </View>
  );

  // Client : toucher « thérapeute en route » ouvre le suivi (TrackingScreen)
  // avec la position reçue dans le message.
  const trackingValue = useMemo(() => {
    if (isTherapist || !bookingId) return null;
    return {
      openTracking: (position) =>
        navigation?.navigate?.('Tracking', {
          bookingId,
          sharedPosition: position
            ? {
                latitude: position.latitude,
                longitude: position.longitude,
                address: position.address || null,
                at: Date.now(),
              }
            : undefined,
        }),
    };
  }, [isTherapist, bookingId, navigation]);

  const typingLabel = isTyping ? `${getFirstName(peer.name) || 'Votre interlocuteur'} écrit` : '';

  return (
    <ChatTrackingProvider value={trackingValue}>
    <View style={[styles.root, { backgroundColor: palette.screenBg }]}>
            {!compactHeader && (
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Header title="Conversation" showBack onBackPress={handleBack} />
        </View>
      )}

      <PeerBar
        palette={palette}
        name={peer.name}
        photo={peer.photo}
        statusText={status.text}
        statusColor={status.color}
        bookingId={bookingId}
        onMenu={() => setMenuOpen(true)}
      />

      {!!fatalError && (
        <View style={[styles.banner, { backgroundColor: palette.dangerSoft }]}>
          <Ionicons name="alert-circle" size={16} color={palette.danger} />
          <Text style={[styles.bannerText, { color: palette.danger }]} numberOfLines={2}>
            Conversation indisponible ({fatalError}).
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <View style={styles.flex}>
          {isLoading && messages.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
                Chargement de la conversation…
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              renderItem={renderRow}
              keyExtractor={keyExtractor}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                { paddingHorizontal: side },
                rows.length === 0 && styles.listEmpty,
              ]}
              ListEmptyComponent={empty}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              onScroll={handleScroll}
              scrollEventThrottle={64}
              onContentSizeChange={() => {
                if (nearBottomRef.current) scrollToBottom(false);
              }}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={11}
            />
          )}

          {showJump && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                nearBottomRef.current = true;
                setShowJump(false);
                setNewCount(0);
                scrollToBottom(true);
              }}
              style={[styles.jump, { backgroundColor: palette.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Aller au dernier message"
            >
              <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
              {newCount > 0 && <Text style={styles.jumpText}>{newCount > 99 ? '99+' : newCount}</Text>}
            </TouchableOpacity>
          )}
        </View>

        <ChatComposer
          palette={palette}
          value={text}
          onChangeText={handleChangeText}
          onSend={handleSend}
          onAttach={pickImage}
          onShareLocation={() => setShareMenuOpen(true)}
          typingLabel={typingLabel}
        />
      </KeyboardAvoidingView>

      <ChatActionSheet
        visible={menuOpen}
        title={peer.name || 'Conversation'}
        subtitle={bookingId ? `Réservation #${bookingId}` : undefined}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
        palette={palette}
      />

      <ChatActionSheet
        visible={shareMenuOpen}
        title="Partager une position"
        subtitle="Le destinataire pourra ouvrir la carte et l'itinéraire."
        actions={shareActions}
        onClose={() => setShareMenuOpen(false)}
        palette={palette}
      />

      {!!picker && (
        <AddressMapPickerModal
          visible
          initialCoordinate={picker.coord}
          onClose={() => setPicker(null)}
          onConfirm={handleConfirmLocation}
        />
      )}

      <ChatConfirmHost />

      <ChatImagePreviewModal
        visible={Boolean(pendingAsset)}
        asset={pendingAsset}
        onCancel={cancelPreview}
        onConfirm={confirmSend}
      />
    </View>
    </ChatTrackingProvider>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, minHeight: 0 },

  list: { flex: 1 },
  listContent: {
    width: '100%',
    maxWidth: CHAT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },

  dateWrap: { alignItems: 'center', marginTop: 6, marginBottom: 6 },
  datePill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14 },
  dateText: { fontSize: 12, fontFamily: typography.fontFamily.medium },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, fontFamily: typography.fontFamily.regular },

  empty: { alignItems: 'center', paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 17, fontFamily: typography.fontFamily.semiBold, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', fontFamily: typography.fontFamily.regular },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: { flex: 1, fontSize: 12, fontFamily: typography.fontFamily.medium },

  jump: {
    position: 'absolute',
    right: 18,
    bottom: 10,
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      web: { boxShadow: '0 3px 8px rgba(0,0,0,0.2)', cursor: 'pointer' },
      default: {},
    }),
  },
  jumpText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});

export default ChatRoomView;
