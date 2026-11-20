import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { CustomButton } from '../../components/CustomButton';
import { CheckCircleIcon, BusIcon, RouteIcon, ClockIcon, NavigationIcon } from '../../components/Icons';

export const EndTripScreen = ({ route, navigation }) => {
  const { tripDetails } = route.params || {};

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Success Icon & Heading */}
        <View style={styles.successSection}>
          <View style={styles.iconCircle}>
            <CheckCircleIcon size={56} color={COLORS.success} />
          </View>
          <Text style={styles.title}>Trip Completed!</Text>
          <Text style={styles.subtitle}>
            Your trip has ended. The recorded trip details are shown below.
          </Text>
        </View>

        {/* Trip Summary Card */}
        <View style={[styles.card, SHADOWS.md]}>
          <Text style={styles.cardHeader}>Official Trip Log</Text>

          <View style={styles.logItem}>
            <View style={styles.logIcon}>
              <RouteIcon size={20} color={COLORS.primary} />
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logLabel}>Route Name & Number</Text>
              <Text style={styles.logValue}>
                {[tripDetails?.routeNumber, tripDetails?.routeName].filter(Boolean).join(' - ') || 'Not recorded'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.logItem}>
            <View style={styles.logIcon}>
              <BusIcon size={20} color={COLORS.primary} />
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logLabel}>Assigned Transit Vehicle</Text>
              <Text style={styles.logValue}>{tripDetails?.vehicleNumber || 'Not recorded'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.logItem}>
            <View style={styles.logIcon}>
              <ClockIcon size={20} color={COLORS.primary} />
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logLabel}>Trip Duration</Text>
              <Text style={styles.logValue}>{tripDetails?.duration || 'Not recorded'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.logItem}>
            <View style={styles.logIcon}>
              <NavigationIcon size={20} color={COLORS.primary} />
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logLabel}>Distance Travelled</Text>
              <Text style={styles.logValue}>{tripDetails?.distance || 'Not recorded'}</Text>
            </View>
          </View>
        </View>

        {/* CTA: Back to Dashboard */}
        <CustomButton
          title="Back to Dashboard"
          variant="primary"
          size="lg"
          onPress={() => navigation.navigate('DriverDashboard')}
          style={styles.backBtn}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 50,
    alignItems: 'center',
  },
  successSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 300,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 24,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F1FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  logContent: {
    flex: 1,
  },
  logLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  logValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  backBtn: {
    width: '100%',
  },
});
