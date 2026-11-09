// Barre d'enregistrement d'un message vocal (expo-audio, web inclus).
// Démarre dès l'affichage ; ✕ annule, ➤ envoie.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

let ExpoAudio = null;
try {
  // eslint-disable-next-line global-require
  ExpoAudio = require('expo-audio');
} catch (_e) {
  ExpoAudio = null;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const MAX_SECONDS = 300;

const VoiceRecorderInner = ({ palette, onCancel, onDone, onError }) => {
  const { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } = ExpoAudio;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [seconds, setSeconds] = useState(0);
  const startedRef = useRef(false);
  const secondsRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    let timer;
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          onError?.("L'accès au microphone est refusé.");
          onCancel();
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        startedRef.current = true;
        timer = setInterval(() => {
          secondsRef.current += 1;
          setSeconds(secondsRef.current);
          if (secondsRef.current >= MAX_SECONDS) finish(true);
        }, 1000);
      } catch (_e) {
        onError?.("Enregistrement impossible sur cet appareil.");
        onCancel();
      }
    })();
    return () => {
      clearInterval(timer);
      if (startedRef.current && !finishedRef.current) {
        try { recorder.stop(); } catch (_e) { /* noop */ }
      }
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (send) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      await recorder.stop();
    } catch (_e) { /* noop */ }
    if (!send || secondsRef.current < 1 || !recorder.uri) {
      onCancel();
      return;
    }
    onDone({ uri: recorder.uri, name: 'vocal.m4a', mimeType: 'audio/mp4', duration: secondsRef.current });
  };

  return (
    <View style={[styles.bar, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
      <TouchableOpacity onPress={() => finish(false)} accessibilityLabel="Annuler">
        <Ionicons name="trash-outline" size={24} color={palette.danger} />
      </TouchableOpacity>
      <View style={styles.dot} />
      <Text style={{ color: palette.text, flex: 1 }}>Enregistrement… {fmt(seconds)}</Text>
      <TouchableOpacity onPress={() => finish(true)} style={[styles.send, { backgroundColor: palette.primary }]} accessibilityLabel="Envoyer le message vocal">
        <Ionicons name="send" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const VoiceRecorderBar = (props) => {
  useEffect(() => {
    if (!ExpoAudio) {
      props.onError?.("Messages vocaux indisponibles : installez expo-audio.");
      props.onCancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ExpoAudio ? <VoiceRecorderInner {...props} /> : null;
};

const styles = StyleSheet.create({
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, height: 46 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E53935' },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

export default VoiceRecorderBar;
