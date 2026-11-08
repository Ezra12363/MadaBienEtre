// src/utils/crossPlatformFilePicker.js
// ============================================================
// ✅ SÉLECTEUR DE FICHIER MULTI-PLATEFORME (Web + Android/iOS)
// ============================================================
// PROBLÈME CORRIGÉ :
// Sur react-native-web, Alert.alert(...) avec plusieurs boutons
// (ex: "Photo (galerie)" / "Fichier PDF" / "Annuler") s'affiche
// via window.alert() et NE DÉCLENCHE JAMAIS les callbacks onPress.
// Résultat : la Promise créée pour récupérer le choix de
// l'utilisateur ne se résout jamais → le bouton "Télécharger le
// certificat" (ou le CIN) ne fait plus rien sur le web, alors que
// tout fonctionne normalement sur Android/iOS.
//
// SOLUTION :
// - Sur le WEB : on ouvre directement le sélecteur de fichiers
//   natif du navigateur (<input type="file">), qui permet de
//   choisir une image OU un PDF en un seul clic. Pas besoin de
//   demander la "source" au préalable, le navigateur s'en charge.
// - Sur ANDROID / iOS : on garde exactement le flux existant qui
//   fonctionne déjà (Alert.alert à 3 boutons + expo-image-picker /
//   expo-document-picker).
// ============================================================

import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MAX_DOCUMENT_SIZE } from './documentUtils';

/**
 * Ouvre le sélecteur de fichier adapté à la plateforme et retourne
 * un "asset" compatible avec buildFileFormData :
 *   { uri, name, mimeType }
 * ou `null` si l'utilisateur a annulé / rien sélectionné.
 *
 * @param {Object} options
 * @param {string} options.title - Titre affiché dans l'Alert (natif uniquement)
 * @param {string} options.message - Message affiché dans l'Alert (natif uniquement)
 */
export async function pickImageOrPdf({
  title = 'Ajouter un document',
  message = 'Choisissez la source du fichier',
} = {}) {
  const asset =
    Platform.OS === 'web' ? await pickFileWeb() : await pickFileNative(title, message);

  if (!asset) return null;

  if (asset.size && asset.size > MAX_DOCUMENT_SIZE) {
    Alert.alert('⚠️ Fichier trop volumineux', 'Le fichier ne doit pas dépasser 10 MB.');
    return null;
  }
  return asset;
}

// ============================================================
// WEB : <input type="file"> natif du navigateur
// ============================================================
function pickFileWeb() {
  return new Promise((resolve) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf';
      input.style.display = 'none';

      let settled = false;

      const cleanup = () => {
        window.removeEventListener('focus', handleFocusBack);
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      const settle = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      input.oncancel = () => settle(null);

      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) {
          settle(null);
          return;
        }

        const uri = URL.createObjectURL(file);
        settle({
          uri,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          file, // conservé au cas où un appelant voudrait le File brut
        });
      };

      // Si l'utilisateur ferme le sélecteur sans choisir de fichier,
      // aucun évènement "change" n'est déclenché. On détecte ce cas
      // en écoutant le retour de focus sur la fenêtre.
      const handleFocusBack = () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) {
            settle(null);
          }
        }, 300);
      };
      window.addEventListener('focus', handleFocusBack);

      document.body.appendChild(input);
      input.click();
    } catch (error) {
      console.error('❌ pickFileWeb:', error);
      resolve(null);
    }
  });
}

// ============================================================
// ANDROID / iOS : flux existant (Alert.alert + expo pickers)
// ============================================================
async function pickFileNative(title, message) {
  const choice = await new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Photo (galerie)', onPress: () => resolve('image') },
      { text: 'Fichier PDF', onPress: () => resolve('pdf') },
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });

  if (!choice) return null;

  if (choice === 'image') {
    // ✅ Pas de requestMediaLibraryPermissionsAsync() : le sélecteur de photos
    // système (Android 13+/iOS) n'a besoin d'aucune permission, et sur
    // certains Android la demande renvoyait "refusée" → upload bloqué.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // jamais de recadrage : une CIN est plus large que 4:3
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    const a = result.assets[0];
    return {
      uri: a.uri,
      name: a.fileName || 'photo.jpg',
      mimeType: a.mimeType || 'image/jpeg',
      size: a.fileSize || 0,
    };
  }

  // choice === 'pdf'
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;
  const a = result.assets ? result.assets[0] : result;
  if (!a?.uri) return null;
  return {
    uri: a.uri,
    name: a.name || 'document.pdf',
    mimeType: a.mimeType || 'application/pdf',
    size: a.size || 0,
  };
}

export default pickImageOrPdf;