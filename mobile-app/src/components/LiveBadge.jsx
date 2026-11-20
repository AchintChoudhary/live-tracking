import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../utils/theme';

export const LiveBadge = ({ label = 'LIVE', size = 'md' }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.badge, size === 'sm' && styles.badgeSm]}>
      <Animated.View
        style={[
          styles.dot,
          size === 'sm' && styles.dotSm,
          { opacity: pulseAnim },
        ]}
      />
      <Text style={[styles.text, size === 'sm' && styles.textSm]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  badgeSm: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  dotSm: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.8,
  },
  textSm: {
    fontSize: 10,
    fontWeight: '700',
  },
});
