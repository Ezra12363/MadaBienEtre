// src/components/payment/FilterBar.js
//
// Barre de filtres réutilisable (pages paiements thérapeute + admin) :
//   recherche texte  +  puces Statut / Mode / Période, repliable, avec compteur de résultats.
//   value = { q, status, method, range }   (« all » = aucun filtre)
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#1F6B45';

export const RANGE_OPTIONS = [
  { id: 'all', label: 'Tout' },
  { id: 'today', label: "Aujourd’hui" },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
];

export const EMPTY_FILTERS = { q: '', status: 'all', method: 'all', range: 'all' };

export const activeFilterCount = (f) =>
  (f.q ? 1 : 0) + (f.status !== 'all' ? 1 : 0) + (f.method !== 'all' ? 1 : 0) + (f.range !== 'all' ? 1 : 0);

function Chips({ options, value, onChange, tc }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            activeOpacity={0.8}
            style={[styles.chip, { borderColor: on ? GREEN : tc.border, backgroundColor: on ? GREEN : 'transparent' }]}
          >
            <Text style={[styles.chipText, { color: on ? '#fff' : tc.textSecondary }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/**
 * @param {{ value: object, onChange: (v: object) => void, statusOptions?: Array, methodOptions?: Array,
 *           showRange?: boolean, placeholder?: string, total?: number, shown?: number, theme?: object }} props
 */
export default function FilterBar({ value, onChange, statusOptions, methodOptions, showRange = true, placeholder = 'Rechercher…', total, shown, theme = {} }) {
  const tc = { text: '#222', textSecondary: '#777', border: '#E5E7EB', surface: '#fff', ...theme };
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });
  const count = activeFilterCount(value);

  return (
    <View style={[styles.wrap, { backgroundColor: tc.surface, borderColor: tc.border }]}>
      <View style={styles.top}>
        <View style={[styles.search, { borderColor: tc.border }]}>
          <Ionicons name="search-outline" size={16} color={tc.textSecondary} />
          <TextInput
            style={[styles.input, { color: tc.text }]}
            value={value.q}
            onChangeText={(q) => set({ q })}
            placeholder={placeholder}
            placeholderTextColor={tc.placeholder || '#9CA3AF'}
            autoCapitalize="none"
          />
          {value.q ? (
            <TouchableOpacity onPress={() => set({ q: '' })} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={tc.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setOpen((v) => !v)} style={[styles.filterBtn, { borderColor: count ? GREEN : tc.border }]} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={18} color={count ? GREEN : tc.textSecondary} />
          <Text style={[styles.filterText, { color: count ? GREEN : tc.textSecondary }]}>Filtres{count ? ` · ${count}` : ''}</Text>
        </TouchableOpacity>
      </View>

      {open ? (
        <View style={styles.panel}>
          {statusOptions?.length ? (
            <>
              <Text style={[styles.cap, { color: tc.textSecondary }]}>Statut</Text>
              <Chips options={statusOptions} value={value.status} onChange={(status) => set({ status })} tc={tc} />
            </>
          ) : null}
          {methodOptions?.length ? (
            <>
              <Text style={[styles.cap, { color: tc.textSecondary }]}>Mode de paiement</Text>
              <Chips options={methodOptions} value={value.method} onChange={(method) => set({ method })} tc={tc} />
            </>
          ) : null}
          {showRange ? (
            <>
              <Text style={[styles.cap, { color: tc.textSecondary }]}>Période (heure de Madagascar)</Text>
              <Chips options={RANGE_OPTIONS} value={value.range} onChange={(range) => set({ range })} tc={tc} />
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.foot}>
        <Text style={[styles.count, { color: tc.textSecondary }]}>
          {shown !== undefined && total !== undefined ? `${shown} résultat${shown > 1 ? 's' : ''} sur ${total}` : ''}
        </Text>
        {count ? (
          <TouchableOpacity onPress={() => onChange(EMPTY_FILTERS)}>
            <Text style={styles.reset}>Réinitialiser</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  top: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 40 },
  input: { flex: 1, fontSize: 14, fontWeight: '400', paddingVertical: 0 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  filterText: { fontSize: 13, fontWeight: '400' },
  panel: { gap: 6 },
  cap: { fontSize: 11, fontWeight: '400', marginTop: 4 },
  chips: { gap: 6, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '400' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 11, fontWeight: '400' },
  reset: { color: GREEN, fontSize: 12, fontWeight: '400' },
});
