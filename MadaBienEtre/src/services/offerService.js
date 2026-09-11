// src/services/offerService.js
//
// ============================================================
// MADA BIEN-ÊTRE
// OFFERS / NEGOTIATION SERVICE
// ============================================================
//
// FASTAPI
//
// POST /offers/create
// GET  /offers/booking/{booking_id}
// POST /offers/{offer_id}/accept
// POST /offers/{offer_id}/reject
// POST /offers/{offer_id}/counter
//
// ============================================================

import {
  get,
  post,
} from './api';

// ============================================================
// HELPERS
// ============================================================

const extractData = (response) => {
  if (response?.data !== undefined) {
    return response.data;
  }

  return response;
};

const extractArray = (response) => {
  const data = extractData(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.offers)) {
    return data.offers;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const getErrorMessage = (
  error,
  fallback = 'Une erreur est survenue.'
) => {

  // ----------------------------------------------------------
  // api.js -> { error: ... }
  // ----------------------------------------------------------

  if (error?.error) {

    if (
      typeof error.error === 'string'
    ) {
      return error.error;
    }

    if (
      typeof error.error?.message === 'string'
    ) {
      return error.error.message;
    }

    if (
      typeof error.error?.detail === 'string'
    ) {
      return error.error.detail;
    }

    if (
      Array.isArray(
        error.error?.detail
      )
    ) {
      return error.error.detail
        .map(
          item =>
            item?.msg ||
            item?.message ||
            String(item)
        )
        .join(', ');
    }

    if (
      typeof error.error?.data?.message ===
        'string'
    ) {
      return error.error.data.message;
    }
  }

  // ----------------------------------------------------------
  // Axios / FastAPI
  // ----------------------------------------------------------

  const detail =
    error?.response?.data?.detail;

  if (
    typeof detail === 'string'
  ) {
    return detail;
  }

  if (
    Array.isArray(detail)
  ) {
    return detail
      .map(
        item =>
          item?.msg ||
          item?.message ||
          String(item)
      )
      .join(', ');
  }

  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message;

  if (message) {
    return message;
  }

  return fallback;
};

// ============================================================
// NORMALIZE OFFER
// ============================================================

const normalizeOffer = (
  offer = {}
) => {

  const user =
    offer?.user ||
    offer?.therapist ||
    offer?.client ||
    {};

  const displayName =
    offer?.user_name ??
    user?.fullname ??
    user?.full_name ??
    user?.name ??
    null;

  const price =
    offer?.price_offered ??
    offer?.priceOffered ??
    offer?.price ??
    offer?.counter_price ??
    0;

  return {
    ...offer,

    // --------------------------------------------------------
    // IDS
    // --------------------------------------------------------

    id:
      offer?.id ??
      offer?.offer_id ??
      null,

    offer_id:
      offer?.offer_id ??
      offer?.id ??
      null,

    booking_id:
      offer?.booking_id ??
      offer?.bookingId ??
      null,

    user_id:
      offer?.user_id ??
      offer?.userId ??
      user?.id ??
      null,

    // --------------------------------------------------------
    // TYPE
    // --------------------------------------------------------

    user_type:
      offer?.user_type ??
      offer?.userType ??
      null,

    // --------------------------------------------------------
    // USER NAME
    // --------------------------------------------------------

    user_name:
      displayName,

    user: {
      ...user,

      fullname:
        user?.fullname ??
        user?.full_name ??
        displayName ??
        '',
    },

    // --------------------------------------------------------
    // PRICE
    // --------------------------------------------------------

    price_offered:
      Number(price) || 0,

    priceOffered:
      Number(price) || 0,

    price:
      Number(price) || 0,

    // --------------------------------------------------------
    // MESSAGE
    // --------------------------------------------------------

    message:
      offer?.message ??
      '',

    // --------------------------------------------------------
    // STATUS
    //
    // Backend:
    // sent
    // accepted
    // rejected
    // expired
    // --------------------------------------------------------

    status:
      String(
        offer?.status ??
        'sent'
      )
        .trim()
        .toLowerCase(),

    // --------------------------------------------------------
    // DATES
    // --------------------------------------------------------

    created_at:
      offer?.created_at ??
      offer?.createdAt ??
      null,

    expires_at:
      offer?.expires_at ??
      offer?.expiresAt ??
      null,
  };
};

// ============================================================
// SERVICE
// ============================================================

class OfferService {

  // ==========================================================
  // CREATE OFFER
  //
  // POST /offers/create
  // ==========================================================

  async createOffer(
    offerData = {}
  ) {

    try {

      const bookingId =
        offerData?.booking_id ??
        offerData?.bookingId;

      const price =
        offerData?.price_offered ??
        offerData?.priceOffered ??
        offerData?.price;

      if (!bookingId) {

        return {
          success: false,
          data: null,
          error:
            'Identifiant de réservation manquant.',
        };
      }

      if (
        price === undefined ||
        price === null ||
        price === ''
      ) {

        return {
          success: false,
          data: null,
          error:
            'Le prix de l’offre est obligatoire.',
        };
      }

      const numericPrice =
        Number(
          String(price)
            .replace(/\s/g, '')
            .replace(',', '.')
        );

      if (
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <= 0
      ) {

        return {
          success: false,
          data: null,
          error:
            'Le prix doit être supérieur à zéro.',
        };
      }

      const payload = {
        booking_id:
          Number(bookingId),

        price_offered:
          numericPrice,

        message:
          String(
            offerData?.message || ''
          ).trim(),
      };

      console.log(
        '================================================'
      );

      console.log(
        '📤 [OFFER] CREATE'
      );

      console.log(
        '➡️ ENDPOINT: /offers/create'
      );

      console.log(
        '➡️ PAYLOAD:',
        payload
      );

      console.log(
        '================================================'
      );

      const response =
        await post(
          '/offers/create',
          payload
        );

      console.log(
        '📦 [OFFER] CREATE RESPONSE:',
        response
      );

      if (
        response?.error
      ) {

        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible de créer l’offre.'
            ),
        };
      }

      const data =
        extractData(response);

      return {
        success: true,
        data:
          normalizeOffer(data),
        error: null,
      };

    } catch (error) {

      console.error(
        '❌ [OFFER] createOffer:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de créer l’offre.'
          ),
      };
    }
  }

  // ==========================================================
  // GET OFFERS BY BOOKING
  //
  // GET /offers/booking/{booking_id}
  // ==========================================================

  async getOffersByBooking(
    bookingId
  ) {

    try {

      if (
        bookingId === undefined ||
        bookingId === null ||
        bookingId === ''
      ) {

        return {
          success: false,
          data: [],
          error:
            'Identifiant de réservation manquant.',
        };
      }

      const cleanBookingId =
        Number(bookingId);

      if (
        !Number.isFinite(
          cleanBookingId
        )
      ) {

        return {
          success: false,
          data: [],
          error:
            'Identifiant de réservation invalide.',
        };
      }

      console.log(
        '================================================'
      );

      console.log(
        '📥 [OFFER] GET OFFERS'
      );

      console.log(
        `➡️ /offers/booking/${cleanBookingId}`
      );

      console.log(
        '================================================'
      );

      const response =
        await get(
          `/offers/booking/${cleanBookingId}`
        );

      console.log(
        '📦 [OFFER] RAW OFFERS:',
        response
      );

      if (
        response?.error
      ) {

        return {
          success: false,
          data: [],
          error:
            getErrorMessage(
              response,
              'Impossible de récupérer les offres.'
            ),
        };
      }

      const offers =
        extractArray(response)
          .map(
            normalizeOffer
          )
          .filter(
            offer =>
              offer?.id !== null &&
              offer?.id !== undefined
          );

      console.log(
        '✅ [OFFER] OFFERS:',
        offers.length
      );

      return {
        success: true,
        data: offers,
        error: null,
      };

    } catch (error) {

      console.error(
        '❌ [OFFER] getOffersByBooking:',
        error
      );

      return {
        success: false,
        data: [],
        error:
          getErrorMessage(
            error,
            'Impossible de récupérer les offres.'
          ),
      };
    }
  }

  // ==========================================================
  // GET ACTIVE CLIENT OFFER
  //
  // IMPORTANT POUR LE THERAPEUTE
  //
  // Retourne uniquement l'offre active du CLIENT.
  // C'est cette offre que le thérapeute doit accepter.
  // ==========================================================

  async getActiveClientOffer(
    bookingId
  ) {

    try {

      const result =
        await this.getOffersByBooking(
          bookingId
        );

      if (
        !result?.success
      ) {

        return {
          success: false,
          data: null,
          error:
            result?.error ||
            'Impossible de récupérer les offres.',
        };
      }

      const offers =
        Array.isArray(
          result.data
        )
          ? result.data
          : [];

      const clientOffers =
        offers.filter(
          offer => {

            const type =
              String(
                offer?.user_type ||
                ''
              )
                .trim()
                .toLowerCase();

            const offerStatus =
              String(
                offer?.status ||
                ''
              )
                .trim()
                .toLowerCase();

            return (
              type === 'client' &&
              (
                offerStatus === 'sent' ||
                offerStatus === 'pending' ||
                offerStatus === 'active'
              )
            );
          }
        );

      clientOffers.sort(
        (a, b) =>
          new Date(
            b?.created_at || 0
          ).getTime() -
          new Date(
            a?.created_at || 0
          ).getTime()
      );

      const active =
        clientOffers[0] ||
        null;

      if (!active) {

        return {
          success: false,
          data: null,
          error:
            'Aucune offre active du client.',
        };
      }

      console.log(
        '✅ [OFFER] ACTIVE CLIENT OFFER:',
        active
      );

      return {
        success: true,
        data: active,
        error: null,
      };

    } catch (error) {

      console.error(
        '❌ [OFFER] getActiveClientOffer:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de récupérer l’offre client.'
          ),
      };
    }
  }

  // ==========================================================
  // ACCEPT OFFER
  //
  // POST /offers/{offer_id}/accept
  //
  // IMPORTANT
  //
  // THERAPEUTE :
  // accepte une OFFRE CLIENT
  //
  // CLIENT :
  // accepte une OFFRE THERAPEUTE
  //
  // L'AUTORISATION FINALE EST FAITE PAR LE BACKEND.
  // ==========================================================

  async acceptOffer(
    offerId
  ) {

    try {

      if (
        offerId === undefined ||
        offerId === null ||
        offerId === ''
      ) {

        return {
          success: false,
          data: null,
          error:
            'Identifiant de l’offre manquant.',
        };
      }

      const cleanOfferId =
        Number(offerId);

      if (
        !Number.isFinite(
          cleanOfferId
        )
      ) {

        return {
          success: false,
          data: null,
          error:
            'Identifiant de l’offre invalide.',
        };
      }

      console.log(
        '================================================'
      );

      console.log(
        '🟢 [OFFER] ACCEPT OFFER'
      );

      console.log(
        '➡️ OFFER ID:',
        cleanOfferId
      );

      console.log(
        '➡️ POST:',
        `/offers/${cleanOfferId}/accept`
      );

      console.log(
        '================================================'
      );

      const response =
        await post(
          `/offers/${cleanOfferId}/accept`
        );

      console.log(
        '📦 [OFFER] ACCEPT RESPONSE:',
        response
      );

      if (
        response?.error
      ) {

        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible d’accepter l’offre.'
            ),
        };
      }

      return {
        success: true,
        data:
          extractData(response),
        error: null,
      };

    } catch (error) {

      console.error(
        '❌ [OFFER] acceptOffer:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible d’accepter l’offre.'
          ),
      };
    }
  }

  // ==========================================================
  // ACCEPT CLIENT OFFER
  //
  // Helper réservé au THERAPEUTE
  //
  // Il récupère automatiquement l'offre client active
  // puis appelle :
  //
  // POST /offers/{client_offer_id}/accept
  // ==========================================================

  async acceptClientOffer(
    bookingId
  ) {

    try {

      console.log(
        '🟢 [OFFER] THERAPIST ACCEPT CLIENT OFFER'
      );

      const clientOfferResult =
        await this.getActiveClientOffer(
          bookingId
        );

      if (
        !clientOfferResult?.success
      ) {

        return {
          success: false,
          data: null,
          error:
            clientOfferResult?.error ||
            'Aucune offre client active.',
        };
      }

      const clientOffer =
        clientOfferResult.data;

      const offerId =
        clientOffer?.id ??
        clientOffer?.offer_id;

      if (!offerId) {

        return {
          success: false,
          data: null,
          error:
            'Identifiant de l’offre client manquant.',
        };
      }

      console.log(
        '🟢 [OFFER] CLIENT OFFER TO ACCEPT:',
        offerId
      );

      return await this.acceptOffer(
        offerId
      );

    } catch (error) {

      console.error(
        '❌ [OFFER] acceptClientOffer:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de confirmer l’offre du client.'
          ),
      };
    }
  }

  // ==========================================================
  // REJECT OFFER
  //
  // POST /offers/{offer_id}/reject
  // ==========================================================

  async rejectOffer(
    offerId
  ) {

    try {

      if (!offerId) {

        return {
          success: false,
          data: null,
          error:
            'Identifiant de l’offre manquant.',
        };
      }

      const response =
        await post(
          `/offers/${offerId}/reject`
        );

      console.log(
        '📦 [OFFER] REJECT RESPONSE:',
        response
      );

      if (
        response?.error
      ) {

        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible de rejeter l’offre.'
            ),
        };
      }

      return {
        success: true,
        data:
          extractData(response),
        error: null,
      };

    } catch (error) {

      console.error(
        '❌ [OFFER] rejectOffer:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de rejeter l’offre.'
          ),
      };
    }
  }

  // ==========================================================
  // COUNTER OFFER
  //
  // POST /offers/{offer_id}/counter
  // ==========================================================

  async counterOffer(
    offerId,
    counterPrice,
    message = ''
  ) {

    try {

      if (!offerId) {

        return {
          success: false,
          data: null,
          error:
            'Identifiant de l’offre client manquant.',
        };
      }

      const price =
        Number(
          String(
            counterPrice
          )
            .replace(/\s/g, '')
            .replace(',', '.')
        );

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {

        return {
          success: false,
          data: null,
          error:
            'Le prix de la contre-offre est invalide.',
        };
      }

      const payload = {
        counter_price:
          price,

        message:
          String(
            message || ''
          ).trim(),
      };

      console.log(
        '================================================'
      );

      console.log(
        '🟡 [OFFER] COUNTER OFFER'
      );

      console.log(
        '➡️ ORIGINAL OFFER ID:',
        offerId
      );

      console.log(
        '➡️ ENDPOINT:',
        `/offers/${offerId}/counter`
      );

      console.log(
        '➡️ PAYLOAD:',
        payload
      );

      console.log(
        '================================================'
      );

      const response =
        await post(
          `/offers/${offerId}/counter`,
          payload
        );

      console.log(
        '📦 [OFFER] COUNTER RESPONSE:',
        response
      );

      if (
        response?.error
      ) {

        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible d’envoyer la contre-offre.'
            ),
        };
      }

      return {
        success: true,
        data:
          normalizeOffer(
            extractData(response)
          ),
        error: null,
      };

    } catch (error) {

      console.error(
        '❌ [OFFER] counterOffer:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible d’envoyer la contre-offre.'
          ),
      };
    }
  }

  // ==========================================================
  // SEND OFFER
  // ==========================================================

  async sendOffer(
    bookingId,
    price,
    message = ''
  ) {

    return this.createOffer({
      booking_id:
        bookingId,

      price_offered:
        price,

      message,
    });
  }

  // ==========================================================
  // NEGOTIATION HISTORY
  // ==========================================================

  async getNegotiationHistory(
    bookingId
  ) {

    return this.getOffersByBooking(
      bookingId
    );
  }

  // ==========================================================
  // LEGACY
  //
  // Gardé pour compatibilité avec l'ancien code.
  // ==========================================================

  async acceptClientPrice(
    bookingId,
    clientPrice,
    message =
      'Prix client accepté.'
  ) {

    return this.createOffer({
      booking_id:
        bookingId,

      price_offered:
        clientPrice,

      message,
    });
  }

}

export default new OfferService();