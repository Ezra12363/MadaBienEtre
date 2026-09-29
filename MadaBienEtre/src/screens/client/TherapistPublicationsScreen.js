// src/screens/client/TherapistPublicationsScreen.js
// Plein écran "Publications des thérapeutes" — responsive web + mobile.
// Petit espace (≈ 2 mm) à gauche et à droite des publications.
//   • Mobile  (< 768 px)  : 1 colonne
//   • Tablette (≥ 768 px) : 2 colonnes
//   • Web large (≥ 1100)  : 3 colonnes

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useTopNavLayout } from '../../components/common/AppNavigation';
import Header from '../../components/common/Header';
import { colors, typography } from '../../theme';

import massageTypeService from '../../services/massageTypeService';
import therapistService from '../../services/therapistService';

import {
  TherapistPost,
  normalizeTherapistPost,
  getMassageCategoryLabel,
  getPostColumns,
} from './TherapistPost';

const IS_WEB = Platform.OS === 'web';

const PRIMARY = colors.primary || '#168A55';
const PRIMARY_DARK = '#0B633C';
const HEADER_GREEN = '#168A55';

// ≈ 2 mm : 8 px sur le web (96 dpi), 12 dp sur mobile (160 dpi)
const SIDE_GAP = IS_WEB ? 8 : 12;
const GAP = SIDE_GAP; // espace entre colonnes

const CATEGORY_ICONS = {
  relaxant: 'spa',
  therapeutique: 'bone',
  sportif: 'run',
  reflexologie: 'foot-print',
  prenatal: 'human-pregnant',
  personnalise: 'auto-fix',
};

const getColumns = getPostColumns;

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const TherapistPublicationsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { isMerged } = useTopNavLayout();

  const isLargeWeb = IS_WEB && isMerged;

  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get('window').width
  );
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | online | <category>

  /* ----------------------------- THEME ----------------------------- */

  const surface = themeColors.surface || (isDark ? '#181B22' : '#FFFFFF');
  const background =
    themeColors.background || (isDark ? '#101217' : '#F0F2F5');
  const text = themeColors.text || (isDark ? '#FFFFFF' : '#172019');
  const textSecondary =
    themeColors.textSecondary || (isDark ? '#A6ACB8' : '#737985');
  const border = themeColors.border || (isDark ? '#2A2E38' : '#E3EAE5');

  /* --------------------------- RESPONSIVE -------------------------- */

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const sub = Dimensions.addEventListener('change', onChange);
    return () => sub?.remove?.();
  }, []);

  const columns = getColumns(screenWidth);

  /* ------------------------------ DATA ----------------------------- */

  const load = useCallback(async () => {
    try {
      setError(null);

      // 1) Types de massage (pour associer chaque spécialité à son image)
      let massageTypes = [];
      try {
        const types = await massageTypeService.getActiveMassageTypes();
        massageTypes = (types || []).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          imageUrl: massageTypeService.getMassageImageUrl(
            item.image_url || item.icon_url
          ),
        }));
      } catch (e) {
        console.log('Types de massage indisponibles:', e);
      }

      // 2) Thérapeutes
      const response = await therapistService.getTherapists();

      if (!response?.success) {
        throw new Error(
          response?.error || 'Impossible de charger les thérapeutes'
        );
      }

      const payload = response.data;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.therapists)
          ? payload.therapists
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

      const normalized = rows
        .map((raw, index) =>
          normalizeTherapistPost(raw, index, massageTypes)
        )
        .sort(
          (a, b) =>
            Number(b.online) - Number(a.online) || b.rating - a.rating
        );

      setPosts(normalized);
    } catch (e) {
      console.error('Erreur chargement publications:', e);
      setError(e?.message || 'Une erreur est survenue');
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await load();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /* ----------------------------- FILTRES --------------------------- */

  const categories = useMemo(() => {
    const set = new Set();
    posts.forEach((p) => p.categories.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [posts]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());

    return posts.filter((p) => {
      if (filter === 'online' && !p.online) return false;
      if (
        filter !== 'all' &&
        filter !== 'online' &&
        !p.categories.includes(filter)
      ) {
        return false;
      }

      if (!q) return true;

      const haystack = normalize(
        [
          p.name,
          p.address,
          p.bio,
          p.specialties.map((s) => s.name).join(' '),
          p.categories.map(getMassageCategoryLabel).join(' '),
          p.skills.join(' '),
        ].join(' ')
      );

      return haystack.includes(q);
    });
  }, [posts, query, filter]);

  // Complète la dernière rangée avec des cases vides pour que toutes les
  // cartes gardent la même largeur (et la même hauteur par rangée)
  const listData = useMemo(() => {
    if (loading || error) return [];
    const missing = (columns - (filtered.length % columns)) % columns;
    const fillers = Array.from({ length: missing }).map((_, i) => ({
      id: `filler-${i}`,
      __filler: true,
    }));
    return [...filtered, ...fillers];
  }, [filtered, columns, loading, error]);

  /* ---------------------------- NAVIGATION ------------------------- */

  const goBack = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('HomeScreen');
  }, [navigation]);

  const openProfile = useCallback(
    (post) => navigation.navigate('SearchMassage', { therapistId: post.id }),
    [navigation]
  );

  const book = useCallback(
    (post) => {
      if (post.online) {
        navigation.navigate('BookingDetail', { therapist: post });
      }
    },
    [navigation]
  );

  /* ------------------------------ RENDER --------------------------- */

  const renderItem = useCallback(
    ({ item }) =>
      item.__filler ? (
        <View style={styles.cell} />
      ) : (
      <View style={styles.cell}>
        <TherapistPost
          post={item}
          isDark={isDark}
          surface={surface}
          border={border}
          text={text}
          textSecondary={textSecondary}
          onOpen={() => openProfile(item)}
          onBook={() => book(item)}
          fill
        />
      </View>
      ),
    [isDark, surface, border, text, textSecondary, openProfile, book]
  );

  const chips = [
    { id: 'all', label: 'Tous', icon: 'apps-outline', type: 'ion' },
    { id: 'online', label: 'En ligne', icon: 'radio-button-on', type: 'ion' },
    ...categories.map((c) => ({
      id: c,
      label: getMassageCategoryLabel(c),
      icon: CATEGORY_ICONS[c] || 'spa',
      type: 'mci',
    })),
  ];

  const headerBg = isLargeWeb ? '#FFFFFF' : HEADER_GREEN;
  const headerIcon = isLargeWeb ? HEADER_GREEN : '#FFFFFF';

  const ListHeader = (
    <View style={styles.toolbar}>
      {/* Recherche */}
      <View
        style={[
          styles.searchBox,
          { backgroundColor: surface, borderColor: border },
        ]}
      >
        <Ionicons name="search" size={18} color={textSecondary} />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un thérapeute, un massage, un quartier…"
          placeholderTextColor={textSecondary}
          style={[styles.searchInput, { color: text }]}
          returnKeyType="search"
        />

        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {chips.map((chip) => {
          const active = filter === chip.id;
          const IconCmp = chip.type === 'mci' ? MaterialCommunityIcons : Ionicons;

          return (
            <TouchableOpacity
              key={chip.id}
              activeOpacity={0.8}
              onPress={() => setFilter(chip.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? PRIMARY : surface,
                  borderColor: active ? PRIMARY : border,
                },
              ]}
            >
              <IconCmp
                name={chip.icon}
                size={14}
                color={active ? '#FFFFFF' : PRIMARY}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: active ? '#FFFFFF' : text },
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!loading && !error && (
        <Text style={[styles.count, { color: textSecondary }]}>
          {filtered.length} publication{filtered.length > 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );

  const Empty = loading ? (
    <View style={styles.stateBox}>
      <ActivityIndicator size="large" color={PRIMARY} />
      <Text style={[styles.stateText, { color: textSecondary }]}>
        Chargement des publications…
      </Text>
    </View>
  ) : error ? (
    <View style={styles.stateBox}>
      <Ionicons name="cloud-offline-outline" size={40} color={textSecondary} />
      <Text style={[styles.stateText, { color: textSecondary }]}>{error}</Text>
      <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
        <Ionicons name="refresh" size={16} color="#FFFFFF" />
        <Text style={styles.retryText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.stateBox}>
      <Ionicons name="people-outline" size={40} color={textSecondary} />
      <Text style={[styles.stateText, { color: textSecondary }]}>
        Aucune publication ne correspond à votre recherche
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <StatusBar
        barStyle={isLargeWeb ? 'dark-content' : 'light-content'}
        backgroundColor={isLargeWeb ? '#FFFFFF' : PRIMARY_DARK}
      />

      <Header
        title="Publications"
        subtitle="Profils, savoir-faire et soins proposés"
        leftComponent={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goBack}
            style={[
              styles.backBtn,
              {
                backgroundColor: isLargeWeb
                  ? 'rgba(22,138,85,0.10)'
                  : 'rgba(255,255,255,0.18)',
                borderColor: isLargeWeb
                  ? 'rgba(22,138,85,0.25)'
                  : 'rgba(255,255,255,0.35)',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={21} color={headerIcon} />
          </TouchableOpacity>
        }
        rightComponent={<View style={styles.backBtn} />}
      />

      <FlatList
        // la clé force le recalcul quand le nombre de colonnes change
        key={`cols-${columns}`}
        data={listData}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        numColumns={columns}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={Empty}
        columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={IS_WEB}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        initialNumToRender={4}
        windowSize={7}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingHorizontal: SIDE_GAP,
    paddingTop: 12,
    paddingBottom: 60,
    flexGrow: 1,
  },

  toolbar: { marginBottom: 6 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    ...(IS_WEB ? { outlineStyle: 'none' } : null),
  },

  chipsRow: { gap: 8, paddingVertical: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: typography.fontFamily.semiBold },

  count: {
    fontSize: 11,
    marginBottom: 8,
    fontFamily: typography.fontFamily.medium,
  },

  columnWrapper: {
    width: '100%',
    gap: GAP,
    alignItems: 'stretch',
  },
  cell: { flex: 1, minWidth: 0 },

  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  stateText: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default TherapistPublicationsScreen;