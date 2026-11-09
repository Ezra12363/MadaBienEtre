// Panneau emojis + stickers (animés ou statiques, favoris et récents).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import messengerService from '../../services/messengerService';
import { EMOJI_CATEGORIES } from './emojiData';

const Sticker = ({ item, animated, size = 56 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, scale]);
  return (
    <Animated.Text style={{ fontSize: size, transform: [{ scale }] }}>{item.emoji}</Animated.Text>
  );
};
export { Sticker };

const EmojiStickerPanel = ({ palette, onEmoji, onSticker }) => {
  const [tab, setTab] = useState('emoji'); // emoji | stickers
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].key);
  const [data, setData] = useState({ packs: [], favorites: [], recents: [] });
  const [pack, setPack] = useState('recents');

  const load = useCallback(async () => {
    const res = await messengerService.stickers();
    if (res.success) setData(res.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const index = {};
  data.packs.forEach((p) => p.items.forEach((s) => { index[s.id] = s; }));
  const listFor = (key) => {
    if (key === 'recents') return data.recents.map((i) => index[i]).filter(Boolean);
    if (key === 'favorites') return data.favorites.map((i) => index[i]).filter(Boolean);
    return data.packs.find((p) => p.id === key)?.items || [];
  };
  const tabs = [
    { key: 'recents', label: '🕘 Récents' },
    { key: 'favorites', label: '⭐ Favoris' },
    ...data.packs.map((p) => ({ key: p.id, label: p.name })),
  ];

  const toggleFavorite = async (s) => {
    const isFav = data.favorites.includes(s.id);
    await messengerService.favoriteSticker(s.id, !isFav);
    setData((d) => ({ ...d, favorites: isFav ? d.favorites.filter((x) => x !== s.id) : [s.id, ...d.favorites] }));
  };

  const cur = EMOJI_CATEGORIES.find((c) => c.key === cat) || EMOJI_CATEGORIES[0];

  return (
    <View style={[styles.wrap, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
      <View style={styles.tabs}>
        {['emoji', 'stickers'].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { borderBottomColor: palette.primary }]}>
            <Text style={{ color: tab === t ? palette.primary : palette.textSecondary, fontWeight: '600' }}>
              {t === 'emoji' ? 'Emojis' : 'Stickers'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'emoji' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats}>
            {EMOJI_CATEGORIES.map((c) => (
              <TouchableOpacity key={c.key} onPress={() => setCat(c.key)} style={[styles.cat, cat === c.key && { backgroundColor: palette.primarySoft }]}>
                <Text style={{ fontSize: 22 }}>{c.icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FlatList
            key="emoji" data={cur.emojis} numColumns={8} keyExtractor={(e, i) => `${e}${i}`} style={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.emojiCell} onPress={() => onEmoji(item)}>
                <Text style={{ fontSize: 26 }}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats}>
            {tabs.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setPack(t.key)} style={[styles.packTab, pack === t.key && { backgroundColor: palette.primarySoft }]}>
                <Text style={{ color: palette.text, fontSize: 13 }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FlatList
            key="stickers" data={listFor(pack)} numColumns={4} keyExtractor={(s) => s.id} style={styles.grid}
            ListEmptyComponent={<Text style={[styles.empty, { color: palette.textSecondary }]}>Aucun sticker ici pour le moment.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.stickerCell}
                onPress={() => onSticker(item)}
                onLongPress={() => toggleFavorite(item)}
                accessibilityLabel={`Sticker ${item.label}. Appui long : favori`}
              >
                <Sticker item={item} animated={item.animated} />
                {data.favorites.includes(item.id) && <Text style={styles.star}>⭐</Text>}
              </TouchableOpacity>
            )}
          />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>Appui long sur un sticker = favori</Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { height: 300, borderTopWidth: StyleSheet.hairlineWidth },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  cats: { maxHeight: 48, paddingHorizontal: 8 },
  cat: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginVertical: 4 },
  packTab: { paddingHorizontal: 12, height: 34, justifyContent: 'center', borderRadius: 17, marginVertical: 7, marginRight: 6 },
  grid: { flex: 1, paddingHorizontal: 8 },
  emojiCell: { flex: 1 / 8, alignItems: 'center', paddingVertical: 6 },
  stickerCell: { flex: 1 / 4, alignItems: 'center', paddingVertical: 8 },
  star: { position: 'absolute', top: 2, right: 8, fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 30 },
  hint: { textAlign: 'center', fontSize: 11, paddingBottom: 6 },
});

export default EmojiStickerPanel;
