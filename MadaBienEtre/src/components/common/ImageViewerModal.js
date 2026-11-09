// src/components/common/ImageViewerModal.js
//
// Visionneuse plein écran « façon Facebook » — Web, Android et iOS.
//
//   • <ImageViewerModal visible images index onClose />   : la visionneuse seule
//   • <ViewableImage uri images index title style>…</ViewableImage>
//         : enveloppe n'importe quelle photo / avatar ; un appui ouvre la
//           visionneuse (le parent — carte, ligne cliquable — n'est PAS déclenché).
//
// Gestes :
//   Android / iOS : pincer pour zoomer, glisser pour déplacer, double appui = zoom.
//   Web           : molette = zoom, glisser (zoom > 1), double clic, boutons + / − / ↺,
//                   flèches ← → entre les images, Échap pour fermer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { normalizeMediaUrl } from '../../utils/mediaUrl';

const IS_WEB = Platform.OS === 'web';
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

const toItem = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') return { uri: normalizeMediaUrl(entry) };
  if (typeof entry === 'object' && entry.uri) {
    return { ...entry, uri: normalizeMediaUrl(entry.uri) };
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Image zoomable                                                      */
/* ------------------------------------------------------------------ */
const ZoomableImage = ({ uri, zoomRequest }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const boxRef = useRef(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const boxW = useSharedValue(0);
  const boxH = useSharedValue(0);

  const reset = useCallback(() => {
    scale.value = withTiming(1, { duration: 160 });
    savedScale.value = 1;
    tx.value = withTiming(0, { duration: 160 });
    ty.value = withTiming(0, { duration: 160 });
    savedTx.value = 0;
    savedTy.value = 0;
  }, [scale, savedScale, tx, ty, savedTx, savedTy]);

  // nouvelle image => on repart de zéro
  useEffect(() => {
    setStatus('loading');
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [uri, scale, savedScale, tx, ty, savedTx, savedTy]);

  // boutons + / − / reset (web)
  useEffect(() => {
    if (!zoomRequest) return;
    if (zoomRequest.type === 'reset') {
      reset();
      return;
    }
    const next = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, scale.value + (zoomRequest.type === 'in' ? 0.75 : -0.75))
    );
    scale.value = withTiming(next, { duration: 140 });
    savedScale.value = next;
    if (next === 1) {
      tx.value = withTiming(0, { duration: 140 });
      ty.value = withTiming(0, { duration: 140 });
      savedTx.value = 0;
      savedTy.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRequest]);

  // molette de la souris (web)
  useEffect(() => {
    if (!IS_WEB) return undefined;
    const node = boxRef.current;
    if (!node || typeof node.addEventListener !== 'function') return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, scale.value * (event.deltaY < 0 ? 1.15 : 1 / 1.15))
      );
      scale.value = next;
      savedScale.value = next;
      if (next === 1) {
        tx.value = 0;
        ty.value = 0;
        savedTx.value = 0;
        savedTy.value = 0;
      }
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [scale, savedScale, tx, ty, savedTx, savedTy]);

  const gesture = useMemo(() => {
    const clampPan = (value, axisSize, currentScale) => {
      'worklet';
      const max = Math.max(0, ((currentScale - 1) * axisSize) / 2);
      return Math.min(max, Math.max(-max, value));
    };

    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
      })
      .onEnd(() => {
        savedScale.value = scale.value;
        if (scale.value <= 1.01) {
          scale.value = withTiming(1);
          tx.value = withTiming(0);
          ty.value = withTiming(0);
          savedScale.value = 1;
          savedTx.value = 0;
          savedTy.value = 0;
        }
      });

    const pan = Gesture.Pan()
      .minPointers(1)
      .maxPointers(2)
      .onUpdate((e) => {
        if (scale.value <= 1) return;
        tx.value = clampPan(savedTx.value + e.translationX, boxW.value, scale.value);
        ty.value = clampPan(savedTy.value + e.translationY, boxH.value, scale.value);
      })
      .onEnd(() => {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        if (scale.value > 1.01) {
          scale.value = withTiming(1);
          tx.value = withTiming(0);
          ty.value = withTiming(0);
          savedScale.value = 1;
          savedTx.value = 0;
          savedTy.value = 0;
        } else {
          scale.value = withTiming(DOUBLE_TAP_SCALE);
          savedScale.value = DOUBLE_TAP_SCALE;
        }
      });

    return Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [scale, savedScale, tx, ty, savedTx, savedTy, boxW, boxH]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      ref={boxRef}
      style={styles.zoomBox}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
        boxW.value = width;
        boxH.value = height;
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.zoomInner, animatedStyle]}>
          {size.width > 0 ? (
            <Image
              source={{ uri }}
              style={{ width: size.width, height: size.height }}
              resizeMode="contain"
              onLoad={() => setStatus('ready')}
              onError={() => setStatus('error')}
              // l'image ne doit pas être « attrapée » par le navigateur lors du glisser
              {...(IS_WEB ? { draggable: false } : null)}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>

      {status === 'loading' ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <Ionicons name="image-outline" size={46} color="rgba(255,255,255,0.7)" />
          <Text style={styles.errorText}>Impossible d’afficher cette image.</Text>
        </View>
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/* Visionneuse                                                         */
/* ------------------------------------------------------------------ */
export const ImageViewerModal = ({ visible, images, index = 0, title, onClose }) => {
  const items = useMemo(
    () => (Array.isArray(images) ? images : [images]).map(toItem).filter(Boolean),
    [images]
  );

  const [current, setCurrent] = useState(index);
  const [zoomRequest, setZoomRequest] = useState(null);

  useEffect(() => {
    if (visible) {
      setCurrent(Math.min(Math.max(index, 0), Math.max(items.length - 1, 0)));
      setZoomRequest(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index]);

  const goPrev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setCurrent((i) => Math.min(items.length - 1, i + 1)),
    [items.length]
  );

  // clavier (web)
  useEffect(() => {
    if (!IS_WEB || !visible || typeof document === 'undefined') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === '+' || e.key === '=') setZoomRequest({ type: 'in', at: Date.now() });
      else if (e.key === '-') setZoomRequest({ type: 'out', at: Date.now() });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose, goPrev, goNext]);

  const item = items[current];
  const multiple = items.length > 1;
  const caption = item?.title || title;

  if (!visible || !item) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView
        style={styles.root}
        // empêche l'appui de « remonter » vers une carte cliquable parente (React portal)
        onStartShouldSetResponder={() => true}
      >
        <ZoomableImage key={item.uri} uri={item.uri} zoomRequest={zoomRequest} />

        {/* Barre du haut */}
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.captionWrap} pointerEvents="none">
            {caption ? (
              <Text style={styles.caption} numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
            {multiple ? (
              <Text style={styles.counter}>
                {current + 1} / {items.length}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={onClose}
            style={styles.roundButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Fermer l'image"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Précédent / suivant */}
        {multiple && current > 0 ? (
          <Pressable
            onPress={goPrev}
            style={[styles.navButton, styles.navLeft]}
            accessibilityLabel="Image précédente"
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
        ) : null}
        {multiple && current < items.length - 1 ? (
          <Pressable
            onPress={goNext}
            style={[styles.navButton, styles.navRight]}
            accessibilityLabel="Image suivante"
          >
            <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {/* Boutons de zoom (web : pas de pincement) */}
        {IS_WEB ? (
          <View style={styles.zoomBar} pointerEvents="box-none">
            <Pressable
              style={styles.roundButton}
              onPress={() => setZoomRequest({ type: 'out', at: Date.now() })}
              accessibilityLabel="Dézoomer"
            >
              <Ionicons name="remove" size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={styles.roundButton}
              onPress={() => setZoomRequest({ type: 'reset', at: Date.now() })}
              accessibilityLabel="Taille d'origine"
            >
              <Ionicons name="contract-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={styles.roundButton}
              onPress={() => setZoomRequest({ type: 'in', at: Date.now() })}
              accessibilityLabel="Zoomer"
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Enveloppe : appui sur une photo => visionneuse                      */
/* ------------------------------------------------------------------ */
export const ViewableImage = ({
  uri,
  images,
  index = 0,
  title,
  disabled = false,
  style,
  children,
  onOpen,
  accessibilityLabel,
}) => {
  const [visible, setVisible] = useState(false);

  const gallery = images && images.length ? images : uri ? [uri] : [];
  const canOpen = !disabled && gallery.length > 0;

  const open = (event) => {
    event?.stopPropagation?.();
    setVisible(true);
    onOpen?.();
  };

  if (!canOpen) {
    return <View style={style}>{children}</View>;
  }

  return (
    <>
      <Pressable
        onPress={open}
        style={[style, IS_WEB ? styles.zoomCursor : null]}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel || 'Agrandir la photo'}
      >
        {children}
      </Pressable>

      <ImageViewerModal
        visible={visible}
        images={gallery}
        index={index}
        title={title}
        onClose={() => setVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  zoomBox: {
    flex: 1,
    overflow: 'hidden',
  },
  zoomInner: {
    flex: 1,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 38 : 20,
    paddingBottom: 10,
  },
  captionWrap: {
    flex: 1,
    paddingRight: 12,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  counter: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  navLeft: { left: 12 },
  navRight: { right: 12 },
  zoomBar: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  zoomCursor: Platform.select({ web: { cursor: 'zoom-in' }, default: {} }),
});

export default ImageViewerModal;
