import React, { 
  useState, 
  useCallback, 
  useMemo, 
  useEffect, 
} from 'react'; 
 
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  RefreshControl, 
  Alert, 
  Modal, 
  ScrollView, 
  SafeAreaView, 
  Switch, 
  Image, 
  Platform, 
  Linking, 
  KeyboardAvoidingView, 
  Dimensions, 
} from 'react-native'; 
 
import { Ionicons } from '@expo/vector-icons'; 
import { useFocusEffect } from '@react-navigation/native'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useTheme } from '../../context/ThemeContext'; 
import { colors, spacing, typography } from '../../theme'; 
import Header from '../../components/common/Header'; 
import adminService from '../../services/adminService'; 
import AdminUserAddressModal from '../../components/admin/AdminUserAddressModal'; 
import useResponsive from '../../hooks/useResponsive'; 
import { API_URL } from '../../config/env'; 
 
const IS_WEB = Platform.OS === 'web'; 
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window'); 
 
/* ============================================================ 
   CONFIG 
============================================================ */ 
 
const ITEMS_PER_PAGE = 10; 
 
/* ============================================================ 
   ADDRESS UTILITIES 
============================================================ */ 
 
const getFullAddress = (item) => { 
  if (!item) { 
    return 'Adresse non renseignée'; 
  } 
 
  if ( 
    typeof item.address === 'string' && 
    item.address.trim() 
  ) { 
    return item.address.trim(); 
  } 
 
  if ( 
    item.address && 
    typeof item.address === 'object' 
  ) { 
    const addressObject = item.address; 
 
    const parts = [ 
      addressObject.house_number, 
      addressObject.number, 
      addressObject.street_number, 
      addressObject.street, 
      addressObject.road, 
      addressObject.route, 
      addressObject.neighborhood, 
      addressObject.quartier, 
      addressObject.district, 
      addressObject.commune, 
      addressObject.city, 
      addressObject.town, 
      addressObject.village, 
      addressObject.region, 
      addressObject.province, 
      addressObject.state, 
      addressObject.postal_code, 
      addressObject.country, 
    ]; 
 
    const uniqueParts = [ 
      ...new Set( 
        parts 
          .filter(Boolean) 
          .map((value) => String(value).trim()) 
          .filter(Boolean) 
      ), 
    ]; 
 
    if (uniqueParts.length > 0) { 
      return uniqueParts.join(', '); 
    } 
  } 
 
  if ( 
    typeof item.formatted_address === 'string' && 
    item.formatted_address.trim() 
  ) { 
    return item.formatted_address.trim(); 
  } 
 
  const parts = [ 
    item.house_number, 
    item.street_number, 
    item.street, 
    item.road, 
    item.route, 
    item.address_line, 
    item.address_line1, 
    item.address_line2, 
    item.neighborhood, 
    item.quartier, 
    item.fokontany, 
    item.district, 
    item.commune, 
    item.city, 
    item.town, 
    item.village, 
    item.region, 
    item.province, 
    item.state, 
    item.postal_code, 
    item.zip_code, 
    item.country, 
  ]; 
 
  const uniqueParts = [ 
    ...new Set( 
      parts 
        .filter(Boolean) 
        .map((value) => String(value).trim()) 
        .filter(Boolean) 
    ), 
  ]; 
 
  if (uniqueParts.length > 0) { 
    return uniqueParts.join(', '); 
  } 
 
  const fallbackParts = [ 
    item.location_name, 
    item.location, 
    item.locality, 
  ]; 
 
  const fallback = fallbackParts 
    .filter(Boolean) 
    .map((value) => String(value).trim()) 
    .filter(Boolean); 
 
  if (fallback.length > 0) { 
    return [...new Set(fallback)].join(', '); 
  } 
 
  return 'Adresse non renseignée'; 
}; 
 
const getLatitude = (item) => { 
  if (!item) return null; 
 
  const value = 
    item.latitude ?? 
    item.lat ?? 
    item.location?.latitude ?? 
    item.last_location?.latitude ?? 
    item.last_location?.coordinates?.[1]; 
 
  if ( 
    value === null || 
    value === undefined || 
    value === '' 
  ) { 
    return null; 
  } 
 
  const number = Number(value); 
 
  return Number.isFinite(number) 
    ? number 
    : null; 
}; 
 
const getLongitude = (item) => { 
  if (!item) return null; 
 
  const value = 
    item.longitude ?? 
    item.lng ?? 
    item.lon ?? 
    item.location?.longitude ?? 
    item.last_location?.longitude ?? 
    item.last_location?.coordinates?.[0]; 
 
  if ( 
    value === null || 
    value === undefined || 
    value === '' 
  ) { 
    return null; 
  } 
 
  const number = Number(value); 
 
  return Number.isFinite(number) 
    ? number 
    : null; 
}; 
 
/* ============================================================ 
   MAIN COMPONENT 
============================================================ */ 
 
const TherapistsScreen = ({ navigation }) => { 
  const { colors: themeColors } = useTheme(); 
 
  const { 
    isTablet, 
    isDesktop, 
    isLargeScreen, 
    horizontalPadding, 
  } = useResponsive(); 
 
  /* ========================================================== 
     STATE 
  ========================================================== */ 
 
  const [therapists, setTherapists] = useState([]); 
  const [filteredTherapists, setFilteredTherapists] = useState([]); 
 
  const [loading, setLoading] = useState(true); 
  const [refreshing, setRefreshing] = useState(false); 
 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [selectedFilter, setSelectedFilter] = useState('all'); 
 
  const [currentPage, setCurrentPage] = useState(1); 
 
  const [selectedTherapist, setSelectedTherapist] = 
    useState(null); 
 
  const [showModal, setShowModal] = useState(false); 
 
  const [loadingCertificate, setLoadingCertificate] = 
    useState(false); 
 
  const [certificateInfo, setCertificateInfo] = 
    useState(null); 
 
  const [error, setError] = useState(null); 
 
  const [showAddressModal, setShowAddressModal] = 
    useState(false); 
 
  const [selectedUserForAddress, setSelectedUserForAddress] = 
    useState(null); 
 
  const [confirmModalVisible, setConfirmModalVisible] = 
    useState(false); 
 
  const [confirmModalConfig, setConfirmModalConfig] = 
    useState({ 
      title: '', 
      message: '', 
      onConfirm: () => {}, 
      destructive: false, 
    }); 
 
  /* ========================================================== 
     TOAST 
  ========================================================== */ 
 
  const [toast, setToast] = useState(null); 
 
  const showToast = useCallback( 
    ( 
      message, 
      type = 'success', 
      duration = 3000 
    ) => { 
      setToast({ 
        id: Date.now(), 
        message, 
        type, 
      }); 
 
      setTimeout(() => { 
        setToast((current) => { 
          if (!current) return null; 
          return null; 
        }); 
      }, duration); 
    }, 
    [] 
  ); 
 
  /* ========================================================== 
     FILTERS 
  ========================================================== */ 
 
  const filters = [ 
    { 
      id: 'all', 
      label: 'Tous', 
      icon: 'people-outline', 
    }, 
    { 
      id: 'approved', 
      label: 'Vérifiés', 
      icon: 'checkmark-circle-outline', 
    }, 
    { 
      id: 'pending', 
      label: 'En attente', 
      icon: 'time-outline', 
    }, 
    { 
      id: 'rejected', 
      label: 'Rejetés', 
      icon: 'close-circle-outline', 
    }, 
    { 
      id: 'online', 
      label: 'En ligne', 
      icon: 'radio-button-on-outline', 
    }, 
  ]; 
 
  /* ========================================================== 
     LOAD 
  ========================================================== */ 
 
  useFocusEffect( 
    useCallback(() => { 
      loadTherapists(); 
 
      // eslint-disable-next-line react-hooks/exhaustive-deps 
    }, []) 
  ); 
 
  const loadTherapists = async () => { 
    setLoading(true); 
    setError(null); 
 
    try { 
      const params = { 
        limit: 200, 
      }; 
 
      const data = 
        await adminService.getTherapists(params); 
 
      if (Array.isArray(data)) { 
        setTherapists(data); 
 
        applyFilters( 
          searchQuery, 
          selectedFilter, 
          data 
        ); 
 
        setCurrentPage(1); 
 
        if (data.length === 0) { 
          setError( 
            'Aucun thérapeute trouvé dans la base de données' 
          ); 
        } 
      } else { 
        setTherapists([]); 
        setFilteredTherapists([]); 
        setError( 
          'Aucun thérapeute trouvé dans la base de données' 
        ); 
      } 
    } catch (err) { 
      console.error( 
        '❌ Error loading therapists:', 
        err 
      ); 
 
      let errorMessage = 
        'Impossible de charger les thérapeutes'; 
 
      if (err.response) { 
        const serverError = 
          err.response.data; 
 
        errorMessage = 
          serverError?.message || 
          serverError?.detail || 
          `Erreur ${err.response.status}`; 
      } else if (err.request) { 
        errorMessage = 
          'Impossible de contacter le serveur'; 
      } else { 
        errorMessage = 
          err.message || 
          'Erreur inconnue'; 
      } 
 
      setError(errorMessage); 
      setTherapists([]); 
      setFilteredTherapists([]); 
 
      showToast( 
        errorMessage, 
        'error' 
      ); 
    } finally { 
      setLoading(false); 
    } 
  }; 
 
  const onRefresh = async () => { 
    setRefreshing(true); 
 
    await loadTherapists(); 
 
    setRefreshing(false); 
  }; 
 
  /* ========================================================== 
     FILTER 
  ========================================================== */ 
 
  const applyFilters = ( 
    query, 
    filter, 
    sourceData = therapists 
  ) => { 
    let result = [...sourceData]; 
 
    if ( 
      query && 
      query.trim() 
    ) { 
      const q = 
        query 
          .toLowerCase() 
          .trim(); 
 
      result = result.filter( 
        (therapist) => { 
          const address = 
            getFullAddress( 
              therapist 
            ).toLowerCase(); 
 
          return ( 
            therapist.fullname 
              ?.toLowerCase() 
              .includes(q) || 
            therapist.email 
              ?.toLowerCase() 
              .includes(q) || 
            therapist.phone 
              ?.toLowerCase() 
              .includes(q) || 
            therapist.cin_number 
              ?.toLowerCase() 
              .includes(q) || 
            address.includes(q) 
          ); 
        } 
      ); 
    } 
 
    if (filter === 'approved') { 
      result = result.filter( 
        (item) => 
          item.verification_status === 
          'approved' 
      ); 
    } 
 
    if (filter === 'pending') { 
      result = result.filter( 
        (item) => 
          item.verification_status === 
          'pending' 
      ); 
    } 
 
    if (filter === 'rejected') { 
      result = result.filter( 
        (item) => 
          item.verification_status === 
          'rejected' 
      ); 
    } 
 
    if (filter === 'online') { 
      result = result.filter( 
        (item) => 
          item.is_online === true 
      ); 
    } 
 
    setFilteredTherapists(result); 
  }; 
 
  const handleSearch = (text) => { 
    setSearchQuery(text); 
    setCurrentPage(1); 
 
    applyFilters( 
      text, 
      selectedFilter 
    ); 
  }; 
 
  const handleFilter = (filter) => { 
    setSelectedFilter(filter); 
    setCurrentPage(1); 
 
    applyFilters( 
      searchQuery, 
      filter 
    ); 
  }; 
 
  /* ========================================================== 
     RE-FILTER WHEN DATA CHANGES 
  ========================================================== */ 
 
  useEffect(() => { 
    applyFilters( 
      searchQuery, 
      selectedFilter, 
      therapists 
    ); 
 
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [therapists]); 
 
  /* ========================================================== 
     PAGINATION 
  ========================================================== */ 
 
  const totalPages = Math.max( 
    1, 
    Math.ceil( 
      filteredTherapists.length / 
        ITEMS_PER_PAGE 
    ) 
  ); 
 
  const paginatedTherapists = 
    useMemo(() => { 
      const start = 
        (currentPage - 1) * 
        ITEMS_PER_PAGE; 
 
      return filteredTherapists.slice( 
        start, 
        start + ITEMS_PER_PAGE 
      ); 
    }, [ 
      filteredTherapists, 
      currentPage, 
    ]); 
 
  useEffect(() => { 
    if ( 
      currentPage > 
      totalPages 
    ) { 
      setCurrentPage(totalPages); 
    } 
  }, [ 
    currentPage, 
    totalPages, 
  ]); 
 
  /* ========================================================== 
     CERTIFICATE 
  ========================================================== */ 
 
  const loadCertificateInfo = 
    async (therapistId) => { 
      setLoadingCertificate(true); 
      setCertificateInfo(null); 
 
      try { 
        const data = 
          await adminService.getTherapistCertificateInfo( 
            therapistId 
          ); 
 
        setCertificateInfo(data); 
      } catch (err) { 
        console.error( 
          '❌ Erreur certificat:', 
          err 
        ); 
 
        setCertificateInfo(null); 
      } finally { 
        setLoadingCertificate(false); 
      } 
    }; 
 
  /* ========================================================== 
     OPEN DETAILS 
  ========================================================== */ 
 
  const openTherapistDetails = ( 
    therapist 
  ) => { 
    setSelectedTherapist( 
      therapist 
    ); 
 
    setShowModal(true); 
 
    loadCertificateInfo( 
      therapist.id 
    ); 
  }; 
 
  /* ========================================================== 
     DOWNLOAD 
  ========================================================== */ 
 
  // ✅ Récupère le token JWT stocké côté client, quelle que soit la clé 
  // utilisée par le AuthContext (adapte la liste ci-dessous si besoin). 
  const getAuthToken = async () => { 
    const possibleKeys = [ 
      'authToken', 
      'token', 
      'accessToken', 
      'access_token', 
      'jwt', 
      'userToken', 
    ]; 
 
    try { 
      for (const key of possibleKeys) { 
        const value = await AsyncStorage.getItem(key); 
 
        if (value) { 
          // Certains projets stockent directement le token, 
          // d'autres stockent un objet JSON { token: '...' } 
          try { 
            const parsed = JSON.parse(value); 
 
            if (parsed && typeof parsed === 'object' && parsed.token) { 
              return parsed.token; 
            } 
          } catch { 
            // value n'est pas du JSON, c'est probablement le token brut 
          } 
 
          return value; 
        } 
      } 
    } catch (err) { 
      console.warn('Impossible de récupérer le token auth:', err); 
    } 
 
    return null; 
  }; 
 
  const handleDownload = async ( 
    url, 
    suggestedFileName = 'document.pdf' 
  ) => { 
    if (!url) { 
      showToast( 
        'Document indisponible', 
        'error' 
      ); 
 
      return; 
    } 
 
    try { 
      const fullUrl = 
        url.startsWith('http') 
          ? url 
          : `${API_URL}${url}`; 
 
      if (IS_WEB) { 
        // ✅ Sur le web, window.open() fait une simple navigation 
        // du navigateur : aucun header Authorization n'est envoyé, 
        // donc l'endpoint protégé (admin) le refuse. 
        // On récupère le token JWT et on télécharge le fichier 
        // nous-même en blob, puis on force le téléchargement. 
        const token = await getAuthToken(); 
 
        const response = await fetch(fullUrl, { 
          headers: token 
            ? { Authorization: `Bearer ${token}` } 
            : {}, 
        }); 
 
        if (!response.ok) { 
          if (response.status === 401 || response.status === 403) { 
            throw new Error( 
              'Accès refusé : vous devez être connecté en tant qu\'administrateur' 
            ); 
          } 
 
          throw new Error(`Erreur ${response.status}`); 
        } 
 
        const blob = await response.blob(); 
        const blobUrl = window.URL.createObjectURL(blob); 
 
        // Essaye de récupérer le nom de fichier renvoyé par le serveur 
        let fileName = suggestedFileName; 
        const disposition = response.headers.get('content-disposition'); 
 
        if (disposition) { 
          const match = disposition.match(/filename="?([^"]+)"?/); 
 
          if (match && match[1]) { 
            fileName = match[1]; 
          } 
        } 
 
        const link = document.createElement('a'); 
        link.href = blobUrl; 
        link.download = fileName; 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
 
        window.URL.revokeObjectURL(blobUrl); 
 
        showToast( 
          'Téléchargement démarré', 
          'success' 
        ); 
      } else { 
        const canOpen = 
          await Linking.canOpenURL( 
            fullUrl 
          ); 
 
        if (canOpen) { 
          await Linking.openURL( 
            fullUrl 
          ); 
        } else { 
          showToast( 
            'Impossible d’ouvrir le document', 
            'error' 
          ); 
        } 
      } 
    } catch (err) { 
      console.error( 
        'Download error:', 
        err 
      ); 
 
      showToast( 
        err?.message || 'Échec du téléchargement', 
        'error' 
      ); 
    } 
  }; 
 
  /* ========================================================== 
     CONFIRM HELPER 
  ========================================================== */ 
 
  const confirmAction = ( 
    title, 
    message, 
    onConfirm, 
    destructive = false 
  ) => { 
    // ✅ react-native-web n'implémente pas Alert.alert : sur le web, 
    // l'appel ne fait rien et aucune boîte de dialogue n'apparaît. 
    // On affiche donc une modale personnalisée stylée sur le web, 
    // et on garde Alert.alert natif sur Android/iOS (déjà fonctionnel). 
    if (IS_WEB) { 
      setConfirmModalConfig({ 
        title, 
        message, 
        onConfirm, 
        destructive, 
      }); 
 
      setConfirmModalVisible(true); 
 
      return; 
    } 
 
    Alert.alert( 
      title, 
      message, 
      [ 
        { 
          text: 'Annuler', 
          style: 'cancel', 
        }, 
        { 
          text: 'Confirmer', 
          style: 
            destructive 
              ? 'destructive' 
              : 'default', 
          onPress: 
            onConfirm, 
        }, 
      ] 
    ); 
  }; 
 
  /* ========================================================== 
     ONLINE STATUS 
  ========================================================== */ 
 
  const toggleOnlineStatus = ( 
    therapist 
  ) => { 
    if (!therapist?.id) return; 
 
    const newStatus = 
      !therapist.is_online; 
 
    const statusText = 
      newStatus 
        ? 'en ligne' 
        : 'hors ligne'; 
 
    confirmAction( 
      newStatus 
        ? 'Mettre en ligne' 
        : 'Mettre hors ligne', 
      `Voulez-vous mettre ${ 
        therapist.fullname || 
        'ce thérapeute' 
      } ${statusText} ?`, 
      async () => { 
        try { 
          await adminService.toggleTherapistStatus( 
            therapist.id, 
            newStatus 
          ); 
 
          await loadTherapists(); 
 
          setSelectedTherapist( 
            (prev) => 
              prev 
                ? { 
                    ...prev, 
                    is_online: 
                      newStatus, 
                  } 
                : prev 
          ); 
 
          showToast( 
            `Thérapeute ${statusText} avec succès`, 
            'success' 
          ); 
        } catch (err) { 
          showToast( 
            `Impossible de modifier le statut`, 
            'error' 
          ); 
        } 
      } 
    ); 
  }; 
 
  /* ========================================================== 
     ACTIVE STATUS 
  ========================================================== */ 
 
  const toggleActiveStatus = ( 
    therapist 
  ) => { 
    if (!therapist?.id) return; 
 
    const newStatus = 
      !therapist.is_active; 
 
    const action = 
      newStatus 
        ? 'activer' 
        : 'désactiver'; 
 
    confirmAction( 
      `${ 
        newStatus 
          ? 'Activer' 
          : 'Désactiver' 
      } le compte`, 
      `Voulez-vous ${action} le compte de ${ 
        therapist.fullname || 
        'ce thérapeute' 
      } ?`, 
      async () => { 
        try { 
          await adminService.toggleUserStatus( 
            therapist.id, 
            newStatus 
          ); 
 
          await loadTherapists(); 
 
          setSelectedTherapist( 
            (prev) => 
              prev 
                ? { 
                    ...prev, 
                    is_active: 
                      newStatus, 
                  } 
                : prev 
          ); 
 
          showToast( 
            `Compte ${ 
              newStatus 
                ? 'activé' 
                : 'désactivé' 
            } avec succès`, 
            'success' 
          ); 
        } catch (err) { 
          showToast( 
            `Impossible de ${action} le compte`, 
            'error' 
          ); 
        } 
      } 
    ); 
  }; 
 
  /* ========================================================== 
     DELETE 
  ========================================================== */ 
 
  const handleDeleteTherapist = ( 
    therapist 
  ) => { 
    if (!therapist?.id) return; 
 
    confirmAction( 
      'Suppression définitive', 
      `Voulez-vous supprimer définitivement ${ 
        therapist.fullname || 
        'ce thérapeute' 
      } ? Cette action est irréversible.`, 
      async () => { 
        try { 
          await adminService.deleteUser( 
            therapist.id, 
            true 
          ); 
 
          setShowModal(false); 
          setSelectedTherapist(null); 
 
          await loadTherapists(); 
 
          showToast( 
            'Thérapeute supprimé définitivement', 
            'success' 
          ); 
        } catch (err) { 
          showToast( 
            'Impossible de supprimer le thérapeute', 
            'error' 
          ); 
        } 
      }, 
      true 
    ); 
  }; 
 
  /* ========================================================== 
     STATUS 
  ========================================================== */ 
 
  const getStatusColor = ( 
    status 
  ) => { 
    const map = { 
      approved: '#27AE60', 
      pending: '#F5A623', 
      rejected: '#E74C3C', 
    }; 
 
    return ( 
      map[status] || 
      '#999999' 
    ); 
  }; 
 
  const getStatusLabel = ( 
    status 
  ) => { 
    const map = { 
      approved: 'Vérifié', 
      pending: 'En attente', 
      rejected: 'Rejeté', 
    }; 
 
    return ( 
      map[status] || 
      'Non défini' 
    ); 
  }; 
 
  const getActiveStatusColor = ( 
    active 
  ) => 
    active 
      ? '#27AE60' 
      : '#E74C3C'; 
 
  const getActiveStatusLabel = ( 
    active 
  ) => 
    active 
      ? 'Actif' 
      : 'Inactif'; 
 
  const formatDate = ( 
    dateString 
  ) => { 
    if (!dateString) { 
      return 'N/A'; 
    } 
 
    try { 
      const date = 
        new Date(dateString); 
 
      return `${date.getFullYear()}-${String( 
        date.getMonth() + 1 
      ).padStart(2, '0')}-${String( 
        date.getDate() 
      ).padStart(2, '0')}`; 
    } catch { 
      return dateString; 
    } 
  }; 
 
  /* ========================================================== 
     AVATAR 
  ========================================================== */ 
 
  const Avatar = ({ 
    therapist, 
    size = 44, 
  }) => { 
    const initials = 
      therapist?.fullname 
        ?.charAt(0) 
        ?.toUpperCase() || 
      '?'; 
 
    return ( 
      <View 
        style={[ 
          styles.avatarWrapper, 
          { 
            width: size, 
            height: size, 
            borderRadius: 
              size * 0.28, 
          }, 
        ]} 
      > 
        {therapist?.profile_image ? ( 
          <Image 
            source={{ 
              uri: therapist.profile_image, 
            }} 
            style={{ 
              width: size, 
              height: size, 
              borderRadius: 
                size * 0.28, 
            }} 
          /> 
        ) : ( 
          <View 
            style={[ 
              styles.avatarFallback, 
              { 
                width: size, 
                height: size, 
                borderRadius: 
                  size * 0.28, 
                backgroundColor: 
                  colors.primary + 
                  '18', 
              }, 
            ]} 
          > 
            <Text 
              style={[ 
                styles.avatarText, 
                { 
                  color: 
                    colors.primary, 
                  fontSize: 
                    size * 0.4, 
                }, 
              ]} 
            > 
              {initials} 
            </Text> 
          </View> 
        )} 
 
        <View 
          style={[ 
            styles.avatarOnline, 
            { 
              backgroundColor: 
                therapist?.is_online 
                  ? '#27AE60' 
                  : '#999999', 
              width: 
                Math.max(size * 0.28, 12), 
              height: 
                Math.max(size * 0.28, 12), 
              borderRadius: 
                Math.max(size * 0.28, 12) / 2, 
              borderColor: 
                themeColors.surface || '#fff', 
              right: 
                -Math.max(size * 0.28, 12) * 0.12, 
              bottom: 
                -Math.max(size * 0.28, 12) * 0.12, 
            }, 
          ]} 
        /> 
      </View> 
    ); 
  }; 
 
  /* ========================================================== 
     STATUS BADGE 
  ========================================================== */ 
 
  const StatusBadge = ({ 
    label, 
    color, 
    dot = false, 
  }) => ( 
    <View 
      style={[ 
        styles.statusBadge, 
        { 
          backgroundColor: 
            color + '14', 
        }, 
      ]} 
    > 
      {dot && ( 
        <View 
          style={[ 
            styles.statusBadgeDot, 
            { 
              backgroundColor: 
                color, 
            }, 
          ]} 
        /> 
      )} 
 
      <Text 
        numberOfLines={1} 
        style={[ 
          styles.statusBadgeText, 
          { 
            color, 
          }, 
        ]} 
      > 
        {label} 
      </Text> 
    </View> 
  ); 
 
  /* ========================================================== 
     WEB TABLE ROW 
  ========================================================== */ 
 
  const WebTableRow = ({ 
    item, 
  }) => { 
    const [hovered, setHovered] = 
      useState(false); 
 
    const address = 
      getFullAddress(item); 
 
    return ( 
      <TouchableOpacity 
        activeOpacity={0.85} 
        onPress={() => 
          openTherapistDetails(item) 
        } 
        {...(IS_WEB 
          ? { 
              onMouseEnter: () => 
                setHovered(true), 
              onMouseLeave: () => 
                setHovered(false), 
            } 
          : {})} 
        style={[ 
          styles.webTableRow, 
          { 
            backgroundColor: 
              hovered 
                ? themeColors.background 
                : themeColors.surface, 
          }, 
        ]} 
      > 
        {/* THERAPEUTE */} 
        <View 
          style={[ 
            styles.webCell, 
            styles.webCellTherapist, 
          ]} 
        > 
          <Avatar 
            therapist={item} 
            size={42} 
          /> 
 
          <View 
            style={ 
              styles.webTherapistInfo 
            } 
          > 
            <Text 
              numberOfLines={1} 
              style={[ 
                styles.webName, 
                { 
                  color: 
                    themeColors.text, 
                }, 
              ]} 
            > 
              {item.fullname || 
                'Thérapeute'} 
            </Text> 
 
            <Text 
              numberOfLines={1} 
              style={[ 
                styles.webEmail, 
                { 
                  color: 
                    themeColors 
                      .textSecondary, 
                }, 
              ]} 
            > 
              {item.email || 
                'Email non renseigné'} 
            </Text> 
          </View> 
        </View> 
 
        {/* TELEPHONE */} 
        <View 
          style={styles.webCell} 
        > 
          <Text 
            numberOfLines={1} 
            style={[ 
              styles.webCellText, 
              { 
                color: 
                  themeColors.text, 
              }, 
            ]} 
          > 
            {item.phone || 
              'N/A'} 
          </Text> 
        </View> 
 
        {/* CIN */} 
        <View 
          style={styles.webCell} 
        > 
          <Text 
            numberOfLines={1} 
            style={[ 
              styles.webCellText, 
              { 
                color: 
                  item.cin_number 
                    ? themeColors.text 
                    : '#E74C3C', 
              }, 
            ]} 
          > 
            {item.cin_number || 
              'Non renseigné'} 
          </Text> 
        </View> 
 
        {/* ADRESSE */} 
        <View 
          style={[ 
            styles.webCell, 
            styles.webAddressCell, 
          ]} 
        > 
          <Ionicons 
            name="location-outline" 
            size={16} 
            color={colors.primary} 
          /> 
 
          <Text 
            numberOfLines={2} 
            style={[ 
              styles.webCellText, 
              { 
                color: 
                  themeColors 
                    .textSecondary, 
              }, 
            ]} 
          > 
            {address} 
          </Text> 
        </View> 
 
        {/* VERIFICATION */} 
        <View 
          style={styles.webCell} 
        > 
          <StatusBadge 
            label={getStatusLabel( 
              item.verification_status 
            )} 
            color={getStatusColor( 
              item.verification_status 
            )} 
          /> 
        </View> 
 
        {/* ACTIF */} 
        <View 
          style={styles.webCell} 
        > 
          <StatusBadge 
            label={getActiveStatusLabel( 
              item.is_active 
            )} 
            color={getActiveStatusColor( 
              item.is_active 
            )} 
          /> 
        </View> 
 
        {/* ONLINE */} 
        <View 
          style={styles.webCell} 
        > 
          <StatusBadge 
            label={ 
              item.is_online 
                ? 'En ligne' 
                : 'Hors ligne' 
            } 
            color={ 
              item.is_online 
                ? '#27AE60' 
                : '#999999' 
            } 
            dot 
          /> 
        </View> 
 
        {/* PRIX */} 
        <View 
          style={styles.webCell} 
        > 
          <Text 
            style={[ 
              styles.webPrice, 
              { 
                color: 
                  colors.primary, 
              }, 
            ]} 
          > 
            {Number( 
              item.base_price || 0 
            ).toLocaleString()}{' '} 
            Ar 
          </Text> 
        </View> 
 
        {/* ACTION */} 
        <View 
          style={[ 
            styles.webCell, 
            styles.webActionCell, 
          ]} 
        > 
          <TouchableOpacity 
            style={[ 
              styles.webIconButton, 
              { 
                backgroundColor: 
                  colors.primary + 
                  '12', 
              }, 
            ]} 
            onPress={(e) => { 
              e?.stopPropagation?.(); 
              openTherapistDetails( 
                item 
              ); 
            }} 
          > 
            <Ionicons 
              name="eye-outline" 
              size={16} 
              color={ 
                colors.primary 
              } 
            /> 
          </TouchableOpacity> 
 
          <TouchableOpacity 
            style={[ 
              styles.webIconButton, 
              { 
                backgroundColor: 
                  getActiveStatusColor( 
                    item.is_active 
                  ) + '12', 
              }, 
            ]} 
            onPress={(e) => { 
              e?.stopPropagation?.(); 
              toggleActiveStatus(item); 
            }} 
          > 
            <Ionicons 
              name={ 
                item.is_active 
                  ? 'person-remove-outline' 
                  : 'person-add-outline' 
              } 
              size={16} 
              color={getActiveStatusColor( 
                item.is_active 
              )} 
            /> 
          </TouchableOpacity> 
 
          <TouchableOpacity 
            style={[ 
              styles.webIconButton, 
              { 
                backgroundColor: '#E74C3C12', 
              }, 
            ]} 
            onPress={(e) => { 
              e?.stopPropagation?.(); 
              handleDeleteTherapist(item); 
            }} 
          > 
            <Ionicons 
              name="trash-outline" 
              size={16} 
              color="#E74C3C" 
            /> 
          </TouchableOpacity> 
        </View> 
      </TouchableOpacity> 
    ); 
  }; 
 
  /* ========================================================== 
     MOBILE CARD - FULL SCREEN 
  ========================================================== */ 
 
  const MobileCard = ({ 
    item, 
  }) => { 
    const address = 
      getFullAddress(item); 
 
    return ( 
      <TouchableOpacity 
        activeOpacity={0.92} 
        onPress={() => 
          openTherapistDetails(item) 
        } 
        style={[ 
          styles.mobileCard, 
          { 
            backgroundColor: 
              themeColors.surface, 
          }, 
        ]} 
      > 
        <View 
          style={ 
            styles.mobileCardHeader 
          } 
        > 
          <Avatar 
            therapist={item} 
            size={52} 
          /> 
 
          <View 
            style={ 
              styles.mobileCardIdentity 
            } 
          > 
            <Text 
              numberOfLines={1} 
              style={[ 
                styles.mobileName, 
                { 
                  color: 
                    themeColors.text, 
                }, 
              ]} 
            > 
              {item.fullname || 
                'Thérapeute'} 
            </Text> 
 
            <Text 
              numberOfLines={1} 
              style={[ 
                styles.mobileEmail, 
                { 
                  color: 
                    themeColors 
                      .textSecondary, 
                }, 
              ]} 
            > 
              {item.email || 
                'Email non renseigné'} 
            </Text> 
 
            <View 
              style={ 
                styles.mobileStatusLine 
              } 
            > 
              <StatusBadge 
                label={getStatusLabel( 
                  item.verification_status 
                )} 
                color={getStatusColor( 
                  item.verification_status 
                )} 
              /> 
 
              <StatusBadge 
                label={ 
                  item.is_online 
                    ? 'En ligne' 
                    : 'Hors ligne' 
                } 
                color={ 
                  item.is_online 
                    ? '#27AE60' 
                    : '#999999' 
                } 
                dot 
              /> 
            </View> 
          </View> 
 
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={ 
              themeColors 
                .textSecondary 
            } 
          /> 
        </View> 
 
        <View 
          style={[ 
            styles.mobileDivider, 
            { 
              backgroundColor: 
                themeColors.border || 
                '#E8E8E8', 
            }, 
          ]} 
        /> 
 
        <View 
          style={ 
            styles.mobileInfoGrid 
          } 
        > 
          <MobileInfo 
            icon="call-outline" 
            label="Téléphone" 
            value={ 
              item.phone || 'N/A' 
            } 
            themeColors={ 
              themeColors 
            } 
          /> 
 
          <MobileInfo 
            icon="cash-outline" 
            label="Prix" 
            value={`${Number( 
              item.base_price || 0 
            ).toLocaleString()} Ar`} 
            themeColors={ 
              themeColors 
            } 
            valueColor={ 
              colors.primary 
            } 
          /> 
 
          <MobileInfo 
            icon="location-outline" 
            label="Adresse" 
            value={address} 
            themeColors={ 
              themeColors 
            } 
            full 
          /> 
 
          <MobileInfo 
            icon="card-outline" 
            label="CIN" 
            value={ 
              item.cin_number || 
              'Non renseigné' 
            } 
            themeColors={ 
              themeColors 
            } 
          /> 
        </View> 
 
        <View 
          style={ 
            styles.mobileCardFooter 
          } 
        > 
          <TouchableOpacity 
            style={[ 
              styles.mobileFooterButton, 
              { 
                backgroundColor: 
                  colors.primary + 
                  '12', 
              }, 
            ]} 
            onPress={() => { 
              setSelectedUserForAddress( 
                item 
              ); 
 
              setShowAddressModal( 
                true 
              ); 
            }} 
          > 
            <Ionicons 
              name="map-outline" 
              size={16} 
              color={ 
                colors.primary 
              } 
            /> 
 
            <Text 
              style={[ 
                styles.mobileFooterButtonText, 
                { 
                  color: 
                    colors.primary, 
                }, 
              ]} 
            > 
              Carte 
            </Text> 
          </TouchableOpacity> 
 
          <TouchableOpacity 
            style={[ 
              styles.mobileFooterButton, 
              { 
                backgroundColor: 
                  getActiveStatusColor( 
                    item.is_active 
                  ) + '12', 
              }, 
            ]} 
            onPress={() => 
              toggleActiveStatus( 
                item 
              ) 
            } 
          > 
            <Ionicons 
              name={ 
                item.is_active 
                  ? 'person-remove-outline' 
                  : 'person-add-outline' 
              } 
              size={16} 
              color={getActiveStatusColor( 
                item.is_active 
              )} 
            /> 
 
            <Text 
              style={[ 
                styles.mobileFooterButtonText, 
                { 
                  color: 
                    getActiveStatusColor( 
                      item.is_active 
                    ), 
                }, 
              ]} 
            > 
              {item.is_active 
                ? 'Désactiver' 
                : 'Activer'} 
            </Text> 
          </TouchableOpacity> 
        </View> 
      </TouchableOpacity> 
    ); 
  }; 
 
  /* ========================================================== 
     WEB TABLE 
  ========================================================== */ 
 
  const renderWebTable = () => { 
    return ( 
      <View 
        style={[ 
          styles.webTableWrapper, 
          { 
            backgroundColor: 
              themeColors.surface, 
          }, 
        ]} 
      > 
        {/* HEADER */} 
        <View 
          style={[ 
            styles.webTableHeader, 
            { 
              backgroundColor: 
                themeColors.surface, 
            }, 
          ]} 
        > 
          <View 
            style={[ 
              styles.webHeaderCell, 
              styles.webCellTherapist, 
            ]} 
          > 
            <Text 
              style={[ 
                styles.webHeaderText, 
                { 
                  color: 
                    themeColors 
                      .textSecondary, 
                }, 
              ]} 
            > 
              THÉRAPEUTE 
            </Text> 
          </View> 
 
          <HeaderCell 
            label="TÉLÉPHONE" 
            themeColors={ 
              themeColors 
            } 
          /> 
 
          <HeaderCell 
            label="CIN" 
            themeColors={ 
              themeColors 
            } 
          /> 
 
          <View 
            style={[ 
              styles.webHeaderCell, 
              styles.webAddressCell, 
            ]} 
          > 
            <Text 
              style={[ 
                styles.webHeaderText, 
                { 
                  color: 
                    themeColors 
                      .textSecondary, 
                }, 
              ]} 
            > 
              ADRESSE 
            </Text> 
          </View> 
 
          <HeaderCell 
            label="VÉRIFICATION" 
            themeColors={ 
              themeColors 
            } 
          /> 
 
          <HeaderCell 
            label="COMPTE" 
            themeColors={ 
              themeColors 
            } 
          /> 
 
          <HeaderCell 
            label="STATUT" 
            themeColors={ 
              themeColors 
            } 
          /> 
 
          <HeaderCell 
            label="PRIX" 
            themeColors={ 
              themeColors 
            } 
          /> 
 
          <View 
            style={[ 
              styles.webHeaderCell, 
              styles.webActionCell, 
            ]} 
          > 
            <Text 
              style={[ 
                styles.webHeaderText, 
                { 
                  color: 
                    themeColors 
                      .textSecondary, 
                }, 
              ]} 
            > 
              ACTION 
            </Text> 
          </View> 
        </View> 
 
        {/* SCROLL AREA */} 
        <ScrollView 
          style={ 
            styles.webTableScroll 
          } 
          contentContainerStyle={ 
            styles.webTableScrollContent 
          } 
          showsVerticalScrollIndicator 
          nestedScrollEnabled 
        > 
          {paginatedTherapists.map( 
            (item) => ( 
              <WebTableRow 
                key={String(item.id)} 
                item={item} 
              /> 
            ) 
          )} 
 
          <View 
            style={ 
              styles.webBottomSpace 
            } 
          /> 
        </ScrollView> 
 
        {/* PAGINATION */} 
        <PaginationBar /> 
      </View> 
    ); 
  }; 
 
  /* ========================================================== 
     MOBILE LIST - FULL SCREEN 
  ========================================================== */ 
 
  const renderMobileList = () => { 
    return ( 
      <FlatList 
        data={ 
          filteredTherapists 
        } 
        renderItem={({ 
          item, 
        }) => ( 
          <MobileCard 
            item={item} 
          /> 
        )} 
        keyExtractor={( 
          item 
        ) => 
          String(item.id) 
        } 
        contentContainerStyle={ 
          styles.mobileListContent 
        } 
        refreshControl={ 
          <RefreshControl 
            refreshing={ 
              refreshing 
            } 
            onRefresh={ 
              onRefresh 
            } 
            colors={[ 
              colors.primary, 
            ]} 
            tintColor={ 
              colors.primary 
            } 
          /> 
        } 
        showsVerticalScrollIndicator={ 
          false 
        } 
        nestedScrollEnabled 
      /> 
    ); 
  }; 
 
  /* ========================================================== 
     INFO MOBILE 
  ========================================================== */ 
 
  const MobileInfo = ({ 
    icon, 
    label, 
    value, 
    themeColors, 
    valueColor, 
    full, 
  }) => ( 
    <View 
      style={[ 
        styles.mobileInfoItem, 
        full && 
          styles.mobileInfoFull, 
      ]} 
    > 
      <View 
        style={ 
          styles.mobileInfoLabel 
        } 
      > 
        <Ionicons 
          name={icon} 
          size={15} 
          color={ 
            colors.primary 
          } 
        /> 
 
        <Text 
          style={[ 
            styles.mobileLabelText, 
            { 
              color: 
                themeColors 
                  .textSecondary, 
            }, 
          ]} 
        > 
          {label} 
        </Text> 
      </View> 
 
      <Text 
        numberOfLines={ 
          full ? 3 : 2 
        } 
        style={[ 
          styles.mobileValueText, 
          { 
            color: 
              valueColor || 
              themeColors.text, 
          }, 
        ]} 
      > 
        {value} 
      </Text> 
    </View> 
  ); 
 
  /* ========================================================== 
     HEADER CELL 
  ========================================================== */ 
 
  const HeaderCell = ({ 
    label, 
    themeColors, 
  }) => ( 
    <View 
      style={styles.webHeaderCell} 
    > 
      <Text 
        style={[ 
          styles.webHeaderText, 
          { 
            color: 
              themeColors 
                .textSecondary, 
          }, 
        ]} 
      > 
        {label} 
      </Text> 
    </View> 
  ); 
 
  /* ========================================================== 
     PAGINATION BAR (SHARED - WEB TABLE + MOBILE CARDS) 
  ========================================================== */ 
 
  const PaginationBar = ({ 
    compact = false, 
  }) => { 
    if (filteredTherapists.length === 0) { 
      return null; 
    } 
 
    return ( 
      <View 
        style={[ 
          styles.pagination, 
          compact && 
            styles.paginationMobile, 
          { 
            borderTopColor: 
              themeColors.border || 
              '#EAEAEA', 
            backgroundColor: 
              themeColors.surface, 
          }, 
        ]} 
      > 
        <Text 
          numberOfLines={1} 
          style={[ 
            styles.paginationInfo, 
            { 
              color: 
                themeColors 
                  .textSecondary, 
            }, 
          ]} 
        > 
          {filteredTherapists.length} 
          {' '} 
          thérapeute 
          {filteredTherapists.length > 1 
            ? 's' 
            : ''} 
          {' • Page '} 
          {currentPage} 
          {'/'} 
          {totalPages} 
        </Text> 
 
        <View 
          style={ 
            styles.paginationControls 
          } 
        > 
          <TouchableOpacity 
            disabled={ 
              currentPage === 1 
            } 
            onPress={() => 
              setCurrentPage( 
                (page) => 
                  Math.max( 
                    1, 
                    page - 1 
                  ) 
              ) 
            } 
            style={[ 
              styles.paginationButton, 
              { 
                opacity: 
                  currentPage === 
                  1 
                    ? 0.4 
                    : 1, 
                backgroundColor: 
                  themeColors.background, 
              }, 
            ]} 
          > 
            <Ionicons 
              name="chevron-back" 
              size={17} 
              color={ 
                themeColors.text 
              } 
            /> 
          </TouchableOpacity> 
 
          <View 
            style={[ 
              styles.pageNumber, 
              { 
                backgroundColor: 
                  colors.primary, 
              }, 
            ]} 
          > 
            <Text 
              style={ 
                styles.pageNumberText 
              } 
            > 
              {currentPage} 
            </Text> 
          </View> 
 
          <Text 
            style={[ 
              styles.pageTotal, 
              { 
                color: 
                  themeColors 
                    .textSecondary, 
              }, 
            ]} 
          > 
            / {totalPages} 
          </Text> 
 
          <TouchableOpacity 
            disabled={ 
              currentPage === 
              totalPages 
            } 
            onPress={() => 
              setCurrentPage( 
                (page) => 
                  Math.min( 
                    totalPages, 
                    page + 1 
                  ) 
              ) 
            } 
            style={[ 
              styles.paginationButton, 
              { 
                opacity: 
                  currentPage === 
                  totalPages 
                    ? 0.4 
                    : 1, 
                backgroundColor: 
                  themeColors.background, 
              }, 
            ]} 
          > 
            <Ionicons 
              name="chevron-forward" 
              size={17} 
              color={ 
                themeColors.text 
              } 
            /> 
          </TouchableOpacity> 
        </View> 
      </View> 
    ); 
  }; 
 
  /* ========================================================== 
     TOAST COMPONENT 
  ========================================================== */ 
 
  const Toast = () => { 
    if (!toast) return null; 
 
    const isError = 
      toast.type === 'error'; 
 
    const isWarning = 
      toast.type === 'warning'; 
 
    const toastColor = isError 
      ? '#E74C3C' 
      : isWarning 
      ? '#F5A623' 
      : '#27AE60'; 
 
    const iconName = isError 
      ? 'close-circle' 
      : isWarning 
      ? 'warning' 
      : 'checkmark-circle'; 
 
    return ( 
      <View 
        pointerEvents="none" 
        style={[ 
          styles.toastPosition, 
        ]} 
      > 
        <View 
          style={[ 
            styles.toast, 
            { 
              backgroundColor: 
                themeColors.surface, 
              borderLeftColor: 
                toastColor, 
            }, 
          ]} 
        > 
          <View 
            style={[ 
              styles.toastIcon, 
              { 
                backgroundColor: 
                  toastColor + 
                  '15', 
              }, 
            ]} 
          > 
            <Ionicons 
              name={iconName} 
              size={20} 
              color={toastColor} 
            /> 
          </View> 
 
          <Text 
            numberOfLines={3} 
            style={[ 
              styles.toastText, 
              { 
                color: 
                  themeColors.text, 
              }, 
            ]} 
          > 
            {toast.message} 
          </Text> 
        </View> 
      </View> 
    ); 
  }; 
 
  /* ========================================================== 
     CONFIRM MODAL (WEB) 
  ========================================================== */ 
 
  const closeConfirmModal = () => { 
    setConfirmModalVisible(false); 
  }; 
 
  const handleConfirmModalConfirm = () => { 
    setConfirmModalVisible(false); 
    confirmModalConfig.onConfirm(); 
  }; 
 
  const ConfirmModal = () => ( 
    <Modal 
      visible={confirmModalVisible} 
      transparent 
      animationType="fade" 
      onRequestClose={closeConfirmModal} 
    > 
      <View style={styles.confirmOverlay}> 
        <View 
          style={[ 
            styles.confirmBox, 
            { 
              backgroundColor: 
                themeColors.surface, 
            }, 
          ]} 
        > 
          <View 
            style={[ 
              styles.confirmIconWrap, 
              { 
                backgroundColor: 
                  confirmModalConfig.destructive 
                    ? '#E74C3C15' 
                    : colors.primary + '15', 
              }, 
            ]} 
          > 
            <Ionicons 
              name={ 
                confirmModalConfig.destructive 
                  ? 'trash-outline' 
                  : 'help-circle-outline' 
              } 
              size={26} 
              color={ 
                confirmModalConfig.destructive 
                  ? '#E74C3C' 
                  : colors.primary 
              } 
            /> 
          </View> 
 
          <Text 
            style={[ 
              styles.confirmTitle, 
              { 
                color: themeColors.text, 
              }, 
            ]} 
          > 
            {confirmModalConfig.title} 
          </Text> 
 
          <Text 
            style={[ 
              styles.confirmMessage, 
              { 
                color: 
                  themeColors.textSecondary, 
              }, 
            ]} 
          > 
            {confirmModalConfig.message} 
          </Text> 
 
          <View style={styles.confirmActions}> 
            <TouchableOpacity 
              onPress={closeConfirmModal} 
              style={[ 
                styles.confirmButton, 
                { 
                  backgroundColor: 
                    themeColors.background, 
                }, 
              ]} 
            > 
              <Text 
                style={[ 
                  styles.confirmButtonText, 
                  { 
                    color: themeColors.text, 
                  }, 
                ]} 
              > 
                Annuler 
              </Text> 
            </TouchableOpacity> 
 
            <TouchableOpacity 
              onPress={handleConfirmModalConfirm} 
              style={[ 
                styles.confirmButton, 
                { 
                  backgroundColor: 
                    confirmModalConfig.destructive 
                      ? '#E74C3C' 
                      : colors.primary, 
                }, 
              ]} 
            > 
              <Text style={styles.confirmButtonTextWhite}> 
                Confirmer 
              </Text> 
            </TouchableOpacity> 
          </View> 
        </View> 
      </View> 
    </Modal> 
  ); 
 
  /* ========================================================== 
     MODAL CLOSE 
  ========================================================== */ 
 
  const closeModal = () => { 
    setShowModal(false); 
    setSelectedTherapist(null); 
    setCertificateInfo(null); 
  }; 
 
  /* ========================================================== 
     RENDER 
  ========================================================== */ 
 
  return ( 
    <SafeAreaView 
      style={[ 
        styles.safeArea, 
        { 
          backgroundColor: 
            themeColors.background, 
        }, 
      ]} 
    > 
      <View 
        style={[ 
          styles.container, 
          { 
            backgroundColor: 
              themeColors.background, 
          }, 
        ]} 
      > 
        <Header 
          title="Thérapeutes" 
          showBack 
        /> 
 
        {/* ====================================================== 
            MAIN CONTENT 
        ====================================================== */} 
 
        <View 
          style={[ 
            styles.mainContent, 
            { 
              paddingHorizontal: 0, 
            }, 
          ]} 
        > 
          {/* TOP BAR */} 
          <View 
            style={[ 
              styles.topBar, 
              { 
                paddingHorizontal: 
                  IS_WEB 
                    ? horizontalPadding 
                    : 12, 
              }, 
            ]} 
          > 
            <View 
              style={ 
                styles.titleBlock 
              } 
            > 
              <Text 
                style={[ 
                  styles.pageTitle, 
                  { 
                    color: 
                      themeColors.text, 
                  }, 
                ]} 
              > 
                Gestion des thérapeutes 
              </Text> 
 
              <Text 
                style={[ 
                  styles.pageSubtitle, 
                  { 
                    color: 
                      themeColors 
                        .textSecondary, 
                  }, 
                ]} 
              > 
                {filteredTherapists.length}{' '} 
                thérapeute 
                {filteredTherapists.length > 
                1 
                  ? 's' 
                  : ''}{' '} 
                affiché 
                {filteredTherapists.length > 
                1 
                  ? 's' 
                  : ''} 
              </Text> 
            </View> 
 
            <TouchableOpacity 
              onPress={onRefresh} 
              style={[ 
                styles.refreshButton, 
                { 
                  backgroundColor: 
                    themeColors.surface, 
                }, 
              ]} 
            > 
              <Ionicons 
                name="refresh-outline" 
                size={19} 
                color={ 
                  colors.primary 
                } 
              /> 
 
              {IS_WEB && ( 
                <Text 
                  style={[ 
                    styles.refreshText, 
                    { 
                      color: 
                        colors.primary, 
                    }, 
                  ]} 
                > 
                  Actualiser 
                </Text> 
              )} 
            </TouchableOpacity> 
          </View> 
 
          {/* SEARCH */} 
          <View 
            style={[ 
              styles.searchContainer, 
              { 
                paddingHorizontal: 
                  IS_WEB 
                    ? horizontalPadding 
                    : 12, 
              }, 
            ]} 
          > 
            <View 
              style={[ 
                styles.searchBar, 
                { 
                  backgroundColor: 
                    themeColors.surface, 
                }, 
              ]} 
            > 
              <Ionicons 
                name="search-outline" 
                size={20} 
                color={ 
                  themeColors 
                    .textSecondary 
                } 
              /> 
 
              <TextInput 
                style={[ 
                  styles.searchInput, 
                  { 
                    color: 
                      themeColors.text, 
                  }, 
                ]} 
                placeholder="Rechercher par nom, email, téléphone, CIN ou adresse..." 
                placeholderTextColor={ 
                  themeColors 
                    .textSecondary 
                } 
                value={ 
                  searchQuery 
                } 
                onChangeText={ 
                  handleSearch 
                } 
              /> 
 
              {searchQuery.length > 
                0 && ( 
                <TouchableOpacity 
                  onPress={() => 
                    handleSearch( 
                      '' 
                    ) 
                  } 
                > 
                  <Ionicons 
                    name="close-circle" 
                    size={20} 
                    color={ 
                      themeColors 
                        .textSecondary 
                    } 
                  /> 
                </TouchableOpacity> 
              )} 
            </View> 
          </View> 
 
          {/* FILTERS */} 
          <View 
            style={[ 
              styles.filtersContainer, 
              { 
                paddingHorizontal: 
                  IS_WEB 
                    ? horizontalPadding 
                    : 12, 
              }, 
            ]} 
          > 
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={ 
                false 
              } 
              contentContainerStyle={ 
                styles.filterScrollContent 
              } 
            > 
              {filters.map( 
                (filter) => { 
                  const active = 
                    selectedFilter === 
                    filter.id; 
 
                  return ( 
                    <TouchableOpacity 
                      key={ 
                        filter.id 
                      } 
                      onPress={() => 
                        handleFilter( 
                          filter.id 
                        ) 
                      } 
                      style={[ 
                        styles.filterButton, 
                        { 
                          backgroundColor: 
                            active 
                              ? colors.primary 
                              : themeColors.surface, 
                        }, 
                      ]} 
                    > 
                      <Ionicons 
                        name={ 
                          filter.icon 
                        } 
                        size={15} 
                        color={ 
                          active 
                            ? '#fff' 
                            : themeColors.text 
                        } 
                      /> 
 
                      <Text 
                        style={[ 
                          styles.filterText, 
                          { 
                            color: 
                              active 
                                ? '#fff' 
                                : themeColors.text, 
                          }, 
                        ]} 
                      > 
                        { 
                          filter.label 
                        } 
                      </Text> 
                    </TouchableOpacity> 
                  ); 
                } 
              )} 
            </ScrollView> 
          </View> 
 
          {/* ERROR */} 
          {error && ( 
            <View 
              style={[ 
                styles.errorBanner, 
                { 
                  marginHorizontal: 
                    IS_WEB 
                      ? horizontalPadding 
                      : 12, 
                  backgroundColor: 
                    '#E74C3C10', 
                  borderColor: 
                    '#E74C3C40', 
                }, 
              ]} 
            > 
              <Ionicons 
                name="alert-circle-outline" 
                size={19} 
                color="#E74C3C" 
              /> 
 
              <Text 
                style={ 
                  styles.errorText 
                } 
              > 
                {error} 
              </Text> 
 
              <TouchableOpacity 
                onPress={() => { 
                  setError(null); 
                  loadTherapists(); 
                }} 
              > 
                <Ionicons 
                  name="refresh-outline" 
                  size={18} 
                  color="#E74C3C" 
                /> 
              </TouchableOpacity> 
            </View> 
          )} 
 
          {/* CONTENT */} 
          {loading ? ( 
            <View 
              style={ 
                styles.loadingContainer 
              } 
            > 
              <ActivityIndicator 
                size="large" 
                color={ 
                  colors.primary 
                } 
              /> 
 
              <Text 
                style={[ 
                  styles.loadingText, 
                  { 
                    color: 
                      themeColors 
                        .textSecondary, 
                  }, 
                ]} 
              > 
                Chargement des thérapeutes... 
              </Text> 
            </View> 
          ) : filteredTherapists.length === 
            0 ? ( 
            <View 
              style={ 
                styles.emptyState 
              } 
            > 
              <View 
                style={[ 
                  styles.emptyIcon, 
                  { 
                    backgroundColor: 
                      colors.primary + 
                      '12', 
                  }, 
                ]} 
              > 
                <Ionicons 
                  name="fitness-outline" 
                  size={48} 
                  color={ 
                    colors.primary 
                  } 
                /> 
              </View> 
 
              <Text 
                style={[ 
                  styles.emptyStateTitle, 
                  { 
                    color: 
                      themeColors.text, 
                  }, 
                ]} 
              > 
                Aucun thérapeute 
              </Text> 
 
              <Text 
                style={[ 
                  styles.emptyStateText, 
                  { 
                    color: 
                      themeColors 
                        .textSecondary, 
                  }, 
                ]} 
              > 
                {searchQuery 
                  ? 'Aucun résultat pour cette recherche.' 
                  : 'Aucun thérapeute trouvé.'} 
              </Text> 
            </View> 
          ) : isDesktop ? ( 
            renderWebTable() 
          ) : ( 
            renderMobileList() 
          )} 
        </View> 
 
        {/* ====================================================== 
            DETAIL MODAL - FIXED FOR ANDROID 
        ====================================================== */} 
 
        <Modal 
          visible={showModal} 
          transparent 
          animationType={ 
            IS_WEB 
              ? 'fade' 
              : 'slide' 
          } 
          onRequestClose={ 
            closeModal 
          } 
          statusBarTranslucent={!IS_WEB} 
        > 
          <KeyboardAvoidingView 
            style={[ 
              styles.modalOverlay, 
              IS_WEB && 
                styles.modalOverlayWeb, 
            ]} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0} 
          > 
            <View 
              style={[ 
                styles.modalContainer, 
                { 
                  backgroundColor: 
                    themeColors.surface, 
                  maxWidth: 
                    IS_WEB 
                      ? 820 
                      : '100%', 
                  maxHeight: IS_WEB ? '94%' : '100%', 
                }, 
                IS_WEB && 
                  styles.modalWebContainer, 
                !IS_WEB && styles.modalContainerMobile, 
              ]} 
            > 
              {/* MODAL HEADER */} 
              <View 
                style={[ 
                  styles.modalHeader, 
                  { 
                    borderBottomColor: 
                      themeColors.border || '#EAEAEA', 
                  }, 
                ]} 
              > 
                <View> 
                  <Text 
                    style={[ 
                      styles.modalTitle, 
                      { 
                        color: 
                          themeColors.text, 
                      }, 
                    ]} 
                  > 
                    Détails du thérapeute 
                  </Text> 
 
                  <Text 
                    style={[ 
                      styles.modalSubtitle, 
                      { 
                        color: 
                          themeColors 
                            .textSecondary, 
                      }, 
                    ]} 
                  > 
                    Informations et documents 
                  </Text> 
                </View> 
 
                <TouchableOpacity 
                  onPress={ 
                    closeModal 
                  } 
                  style={[ 
                    styles.modalCloseButton, 
                    { 
                      backgroundColor: 
                        themeColors 
                          .background, 
                    }, 
                  ]} 
                > 
                  <Ionicons 
                    name="close" 
                    size={21} 
                    color={ 
                      themeColors.text 
                    } 
                  /> 
                </TouchableOpacity> 
              </View> 
 
              {selectedTherapist && ( 
                <ScrollView 
                  showsVerticalScrollIndicator 
                  contentContainerStyle={[ 
                    styles.modalScrollContent, 
                    !IS_WEB && { paddingBottom: 40 }, 
                  ]} 
                  nestedScrollEnabled 
                  keyboardShouldPersistTaps="handled" 
                > 
                  {/* PROFILE */} 
                  <View 
                    style={ 
                      styles.profileHeader 
                    } 
                  > 
                    <Avatar 
                      therapist={ 
                        selectedTherapist 
                      } 
                      size={84} 
                    /> 
 
                    <View 
                      style={ 
                        styles.profileHeaderInfo 
                      } 
                    > 
                      <Text 
                        style={[ 
                          styles.modalName, 
                          { 
                            color: 
                              themeColors.text, 
                          }, 
                        ]} 
                      > 
                        { 
                          selectedTherapist.fullname 
                        } 
                      </Text> 
 
                      <Text 
                        style={[ 
                          styles.modalEmail, 
                          { 
                            color: 
                              themeColors 
                                .textSecondary, 
                          }, 
                        ]} 
                      > 
                        { 
                          selectedTherapist.email 
                        } 
                      </Text> 
 
                      <View 
                        style={ 
                          styles.profileBadges 
                        } 
                      > 
                        <StatusBadge 
                          label={getStatusLabel( 
                            selectedTherapist.verification_status 
                          )} 
                          color={getStatusColor( 
                            selectedTherapist.verification_status 
                          )} 
                        /> 
 
                        <StatusBadge 
                          label={ 
                            selectedTherapist.is_online 
                              ? 'En ligne' 
                              : 'Hors ligne' 
                          } 
                          color={ 
                            selectedTherapist.is_online 
                              ? '#27AE60' 
                              : '#999999' 
                          } 
                          dot 
                        /> 
                      </View> 
                    </View> 
                  </View> 
 
                  {/* INFORMATION */} 
                  <SectionTitle 
                    title="Informations générales" 
                    themeColors={ 
                      themeColors 
                    } 
                  /> 
 
                  <View 
                    style={ 
                      styles.infoGrid 
                    } 
                  > 
                    <InfoRow 
                      label="Téléphone" 
                      value={ 
                        selectedTherapist.phone || 
                        'N/A' 
                      } 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
 
                    <InfoRow 
                      label="Vérification" 
                      value={getStatusLabel( 
                        selectedTherapist.verification_status 
                      )} 
                      valueColor={getStatusColor( 
                        selectedTherapist.verification_status 
                      )} 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
 
                    <InfoRow 
                      label="Statut compte" 
                      value={getActiveStatusLabel( 
                        selectedTherapist.is_active 
                      )} 
                      valueColor={getActiveStatusColor( 
                        selectedTherapist.is_active 
                      )} 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
 
                    <InfoRow 
                      label="Note" 
                      value={`⭐ ${ 
                        selectedTherapist.rating || 
                        0 
                      } (${ 
                        selectedTherapist.total_reviews || 
                        0 
                      } avis)`} 
                      valueColor="#F5A623" 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
 
                    <InfoRow 
                      label="Prix de base" 
                      value={`${Number( 
                        selectedTherapist.base_price || 
                          0 
                      ).toLocaleString()} Ar`} 
                      valueColor={ 
                        colors.primary 
                      } 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
 
                    <InfoRow 
                      label="Expérience" 
                      value={`${selectedTherapist.experience_years || 0} ans`} 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
 
                    <InfoRow 
                      label="Inscrit le" 
                      value={formatDate( 
                        selectedTherapist.created_at 
                      )} 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
 
                    <InfoRow 
                      label="N° CIN" 
                      value={ 
                        selectedTherapist.cin_number || 
                        'Non renseigné' 
                      } 
                      valueColor={ 
                        selectedTherapist.cin_number 
                          ? colors.primary 
                          : '#E74C3C' 
                      } 
                      themeColors={ 
                        themeColors 
                      } 
                    /> 
                  </View> 
 
                  {/* ONLINE SWITCH */} 
                  <View 
                    style={[ 
                      styles.switchBox, 
                      { 
                        backgroundColor: 
                          themeColors 
                            .background, 
                      }, 
                    ]} 
                  > 
                    <View> 
                      <Text 
                        style={[ 
                          styles.switchTitle, 
                          { 
                            color: 
                              themeColors.text, 
                          }, 
                        ]} 
                      > 
                        Statut en ligne 
                      </Text> 
 
                      <Text 
                        style={[ 
                          styles.switchSubtitle, 
                          { 
                            color: 
                              themeColors 
                                .textSecondary, 
                          }, 
                        ]} 
                      > 
                        Contrôler la disponibilité du thérapeute 
                      </Text> 
                    </View> 
 
                    <View 
                      style={ 
                        styles.switchRight 
                      } 
                    > 
                      <Switch 
                        value={ 
                          selectedTherapist.is_online 
                        } 
                        onValueChange={() => 
                          toggleOnlineStatus( 
                            selectedTherapist 
                          ) 
                        } 
                        trackColor={{ 
                          false: 
                            '#D0D0D0', 
                          true: 
                            colors.primary, 
                        }} 
                        thumbColor="#fff" 
                      /> 
 
                      <Text 
                        style={[ 
                          styles.switchStatus, 
                          { 
                            color: 
                              selectedTherapist.is_online 
                                ? '#27AE60' 
                                : '#999999', 
                          }, 
                        ]} 
                      > 
                        {selectedTherapist.is_online 
                          ? 'En ligne' 
                          : 'Hors ligne'} 
                      </Text> 
                    </View> 
                  </View> 
 
                  {/* ADDRESS */} 
                  <SectionTitle 
                    title="Adresse" 
                    themeColors={ 
                      themeColors 
                    } 
                  /> 
 
                  <View 
                    style={[ 
                      styles.addressBox, 
                      { 
                        backgroundColor: 
                          colors.primary + 
                          '08', 
                        borderColor: 
                          colors.primary + 
                          '25', 
                      }, 
                    ]} 
                  > 
                    <View 
                      style={ 
                        styles.addressBoxHeader 
                      } 
                    > 
                      <View 
                        style={[ 
                          styles.addressIcon, 
                          { 
                            backgroundColor: 
                              colors.primary + 
                              '15', 
                          }, 
                        ]} 
                      > 
                        <Ionicons 
                          name="location" 
                          size={21} 
                          color={ 
                            colors.primary 
                          } 
                        /> 
                      </View> 
 
                      <View 
                        style={ 
                          styles.addressBoxTitleContainer 
                        } 
                      > 
                        <Text 
                          style={[ 
                            styles.addressBoxTitle, 
                            { 
                              color: 
                                themeColors.text, 
                            }, 
                          ]} 
                        > 
                          Adresse complète 
                        </Text> 
 
                        <Text 
                          style={[ 
                            styles.addressBoxSubtitle, 
                            { 
                              color: 
                                themeColors 
                                  .textSecondary, 
                            }, 
                          ]} 
                        > 
                          Localisation enregistrée 
                        </Text> 
                      </View> 
                    </View> 
 
                    <Text 
                      style={[ 
                        styles.fullAddressText, 
                        { 
                          color: 
                            themeColors.text, 
                        }, 
                      ]} 
                    > 
                      {getFullAddress( 
                        selectedTherapist 
                      )} 
                    </Text> 
 
                    {(getLatitude( 
                      selectedTherapist 
                    ) !== null || 
                      getLongitude( 
                        selectedTherapist 
                      ) !== null) && ( 
                      <View 
                        style={ 
                          styles.coordinatesContainer 
                        } 
                      > 
                        <Text 
                          style={[ 
                            styles.coordinateText, 
                            { 
                              color: 
                                themeColors 
                                  .textSecondary, 
                            }, 
                          ]} 
                        > 
                          Latitude:{' '} 
                          {getLatitude( 
                            selectedTherapist 
                          ) ?? 
                            'N/A'} 
                        </Text> 
 
                        <Text 
                          style={[ 
                            styles.coordinateText, 
                            { 
                              color: 
                                themeColors 
                                  .textSecondary, 
                            }, 
                          ]} 
                        > 
                          Longitude:{' '} 
                          {getLongitude( 
                            selectedTherapist 
                          ) ?? 
                            'N/A'} 
                        </Text> 
                      </View> 
                    )} 
 
                    <TouchableOpacity 
                      onPress={() => { 
                        setSelectedUserForAddress( 
                          selectedTherapist 
                        ); 
 
                        setShowAddressModal( 
                          true 
                        ); 
                      }} 
                      style={[ 
                        styles.modalAddressButton, 
                        { 
                          backgroundColor: 
                            colors.primary, 
                        }, 
                      ]} 
                    > 
                      <Ionicons 
                        name="map-outline" 
                        size={18} 
                        color="#fff" 
                      /> 
 
                      <Text 
                        style={ 
                          styles.modalAddressButtonText 
                        } 
                      > 
                        Modifier l'adresse sur la carte 
                      </Text> 
                    </TouchableOpacity> 
                  </View> 
 
                  {/* CIN */} 
                  <SectionTitle 
                    title="Pièce d'identité — CIN" 
                    themeColors={ 
                      themeColors 
                    } 
                  /> 
 
                  <View 
                    style={[ 
                      styles.documentSection, 
                      { 
                        backgroundColor: 
                          themeColors 
                            .background, 
                      }, 
                    ]} 
                  > 
                    <View 
                      style={ 
                        styles.documentNumberRow 
                      } 
                    > 
                      <Ionicons 
                        name="card-outline" 
                        size={20} 
                        color={ 
                          colors.primary 
                        } 
                      /> 
 
                      <Text 
                        style={[ 
                          styles.documentNumber, 
                          { 
                            color: 
                              themeColors.text, 
                          }, 
                        ]} 
                      > 
                        {selectedTherapist.cin_number || 
                          'Non renseigné'} 
                      </Text> 
                    </View> 
 
                    {selectedTherapist.identity_document_url ? ( 
                      <> 
                        <Image 
                          source={{ 
                            uri: selectedTherapist.identity_document_url, 
                          }} 
                          style={ 
                            styles.cinImage 
                          } 
                          resizeMode="contain" 
                        /> 
 
                        <TouchableOpacity 
                          onPress={() => 
                            handleDownload( 
                              selectedTherapist.identity_document_url, 
                              `CIN_${selectedTherapist.fullname || 'therapeute'}.jpg` 
                            ) 
                          } 
                          style={ 
                            styles.downloadButton 
                          } 
                        > 
                          <Ionicons 
                            name="download-outline" 
                            size={18} 
                            color="#fff" 
                          /> 
 
                          <Text 
                            style={ 
                              styles.downloadButtonText 
                            } 
                          > 
                            Télécharger le CIN 
                          </Text> 
                        </TouchableOpacity> 
                      </> 
                    ) : ( 
                      <View 
                        style={ 
                          styles.noDocumentBox 
                        } 
                      > 
                        <Ionicons 
                          name="alert-circle-outline" 
                          size={22} 
                          color="#E74C3C" 
                        /> 
 
                        <Text 
                          style={ 
                            styles.noDocumentText 
                          } 
                        > 
                          Aucun document CIN téléchargé 
                        </Text> 
                      </View> 
                    )} 
                  </View> 
 
                  {/* CERTIFICATE */} 
                  <SectionTitle 
                    title="Certificat professionnel" 
                    themeColors={ 
                      themeColors 
                    } 
                  /> 
 
                  <View 
                    style={[ 
                      styles.documentSection, 
                      { 
                        backgroundColor: 
                          '#E8F5E9', 
                        borderColor: 
                          '#A5D6A7', 
                      }, 
                    ]} 
                  > 
                    {loadingCertificate ? ( 
                      <View 
                        style={ 
                          styles.certificateLoading 
                        } 
                      > 
                        <ActivityIndicator 
                          size="small" 
                          color={ 
                            colors.primary 
                          } 
                        /> 
 
                        <Text 
                          style={[ 
                            styles.certificateLoadingText, 
                            { 
                              color: 
                                themeColors 
                                  .textSecondary, 
                            }, 
                          ]} 
                        > 
                          Chargement du certificat... 
                        </Text> 
                      </View> 
                    ) : certificateInfo?.certificate ? ( 
                      <> 
                        <InfoRow 
                          label="Numéro" 
                          value={ 
                            certificateInfo 
                              .certificate 
                              .certificate_number 
                          } 
                          themeColors={ 
                            themeColors 
                          } 
                        /> 
 
                        <InfoRow 
                          label="Délivré le" 
                          value={formatDate( 
                            certificateInfo 
                              .certificate 
                              .issued_at 
                          )} 
                          themeColors={ 
                            themeColors 
                          } 
                        /> 
 
                        <InfoRow 
                          label="Statut" 
                          value={ 
                            certificateInfo 
                              .certificate 
                              .status === 
                            'valid' 
                              ? 'Valide' 
                              : 'Révoqué' 
                          } 
                          valueColor={ 
                            certificateInfo 
                              .certificate 
                              .status === 
                            'valid' 
                              ? '#27AE60' 
                              : '#E74C3C' 
                          } 
                          themeColors={ 
                            themeColors 
                          } 
                        /> 
 
                        <InfoRow 
                          label="Validé par" 
                          value={ 
                            certificateInfo 
                              .certificate 
                              .verified_by || 
                            'Administrateur' 
                          } 
                          themeColors={ 
                            themeColors 
                          } 
                        /> 
 
                        {certificateInfo 
                          .certificate 
                          .download_url && ( 
                          <TouchableOpacity 
                            onPress={() => 
                              handleDownload( 
                                certificateInfo 
                                  .certificate 
                                  .download_url, 
                                `${certificateInfo.certificate.certificate_number || 'certificat'}.pdf` 
                              ) 
                            } 
                            style={[ 
                              styles.downloadButton, 
                              { 
                                marginTop: 
                                  spacing.md, 
                              }, 
                            ]} 
                          > 
                            <Ionicons 
                              name="document-text-outline" 
                              size={18} 
                              color="#fff" 
                            /> 
 
                            <Text 
                              style={ 
                                styles.downloadButtonText 
                              } 
                            > 
                              Télécharger le certificat PDF 
                            </Text> 
                          </TouchableOpacity> 
                        )} 
                      </> 
                    ) : ( 
                      <View 
                        style={ 
                          styles.noDocumentBox 
                        } 
                      > 
                        <Ionicons 
                          name="document-text-outline" 
                          size={22} 
                          color={ 
                            themeColors 
                              .textSecondary 
                          } 
                        /> 
 
                        <Text 
                          style={[ 
                            styles.noCertificateText, 
                            { 
                              color: 
                                themeColors 
                                  .textSecondary, 
                            }, 
                          ]} 
                        > 
                          Aucun certificat généré pour ce thérapeute 
                        </Text> 
                      </View> 
                    )} 
                  </View> 
 
                  {/* BIO */} 
                  {selectedTherapist.bio && ( 
                    <> 
                      <SectionTitle 
                        title="Biographie" 
                        themeColors={ 
                          themeColors 
                        } 
                      /> 
 
                      <View 
                        style={ 
                          styles.bioBox 
                        } 
                      > 
                        <Text 
                          style={[ 
                            styles.bioText, 
                            { 
                              color: 
                                themeColors.text, 
                            }, 
                          ]} 
                        > 
                          { 
                            selectedTherapist.bio 
                          } 
                        </Text> 
                      </View> 
                    </> 
                  )} 
 
                  {/* ACTIONS */} 
                  <View 
                    style={ 
                      styles.modalActions 
                    } 
                  > 
                    <TouchableOpacity 
                      style={[ 
                        styles.modalAction, 
                        { 
                          backgroundColor: 
                            selectedTherapist.is_active 
                              ? '#F5A623' 
                              : '#27AE60', 
                        }, 
                      ]} 
                      onPress={() => 
                        toggleActiveStatus( 
                          selectedTherapist 
                        ) 
                      } 
                    > 
                      <Ionicons 
                        name={ 
                          selectedTherapist.is_active 
                            ? 'person-remove-outline' 
                            : 'person-add-outline' 
                        } 
                        size={18} 
                        color="#fff" 
                      /> 
 
                      <Text 
                        style={ 
                          styles.modalActionText 
                        } 
                      > 
                        {selectedTherapist.is_active 
                          ? 'Désactiver' 
                          : 'Activer'} 
                      </Text> 
                    </TouchableOpacity> 
 
                    <TouchableOpacity 
                      style={[ 
                        styles.modalAction, 
                        { 
                          backgroundColor: 
                            '#E74C3C', 
                        }, 
                      ]} 
                      onPress={() => 
                        handleDeleteTherapist( 
                          selectedTherapist 
                        ) 
                      } 
                    > 
                      <Ionicons 
                        name="trash-outline" 
                        size={18} 
                        color="#fff" 
                      /> 
 
                      <Text 
                        style={ 
                          styles.modalActionText 
                        } 
                      > 
                        Supprimer 
                      </Text> 
                    </TouchableOpacity> 
                  </View> 
                </ScrollView> 
              )} 
            </View> 
          </KeyboardAvoidingView> 
        </Modal> 
 
        {/* ====================================================== 
            ADDRESS MODAL 
        ====================================================== */} 
 
        <AdminUserAddressModal 
          visible={ 
            showAddressModal 
          } 
          userId={ 
            selectedUserForAddress?.id 
          } 
          userName={ 
            selectedUserForAddress?.fullname 
          } 
          onClose={() => { 
            setShowAddressModal( 
              false 
            ); 
 
            setSelectedUserForAddress( 
              null 
            ); 
          }} 
          onSaved={async ( 
            updatedData 
          ) => { 
            if ( 
              selectedTherapist && 
              updatedData?.id === 
                selectedTherapist.id 
            ) { 
              setSelectedTherapist( 
                (prev) => ({ 
                  ...prev, 
                  ...updatedData, 
                }) 
              ); 
            } 
 
            await loadTherapists(); 
 
            setShowAddressModal( 
              false 
            ); 
 
            setSelectedUserForAddress( 
              null 
            ); 
 
            showToast( 
              'Adresse mise à jour avec succès', 
              'success' 
            ); 
          }} 
        /> 
 
        {/* ====================================================== 
            TOAST 
        ====================================================== */} 
 
        <Toast /> 
 
        {/* ====================================================== 
            CONFIRM MODAL (WEB) 
        ====================================================== */} 
 
        <ConfirmModal /> 
      </View> 
    </SafeAreaView> 
  ); 
}; 
 
/* ================================================================ 
   SECTION TITLE 
================================================================ */ 
 
const SectionTitle = ({ 
  title, 
  themeColors, 
}) => ( 
  <Text 
    style={[ 
      styles.sectionTitle, 
      { 
        color: 
          themeColors.text, 
      }, 
    ]} 
  > 
    {title} 
  </Text> 
); 
 
/* ================================================================ 
   INFO ROW 
================================================================ */ 
 
const InfoRow = ({ 
  label, 
  value, 
  valueColor, 
  themeColors, 
}) => ( 
  <View 
    style={[ 
      styles.modalInfoRow, 
      { 
        borderBottomColor: 
          themeColors.border || 
          '#EAEAEA', 
      }, 
    ]} 
  > 
    <Text 
      style={[ 
        styles.modalInfoLabel, 
        { 
          color: 
            themeColors 
              .textSecondary, 
        }, 
      ]} 
    > 
      {label} 
    </Text> 
 
    <Text 
      style={[ 
        styles.modalInfoValue, 
        { 
          color: 
            valueColor || 
            themeColors.text, 
        }, 
      ]} 
    > 
      {value} 
    </Text> 
  </View> 
); 
 
/* ================================================================ 
   STYLES 
================================================================ */ 
 
const styles = StyleSheet.create({ 
  safeArea: { 
    flex: 1, 
  }, 
 
  container: { 
    flex: 1, 
    minHeight: 0, 
  }, 
 
  mainContent: { 
    flex: 1, 
    minHeight: 0, 
  }, 
 
  /* ============================================================ 
     TOP BAR 
  ============================================================ */ 
 
  topBar: { 
    width: '100%', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 
      'space-between', 
    paddingTop: 14, 
    paddingBottom: 10, 
  }, 
 
  titleBlock: { 
    flex: 1, 
  }, 
 
  pageTitle: { 
    fontSize: 20, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  pageSubtitle: { 
    fontSize: 12, 
    marginTop: 3, 
    fontFamily: 
      typography.fontFamily.regular, 
  }, 
 
  refreshButton: { 
    minHeight: 40, 
    paddingHorizontal: 12, 
    borderRadius: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
  }, 
 
  refreshText: { 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  /* ============================================================ 
     SEARCH 
  ============================================================ */ 
 
  searchContainer: { 
    width: '100%', 
    paddingBottom: 8, 
  }, 
 
  searchBar: { 
    minHeight: 46, 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 14, 
    gap: 9, 
 
    shadowColor: '#000', 
    shadowOffset: { 
      width: 0, 
      height: 1, 
    }, 
    shadowOpacity: 0.04, 
    shadowRadius: 3, 
    elevation: 1, 
  }, 
 
  searchInput: { 
    flex: 1, 
    minHeight: 42, 
    fontSize: 13, 
    fontFamily: 
      typography.fontFamily.regular, 
  }, 
 
  /* ============================================================ 
     FILTERS 
  ============================================================ */ 
 
  filtersContainer: { 
    paddingBottom: 10, 
  }, 
 
  filterScrollContent: { 
    paddingVertical: 2, 
    gap: 7, 
  }, 
 
  filterButton: { 
    minHeight: 36, 
    paddingHorizontal: 13, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
  }, 
 
  filterText: { 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  /* ============================================================ 
     ERROR 
  ============================================================ */ 
 
  errorBanner: { 
    minHeight: 42, 
    borderRadius: 10, 
    borderWidth: 1, 
    paddingHorizontal: 12, 
    marginBottom: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
  }, 
 
  errorText: { 
    flex: 1, 
    color: '#E74C3C', 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  /* ============================================================ 
     LOADING 
  ============================================================ */ 
 
  loadingContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: 300, 
  }, 
 
  loadingText: { 
    marginTop: 10, 
    fontSize: 13, 
    fontFamily: 
      typography.fontFamily.regular, 
  }, 
 
  /* ============================================================ 
     EMPTY 
  ============================================================ */ 
 
  emptyState: { 
    flex: 1, 
    minHeight: 300, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 30, 
  }, 
 
  emptyIcon: { 
    width: 86, 
    height: 86, 
    borderRadius: 43, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  emptyStateTitle: { 
    marginTop: 14, 
    fontSize: 17, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  emptyStateText: { 
    marginTop: 5, 
    fontSize: 13, 
    textAlign: 'center', 
  }, 
 
  /* ============================================================ 
     WEB TABLE 
  ============================================================ */ 
 
  webTableWrapper: { 
    flex: 1, 
    minHeight: 0, 
    width: '100%', 
    overflow: 'hidden', 
 
    shadowColor: '#000', 
    shadowOffset: { 
      width: 0, 
      height: 1, 
    }, 
    shadowOpacity: 0.03, 
    shadowRadius: 4, 
  }, 
 
  webTableHeader: { 
    minHeight: 48, 
    width: '100%', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#00000008', 
  }, 
 
  webHeaderCell: { 
    flex: 1, 
    minWidth: 90, 
    paddingHorizontal: 8, 
    justifyContent: 'center', 
  }, 
 
  webHeaderText: { 
    fontSize: 10, 
    fontFamily: 
      typography.fontFamily.bold, 
    letterSpacing: 0.5, 
  }, 
 
  webTableScroll: { 
    flex: 1, 
    minHeight: 0, 
    width: '100%', 
  }, 
 
  webTableScrollContent: { 
    width: '100%', 
  }, 
 
  webTableRow: { 
    width: '100%', 
    minHeight: 70, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#00000006', 
  }, 
 
  webCell: { 
    flex: 1, 
    minWidth: 90, 
    paddingHorizontal: 8, 
    justifyContent: 'center', 
  }, 
 
  webCellTherapist: { 
    flex: 1.45, 
    minWidth: 180, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 9, 
  }, 
 
  webTherapistInfo: { 
    flex: 1, 
    minWidth: 0, 
  }, 
 
  webName: { 
    fontSize: 13, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  webEmail: { 
    marginTop: 3, 
    fontSize: 10, 
  }, 
 
  webCellText: { 
    fontSize: 11, 
    lineHeight: 16, 
  }, 
 
  webAddressCell: { 
    flex: 1.35, 
    minWidth: 150, 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 5, 
  }, 
 
  webPrice: { 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  webActionCell: { 
    flex: 0.95, 
    minWidth: 118, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
  }, 
 
  webIconButton: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  webBottomSpace: { 
    height: 24, 
  }, 
 
  /* ============================================================ 
     STATUS BADGE 
  ============================================================ */ 
 
  statusBadge: { 
    alignSelf: 'flex-start', 
    minHeight: 26, 
    paddingHorizontal: 8, 
    borderRadius: 7, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
    justifyContent: 'center', 
  }, 
 
  statusBadgeText: { 
    fontSize: 10, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  statusBadgeDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
  }, 
 
  /* ============================================================ 
     PAGINATION 
  ============================================================ */ 
 
  pagination: { 
    minHeight: 54, 
    paddingHorizontal: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 
      'space-between', 
    borderTopWidth: 1, 
  }, 
 
  paginationMobile: { 
    minHeight: 58, 
    marginTop: 6, 
    marginBottom: 16, 
    borderTopWidth: 1, 
    borderWidth: 1, 
    borderColor: '#00000010', 
    borderRadius: 14, 
    paddingHorizontal: 14, 
    flexWrap: 'wrap', 
    rowGap: 10, 
  }, 
 
  paginationInfo: { 
    fontSize: 11, 
    flexShrink: 1, 
  }, 
 
  paginationControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 7, 
  }, 
 
  paginationButton: { 
    width: 34, 
    height: 34, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  pageNumber: { 
    width: 34, 
    height: 34, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  pageNumberText: { 
    color: '#fff', 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  pageTotal: { 
    fontSize: 11, 
  }, 
 
  /* ============================================================ 
     MOBILE CARD - FULL SCREEN 
  ============================================================ */ 
 
  mobileListContent: { 
    paddingTop: 3, 
    paddingBottom: 120, 
    paddingHorizontal: 8, 
  }, 
 
  mobileCard: { 
    width: '100%', 
    borderRadius: 18, 
    padding: 14, 
    marginBottom: 10, 
 
    shadowColor: '#000', 
    shadowOffset: { 
      width: 0, 
      height: 2, 
    }, 
    shadowOpacity: 0.05, 
    shadowRadius: 5, 
    elevation: 2, 
  }, 
 
  mobileCardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
  }, 
 
  mobileCardIdentity: { 
    flex: 1, 
    marginLeft: 11, 
    minWidth: 0, 
  }, 
 
  mobileName: { 
    fontSize: 15, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  mobileEmail: { 
    fontSize: 11, 
    marginTop: 2, 
  }, 
 
  mobileStatusLine: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginTop: 6, 
  }, 
 
  mobileDivider: { 
    height: 1, 
    width: '100%', 
    marginVertical: 11, 
  }, 
 
  mobileInfoGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
  }, 
 
  mobileInfoItem: { 
    width: '47%', 
    minWidth: 130, 
  }, 
 
  mobileInfoFull: { 
    width: '100%', 
  }, 
 
  mobileInfoLabel: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
  }, 
 
  mobileLabelText: { 
    fontSize: 10, 
  }, 
 
  mobileValueText: { 
    fontSize: 12, 
    marginTop: 3, 
    lineHeight: 17, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  mobileCardFooter: { 
    marginTop: 12, 
    flexDirection: 'row', 
    gap: 8, 
  }, 
 
  mobileFooterButton: { 
    flex: 1, 
    minHeight: 38, 
    borderRadius: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
  }, 
 
  mobileFooterButtonText: { 
    fontSize: 11, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  /* ============================================================ 
     AVATAR 
  ============================================================ */ 
 
  avatarWrapper: { 
    position: 'relative', 
  }, 
 
  avatarFallback: { 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  avatarText: { 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  avatarOnline: { 
    position: 'absolute', 
    right: 0, 
    bottom: 0, 
    borderWidth: 2, 
    borderColor: '#fff', 
    zIndex: 5, 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOffset: { 
      width: 0, 
      height: 1, 
    }, 
    shadowOpacity: 0.18, 
    shadowRadius: 2, 
  }, 
 
  /* ============================================================ 
     MODAL - FIXED FOR ANDROID 
  ============================================================ */ 
 
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 
      'rgba(0,0,0,0.48)', 
    justifyContent: 'flex-end', 
    alignItems: 'center', 
  }, 
 
  modalOverlayWeb: { 
    justifyContent: 'center', 
    padding: 24, 
  }, 
 
  modalContainer: { 
    width: '100%', 
    maxHeight: '92%', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderRadius: 0, 
    overflow: 'hidden', 
  }, 
 
  modalContainerMobile: { 
    maxHeight: '100%', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderBottomLeftRadius: 0, 
    borderBottomRightRadius: 0, 
    width: '100%', 
  }, 
 
  modalWebContainer: { 
    maxHeight: '94%', 
    borderRadius: 22, 
  }, 
 
  modalHeader: { 
    minHeight: 70, 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 
      'space-between', 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(0,0,0,0.05)', 
  }, 
 
  modalTitle: { 
    fontSize: 18, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  modalSubtitle: { 
    fontSize: 11, 
    marginTop: 3, 
  }, 
 
  modalCloseButton: { 
    width: 38, 
    height: 38, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  modalScrollContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 30, 
  }, 
 
  /* ============================================================ 
     PROFILE 
  ============================================================ */ 
 
  profileHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    marginBottom: 10, 
  }, 
 
  profileHeaderInfo: { 
    flex: 1, 
    marginLeft: 14, 
  }, 
 
  modalName: { 
    fontSize: 18, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  modalEmail: { 
    fontSize: 12, 
    marginTop: 3, 
  }, 
 
  profileBadges: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginTop: 7, 
  }, 
 
  /* ============================================================ 
     SECTION 
  ============================================================ */ 
 
  sectionTitle: { 
    fontSize: 14, 
    fontFamily: 
      typography.fontFamily.bold, 
    marginTop: 13, 
    marginBottom: 8, 
  }, 
 
  infoGrid: { 
    width: '100%', 
  }, 
 
  modalInfoRow: { 
    minHeight: 42, 
    paddingVertical: 9, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 
      'space-between', 
    borderBottomWidth: 1, 
  }, 
 
  modalInfoLabel: { 
    flex: 1, 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  modalInfoValue: { 
    flex: 1.4, 
    textAlign: 'right', 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  /* ============================================================ 
     SWITCH 
  ============================================================ */ 
 
  switchBox: { 
    marginTop: 12, 
    padding: 12, 
    borderRadius: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 
      'space-between', 
  }, 
 
  switchTitle: { 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  switchSubtitle: { 
    fontSize: 10, 
    marginTop: 2, 
  }, 
 
  switchRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
  }, 
 
  switchStatus: { 
    fontSize: 10, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  /* ============================================================ 
     ADDRESS 
  ============================================================ */ 
 
  addressBox: { 
    borderWidth: 1, 
    borderRadius: 16, 
    padding: 14, 
  }, 
 
  addressBoxHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
  }, 
 
  addressIcon: { 
    width: 42, 
    height: 42, 
    borderRadius: 13, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  addressBoxTitleContainer: { 
    flex: 1, 
    marginLeft: 10, 
  }, 
 
  addressBoxTitle: { 
    fontSize: 13, 
    fontFamily: 
      typography.fontFamily.bold, 
  }, 
 
  addressBoxSubtitle: { 
    fontSize: 10, 
    marginTop: 2, 
  }, 
 
  fullAddressText: { 
    fontSize: 13, 
    lineHeight: 20, 
    marginTop: 13, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  coordinatesContainer: { 
    marginTop: 9, 
    paddingTop: 9, 
    borderTopWidth: 1, 
    borderTopColor: 
      '#00000010', 
    gap: 3, 
  }, 
 
  coordinateText: { 
    fontSize: 10, 
  }, 
 
  modalAddressButton: { 
    marginTop: 12, 
    minHeight: 42, 
    borderRadius: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 7, 
  }, 
 
  modalAddressButtonText: { 
    color: '#fff', 
    fontSize: 11, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  /* ============================================================ 
     DOCUMENT 
  ============================================================ */ 
 
  documentSection: { 
    borderWidth: 1, 
    borderColor: '#00000010', 
    borderRadius: 16, 
    padding: 14, 
  }, 
 
  documentNumberRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 10, 
  }, 
 
  documentNumber: { 
    fontSize: 13, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  cinImage: { 
    width: '100%', 
    height: 220, 
    borderRadius: 12, 
    backgroundColor: '#F5F5F5', 
    marginBottom: 10, 
  }, 
 
  downloadButton: { 
    minHeight: 42, 
    borderRadius: 10, 
    paddingHorizontal: 14, 
    backgroundColor: 
      colors.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 7, 
  }, 
 
  downloadButtonText: { 
    color: '#fff', 
    fontSize: 11, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  noDocumentBox: { 
    minHeight: 45, 
    borderRadius: 10, 
    padding: 10, 
    backgroundColor: 
      '#E74C3C10', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
  }, 
 
  noDocumentText: { 
    flex: 1, 
    color: '#E74C3C', 
    fontSize: 11, 
  }, 
 
  noCertificateText: { 
    flex: 1, 
    fontSize: 11, 
  }, 
 
  certificateLoading: { 
    minHeight: 50, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
  }, 
 
  certificateLoadingText: { 
    fontSize: 11, 
  }, 
 
  /* ============================================================ 
     BIO 
  ============================================================ */ 
 
  bioBox: { 
    padding: 13, 
    borderRadius: 14, 
    backgroundColor: 
      '#00000005', 
  }, 
 
  bioText: { 
    fontSize: 12, 
    lineHeight: 19, 
  }, 
 
  /* ============================================================ 
     ACTIONS 
  ============================================================ */ 
 
  modalActions: { 
    marginTop: 16, 
    paddingTop: 5, 
    flexDirection: 'row', 
    gap: 9, 
  }, 
 
  modalAction: { 
    flex: 1, 
    minHeight: 44, 
    borderRadius: 11, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 7, 
  }, 
 
  modalActionText: { 
    color: '#fff', 
    fontSize: 12, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  /* ============================================================ 
     TOAST 
  ============================================================ */ 
 
  toastPosition: { 
    position: 'absolute', 
    top: IS_WEB ? 70 : 62, 
    left: 0, 
    right: 0, 
    zIndex: 99999, 
    elevation: 99999, 
    alignItems: 'center', 
    justifyContent: 'center', 
    pointerEvents: 'none', 
  }, 
 
  toast: { 
    minHeight: 52, 
    maxWidth: IS_WEB 
      ? 520 
      : '88%', 
    minWidth: IS_WEB 
      ? 300 
      : undefined, 
 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
 
    borderRadius: 13, 
    borderLeftWidth: 4, 
 
    flexDirection: 'row', 
    alignItems: 'center', 
 
    shadowColor: '#000', 
    shadowOffset: { 
      width: 0, 
      height: 5, 
    }, 
    shadowOpacity: 0.14, 
    shadowRadius: 12, 
    elevation: 10, 
  }, 
 
  toastIcon: { 
    width: 34, 
    height: 34, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  toastText: { 
    flex: 1, 
    marginLeft: 9, 
    fontSize: 12, 
    lineHeight: 17, 
    fontFamily: 
      typography.fontFamily.medium, 
  }, 
 
  /* ============================================================ 
     CONFIRM MODAL (WEB) 
  ============================================================ */ 
 
  confirmOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20, 
  }, 
 
  confirmBox: { 
    width: '100%', 
    maxWidth: 380, 
    borderRadius: 18, 
    padding: 24, 
    alignItems: 'center', 
 
    shadowColor: '#000', 
    shadowOffset: { 
      width: 0, 
      height: 8, 
    }, 
    shadowOpacity: 0.2, 
    shadowRadius: 20, 
    elevation: 10, 
  }, 
 
  confirmIconWrap: { 
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 14, 
  }, 
 
  confirmTitle: { 
    fontSize: 16, 
    fontFamily: 
      typography.fontFamily.bold, 
    textAlign: 'center', 
  }, 
 
  confirmMessage: { 
    fontSize: 13, 
    lineHeight: 19, 
    textAlign: 'center', 
    marginTop: 8, 
    marginBottom: 20, 
  }, 
 
  confirmActions: { 
    flexDirection: 'row', 
    width: '100%', 
    gap: 10, 
  }, 
 
  confirmButton: { 
    flex: 1, 
    minHeight: 44, 
    borderRadius: 11, 
    alignItems: 'center', 
    justifyContent: 'center', 
  }, 
 
  confirmButtonText: { 
    fontSize: 13, 
    fontFamily: 
      typography.fontFamily.semiBold, 
  }, 
 
  confirmButtonTextWhite: { 
    fontSize: 13, 
    fontFamily: 
      typography.fontFamily.semiBold, 
    color: '#fff', 
  }, 
}); 
 
export default TherapistsScreen;