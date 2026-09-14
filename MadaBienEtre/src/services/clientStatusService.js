import api from "./api";

/**
 * Service du statut en ligne du client.
 *
 * Ce service utilise l'API :
 * GET /client/me/online-status
 * PUT /client/me/online-status
 * PUT /client/me/toggle-online
 */
const clientStatusService = {
  async getOnlineStatus() {
    const response = await api.get("/client/me/online-status");
    return response.data;
  },

  async updateOnlineStatus(isOnline) {
    const response = await api.put("/client/me/online-status", {
      is_online: Boolean(isOnline),
    });

    return response.data;
  },

  async toggleOnlineStatus() {
    const response = await api.put("/client/me/toggle-online");
    return response.data;
  },
};

export default clientStatusService;
