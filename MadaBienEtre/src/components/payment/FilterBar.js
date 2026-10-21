// src/components/payment/FilterBar.js
//
// Barre de filtrage commune (thérapeute et admin) : recherche texte + statut + mode
// de paiement + période. Les filtres se combinent ; « Réinitialiser » les remet à zéro.
//   const [f, setF] = useState(EMPTY_FILTER);
//   <FilterBar value={f} onChange={setF} statuses={[['pending','En attente'],...]} methods={[...]} />
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';

const GREEN = '#1F6B45';

export const EMPTY_FILTER = { q: '', status: 'all', method: 'all', period: 'all' };

export const PERIODS = [
  ['all', 'Tout'],
  ['today', 'Aujourd’hui'],
  ['7d', '7 jours'],
  ['30d', '30 jours'],
  ['year', '12 mois'],
];

export const isFiltered = (f) => f.q.trim() !== '' || f.status !== 'all' || f.method !== 'all' || f.period !== 'all';

function Chips({ options, value, onPick, theme }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map(([id, label]) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => onPick(id)}
            style={[styles.chip, { borderColor: active ? GREEN : theme.border || '#D1D5DB' }, active && { backgroundColor: GREEN }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, { color: active ? '#fff' : theme.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function FilterBar({ value, onChange, statuses, methods, placeholder = 'Rechercher (nom, référence, montant…)', count }) {
  const { colors: theme } = useTheme();
  const set = (patch) => onChange({ ...value, ...patch });
  const active = isFiltered(value);
  return (
    <View style={styles.wrap}>
      <View style={[styles.search, { borderColor: theme.border || '#D1D5DB', backgroundColor: theme.surface }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value.q}
          onChangeText={(q) => set({ q })}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          autoCapitalize="none"
        />
        {value.q ? (
          <TouchableOpacity onPress={() => set({ q: '' })}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {statuses ? <Chips options={[['all', 'Tous statuts'], ...statuses]} value={value.status} onPick={(status) => set({ status })} theme={theme} /> : null}
      {methods ? <Chips options={[['all', 'Tous modes'], ...methods]} value={value.method} onPick={(method) => set({ method })} theme={theme} /> : null}
      <Chips options={PERIODS} value={value.period} onPick={(period) => set({ period })} theme={theme} />
      <View style={styles.foot}>
        {typeof count === 'number' ? <Text style={[styles.count, { color: theme.textSecondary }]}>{count} résultat{count > 1 ? 's' : ''}</Text> : <View />}
        {active ? (
          <TouchableOpacity onPress={() => onChange(EMPTY_FILTER)}>
            <Text style={[styles.reset, { color: GREEN }]}>Réinitialiser les filtres</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, fontWeight: '400' },
  chips: { gap: 6, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '400' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 12, fontWeight: '400' },
  reset: { fontSize: 12, fontWeight: '400' },
});
