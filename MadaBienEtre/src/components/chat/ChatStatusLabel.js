// src/components/chat/ChatStatusLabel.js
// « Envoi… » / « Envoyé » / « Lu » / « Échec » sous les messages envoyés.
import { Text } from 'react-native';

const LABELS = {
  sending: 'Envoi…',
  delivered: 'Envoyé',
  sent: 'Envoyé',
  read: 'Lu',
  failed: 'Échec',
};

const ChatStatusLabel = ({ status, color = 'rgba(255,255,255,0.78)' }) => {
  const label = LABELS[status];
  if (!label) return null;

  return (
    <Text
      style={{
        fontSize: 10,
        marginLeft: 6,
        color: status === 'failed' ? '#FECACA' : color,
        fontWeight: status === 'read' ? '700' : '400',
      }}
    >
      {label}
    </Text>
  );
};

export default ChatStatusLabel;
