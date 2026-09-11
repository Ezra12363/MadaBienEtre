// src/services/bookingService.js

import {
  get,
  post,
  put,
  del,
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

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.bookings)) {
    return data.bookings;
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
  // Erreur retournée par notre api.js
  if (error?.error) {
    if (typeof error.error === 'string') {
      return error.error;
    }

    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    if (typeof error.error?.detail === 'string') {
      return error.error.detail;
    }
  }

  // Axios / FastAPI
  const detail =
    error?.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map(
        (item) =>
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
// NORMALIZE BOOKING
// ============================================================

export const normalizeBooking = (
  booking = {}
) => {
  const client =
    booking?.client || {};

  const therapist =
    booking?.therapist ||
    booking?.therapist_user ||
    {};

  const massage =
    booking?.massage_type ||
    booking?.massageType ||
    {};

  const price =
    booking?.client_price_proposed ??
    booking?.clientPriceProposed ??
    booking?.proposed_price ??
    booking?.proposedPrice ??
    booking?.price ??
    0;

  const therapistPrice =
    booking?.therapist_initial_price ??
    booking?.therapistInitialPrice ??
    booking?.therapist_price ??
    booking?.therapistPrice ??
    null;

  const finalPrice =
    booking?.final_price ??
    booking?.finalPrice ??
    booking?.price_final ??
    null;

  const duration =
    booking?.scheduled_duration_minutes ??
    booking?.scheduledDurationMinutes ??
    booking?.duration_minutes ??
    booking?.durationMinutes ??
    booking?.duration ??
    60;

  const clientName =
    client?.fullname ??
    client?.full_name ??
    client?.name ??
    booking?.client_fullname ??
    booking?.client_name ??
    'Client';

  const clientPhone =
    client?.phone ??
    booking?.client_phone ??
    booking?.phone ??
    null;

  const clientEmail =
    client?.email ??
    booking?.client_email ??
    booking?.email ??
    null;

  const clientPhoto =
    client?.profile_image ??
    client?.profileImage ??
    client?.photo ??
    client?.avatar ??
    booking?.client_photo ??
    booking?.client_profile_image ??
    booking?.clientPhoto ??
    null;

  const therapistName =
    therapist?.fullname ??
    therapist?.full_name ??
    therapist?.name ??
    therapist?.first_name
      ? `${therapist?.first_name || ''} ${
          therapist?.last_name || ''
        }`.trim()
      : 'Thérapeute';

  const massageName =
    massage?.name ??
    massage?.title ??
    massage?.label ??
    booking?.massage_type_name ??
    booking?.massageTypeName ??
    'Massage';

  const category =
    massage?.category ??
    booking?.massage_category ??
    booking?.category ??
    null;

  const distance =
    booking?.distance_km ??
    booking?.distanceKm ??
    null;

  const eta =
    booking?.eta_minutes ??
    booking?.etaMinutes ??
    null;

  const scheduledDate =
    booking?.scheduled_date ??
    booking?.scheduledDate ??
    booking?.date ??
    booking?.booking_date ??
    booking?.bookingDate ??
    booking?.scheduled_at ??
    booking?.scheduledAt ??
    null;

  const scheduledTime =
    booking?.scheduled_time ??
    booking?.scheduledTime ??
    booking?.time ??
    null;

  const latitude =
    booking?.client_latitude ??
    booking?.clientLatitude ??
    booking?.latitude ??
    null;

  const longitude =
    booking?.client_longitude ??
    booking?.clientLongitude ??
    booking?.longitude ??
    null;

  const address =
    booking?.address ??
    booking?.client_location ??
    booking?.clientLocation ??
    booking?.location ??
    null;

  const offersCount =
    booking?.offers_count ??
    booking?.offersCount ??
    0;

  const hasMyOffer =
    booking?.has_my_offer === true ||
    booking?.hasMyOffer === true;

  const myOffer =
    booking?.my_offer ??
    booking?.myOffer ??
    null;

  const expiresAt =
    booking?.expires_at ??
    booking?.expiresAt ??
    null;

  const timeRemaining =
    booking?.time_remaining_seconds ??
    booking?.timeRemainingSeconds ??
    null;

  const instructions =
    booking?.special_instructions ??
    booking?.specialInstructions ??
    null;

  return {
    ...booking,

    // --------------------------------------------------------
    // IDS
    // --------------------------------------------------------

    id:
      booking?.id ??
      booking?.booking_id ??
      booking?.bookingId ??
      null,

    booking_id:
      booking?.booking_id ??
      booking?.id ??
      booking?.bookingId ??
      null,

    client_id:
      booking?.client_id ??
      client?.id ??
      null,

    therapist_id:
      booking?.therapist_id ??
      therapist?.id ??
      null,

    massage_type_id:
      booking?.massage_type_id ??
      booking?.massageTypeId ??
      massage?.id ??
      null,

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    status:
      String(
        booking?.status ??
        booking?.booking_status ??
        'pending'
      )
        .trim()
        .toLowerCase(),

    // --------------------------------------------------------
    // CLIENT
    // --------------------------------------------------------

    client,

    client_name:
      clientName,

    client_fullname:
      clientName,

    client_phone:
      clientPhone,

    phone:
      clientPhone,

    client_email:
      clientEmail,

    email:
      clientEmail,

    client_photo:
      clientPhoto,

    clientPhoto:
      clientPhoto,

    // --------------------------------------------------------
    // THERAPIST
    // --------------------------------------------------------

    therapist,

    therapist_name:
      therapistName,

    // --------------------------------------------------------
    // MASSAGE
    // --------------------------------------------------------

    massage_type:
      massage,

    massage_type_name:
      massageName,

    massage_category:
      category,

    category,

    // --------------------------------------------------------
    // PRICES
    // --------------------------------------------------------

    client_price_proposed:
      Number(price) || 0,

    proposed_price:
      Number(price) || 0,

    price:
      Number(price) || 0,

    therapist_initial_price:
      therapistPrice !== null &&
      therapistPrice !== undefined
        ? Number(therapistPrice)
        : null,

    therapist_price:
      therapistPrice !== null &&
      therapistPrice !== undefined
        ? Number(therapistPrice)
        : null,

    final_price:
      finalPrice !== null &&
      finalPrice !== undefined
        ? Number(finalPrice)
        : null,

    // --------------------------------------------------------
    // DURATION
    // --------------------------------------------------------

    scheduled_duration_minutes:
      Number(duration) || 0,

    duration_minutes:
      Number(duration) || 0,

    duration:
      Number(duration) || 0,

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    address:
      address ||
      'Adresse non renseignée',

    client_location:
      booking?.client_location ??
      booking?.clientLocation ??
      booking?.address ??
      null,

    client_latitude:
      latitude,

    client_longitude:
      longitude,

    latitude:
      latitude,

    longitude:
      longitude,

    // --------------------------------------------------------
    // DATE / TIME
    // --------------------------------------------------------

    scheduled_date:
      scheduledDate,

    scheduledDate:
      scheduledDate,

    scheduled_time:
      scheduledTime,

    scheduledTime:
      scheduledTime,

    date:
      scheduledDate,

    time:
      scheduledTime,

    // --------------------------------------------------------
    // DISTANCE
    // --------------------------------------------------------

    distance_km:
      distance !== null &&
      distance !== undefined
        ? Number(distance)
        : null,

    distanceKm:
      distance !== null &&
      distance !== undefined
        ? Number(distance)
        : null,

    // --------------------------------------------------------
    // ETA
    // --------------------------------------------------------

    eta_minutes:
      eta !== null &&
      eta !== undefined
        ? Number(eta)
        : null,

    etaMinutes:
      eta !== null &&
      eta !== undefined
        ? Number(eta)
        : null,

    // --------------------------------------------------------
    // PREFERRED GENDER
    // --------------------------------------------------------

    preferred_gender:
      booking?.preferred_gender ??
      booking?.preferredGender ??
      null,

    preferredGender:
      booking?.preferred_gender ??
      booking?.preferredGender ??
      null,

    // --------------------------------------------------------
    // NEGOTIATION
    // --------------------------------------------------------

    offers_count:
      Number(offersCount) || 0,

    offersCount:
      Number(offersCount) || 0,

    has_my_offer:
      hasMyOffer,

    hasMyOffer:
      hasMyOffer,

    my_offer:
      myOffer,

    myOffer:
      myOffer,

    // --------------------------------------------------------
    // EXPIRATION
    // --------------------------------------------------------

    expires_at:
      expiresAt,

    expiresAt:
      expiresAt,

    time_remaining_seconds:
      timeRemaining !== null &&
      timeRemaining !== undefined
        ? Number(timeRemaining)
        : null,

    timeRemainingSeconds:
      timeRemaining !== null &&
      timeRemaining !== undefined
        ? Number(timeRemaining)
        : null,

    // --------------------------------------------------------
    // INSTRUCTIONS
    // --------------------------------------------------------

    special_instructions:
      instructions,

    specialInstructions:
      instructions,

    // --------------------------------------------------------
    // CREATED
    // --------------------------------------------------------

    created_at:
      booking?.created_at ??
      booking?.createdAt ??
      null,

    createdAt:
      booking?.created_at ??
      booking?.createdAt ??
      null,
  };
};

// ============================================================
// SERVICE
// ============================================================

class BookingService {

  // ==========================================================
  // NORMALIZE CREATE DATA
  // ==========================================================

  normalizeBookingData(
    bookingData = {}
  ) {
    const data = {
      ...bookingData,
    };

    let massageTypeId =
      data?.massage_type_id ??
      data?.massageTypeId ??
      data?.massage_typeId;

    if (
      massageTypeId === undefined ||
      massageTypeId === null ||
      massageTypeId === ''
    ) {
      if (data?.massageType) {
        massageTypeId =
          data.massageType?.id ??
          data.massageType?.massage_type_id ??
          data.massageType?.massageTypeId;
      }
    }

    if (
      massageTypeId === undefined ||
      massageTypeId === null ||
      massageTypeId === ''
    ) {
      if (data?.massage_type) {
        massageTypeId =
          data.massage_type?.id ??
          data.massage_type?.massage_type_id ??
          data.massage_type?.massageTypeId;
      }
    }

    if (
      massageTypeId === undefined ||
      massageTypeId === null ||
      massageTypeId === ''
    ) {
      if (data?.selectedMassageType) {
        massageTypeId =
          data.selectedMassageType?.id ??
          data.selectedMassageType?.massage_type_id ??
          data.selectedMassageType?.massageTypeId;
      }
    }

    if (
      massageTypeId !== undefined &&
      massageTypeId !== null &&
      massageTypeId !== ''
    ) {
      const numeric =
        Number(massageTypeId);

      if (Number.isFinite(numeric)) {
        massageTypeId = numeric;
      }
    }

    delete data.massageTypeId;
    delete data.massage_typeId;
    delete data.massageType;
    delete data.massage_type;
    delete data.selectedMassageType;
    delete data.selected_massage_type;

    if (
      massageTypeId !== undefined &&
      massageTypeId !== null &&
      massageTypeId !== ''
    ) {
      data.massage_type_id =
        massageTypeId;
    }

    return data;
  }

  // ==========================================================
  // CREATE
  // ==========================================================

  async createBooking(
    bookingData = {}
  ) {
    try {
      const normalized =
        this.normalizeBookingData(
          bookingData
        );

      if (
        normalized?.massage_type_id ===
          undefined ||
        normalized?.massage_type_id ===
          null
      ) {
        return {
          success: false,
          data: null,
          error:
            'Le type de massage est obligatoire.',
        };
      }

      console.log(
        '📤 [BOOKING] POST /bookings',
        normalized
      );

      const response =
        await post(
          '/bookings',
          normalized
        );

      if (response?.error) {
        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible de créer la réservation.'
            ),
        };
      }

      return {
        success: true,
        data:
          normalizeBooking(
            extractData(response)
          ),
        error: null,
      };

    } catch (error) {
      console.error(
        '❌ [BOOKING] createBooking:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de créer la réservation.'
          ),
      };
    }
  }

  // ==========================================================
  // GET ALL BOOKINGS
  // ==========================================================

  async getBookings(
    params = {}
  ) {
    try {
      console.log(
        '📥 [BOOKING] GET /bookings',
        params
      );

      const response =
        await get(
          '/bookings',
          params
        );

      if (response?.error) {
        return {
          success: false,
          data: [],
          error:
            getErrorMessage(
              response,
              'Impossible de récupérer les réservations.'
            ),
        };
      }

      const bookings =
        extractArray(response)
          .map(normalizeBooking)
          .filter(
            (item) =>
              item?.id !== null &&
              item?.id !== undefined
          );

      console.log(
        `✅ [BOOKING] ${bookings.length} réservation(s)`
      );

      return {
        success: true,
        data: bookings,
        error: null,
        raw:
          extractData(response),
      };

    } catch (error) {
      console.error(
        '❌ [BOOKING] getBookings:',
        error
      );

      return {
        success: false,
        data: [],
        error:
          getErrorMessage(
            error,
            'Impossible de récupérer les réservations.'
          ),
      };
    }
  }

  // ==========================================================
  // GET ONE BOOKING
  // ==========================================================

  async getBooking(
    bookingId
  ) {
    try {
      // ------------------------------------------------------
      // Sécurité ID
      // ------------------------------------------------------

      if (
        bookingId === undefined ||
        bookingId === null ||
        bookingId === ''
      ) {
        return {
          success: false,
          data: null,
          error:
            "Identifiant de réservation manquant.",
        };
      }

      const cleanId =
        String(bookingId).trim();

      if (!cleanId) {
        return {
          success: false,
          data: null,
          error:
            "Identifiant de réservation invalide.",
        };
      }

      console.log(
        `📥 [BOOKING DETAIL] GET /bookings/${cleanId}`
      );

      // IMPORTANT :
      // On utilise api.js au lieu d'un axios direct.
      // Le token et la base URL sont donc gérés au même endroit
      // que /notifications/unread-count.
      const response =
        await get(
          `/bookings/${encodeURIComponent(
            cleanId
          )}`
        );

      if (response?.error) {
        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Réservation introuvable.'
            ),
        };
      }

      const data =
        extractData(response);

      if (!data) {
        return {
          success: false,
          data: null,
          error:
            'La réservation est introuvable.',
        };
      }

      const booking =
        normalizeBooking(data);

      console.log(
        '✅ [BOOKING DETAIL] Réservation chargée:',
        booking?.id
      );

      return {
        success: true,
        data: booking,
        error: null,
        raw: data,
      };

    } catch (error) {
      console.error(
        '❌ [BOOKING DETAIL] getBooking:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            "Impossible de récupérer les détails de la réservation."
          ),
      };
    }
  }

  // ==========================================================
  // UPDATE
  // ==========================================================

  async updateBooking(
    bookingId,
    data
  ) {
    try {
      if (!bookingId) {
        return {
          success: false,
          data: null,
          error:
            'Identifiant de réservation manquant.',
        };
      }

      const response =
        await put(
          `/bookings/${bookingId}`,
          data
        );

      if (response?.error) {
        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible de modifier la réservation.'
            ),
        };
      }

      return {
        success: true,
        data:
          normalizeBooking(
            extractData(response)
          ),
        error: null,
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de modifier la réservation.'
          ),
      };
    }
  }

  // ==========================================================
  // DELETE
  // ==========================================================

  async deleteBooking(
    bookingId
  ) {
    try {
      const response =
        await del(
          `/bookings/${bookingId}`
        );

      if (response?.error) {
        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible de supprimer la réservation.'
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
      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de supprimer la réservation.'
          ),
      };
    }
  }

  // ==========================================================
  // CANCEL
  // ==========================================================

  async cancelBooking(
    bookingId,
    reason = ''
  ) {
    try {
      if (!bookingId) {
        return {
          success: false,
          data: null,
          error:
            'Identifiant de réservation manquant.',
        };
      }

      console.log(
        `📤 [BOOKING] PUT /bookings/cancel/${bookingId}`
      );

      const response =
        await put(
          `/bookings/cancel/${bookingId}`,
          {
            reason,
          }
        );

      if (response?.error) {
        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible d’annuler la réservation.'
            ),
        };
      }

      return {
        success: true,
        data:
          normalizeBooking(
            extractData(response)
          ),
        error: null,
      };

    } catch (error) {
      console.error(
        '❌ [BOOKING] cancelBooking:',
        error
      );

      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible d’annuler la réservation.'
          ),
      };
    }
  }

  // ==========================================================
  // START
  // ==========================================================

  async startBooking(
    bookingId
  ) {
    try {
      const response =
        await put(
          `/bookings/start/${bookingId}`
        );

      if (response?.error) {
        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible de démarrer le massage.'
            ),
        };
      }

      return {
        success: true,
        data:
          normalizeBooking(
            extractData(response)
          ),
        error: null,
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de démarrer le massage.'
          ),
      };
    }
  }

  // ==========================================================
  // COMPLETE
  // ==========================================================

  async completeBooking(
    bookingId
  ) {
    try {
      const response =
        await put(
          `/bookings/complete/${bookingId}`
        );

      if (response?.error) {
        return {
          success: false,
          data: null,
          error:
            getErrorMessage(
              response,
              'Impossible de terminer le massage.'
            ),
        };
      }

      return {
        success: true,
        data:
          normalizeBooking(
            extractData(response)
          ),
        error: null,
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          getErrorMessage(
            error,
            'Impossible de terminer le massage.'
          ),
      };
    }
  }

  // ==========================================================
  // FILTERS
  // ==========================================================

  async getClientBookings(
    clientId
  ) {
    return this.getBookings({
      client_id: clientId,
    });
  }

  async getTherapistBookings(
    therapistId
  ) {
    return this.getBookings({
      therapist_id: therapistId,
    });
  }

  async getBookingsByStatus(
    status
  ) {
    return this.getBookings({
      status,
    });
  }

  async getUpcomingBookings() {
    return this.getBookings({
      status: 'confirmed',
    });
  }

  async getBookingHistory() {
    return this.getBookings({
      status: 'completed',
    });
  }

  async getPendingBookings() {
    return this.getBookings({
      status: 'pending',
    });
  }

  async getNegotiatingBookings() {
    return this.getBookings({
      status: 'negotiating',
    });
  }

  // ==========================================================
  // AVAILABLE BOOKINGS
  // ==========================================================

  async getAvailableBookings(
    params = {}
  ) {
    try {
      const query = {
        limit:
          params?.limit ?? 100,
      };

      if (
        params?.radius_km !== undefined
      ) {
        query.radius_km =
          params.radius_km;
      }

      if (
        params?.ignore_distance !== undefined
      ) {
        query.ignore_distance =
          params.ignore_distance;
      }

      console.log(
        '📥 [THERAPIST] GET /bookings/available',
        query
      );

      const response =
        await get(
          '/bookings/available',
          query
        );

      if (response?.error) {
        return {
          success: false,
          data: [],
          error:
            getErrorMessage(
              response,
              'Impossible de récupérer les demandes disponibles.'
            ),
        };
      }

      const bookings =
        extractArray(response)
          .map(normalizeBooking)
          .filter(
            (booking) =>
              booking?.id !== null &&
              booking?.id !== undefined
          );

      return {
        success: true,
        data: bookings,
        error: null,
        raw:
          extractData(response),
      };

    } catch (error) {
      console.error(
        '❌ [THERAPIST] getAvailableBookings:',
        error
      );

      return {
        success: false,
        data: [],
        error:
          getErrorMessage(
            error,
            'Impossible de récupérer les demandes disponibles.'
          ),
      };
    }
  }

  async getAllAvailableBookings(
    params = {}
  ) {
    return this.getAvailableBookings({
      ...params,
      ignore_distance: true,
    });
  }
}

export default new BookingService();