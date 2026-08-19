// src/components/common/Header.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// ✅ Import tsara avy amin'ny @react-navigation/native
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const Header = ({
  title,
  showBack = false,
  showMenu = false,
  rightComponent,
  leftComponent,
  onBackPress,
  onMenuPress,
  transparent = false,
}) => {
  const navigation = useNavigation();
  const { colors: themeColors, isDark } = useTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const handleMenu = () => {
    if (onMenuPress) {
      onMenuPress();
    } else {
      navigation.openDrawer();
    }
  };

  const headerStyle = {
    backgroundColor: transparent ? 'transparent' : themeColors.surface,
    borderBottomColor: transparent ? 'transparent' : themeColors.border || '#E0E0E0',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: transparent ? 'transparent' : themeColors.surface }]}>
      <View style={[styles.header, headerStyle]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={transparent ? 'transparent' : themeColors.surface}
          translucent={transparent}
        />
        
        <View style={styles.headerContent}>
          {/* Left */}
          <View style={styles.leftContainer}>
            {showBack && (
              <TouchableOpacity onPress={handleBack} style={styles.iconButton} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={themeColors.text} />
              </TouchableOpacity>
            )}
            {showMenu && (
              <TouchableOpacity onPress={handleMenu} style={styles.iconButton} activeOpacity={0.7}>
                <Ionicons name="menu" size={24} color={themeColors.text} />
              </TouchableOpacity>
            )}
            {leftComponent}
          </View>

          {/* Center */}
          <View style={styles.centerContainer}>
            {typeof title === 'string' ? (
              <Text 
                style={[
                  styles.title, 
                  { color: themeColors.text },
                  transparent && { color: '#fff' }
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : (
              title
            )}
          </View>

          {/* Right */}
          <View style={styles.rightContainer}>
            {rightComponent}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  iconButton: {
    padding: 4,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    textAlign: 'center',
  },
});

export default Header;