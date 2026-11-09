// src/screens/shared/MessengerChatScreen.js
// Écran de conversation (Client, Thérapeute, Admin) : privé, groupe, annonces.
// Toute règle d'accès est revérifiée par le serveur ; l'interface ne fait que
// masquer ce qui serait refusé.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddressMapPickerModal from '../../components/map/AddressMapPickerModal';
import Header from '../../components/common/Header';
import ChatActionSheet from '../../components/chat/ChatActionSheet';
import PeerBar from '../../components/chat/PeerBar';
import { ChatTrackingProvider } from '../../components/chat/ChatTrackingContext';
import ChatAvatar from '../../components/chat/ChatAvatar';
import ChatConfirmHost from '../../components/chat/ChatConfirmHost';
import { getChatPalette, getChatBubbleMaxWidth, useChatSidePadding } from '../../components/chat/chatTheme';
import AttachmentPreviewModal from '../../components/messenger/AttachmentPreviewModal';
import ConversationPicker from '../../components/messenger/ConversationPicker';
import { QUICK_REACTIONS } from '../../components/messenger/emojiData';
import MessengerBubble from '../../components/messenger/MessengerBubble';
import MessengerComposer from '../../components/messenger/MessengerComposer';
import { useAuth } from '../../context/AuthContext';
import { useMessenger } from '../../context/MessengerContext';
import { useNotifications } from '../../context/NotificationContext';
import useShareLocation from '../../hooks/useShareLocation';
import chatService from '../../services/chatService';
import { useTheme } from '../../context/ThemeContext';
import messengerService, { buildFileUrl } from '../../services/messengerService';
import { confirmAsync } from '../../utils/chatImage';
import { formatDayLabel, notifyInfo, resolvePhotoUrl } from '../../utils/chatUi';
import { pickDocument, pickPhoto } from '../../utils/messengerPicker';
import {
  buildRows, canEditMsg, canReplyTo, computeStatus, isAdminUser, newClientId, presenceLabel,
} from '../../utils/messengerUtils';
import { useWindowDimensions } from 'react-native';

let Clipboard = null;
try {
  // eslint-disable-next-line global-require
  Clipboard = require('expo-clipboard');
} catch (_e) {
  Clipboard = null;
}

const copyText = async (text) => {
  if (Clipboard) return Clipboard.setStringAsync(text);
  if (Platform.OS === 'web' && navigator?.clipboard) return navigator.clipboard.writeText(text);
  return notifyInfo('Copier', 'Installez expo-clipboard pour copier du texte.');
};

const REPORT_REASONS = [
  ['spam', 'Spam'], ['harcelement', 'Harcèlement'], ['contenu_inapproprie', 'Contenu inapproprié'],
  ['arnaque', 'Arnaque'], ['autre', 'Autre'],
];

const upsert = (list, msg) => {
  const byId = list.findIndex((m) => m.id && m.id === msg.id);
  if (byId >= 0) { const c = [...list]; c[byId] = msg; return c; }
  const byClient = msg.client_id ? list.findIndex((m) => m.client_id === msg.client_id) : -1;
  if (byClient >= 0) { const c = [...list]; c[byClient] = msg; return c; }
  return [...list, msg];
};

const MessengerChatScreen = ({ navigation, route }) => {
  const params = route?.params || {};
  const bookingParam = params.bookingId;
  const [conversationId, setConversationId] = useState(params.conversationId || null);
  const focusMessageId = route?.params?.focusMessageId;
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const { token, user } = useAuth();
  const { send, subscribe, presence, startCall, connected } = useMessenger();
  const { setActiveChatBookingId } = useNotifications();
  const side = useChatSidePadding();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bubbleMax = getChatBubbleMaxWidth(width);

  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pinned, setPinned] = useState([]);
  const [pinIndex, setPinIndex] = useState(0);
  const [typing, setTyping] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [allowReplyNext, setAllowReplyNext] = useState(false);
  const [selected, setSelected] = useState(null);       // message dont le menu est ouvert
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState(null);             // { title, actions }
  const [preview, setPreview] = useState(null);         // fichier en attente d'envoi
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [picker, setPicker] = useState(null); // { mode, coord }
  const { getCurrentPosition } = useShareLocation();

  const listRef = useRef(null);
  const messagesRef = useRef([]);
  const typingTimers = useRef({});
  messagesRef.current = messages;

  const me = user?.id;
  const isPair = detail && ['direct', 'booking'].includes(detail.type);
  const isGroup = detail && !isPair;
  const rows = useMemo(() => buildRows(messages), [messages]);
  const peer = isPair ? detail.members?.find((m) => m.id !== me) : null;

  const toast = (msg) => notifyInfo('Messagerie', msg);

  /* ------------------------------- chargement ----------------------------- */
  const loadDetail = useCallback(async () => {
    const res = await messengerService.conversation(conversationId);
    if (res.success) setDetail(res.data);
    else if (res.status === 403 || res.status === 404) { setError(res.error); }
    return res;
  }, [conversationId]);

  const loadPinned = useCallback(async () => {
    const res = await messengerService.pinned(conversationId);
    if (res.success) { setPinned(res.data); setPinIndex(0); }
  }, [conversationId]);

  const markRead = useCallback(() => {
    if (!send({ type: 'read', conversation_id: conversationId })) {
      messengerService.markRead(conversationId);
    }
  }, [send, conversationId]);

  // Ouverture depuis une réservation : on retrouve (ou crée) sa conversation.
  useEffect(() => {
    if (conversationId || !bookingParam) return;
    let alive = true;
    messengerService.openBooking(bookingParam).then((res) => {
      if (!alive) return;
      if (res.success) setConversationId(res.data.id);
      else { setError(res.error); setLoading(false); }
    });
    return () => { alive = false; };
  }, [conversationId, bookingParam]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      const [d, m] = await Promise.all([loadDetail(), messengerService.messages(conversationId, { limit: 40 })]);
      if (!alive) return;
      if (m.success) { setMessages(m.data.messages); setHasMore(m.data.has_more); }
      else if (!d.success) setError(m.error || d.error);
      setLoading(false);
      loadPinned();
      markRead();
    })();
    return () => { alive = false; };
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(useCallback(() => { if (conversationId) markRead(); }, [markRead, conversationId]));

  // Notifications push : pas de bannière pour la conversation ouverte
  const activeBooking = detail?.booking_id || bookingParam || null;
  useEffect(() => {
    if (!activeBooking) return undefined;
    setActiveChatBookingId?.(activeBooking);
    return () => setActiveChatBookingId?.(null);
  }, [activeBooking, setActiveChatBookingId]);

  // Reconnexion : on récupère ce qui a pu arriver pendant la coupure
  useEffect(() => {
    if (!connected || loading || !conversationId) return;
    const lastId = [...messagesRef.current].reverse().find((m) => m.id)?.id;
    if (lastId) {
      messengerService.messages(conversationId, { afterId: lastId, limit: 100 }).then((res) => {
        if (res.success && res.data.messages.length) {
          setMessages((list) => res.data.messages.reduce(upsert, list));
          markRead();
        }
      });
    }
    loadDetail();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const firstId = messagesRef.current.find((m) => m.id)?.id;
    if (!firstId) return;
    setLoadingMore(true);
    const res = await messengerService.messages(conversationId, { beforeId: firstId, limit: 40 });
    if (res.success) {
      setMessages((list) => [...res.data.messages, ...list]);
      setHasMore(res.data.has_more);
    }
    setLoadingMore(false);
  }, [conversationId, hasMore, loadingMore]);

  /* ------------------------------ temps réel ------------------------------ */
  useEffect(() => subscribe((ev) => {
    if (ev.conversation_id !== conversationId && ev.type !== 'presence') return;
    switch (ev.type) {
      case 'message_new':
        setMessages((l) => upsert(l, ev.message));
        if (ev.message.sender?.id !== me) markRead();
        setTyping((t) => { const c = { ...t }; delete c[ev.message.sender?.id]; return c; });
        break;
      case 'message_updated':
        setMessages((l) => upsert(l, ev.message));
        setPinned((p) => {
          const rest = p.filter((x) => x.id !== ev.message.id);
          return ev.message.is_pinned && !ev.message.deleted ? [ev.message, ...rest] : rest;
        });
        break;
      case 'message_deleted':
        setMessages((l) => l.map((m) => (m.id === ev.message_id
          ? { ...m, deleted: true, content: '', attachment: null, is_pinned: false, reactions: [] } : m)));
        setPinned((p) => p.filter((x) => x.id !== ev.message_id));
        break;
      case 'reaction':
        setMessages((l) => l.map((m) => (m.id === ev.message_id ? { ...m, reactions: ev.reactions } : m)));
        break;
      case 'receipt':
        setDetail((d) => (d ? {
          ...d,
          members: d.members.map((m) => (m.id === ev.user_id ? {
            ...m,
            last_delivered_message_id: Math.max(m.last_delivered_message_id || 0, ev.up_to_id),
            last_read_message_id: ev.kind === 'read' ? Math.max(m.last_read_message_id || 0, ev.up_to_id) : m.last_read_message_id,
          } : m)),
        } : d));
        break;
      case 'typing': {
        clearTimeout(typingTimers.current[ev.user_id]);
        if (ev.is_typing) {
          setTyping((t) => ({ ...t, [ev.user_id]: ev.name }));
          typingTimers.current[ev.user_id] = setTimeout(() => setTyping((t) => { const c = { ...t }; delete c[ev.user_id]; return c; }), 4000);
        } else {
          setTyping((t) => { const c = { ...t }; delete c[ev.user_id]; return c; });
        }
        break;
      }
      case 'conversation_updated': {
        loadDetail();
        const lastId = [...messagesRef.current].reverse().find((m) => m.id)?.id;
        messengerService.messages(conversationId, { afterId: lastId || undefined, limit: 100 }).then((res) => {
          if (res.success && res.data.messages.length) setMessages((l) => res.data.messages.reduce(upsert, l));
        });
        break;
      }
      case 'conversation_removed':
        navigation.goBack();
        break;
      default:
    }
  }), [subscribe, conversationId, me, markRead, loadDetail, navigation]);

  /* ------------------------------- envoi --------------------------------- */
  const failLocal = (clientId, errorText) => {
    setMessages((l) => l.map((m) => (m.client_id === clientId ? { ...m, local_status: 'failed', retry_error: errorText } : m)));
  };

  const localMessage = (extra) => ({
    id: null, client_id: newClientId(), conversation_id: conversationId,
    sender: { id: me, fullname: user?.fullname, role: user?.role, profile_image: user?.profile_image },
    created_at: new Date().toISOString(), local_status: 'sending', reactions: [], allow_reply: true,
    reply_to: replyTo ? { id: replyTo.id, sender_name: replyTo.sender?.fullname, preview: replyTo.content || 'Pièce jointe' } : null,
    ...extra,
  });

  const deliver = useCallback(async (local, request) => {
    setMessages((l) => upsert(l, local));
    const res = await request;
    if (res.success) setMessages((l) => upsert(l, res.data));
    else {
      failLocal(local.client_id, res.error);
      if (res.status === 403 || res.status === 422 || res.status === 429) toast(res.error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const adminGroup = isAdminUser(user) && detail?.type === 'group';
  const replyBody = () => ({
    reply_to_id: replyTo?.id || null,
    allow_reply: adminGroup ? allowReplyNext : null,
  });
  const afterSend = () => { setReplyTo(null); setAllowReplyNext(false); };

  const sendText = async (text) => {
    if (editing) {
      const target = editing;
      setEditing(null);
      const res = await messengerService.editMessage(target.id, text);
      if (res.success) setMessages((l) => upsert(l, res.data)); else toast(res.error);
      return;
    }
    const local = localMessage({ message_type: 'text', content: text });
    const body = { text, client_id: local.client_id, ...replyBody() };
    afterSend();
    deliver(local, messengerService.sendText(conversationId, body));
  };

  const sendSticker = (s) => {
    const local = localMessage({ message_type: 'sticker', sticker: s, content: '' });
    const body = { sticker_id: s.id, client_id: local.client_id, ...replyBody() };
    afterSend();
    deliver(local, messengerService.sendSticker(conversationId, body));
  };

  const isTherapist = String(user?.role || '').toUpperCase().includes('THERAPIST');
  const bookingId = detail?.booking_id || bookingParam || null;

  const shareBooking = async () => {
    const res = await chatService.getBookingLocation(bookingId);
    const d = res.success ? res.data : null;
    const hasCoord = d && d.latitude != null && d.longitude != null;
    if (!hasCoord) toast('Aucune position GPS enregistrée pour cette réservation : choisissez le lieu sur la carte.');
    setPicker({ mode: 'booking', coord: hasCoord ? { latitude: d.latitude, longitude: d.longitude } : null });
  };

  const shareLive = async () => {
    const res = await getCurrentPosition();
    if (!res.ok) {
      toast(`${res.message} Vous pouvez choisir un lieu sur la carte.`);
      setPicker({ mode: 'live', coord: null });
      return;
    }
    setPicker({ mode: 'live', coord: { latitude: res.latitude, longitude: res.longitude } });
  };

  const shareActions = (() => {
    const live = { key: 'live', label: 'Partager ma position actuelle', icon: 'navigate-outline', onPress: shareLive };
    if (!bookingId) return [live];
    const booking = { key: 'booking', label: 'Partager le lieu du rendez-vous', icon: 'home-outline', onPress: shareBooking };
    return isTherapist ? [live, booking] : [booking, live];
  })();

  const confirmLocation = ({ address, latitude, longitude }) => {
    const mode = picker?.mode || 'live';
    setPicker(null);
    const local = localMessage({ message_type: 'location', content: '', location: { latitude, longitude, address, location_type: mode } });
    const body = { latitude, longitude, address, location_type: mode, client_id: local.client_id, reply_to_id: replyTo?.id || null };
    afterSend();
    deliver(local, messengerService.sendLocation(conversationId, body));
  };

  const doUpload = async (file, { caption, kind, durationSeconds } = {}) => {
    const local = localMessage({
      message_type: kind === 'audio' ? 'audio' : file.kind === 'image' ? 'image' : 'file',
      content: caption || '',
      attachment: { url: file.uri, name: file.name, size: file.size, duration: durationSeconds },
    });
    const request = messengerService.sendAttachment(conversationId, file, {
      kind, caption, clientId: local.client_id, replyToId: replyTo?.id, durationSeconds,
      allowReply: adminGroup ? allowReplyNext : null,
    });
    afterSend();
    await deliver(local, request);
  };

  const handleAttach = async (kind) => {
    if (kind === 'location') return setShareMenuOpen(true);
    const picked = kind === 'document' ? await pickDocument() : await pickPhoto(kind === 'camera' ? 'camera' : 'gallery');
    if (!picked) return null;
    if (picked.error) return toast(picked.error);
    return setPreview(picked.file);
  };

  const sendPreview = async (caption) => {
    const file = preview;
    setUploading(true);
    await doUpload(file, { caption });
    setUploading(false);
    setPreview(null);
  };

  const retry = (m) => {
    if (m.message_type === 'text') {
      setMessages((l) => l.filter((x) => x.client_id !== m.client_id));
      sendText(m.content);
    } else toast('Renvoyez la pièce jointe.');
  };

  /* ------------------------ actions sur un message ------------------------ */
  const jumpTo = useCallback(async (id) => {
    let tries = 0;
    let list = messagesRef.current;
    while (!list.some((m) => m.id === id) && tries < 8) {
      const first = list.find((m) => m.id)?.id;
      const res = await messengerService.messages(conversationId, { beforeId: first, limit: 50 });
      if (!res.success || !res.data.messages.length) break;
      list = [...res.data.messages, ...list];
      setMessages(list);
      setHasMore(res.data.has_more);
      tries += 1;
    }
    const index = buildRows(list).findIndex((r) => r.rowType === 'msg' && r.message.id === id);
    if (index >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }), 60);
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 2200);
    } else toast('Message introuvable.');
  }, [conversationId]);

  useEffect(() => { if (focusMessageId && !loading) jumpTo(focusMessageId); }, [focusMessageId, loading]); // eslint-disable-line

  const react = async (m, emoji) => {
    setSelected(null);
    const res = await messengerService.react(m.id, emoji);
    if (res.success) setMessages((l) => upsert(l, res.data)); else toast(res.error);
  };

  const deleteMsg = (m) => {
    setSelected(null);
    const mine = m.sender?.id === me || isAdminUser(user);
    setSheet({
      title: 'Supprimer le message',
      actions: [
        { key: 'me', label: 'Supprimer pour moi', icon: 'trash-outline', onPress: async () => {
          const res = await messengerService.deleteMessage(m.id, 'me');
          if (res.success) setMessages((l) => l.filter((x) => x.id !== m.id)); else toast(res.error);
        } },
        ...(mine && !m.deleted ? [{ key: 'all', label: 'Supprimer pour tous', icon: 'trash', destructive: true, onPress: async () => {
          if (!(await confirmAsync('Supprimer pour tous', 'Le message sera supprimé pour tous les participants.', 'Supprimer'))) return;
          const res = await messengerService.deleteMessage(m.id, 'all');
          if (!res.success) toast(res.error);
        } }] : []),
      ],
    });
  };

  const reportMsg = (m) => {
    setSelected(null);
    setSheet({
      title: 'Signaler ce message',
      subtitle: "L'administration examinera le signalement.",
      actions: REPORT_REASONS.map(([key, label]) => ({
        key, label, icon: 'flag-outline',
        onPress: async () => {
          const res = await messengerService.report(m.id, key);
          toast(res.success ? 'Signalement envoyé. Merci.' : res.error);
        },
      })),
    });
  };

  const messageActions = (m) => {
    const actions = [];
    if (canReplyTo(m, detail, user)) actions.push({ key: 'reply', label: 'Répondre', icon: 'arrow-undo-outline', onPress: () => { setReplyTo(m); setEditing(null); } });
    if (!m.deleted && ['text', 'location', 'sticker', 'image', 'file', 'audio'].includes(m.message_type)) {
      actions.push({ key: 'forward', label: 'Transférer', icon: 'arrow-redo-outline', onPress: () => setForwardMsg(m) });
    }
    if (m.message_type === 'text' && !m.deleted) {
      actions.push({ key: 'copy', label: 'Copier', icon: 'copy-outline', onPress: () => copyText(m.content) });
    }
    if (canEditMsg(m, user)) actions.push({ key: 'edit', label: 'Modifier', icon: 'create-outline', onPress: () => { setEditing(m); setReplyTo(null); } });
    if (detail?.can_pin && !m.deleted && m.message_type !== 'system') {
      actions.push({
        key: 'pin', label: m.is_pinned ? 'Désépingler' : 'Épingler', icon: m.is_pinned ? 'pin-outline' : 'pin',
        onPress: async () => { const r = await messengerService.pin(m.id, !m.is_pinned); if (!r.success) toast(r.error); },
      });
    }
    if (m.sender?.id !== me && !m.deleted && m.message_type !== 'system') actions.push({ key: 'report', label: 'Signaler', icon: 'flag-outline', onPress: () => reportMsg(m) });
    actions.push({ key: 'delete', label: 'Supprimer', icon: 'trash-outline', destructive: true, onPress: () => deleteMsg(m) });
    return actions;
  };

  /* --------------------------- menu de conversation ----------------------- */
  const settings = async (patch) => {
    const res = await messengerService.settings(conversationId, patch);
    if (res.success) { setDetail((d) => ({ ...d, ...patch })); if (patch.is_archived) navigation.goBack(); } else toast(res.error);
  };

  const headerMenu = () => {
    if (!detail) return [];
    const a = [];
    if (isGroup) a.push({ key: 'info', label: 'Infos du groupe', icon: 'information-circle-outline', onPress: () => navigation.navigate('GroupInfo', { conversationId }) });
    a.push({ key: 'search', label: 'Rechercher dans la conversation', icon: 'search', onPress: () => navigation.navigate('MessengerSearch', { conversationId }) });
    a.push({ key: 'pin', label: detail.is_pinned ? 'Retirer des conversations épinglées' : 'Épingler la conversation', icon: 'pin', onPress: () => settings({ is_pinned: !detail.is_pinned }) });
    a.push({ key: 'mute', label: detail.is_muted ? 'Réactiver les notifications' : 'Mettre en sourdine', icon: detail.is_muted ? 'notifications' : 'notifications-off', onPress: () => settings({ is_muted: !detail.is_muted }) });
    a.push({ key: 'archive', label: detail.is_archived ? 'Désarchiver' : 'Archiver', icon: 'archive-outline', onPress: () => settings({ is_archived: !detail.is_archived }) });
    if (isPair && peer && peer.role !== 'ADMIN') {
      a.push({
        key: 'block', icon: 'ban', destructive: !detail.blocked_by_me,
        label: detail.blocked_by_me ? 'Débloquer' : `Bloquer ${peer.fullname}`,
        onPress: async () => {
          if (!detail.blocked_by_me && !(await confirmAsync('Bloquer', `${peer.fullname} ne pourra plus vous écrire ni vous appeler.`, 'Bloquer'))) return;
          const res = detail.blocked_by_me ? await messengerService.unblock(peer.id) : await messengerService.block(peer.id);
          if (res.success) loadDetail(); else toast(res.error);
        },
      });
    }
    if (detail.type === 'direct') {
      a.push({ key: 'del', label: 'Supprimer la conversation', icon: 'trash-outline', destructive: true, onPress: async () => {
        if (!(await confirmAsync('Supprimer la conversation', "Elle disparaîtra de votre liste (l'autre personne la conserve).", 'Supprimer'))) return;
        const res = await messengerService.deleteConversation(conversationId);
        if (res.success) navigation.goBack(); else toast(res.error);
      } });
    }
    return a;
  };

  const callPeer = async () => {
    const r = await startCall(conversationId, peer);
    if (!r.ok) toast(r.error);
  };

  /* -------------------------------- rendu --------------------------------- */
  const typingNames = Object.values(typing);
  const peerPresence = peer ? (presence[peer.id] || { is_online: peer.is_online, last_seen_at: peer.last_seen_at }) : null;
  const subtitle = typingNames.length
    ? (isGroup ? `${typingNames.join(', ')} écrit…` : 'écrit…')
    : isGroup ? `${detail?.member_count || 0} membres${detail?.type === 'announcement' ? ' · Annonces' : ''}`
      : presenceLabel(peerPresence);
  const headerPhoto = detail ? (isGroup ? buildFileUrl(detail.photo, token) : resolvePhotoUrl(detail.photo)) : null;

  const renderItem = ({ item }) => {
    if (item.rowType === 'day') {
      return <View style={styles.dayWrap}><Text style={[styles.day, { backgroundColor: palette.pillBg, color: palette.pillText }]}>{formatDayLabel(item.date)}</Text></View>;
    }
    const m = item.message;
    const mine = m.sender?.id === me;
    const idx = messages.indexOf(m);
    const prev = messages[idx - 1];
    const showSender = !prev || prev.sender?.id !== m.sender?.id || ['system', 'call'].includes(prev.message_type);
    const st = mine ? computeStatus(m, detail, me) : {};
    return (
      <MessengerBubble
        msg={m} mine={mine} palette={palette} token={token} maxWidth={bubbleMax} groupChat={isGroup}
        showSender={showSender} status={st.status} readBy={st.readBy} highlighted={highlightId === m.id}
        onLongPress={(msg) => msg.id && setSelected(msg)} onReplyPress={jumpTo}
        onImagePress={setImageUrl} onReact={react} onRetry={retry}
      />
    );
  };

  const trackingValue = useMemo(() => {
    if (isTherapist || !bookingId) return null;
    return {
      openTracking: (position) => navigation?.navigate?.('Tracking', {
        bookingId,
        sharedPosition: position ? { latitude: position.latitude, longitude: position.longitude, address: position.address || null, at: Date.now() } : undefined,
      }),
    };
  }, [isTherapist, bookingId, navigation]);

  const pin = pinned[pinIndex % Math.max(pinned.length, 1)];
  const sideList = Math.max(0, side - 12);
  const statusColor = typingNames.length || peerPresence?.is_online ? palette.online : palette.offline;

  return (
    <ChatTrackingProvider value={trackingValue}>
      <View style={[styles.screen, { backgroundColor: palette.screenBg }]}>
        {/* Header partagé (identique aux autres pages) */}
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Header title={isGroup ? (detail?.type === 'announcement' ? 'Annonces' : 'Groupe') : 'Conversation'} showBack onBackPress={() => navigation.goBack()} />
        </View>

        <PeerBar
          palette={palette}
          name={detail?.title || params.otherName || params.clientName || params.therapistName || params.userName || params.title}
          photo={headerPhoto}
          statusText={error ? '' : subtitle}
          statusColor={statusColor}
          bookingId={bookingId}
          onCall={detail?.can_call ? callPeer : undefined}
          onMenu={() => setMenuOpen(true)}
        />

        {!!error && (
          <View style={[styles.banner, { backgroundColor: palette.dangerSoft }]}>
            <Ionicons name="alert-circle" size={16} color={palette.danger} />
            <Text style={{ flex: 1, color: palette.danger, fontSize: 12 }} numberOfLines={3}>Conversation indisponible ({error}).</Text>
          </View>
        )}

        {pin && (
          <TouchableOpacity
            style={[styles.pinBar, { backgroundColor: palette.primarySoft, borderBottomColor: palette.border }]}
            onPress={() => { jumpTo(pin.id); setPinIndex((i) => i + 1); }}
          >
            <Ionicons name="pin" size={16} color={palette.primary} />
            <Text style={{ flex: 1, color: palette.text, fontSize: 13 }} numberOfLines={1}>
              {pin.content || (pin.attachment ? `📎 ${pin.attachment.name || 'Pièce jointe'}` : 'Message épinglé')}
            </Text>
            {pinned.length > 1 && <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{(pinIndex % pinned.length) + 1}/{pinned.length}</Text>}
          </TouchableOpacity>
        )}

        {/* Le clavier ne doit JAMAIS cacher la barre de saisie : même réglage que le chat existant */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        >
          <View style={styles.flex}>
            {loading && !error ? (
              <View style={styles.centerAll}>
                <ActivityIndicator color={palette.primary} size="large" />
                <Text style={{ color: palette.textSecondary, marginTop: 10 }}>Chargement de la conversation…</Text>
              </View>
            ) : (
              <FlatList
                ref={listRef} inverted data={rows} keyExtractor={(r) => r.key} renderItem={renderItem}
                onEndReached={loadOlder} onEndReachedThreshold={0.4} style={styles.flex}
                contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: sideList }}
                ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} style={{ margin: 12 }} /> : null}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <View style={[styles.emptyIcon, { backgroundColor: palette.primarySoft }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={34} color={palette.primary} />
                    </View>
                    <Text style={{ color: palette.text, fontWeight: '700', fontSize: 17 }}>Aucun message</Text>
                    <Text style={{ color: palette.textSecondary, textAlign: 'center' }}>Commencez la conversation{detail?.title && !isGroup ? ` avec ${detail.title}` : ''}.</Text>
                  </View>
                }
                onScrollToIndexFailed={(info) => setTimeout(() => listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true }), 100)}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              />
            )}
          </View>

          <View style={{ paddingHorizontal: Math.max(0, side - 14) }}>
            <MessengerComposer
              palette={palette} disabledReason={detail && !detail.can_post ? detail.cannot_post_reason : null}
              replyTo={replyTo} editing={editing} onCancelContext={() => { setReplyTo(null); setEditing(null); }}
              adminAllowReplyToggle={adminGroup} allowReply={allowReplyNext} onToggleAllowReply={() => setAllowReplyNext((v) => !v)}
              onSendText={sendText} onSticker={sendSticker} onAttach={handleAttach} onError={toast}
              onTyping={(on) => send({ type: 'typing', conversation_id: conversationId, is_typing: on })}
              onVoice={(rec) => doUpload({ uri: rec.uri, name: rec.name, mimeType: rec.mimeType, kind: 'audio' }, { kind: 'audio', durationSeconds: rec.duration })}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Menu d'un message : réactions + actions */}
        <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
          <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={() => setSelected(null)}>
            <Pressable style={[styles.msgMenu, { backgroundColor: palette.surface }]} onPress={() => {}}>
              {!!selected && !selected.deleted && selected.message_type !== 'system' && (
                <View style={styles.reactRow}>
                  {QUICK_REACTIONS.map((e) => (
                    <TouchableOpacity key={e} onPress={() => react(selected, e)} style={styles.reactBtn}><Text style={{ fontSize: 26 }}>{e}</Text></TouchableOpacity>
                  ))}
                </View>
              )}
              {!!selected && messageActions(selected).map((a) => (
                <TouchableOpacity key={a.key} style={styles.menuRow} onPress={() => { setSelected(null); a.onPress(); }}>
                  <Ionicons name={a.icon} size={20} color={a.destructive ? palette.danger : palette.primary} />
                  <Text style={{ color: a.destructive ? palette.danger : palette.text, fontSize: 15 }}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        <ChatActionSheet visible={menuOpen} title={detail?.title} subtitle={bookingId ? `Réservation #${bookingId}` : undefined} actions={headerMenu()} onClose={() => setMenuOpen(false)} palette={palette} />
        <ChatActionSheet visible={!!sheet} title={sheet?.title} subtitle={sheet?.subtitle} actions={sheet?.actions || []} onClose={() => setSheet(null)} palette={palette} />
        <ChatActionSheet
          visible={shareMenuOpen} title="Partager une position"
          subtitle="Le destinataire pourra ouvrir la carte et l'itinéraire."
          actions={shareActions} onClose={() => setShareMenuOpen(false)} palette={palette}
        />
        {!!picker && (
          <AddressMapPickerModal visible initialCoordinate={picker.coord} onClose={() => setPicker(null)} onConfirm={confirmLocation} />
        )}
        <AttachmentPreviewModal file={preview} palette={palette} sending={uploading} onCancel={() => !uploading && setPreview(null)} onSend={sendPreview} />
        <ConversationPicker
          visible={!!forwardMsg} palette={palette} token={token} excludeId={null} onClose={() => setForwardMsg(null)}
          onConfirm={async (ids) => {
            const target = forwardMsg; setForwardMsg(null);
            const res = await messengerService.forward(target.id, ids);
            if (!res.success) toast(res.error);
            else if (res.data.failed?.length) toast(`Non transféré : ${res.data.failed.map((f) => f.detail).join(' ; ')}`);
            else toast('Message transféré.');
          }}
        />
        <Modal visible={!!imageUrl} transparent animationType="fade" onRequestClose={() => setImageUrl(null)}>
          <Pressable style={styles.imageBack} onPress={() => setImageUrl(null)}>
            {!!imageUrl && <Image source={{ uri: imageUrl }} style={styles.imageFull} resizeMode="contain" />}
            <View style={[styles.closeImg, { top: insets.top + 10 }]}><Ionicons name="close" size={28} color="#fff" /></View>
          </Pressable>
        </Modal>
        <ChatConfirmHost />
      </View>
    </ChatTrackingProvider>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minHeight: 0 },
  centerAll: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  pinBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  day: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 24, gap: 8, paddingVertical: 40, transform: [{ scaleY: -1 }] },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msgMenu: { borderRadius: 18, padding: 10, width: '100%', maxWidth: 360 },
  reactRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8, flexWrap: 'wrap' },
  reactBtn: { padding: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 12 },
  imageBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  imageFull: { width: '100%', height: '85%' },
  closeImg: { position: 'absolute', right: 16 },
});

export default MessengerChatScreen;
