// src/components/common/PhoneInput.js
// ============================================================
// Champ téléphone international avec masque de saisie.
//
//   [ 🇲🇬 +261 ▾ ] 34 12 345 67
//
// - Madagascar par défaut ; tous les pays sont disponibles (liste avec
//   recherche, drapeaux).
// - Masque automatique : « 0341234567 » -> « 34 12 345 67 ».
// - Coller « +33 6 12 34 56 78 » change automatiquement le pays.
// - La valeur échangée avec le parent est toujours en E.164 :
//   « +261341234567 » (chaîne vide si rien n'est saisi).
//
// Utilisation :
//   <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })}
//               error={errors.phone} variant="auth" isDark={isDark} />
//   <PhoneInput value={form.phone} onChange={...} variant="admin" themeColors={themeColors} />
//
// La liste des pays s'ouvre EN LIGNE (pas de Modal imbriquée) : le composant
// fonctionne donc aussi à l'intérieur d'une Modal (formulaires admin).
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, DEFAULT_COUNTRY_ISO, getCountry } from '../../constants/countries';
import {
  buildE164,
  formatNational,
  getNationalLimits,
  getPlaceholder,
  parseStoredPhone,
  stripTrunkZero,
} from '../../utils/phone';

const GREEN = '#2E8B57';
const IS_WEB = Platform.OS === 'web';

/* ------------------------------------------------------------
   Drapeau : image (les emojis drapeaux ne s'affichent pas sous Windows)
------------------------------------------------------------ */
const Flag = ({ iso, size = 22 }) => {
  const [failed, setFailed] = useState(false);
  const code = String(iso || '').toLowerCase();

  if (failed || !code || code === 'xk') {
    return (
      <View style={[styles.flagFallback, { width: size, height: size * 0.72 }]}>
        <Text style={styles.flagFallbackText}>{String(iso || '').toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
      style={{ width: size, height: size * 0.72, borderRadius: 3 }}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
};

const PhoneInput = ({
  value,
  onChange,
  onBlur,
  onFocus,
  error,
  disabled = false,
  isDark = false,
  variant = 'auth', // 'auth' (écrans de connexion/inscription) | 'admin' (formulaires admin)
  themeColors,
  inputRef,
  returnKeyType = 'next',
  onSubmitEditing,
  testID,
}) => {
  const parsed = useMemo(() => parseStoredPhone(value), [value]);

  const [iso, setIso] = useState(parsed?.country?.iso || DEFAULT_COUNTRY_ISO);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const lastEmitted = useRef(value || '');

  const country = getCountry(iso) || getCountry(DEFAULT_COUNTRY_ISO);

  // Valeur modifiée depuis l'extérieur (chargement d'un utilisateur, reset du formulaire…)
  useEffect(() => {
    if ((value || '') === lastEmitted.current) return;
    lastEmitted.current = value || '';
    if (parsed?.country) setIso(parsed.country.iso);
    else if (!value) setIso(DEFAULT_COUNTRY_ISO); // formulaire réinitialisé : retour à Madagascar
  }, [value, parsed]);

  // Chiffres du numéro national, lus avec l'indicatif du pays CHOISI (et non re-devinés) :
  // évite qu'un indicatif plus long (ex. +1 809… = Rép. dominicaine) vide le champ.
  const national = useMemo(() => {
    const v = String(value || '').trim();
    const digits = v.replace(/\D/g, '');
    if (v.startsWith('+') && digits.startsWith(country.dial)) {
      return digits.slice(country.dial.length);
    }
    if (parsed && parsed.country.dial === country.dial) return parsed.national; // ancien format 034…
    return '';
  }, [value, parsed, country.dial]);

  const display = formatNational(national, country);
  const { max } = getNationalLimits(country);

  const emit = (nextCountry, nextNational) => {
    const e164 = buildE164(nextCountry, nextNational);
    lastEmitted.current = e164;
    onChange?.(e164);
  };

  const handleChangeText = (text) => {
    const raw = String(text || '');

    // Numéro collé avec indicatif (« +33 6… » ou « 0033 6… ») -> bascule de pays
    if (raw.trim().startsWith('+') || raw.trim().startsWith('00')) {
      const asIntl = raw.trim().startsWith('00') ? `+${raw.trim().slice(2)}` : raw.trim();
      const found = parseStoredPhone(asIntl);
      if (found?.country) {
        setIso(found.country.iso);
        const lim = getNationalLimits(found.country);
        emit(found.country, found.national.slice(0, lim.max));
        return;
      }
    }

    let digits = raw.replace(/\D/g, '');
    digits = stripTrunkZero(digits, country).slice(0, max);
    emit(country, digits);
  };

  const selectCountry = (c) => {
    setIso(c.iso);
    setOpen(false);
    setQuery('');
    // On garde les chiffres déjà saisis (tronqués si le nouveau pays est plus court)
    const lim = getNationalLimits(c);
    emit(c, national.slice(0, lim.max));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase() === q ||
        c.dial.startsWith(q)
    );
  }, [query]);

  /* ---------------- styles selon le contexte ---------------- */
  const isAuth = variant === 'auth';
  const textColor = isAuth
    ? isDark ? '#FFFFFF' : '#17201A'
    : themeColors?.text || (isDark ? '#FFFFFF' : '#1F2937');
  const mutedColor = isAuth
    ? isDark ? '#6B7280' : '#9CA3AF'
    : themeColors?.textSecondary || '#9CA3AF';
  const borderColor = error
    ? '#EF4444'
    : isAuth
    ? isDark ? '#3A3A4B' : '#E1E9E2'
    : themeColors?.border || '#E0E0E0';
  const backgroundColor = isAuth
    ? isDark ? '#252535' : '#FFFFFF'
    : themeColors?.card || themeColors?.surface || (isDark ? '#1E1E2D' : '#FFFFFF');
  const panelBg = isDark ? '#1E1E2D' : '#FFFFFF';

  return (
    <View style={styles.root} testID={testID}>
      <View
        style={[
          styles.row,
          isAuth ? styles.rowAuth : styles.rowAdmin,
          { borderColor, backgroundColor, opacity: disabled ? 0.6 : 1 },
        ]}
      >
        <TouchableOpacity
          style={styles.countryBtn}
          onPress={() => !disabled && setOpen((o) => !o)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Pays : ${country.name}, indicatif +${country.dial}`}
        >
          <Flag iso={country.iso} />
          <Text style={[styles.dial, { color: textColor }]}>+{country.dial}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={mutedColor} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: borderColor }]} />

        <TextInput
          ref={inputRef}
          style={[styles.input, { color: textColor }, IS_WEB && styles.inputWeb]}
          value={display}
          onChangeText={handleChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={getPlaceholder(country)}
          placeholderTextColor={mutedColor}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          autoCorrect={false}
          spellCheck={false}
          editable={!disabled}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={GREEN}
          underlineColorAndroid="transparent"
          maxLength={32}
        />
      </View>

      {open ? (
        <View style={[styles.panel, { backgroundColor: panelBg, borderColor: isDark ? '#3A3A4B' : '#E1E9E2' }]}>
          <View style={[styles.searchRow, { borderColor: isDark ? '#3A3A4B' : '#E1E9E2' }]}>
            <Ionicons name="search-outline" size={16} color={mutedColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }, IS_WEB && styles.inputWeb]}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un pays ou un indicatif"
              placeholderTextColor={mutedColor}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <ScrollView
            style={styles.list}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {filtered.length === 0 ? (
              <Text style={[styles.empty, { color: mutedColor }]}>Aucun pays trouvé</Text>
            ) : (
              filtered.map((c) => {
                const active = c.iso === country.iso;
                return (
                  <TouchableOpacity
                    key={c.iso}
                    style={[styles.item, active && { backgroundColor: isDark ? '#2A3A2E' : '#EAF5EC' }]}
                    onPress={() => selectCountry(c)}
                    activeOpacity={0.7}
                  >
                    <Flag iso={c.iso} size={22} />
                    <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[styles.itemDial, { color: mutedColor }]}>+{c.dial}</Text>
                    {active ? <Ionicons name="checkmark" size={16} color={GREEN} /> : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: '100%' },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  rowAuth: { minHeight: 51, borderRadius: 12, paddingHorizontal: 8 },
  rowAdmin: { minHeight: 44, borderRadius: 10, paddingHorizontal: 8 },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  dial: { fontSize: 14, fontWeight: '600' },
  divider: { width: 1, height: 22, marginHorizontal: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingHorizontal: 6,
    paddingVertical: 8,
    minHeight: 40,
    letterSpacing: 0.4,
  },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0 },
  panel: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  searchInput: { flex: 1, minHeight: 42, fontSize: 14 },
  list: { maxHeight: 240 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemName: { flex: 1, fontSize: 14 },
  itemDial: { fontSize: 13 },
  empty: { padding: 16, textAlign: 'center', fontSize: 13 },
  flagFallback: {
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagFallbackText: { fontSize: 8, fontWeight: '700', color: '#374151' },
});

export default PhoneInput;
