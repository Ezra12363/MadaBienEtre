// src/navigation/DrawerNavigator.js
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, Image, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, typography } from '../theme';

// Navigateurs
import ClientNavigator from './ClientNavigator';
import TherapistNavigator from './TherapistNavigator';
import AdminNavigator from './AdminNavigator';
import AuthNavigator from './AuthNavigator';

// Écrans communs
import SOSScreen from '../screens/client/SOSScreen';
import NotificationScreen from '../screens/client/NotificationScreen';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

// Composant du header du drawer
const DrawerHeader = ({ user, onClose }) => {
  const { colors: themeColors, isDark } = useTheme();
  
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryLight]}
      style={styles.drawerHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.drawerHeaderContent}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.drawerAvatar}>
          <Text style={styles.drawerAvatarText}>
            {user?.fullname?.charAt(0) || 'U'}
          </Text>
        </View>
        <Text style={styles.drawerName}>{user?.fullname || 'Utilisateur'}</Text>
        <View style={styles.drawerBadge}>
          <Text style={styles.drawerBadgeText}>
            {user?.role === 'THERAPIST' ? 'Thérapeute' : 
             user?.role === 'ADMIN' ? 'Administrateur' : 'Client'}
          </Text>
        </View>
        <Text style={styles.drawerEmail}>{user?.email || 'email@exemple.com'}</Text>
      </View>
    </LinearGradient>
  );
};

// Composant des items du drawer
const DrawerItem = ({ icon, label, onPress, badge, color }) => {
  const { colors: themeColors } = useTheme();
  
  return (
    <TouchableOpacity style={styles.drawerItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.drawerItemLeft}>
        <Ionicons name={icon} size={22} color={color || themeColors.text} />
        <Text style={[styles.drawerItemLabel, { color: themeColors.text }]}>
          {label}
        </Text>
      </View>
      {badge && (
        <View style={styles.drawerItemBadge}>
          <Text style={styles.drawerItemBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Composant principal du drawer
const DrawerContent = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { colors: themeColors, isDark, toggleTheme } = useTheme();
  
  const getMenuItems = () => {
    const commonItems = [
      { icon: 'home-outline', label: 'Accueil', onPress: () => navigation.navigate('Home') },
      { icon: 'calendar-outline', label: 'Calendrier', onPress: () => navigation.navigate('Calendar') },
      { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
      { icon: 'alert-circle-outline', label: 'SOS', onPress: () => navigation.navigate('SOS'), color: colors.error },
    ];

    if (user?.role === 'CLIENT') {
      return [
        ...commonItems,
        { icon: 'search-outline', label: 'Rechercher', onPress: () => navigation.navigate('Search') },
        { icon: 'time-outline', label: 'Historique', onPress: () => navigation.navigate('History') },
        { icon: 'chatbubbles-outline', label: 'Messages', onPress: () => navigation.navigate('Chats') },
        { icon: 'person-outline', label: 'Profil', onPress: () => navigation.navigate('Profile') },
      ];
    } else if (user?.role === 'THERAPIST') {
      return [
        ...commonItems,
        { icon: 'grid-outline', label: 'Tableau de bord', onPress: () => navigation.navigate('Dashboard') },
        { icon: 'chatbubbles-outline', label: 'Demandes', onPress: () => navigation.navigate('Requests') },
        { icon: 'wallet-outline', label: 'Gains', onPress: () => navigation.navigate('Earnings') },
        { icon: 'person-outline', label: 'Profil', onPress: () => navigation.navigate('Profile') },
      ];
    } else if (user?.role === 'ADMIN') {
      return [
        ...commonItems,
        { icon: 'grid-outline', label: 'Tableau de bord', onPress: () => navigation.navigate('Dashboard') },
        { icon: 'people-outline', label: 'Utilisateurs', onPress: () => navigation.navigate('Users') },
        { icon: 'settings-outline', label: 'Gestion', onPress: () => navigation.navigate('Management') },
        { icon: 'bar-chart-outline', label: 'Analyses', onPress: () => navigation.navigate('Analytics') },
        { icon: 'options-outline', label: 'Paramètres', onPress: () => navigation.navigate('Settings') },
      ];
    }
    return commonItems;
  };

  return (
    <View style={[styles.drawerContainer, { backgroundColor: themeColors.background }]}>
      <DrawerHeader 
        user={user} 
        onClose={() => navigation.closeDrawer()} 
      />
      
      <View style={styles.drawerBody}>
        {getMenuItems().map((item, index) => (
          <DrawerItem
            key={index}
            icon={item.icon}
            label={item.label}
            onPress={() => {
              navigation.closeDrawer();
              item.onPress();
            }}
            color={item.color}
          />
        ))}
        
        <View style={styles.drawerDivider} />
        
        {/* Thème */}
        <View style={styles.drawerThemeItem}>
          <View style={styles.drawerItemLeft}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={themeColors.text} />
            <Text style={[styles.drawerItemLabel, { color: themeColors.text }]}>
              Mode {isDark ? 'sombre' : 'clair'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#ccc', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        
        {/* Déconnexion */}
        <TouchableOpacity style={styles.drawerLogout} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.drawerLogoutText, { color: colors.error }]}>
            Se déconnecter
          </Text>
        </TouchableOpacity>
        
        <Text style={[styles.drawerVersion, { color: themeColors.textSecondary }]}>
          Mada Bien-être v1.0.0
        </Text>
      </View>
    </View>
  );
};

// Navigateur principal avec Drawer
const DrawerNavigator = () => {
  const { isAuthenticated, user } = useAuth();
  
  const getNavigator = () => {
    if (!isAuthenticated) {
      return AuthNavigator;
    }
    switch (user?.role) {
      case 'THERAPIST':
        return TherapistNavigator;
      case 'ADMIN':
        return AdminNavigator;
      default:
        return ClientNavigator;
    }
  };

  const MainNavigator = getNavigator();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 300,
          backgroundColor: 'transparent',
        },
        drawerType: 'slide',
        overlayColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <Drawer.Screen name="Main" component={MainNavigator} />
      <Drawer.Screen name="SOS" component={SOSScreen} />
      <Drawer.Screen name="Notifications" component={NotificationScreen} />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
  },
  drawerHeader: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  drawerHeaderContent: {
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  drawerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  drawerAvatarText: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: '#fff',
  },
  drawerName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: '#fff',
  },
  drawerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  drawerBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: typography.fontFamily.medium,
  },
  drawerEmail: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  drawerBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
  },
  drawerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  drawerItemLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  drawerItemBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  drawerItemBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: spacing.sm,
  },
  drawerThemeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  drawerLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  drawerLogoutText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  drawerVersion: {
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});

export default DrawerNavigator;