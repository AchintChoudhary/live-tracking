import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../utils/theme';

export const CustomButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return '#CBD5E1';
    switch (variant) {
      case 'primary':
        return COLORS.primary;
      case 'dark':
        return COLORS.primaryDark;
      case 'success':
        return COLORS.success;
      case 'danger':
        return COLORS.danger;
      case 'outline':
        return 'transparent';
      case 'ghost':
        return 'transparent';
      default:
        return COLORS.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#94A3B8';
    if (variant === 'outline') return COLORS.primary;
    if (variant === 'ghost') return COLORS.textSecondary;
    return COLORS.white;
  };

  const getBorderColor = () => {
    if (variant === 'outline') return COLORS.primary;
    return 'transparent';
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        size === 'sm' && styles.sizeSm,
        size === 'lg' && styles.sizeLg,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1.5 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconMargin}>{icon}</View>}
          <Text
            style={[
              styles.text,
              size === 'sm' && styles.textSm,
              size === 'lg' && styles.textLg,
              { color: getTextColor() },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    elevation: 2,
    shadowColor: '#0866E8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  sizeSm: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  sizeLg: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 24,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMargin: {
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 14,
    fontWeight: '600',
  },
  textLg: {
    fontSize: 18,
    fontWeight: '700',
  },
});
