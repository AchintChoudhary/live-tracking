import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { CustomButton } from '../../components/CustomButton';
import { BusIcon, NavigationIcon } from '../../components/Icons';

export const PassengerWelcomeScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      {/* Decorative top shape */}
      <View style={styles.topShape} />

      <View style={styles.content}>
        {/* Brand Icon */}
        <View style={[styles.logoCard, SHADOWS.lg]}>
          <BusIcon size={52} color={COLORS.primary} />
        </View>

        {/* Title & Tagline */}
        <Text style={styles.appTitle}>TRANSIT TRACK LIVE</Text>
        <Text style={styles.tagline}>
          Next-generation real-time public transit tracking on your mobile device
        </Text>

        {/* Feature Highlights */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Live GPS bus positions updated every second</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Accurate arrival times & delay notifications</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Interactive Google Maps with designated stops</Text>
          </View>
        </View>

        {/* Auth Buttons */}
        <View style={styles.actionsBox}>
          <CustomButton
            title="Passenger Login"
            variant="primary"
            size="lg"
            onPress={() => navigation.navigate('PassengerLogin')}
            style={styles.actionBtn}
          />

          <CustomButton
            title="Create New Account"
            variant="outline"
            size="lg"
            onPress={() => navigation.navigate('PassengerRegister')}
            style={[styles.actionBtn, { marginTop: 12 }]}
          />
        </View>

        {/* Switch to Driver App */}
        <TouchableOpacity
          style={styles.driverSwitch}
          onPress={() => navigation.navigate('DriverLogin')}
        >
          <Text style={styles.driverSwitchText}>
            Are you a transit driver? <Text style={styles.driverSwitchLink}>Driver Portal</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topShape: {
    position: 'absolute',
    top: -120,
    left: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#E8F1FD',
    opacity: 0.7,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCard: {
    width: 104,
    height: 104,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 290,
  },
  featuresList: {
    marginTop: 32,
    marginBottom: 36,
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  actionsBox: {
    width: '100%',
  },
  actionBtn: {
    width: '100%',
  },
  driverSwitch: {
    marginTop: 26,
    paddingVertical: 8,
  },
  driverSwitchText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  driverSwitchLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
