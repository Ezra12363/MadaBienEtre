// src/screens/admin/UsersScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Animated,
  Modal,
  ScrollView,
  SafeAreaView,
  Image,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
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
   MAIN COMPONENT
============================================================ */

const UsersScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token, user } = useAuth();

  const { isTablet, isDesktop, isLargeScreen, horizontalPadding } = useResponsive();

  /* ==========================================================
     STATE
  ========================================================== */

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    fullname: '',
    email: '',
    phone: '',
    bio: '',
  });

  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    fullname: '',
    email: '',
    phone: '',
    password: '',
    role: 'CLIENT',
  });

  const [selectedIds, setSelectedIds] = useState([]);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedUserForAddress, setSelectedUserForAddress] = useState(null);

  /* ==========================================================
     CONFIRMATION MODAL STATE
  ========================================================== */

  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirmer',
    cancelText: 'Annuler',
    destructive: false,
    onConfirm: null,
    onCancel: null,
  });

  /* ==========================================================
     TOAST
  ========================================================== */

  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
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
  }, []);

  /* ==========================================================
     CONFIRMATION MODAL — CENTRÉ
  ========================================================== */

  const showConfirmModal = useCallback(({
    title,
    message,
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    destructive = false,
    onConfirm,
    onCancel,
  }) => {
    setConfirmModal({
      visible: true,
      title,
      message,
      confirmText,
      cancelText,
      destructive,
      onConfirm: onConfirm || null,
      onCancel: onCancel || null,
    });
  }, []);

  const hideConfirmModal = useCallback(() => {
    setConfirmModal((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    const { onConfirm } = confirmModal;
    hideConfirmModal();
    if (onConfirm && typeof onConfirm === 'function') {
      setTimeout(() => onConfirm(), 300);
    }
  }, [confirmModal, hideConfirmModal]);

  const handleCancel = useCallback(() => {
    const { onCancel } = confirmModal;
    hideConfirmModal();
    if (onCancel && typeof onCancel === 'function') {
      onCancel();
    }
  }, [confirmModal, hideConfirmModal]);

  /* ==========================================================
     CONFIRMATION MODAL COMPONENT
  ========================================================== */

  const ConfirmationModal = () => (
    <Modal
      visible={confirmModal.visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent={!IS_WEB}
    >
      <View style={styles.confirmOverlay}>
        <View
          style={[
            styles.confirmModalContainer,
            {
              backgroundColor: themeColors.surface,
            },
          ]}
        >
          {/* Icon */}
          <View
            style={[
              styles.confirmIconContainer,
              {
                backgroundColor: confirmModal.destructive
                  ? '#E74C3C14'
                  : '#27AE6014',
              },
            ]}
          >
            <Ionicons
              name={confirmModal.destructive ? 'alert-circle' : 'checkmark-circle'}
              size={40}
              color={confirmModal.destructive ? '#E74C3C' : '#27AE60'}
            />
          </View>

          {/* Title */}
          <Text
            style={[
              styles.confirmTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            {confirmModal.title}
          </Text>

          {/* Message */}
          <Text
            style={[
              styles.confirmMessage,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            {confirmModal.message}
          </Text>

          {/* Buttons */}
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                styles.confirmCancelButton,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : '#F1F3F6',
                },
              ]}
              onPress={handleCancel}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {confirmModal.cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                styles.confirmActionButton,
                {
                  backgroundColor: confirmModal.destructive
                    ? '#E74C3C'
                    : '#27AE60',
                },
              ]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  styles.confirmActionText,
                ]}
              >
                {confirmModal.confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  /* ==========================================================
     FILTERS
  ========================================================== */

  const filters = [
    { id: 'all', label: 'Tous', icon: 'people-outline' },
    { id: 'CLIENT', label: 'Clients', icon: 'person-outline' },
    { id: 'THERAPIST', label: 'Thérapeutes', icon: 'fitness-outline' },
    { id: 'ADMIN', label: 'Admins', icon: 'shield-checkmark-outline' },
  ];

  const roles = [
    { value: 'CLIENT', label: 'Client', icon: 'person-outline', color: '#2196F3' },
    { value: 'THERAPIST', label: 'Thérapeute', icon: 'fitness-outline', color: '#4CAF50' },
    { value: 'ADMIN', label: 'Admin', icon: 'shield-checkmark-outline', color: '#D32F2F' },
  ];

  /* ==========================================================
     LOAD
  ========================================================== */

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [showDeleted])
  );

  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([loadUsers(), loadStats()]);
    } catch (err) {
      console.error('❌ Erreur chargement:', err);
      setError('Impossible de charger les données');
      showToast('Impossible de charger les données', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await adminService.getUsers({
        limit: 200,
        showDeleted: showDeleted,
      });

      if (Array.isArray(data)) {
        const safeFiltered = showDeleted
          ? data.filter((u) => !!u.deleted_at)
          : data.filter((u) => !u.deleted_at);

        if (safeFiltered.length > 0) {
          setUsers(safeFiltered);
          setFilteredUsers(safeFiltered);
          setError(null);
        } else {
          setUsers([]);
          setFilteredUsers([]);
          setError(showDeleted ? 'Aucun utilisateur supprimé' : 'Aucun utilisateur trouvé');
        }
      } else {
        setUsers([]);
        setFilteredUsers([]);
        setError('Réponse inattendue du serveur');
      }
    } catch (err) {
      console.error('❌ Error loading users:', err);
      setError(`Erreur: ${err.message || 'Impossible de charger les utilisateurs'}`);
      setUsers([]);
      setFilteredUsers([]);
      showToast('Impossible de charger les utilisateurs', 'error');
    }
  };

  const loadStats = async () => {
    try {
      const data = await adminService.getUserStats();
      if (data && typeof data === 'object') {
        setStats(data);
      } else {
        calculateStatsFromUsers();
      }
    } catch (err) {
      console.error('❌ Error loading stats:', err);
      calculateStatsFromUsers();
    }
  };

  const calculateStatsFromUsers = () => {
    if (users.length > 0) {
      setStats({
        total: users.length,
        clients: users.filter((u) => u.role === 'CLIENT').length,
        therapists: users.filter((u) => u.role === 'THERAPIST').length,
        admins: users.filter((u) => u.role === 'ADMIN').length,
        active: users.filter((u) => u.is_active).length,
        inactive: users.filter((u) => !u.is_active).length,
        new_users_last_week: 0,
        verified_therapists: users.filter((u) => u.role === 'THERAPIST' && u.verification_status === 'approved').length,
        online_therapists: users.filter((u) => u.role === 'THERAPIST' && u.is_online).length,
      });
    } else {
      setStats({
        total: 0,
        clients: 0,
        therapists: 0,
        admins: 0,
        active: 0,
        inactive: 0,
        new_users_last_week: 0,
        verified_therapists: 0,
        online_therapists: 0,
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  /* ==========================================================
     FILTER
  ========================================================== */

  const applyFilters = (query, filter, sourceData = users) => {
    let result = [...sourceData];

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (u) =>
          (u.fullname && u.fullname.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.includes(q))
      );
    }

    if (filter !== 'all') {
      result = result.filter((u) => u.role === filter);
    }

    setFilteredUsers(result);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    setCurrentPage(1);
    applyFilters(text, selectedFilter);
  };

  const handleFilter = (filter) => {
    setSelectedFilter(filter);
    setCurrentPage(1);
    applyFilters(searchQuery, filter);
  };

  /* ==========================================================
     RE-FILTER WHEN DATA CHANGES
  ========================================================== */

  useEffect(() => {
    applyFilters(searchQuery, selectedFilter, users);
  }, [users]);

  /* ==========================================================
     PAGINATION
  ========================================================== */

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* ==========================================================
     GET FULL ADDRESS
  ========================================================== */

  const getFullAddress = (item) => {
    if (!item) return 'Adresse non renseignée';

    if (typeof item.address === 'string' && item.address.trim()) {
      return item.address.trim();
    }

    if (item.address && typeof item.address === 'object') {
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

      const uniqueParts = [...new Set(
        parts
          .filter(Boolean)
          .map((value) => String(value).trim())
          .filter(Boolean)
      )];

      if (uniqueParts.length > 0) {
        return uniqueParts.join(', ');
      }
    }

    if (typeof item.formatted_address === 'string' && item.formatted_address.trim()) {
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

    const uniqueParts = [...new Set(
      parts
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
    )];

    if (uniqueParts.length > 0) {
      return uniqueParts.join(', ');
    }

    return 'Adresse non renseignée';
  };

  /* ==========================================================
     CRÉER UN UTILISATEUR
  ========================================================== */

  const handleCreateUser = async () => {
    try {
      if (!createData.fullname || !createData.email || !createData.phone || !createData.password) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
      }

      if (createData.password.length < 8) {
        showToast('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
      }

      const newUser = {
        fullname: createData.fullname,
        email: createData.email,
        phone: createData.phone,
        password: createData.password,
        role: createData.role,
      };

      await adminService.createUser(newUser);
      setShowCreateModal(false);
      setCreateData({
        fullname: '',
        email: '',
        phone: '',
        password: '',
        role: 'CLIENT',
      });
      await loadUsers();
      showToast('Utilisateur créé avec succès', 'success');
    } catch (error) {
      showToast(`Impossible de créer l'utilisateur: ${error.message}`, 'error');
    }
  };

  /* ==========================================================
     METTRE À JOUR UN UTILISATEUR
  ========================================================== */

  const handleUpdateUser = async () => {
    if (!selectedUser || !selectedUser.id) return;

    try {
      const updateData = {
        fullname: editData.fullname || selectedUser.fullname,
        email: editData.email || selectedUser.email,
        phone: editData.phone || selectedUser.phone,
        bio: editData.bio || selectedUser.bio,
      };

      await adminService.updateUser(selectedUser.id, updateData);

      setShowUserModal(false);
      setEditMode(false);
      await loadUsers();

      showToast('Utilisateur mis à jour avec succès', 'success');
    } catch (error) {
      showToast(`Impossible de mettre à jour: ${error.message}`, 'error');
    }
  };

  /* ==========================================================
     DÉSACTIVER / ACTIVER — AVEC MODAL CENTRÉ
  ========================================================== */

  const toggleActiveStatus = async (targetUser) => {
    if (!targetUser?.id) {
      showToast('Utilisateur non trouvé', 'error');
      return;
    }

    const newStatus = !Boolean(targetUser.is_active);
    const action = newStatus ? 'activer' : 'désactiver';
    const actionPast = newStatus ? 'activé' : 'désactivé';

    showConfirmModal({
      title: newStatus ? 'Activer le compte' : 'Désactiver le compte',
      message: `Voulez-vous ${action} le compte de ${targetUser.fullname || 'cet utilisateur'} ?`,
      confirmText: newStatus ? 'Activer' : 'Désactiver',
      cancelText: 'Annuler',
      destructive: !newStatus,
      onConfirm: async () => {
        try {
          showToast(newStatus ? 'Activation du compte...' : 'Désactivation du compte...', 'info');

          await adminService.toggleUserStatus(targetUser.id, newStatus, 'Action par admin');

          setSelectedUser((prev) =>
            prev && prev.id === targetUser.id ? { ...prev, is_active: newStatus } : prev
          );

          await loadUsers();

          showToast(`Compte ${actionPast} avec succès`, 'success');
        } catch (error) {
          console.error('❌ Error toggle status:', error);
          showToast(`Impossible de ${action} le compte: ${error?.message || 'Erreur serveur'}`, 'error');
        }
      },
    });
  };

  /* ==========================================================
     RÉINITIALISER LE MOT DE PASSE — AVEC MODAL CENTRÉ
  ========================================================== */

  const handleResetPassword = async (targetUser) => {
    if (!targetUser?.id) {
      showToast('Utilisateur non trouvé', 'error');
      return;
    }

    showConfirmModal({
      title: '🔑 Réinitialiser le mot de passe',
      message: `Voulez-vous réinitialiser le mot de passe de ${targetUser.fullname || 'cet utilisateur'} ?\n\nUn nouveau mot de passe sera généré.`,
      confirmText: 'Réinitialiser',
      cancelText: 'Annuler',
      destructive: false,
      onConfirm: async () => {
        try {
          showToast('Réinitialisation du mot de passe...', 'info');

          const result = await adminService.resetUserPassword(targetUser.id, true);

          setSelectedUser((prev) =>
            prev && prev.id === targetUser.id ? { ...prev, ...result } : prev
          );

          await loadUsers();

          const email = result?.email || targetUser.email || '';
          const newPassword = result?.new_password || 'Vérifiez vos emails';

          if (IS_WEB) {
            window.alert(
              `Mot de passe réinitialisé avec succès.\n\nEmail : ${email}\nNouveau mot de passe : ${newPassword}`
            );
          } else {
            Alert.alert(
              'Succès',
              `Mot de passe réinitialisé avec succès\n\n📧 Email: ${email}\n🔑 Nouveau mot de passe: ${newPassword}`,
              [{ text: 'OK' }]
            );
          }

          showToast('Mot de passe réinitialisé avec succès', 'success');
        } catch (error) {
          console.error('❌ Error reset password:', error);
          showToast(`Impossible de réinitialiser: ${error?.message || 'Erreur serveur'}`, 'error');
        }
      },
    });
  };

  /* ==========================================================
     SUPPRESSION DÉFINITIVE — AVEC MODAL CENTRÉ
  ========================================================== */

  const handleDeleteUser = async (targetUser) => {
    if (!targetUser?.id) {
      showToast('Utilisateur non trouvé', 'error');
      return;
    }

    showConfirmModal({
      title: '⚠️ Suppression définitive',
      message: `Voulez-vous supprimer définitivement ${targetUser.fullname || 'cet utilisateur'} ?\n\nCette action est irréversible !`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      destructive: true,
      onConfirm: async () => {
        try {
          showToast('Suppression de l’utilisateur...', 'info');

          await adminService.deleteUser(targetUser.id, true);

          setShowUserModal(false);
          setEditMode(false);
          setSelectedUser(null);

          setSelectedIds((prev) =>
            prev.filter((id) => String(id) !== String(targetUser.id))
          );

          await loadUsers();

          showToast('Utilisateur supprimé définitivement', 'success');
        } catch (error) {
          console.error('❌ Error delete user:', error);
          showToast(`Impossible de supprimer: ${error?.message || 'Erreur serveur'}`, 'error');
        }
      },
    });
  };

  /* ==========================================================
     ACTIONS EN MASSE — AVEC MODAL CENTRÉ
  ========================================================== */

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) {
      showToast('Veuillez sélectionner au moins un utilisateur', 'warning');
      return;
    }

    const actionLabels = {
      activate: 'Activer',
      deactivate: 'Désactiver',
      delete: 'Supprimer définitivement',
    };

    const isDelete = action === 'delete';

    showConfirmModal({
      title: `Actions en masse: ${actionLabels[action]}`,
      message: `Voulez-vous ${actionLabels[action].toLowerCase()} ${selectedIds.length} utilisateur(s) ?`,
      confirmText: 'Confirmer',
      cancelText: 'Annuler',
      destructive: isDelete,
      onConfirm: async () => {
        try {
          showToast(`Traitement de ${selectedIds.length} utilisateur(s)...`, 'info');

          await adminService.bulkUserAction(action, selectedIds);
          setSelectedIds([]);
          await loadUsers();

          showToast(`${selectedIds.length} utilisateur(s) traités avec succès`, 'success');
        } catch (error) {
          showToast(`Impossible d'effectuer l'action: ${error.message}`, 'error');
        }
      },
    });
  };

  /* ==========================================================
     FUNCTIONS
  ========================================================== */

  const getRoleColor = (role) => {
    const map = { CLIENT: '#2196F3', THERAPIST: '#4CAF50', ADMIN: '#D32F2F' };
    return map[role] || '#757575';
  };

  const getRoleLabel = (role) => {
    const map = { CLIENT: 'Client', THERAPIST: 'Thérapeute', ADMIN: 'Admin' };
    return map[role] || role;
  };

  const getRoleIcon = (role) => {
    const map = { CLIENT: 'person-outline', THERAPIST: 'fitness-outline', ADMIN: 'shield-checkmark-outline' };
    return map[role] || 'person-outline';
  };

  const getStatusColor = (isActive) => (isActive ? '#27AE60' : '#E74C3C');
  const getStatusLabel = (isActive) => (isActive ? 'Actif' : 'Inactif');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return dateString;
    }
  };

  const toggleSelect = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  /* ==========================================================
     STATUS BADGE
  ========================================================== */

  const StatusBadge = ({ label, color, dot = false }) => (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: color + '14',
        },
      ]}
    >
      {dot && (
        <View
          style={[
            styles.statusBadgeDot,
            {
              backgroundColor: color,
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
     AVATAR — CARRE DOMBO
  ========================================================== */

  const Avatar = ({ user: avatarUser, size = 44 }) => {
    const initials = avatarUser?.fullname?.charAt(0)?.toUpperCase() || '?';
    const roleColor = getRoleColor(avatarUser?.role);

    return (
      <View
        style={[
          styles.avatarWrapper,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        {avatarUser?.profile_image ? (
          <Image
            source={{ uri: avatarUser.profile_image }}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
            }}
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: roleColor + '18',
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color: roleColor,
                  fontSize: size * 0.4,
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
              backgroundColor: avatarUser?.is_active ? '#27AE60' : '#999999',
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: size * 0.125,
            },
          ]}
        />
      </View>
    );
  };

  /* ==========================================================
     WEB TABLE ROW — AVEC ADRESSE, VIEW ET ACTIONS ICON
  ========================================================== */

  const WebTableRow = ({ item }) => {
    const [hovered, setHovered] = useState(false);
    const isActive = item.is_active && !item.deleted_at;
    const isTherapist = item.role === 'THERAPIST';
    const isOnline = isTherapist && item.is_online;
    const isDeleted = !!item.deleted_at;
    const hasCin = isTherapist && item.cin_number && item.cin_number.trim() !== '';
    const address = getFullAddress(item);

    const handleRowAction = async (action) => {
      if (action === 'edit') {
        setSelectedUser(item);
        setEditData({
          fullname: item.fullname || '',
          email: item.email || '',
          phone: item.phone || '',
          bio: item.bio || '',
        });
        setEditMode(true);
        setShowUserModal(true);
      } else if (action === 'view') {
        setSelectedUser(item);
        setEditData({
          fullname: item.fullname || '',
          email: item.email || '',
          phone: item.phone || '',
          bio: item.bio || '',
        });
        setEditMode(false);
        setShowUserModal(true);
      } else if (action === 'address') {
        setSelectedUserForAddress(item);
        setShowAddressModal(true);
      } else if (action === 'reset') {
        await handleResetPassword(item);
      } else if (action === 'toggle') {
        await toggleActiveStatus(item);
      } else if (action === 'delete') {
        await handleDeleteUser(item);
      }
    };

    return (
      <View
        {...(IS_WEB
          ? {
              onMouseEnter: () => setHovered(true),
              onMouseLeave: () => setHovered(false),
            }
          : {})}
        style={[
          styles.webTableRow,
          {
            backgroundColor: hovered ? themeColors.background : themeColors.surface,
            opacity: isDeleted ? 0.6 : 1,
          },
        ]}
      >
        {/* UTILISATEUR */}
        <View style={[styles.webCell, styles.webCellUser]}>
          <Avatar user={item} size={42} />
          <View style={styles.webUserInfo}>
            <Text
              numberOfLines={1}
              style={[
                styles.webName,
                {
                  color: themeColors.text,
                },
              ]}
            >
              {item.fullname || 'Utilisateur'}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.webEmail,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              {item.email || 'Email non renseigné'}
            </Text>
          </View>
        </View>

        {/* TELEPHONE */}
        <View style={styles.webCell}>
          <Text
            numberOfLines={1}
            style={[
              styles.webCellText,
              {
                color: themeColors.text,
              },
            ]}
          >
            {item.phone || 'N/A'}
          </Text>
        </View>

        {/* ADRESSE */}
        <View style={[styles.webCell, styles.webAddressCell]}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text
            numberOfLines={2}
            style={[
              styles.webCellText,
              {
                color: themeColors.textSecondary,
                flex: 1,
              },
            ]}
          >
            {address}
          </Text>
        </View>

        {/* RÔLE */}
        <View style={styles.webCell}>
          <StatusBadge
            label={getRoleLabel(item.role)}
            color={getRoleColor(item.role)}
          />
        </View>

        {/* COMPTE */}
        <View style={styles.webCell}>
          <StatusBadge
            label={getStatusLabel(isActive)}
            color={getStatusColor(isActive)}
          />
        </View>

        {/* STATUT EN LIGNE */}
        <View style={styles.webCell}>
          {isTherapist ? (
            <StatusBadge
              label={isOnline ? 'En ligne' : 'Hors ligne'}
              color={isOnline ? '#27AE60' : '#999999'}
              dot
            />
          ) : (
            <StatusBadge
              label="N/A"
              color="#999999"
            />
          )}
        </View>

        {/* CIN */}
        <View style={styles.webCell}>
          <StatusBadge
            label={isTherapist ? (hasCin ? item.cin_number : 'Non renseigné') : 'N/A'}
            color={isTherapist ? (hasCin ? colors.primary : '#E74C3C') : '#999999'}
          />
        </View>

        {/* ACTIONS — ICONS AVEC MODAL CENTRÉ */}
        <View style={[styles.webCell, styles.webActionCell]}>
          <View style={styles.webActionGroup}>
            {/* View */}
            <TouchableOpacity
              style={[styles.webActionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => handleRowAction('view')}
              title="Voir"
            >
              <Ionicons name="eye-outline" size={16} color={colors.primary} />
            </TouchableOpacity>

            {/* Adresse */}
            <TouchableOpacity
              style={[styles.webActionButton, { backgroundColor: '#4CAF5020' }]}
              onPress={() => handleRowAction('address')}
              title="Adresse"
            >
              <Ionicons name="map-outline" size={16} color="#4CAF50" />
            </TouchableOpacity>

            {/* Edit */}
            <TouchableOpacity
              style={[styles.webActionButton, { backgroundColor: '#2196F320' }]}
              onPress={() => handleRowAction('edit')}
              title="Modifier"
            >
              <Ionicons name="create-outline" size={16} color="#2196F3" />
            </TouchableOpacity>

            {/* Reset */}
            {!isDeleted && (
              <TouchableOpacity
                style={[styles.webActionButton, { backgroundColor: '#9C27B020' }]}
                onPress={() => handleRowAction('reset')}
                title="Réinitialiser"
              >
                <Ionicons name="key-outline" size={16} color="#9C27B0" />
              </TouchableOpacity>
            )}

            {/* Toggle Active/Inactive */}
            {!isDeleted && (
              <TouchableOpacity
                style={[styles.webActionButton, { backgroundColor: isActive ? '#F5A62320' : '#27AE6020' }]}
                onPress={() => handleRowAction('toggle')}
                title={isActive ? 'Désactiver' : 'Activer'}
              >
                <Ionicons
                  name={isActive ? 'person-remove-outline' : 'person-add-outline'}
                  size={16}
                  color={isActive ? '#F5A623' : '#27AE60'}
                />
              </TouchableOpacity>
            )}

            {/* Delete */}
            <TouchableOpacity
              style={[styles.webActionButton, { backgroundColor: '#E74C3C20' }]}
              onPress={() => handleRowAction('delete')}
              title="Supprimer"
            >
              <Ionicons name="trash-outline" size={16} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /* ==========================================================
     MOBILE CARD — SANS ACTIONS (ACTIONS DANS MODAL)
  ========================================================== */

  const MobileCard = ({ item }) => {
    const isActive = item.is_active && !item.deleted_at;
    const isTherapist = item.role === 'THERAPIST';
    const isOnline = isTherapist && item.is_online;
    const isDeleted = !!item.deleted_at;
    const hasCin = isTherapist && item.cin_number && item.cin_number.trim() !== '';
    const address = getFullAddress(item);

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          setSelectedUser(item);
          setEditData({
            fullname: item.fullname || '',
            email: item.email || '',
            phone: item.phone || '',
            bio: item.bio || '',
          });
          setEditMode(false);
          setShowUserModal(true);
        }}
        style={[
          styles.mobileCard,
          {
            backgroundColor: themeColors.surface,
            opacity: isDeleted ? 0.6 : 1,
          },
        ]}
      >
        <View style={styles.mobileCardHeader}>
          <Avatar user={item} size={52} />

          <View style={styles.mobileCardIdentity}>
            <Text
              numberOfLines={1}
              style={[
                styles.mobileName,
                {
                  color: themeColors.text,
                },
              ]}
            >
              {item.fullname || 'Utilisateur'}
              {isDeleted && <Text style={styles.deletedTag}> (Supprimé)</Text>}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.mobileEmail,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              {item.email || 'Email non renseigné'}
            </Text>

            <View style={styles.mobileStatusLine}>
              <StatusBadge
                label={getRoleLabel(item.role)}
                color={getRoleColor(item.role)}
              />

              <StatusBadge
                label={getStatusLabel(isActive)}
                color={getStatusColor(isActive)}
              />

              {isTherapist && (
                <StatusBadge
                  label={isOnline ? 'En ligne' : 'Hors ligne'}
                  color={isOnline ? '#27AE60' : '#999999'}
                  dot
                />
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
        </View>

        <View
          style={[
            styles.mobileDivider,
            {
              backgroundColor: themeColors.border || '#E8E8E8',
            },
          ]}
        />

        <View style={styles.mobileInfoGrid}>
          <MobileInfo
            icon="call-outline"
            label="Téléphone"
            value={item.phone || 'N/A'}
            themeColors={themeColors}
          />

          <MobileInfo
            icon="card-outline"
            label="CIN"
            value={isTherapist ? (hasCin ? item.cin_number : 'Non renseigné') : 'N/A'}
            themeColors={themeColors}
            valueColor={isTherapist ? (hasCin ? colors.primary : '#E74C3C') : '#999999'}
          />

          <MobileInfo
            icon="location-outline"
            label="Adresse"
            value={address}
            themeColors={themeColors}
            full
          />

          {isTherapist && item.bio && (
            <MobileInfo
              icon="document-text-outline"
              label="Biographie"
              value={item.bio}
              themeColors={themeColors}
              full
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  /* ==========================================================
     INFO MOBILE
  ========================================================== */

  const MobileInfo = ({ icon, label, value, themeColors, valueColor, full }) => (
    <View
      style={[
        styles.mobileInfoItem,
        full && styles.mobileInfoFull,
      ]}
    >
      <View style={styles.mobileInfoLabel}>
        <Ionicons name={icon} size={15} color={colors.primary} />
        <Text
          style={[
            styles.mobileLabelText,
            {
              color: themeColors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={full ? 3 : 2}
        style={[
          styles.mobileValueText,
          {
            color: valueColor || themeColors.text,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  /* ==========================================================
     WEB TABLE
  ========================================================== */

  const renderWebTable = () => {
    return (
      <View
        style={[
          styles.webTableWrapper,
          {
            backgroundColor: themeColors.surface,
          },
        ]}
      >
        <View
          style={[
            styles.webTableHeader,
            {
              backgroundColor: themeColors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.webHeaderCell,
              styles.webCellUser,
            ]}
          >
            <Text
              style={[
                styles.webHeaderText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              UTILISATEUR
            </Text>
          </View>

          <HeaderCell label="TÉLÉPHONE" themeColors={themeColors} />

          <HeaderCell label="ADRESSE" themeColors={themeColors} />

          <HeaderCell label="RÔLE" themeColors={themeColors} />

          <HeaderCell label="COMPTE" themeColors={themeColors} />

          <HeaderCell label="STATUT" themeColors={themeColors} />

          <HeaderCell label="CIN" themeColors={themeColors} />

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
                  color: themeColors.textSecondary,
                },
              ]}
            >
              ACTIONS
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.webTableScroll}
          contentContainerStyle={styles.webTableScrollContent}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          {paginatedUsers.map((item) => (
            <WebTableRow key={String(item.id)} item={item} />
          ))}

          <View style={styles.webBottomSpace} />
        </ScrollView>

        <View
          style={[
            styles.pagination,
            {
              borderTopColor: themeColors.border || '#EAEAEA',
              backgroundColor: themeColors.surface,
            },
          ]}
        >
          <Text
            style={[
              styles.paginationInfo,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            {filteredUsers.length > 0
              ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(
                  currentPage * ITEMS_PER_PAGE,
                  filteredUsers.length
                )} sur ${filteredUsers.length}`
              : '0 résultat'}
          </Text>

          <View style={styles.paginationControls}>
            <TouchableOpacity
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
              style={[
                styles.paginationButton,
                {
                  opacity: currentPage === 1 ? 0.4 : 1,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={17} color={themeColors.text} />
            </TouchableOpacity>

            <View
              style={[
                styles.pageNumber,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <Text style={styles.pageNumberText}>{currentPage}</Text>
            </View>

            <Text
              style={[
                styles.pageTotal,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              / {totalPages}
            </Text>

            <TouchableOpacity
              disabled={currentPage === totalPages}
              onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              style={[
                styles.paginationButton,
                {
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={17} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /* ==========================================================
     MOBILE LIST
  ========================================================== */

  const renderMobileList = () => {
    return (
      <FlatList
        data={filteredUsers}
        renderItem={({ item }) => <MobileCard item={item} />}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.mobileListContent,
          {
            paddingHorizontal: 0,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      />
    );
  };

  /* ==========================================================
     STATS
  ========================================================== */

  const renderStats = () => {
    if (!stats) return null;

    const items = [
      { icon: 'people-outline', label: 'Total', value: stats.total || 0, color: '#4A90D9' },
      { icon: 'person-outline', label: 'Clients', value: stats.clients || 0, color: '#4A90D9' },
      { icon: 'fitness-outline', label: 'Thérapeutes', value: stats.therapists || 0, color: '#27AE60' },
      { icon: 'shield-checkmark-outline', label: 'Admins', value: stats.admins || 0, color: '#E74C3C' },
      { icon: 'checkmark-circle-outline', label: 'Actifs', value: stats.active || 0, color: '#27AE60' },
      { icon: 'close-circle-outline', label: 'Inactifs', value: stats.inactive || 0, color: '#E74C3C' },
      { icon: 'trending-up-outline', label: 'Nouveaux (7j)', value: stats.new_users_last_week || 0, color: '#F5A623' },
      { icon: 'shield-checkmark-outline', label: 'Vérifiés', value: stats.verified_therapists || 0, color: '#27AE60' },
      { icon: 'wifi-outline', label: 'En ligne', value: stats.online_therapists || 0, color: '#4A90D9' },
    ];

    return (
      <View
        style={[
          styles.statsContainer,
          {
            backgroundColor: themeColors.surface,
            marginHorizontal: IS_WEB ? horizontalPadding : 0,
          },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.statsGrid}>
            {items.map((item, index) => (
              <View key={index} style={styles.statItem}>
                <View
                  style={[
                    styles.statIconContainer,
                    {
                      backgroundColor: item.color + '20',
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={16} color={item.color} />
                </View>
                <Text
                  style={[
                    styles.statValue,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {item.value}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  /* ==========================================================
     HEADER CELL
  ========================================================== */

  const HeaderCell = ({ label, themeColors }) => (
    <View style={styles.webHeaderCell}>
      <Text
        style={[
          styles.webHeaderText,
          {
            color: themeColors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  /* ==========================================================
     TOAST COMPONENT
  ========================================================== */

  const Toast = () => {
    if (!toast) return null;

    const isError = toast.type === 'error';
    const isWarning = toast.type === 'warning';
    const toastColor = isError ? '#E74C3C' : isWarning ? '#F5A623' : '#27AE60';
    const iconName = isError ? 'close-circle' : isWarning ? 'warning' : 'checkmark-circle';

    return (
      <View pointerEvents="none" style={[styles.toastPosition]}>
        <View
          style={[
            styles.toast,
            {
              backgroundColor: themeColors.surface,
              borderLeftColor: toastColor,
            },
          ]}
        >
          <View
            style={[
              styles.toastIcon,
              {
                backgroundColor: toastColor + '15',
              },
            ]}
          >
            <Ionicons name={iconName} size={20} color={toastColor} />
          </View>

          <Text
            numberOfLines={3}
            style={[
              styles.toastText,
              {
                color: themeColors.text,
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
     MODAL CLOSE
  ========================================================== */

  const closeModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
    setEditMode(false);
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: themeColors.background,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <Header title="Utilisateurs" showBack />

        <View
          style={[
            styles.mainContent,
            {
              paddingHorizontal: IS_WEB ? 0 : 0,
            },
          ]}
        >
          {/* TOP BAR */}
          <View
            style={[
              styles.topBar,
              {
                paddingHorizontal: IS_WEB ? horizontalPadding : 12,
              },
            ]}
          >
            <View style={styles.titleBlock}>
              <Text
                style={[
                  styles.pageTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Gestion des utilisateurs
              </Text>

              <Text
                style={[
                  styles.pageSubtitle,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                {filteredUsers.length} utilisateur
                {filteredUsers.length > 1 ? 's' : ''} affiché
                {filteredUsers.length > 1 ? 's' : ''}
                {showDeleted && ' (corbeille)'}
              </Text>
            </View>

            <View style={styles.topBarActions}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.primary,
                    marginRight: 8,
                  },
                ]}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={18} color="#fff" />
                {IS_WEB && <Text style={[styles.actionButtonText, { color: '#fff' }]}>Ajouter</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: showDeleted ? '#E74C3C' : '#666',
                    marginRight: 8,
                  },
                ]}
                onPress={() => setShowDeleted(!showDeleted)}
              >
                <Ionicons name={showDeleted ? 'trash' : 'trash-outline'} size={18} color="#fff" />
                {IS_WEB && (
                  <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                    {showDeleted ? 'Actifs' : 'Corbeille'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onRefresh}
                style={[
                  styles.refreshButton,
                  {
                    backgroundColor: themeColors.surface,
                  },
                ]}
              >
                <Ionicons name="refresh-outline" size={19} color={colors.primary} />
                {IS_WEB && (
                  <Text
                    style={[
                      styles.refreshText,
                      {
                        color: colors.primary,
                      },
                    ]}
                  >
                    Actualiser
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* BULK ACTIONS */}
          {selectedIds.length > 0 && (
            <View
              style={[
                styles.bulkActionsContainer,
                {
                  paddingHorizontal: IS_WEB ? horizontalPadding : 12,
                  backgroundColor: colors.primary + '10',
                },
              ]}
            >
              <Text
                style={[
                  styles.bulkSelectedText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
              </Text>

              <View style={styles.bulkActions}>
                <TouchableOpacity
                  style={[styles.bulkButton, { backgroundColor: '#27AE60' }]}
                  onPress={() => handleBulkAction('activate')}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.bulkButtonText}>Activer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bulkButton, { backgroundColor: '#F5A623' }]}
                  onPress={() => handleBulkAction('deactivate')}
                >
                  <Ionicons name="close-circle" size={16} color="#fff" />
                  <Text style={styles.bulkButtonText}>Désactiver</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bulkButton, { backgroundColor: '#E74C3C' }]}
                  onPress={() => handleBulkAction('delete')}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.bulkButtonText}>Supprimer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bulkButton, { backgroundColor: '#999' }]}
                  onPress={() => setSelectedIds([])}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.bulkButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* SEARCH */}
          <View
            style={[
              styles.searchContainer,
              {
                paddingHorizontal: IS_WEB ? horizontalPadding : 12,
              },
            ]}
          >
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: themeColors.surface,
                },
              ]}
            >
              <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} />

              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: themeColors.text,
                  },
                ]}
                placeholder="Rechercher par nom, email, téléphone..."
                placeholderTextColor={themeColors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearch}
              />

              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* FILTERS */}
          <View
            style={[
              styles.filtersContainer,
              {
                paddingHorizontal: IS_WEB ? horizontalPadding : 12,
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              {filters.map((filter) => {
                const active = selectedFilter === filter.id;

                return (
                  <TouchableOpacity
                    key={filter.id}
                    onPress={() => handleFilter(filter.id)}
                    style={[
                      styles.filterButton,
                      {
                        backgroundColor: active ? colors.primary : themeColors.surface,
                      },
                    ]}
                  >
                    <Ionicons
                      name={filter.icon}
                      size={15}
                      color={active ? '#fff' : themeColors.text}
                    />

                    <Text
                      style={[
                        styles.filterText,
                        {
                          color: active ? '#fff' : themeColors.text,
                        },
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* STATS TOGGLE */}
          <View
            style={[
              styles.statsToggleContainer,
              {
                paddingHorizontal: IS_WEB ? horizontalPadding : 12,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.statsToggle}
              onPress={() => setShowStats(!showStats)}
            >
              <Text
                style={[
                  styles.statsToggleText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                {showStats ? '📊 Masquer les statistiques' : '📊 Voir les statistiques'}
              </Text>

              <Ionicons
                name={showStats ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {showStats && renderStats()}

          {/* ERROR */}
          {error && (
            <View
              style={[
                styles.errorBanner,
                {
                  marginHorizontal: IS_WEB ? horizontalPadding : 12,
                  backgroundColor: '#E74C3C10',
                  borderColor: '#E74C3C40',
                },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={19} color="#E74C3C" />

              <Text style={styles.errorText}>{error}</Text>

              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  loadAllData();
                }}
              >
                <Ionicons name="refresh-outline" size={18} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          )}

          {/* CONTENT */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />

              <Text
                style={[
                  styles.loadingText,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                Chargement des utilisateurs...
              </Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: colors.primary + '12',
                  },
                ]}
              >
                <Ionicons name="people-outline" size={48} color={colors.primary} />
              </View>

              <Text
                style={[
                  styles.emptyStateTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {showDeleted ? 'Corbeille vide' : 'Aucun utilisateur'}
              </Text>

              <Text
                style={[
                  styles.emptyStateText,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                {searchQuery
                  ? 'Aucun résultat pour cette recherche.'
                  : showDeleted
                  ? 'Aucun utilisateur supprimé pour le moment.'
                  : 'Aucun utilisateur trouvé.'}
              </Text>
            </View>
          ) : isDesktop ? (
            renderWebTable()
          ) : (
            renderMobileList()
          )}
        </View>

        {/* ======================================================
            DETAIL MODAL - FIXED FOR ANDROID (AVEC TOUTES LES ACTIONS)
        ====================================================== */}

        <Modal
          visible={showUserModal}
          transparent
          animationType={IS_WEB ? 'fade' : 'slide'}
          onRequestClose={closeModal}
          statusBarTranslucent={!IS_WEB}
        >
          <KeyboardAvoidingView
            style={[
              styles.modalOverlay,
              IS_WEB && styles.modalOverlayWeb,
            ]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View
              style={[
                styles.modalContainer,
                {
                  backgroundColor: themeColors.surface,
                  maxWidth: IS_WEB ? 820 : '100%',
                  maxHeight: IS_WEB ? '94%' : '100%',
                },
                IS_WEB && styles.modalWebContainer,
                !IS_WEB && styles.modalContainerMobile,
              ]}
            >
              {/* MODAL HEADER */}
              <View style={styles.modalHeader}>
                <View>
                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {editMode ? "✏️ Modifier l'utilisateur" : '👤 Détails utilisateur'}
                  </Text>

                  <Text
                    style={[
                      styles.modalSubtitle,
                      {
                        color: themeColors.textSecondary,
                      },
                    ]}
                  >
                    {editMode ? 'Modifier les informations' : 'Informations et actions'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={closeModal}
                  style={[
                    styles.modalCloseButton,
                    {
                      backgroundColor: themeColors.background,
                    },
                  ]}
                >
                  <Ionicons name="close" size={21} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {selectedUser && (
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
                  <View style={styles.profileHeader}>
                    <Avatar user={selectedUser} size={84} />

                    <View style={styles.profileHeaderInfo}>
                      <Text
                        style={[
                          styles.modalName,
                          {
                            color: themeColors.text,
                          },
                        ]}
                      >
                        {selectedUser.fullname || 'Utilisateur'}
                        {selectedUser.deleted_at && (
                          <Text style={styles.deletedTag}> (Supprimé)</Text>
                        )}
                      </Text>

                      <Text
                        style={[
                          styles.modalEmail,
                          {
                            color: themeColors.textSecondary,
                          },
                        ]}
                      >
                        {selectedUser.email || 'Email inconnu'}
                      </Text>

                      <View style={styles.profileBadges}>
                        <StatusBadge
                          label={getRoleLabel(selectedUser.role)}
                          color={getRoleColor(selectedUser.role)}
                        />

                        <StatusBadge
                          label={getStatusLabel(selectedUser.is_active)}
                          color={getStatusColor(selectedUser.is_active)}
                        />

                        {selectedUser.role === 'THERAPIST' && (
                          <StatusBadge
                            label={selectedUser.is_online ? 'En ligne' : 'Hors ligne'}
                            color={selectedUser.is_online ? '#27AE60' : '#999999'}
                            dot
                          />
                        )}
                      </View>
                    </View>
                  </View>

                  {!editMode ? (
                    <>
                      {/* INFORMATION */}
                      <SectionTitle title="Informations générales" themeColors={themeColors} />

                      <View style={styles.infoGrid}>
                        <InfoRow
                          label="Téléphone"
                          value={selectedUser.phone || 'N/A'}
                          themeColors={themeColors}
                        />

                        <InfoRow
                          label="Rôle"
                          value={getRoleLabel(selectedUser.role)}
                          valueColor={getRoleColor(selectedUser.role)}
                          themeColors={themeColors}
                        />

                        <InfoRow
                          label="Statut"
                          value={getStatusLabel(selectedUser.is_active)}
                          valueColor={getStatusColor(selectedUser.is_active)}
                          themeColors={themeColors}
                        />

                        <InfoRow
                          label="Inscrit le"
                          value={formatDate(selectedUser.created_at)}
                          themeColors={themeColors}
                        />

                        {selectedUser.deleted_at && (
                          <InfoRow
                            label="Supprimé le"
                            value={formatDate(selectedUser.deleted_at)}
                            valueColor="#E74C3C"
                            themeColors={themeColors}
                          />
                        )}

                        <InfoRow
                          label="Adresse"
                          value={getFullAddress(selectedUser)}
                          themeColors={themeColors}
                        />

                        {selectedUser.role === 'THERAPIST' && (
                          <>
                            <InfoRow
                              label="Note"
                              value={`⭐ ${selectedUser.rating || 0} (${selectedUser.total_reviews || 0} avis)`}
                              valueColor="#F5A623"
                              themeColors={themeColors}
                            />

                            <InfoRow
                              label="Vérification"
                              value={
                                selectedUser.verification_status === 'approved'
                                  ? '✅ Vérifié'
                                  : selectedUser.verification_status === 'pending'
                                  ? '⏳ En attente'
                                  : '❌ Rejeté'
                              }
                              valueColor={
                                selectedUser.verification_status === 'approved'
                                  ? '#27AE60'
                                  : selectedUser.verification_status === 'pending'
                                  ? '#F5A623'
                                  : '#E74C3C'
                              }
                              themeColors={themeColors}
                            />

                            <InfoRow
                              label="Statut en ligne"
                              value={selectedUser.is_online ? '🟢 En ligne' : '🔴 Hors ligne'}
                              valueColor={selectedUser.is_online ? '#27AE60' : '#999999'}
                              themeColors={themeColors}
                            />

                            <InfoRow
                              label="N° CIN"
                              value={selectedUser.cin_number && selectedUser.cin_number.trim() !== '' ? selectedUser.cin_number : 'Non renseigné'}
                              valueColor={
                                selectedUser.cin_number && selectedUser.cin_number.trim() !== ''
                                  ? colors.primary
                                  : '#E74C3C'
                              }
                              themeColors={themeColors}
                            />

                            {selectedUser.identity_document_url && (
                              <View style={styles.cinContainer}>
                                <Text
                                  style={[
                                    styles.cinLabel,
                                    {
                                      color: themeColors.textSecondary,
                                    },
                                  ]}
                                >
                                  📷 Photo du CIN
                                </Text>
                                <Image
                                  source={{ uri: selectedUser.identity_document_url }}
                                  style={styles.cinImage}
                                  resizeMode="contain"
                                />
                              </View>
                            )}

                            {selectedUser.bio && (
                              <InfoRow
                                label="Biographie"
                                value={selectedUser.bio}
                                themeColors={themeColors}
                              />
                            )}
                          </>
                        )}
                      </View>

                      {/* ONLINE SWITCH */}
                      <View
                        style={[
                          styles.switchBox,
                          {
                            backgroundColor: themeColors.background,
                          },
                        ]}
                      >
                        <View>
                          <Text
                            style={[
                              styles.switchTitle,
                              {
                                color: themeColors.text,
                              },
                            ]}
                          >
                            Statut du compte
                          </Text>

                          <Text
                            style={[
                              styles.switchSubtitle,
                              {
                                color: themeColors.textSecondary,
                              },
                            ]}
                          >
                            Activer ou désactiver le compte
                          </Text>
                        </View>

                        <View style={styles.switchRight}>
                          <Switch
                            value={selectedUser.is_active}
                            onValueChange={() => toggleActiveStatus(selectedUser)}
                            trackColor={{
                              false: '#D0D0D0',
                              true: colors.primary,
                            }}
                            thumbColor="#fff"
                          />

                          <Text
                            style={[
                              styles.switchStatus,
                              {
                                color: selectedUser.is_active ? '#27AE60' : '#999999',
                              },
                            ]}
                          >
                            {selectedUser.is_active ? 'Actif' : 'Inactif'}
                          </Text>
                        </View>
                      </View>

                      {/* ADDRESS ACTION */}
                      <SectionTitle title="Adresse" themeColors={themeColors} />

                      <View
                        style={[
                          styles.addressBox,
                          {
                            backgroundColor: colors.primary + '08',
                            borderColor: colors.primary + '25',
                          },
                        ]}
                      >
                        <View style={styles.addressBoxHeader}>
                          <View
                            style={[
                              styles.addressIcon,
                              {
                                backgroundColor: colors.primary + '15',
                              },
                            ]}
                          >
                            <Ionicons name="location" size={21} color={colors.primary} />
                          </View>

                          <View style={styles.addressBoxTitleContainer}>
                            <Text
                              style={[
                                styles.addressBoxTitle,
                                {
                                  color: themeColors.text,
                                },
                              ]}
                            >
                              Adresse enregistrée
                            </Text>

                            <Text
                              style={[
                                styles.addressBoxSubtitle,
                                {
                                  color: themeColors.textSecondary,
                                },
                              ]}
                            >
                              {getFullAddress(selectedUser)}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            setSelectedUserForAddress(selectedUser);
                            setShowAddressModal(true);
                          }}
                          style={[
                            styles.modalAddressButton,
                            {
                              backgroundColor: colors.primary,
                            },
                          ]}
                        >
                          <Ionicons name="map-outline" size={18} color="#fff" />

                          <Text style={styles.modalAddressButtonText}>
                            Modifier l'adresse sur la carte
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* ACTIONS — TOUTES DANS LE MODAL AVEC MODAL CENTRÉ */}
                      <SectionTitle title="Actions" themeColors={themeColors} />

                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          style={[
                            styles.modalAction,
                            {
                              backgroundColor: '#2196F3',
                            },
                          ]}
                          onPress={() => {
                            setEditData({
                              fullname: selectedUser.fullname || '',
                              email: selectedUser.email || '',
                              phone: selectedUser.phone || '',
                              bio: selectedUser.bio || '',
                            });
                            setEditMode(true);
                          }}
                        >
                          <Ionicons name="create-outline" size={18} color="#fff" />
                          <Text style={styles.modalActionText}>Modifier</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalAction,
                            {
                              backgroundColor: selectedUser.is_active ? '#F5A623' : '#27AE60',
                            },
                          ]}
                          onPress={() => toggleActiveStatus(selectedUser)}
                        >
                          <Ionicons
                            name={selectedUser.is_active ? 'person-remove-outline' : 'person-add-outline'}
                            size={18}
                            color="#fff"
                          />
                          <Text style={styles.modalActionText}>
                            {selectedUser.is_active ? 'Désactiver' : 'Activer'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalAction,
                            {
                              backgroundColor: '#9C27B0',
                            },
                          ]}
                          onPress={() => handleResetPassword(selectedUser)}
                        >
                          <Ionicons name="key-outline" size={18} color="#fff" />
                          <Text style={styles.modalActionText}>Reset</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalAction,
                            {
                              backgroundColor: '#E74C3C',
                            },
                          ]}
                          onPress={() => handleDeleteUser(selectedUser)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#fff" />
                          <Text style={styles.modalActionText}>Supprimer</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    /* EDIT FORM */
                    <View style={styles.editForm}>
                      <View style={styles.editField}>
                        <Text
                          style={[
                            styles.editLabel,
                            {
                              color: themeColors.textSecondary,
                            },
                          ]}
                        >
                          Nom complet *
                        </Text>
                        <TextInput
                          style={[
                            styles.editInput,
                            {
                              color: themeColors.text,
                              borderColor: themeColors.border || '#E0E0E0',
                            },
                          ]}
                          value={editData.fullname}
                          onChangeText={(text) => setEditData({ ...editData, fullname: text })}
                          placeholder="Nom complet"
                          placeholderTextColor={themeColors.textSecondary}
                        />
                      </View>

                      <View style={styles.editField}>
                        <Text
                          style={[
                            styles.editLabel,
                            {
                              color: themeColors.textSecondary,
                            },
                          ]}
                        >
                          Email *
                        </Text>
                        <TextInput
                          style={[
                            styles.editInput,
                            {
                              color: themeColors.text,
                              borderColor: themeColors.border || '#E0E0E0',
                            },
                          ]}
                          value={editData.email}
                          onChangeText={(text) => setEditData({ ...editData, email: text })}
                          placeholder="Email"
                          placeholderTextColor={themeColors.textSecondary}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      <View style={styles.editField}>
                        <Text
                          style={[
                            styles.editLabel,
                            {
                              color: themeColors.textSecondary,
                            },
                          ]}
                        >
                          Téléphone *
                        </Text>
                        <TextInput
                          style={[
                            styles.editInput,
                            {
                              color: themeColors.text,
                              borderColor: themeColors.border || '#E0E0E0',
                            },
                          ]}
                          value={editData.phone}
                          onChangeText={(text) => setEditData({ ...editData, phone: text })}
                          placeholder="Téléphone"
                          placeholderTextColor={themeColors.textSecondary}
                          keyboardType="phone-pad"
                        />
                      </View>

                      {selectedUser.role === 'THERAPIST' && (
                        <View style={styles.editField}>
                          <Text
                            style={[
                              styles.editLabel,
                              {
                                color: themeColors.textSecondary,
                              },
                            ]}
                          >
                            Biographie
                          </Text>
                          <TextInput
                            style={[
                              styles.editTextArea,
                              {
                                color: themeColors.text,
                                borderColor: themeColors.border || '#E0E0E0',
                              },
                            ]}
                            value={editData.bio}
                            onChangeText={(text) => setEditData({ ...editData, bio: text })}
                            placeholder="Biographie"
                            placeholderTextColor={themeColors.textSecondary}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        </View>
                      )}

                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={[styles.editButton, styles.editButtonCancel]}
                          onPress={() => setEditMode(false)}
                        >
                          <Text style={[styles.editButtonText, { color: '#333' }]}>Annuler</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.editButton, styles.editButtonSave]}
                          onPress={handleUpdateUser}
                        >
                          <Ionicons name="save-outline" size={18} color="#fff" />
                          <Text style={[styles.editButtonText, { color: '#fff' }]}>Enregistrer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ======================================================
            CREATE MODAL - FIXED FOR ANDROID
        ====================================================== */}

        <Modal
          visible={showCreateModal}
          transparent
          animationType={IS_WEB ? 'fade' : 'slide'}
          onRequestClose={() => setShowCreateModal(false)}
          statusBarTranslucent={!IS_WEB}
        >
          <KeyboardAvoidingView
            style={[
              styles.modalOverlay,
              IS_WEB && styles.modalOverlayWeb,
            ]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View
              style={[
                styles.modalContainer,
                {
                  backgroundColor: themeColors.surface,
                  maxWidth: IS_WEB ? 600 : '100%',
                  maxHeight: IS_WEB ? '94%' : '100%',
                },
                IS_WEB && styles.modalWebContainer,
                !IS_WEB && styles.modalContainerMobile,
              ]}
            >
              {/* MODAL HEADER */}
              <View style={styles.modalHeader}>
                <View>
                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    ➕ Créer un utilisateur
                  </Text>

                  <Text
                    style={[
                      styles.modalSubtitle,
                      {
                        color: themeColors.textSecondary,
                      },
                    ]}
                  >
                    Remplir les informations
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  style={[
                    styles.modalCloseButton,
                    {
                      backgroundColor: themeColors.background,
                    },
                  ]}
                >
                  <Ionicons name="close" size={21} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator
                contentContainerStyle={[
                  styles.modalScrollContent,
                  !IS_WEB && { paddingBottom: 40 },
                ]}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.createForm}>
                  <View style={styles.editField}>
                    <Text
                      style={[
                        styles.editLabel,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      Nom complet *
                    </Text>
                    <TextInput
                      style={[
                        styles.editInput,
                        {
                          color: themeColors.text,
                          borderColor: themeColors.border || '#E0E0E0',
                        },
                      ]}
                      value={createData.fullname}
                      onChangeText={(text) => setCreateData({ ...createData, fullname: text })}
                      placeholder="Nom complet"
                      placeholderTextColor={themeColors.textSecondary}
                    />
                  </View>

                  <View style={styles.editField}>
                    <Text
                      style={[
                        styles.editLabel,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      Email *
                    </Text>
                    <TextInput
                      style={[
                        styles.editInput,
                        {
                          color: themeColors.text,
                          borderColor: themeColors.border || '#E0E0E0',
                        },
                      ]}
                      value={createData.email}
                      onChangeText={(text) => setCreateData({ ...createData, email: text })}
                      placeholder="Email"
                      placeholderTextColor={themeColors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.editField}>
                    <Text
                      style={[
                        styles.editLabel,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      Téléphone *
                    </Text>
                    <TextInput
                      style={[
                        styles.editInput,
                        {
                          color: themeColors.text,
                          borderColor: themeColors.border || '#E0E0E0',
                        },
                      ]}
                      value={createData.phone}
                      onChangeText={(text) => setCreateData({ ...createData, phone: text })}
                      placeholder="0321234567"
                      placeholderTextColor={themeColors.textSecondary}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.editField}>
                    <Text
                      style={[
                        styles.editLabel,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      Mot de passe *
                    </Text>
                    <TextInput
                      style={[
                        styles.editInput,
                        {
                          color: themeColors.text,
                          borderColor: themeColors.border || '#E0E0E0',
                        },
                      ]}
                      value={createData.password}
                      onChangeText={(text) => setCreateData({ ...createData, password: text })}
                      placeholder="Minimum 8 caractères"
                      placeholderTextColor={themeColors.textSecondary}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.editField}>
                    <Text
                      style={[
                        styles.editLabel,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      Rôle
                    </Text>
                    <View style={styles.roleSelector}>
                      {roles.map((role) => (
                        <TouchableOpacity
                          key={role.value}
                          style={[
                            styles.roleOption,
                            createData.role === role.value && styles.roleOptionActive,
                            {
                              borderColor:
                                createData.role === role.value ? role.color : 'transparent',
                            },
                          ]}
                          onPress={() => setCreateData({ ...createData, role: role.value })}
                        >
                          <Ionicons
                            name={role.icon}
                            size={16}
                            color={
                              createData.role === role.value
                                ? role.color
                                : themeColors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.roleOptionText,
                              {
                                color:
                                  createData.role === role.value
                                    ? role.color
                                    : themeColors.textSecondary,
                              },
                            ]}
                          >
                            {role.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.editButton, styles.editButtonCancel]}
                      onPress={() => setShowCreateModal(false)}
                    >
                      <Text style={[styles.editButtonText, { color: '#333' }]}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.editButton, styles.editButtonSave]}
                      onPress={handleCreateUser}
                    >
                      <Ionicons name="person-add-outline" size={18} color="#fff" />
                      <Text style={[styles.editButtonText, { color: '#fff' }]}>Créer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ======================================================
            ADDRESS MODAL — INDÉPENDANT
        ====================================================== */}

        <AdminUserAddressModal
          visible={showAddressModal}
          userId={selectedUserForAddress?.id}
          userName={selectedUserForAddress?.fullname}
          onClose={() => {
            setShowAddressModal(false);
            setSelectedUserForAddress(null);
          }}
          onSaved={() => {
            // ✅ FIXÉ: Tsy mandray data, tsy misy fifandraisana amin'ny searchQuery
            // Recharger simplement la liste des utilisateurs
            loadAllData();
          }}
        />

        {/* ======================================================
            CONFIRMATION MODAL CENTRÉ
        ====================================================== */}

        <ConfirmationModal />

        {/* ======================================================
            TOAST
        ====================================================== */}

        <Toast />
      </View>
    </SafeAreaView>
  );
};

/* ================================================================
   SECTION TITLE
================================================================ */

const SectionTitle = ({ title, themeColors }) => (
  <Text
    style={[
      styles.sectionTitle,
      {
        color: themeColors.text,
      },
    ]}
  >
    {title}
  </Text>
);

/* ================================================================
   INFO ROW
================================================================ */

const InfoRow = ({ label, value, valueColor, themeColors }) => (
  <View
    style={[
      styles.modalInfoRow,
      {
        borderBottomColor: themeColors.border || '#EAEAEA',
      },
    ]}
  >
    <Text
      style={[
        styles.modalInfoLabel,
        {
          color: themeColors.textSecondary,
        },
      ]}
    >
      {label}
    </Text>

    <Text
      style={[
        styles.modalInfoValue,
        {
          color: valueColor || themeColors.text,
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
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 10,
  },

  titleBlock: {
    flex: 1,
  },

  pageTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
  },

  pageSubtitle: {
    fontSize: 12,
    marginTop: 3,
    fontFamily: typography.fontFamily.regular,
  },

  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 40,
  },

  actionButtonText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
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
    fontFamily: typography.fontFamily.semiBold,
  },

  /* ============================================================
     BULK ACTIONS
  ============================================================ */

  bulkActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },

  bulkSelectedText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },

  bulkActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },

  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 32,
  },

  bulkButtonText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
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
    fontFamily: typography.fontFamily.regular,
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
    fontFamily: typography.fontFamily.medium,
  },

  /* ============================================================
     STATS
  ============================================================ */

  statsToggleContainer: {
    paddingVertical: 4,
  },

  statsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },

  statsToggleText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
  },

  statsContainer: {
    marginBottom: 10,
    borderRadius: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 12,
  },

  statItem: {
    alignItems: 'center',
    minWidth: 68,
    paddingVertical: 4,
  },

  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  statValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
  },

  statLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
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
    fontFamily: typography.fontFamily.medium,
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
    fontFamily: typography.fontFamily.regular,
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
    fontFamily: typography.fontFamily.bold,
  },

  emptyStateText: {
    marginTop: 5,
    fontSize: 13,
    textAlign: 'center',
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
    fontFamily: typography.fontFamily.medium,
  },

  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    fontFamily: typography.fontFamily.bold,
  },

  avatarOnline: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#fff',
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
    minWidth: 80,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },

  webHeaderText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
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
    minWidth: 80,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },

  webCellUser: {
    flex: 1.5,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  webUserInfo: {
    flex: 1,
    minWidth: 0,
  },

  webName: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
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
    flex: 1.2,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },

  webActionCell: {
    flex: 1.5,
    minWidth: 180,
    alignItems: 'center',
  },

  webActionGroup: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  webActionButton: {
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
     PAGINATION
  ============================================================ */

  pagination: {
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },

  paginationInfo: {
    fontSize: 11,
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
    fontFamily: typography.fontFamily.bold,
  },

  pageTotal: {
    fontSize: 11,
  },

  /* ============================================================
     MOBILE CARD
  ============================================================ */

  mobileListContent: {
    paddingTop: 3,
    paddingBottom: 120,
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
    fontFamily: typography.fontFamily.bold,
  },

  deletedTag: {
    fontSize: 12,
    color: '#E74C3C',
    fontFamily: typography.fontFamily.medium,
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
    fontFamily: typography.fontFamily.medium,
  },

  mobileCardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },

  mobileFooterButton: {
    flex: 1,
    minWidth: '45%',
    minHeight: 38,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  mobileFooterButtonText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
  },

  /* ============================================================
     MODAL - FIXED FOR ANDROID
  ============================================================ */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
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
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },

  modalTitle: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
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
    fontFamily: typography.fontFamily.bold,
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
    fontFamily: typography.fontFamily.bold,
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
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },

  modalInfoLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },

  modalInfoValue: {
    flex: 1.4,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
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
    justifyContent: 'space-between',
  },

  switchTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
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
    fontFamily: typography.fontFamily.semiBold,
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
    fontFamily: typography.fontFamily.bold,
  },

  addressBoxSubtitle: {
    fontSize: 10,
    marginTop: 2,
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
    fontFamily: typography.fontFamily.semiBold,
  },

  /* ============================================================
     CIN
  ============================================================ */

  cinContainer: {
    marginBottom: 8,
    paddingVertical: 8,
  },

  cinLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 4,
  },

  cinImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },

  /* ============================================================
     MODAL ACTIONS
  ============================================================ */

  modalActions: {
    marginTop: 8,
    paddingTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  modalAction: {
    flex: 1,
    minWidth: '45%',
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
    fontFamily: typography.fontFamily.semiBold,
  },

  /* ============================================================
     EDIT FORM
  ============================================================ */

  editForm: {
    marginTop: 4,
  },

  createForm: {
    marginTop: 4,
  },

  editField: {
    marginBottom: 14,
  },

  editLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 6,
  },

  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    minHeight: 44,
  },

  editTextArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },

  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
  },

  editButtonCancel: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  editButtonSave: {
    backgroundColor: colors.primary,
  },

  editButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
  },

  /* ============================================================
     ROLE SELECTOR
  ============================================================ */

  roleSelector: {
    flexDirection: 'row',
    gap: 8,
  },

  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    minHeight: 44,
  },

  roleOptionActive: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },

  roleOptionText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },

  /* ============================================================
     CONFIRMATION MODAL CENTRÉ
  ============================================================ */

  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  confirmModalContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },

  confirmIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  confirmTitle: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: 8,
  },

  confirmMessage: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  confirmButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },

  confirmButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  confirmCancelButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },

  confirmActionButton: {},

  confirmButtonText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
  },

  confirmActionText: {
    color: '#FFFFFF',
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
    maxWidth: IS_WEB ? 520 : '88%',
    minWidth: IS_WEB ? 300 : undefined,

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
    fontFamily: typography.fontFamily.medium,
  },
});

export default UsersScreen;