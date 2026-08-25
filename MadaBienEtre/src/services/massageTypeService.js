// src/services/massageTypeService.js
//
// Service PARTAGÉ CLIENT + THÉRAPEUTE pour récupérer les vrais types
// de massage enregistrés en base PostgreSQL (table massage_types,
// gérée depuis admin/MassageTypesScreen.js).
//
// ⚠️ adminService.getMassageTypes() appelle GET /admin/massage-types,
// une route réservée aux ADMIN (Depends(get_current_admin)). Un
// utilisateur CLIENT ou THERAPIST reçoit un 403 s'il l'appelle.
//
// Ce service appelle donc les routes dédiées ajoutées dans
// app/routers/massage_public.py :
//   GET /massage-types             (liste des types actifs)
//   GET /massage-types/{type_id}   (détail d'un type actif)
// accessibles à TOUT utilisateur connecté, quel que soit son rôle
// (CLIENT, THERAPIST, ADMIN).
//
// Utilisable depuis n'importe quel écran, client ou thérapeute :
//   import massageTypeService from '../../services/massageTypeService';
//   const types = await massageTypeService.getActiveMassageTypes();

import api from './api';
import adminService from './adminService';

const massageTypeService = {
  /**
   * Récupère les types de massage actifs, triés par display_order.
   * @param {Object} params
   * @param {string} [params.category] - Filtre optionnel par catégorie
   *   ('relaxant' | 'therapeutique' | 'sportif' | 'reflexologie' |
   *    'prenatal' | 'personnalise').
   * @returns {Promise<Array>} Tableau brut tel que renvoyé par l'API
   *   (id, name, description, duration_min, duration_max, min_price,
   *   recommended_price, category, icon_url, image_url, is_active,
   *   display_order, created_at, updated_at).
   */
  async getActiveMassageTypes(params = {}) {
    try {
      const { category } = params;

      const queryParams = {};
      if (category) queryParams.category = category;

      console.log(
        '📤 [API REQUEST] GET /massage-types',
        queryParams
      );

      const response = await api.get('/massage-types', {
        params: queryParams,
      });

      console.log(
        '📥 [API RESPONSE]',
        response.status,
        '/massage-types',
        `(${response.data?.length ?? 0} types)`
      );

      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];

      // Filet de sécurité côté client : le backend ne renvoie déjà
      // que les types actifs, mais on garde ce filtre en défense.
      return list
        .filter((item) => item?.is_active !== false)
        .sort(
          (a, b) =>
            (a.display_order ?? 0) - (b.display_order ?? 0)
        );
    } catch (error) {
      console.error(
        '❌ Error getActiveMassageTypes:',
        error?.response?.status,
        error?.response?.data || error?.message
      );
      throw error;
    }
  },

  /**
   * Récupère le détail d'un type de massage actif par son id.
   * @param {number} typeId
   */
  async getMassageTypeById(typeId) {
    try {
      const id = Number(typeId);

      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`ID de type de massage invalide: ${typeId}`);
      }

      console.log(
        '📤 [API REQUEST] GET',
        `/massage-types/${id}`
      );

      const response = await api.get(`/massage-types/${id}`);

      console.log(
        '📥 [API RESPONSE]',
        response.status,
        `/massage-types/${id}`
      );

      return response.data;
    } catch (error) {
      console.error(
        '❌ Error getMassageTypeById:',
        error?.response?.status,
        error?.response?.data || error?.message
      );
      throw error;
    }
  },

  /**
   * Convertit le chemin relatif (icon_url / image_url) renvoyé par le
   * backend en URL absolue affichable — réutilise la même logique que
   * l'admin pour rester cohérent sur toute l'app (client, thérapeute,
   * admin affichent tous la même image pour un même type).
   */
  getMassageImageUrl(path) {
    return adminService.getMassageImageUrl(path);
  },
};

export default massageTypeService;
