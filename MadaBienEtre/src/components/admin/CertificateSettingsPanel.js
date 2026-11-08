// src/components/admin/CertificateSettingsPanel.js
//
// Admin → Paramètres → « Certificat thérapeute »
//   - logo et signature / cachet : téléversement d'une image (ou retour à l'image du modèle) ;
//   - textes du certificat (nom, slogan, titre, introduction, mention légale, libellés) ;
//   - couleurs (vert principal, or, fond) ;
//   - aperçu PDF avec les réglages enregistrés (téléchargeable sur Android / iOS / Web).
// Le certificat PDF est généré côté backend (ReportLab) avec exactement la mise en page du modèle.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../context/ThemeContext';
import { API_URL } from '../../config/env';
import certificateSettingsService from '../../services/certificateSettingsService';
import { downloadAuthenticatedPdf } from '../../utils/downloadFile';

const GREEN = '#2E8B57';
const IS_WEB = Platform.OS === 'web';

const TEXT_FIELDS = [
  { key: 'platform_name', label: 'Nom de la plateforme', hint: 'Affiché à côté du logo' },
  { key: 'platform_tagline', label: 'Slogan', hint: 'Sous le nom de la plateforme' },
  { key: 'title', label: 'Titre du certificat', hint: 'Grand titre du panneau vert' },
  { key: 'intro_text', label: "Texte d'introduction", multiline: true },
  { key: 'badge_text', label: 'Badge de validation' },
  { key: 'therapist_signature_label', label: 'Libellé signature thérapeute' },
  { key: 'admin_signature_label', label: 'Libellé validation administrateur' },
  { key: 'legal_text', label: 'Mention légale (bas de page)', hint: 'Une ligne par phrase', multiline: true },
];

const COLOR_FIELDS = [
  { key: 'color_primary', label: 'Vert principal (panneau)' },
  { key: 'color_accent', label: 'Or (filets, libellés)' },
  { key: 'color_background', label: 'Fond de la page' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

const fullUrl = (path) => (!path ? null : /^https?:\/\//i.test(path) ? path : `${API_URL}${path}`);

export default function CertificateSettingsPanel() {
  const { colors: theme } = useTheme();

  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null); // 'logo' | 'signature' | 'preview' | 'reset'
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState(null); // {ok, text}

  const apply = (payload) => {
    setData(payload);
    const next = {};
    [...TEXT_FIELDS, ...COLOR_FIELDS].forEach(({ key }) => {
      next[key] = payload[key] ?? '';
    });
    setForm(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await certificateSettingsService.get();
    if (res.success) apply(res.data);
    else setMsg({ ok: false, text: res.error });
    setLoading(false);
  }, []);

  // Chargement à la première ouverture seulement
  useEffect(() => {
    if (open && !data && !loading) load();
  }, [open, data, loading, load]);

  const box = { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' };
  const txt = { color: theme.text };
  const sub = { color: theme.textSecondary };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // ---------------------------------------------------------------- SAVE
  const save = async () => {
    for (const { key, label } of COLOR_FIELDS) {
      const v = String(form[key] || '').trim();
      const normalized = v.startsWith('#') ? v : `#${v}`;
      if (v && !HEX.test(normalized)) {
        setMsg({ ok: false, text: `Couleur « ${label} » invalide : utilisez le format #RRGGBB (ex. #2E8B57).` });
        return;
      }
    }
    setSaving(true);
    setMsg(null);
    const res = await certificateSettingsService.save(form);
    setSaving(false);
    if (res.success) {
      apply(res.data);
      setMsg({ ok: true, text: 'Paramètres du certificat enregistrés. Ils s’appliquent aux prochains certificats.' });
    } else {
      setMsg({ ok: false, text: res.error });
    }
  };

  // --------------------------------------------------------------- IMAGES
  const pickImage = async (kind) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMsg({ ok: false, text: "Autorisez l'accès à la galerie pour choisir une image." });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // garde le PNG transparent d'origine
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || (/\.png$/i.test(asset.uri) ? 'image/png' : 'image/jpeg');
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
      const fileName = asset.fileName || `${kind}.${ext}`;

      setBusy(kind);
      setMsg(null);

      let file;
      if (IS_WEB) {
        const blob = await (await fetch(asset.uri)).blob();
        file = new File([blob], fileName, { type: mimeType });
      } else {
        file = { uri: asset.uri, type: mimeType, name: fileName };
      }

      const res = await certificateSettingsService.uploadImage(kind, file);
      if (res.success) {
        apply(res.data);
        setMsg({ ok: true, text: kind === 'logo' ? 'Logo mis à jour.' : 'Signature / cachet mis à jour.' });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    } catch (e) {
      setMsg({ ok: false, text: "Impossible d'envoyer l'image. Réessayez." });
    } finally {
      setBusy(null);
    }
  };

  const removeImage = async (kind) => {
    setBusy(kind);
    setMsg(null);
    const res = await certificateSettingsService.removeImage(kind);
    setBusy(null);
    if (res.success) {
      apply(res.data);
      setMsg({ ok: true, text: "Image d'origine du modèle rétablie." });
    } else {
      setMsg({ ok: false, text: res.error });
    }
  };

  // -------------------------------------------------------------- PREVIEW
  const preview = async () => {
    setBusy('preview');
    setMsg(null);
    const res = await downloadAuthenticatedPdf(
      certificateSettingsService.previewPath(),
      'apercu-certificat.pdf',
      { dialogTitle: "Aperçu du certificat" }
    );
    setBusy(null);
    if (!res.success) setMsg({ ok: false, text: res.error });
  };

  // ---------------------------------------------------------------- RESET
  const reset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 5000);
      return;
    }
    setConfirmReset(false);
    setBusy('reset');
    const res = await certificateSettingsService.reset();
    setBusy(null);
    if (res.success) {
      apply(res.data);
      setMsg({ ok: true, text: 'Le modèle d’origine (textes, couleurs, images) a été rétabli.' });
    } else {
      setMsg({ ok: false, text: res.error });
    }
  };

  // ------------------------------------------------------------------ UI
  const ImageCard = ({ kind, title, help, url, custom, wide }) => (
    <View style={[styles.imageCard, { borderColor: theme.border || '#E5E7EB' }]}>
      <Text style={[styles.label, txt]}>{title}</Text>
      <Text style={[styles.hint, sub]}>{help}</Text>

      <View style={[styles.imageBox, kind === 'logo' ? styles.imageBoxLogo : styles.imageBoxSignature]}>
        {url ? (
          <Image source={{ uri: fullUrl(url) }} style={styles.image} resizeMode="contain" />
        ) : (
          <Ionicons name="image-outline" size={34} color="#9CA3AF" />
        )}
      </View>

      <Text style={[styles.hint, sub, { textAlign: 'center' }]}>
        {custom ? 'Image personnalisée' : 'Image du modèle officiel'}
      </Text>

      <View style={styles.imageActions}>
        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: GREEN }]}
          onPress={() => pickImage(kind)}
          disabled={busy !== null}
        >
          {busy === kind ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>Choisir une image</Text>
            </>
          )}
        </TouchableOpacity>

        {custom ? (
          <TouchableOpacity
            style={[styles.smallBtn, styles.smallBtnOutline]}
            onPress={() => removeImage(kind)}
            disabled={busy !== null}
          >
            <Ionicons name="refresh-outline" size={16} color={GREEN} />
            <Text style={[styles.smallBtnText, { color: GREEN }]}>Image d’origine</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.card, box]}>
      <TouchableOpacity style={styles.head} onPress={() => setOpen((o) => !o)} activeOpacity={0.8}>
        <Ionicons name="ribbon-outline" size={22} color={GREEN} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, txt]}>Certificat thérapeute</Text>
          <Text style={[styles.desc, sub]}>
            Logo, signature, textes et couleurs du certificat délivré après validation.
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
      </TouchableOpacity>

      {open ? (
        loading || !data ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            {msg && !msg.ok ? (
              <>
                <Text style={[styles.msg, { color: '#B91C1C' }]}>{msg.text}</Text>
                <TouchableOpacity onPress={load} style={{ marginTop: 10 }}>
                  <Text style={{ color: GREEN }}>Réessayer</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator color={GREEN} />
            )}
          </View>
        ) : (
          <View>
            <Text style={[styles.group, { color: GREEN }]}>IMAGES</Text>
            <View style={styles.imagesRow}>
              <ImageCard
                kind="logo"
                title="Logo"
                help="Affiché dans le cercle blanc, en haut à gauche. Idéal : PNG transparent."
                url={data.logo_url}
                custom={data.logo_is_custom}
              />
              <ImageCard
                kind="signature"
                title="Signature / cachet de l'admin"
                help="Affiché au-dessus de « Validation administrateur ». Idéal : PNG transparent."
                url={data.signature_url}
                custom={data.signature_is_custom}
                wide
              />
            </View>

            <Text style={[styles.group, { color: GREEN }]}>COULEURS</Text>
            {COLOR_FIELDS.map(({ key, label }) => {
              const v = String(form[key] || '');
              const valid = HEX.test(v.startsWith('#') ? v : `#${v}`);
              return (
                <View key={key} style={{ marginTop: 10 }}>
                  <Text style={[styles.label, sub]}>{label}</Text>
                  <View style={[styles.inputWrap, { borderColor: theme.border }]}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: valid ? (v.startsWith('#') ? v : `#${v}`) : 'transparent' },
                      ]}
                    />
                    <TextInput
                      style={[styles.input, txt]}
                      value={v}
                      onChangeText={(t) => setField(key, t.trim())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={7}
                      placeholder={data.defaults?.[key]}
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                </View>
              );
            })}

            <Text style={[styles.group, { color: GREEN }]}>TEXTES</Text>
            {TEXT_FIELDS.map(({ key, label, hint, multiline }) => (
              <View key={key} style={{ marginTop: 10 }}>
                <Text style={[styles.label, sub]}>{label}</Text>
                <View style={[styles.inputWrap, { borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, txt, multiline && styles.inputMulti]}
                    value={String(form[key] ?? '')}
                    onChangeText={(t) => setField(key, t)}
                    multiline={!!multiline}
                    textAlignVertical={multiline ? 'top' : 'center'}
                    placeholder={data.defaults?.[key]}
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
                {hint ? <Text style={[styles.hint, sub]}>{hint}</Text> : null}
              </View>
            ))}

            <Text style={[styles.help, sub]}>
              Un champ laissé vide reprend le texte du modèle. Les changements s’appliquent aux
              nouveaux certificats ; un certificat déjà délivré est régénéré avec ces réglages quand
              ses spécialités sont modifiées.
            </Text>

            {msg ? (
              <Text style={[styles.msg, { color: msg.ok ? '#047857' : '#B91C1C' }]}>{msg.text}</Text>
            ) : null}

            <TouchableOpacity style={styles.save} onPress={save} disabled={saving || busy !== null}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.outline} onPress={preview} disabled={busy !== null || saving}>
              {busy === 'preview' ? (
                <ActivityIndicator color={GREEN} />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={GREEN} />
                  <Text style={[styles.outlineText, { color: GREEN }]}>
                    Aperçu du certificat (PDF enregistré)
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.reset} onPress={reset} disabled={busy !== null || saving}>
              <Text style={[styles.resetText, { color: confirmReset ? '#B91C1C' : theme.textSecondary }]}>
                {busy === 'reset'
                  ? 'Réinitialisation...'
                  : confirmReset
                  ? 'Appuyez encore pour confirmer la réinitialisation'
                  : 'Rétablir le modèle d’origine'}
              </Text>
            </TouchableOpacity>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '400' },
  desc: { fontSize: 12, marginTop: 2, fontWeight: '400' },
  group: { fontSize: 11, letterSpacing: 1, marginTop: 20, fontWeight: '400' },
  label: { fontSize: 12, marginBottom: 6, fontWeight: '400' },
  hint: { fontSize: 11, marginTop: 4, fontWeight: '400', lineHeight: 15 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, fontWeight: '400' },
  inputMulti: { minHeight: 84, paddingTop: 10 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 10 },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  imageCard: { flexGrow: 1, flexBasis: 240, borderWidth: 1, borderRadius: 12, padding: 12 },
  imageBox: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageBoxLogo: { height: 110 },
  imageBoxSignature: { height: 110 },
  image: { width: '100%', height: '100%' },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, justifyContent: 'center' },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    minHeight: 38,
  },
  smallBtnOutline: { borderWidth: 1, borderColor: GREEN },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '400' },
  help: { fontSize: 11, marginTop: 16, lineHeight: 16, fontWeight: '400' },
  msg: { fontSize: 13, marginTop: 14, fontWeight: '400' },
  save: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '400' },
  outline: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  outlineText: { fontSize: 14, fontWeight: '400' },
  reset: { alignItems: 'center', paddingVertical: 14 },
  resetText: { fontSize: 13, fontWeight: '400', textAlign: 'center' },
});
