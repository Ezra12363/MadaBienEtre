// src/components/chat/ChatStatusLabel.js
// « Envoi… » / « Envoyé » / « Lu » / « Échec » à côté de l'heure de MES messages.
// Couleurs tirées de la palette du chat (clair / sombre, web + mobile).
import { Text } from 'react-native';

import { getStatusLabel } from '../../utils/chatUi';

const ChatStatusLabel = ({ status, palette, color }) => {
  const label = getStatusLabel(status);
  if (!label) return null;

  const tint =
    status === 'failed'
      ? palette?.danger || '#E53935'
      : status === 'read'
      ? palette?.metaRead || '#2E7D32'
      : color || palette?.meta || '#757575';

  return (
    <Text
      style={{
        fontSize: 11,
        marginLeft: 4,
        color: tint,
        fontWeight: status === 'read' ? '700' : '400',
      }}
      accessibilityLabel={`Statut du message : ${label}`}
    >
      {label}
    </Text>
  );
};

export default ChatStatusLabel;
