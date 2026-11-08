// src/services/certificateSettingsService.js
// Admin : paramètres du certificat thérapeute (textes, couleurs, logo, signature).
import api from './api';

const errorMessage = (error) =>
  error?.response?.data?.detail?.message ||
  (typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : null) ||
  error?.response?.data?.message ||
  error?.message ||
  'Une erreur est survenue.';

const wrap = async (fn) => {
  try {
    const response = await fn();
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
};

const BASE = '/admin/certificate-settings';

const certificateSettingsService = {
  get: () => wrap(() => api.get(BASE)),

  save: (values) => wrap(() => api.put(BASE, values)),

  reset: () => wrap(() => api.post(`${BASE}/reset`)),

  /** @param {'logo'|'signature'} kind  @param {File|{uri,type,name}} file */
  uploadImage: (kind, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return wrap(() =>
      api.post(`${BASE}/image/${kind}`, formData, {
        // pas de Content-Type manuel : le navigateur / RN ajoute le boundary
        headers: { 'Content-Type': undefined },
        transformRequest: [(data) => data],
        timeout: 60000,
      })
    );
  },

  removeImage: (kind) => wrap(() => api.delete(`${BASE}/image/${kind}`)),

  previewPath: () => `${BASE}/preview`,
};

export default certificateSettingsService;
