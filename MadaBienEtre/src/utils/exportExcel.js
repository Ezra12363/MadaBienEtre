// src/utils/exportExcel.js
//
// Fitaovana iombonana hanaovana export Excel (.xlsx) avy amin'ny
// tableau/liste (users, therapists, sns.) — miasa amin'ny Web
// (télécharger mivantana) sy amin'ny Android/iOS (mamorona rakitra
// eo amin'ny appareil dia manokatra ny "Partager").
//
// Fampiasana:
//
//   import { exportToExcel } from '../../utils/exportExcel';
//
//   await exportToExcel({
//     data: filteredUsers,
//     fileName: `utilisateurs_${new Date().toISOString().slice(0, 10)}`,
//     sheetName: 'Utilisateurs',
//     columns: [
//       { header: 'ID', accessor: (u) => u.id },
//       { header: 'Nom complet', accessor: (u) => u.fullname || '' },
//       { header: 'Téléphone', accessor: (u) => u.phone || '' },
//     ],
//   });
//
// Fepetra ilaina (installer amin'ny terminal ao anaty projet):
//
//   npm install xlsx
//   npx expo install expo-file-system expo-sharing
//
// (Raha tsy Expo ny projet, azo asolo amin'ny
//  react-native-fs + react-native-share ny expo-file-system/expo-sharing,
//  fa ny logique ankapobeny dia mitovy.)

import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

/**
 * @param {Object} params
 * @param {Array<Object>} params.data - Ny liste ho export-ina (efa filtered raha ilaina).
 * @param {Array<{header: string, accessor?: (item:Object)=>any, key?: string}>} params.columns
 *        Ny colonne tokony hivoaka ao amin'ny Excel, araka ny filaharana.
 *        - `header` : anaran'ny colonne ho hita eo amin'ny Excel.
 *        - `accessor(item)` : fonction manome ny sandan'ilay cellule (tsara indrindra).
 *        - `key` : raha tsy misy accessor, dia item[key] no alaina.
 * @param {string} [params.fileName='export'] - Anaran'ny rakitra (tsy misy .xlsx, ampiana automatique).
 * @param {string} [params.sheetName='Feuille1'] - Anaran'ny feuille ao anaty classeur.
 * @returns {Promise<{ success: boolean, path?: string }>}
 */
export async function exportToExcel({
  data,
  columns,
  fileName = 'export',
  sheetName = 'Feuille1',
}) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Tsy misy angona azo export-ina');
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('Tsy voafaritra ny colonne ho export-ina');
  }

  // ---- 1. Famoronana ny "rows" ho an'ny worksheet -----------------
  const rows = data.map((item) => {
    const row = {};

    columns.forEach(({ header, accessor, key }) => {
      let value;

      if (typeof accessor === 'function') {
        value = accessor(item);
      } else if (key) {
        value = item?.[key];
      }

      // Manasa ny null/undefined mba tsy hisy "undefined" ao anaty Excel
      row[header] = value === null || value === undefined ? '' : value;
    });

    return row;
  });

  // ---- 2. Famoronana ny classeur Excel -----------------------------
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: columns.map((c) => c.header),
  });

  // Mampitovy ny sakan'ny colonne mba ho mora vakiana
  worksheet['!cols'] = columns.map((c) => ({
    wch: Math.max(String(c.header).length + 2, 14),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeFileName = `${fileName.replace(/[^a-zA-Z0-9-_À-ÿ ]/g, '_')}.xlsx`;

  // ---- 3. WEB : télécharger mivantana amin'ny navigateur -----------
  if (Platform.OS === 'web') {
    XLSX.writeFile(workbook, safeFileName, { bookType: 'xlsx' });
    return { success: true, path: safeFileName };
  }

  // ---- 4. ANDROID / iOS : mamorona rakitra ao anaty appareil, --------
  //         avy eo manokatra ny "Partager" (Drive, WhatsApp, Fichiers…)
  const FileSystem = require('expo-file-system');
  const Sharing = require('expo-sharing');

  const base64Data = XLSX.write(workbook, {
    type: 'base64',
    bookType: 'xlsx',
  });

  const fileUri = `${FileSystem.cacheDirectory}${safeFileName}`;

  await FileSystem.writeAsStringAsync(fileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Exporter en Excel',
      UTI: 'com.microsoft.excel.xlsx',
    });
  }

  return { success: true, path: fileUri };
}

export default exportToExcel;