// src/components/ai/AIChatPanel.js
// Chatbot réutilisable (Client / Thérapeute / Admin).
// Utilise POST /chatbot/message (utilisateur authentifié, historique par
// conversation_id) et GET /chatbot/suggestions.
//
// À placer dans un conteneur avec une hauteur (flex: 1) : il gère son
// propre défilement et son champ de saisie.

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import aiService from '../../services/aiService';
import AIChatBubble from './AIChatBubble';

const ROLE_CONFIG = {
  CLIENT: {
    welcome:
      "Bonjour ! Je suis votre assistant IA. Je peux vous aider à choisir un massage, estimer un prix, réserver ou répondre à vos questions. Que souhaitez-vous savoir ?",
    suggestions: [
      'Quel type de massage me convient le mieux ?',
      'Quels sont les prix pratiqués ?',
      'Comment annuler une réservation ?',
      'Comment payer avec MVola ?',
    ],
    useBackendSuggestions: true,
  },
  THERAPIST: {
    welcome:
      "Bonjour ! Je suis là pour vous aider à utiliser l'application : réservations, négociation des prix, disponibilités, gains et retraits.",
    suggestions: [
      'Comment accepter une réservation ?',
      'Comment fixer mon tarif ?',
      'Comment retirer mes gains ?',
      'Comment modifier mes disponibilités ?',
    ],
    useBackendSuggestions: false,
  },
  ADMIN: {
    welcome:
      "Bonjour ! Je peux répondre à vos questions sur le fonctionnement de la plateforme et vous aider à interpréter les indicateurs.",
    suggestions: [
      'Comment valider un thérapeute ?',
      'Que faire en cas d\'alerte SOS ?',
      'Comment lire les prévisions de revenus ?',
    ],
    useBackendSuggestions: false,
  },
};

let messageCounter = 0;
const nextId = () => `m-${Date.now()}-${messageCounter++}`;

const AIChatPanel = ({ role = 'CLIENT', style, initialMessage = null }) => {
  const { colors: themeColors, isDark } = useTheme();
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.CLIENT;

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      isUser: false,
      text: config.welcome,
      suggestions: config.suggestions,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const scrollRef = useRef(null);
  const sentInitial = useRef(false);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  // Suggestions du backend (rôle client uniquement : questions réservation/massage)
  useEffect(() => {
    if (!config.useBackendSuggestions) return undefined;
    let cancelled = false;
    (async () => {
      const result = await aiService.getChatSuggestions();
      const list = result.success ? result.data?.suggestions : null;
      if (!cancelled && Array.isArray(list) && list.length > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'welcome' ? { ...m, suggestions: list.slice(0, 4) } : m
          )
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (override) => {
      const text = (typeof override === 'string' ? override : input).trim();
      if (!text || sending) return;

      setInput('');
      setMessages((prev) => [
        ...prev,
        { id: nextId(), isUser: true, text, timestamp: Date.now() },
      ]);
      setSending(true);
      scrollToEnd();

      const result = await aiService.chatWithAI(text, conversationId);

      if (result.success) {
        const data = result.data || {};
        if (data.conversation_id) setConversationId(data.conversation_id);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            isUser: false,
            text: data.response || "Je n'ai pas de réponse pour le moment.",
            suggestions: data.suggestions,
            timestamp: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            isUser: false,
            text:
              result.error ||
              'Désolé, une erreur est survenue. Veuillez réessayer.',
            timestamp: Date.now(),
          },
        ]);
      }
      setSending(false);
      scrollToEnd();
    },
    [input, sending, conversationId, scrollToEnd]
  );

  // Question envoyée automatiquement (ex : depuis un bouton "Demander à l'IA")
  useEffect(() => {
    if (initialMessage && !sentInitial.current) {
      sentInitial.current = true;
      send(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  const canSend = input.trim().length > 0 && !sending;

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
      >
        {messages.map((m) => (
          <AIChatBubble
            key={m.id}
            message={m.text}
            isUser={m.isUser}
            timestamp={m.timestamp}
            suggestions={m.suggestions}
            onSuggestionPress={send}
          />
        ))}

        {sending && (
          <View style={styles.typingRow}>
            <View
              style={[
                styles.typingBubble,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.typingText, { color: themeColors.textSecondary }]}>
                L'IA réfléchit...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          { backgroundColor: themeColors.surface, borderTopColor: themeColors.border },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: themeColors.text,
              backgroundColor: isDark ? '#2C2C2C' : '#F5F5F5',
            },
            Platform.OS === 'web' && styles.inputWeb,
          ]}
          placeholder="Posez votre question..."
          placeholderTextColor={themeColors.textSecondary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          blurOnSubmit={false}
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendDisabled]}
          onPress={() => send()}
          disabled={!canSend}
          accessibilityLabel="Envoyer"
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320 },
  messages: { flex: 1 },
  messagesContent: { paddingVertical: spacing.sm, paddingBottom: spacing.md },
  typingRow: { paddingHorizontal: spacing.xs, marginTop: 4 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderRadius: 14,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    minHeight: 44,
  },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: '#9DB8A0' },
});

export default AIChatPanel;
