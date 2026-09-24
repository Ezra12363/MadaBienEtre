// src/screens/client/SearchMassageScreen.js
// Fanitsiana ny fampisehoana ny types de massage par catégorie unique

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Animated,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { typography } from "../../theme";
import Header from "../../components/common/Header";
import massageTypeService from "../../services/massageTypeService";
import therapistService from "../../services/therapistService";
import MapViewWrapper from "../../components/map/MapViewWrapper";
import useLocationTracking from "../../hooks/useLocationTracking";
import { searchLocation, getAddressSuggestions, getPlaceDetails } from "../../services/geocoding";
import {
  computeAutoDistances,
  calculateRoute,
  formatDistance,
} from "../../services/routing";
import {
  MARKER_COLORS,
  DEFAULT_REGION,
  MAP_TYPES,
} from "../../config/googleMaps";

const { width: _width, height } = Dimensions.get("window");

/* ============================================================
   CONSTANTES
============================================================ */

const PRIMARY = "#2E7D32";
const SECONDARY = "#1F6B38";
const SUCCESS = "#00C853";
const WARNING = "#FF9800";
const DANGER = "#E53935";
const STAR = "#FFB800";

/* ============================================================
   RESPONSIVE HELPERS
============================================================ */

const IS_WEB = Platform.OS === "web";
const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1100;

/* ============================================================
   FONCTION DE FORMATAGE MONÉTAIRE
============================================================ */

const formatPrice = (price) => {
  if (!price && price !== 0) return "0 Ar";
  return `${Number(price).toLocaleString("fr-FR")} Ar`;
};

const formatPriceShort = (price) => {
  if (!price && price !== 0) return "0 Ar";
  if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M Ar`;
  if (price >= 1000) return `${(price / 1000).toFixed(0)}k Ar`;
  return `${price} Ar`;
};

/* ============================================================
   ✅ CATEGORIES UNIQUES AUTORISÉES (6 catégories)
============================================================ */

const ALLOWED_CATEGORIES = [
  'relaxant',
  'therapeutique',
  'sportif',
  'reflexologie',
  'prenatal',
  'personnalise'
];

/* ============================================================
   MASSAGE CATEGORY LABELS & ICONS
============================================================ */

const MASSAGE_CATEGORY_LABELS = {
  relaxant: "Relaxant",
  therapeutique: "Thérapeutique",
  sportif: "Sportif",
  reflexologie: "Réflexologie",
  prenatal: "Prénatal",
  personnalise: "Personnalisé",
};

const getMassageCategoryLabel = (category) =>
  MASSAGE_CATEGORY_LABELS[String(category || "").toLowerCase()] ||
  category ||
  "Massage";

const MASSAGE_CATEGORY_ICONS = {
  relaxant: "spa",
  therapeutique: "bone",
  sportif: "run",
  reflexologie: "foot-print",
  prenatal: "human-pregnant",
  personnalise: "auto-fix",
};

const getMassageCategoryIcon = (category) =>
  MASSAGE_CATEGORY_ICONS[String(category || "").toLowerCase()] || "spa";

/* ============================================================
   COMPOSANT TOAST
============================================================ */

const Toast = ({ visible, message, type, onHide }) => {
  const [opacity] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-20));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, 3500);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `hideToast` est recréée à chaque render ; l'ajouter relancerait le minuteur d'auto-fermeture à chaque re-render
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) onHide();
    });
  };

  if (!visible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          bg: "#D1FAE5",
          border: "#6EE7B7",
          icon: "checkmark-circle",
          iconColor: "#059669",
          textColor: "#065F46",
        };
      case "error":
        return {
          bg: "#FEE2E2",
          border: "#FCA5A5",
          icon: "alert-circle",
          iconColor: "#DC2626",
          textColor: "#991B1B",
        };
      case "warning":
        return {
          bg: "#FEF3C7",
          border: "#FCD34D",
          icon: "warning",
          iconColor: "#D97706",
          textColor: "#92400E",
        };
      default:
        return {
          bg: `${PRIMARY}15`,
          border: `${PRIMARY}40`,
          icon: "information-circle",
          iconColor: PRIMARY,
          textColor: "#164B2A",
        };
    }
  };

  const stylesType = getTypeStyles();

  return (
    // ✅ CORRECTIF : "left: 50%" + "transform: translateX(-50)" ne
    // centre PAS correctement en React Native — translateX attend
    // des pixels, pas un pourcentage ("-50" ne déplace que de 50px,
    // pas de la moitié de la largeur réelle du toast). Résultat :
    // le toast était toujours décalé, surtout sur mobile ou quand le
    // message change de longueur. On centre désormais avec un
    // conteneur plein-largeur + alignItems:"center", qui fonctionne
    // pareil sur web, iOS et Android quelle que soit la largeur du
    // toast. "pointerEvents='box-none'" laisse passer les touches en
    // dehors du toast vers l'écran en dessous.
    <View style={styles.toastWrapper} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity,
            transform: [{ translateY }],
            backgroundColor: stylesType.bg,
            borderColor: stylesType.border,
          },
        ]}
      >
        <View style={styles.toastContent}>
          <Ionicons name={stylesType.icon} size={20} color={stylesType.iconColor} />
          <Text style={[styles.toastMessage, { color: stylesType.textColor }]}>
            {message}
          </Text>
        </View>
        <TouchableOpacity onPress={hideToast} style={styles.toastClose}>
          <Ionicons name="close" size={16} color={stylesType.textColor} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

/* ============================================================
   MAP TYPE TOGGLE
============================================================ */

const MapTypeToggle = ({ mapType, onToggle, themeColors }) => {
  const isSatellite = mapType === MAP_TYPES.satellite;

  return (
    <TouchableOpacity
      style={[
        styles.mapTypeButton,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border || "#E0E0E0",
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <Ionicons
        name={isSatellite ? "map-outline" : "globe-outline"}
        size={17}
        color={PRIMARY}
      />
      <Text
        style={[
          styles.mapTypeButtonText,
          {
            color: themeColors.text,
          },
        ]}
      >
        {isSatellite ? "Plan" : "Satellite"}
      </Text>
    </TouchableOpacity>
  );
};

/* ============================================================
   SCREEN
============================================================ */

const SearchMassageScreen = ({ navigation, route }) => {
  const { massageType: initialType, selectedCategory: initialCategory } = route?.params || {};

  const { colors: themeColors, isDark } = useTheme();

  /* ==========================================================
     STATE
  ========================================================== */

  const [searchQuery, setSearchQuery] = useState("");
  const [massageTypes, setMassageTypes] = useState([]);
  const [massageTypesLoading, setMassageTypesLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(
    initialType?.id != null ? Number(initialType.id) : null,
  );
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [selectedPrice, setSelectedPrice] = useState(50000);
  const [showMap, setShowMap] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [therapists, setTherapists] = useState([]);
  const [filteredTherapists, setFilteredTherapists] = useState([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [addressResult, setAddressResult] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchDebounceRef = useRef(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [_showFilters, setShowFilters] = useState(false);
  const [sortMode, setSortMode] = useState("distance");
  const [mapType, setMapType] = useState(MAP_TYPES.standard);
  const [showFilterModal, setShowFilterModal] = useState(false);

  /* ==========================================================
     RESPONSIVE
  ========================================================== */

  const [screenWidth, setScreenWidth] = useState(Dimensions.get("window").width);

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener("change", onChange);

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      } else if (Dimensions.removeEventListener) {
        Dimensions.removeEventListener("change", onChange);
      }
    };
  }, []);

  const isTabletWidth = screenWidth >= TABLET_BREAKPOINT;
  const isDesktopWidth = screenWidth >= DESKTOP_BREAKPOINT;
  const useGridCategories = IS_WEB && isTabletWidth;

  /* ==========================================================
     TYPES DE MASSAGE - UNIQUEMENT 6 CATEGORIES UNIQUES
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    const loadMassageTypes = async () => {
      try {
        setMassageTypesLoading(true);
        const data = await massageTypeService.getActiveMassageTypes();

        if (!mounted) return;

        // ✅ Filtrer uniquement les catégories autorisées
        const filtered = (Array.isArray(data) ? data : [])
          .filter((item) => {
            const category = String(item.category || '').toLowerCase();
            return ALLOWED_CATEGORIES.includes(category);
          })
          .map((item) => ({
            id: Number(item.id),
            value: item.category,
            name: item.name,
            shortName: item.name,
            category: item.category,
            categoryLabel: getMassageCategoryLabel(item.category),
            description: item.description || "",
            icon: getMassageCategoryIcon(item.category),
            minPrice: Number(item.min_price ?? item.recommended_price ?? 0),
            duration_min: item.duration_min,
            duration_max: item.duration_max,
          }));

        setMassageTypes(filtered);
        
        console.log(`✅ ${filtered.length} types de massage affichés`);
      } catch (error) {
        console.error("❌ Erreur chargement types de massage:", error);
        if (mounted) setMassageTypes([]);
      } finally {
        if (mounted) setMassageTypesLoading(false);
      }
    };

    loadMassageTypes();

    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Synchronisation avec les params reçus
  useEffect(() => {
    if (initialType?.id != null) {
      setSelectedType(Number(initialType.id));
      if (initialType.category && ALLOWED_CATEGORIES.includes(initialType.category.toLowerCase())) {
        setSelectedCategory(initialType.category);
        setSearchQuery(initialType.categoryLabel || initialType.name || '');
      }
    }
  }, [initialType?.id, initialType?.category, initialType?.categoryLabel, initialType?.name]);

  /* ==========================================================
     TOAST STATE
  ========================================================== */

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info",
  });

  /* ==========================================================
     REFS
  ========================================================== */

  const mapRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  /* ==========================================================
     TOAST FUNCTIONS
  ========================================================== */

  const showToast = useCallback((message, type = "info") => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  /* ==========================================================
     LOCATION
  ========================================================== */

  const {
    location: userLocation,
    isTracking,
    errorMsg: trackingError,
  } = useLocationTracking({
    enabled: true,
    distanceIntervalMeters: 15,
    timeIntervalMs: 4000,
  });

  /* ==========================================================
     TYPE SELECTION
  ========================================================== */

  const selectedTypeObject = useMemo(
    () =>
      massageTypes.find(
        (item) => Number(item.id) === Number(selectedType),
      ),
    [massageTypes, selectedType],
  );

  /* ==========================================================
     FILTER COUNT
  ========================================================== */

  const _activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedType) count++;
    if (selectedCategory) count++;
    if (selectedDuration !== 60) count++;
    if (selectedPrice !== 50000) count++;
    if (sortMode !== "distance") count++;
    return count;
  }, [selectedType, selectedCategory, selectedDuration, selectedPrice, sortMode]);

  /* ==========================================================
     TOGGLE MAP TYPE
  ========================================================== */

  const toggleMapType = useCallback(() => {
    setMapType((prev) =>
      prev === MAP_TYPES.satellite ? MAP_TYPES.standard : MAP_TYPES.satellite,
    );
    showToast(
      mapType === MAP_TYPES.satellite ? "Vue plan activée" : "Vue satellite activée",
      "info"
    );
  }, [mapType, showToast]);

  /* ==========================================================
     LOAD THERAPISTS — DONNÉES RÉELLES DEPUIS L API / BASE
     (déclaré AVANT le useEffect "INITIAL LOAD" ci-dessous, qui le
     référence dans son tableau de dépendances — sinon on obtient
     "Cannot access 'loadTherapists' before initialization")
  ========================================================== */

  const loadTherapists = useCallback(async () => {
    let cancelled = false;
    try {
      setIsLoading(true);
      const response = await therapistService.getTherapists();
      if (cancelled) return;
      if (!response?.success) throw new Error(response?.error || "Impossible de charger les thérapeutes");

      const payload = response.data;
      const rows = Array.isArray(payload) ? payload :
        Array.isArray(payload?.therapists) ? payload.therapists :
        Array.isArray(payload?.items) ? payload.items :
        Array.isArray(payload?.data) ? payload.data : [];

      const first = (...values) => values.find(v => v !== undefined && v !== null && String(v).trim() !== "");
      const num = (v, fallback=0) => { const n=Number(v); return Number.isFinite(n) ? n : fallback; };
      const bool = (v, fallback=false) => {
        if (typeof v === "boolean") return v; if (typeof v === "number") return v===1;
        if (typeof v === "string") { const x=v.toLowerCase().trim(); if (["true","1","yes","oui","online","available","disponible"].includes(x)) return true; if (["false","0","no","non","offline","unavailable","indisponible"].includes(x)) return false; } return fallback;
      };
      const specialties = (raw) => {
        const value=first(raw?.specialties,raw?.speciality,raw?.specialities,raw?.skills,raw?.services,[]);
        // ✅ CORRECTIF : l'API renvoie désormais chaque spécialité comme
        // {id, name, category} (catégorie réelle du type de massage,
        // ex: "relaxant") — on garde nom ET catégorie au lieu de ne
        // garder qu'un texte, pour pouvoir afficher/filtrer par vraie
        // catégorie sur la carte.
        if (Array.isArray(value)) {
          return value.map(x => {
            if (typeof x === "string") return { name: x, category: null };
            const name = first(x?.name,x?.title,x?.label);
            const category = first(x?.category,x?.massage_category) || null;
            return name ? { name: String(name), category: category ? String(category).toLowerCase() : null } : null;
          }).filter(Boolean);
        }
        return typeof value === "string"
          ? value.split(/[,;|]/).map(x=>x.trim()).filter(Boolean).map(name => ({ name, category: null }))
          : [];
      };
      const categoriesOf = (raw, specialtyList) => {
        // ✅ AJOUTÉ : l'API renvoie aussi "categories" (liste distincte
        // des catégories couvertes par ce thérapeute) — on l'utilise en
        // priorité, sinon on la reconstruit depuis les spécialités.
        const fromApi = first(raw?.categories);
        if (Array.isArray(fromApi)) return fromApi.map(c => String(c).toLowerCase());
        return Array.from(new Set(specialtyList.map(s => s.category).filter(Boolean)));
      };
      const coordinate = (raw) => {
        const l=first(raw?.coordinate,raw?.coordinates,raw?.location,raw?.position) || {};
        const lat=num(first(raw?.latitude,raw?.lat,raw?.current_latitude,raw?.location_latitude,l?.latitude,l?.lat),NaN);
        const lon=num(first(raw?.longitude,raw?.lng,raw?.lon,raw?.current_longitude,raw?.location_longitude,l?.longitude,l?.lng,l?.lon),NaN);
        return Number.isFinite(lat)&&Number.isFinite(lon) ? {latitude:lat,longitude:lon} : null;
      };

      const normalized = rows.map((raw,index) => {
        const user=raw?.user || raw?.profile || raw?.account || {};
        const firstName=first(raw?.first_name,raw?.firstname,user?.first_name,user?.firstname);
        const lastName=first(raw?.last_name,raw?.lastname,user?.last_name,user?.lastname);
        // ✅ CORRECTIF : l'API renvoie "fullname" (un seul mot, sans
        // underscore) — ce champ n'était jamais testé, donc toutes les
        // cartes retombaient sur "Thérapeute" par défaut.
        const name=first(raw?.name,raw?.fullname,raw?.full_name,raw?.fullName,raw?.display_name,raw?.displayName,user?.name,user?.fullname,user?.full_name,[firstName,lastName].filter(Boolean).join(" "),"Thérapeute");
        const specialtyList = specialties(raw);
        const categoryList = categoriesOf(raw, specialtyList);
        return {
          id:first(raw?.id,raw?.therapist_id,raw?.user_id,user?.id,`therapist-${index}`),
          name:String(name),
          rating:Math.max(0,Math.min(5,num(first(raw?.rating,raw?.average_rating,raw?.avg_rating,raw?.note),0))),
          reviews:Math.max(0,Math.round(num(first(raw?.reviews,raw?.review_count,raw?.reviews_count,raw?.total_reviews,raw?.number_of_reviews),0))),
          experience:Math.max(0,Math.round(num(first(raw?.experience,raw?.experience_years,raw?.years_experience,raw?.anciennete),0))),
          // ✅ CORRECTIF : l'API renvoie "distance_km" (et "distance_meters"),
          // jamais "distance" tout court — la distance réelle n'était donc
          // jamais lue et retombait systématiquement sur 999. Cette valeur
          // n'est qu'un point de départ : elle est recalculée en direct
          // via le GPS (Haversine, voir computeAutoDistances) dès que la
          // position de l'utilisateur est disponible.
          distance:num(first(raw?.distance,raw?.distance_km,raw?.distanceKm,raw?.distance_meters!=null?raw.distance_meters/1000:undefined),999),
          price:Math.max(0,num(first(raw?.price,raw?.starting_price,raw?.base_price,raw?.hourly_rate,raw?.session_price,raw?.recommended_price,raw?.min_price,raw?.tarif),0)),
          image:first(raw?.image,raw?.image_url,raw?.photo,raw?.photo_url,raw?.avatar,raw?.avatar_url,raw?.profile_image,raw?.profile_image_url,user?.image,user?.image_url,user?.photo,user?.photo_url,user?.avatar,user?.avatar_url,null),
          // ✅ "category" reste dispo pour compat (1ère catégorie), mais
          // le filtrage réel utilise désormais "categories" (toutes les
          // catégories couvertes par ce thérapeute — voir plus bas).
          category: categoryList[0] || "",
          categories: categoryList,
          specialties: specialtyList,
          // ✅ CORRECTIF : l'API calcule maintenant "available_now" côté
          // serveur à partir des DEUX colonnes réelles de la base
          // (is_online ET is_available) — un thérapeute non connecté ne
          // doit jamais apparaître "disponible", même si is_available
          // est resté à true en base après sa dernière session.
          available:bool(first(raw?.available_now,raw?.available,(raw?.is_online!=null&&raw?.is_available!=null)?(bool(raw.is_online)&&bool(raw.is_available)):undefined,raw?.is_available,raw?.online,raw?.is_online,raw?.isOnline,raw?.status === "online" ? true : undefined,raw?.status === "available" ? true : undefined),false),
          coordinate:coordinate(raw),
          address:String(first(raw?.address,raw?.full_address,raw?.formatted_address,raw?.location_name,raw?.quartier,raw?.neighborhood,user?.address,"Adresse non renseignée")),
          raw,
        };
      });

      setTherapists(normalized); setFilteredTherapists(normalized);
      showToast(normalized.length ? `${normalized.length} professionnel${normalized.length>1?"s":""} disponible${normalized.length>1?"s":""}` : "Aucun thérapeute disponible pour le moment", normalized.length ? "success" : "info");
    } catch (error) {
      console.error("❌ Erreur chargement thérapeutes:",error);
      if (!cancelled) { setTherapists([]); setFilteredTherapists([]); showToast(error?.message || "Impossible de charger les thérapeutes","error"); }
    } finally { if (!cancelled) setIsLoading(false); }
    return () => { cancelled=true; };
  }, [showToast]);

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    loadTherapists();
  }, [fadeAnim, loadTherapists]);

  /* ==========================================================
     UPDATE DISTANCES
  ========================================================== */

  useEffect(() => {
    if (!userLocation || therapists.length === 0) {
      return;
    }

    const updated = computeAutoDistances(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      therapists,
    );

    setTherapists(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement granulaires (lat/lng) : `therapists` en dépendance créerait une boucle infinie (cet effet appelle setTherapists)
  }, [userLocation?.latitude, userLocation?.longitude]);

  /* ==========================================================
     APPLY FILTERS
  ========================================================== */

  useEffect(() => {
    if (therapists.length === 0) {
      return;
    }

    let result = [...therapists];

    /* SEARCH */
    const query = searchQuery.trim().toLowerCase();
    if (query && !addressResult) {
      result = result.filter((therapist) => {
        const nameMatch = therapist.name?.toLowerCase().includes(query);
        const specialtyMatch = therapist.specialties?.some((specialty) =>
          specialty.name?.toLowerCase().includes(query),
        );
        return nameMatch || specialtyMatch;
      });
    }

    /* ✅ MASSAGE TYPE - FILTRE PAR CATEGORY (réel, via la vraie
       catégorie de chaque type de massage renvoyée par l'API — plus
       de correspondance approximative sur le texte du nom du soin) */
    if (selectedCategory && ALLOWED_CATEGORIES.includes(selectedCategory.toLowerCase())) {
      const wanted = selectedCategory.toLowerCase();
      result = result.filter((therapist) =>
        therapist.categories?.includes(wanted) ||
        therapist.specialties?.some((specialty) => specialty.category === wanted),
      );
    }
    
    /* ✅ MASSAGE TYPE - FILTRE PAR TYPE */
    if (selectedType && !selectedCategory) {
      const type = massageTypes.find((item) => item.id === selectedType);
      if (type && ALLOWED_CATEGORIES.includes(type.category.toLowerCase())) {
        const wantedCategory = type.category.toLowerCase();
        const wantedName = type.name?.toLowerCase();
        result = result.filter((therapist) =>
          therapist.categories?.includes(wantedCategory) ||
          therapist.specialties?.some(
            (specialty) =>
              specialty.name?.toLowerCase() === wantedName ||
              specialty.category === wantedCategory,
          ),
        );
      }
    }

    /* PRICE */
    result = result.filter(
      (therapist) => Number(therapist.price || 0) <= selectedPrice,
    );

    /* SORT */
    if (sortMode === "distance") {
      result.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }
    if (sortMode === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (sortMode === "price") {
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
    }

    setFilteredTherapists(result);
  }, [
    therapists,
    massageTypes,
    selectedType,
    selectedCategory,
    selectedPrice,
    searchQuery,
    addressResult,
    sortMode,
  ]);

  /* ==========================================================
     ADDRESS SEARCH
  ========================================================== */

  const applyAddressResult = (result) => {
    if (!result || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) return;
    const normalized = { ...result, latitude: Number(result.latitude), longitude: Number(result.longitude) };
    setAddressResult(normalized);
    const withDistances = computeAutoDistances(
      { latitude: normalized.latitude, longitude: normalized.longitude },
      therapists,
    );
    const nearby = withDistances.filter((therapist) => therapist.distance <= 10);
    setFilteredTherapists(nearby.length > 0 ? nearby : withDistances);
    setShowMap(true);
    setMapKey((value) => value + 1);
    setTimeout(() => mapRef.current?.animateToRegion?.({
      latitude: normalized.latitude, longitude: normalized.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02,
    }), 350);
  };

  const handleSuggestionSelect = async (suggestion) => {
    setAddressSuggestions([]);
    setIsGeocoding(true);
    try {
      let result = null;
      if (suggestion.source === "google" && suggestion.id) result = await getPlaceDetails(suggestion.id);
      if (!result && Number.isFinite(Number(suggestion.latitude)) && Number.isFinite(Number(suggestion.longitude))) result = suggestion;
      if (!result) result = await searchLocation(suggestion.description || suggestion.main_text || searchQuery);
      if (!result) { showToast("Lieu introuvable", "error"); return; }
      setSearchQuery(result.display_name || suggestion.description || suggestion.main_text || "");
      applyAddressResult(result);
      showToast(result.isApproximate ? "Zone approximative sélectionnée" : "Lieu sélectionné", result.isApproximate ? "warning" : "success");
    } catch (error) {
      console.error("Suggestion selection error:", error);
      showToast("Impossible de sélectionner ce lieu", "error");
    } finally { setIsGeocoding(false); }
  };

  const handleSearchTextChange = (text) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (text.trim().length < 3) { setAddressSuggestions([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try { setAddressSuggestions(await getAddressSuggestions(text.trim())); }
      catch (error) { console.warn("Suggestions error:", error?.message); setAddressSuggestions([]); }
      finally { setIsLoadingSuggestions(false); }
    }, 350);
  };

  useEffect(() => () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); }, []);

  const handleAddressSearch = async () => {
    const query = searchQuery.trim();

    if (!query) {
      showToast("Veuillez saisir une adresse ou un quartier", "warning");
      return;
    }

    setIsGeocoding(true);
    setAddressResult(null);

    try {
      const result = await searchLocation(query);

      if (!result) {
        showToast(`Aucun résultat trouvé pour "${query}"`, "error");
        return;
      }

      applyAddressResult(result);
      const withDistances = computeAutoDistances(
        { latitude: Number(result.latitude), longitude: Number(result.longitude) }, therapists
      );
      const nearby = withDistances.filter((therapist) => therapist.distance <= 10);

      if (nearby.length > 0) {
        showToast(`${nearby.length} thérapeute(s) trouvé(s) dans un rayon de 10 km`, "success");
      } else {
        showToast("Aucun thérapeute à proximité de cette adresse", "warning");
      }
    } catch (error) {
      console.error("Address search error:", error);
      showToast("Impossible de rechercher cette adresse", "error");
    } finally {
      setIsGeocoding(false);
    }
  };

  /* ==========================================================
     THERAPIST SEARCH
  ========================================================== */

  const handleTherapistSearch = () => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      setFilteredTherapists(therapists);
      return;
    }

    const result = therapists.filter((therapist) => {
      const nameMatch = therapist.name?.toLowerCase().includes(query);
      const specialtyMatch = therapist.specialties?.some((specialty) =>
        specialty.name?.toLowerCase().includes(query),
      );
      return nameMatch || specialtyMatch;
    });

    setFilteredTherapists(result);

    if (result.length === 0) {
      showToast(`Aucun thérapeute trouvé pour "${searchQuery}"`, "warning");
    } else {
      showToast(`${result.length} thérapeute(s) trouvé(s)`, "success");
    }
  };

  /* ==========================================================
     GLOBAL SEARCH
  ========================================================== */

  const handleSearch = () => {
    const query = searchQuery.trim();

    if (!query) {
      setAddressResult(null);
      setFilteredTherapists(therapists);
      return;
    }

    const looksLikeAddress =
      /[0-9]/.test(query) ||
      /lot/i.test(query) ||
      /rue/i.test(query) ||
      /avenue/i.test(query) ||
      /boulevard/i.test(query) ||
      /tananarive/i.test(query) ||
      /antananarivo/i.test(query) ||
      /fianarantsoa/i.test(query) ||
      /toamasina/i.test(query) ||
      /mahajanga/i.test(query) ||
      /antsiranana/i.test(query) ||
      /toliara/i.test(query) ||
      query.length > 18;

    if (looksLikeAddress) {
      handleAddressSearch();
    } else {
      handleTherapistSearch();
    }
  };

  /* ==========================================================
     CLEAR SEARCH
  ========================================================== */

  const clearSearch = () => {
    setSearchQuery("");
    setAddressSuggestions([]);
    setAddressResult(null);
    setSelectedMarker(null);
    setSelectedRoute(null);
    setSelectedCategory(null);
    setSelectedType(null);
    setFilteredTherapists(therapists);
    setMapKey((value) => value + 1);
    showToast("Recherche réinitialisée", "info");
  };

  /* ==========================================================
     MAP MARKERS
  ========================================================== */

  const mapMarkers = useMemo(() => {
    const markers = filteredTherapists.map((therapist, _index) => ({
      id: therapist.id,
      coordinate: therapist.coordinate || {
        latitude: DEFAULT_REGION.latitude,
        longitude: DEFAULT_REGION.longitude,
      },
      title: therapist.name,
      description: `${therapist.specialties?.map((s) => s.name).join(", ") || ""} • ${formatPrice(therapist.price || 0)}`,
      pinColor: therapist.available ? MARKER_COLORS.available : MARKER_COLORS.unavailable,
      distance: therapist.distance,
      price: therapist.price,
      rating: therapist.rating,
      reviews: therapist.reviews,
      address: therapist.address,
      available: therapist.available,
    }));

    if (addressResult && addressResult.latitude && addressResult.longitude) {
      markers.push({
        id: "search-address",
        coordinate: {
          latitude: addressResult.latitude,
          longitude: addressResult.longitude,
        },
        title: addressResult.isApproximate ? "Zone approximative" : "Adresse recherchée",
        description: addressResult.display_name || "Position recherchée",
        pinColor: "#FF7A00",
        available: true,
      });
    }

    return markers;
  }, [filteredTherapists, addressResult]);

  /* ==========================================================
     ROUTE
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    const fetchRoute = async () => {
      if (!selectedMarker || !userLocation || !selectedMarker.coordinate) {
        setSelectedRoute(null);
        return;
      }

      setIsRouting(true);

      try {
        const result = await calculateRoute(
          userLocation.latitude,
          userLocation.longitude,
          selectedMarker.coordinate.latitude,
          selectedMarker.coordinate.longitude,
        );

        if (!cancelled) {
          setSelectedRoute(result);
        }
      } catch (error) {
        console.error("Route error:", error);
        showToast("Impossible de calculer l'itinéraire", "error");
      } finally {
        if (!cancelled) {
          setIsRouting(false);
        }
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [selectedMarker, userLocation, showToast]);

  /* ==========================================================
     MARKER PRESS
  ========================================================== */

  const handleMarkerPress = (marker) => {
    if (!marker) {
      setSelectedMarker(null);
      setSelectedRoute(null);
      return;
    }

    if (marker.id === "search-address") {
      showToast(addressResult?.display_name || "Adresse recherchée", "info");
      return;
    }

    const therapist = filteredTherapists.find((item) => item.id === marker.id);

    if (therapist) {
      setSelectedMarker(therapist);
      showToast(`${therapist.name} sélectionné(e)`, "info");
    }
  };

  /* ==========================================================
     CENTER USER
  ========================================================== */

  const centerOnUser = () => {
    if (!userLocation) {
      showToast("Votre position actuelle n'est pas encore disponible", "warning");
      return;
    }

    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    });

    showToast("Centré sur votre position", "success");
  };

  /* ==========================================================
     RESET FILTERS
  ========================================================== */

  const resetFilters = () => {
    setSelectedType(null);
    setSelectedCategory(null);
    setSelectedDuration(60);
    setSelectedPrice(50000);
    setSortMode("distance");
    setSearchQuery("");
    setAddressResult(null);
    setFilteredTherapists(therapists);
    setShowFilters(false);
    setShowFilterModal(false);
    showToast("Filtres réinitialisés", "info");
  };

  /* ==========================================================
     RESULT SUBTITLE
  ========================================================== */

  const resultsSubtitle = useMemo(() => {
    if (selectedCategory) {
      const type = massageTypes.find(t => t.category === selectedCategory);
      return type?.name || selectedCategory;
    }
    if (selectedTypeObject) {
      return selectedTypeObject.name;
    }
    return "Disponibles près de vous";
  }, [selectedCategory, selectedTypeObject, massageTypes]);

  /* ==========================================================
     ✅ RENDER DES CATEGORIES UNIQUES (GROUPÉES PAR CATEGORY)
  ========================================================== */

  // ✅ Grouper les types par catégorie unique
  const groupedMassageTypes = useMemo(() => {
    const groups = {};
    massageTypes.forEach((type) => {
      const category = type.category;
      if (!groups[category]) {
        groups[category] = {
          category: category,
          categoryLabel: getMassageCategoryLabel(category),
          icon: getMassageCategoryIcon(category),
          types: [],
        };
      }
      groups[category].types.push(type);
    });
    return Object.values(groups);
  }, [massageTypes]);

  /* ==========================================================
     ✅ RENDER TYPE CHIP - PAR CATEGORIE UNIQUE
  ========================================================== */

  const renderTypeChip = useCallback((categoryGroup) => {
    const category = categoryGroup.category;
    const isActive = selectedCategory === category;

    return (
      <TouchableOpacity
        key={category}
        activeOpacity={0.85}
        style={[
          styles.typeChip,
          {
            backgroundColor: isActive ? PRIMARY : themeColors.surface,
            borderColor: isActive ? PRIMARY : themeColors.border || "#E7EBF1",
          },
        ]}
        onPress={() => {
          if (isActive) {
            setSelectedCategory(null);
            setSelectedType(null);
            setSearchQuery("");
            showToast("Filtre supprimé", "info");
          } else {
            setSelectedCategory(category);
            setSelectedType(null);
            setSearchQuery(categoryGroup.categoryLabel);
            showToast(`Filtre: ${categoryGroup.categoryLabel}`, "info");
          }
        }}
      >
        <MaterialCommunityIcons
          name={categoryGroup.icon}
          size={16}
          color={isActive ? "#FFFFFF" : PRIMARY}
        />
        <Text
          style={[
            styles.typeChipText,
            {
              color: isActive ? "#FFFFFF" : themeColors.text,
            },
          ]}
        >
          {categoryGroup.categoryLabel}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedCategory, themeColors, showToast]);

  /* ==========================================================
     ✅ RENDER TYPE CARD (GRID) - PAR CATEGORIE UNIQUE
  ========================================================== */

  const renderTypeCard = useCallback((categoryGroup) => {
    const category = categoryGroup.category;
    const isActive = selectedCategory === category;

    return (
      <TouchableOpacity
        key={category}
        activeOpacity={0.85}
        style={[
          styles.typeCard,
          isDesktopWidth && styles.typeCardDesktop,
          {
            backgroundColor: isActive ? PRIMARY : themeColors.surface,
            borderColor: isActive ? PRIMARY : themeColors.border || "#E7EBF1",
          },
        ]}
        onPress={() => {
          if (isActive) {
            setSelectedCategory(null);
            setSelectedType(null);
            setSearchQuery("");
            showToast("Filtre supprimé", "info");
          } else {
            setSelectedCategory(category);
            setSelectedType(null);
            setSearchQuery(categoryGroup.categoryLabel);
            showToast(`Filtre: ${categoryGroup.categoryLabel}`, "info");
          }
        }}
      >
        <View
          style={[
            styles.typeCardIcon,
            {
              backgroundColor: isActive ? "rgba(255,255,255,0.18)" : `${PRIMARY}12`,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={categoryGroup.icon}
            size={18}
            color={isActive ? "#FFFFFF" : PRIMARY}
          />
        </View>
        <Text
          style={[
            styles.typeCardTitle,
            {
              color: isActive ? "#FFFFFF" : themeColors.text,
            },
          ]}
        >
          {categoryGroup.categoryLabel}
        </Text>
        <Text
          style={[
            styles.typeCardSubtitle,
            {
              color: isActive ? "rgba(255,255,255,0.85)" : themeColors.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {categoryGroup.types.length} type{categoryGroup.types.length > 1 ? "s" : ""} disponible{categoryGroup.types.length > 1 ? "s" : ""}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedCategory, themeColors, isDesktopWidth, showToast]);

  /* ==========================================================
     THERAPIST CARD
  ========================================================== */

  const renderTherapistCard = useCallback(
    ({ item, index }) => {
      const isSelected = selectedMarker?.id === item.id;
      const isRecommended = index === 0 && item.available;

      return (
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            style={[
              styles.therapistCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: isSelected
                  ? PRIMARY
                  : isDark
                    ? "#292D35"
                    : "#E9EDF3",
              },
            ]}
            onPress={() => {
              setSelectedMarker(item);
              showToast(`${item.name} sélectionné(e)`, "info");

              if (showMap) {
                mapRef.current?.animateToRegion({
                  latitude: item.coordinate.latitude,
                  longitude: item.coordinate.longitude,
                  latitudeDelta: 0.018,
                  longitudeDelta: 0.018,
                });
              }
            }}
          >
            {isRecommended && (
              <View style={styles.aiRecommendationBadge}>
                <MaterialCommunityIcons name="auto-fix" size={11} color="#FFFFFF" />
                <Text style={styles.aiRecommendationText}>RECOMMANDÉ PAR L'IA</Text>
              </View>
            )}

            <View style={styles.cardTop}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: `${PRIMARY}15`,
                  },
                ]}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {item.name?.charAt(0)?.toUpperCase()}
                  </Text>
                )}
                <View
                  style={[
                    styles.onlineDot,
                    {
                      backgroundColor: item.available ? SUCCESS : "#A0A5AD",
                    },
                  ]}
                />
              </View>

              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.therapistName,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                </View>

                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color={STAR} />
                  <Text
                    style={[
                      styles.ratingText,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {item.rating}
                  </Text>
                  <Text
                    style={[
                      styles.reviewText,
                      {
                        color: themeColors.textSecondary,
                      },
                    ]}
                  >
                    ({item.reviews} avis)
                  </Text>
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.experienceText,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  {item.experience} ans d'expérience
                </Text>
              </View>

              <View style={styles.distanceContainer}>
                <Ionicons name="location-outline" size={13} color={PRIMARY} />
                <Text
                  style={[
                    styles.distanceText,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {formatDistance(item.distance)}
                </Text>
              </View>
            </View>

            {/* ✅ CORRECTIF : affiche TOUTES les spécialités du
                thérapeute (plus de limite à 2) — la ligne passe à la
                ligne (flexWrap) pour ne jamais être coupée. */}
            <View style={styles.specialtiesRow}>
              {item.specialties?.map((specialty, specialtyIndex) => (
                <View
                  key={`${item.id}-${specialtyIndex}`}
                  style={[
                    styles.specialtyChip,
                    {
                      backgroundColor: isDark ? "#242832" : "#F3F6FA",
                    },
                  ]}
                >
                  {/* ✅ AJOUTÉ : icône + libellé de la vraie catégorie
                      de massage (relaxant, thérapeutique, sportif, ...)
                      renvoyée par l'API pour cette spécialité. */}
                  {specialty.category && (
                    <MaterialCommunityIcons
                      name={getMassageCategoryIcon(specialty.category)}
                      size={10}
                      color={PRIMARY}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.specialtyText,
                      {
                        color: themeColors.textSecondary,
                      },
                    ]}
                  >
                    {specialty.name}
                    {specialty.category ? ` · ${getMassageCategoryLabel(specialty.category)}` : ""}
                  </Text>
                </View>
              ))}
            </View>

            {/* ✅ AJOUTÉ : bandeau récapitulatif de TOUTES les
                catégories couvertes par ce thérapeute */}
            {item.categories?.length > 0 && (
              <View style={styles.categoriesRow}>
                {item.categories.map((cat) => (
                  <View
                    key={`${item.id}-cat-${cat}`}
                    style={[
                      styles.categoryPill,
                      { backgroundColor: `${PRIMARY}0F`, borderColor: `${PRIMARY}30` },
                    ]}
                  >
                    <MaterialCommunityIcons name={getMassageCategoryIcon(cat)} size={10} color={PRIMARY} />
                    <Text style={[styles.categoryPillText, { color: PRIMARY }]}>
                      {getMassageCategoryLabel(cat)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  {formatDistance(item.distance)}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  {formatPrice(item.price || 0)}
                </Text>
              </View>
            </View>

            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={13} color={themeColors.textSecondary} />
              <Text
                numberOfLines={1}
                style={[
                  styles.addressText,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                {item.address}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: item.available ? `${SUCCESS}12` : `${DANGER}10`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: item.available ? SUCCESS : "#A0A5AD",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: item.available ? SUCCESS : "#8A8F98",
                    },
                  ]}
                >
                  {item.available ? "Disponible maintenant" : "Indisponible"}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!item.available}
                onPress={() => {
                  if (item.available) {
                    navigation.navigate("BookingDetail", { therapist: item });
                    showToast(`Réservation pour ${item.name}`, "success");
                  }
                }}
                style={[
                  styles.bookButton,
                  {
                    backgroundColor: item.available ? PRIMARY : isDark ? "#343943" : "#E5E7EB",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bookButtonText,
                    {
                      color: item.available ? "#FFFFFF" : "#999999",
                    },
                  ]}
                >
                  {item.available ? "Voir & réserver" : "Indisponible"}
                </Text>
                {item.available && <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [selectedMarker, themeColors, isDark, fadeAnim, showMap, navigation, showToast],
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
        },
      ]}
    >
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />

      <Header
        title="Trouver un massage"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <Animated.View
        style={[
          styles.flex,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[PRIMARY, SECONDARY]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroDecorOne} />
              <View style={styles.heroDecorTwo} />

              <View style={styles.heroContent}>
                <View style={styles.heroIcon}>
                  <MaterialCommunityIcons name="spa" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>
                    Trouvez votre <Text style={styles.heroTitleAccent}>bien-être</Text>
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    Des professionnels près de vous, adaptés à vos besoins.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.searchBox,
                  {
                    backgroundColor: themeColors.surface,
                  },
                ]}
              >
                <View style={styles.searchIcon}>
                  <Ionicons name="search" size={19} color={PRIMARY} />
                </View>

                <TextInput
                  style={[
                    styles.searchInput,
                    {
                      color: themeColors.text,
                    },
                  ]}
                  placeholder={"Quartier, adresse ou thérapeute..."}
                  placeholderTextColor={themeColors.textSecondary}
                  value={searchQuery}
                  onChangeText={handleSearchTextChange}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                />

                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={18} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.searchAction}
                  onPress={handleSearch}
                  disabled={isGeocoding}
                >
                  {isGeocoding ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>

              {searchQuery.trim().length >= 3 && (addressSuggestions.length > 0 || isLoadingSuggestions) && (
                <View style={[styles.suggestionsBox, { backgroundColor: themeColors.surface, borderColor: themeColors.border || "#E7EBF1" }]}>
                  {isLoadingSuggestions && addressSuggestions.length === 0 ? (
                    <View style={styles.suggestionLoading}><ActivityIndicator size="small" color={PRIMARY} /><Text style={[styles.suggestionLoadingText, { color: themeColors.textSecondary }]}>Recherche des lieux…</Text></View>
                  ) : (
                    addressSuggestions.map((item) => (
                      <TouchableOpacity key={`${item.source}-${item.id}`} style={styles.suggestionItem} onPress={() => handleSuggestionSelect(item)}>
                        <Ionicons name="location-outline" size={18} color={PRIMARY} />
                        <View style={styles.suggestionTextWrap}>
                          <Text numberOfLines={1} style={[styles.suggestionMain, { color: themeColors.text }]}>{item.main_text || item.description}</Text>
                          {!!item.secondary_text && <Text numberOfLines={2} style={[styles.suggestionSecondary, { color: themeColors.textSecondary }]}>{item.secondary_text}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              <View style={styles.locationStatus}>
                <View
                  style={[
                    styles.locationDot,
                    {
                      backgroundColor: isTracking ? SUCCESS : "#A0A5AD",
                    },
                  ]}
                />
                <Text numberOfLines={1} style={styles.locationStatusText}>
                  {isTracking ? "Votre position est détectée" : trackingError || "Localisation en cours..."}
                </Text>
                {isTracking && <Ionicons name="navigate" size={12} color="#FFFFFF" />}
              </View>
            </LinearGradient>
          </View>

          {addressResult && (
            <View
              style={[
                styles.addressCard,
                {
                  backgroundColor: addressResult.isApproximate
                    ? isDark ? "#3B2E17" : "#FFF7E6"
                    : isDark ? "#173222" : "#ECFDF3",
                },
              ]}
            >
              <View
                style={[
                  styles.addressIcon,
                  {
                    backgroundColor: addressResult.isApproximate ? WARNING : SUCCESS,
                  },
                ]}
              >
                <Ionicons
                  name={addressResult.isApproximate ? "warning-outline" : "checkmark"}
                  size={14}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.addressContent}>
                <Text
                  style={[
                    styles.addressLabel,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {addressResult.isApproximate ? "Zone approximative" : "Lieu recherché"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.addressValue,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  {addressResult.display_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setAddressResult(null);
                  setFilteredTherapists(therapists);
                  showToast("Recherche annulée", "info");
                }}
              >
                <Ionicons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* ✅ SECTION DES CATEGORIES UNIQUES */}
          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  Catégories de massage
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitle,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  Choisissez une catégorie
                </Text>
              </View>
            </View>

            {massageTypesLoading ? (
              <View style={styles.typeLoadingBox}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={[styles.typeLoadingText, { color: themeColors.textSecondary }]}>
                  Chargement des catégories…
                </Text>
              </View>
            ) : groupedMassageTypes.length === 0 ? (
              <View style={styles.typeLoadingBox}>
                <Ionicons name="alert-circle-outline" size={20} color={themeColors.textSecondary} />
                <Text style={[styles.typeLoadingText, { color: themeColors.textSecondary }]}>
                  Aucune catégorie disponible
                </Text>
              </View>
            ) : useGridCategories ? (
              // ✅ GRID POUR TABLETTE ET WEB
              <View style={[styles.typeGrid, isDesktopWidth && styles.typeGridDesktop]}>
                {/* BOUTON "TOUS" */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.typeCard,
                    isDesktopWidth && styles.typeCardDesktop,
                    {
                      backgroundColor: !selectedCategory && !selectedType ? PRIMARY : themeColors.surface,
                      borderColor: !selectedCategory && !selectedType ? PRIMARY : themeColors.border || "#E7EBF1",
                    },
                  ]}
                  onPress={() => {
                    setSelectedCategory(null);
                    setSelectedType(null);
                    setSearchQuery("");
                    showToast("Toutes les catégories", "info");
                  }}
                >
                  <View
                    style={[
                      styles.typeCardIcon,
                      {
                        backgroundColor: !selectedCategory && !selectedType ? "rgba(255,255,255,0.18)" : `${PRIMARY}12`,
                      },
                    ]}
                  >
                    <Ionicons name="apps-outline" size={18} color={!selectedCategory && !selectedType ? "#FFFFFF" : PRIMARY} />
                  </View>
                  <Text
                    style={[
                      styles.typeCardTitle,
                      { color: !selectedCategory && !selectedType ? "#FFFFFF" : themeColors.text },
                    ]}
                  >
                    Tous
                  </Text>
                  <Text
                    style={[
                      styles.typeCardSubtitle,
                      {
                        color: !selectedCategory && !selectedType ? "rgba(255,255,255,0.85)" : themeColors.textSecondary,
                      },
                    ]}
                  >
                    Toutes les catégories
                  </Text>
                </TouchableOpacity>

                {/* CATEGORIES UNIQUES */}
                {groupedMassageTypes.map((categoryGroup) => renderTypeCard(categoryGroup))}
              </View>
            ) : (
              // ✅ CHIPS POUR MOBILE
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeList}
              >
                {/* BOUTON "TOUS" */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: !selectedCategory && !selectedType ? PRIMARY : themeColors.surface,
                      borderColor: !selectedCategory && !selectedType ? PRIMARY : themeColors.border || "#E7EBF1",
                    },
                  ]}
                  onPress={() => {
                    setSelectedCategory(null);
                    setSelectedType(null);
                    setSearchQuery("");
                    showToast("Toutes les catégories", "info");
                  }}
                >
                  <Ionicons name="apps-outline" size={15} color={!selectedCategory && !selectedType ? "#FFFFFF" : PRIMARY} />
                  <Text
                    style={[
                      styles.typeChipText,
                      {
                        color: !selectedCategory && !selectedType ? "#FFFFFF" : themeColors.text,
                      },
                    ]}
                  >
                    Tous
                  </Text>
                </TouchableOpacity>

                {/* CATEGORIES UNIQUES */}
                {groupedMassageTypes.map((categoryGroup) => renderTypeChip(categoryGroup))}
              </ScrollView>
            )}
          </View>

          <View style={styles.quickFilters}>
            <TouchableOpacity
              onPress={() => setShowFilterModal(true)}
              style={[
                styles.quickFilter,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border || "#E7EBF1",
                },
              ]}
            >
              <Ionicons name="time-outline" size={14} color={PRIMARY} />
              <Text
                style={[
                  styles.quickFilterText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {selectedDuration} min
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowFilterModal(true)}
              style={[
                styles.quickFilter,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border || "#E7EBF1",
                },
              ]}
            >
              <Ionicons name="wallet-outline" size={14} color={SUCCESS} />
              <Text
                style={[
                  styles.quickFilterText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                ≤ {formatPriceShort(selectedPrice)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowFilterModal(true)}
              style={[
                styles.quickFilter,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border || "#E7EBF1",
                },
              ]}
            >
              <Ionicons name="swap-vertical-outline" size={14} color={SECONDARY} />
              <Text
                style={[
                  styles.quickFilterText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {sortMode === "distance" ? "Proximité" : sortMode === "rating" ? "Mieux notés" : "Prix"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.resultsHeader}>
            <View style={styles.resultsInfo}>
              <Text
                style={[
                  styles.resultsTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {filteredTherapists.length} professionnel{filteredTherapists.length > 1 ? "s" : ""}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.resultsSubtitle,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                {resultsSubtitle}
              </Text>
            </View>

            <View
              style={[
                styles.viewSwitcher,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border || "#E7EBF1",
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.viewButton, !showMap && styles.viewButtonActive]}
                onPress={() => {
                  setShowMap(false);
                  showToast("Vue liste", "info");
                }}
              >
                <Ionicons name="list-outline" size={16} color={!showMap ? "#FFFFFF" : themeColors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewButton, showMap && styles.viewButtonActive]}
                onPress={() => {
                  setShowMap(true);
                  setMapKey((value) => value + 1);
                  showToast("Vue carte", "info");
                }}
              >
                <Ionicons name="map-outline" size={16} color={showMap ? "#FFFFFF" : themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <View style={[styles.loadingIcon, { backgroundColor: `${PRIMARY}12` }]}>
                <ActivityIndicator size="large" color={PRIMARY} />
              </View>
              <Text style={[styles.loadingTitle, { color: themeColors.text }]}>
                Recherche en cours
              </Text>
              <Text style={[styles.loadingSubtitle, { color: themeColors.textSecondary }]}>
                Nous recherchons les meilleurs professionnels près de vous...
              </Text>
            </View>
          ) : filteredTherapists.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: `${PRIMARY}12` }]}>
                <Ionicons name="search-outline" size={35} color={PRIMARY} />
              </View>
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                Aucun professionnel trouvé
              </Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                Essayez une autre catégorie, augmentez votre budget ou modifiez votre recherche.
              </Text>
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Ionicons name="refresh" size={15} color="#FFFFFF" />
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>
          ) : showMap ? (
            <View
              style={[
                styles.mapContainer,
                isTabletWidth && styles.mapContainerTablet,
                isDesktopWidth && styles.mapContainerDesktop,
              ]}
            >
              <MapViewWrapper
                ref={mapRef}
                key={mapKey}
                style={styles.map}
                markers={mapMarkers}
                userLocation={userLocation}
                route={selectedRoute}
                showUserLocation
                trackUserLocation
                showMapTypeControl={false}
                mapType={mapType}
                onMapTypeChange={setMapType}
                initialRegion={{
                  latitude: addressResult?.latitude || userLocation?.latitude || DEFAULT_REGION.latitude,
                  longitude: addressResult?.longitude || userLocation?.longitude || DEFAULT_REGION.longitude,
                  latitudeDelta: addressResult ? 0.02 : DEFAULT_REGION.latitudeDelta,
                  longitudeDelta: addressResult ? 0.02 : DEFAULT_REGION.longitudeDelta,
                }}
                onMarkerPress={handleMarkerPress}
              />

              <View
                style={[
                  styles.mapTopBadge,
                  {
                    backgroundColor: isDark ? "rgba(20,22,28,0.95)" : "rgba(255,255,255,0.96)",
                  },
                ]}
              >
                <View style={styles.mapTopIcon}>
                  <Ionicons name="people" size={13} color={PRIMARY} />
                </View>
                <Text
                  style={[
                    styles.mapTopText,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {filteredTherapists.length} masseur{filteredTherapists.length > 1 ? "s" : ""}
                </Text>
              </View>

              <MapTypeToggle mapType={mapType} onToggle={toggleMapType} themeColors={themeColors} />

              <TouchableOpacity
                style={[
                  styles.myLocationButton,
                  {
                    backgroundColor: isDark ? "#20232A" : "#FFFFFF",
                  },
                ]}
                onPress={centerOnUser}
              >
                <Ionicons name="navigate" size={18} color={PRIMARY} />
              </TouchableOpacity>

              <View
                style={[
                  styles.mapLegend,
                  {
                    backgroundColor: isDark ? "rgba(20,22,28,0.95)" : "rgba(255,255,255,0.96)",
                  },
                ]}
              >
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS.available }]} />
                  <Text style={[styles.legendText, { color: themeColors.text }]}>Disponible</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS.unavailable }]} />
                  <Text style={[styles.legendText, { color: themeColors.text }]}>Indisponible</Text>
                </View>
              </View>

              {selectedMarker && (
                <View
                  style={[
                    styles.selectedPanel,
                    {
                      backgroundColor: themeColors.surface,
                    },
                  ]}
                >
                  <TouchableOpacity style={styles.panelClose} onPress={() => handleMarkerPress(null)}>
                    <Ionicons name="close" size={17} color={themeColors.textSecondary} />
                  </TouchableOpacity>

                  <View style={styles.panelHeader}>
                    <View style={[styles.panelAvatar, { backgroundColor: `${PRIMARY}15` }]}>
                      <Text style={styles.panelAvatarText}>
                        {selectedMarker.name?.charAt(0)?.toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.panelInfo}>
                      <Text numberOfLines={1} style={[styles.panelName, { color: themeColors.text }]}>
                        {selectedMarker.name}
                      </Text>
                      <View style={styles.panelRating}>
                        <Ionicons name="star" size={12} color={STAR} />
                        <Text style={styles.panelRatingText}>{selectedMarker.rating}</Text>
                        <Text style={[styles.panelReviews, { color: themeColors.textSecondary }]}>
                          ({selectedMarker.reviews} avis)
                        </Text>
                      </View>
                    </View>

                    <View style={styles.panelAvailable}>
                      <View
                        style={[
                          styles.panelAvailableDot,
                          {
                            backgroundColor: selectedMarker.available ? SUCCESS : "#A0A5AD",
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.panelAvailableText,
                          {
                            color: selectedMarker.available ? SUCCESS : "#8A8F98",
                          },
                        ]}
                      >
                        {selectedMarker.available ? "Disponible" : "Hors ligne"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.panelStats}>
                    <View style={styles.panelStat}>
                      <Ionicons name="navigate-outline" size={15} color={PRIMARY} />
                      <View>
                        <Text style={[styles.panelStatLabel, { color: themeColors.textSecondary }]}>
                          Distance
                        </Text>
                        <Text style={[styles.panelStatValue, { color: themeColors.text }]}>
                          {isRouting ? "Calcul..." : selectedRoute ? selectedRoute.distanceText : formatDistance(selectedMarker.distance)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.panelStat}>
                      <Ionicons name="time-outline" size={15} color={PRIMARY} />
                      <View>
                        <Text style={[styles.panelStatLabel, { color: themeColors.textSecondary }]}>
                          Trajet
                        </Text>
                        <Text style={[styles.panelStatValue, { color: themeColors.text }]}>
                          {isRouting ? "..." : selectedRoute ? selectedRoute.durationText : "—"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.panelPriceContainer}>
                      <Text style={styles.panelPrice}>{formatPrice(selectedMarker.price || 0)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={!selectedMarker.available}
                    onPress={() => {
                      if (selectedMarker.available) {
                        navigation.navigate("BookingDetail", { therapist: selectedMarker });
                        showToast(`Réservation pour ${selectedMarker.name}`, "success");
                      }
                    }}
                    style={[
                      styles.panelButton,
                      {
                        backgroundColor: selectedMarker.available ? PRIMARY : "#999999",
                      },
                    ]}
                  >
                    <Text style={styles.panelButtonText}>
                      {selectedMarker.available ? "Voir le profil et réserver" : "Indisponible"}
                    </Text>
                    {selectedMarker.available && <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredTherapists}
              renderItem={renderTherapistCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </ScrollView>
      </Animated.View>

      {/* FILTER MODAL */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboard}
          >
            <View
              style={[
                styles.filterModal,
                {
                  backgroundColor: themeColors.surface,
                },
              ]}
            >
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                    Affiner votre recherche
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                    Trouvez le professionnel qui vous correspond
                  </Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={20} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* DURATION */}
                <View style={styles.modalGroup}>
                  <View style={styles.modalGroupHeader}>
                    <View>
                      <Text style={[styles.modalGroupTitle, { color: themeColors.text }]}>Durée</Text>
                      <Text style={[styles.modalGroupHint, { color: themeColors.textSecondary }]}>
                        Choisissez la durée de votre séance
                      </Text>
                    </View>
                    <View style={styles.selectedValueBadge}>
                      <Text style={styles.selectedValueText}>{selectedDuration} min</Text>
                    </View>
                  </View>

                  <View style={styles.modalOptionsRow}>
                    {[60, 90, 120].map((duration) => {
                      const active = selectedDuration === duration;
                      return (
                        <TouchableOpacity
                          key={duration}
                          style={[
                            styles.modalOption,
                            {
                              backgroundColor: active ? PRIMARY : isDark ? "#292D35" : "#F3F5F8",
                              borderColor: active ? PRIMARY : "transparent",
                            },
                          ]}
                          onPress={() => {
                            setSelectedDuration(duration);
                            showToast(`Durée: ${duration} min`, "info");
                          }}
                        >
                          <Ionicons name="time-outline" size={16} color={active ? "#FFFFFF" : PRIMARY} />
                          <Text
                            style={[
                              styles.modalOptionText,
                              {
                                color: active ? "#FFFFFF" : themeColors.text,
                              },
                            ]}
                          >
                            {duration} min
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* PRICE */}
                <View style={styles.modalGroup}>
                  <View style={styles.modalGroupHeader}>
                    <View>
                      <Text style={[styles.modalGroupTitle, { color: themeColors.text }]}>Budget maximum</Text>
                      <Text style={[styles.modalGroupHint, { color: themeColors.textSecondary }]}>
                        Prix maximum par séance
                      </Text>
                    </View>
                    <Text style={styles.priceModalValue}>{formatPrice(selectedPrice)}</Text>
                  </View>

                  <View style={styles.modalOptionsRow}>
                    {[30000, 50000, 70000, 100000].map((price) => {
                      const active = selectedPrice === price;
                      return (
                        <TouchableOpacity
                          key={price}
                          style={[
                            styles.priceModalOption,
                            {
                              backgroundColor: active ? PRIMARY : isDark ? "#292D35" : "#F3F5F8",
                            },
                          ]}
                          onPress={() => {
                            setSelectedPrice(price);
                            showToast(`Budget: ${formatPrice(price)}`, "info");
                          }}
                        >
                          <Text
                            style={[
                              styles.priceModalText,
                              {
                                color: active ? "#FFFFFF" : themeColors.text,
                              },
                            ]}
                          >
                            {formatPriceShort(price)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* SORT */}
                <View style={styles.modalGroup}>
                  <Text style={[styles.modalGroupTitle, { color: themeColors.text }]}>Trier les résultats</Text>
                  <Text style={[styles.modalGroupHint, { color: themeColors.textSecondary }]}>
                    Choisissez ce qui est le plus important pour vous
                  </Text>

                  <View style={styles.sortOptions}>
                    {[
                      { id: "distance", label: "Plus proche", icon: "location-outline" },
                      { id: "rating", label: "Mieux noté", icon: "star-outline" },
                      { id: "price", label: "Prix le plus bas", icon: "pricetag-outline" },
                    ].map((option) => {
                      const active = sortMode === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.sortModalOption,
                            {
                              backgroundColor: active ? `${PRIMARY}10` : "transparent",
                              borderColor: active ? PRIMARY : themeColors.border || "#E4E8ED",
                            },
                          ]}
                          onPress={() => {
                            setSortMode(option.id);
                            showToast(`Tri: ${option.label}`, "info");
                          }}
                        >
                          <View
                            style={[
                              styles.sortModalIcon,
                              {
                                backgroundColor: active ? PRIMARY : isDark ? "#292D35" : "#F3F5F8",
                              },
                            ]}
                          >
                            <Ionicons
                              name={option.icon}
                              size={15}
                              color={active ? "#FFFFFF" : themeColors.textSecondary}
                            />
                          </View>
                          <Text
                            style={[
                              styles.sortModalText,
                              {
                                color: active ? PRIMARY : themeColors.text,
                              },
                            ]}
                          >
                            {option.label}
                          </Text>
                          {active && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* IA INFO */}
                <View style={styles.aiInfoCard}>
                  <View style={styles.aiInfoIcon}>
                    <MaterialCommunityIcons name="robot-outline" size={22} color={SUCCESS} />
                  </View>
                  <View style={styles.aiInfoContent}>
                    <Text style={styles.aiInfoTitle}>Recommandation intelligente</Text>
                    <Text style={styles.aiInfoText}>
                      Les résultats pourront être classés selon la distance, le prix, la disponibilité, la note et l'expérience.
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* ACTIONS */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.resetModalButton} onPress={resetFilters}>
                  <Text style={[styles.resetModalText, { color: themeColors.text }]}>Réinitialiser</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyModalButton}
                  onPress={() => {
                    setShowFilterModal(false);
                    setShowFilters(false);
                    showToast("Filtres appliqués", "success");
                  }}
                >
                  <Text style={styles.applyModalText}>Afficher les résultats</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  toastWrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 70 : 50,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
  },
  toastContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: "#FFFFFF",
    maxWidth: Platform.OS === "web" ? 480 : "90%",
    width: Platform.OS === "web" ? "auto" : "90%",
    minWidth: Platform.OS === "web" ? 320 : "auto",
  },
  toastContent: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  toastMessage: { fontSize: 12.5, fontFamily: typography.fontFamily.medium, flex: 1, lineHeight: 18 },
  toastClose: { paddingLeft: 8, paddingVertical: 4 },

  heroSection: { marginHorizontal: 16, marginTop: 8, borderRadius: 24, overflow: "hidden" },
  heroGradient: { minHeight: 185, padding: 16, position: "relative", overflow: "hidden" },
  heroDecorOne: { position: "absolute", width: 150, height: 150, borderRadius: 75, right: -70, top: -80, backgroundColor: "rgba(255,255,255,0.08)" },
  heroDecorTwo: { position: "absolute", width: 90, height: 90, borderRadius: 45, left: -45, bottom: -50, backgroundColor: "rgba(255,255,255,0.06)" },
  heroContent: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  heroIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginRight: 11 },
  heroText: { flex: 1 },
  heroTitle: { color: "#FFFFFF", fontSize: 19, lineHeight: 24, fontFamily: typography.fontFamily.bold },
  heroTitleAccent: { color: "#DCEFE0" },
  heroSubtitle: { color: "rgba(255,255,255,0.72)", fontSize: 9.5, lineHeight: 14, marginTop: 3, fontFamily: typography.fontFamily.regular },
  searchBox: { height: 50, borderRadius: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 5 },
  searchIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchInput: { flex: 1, fontSize: 12, paddingHorizontal: 3, fontFamily: typography.fontFamily.regular },
  clearButton: { padding: 5 },
  searchAction: { width: 38, height: 38, borderRadius: 12, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  suggestionsBox: { marginTop: 8, borderWidth: 1, borderRadius: 14, overflow: "hidden", maxHeight: 250 },
  suggestionItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E7EBF1" },
  suggestionTextWrap: { flex: 1, marginLeft: 9 },
  suggestionMain: { fontSize: 12, fontFamily: typography.fontFamily.medium },
  suggestionSecondary: { fontSize: 9, marginTop: 2, fontFamily: typography.fontFamily.regular },
  suggestionLoading: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  suggestionLoadingText: { fontSize: 10, fontFamily: typography.fontFamily.regular },
  locationStatus: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  locationDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  locationStatusText: { flex: 1, color: "rgba(255,255,255,0.68)", fontSize: 8.5, fontFamily: typography.fontFamily.regular },

  addressCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 15, padding: 10, flexDirection: "row", alignItems: "center" },
  addressIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: 8 },
  addressContent: { flex: 1 },
  addressLabel: { fontSize: 10, fontFamily: typography.fontFamily.semiBold },
  addressValue: { fontSize: 9, marginTop: 2, fontFamily: typography.fontFamily.regular },

  filterSection: { marginTop: 20 },
  sectionHeader: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 15, fontFamily: typography.fontFamily.bold },
  sectionSubtitle: { fontSize: 9, marginTop: 3, fontFamily: typography.fontFamily.regular },
  typeLoadingBox: { minHeight: 70, borderRadius: 14, borderWidth: 1, borderColor: "#E7EBF1", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  typeLoadingText: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  typeList: { paddingHorizontal: 16, paddingTop: 11, paddingBottom: 3 },
  typeChip: { minHeight: 38, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", marginRight: 7 },
  typeChipText: { fontSize: 10, marginLeft: 5, fontFamily: typography.fontFamily.medium },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 11, paddingBottom: 5, gap: 10 },
  typeGridDesktop: { paddingHorizontal: 24, gap: 14 },
  typeCard: { width: "31%", minWidth: 150, minHeight: 96, borderRadius: 16, borderWidth: 1, padding: 12, justifyContent: "center" },
  typeCardDesktop: { width: 190, minHeight: 108, padding: 16 },
  typeCardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  typeCardTitle: { fontSize: 12.5, fontFamily: typography.fontFamily.bold },
  typeCardSubtitle: { fontSize: 9, marginTop: 2, fontFamily: typography.fontFamily.regular },

  quickFilters: { flexDirection: "row", paddingHorizontal: 16, marginTop: 10, gap: 7 },
  quickFilter: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  quickFilterText: { fontSize: 8.5, marginLeft: 5, fontFamily: typography.fontFamily.medium },

  resultsHeader: { paddingHorizontal: 16, marginTop: 20, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultsInfo: { flex: 1, paddingRight: 10 },
  resultsTitle: { fontSize: 15, fontFamily: typography.fontFamily.bold },
  resultsSubtitle: { fontSize: 9, marginTop: 2, fontFamily: typography.fontFamily.regular },
  viewSwitcher: { height: 38, borderRadius: 12, borderWidth: 1, padding: 3, flexDirection: "row" },
  viewButton: { width: 35, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  viewButtonActive: { backgroundColor: PRIMARY },

  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  cardWrapper: { marginBottom: 11 },
  therapistCard: { borderRadius: 21, borderWidth: 1, padding: 13, overflow: "hidden" },
  aiRecommendationBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: SUCCESS, marginBottom: 10 },
  aiRecommendationText: { color: "#FFFFFF", fontSize: 6.5, letterSpacing: 0.4, marginLeft: 4, fontFamily: typography.fontFamily.bold },
  cardTop: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 57, height: 57, borderRadius: 18, alignItems: "center", justifyContent: "center", position: "relative", marginRight: 10, overflow: "visible" },
  avatarImage: { width: 57, height: 57, borderRadius: 18 },
  avatarText: { color: PRIMARY, fontSize: 22, fontFamily: typography.fontFamily.bold },
  onlineDot: { position: "absolute", width: 12, height: 12, borderRadius: 6, right: -2, bottom: -1, borderWidth: 2, borderColor: "#FFFFFF" },
  cardInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  therapistName: { flexShrink: 1, fontSize: 13, fontFamily: typography.fontFamily.bold },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  ratingText: { fontSize: 10, marginLeft: 3, fontFamily: typography.fontFamily.semiBold },
  reviewText: { fontSize: 8, marginLeft: 3, fontFamily: typography.fontFamily.regular },
  experienceText: { fontSize: 8, marginTop: 3, fontFamily: typography.fontFamily.regular },
  distanceContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, backgroundColor: `${PRIMARY}0C`, marginLeft: 6 },
  distanceText: { fontSize: 8, marginLeft: 3, fontFamily: typography.fontFamily.semiBold },
  specialtiesRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 5 },
  specialtyChip: { maxWidth: "100%", paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, flexDirection: "row", alignItems: "center" },
  specialtyText: { fontSize: 7.5, fontFamily: typography.fontFamily.medium },
  categoriesRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 7, gap: 5 },
  categoryPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 20, borderWidth: 1, gap: 4 },
  categoryPillText: { fontSize: 7, fontFamily: typography.fontFamily.semiBold },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EEF1F5" },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: 8, marginLeft: 4, fontFamily: typography.fontFamily.regular },
  metaDivider: { width: 1, height: 16, backgroundColor: "#E5E8ED", marginHorizontal: 8 },
  addressRow: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  addressText: { flex: 1, fontSize: 8, marginLeft: 4, fontFamily: typography.fontFamily.regular },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 11 },
  statusBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8 },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 7.5, fontFamily: typography.fontFamily.medium },
  bookButton: { minWidth: 116, height: 36, paddingHorizontal: 10, borderRadius: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  bookButtonText: { fontSize: 9, fontFamily: typography.fontFamily.semiBold },

  mapContainer: { marginHorizontal: 16, height: Math.min(height * 0.68, 640), minHeight: 480, borderRadius: 23, overflow: "hidden", position: "relative", backgroundColor: "#E5E7EB" },
  mapContainerTablet: { height: Math.min(height * 0.75, 720), minHeight: 540 },
  mapContainerDesktop: { height: Math.min(height * 0.82, 840), minHeight: 620, marginHorizontal: 24 },
  map: { flex: 1 },
  mapTopBadge: { position: "absolute", top: 12, left: 12, minHeight: 35, paddingHorizontal: 9, borderRadius: 11, flexDirection: "row", alignItems: "center" },
  mapTopIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: `${PRIMARY}12`, alignItems: "center", justifyContent: "center", marginRight: 5 },
  mapTopText: { fontSize: 8.5, fontFamily: typography.fontFamily.semiBold },
  mapTypeButton: { position: "absolute", top: 12, right: 12, height: 35, paddingHorizontal: 9, borderRadius: 11, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  mapTypeButtonText: { fontSize: 8, fontFamily: typography.fontFamily.semiBold },
  myLocationButton: { position: "absolute", right: 12, bottom: 128, width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  mapLegend: { position: "absolute", left: 12, bottom: 12, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 11 },
  legendItem: { flexDirection: "row", alignItems: "center", marginVertical: 2 },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  legendText: { fontSize: 7, fontFamily: typography.fontFamily.medium },

  selectedPanel: { position: "absolute", left: 10, right: 10, bottom: 10, borderRadius: 20, padding: 13 },
  panelClose: { position: "absolute", right: 9, top: 9, width: 27, height: 27, borderRadius: 9, backgroundColor: "rgba(127,127,127,0.10)", alignItems: "center", justifyContent: "center", zIndex: 3 },
  panelHeader: { flexDirection: "row", alignItems: "center", paddingRight: 25 },
  panelAvatar: { width: 45, height: 45, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 9 },
  panelAvatarText: { color: PRIMARY, fontSize: 18, fontFamily: typography.fontFamily.bold },
  panelInfo: { flex: 1 },
  panelName: { fontSize: 13, fontFamily: typography.fontFamily.bold },
  panelRating: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  panelRatingText: { color: "#D98B00", fontSize: 9, marginLeft: 3, fontFamily: typography.fontFamily.semiBold },
  panelReviews: { fontSize: 8, marginLeft: 3, fontFamily: typography.fontFamily.regular },
  panelAvailable: { flexDirection: "row", alignItems: "center", marginLeft: 5 },
  panelAvailableDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  panelAvailableText: { fontSize: 7, fontFamily: typography.fontFamily.medium },
  panelStats: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EEF1F5" },
  panelStat: { flexDirection: "row", alignItems: "center", flex: 1 },
  panelStatLabel: { fontSize: 7, marginLeft: 5, fontFamily: typography.fontFamily.regular },
  panelStatValue: { fontSize: 9, marginLeft: 5, marginTop: 1, fontFamily: typography.fontFamily.bold },
  panelPriceContainer: { alignItems: "flex-end" },
  panelPrice: { color: PRIMARY, fontSize: 12, fontFamily: typography.fontFamily.bold },
  panelButton: { height: 38, marginTop: 11, borderRadius: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  panelButtonText: { color: "#FFFFFF", fontSize: 9.5, fontFamily: typography.fontFamily.semiBold },

  loadingContainer: { alignItems: "center", paddingHorizontal: 30, paddingVertical: 60 },
  loadingIcon: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  loadingTitle: { fontSize: 15, marginTop: 14, fontFamily: typography.fontFamily.bold },
  loadingSubtitle: { textAlign: "center", fontSize: 9.5, lineHeight: 15, marginTop: 5, fontFamily: typography.fontFamily.regular },

  emptyState: { alignItems: "center", paddingHorizontal: 30, paddingVertical: 60 },
  emptyIcon: { width: 76, height: 76, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, marginTop: 16, textAlign: "center", fontFamily: typography.fontFamily.bold },
  emptySubtitle: { fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 6, fontFamily: typography.fontFamily.regular },
  resetButton: { marginTop: 17, minHeight: 40, paddingHorizontal: 17, borderRadius: 12, backgroundColor: PRIMARY, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  resetButtonText: { color: "#FFFFFF", fontSize: 9.5, fontFamily: typography.fontFamily.semiBold },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "flex-end" },
  modalKeyboard: { width: "100%", maxHeight: "90%" },
  filterModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 15 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#C9CDD4", marginBottom: 15 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  modalTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold },
  modalSubtitle: { fontSize: 9, marginTop: 3, maxWidth: 260, fontFamily: typography.fontFamily.regular },
  modalClose: { width: 35, height: 35, borderRadius: 11, backgroundColor: "rgba(127,127,127,0.10)", alignItems: "center", justifyContent: "center" },
  modalGroup: { marginBottom: 21 },
  modalGroupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalGroupTitle: { fontSize: 13, fontFamily: typography.fontFamily.bold },
  modalGroupHint: { fontSize: 8.5, marginTop: 3, fontFamily: typography.fontFamily.regular },
  selectedValueBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: `${PRIMARY}10` },
  selectedValueText: { color: PRIMARY, fontSize: 8.5, fontFamily: typography.fontFamily.bold },
  modalOptionsRow: { flexDirection: "row", gap: 7 },
  modalOption: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  modalOptionText: { fontSize: 9, fontFamily: typography.fontFamily.semiBold },
  priceModalValue: { color: PRIMARY, fontSize: 12, fontFamily: typography.fontFamily.bold },
  priceModalOption: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  priceModalText: { fontSize: 10, fontFamily: typography.fontFamily.semiBold },
  sortOptions: { marginTop: 10, gap: 7 },
  sortModalOption: { minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, flexDirection: "row", alignItems: "center" },
  sortModalIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 9 },
  sortModalText: { flex: 1, fontSize: 9.5, fontFamily: typography.fontFamily.semiBold },
  aiInfoCard: { borderRadius: 16, padding: 11, flexDirection: "row", backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#C9F0D8", marginBottom: 10 },
  aiInfoIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#D9F7E5", alignItems: "center", justifyContent: "center", marginRight: 9 },
  aiInfoContent: { flex: 1 },
  aiInfoTitle: { color: "#14532D", fontSize: 10, fontFamily: typography.fontFamily.bold },
  aiInfoText: { color: "#52705B", fontSize: 8, lineHeight: 13, marginTop: 3, fontFamily: typography.fontFamily.regular },
  modalActions: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 8 },
  resetModalButton: { flex: 0.85, height: 47, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(127,127,127,0.08)" },
  resetModalText: { fontSize: 9.5, fontFamily: typography.fontFamily.semiBold },
  applyModalButton: { flex: 1.6, height: 47, borderRadius: 13, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  applyModalText: { color: "#FFFFFF", fontSize: 9.5, fontFamily: typography.fontFamily.semiBold },
});

export default SearchMassageScreen;