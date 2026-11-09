// Lecteur de message vocal (expo-audio) : lecture / pause + progression.
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

// expo-audio est facultatif au chargement : sans lui, l'application démarre quand même.
let ExpoAudio = null;
try {
  // eslint-disable-next-line global-require
  ExpoAudio = require('expo-audio');
} catch (_e) {
  ExpoAudio = null;
}

const fmt = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const AudioPlayerInner = ({ uri, duration, color, trackColor }) => {
  const player = ExpoAudio.useAudioPlayer(uri ? { uri } : null);
  const status = ExpoAudio.useAudioPlayerStatus(player);
  const total = status.duration || duration || 0;
  const ratio = total ? Math.min(1, (status.currentTime || 0) / total) : 0;

  const toggle = () => {
    try {
      if (status.playing) player.pause();
      else {
        if (total && status.currentTime >= total - 0.2) player.seekTo(0);
        player.play();
      }
    } catch (_e) { /* lecture impossible */ }
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={toggle} accessibilityLabel={status.playing ? 'Pause' : 'Lire'}>
        <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={38} color={color} />
      </TouchableOpacity>
      <View style={styles.mid}>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.time, { color }]}>
          {status.playing || status.currentTime ? fmt(status.currentTime) : fmt(total)}
        </Text>
      </View>
    </View>
  );
};

// Sans expo-audio : le vocal reste écoutable en l'ouvrant dans le lecteur du téléphone / du navigateur.
const AudioFallback = ({ uri, duration, color }) => (
  <TouchableOpacity style={styles.row} onPress={() => uri && Linking.openURL(uri)} accessibilityLabel="Écouter le message vocal">
    <Ionicons name="play-circle" size={38} color={color} />
    <View style={styles.mid}>
      <Text style={{ color, fontWeight: '600' }}>Message vocal</Text>
      <Text style={[styles.time, { color }]}>{fmt(duration || 0)} · Toucher pour écouter</Text>
    </View>
  </TouchableOpacity>
);

const AudioBubble = (props) => (ExpoAudio ? <AudioPlayerInner {...props} /> : <AudioFallback {...props} />);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 190 },
  mid: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  time: { fontSize: 11, marginTop: 4 },
});

export default AudioBubble;
