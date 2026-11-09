// src/components/common/SecurePdfViewerModal.js
//
// Visionneuse de certificat en LECTURE SEULE (aucun bouton Télécharger / Partager /
// Imprimer) — Web, Android et iOS.
//
//   <SecurePdfViewerModal visible title sources={[urlOfficiel, urlRepli]} onClose />
//
// - Les sources sont essayées dans l'ordre (la première qui répond est affichée).
// - Une source image (png/jpg/webp...) s'ouvre dans la visionneuse d'images zoomable.
// - Un PDF est dessiné page par page avec pdf.js dans une WebView (mobile) ou une
//   iframe (web) : pas de barre d'outils du navigateur, donc pas de bouton « enregistrer ».
//   Pincer / molette pour zoomer.
//
// NB : un document affiché à l'écran ne peut jamais être protégé à 100 % (capture
// d'écran) ; l'objectif est d'ôter tout moyen simple de le télécharger.
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import { fetchPdfAsBase64 } from '../../utils/secureDocument';
import { ImageViewerModal } from './ImageViewerModal';

const IS_WEB = Platform.OS === 'web';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
const IMAGE_RE = /\.(png|jpe?g|webp|gif|heic|heif)(\?.*)?$/i;

const buildHtml = (base64) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes">
<style>
  html,body{margin:0;padding:0;background:#1d2420;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
  #pages{display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 0}
  canvas{width:96vw;max-width:1100px;height:auto;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.4)}
  #msg{color:#fff;font:14px sans-serif;text-align:center;padding:40px 20px}
  @media print{body{display:none}}
</style></head>
<body oncontextmenu="return false" ondragstart="return false">
<div id="msg">Chargement du certificat…</div>
<div id="pages"></div>
<script src="${PDFJS}/pdf.min.js"></script>
<script>
(function(){
  var msg=document.getElementById('msg');
  function fail(t){msg.style.display='block';msg.textContent=t;}
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='p'||e.key==='S'||e.key==='P')){e.preventDefault();}
  });
  if(!window.pdfjsLib){fail('Visionneuse indisponible : vérifiez votre connexion internet.');return;}
  pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS}/pdf.worker.min.js';
  try{
    var bin=atob('${base64}');
    var bytes=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    pdfjsLib.getDocument({data:bytes}).promise.then(function(pdf){
      msg.style.display='none';
      var host=document.getElementById('pages');
      var chain=Promise.resolve();
      for(var n=1;n<=pdf.numPages;n++){(function(num){
        chain=chain.then(function(){return pdf.getPage(num).then(function(page){
          var vp=page.getViewport({scale:2.2});
          var c=document.createElement('canvas');
          c.width=vp.width;c.height=vp.height;host.appendChild(c);
          return page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
        });});
      })(n);}
      return chain;
    }).catch(function(){fail("Impossible d'afficher ce certificat.");});
  }catch(e){fail("Impossible d'afficher ce certificat.");}
})();
</script></body></html>`;

export const SecurePdfViewerModal = ({ visible, title = 'Certificat', sources = [], onClose }) => {
  const [state, setState] = useState({ status: 'loading' }); // loading | pdf | image | error
  const [attempt, setAttempt] = useState(0);

  const list = useMemo(() => sources.filter(Boolean), [sources]);
  const key = list.join('|');

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setState({ status: 'loading' });

    (async () => {
      let lastError = "Ce certificat n'est pas encore disponible.";

      for (const source of list) {
        if (IMAGE_RE.test(source)) {
          if (!cancelled) setState({ status: 'image', uri: source });
          return;
        }
        const res = await fetchPdfAsBase64(source);
        if (cancelled) return;
        if (res.success) {
          setState({ status: 'pdf', html: buildHtml(res.base64) });
          return;
        }
        lastError = res.error || lastError;
        // 401 / 403 : inutile d'essayer une autre source
        if (res.status === 401 || res.status === 403) break;
      }

      if (!cancelled) setState({ status: 'error', message: lastError });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!visible) return null;

  // Image : visionneuse zoomable
  if (state.status === 'image') {
    return <ImageViewerModal visible images={[{ uri: state.uri, title }]} onClose={onClose} />;
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} onStartShouldSetResponder={() => true}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.body}>
          {state.status === 'pdf' ? (
            IS_WEB ? (
              createElement('iframe', {
                srcDoc: state.html,
                title,
                sandbox: 'allow-scripts',
                style: { border: 0, width: '100%', height: '100%', background: '#1d2420' },
              })
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: state.html, baseUrl: 'https://localhost' }}
                javaScriptEnabled
                domStorageEnabled={false}
                setSupportMultipleWindows={false}
                allowsLinkPreview={false}
                scalesPageToFit
                bounces={false}
                style={styles.webview}
                // aucune navigation ni ouverture externe depuis la visionneuse
                onShouldStartLoadWithRequest={(req) =>
                  req.url === 'about:blank' ||
                  req.url.startsWith('https://localhost') ||
                  req.url.startsWith('data:') ||
                  req.url.startsWith(PDFJS)
                }
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                )}
              />
            )
          ) : null}

          {state.status === 'loading' ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.info}>Chargement du certificat…</Text>
            </View>
          ) : null}

          {state.status === 'error' ? (
            <View style={styles.center}>
              <Ionicons name="document-outline" size={46} color="rgba(255,255,255,0.7)" />
              <Text style={styles.info}>{state.message}</Text>
              <Pressable onPress={retry} style={styles.retry}>
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1d2420' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 38 : 16,
    paddingBottom: 10,
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '700', paddingRight: 12 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  body: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#1d2420' },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  info: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5, textAlign: 'center' },
  retry: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});

export default SecurePdfViewerModal;
