// src/components/common/MaskedField.js
// ============================================================================
// Champ de formulaire UNIQUE pour toute l'application (web + Android + iOS) :
//
//   - MASQUE DE SAISIE : `mask` nettoie / formate la valeur à chaque frappe
//     (voir utils/inputMasks.js : maskAmount, maskCin, maskDateFr …).
//   - VALIDATION       : `validate(value)` retourne '' (valide) ou un message.
//   - AFFICHAGE        : sous le champ
//         * invalide -> bordure ROUGE + message en texte ROUGE
//         * valide   -> bordure VERTE + coche + texte VERT
//     L'état n'apparaît qu'après la 1re sortie du champ (blur) ou après une
//     tentative d'envoi (`showErrors`), pour ne pas crier dès la 1re lettre.
//
//   <MaskedField
//      label="Montant (Ar)" value={amount} onChangeText={setAmount}
//      mask={maskAmount} validate={rules.amount({ min: 1000 })}
//      keyboardType="numeric" showErrors={submitted} />
//
//   <FormSummary errors={errors} show={submitted} />   // résumé sous le formulaire
// ============================================================================
import { forwardRef, memo, useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const FIELD_COLORS = {
  error: '#D32F2F',
  errorBg: '#FDECEA',
  success: '#2E8B57',
  successBg: '#E8F5E9',
  primary: '#2E8B57',
};

const MaskedField = forwardRef(function MaskedField(
  {
    label,
    value,
    onChangeText,
    mask,
    validate,
    error: externalError,
    showErrors = false,
    showSuccess = true,
    successText = 'Valide',
    required = false,
    helper,
    icon,
    prefix,
    suffix,
    placeholder,
    placeholderTextColor,
    multiline = false,
    numberOfLines,
    maxLength,
    keyboardType,
    secureTextEntry,
    autoCapitalize = 'none',
    autoCorrect = false,
    editable = true,
    returnKeyType,
    onSubmitEditing,
    onBlur,
    onFocus,
    isDark = false,
    style,
    inputStyle,
    labelStyle,
    textColor,
    surfaceColor,
    borderColor: baseBorder,
    testID,
    rightElement,
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);

  const str = value == null ? '' : String(value);

  const computedError = useMemo(() => {
    if (externalError) return typeof externalError === 'string' ? externalError : 'Champ invalide';
    if (typeof validate === 'function') {
      try { return validate(str) || ''; } catch (_e) { return ''; }
    }
    return '';
  }, [externalError, validate, str]);

  const visible = touched || showErrors;
  const hasError = visible && !!computedError;
  const hasSuccess = visible && showSuccess && !computedError && str.trim() !== '' && typeof validate === 'function';

  const handleChange = useCallback(
    (text) => {
      const next = typeof mask === 'function' ? mask(text) : text;
      if (onChangeText) onChangeText(next);
    },
    [mask, onChangeText]
  );

  const handleBlur = useCallback(
    (e) => {
      setFocused(false);
      setTouched(true);
      if (onBlur) onBlur(e);
    },
    [onBlur]
  );

  const handleFocus = useCallback(
    (e) => {
      setFocused(true);
      if (onFocus) onFocus(e);
    },
    [onFocus]
  );

  const text = textColor || (isDark ? '#FFFFFF' : '#1A1A1A');
  const neutralBorder = baseBorder || (isDark ? '#3A3A3A' : '#E0E0E0');
  const border = hasError
    ? FIELD_COLORS.error
    : hasSuccess
    ? FIELD_COLORS.success
    : focused
    ? FIELD_COLORS.primary
    : neutralBorder;

  return (
    <View style={[styles.group, style]}>
      {label ? (
        <Text
          style={[
            styles.label,
            { color: hasError ? FIELD_COLORS.error : isDark ? '#E6E6E6' : '#333' },
            labelStyle,
          ]}
        >
          {label}
          {required ? <Text style={{ color: FIELD_COLORS.error }}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.box,
          multiline && styles.boxMultiline,
          {
            borderColor: border,
            borderWidth: hasError || hasSuccess || focused ? 2 : 1.5,
            backgroundColor: surfaceColor || (isDark ? '#1E1E1E' : '#FFFFFF'),
            opacity: editable ? 1 : 0.6,
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={hasError ? FIELD_COLORS.error : hasSuccess ? FIELD_COLORS.success : focused ? FIELD_COLORS.primary : '#999'}
            style={styles.icon}
          />
        ) : null}
        {prefix ? <Text style={[styles.affix, { color: isDark ? '#BBB' : '#666' }]}>{prefix}</Text> : null}

        <TextInput
          ref={ref}
          testID={testID}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            { color: text },
            Platform.OS === 'web' ? styles.inputWeb : null,
            inputStyle,
          ]}
          value={str}
          onChangeText={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor || (isDark ? '#777' : '#9A9A9A')}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={FIELD_COLORS.primary}
          underlineColorAndroid="transparent"
        />

        {suffix ? <Text style={[styles.affix, { color: isDark ? '#BBB' : '#666' }]}>{suffix}</Text> : null}
        {rightElement}
        {hasSuccess ? <Ionicons name="checkmark-circle" size={20} color={FIELD_COLORS.success} /> : null}
        {hasError ? <Ionicons name="alert-circle" size={20} color={FIELD_COLORS.error} /> : null}
      </View>

      {hasError ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {computedError}
        </Text>
      ) : hasSuccess ? (
        <Text style={styles.successText}>{successText}</Text>
      ) : helper ? (
        <Text style={[styles.helper, { color: isDark ? '#AAA' : '#777' }]}>{helper}</Text>
      ) : null}
    </View>
  );
});

// ----------------------------------------------------------------------------
// Résumé SOUS le formulaire : rouge s'il reste des erreurs, vert si tout est bon.
// ----------------------------------------------------------------------------
export const FormSummary = memo(function FormSummary({
  errors,
  show = false,
  successText = 'Tous les champs sont valides.',
  style,
}) {
  const list = Object.values(errors || {}).filter(Boolean);
  if (!show) return null;

  if (list.length === 0) {
    return (
      <View style={[styles.summary, { backgroundColor: FIELD_COLORS.successBg, borderColor: FIELD_COLORS.success }, style]}>
        <Ionicons name="checkmark-circle" size={18} color={FIELD_COLORS.success} />
        <Text style={[styles.summaryText, { color: FIELD_COLORS.success }]}>{successText}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.summary, { backgroundColor: FIELD_COLORS.errorBg, borderColor: FIELD_COLORS.error }, style]}>
      <Ionicons name="alert-circle" size={18} color={FIELD_COLORS.error} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.summaryText, { color: FIELD_COLORS.error, fontWeight: '700' }]}>
          {list.length === 1 ? 'Un champ est à corriger :' : `${list.length} champs sont à corriger :`}
        </Text>
        {list.slice(0, 5).map((msg, i) => (
          <Text key={`${i}-${msg}`} style={[styles.summaryText, { color: FIELD_COLORS.error }]}>
            • {msg}
          </Text>
        ))}
      </View>
    </View>
  );
});

// Petit bouton « œil » pour les mots de passe, à passer dans rightElement.
export const EyeToggle = ({ visible, onPress }) => (
  <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 6 }}>
    <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  boxMultiline: { alignItems: 'flex-start', paddingTop: 2 },
  icon: { marginRight: 8 },
  affix: { fontSize: 14, marginRight: 6, fontWeight: '600' },
  input: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  inputWeb: { outlineStyle: 'none' },
  errorText: { color: FIELD_COLORS.error, fontSize: 12, marginTop: 5, marginLeft: 4, fontWeight: '500' },
  successText: { color: FIELD_COLORS.success, fontSize: 12, marginTop: 5, marginLeft: 4, fontWeight: '500' },
  helper: { fontSize: 12, marginTop: 5, marginLeft: 4 },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  summaryText: { fontSize: 12.5, lineHeight: 18 },
});

export default MaskedField;
