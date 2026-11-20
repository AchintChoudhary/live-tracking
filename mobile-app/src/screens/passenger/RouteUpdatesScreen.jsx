import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { LiveBadge } from '../../components/LiveBadge';
import {
  ClockIcon,
  CheckCircleIcon,
  PinIcon,
  BusIcon,
  RadioTowerIcon,
} from '../../components/Icons';
import { socketService } from '../../services/socket';
import { routeApi } from '../../services/api';
import { calculateDistanceKm, calculateETA } from '../../utils/distance';

export const RouteUpdatesScreen = ({ route: navRoute, navigation }) => {
  const { route: initialRoute, selectedStop: initialSelectedStop, liveLocation: initialLocation } = navRoute.params || {};

  const [activeRoute, setActiveRoute] = useState(initialRoute || null);
  const [selectedStop, setSelectedStop] = useState(initialSelectedStop || null);
  const [currentLocation, setCurrentLocation] = useState(initialLocation || null);
  const [liveStatus, setLiveStatus] = useState('On Route • Regular Transit Service');
  const [activeStopIndex, setActiveStopIndex] = useState(0);

  // If opened directly from tabs without params, fetch first route
  useEffect(() => {
    if (!activeRoute) {
      routeApi.getAllRoutes()
        .then((res) => {
          if (res.data?.data && res.data.data.length > 0) {
            setActiveRoute(res.data.data[0]);
            if (res.data.data[0].stops && res.data.data[0].stops.length > 0) {
              setSelectedStop(res.data.data[0].stops[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [activeRoute]);

  // Connect to Socket.IO and listen for real-time location and status telemetry
  useEffect(() => {
    socketService.connect();

    const unsubStatus = socketService.onTripStatus((data) => {
      const statusText = data?.liveStatus || data?.status;
      if (statusText) {
        setLiveStatus(statusText);
      }
    });

    const unsubLoc = socketService.onVehicleLocation((data) => {
      if (data && data.latitude && data.longitude) {
        setCurrentLocation(data);
      }
    });

    return () => {
      if (unsubStatus) unsubStatus();
      if (unsubLoc) unsubLoc();
    };
  }, []);

  // Compute active stop index dynamically based on incoming GPS coordinates
  const stopsList = activeRoute?.stops && activeRoute.stops.length > 0 ? activeRoute.stops : null;

  useEffect(() => {
    if (stopsList && currentLocation) {
      let closestIdx = 0;
      let minDistance = Infinity;

      stopsList.forEach((stop, idx) => {
        const d = calculateDistanceKm(
          currentLocation.latitude,
          currentLocation.longitude,
          stop.latitude,
          stop.longitude
        );
        if (d < minDistance) {
          minDistance = d;
          closestIdx = idx;
        }
      });

      // If within 100 meters, bus is at this stop; otherwise if ahead, advance index
      setActiveStopIndex(closestIdx);
    }
  }, [currentLocation, stopsList]);

  // Dynamic timeline generator
  const timelineEvents = stopsList
    ? stopsList.map((stop, idx) => {
        const isPassed = idx < activeStopIndex;
        const isCurrent = idx === activeStopIndex;

        let statusText = 'Upcoming Stop';
        let statusType = 'muted';

        // Calculate dynamic ETA to this stop
        let dynamicEta = `${Math.max(2, (idx - activeStopIndex) * 6)} mins`;
        if (currentLocation) {
          const distToStop = calculateDistanceKm(
            currentLocation.latitude,
            currentLocation.longitude,
            stop.latitude,
            stop.longitude
          );
          if (isCurrent) {
            const etaMins = calculateETA(distToStop, currentLocation.speed || 25);
            dynamicEta = distToStop < 0.1 ? 'Arriving Now' : `${etaMins} mins`;
          } else if (idx > activeStopIndex) {
            const cumulativeDist = distToStop + (idx - activeStopIndex) * 1.5;
            dynamicEta = `${calculateETA(cumulativeDist, currentLocation.speed || 25)} mins`;
          }
        }

        if (isPassed) {
          statusText = 'At Stop (Completed)';
          statusType = 'success';
        } else if (isCurrent) {
          statusText = liveStatus || 'On Route • Next Stop';
          statusType = 'primary';
        } else if (idx === stopsList.length - 1) {
          statusText = 'Terminus Arrival';
          statusType = 'muted';
        }

        return {
          id: `stop-timeline-${idx}`,
          title: `Stop #${idx + 1}: ${stop.name}`,
          subtitle:
            idx === 0
              ? 'Route Departure Station'
              : idx === stopsList.length - 1
              ? 'Final Terminus'
              : 'Designated Commuter Stop',
          time: `+${idx * 6}m`,
          status: statusText,
          statusType,
          completed: isPassed,
          active: isCurrent,
          eta: isPassed ? 'Departed' : dynamicEta,
        };
      })
    : [
        {
          id: '1',
          title: 'Trip Initiated & Departed Depot',
          subtitle: 'Central Transit Terminal',
          time: '08:00 AM',
          status: 'Departed On Schedule',
          statusType: 'success',
          completed: true,
          eta: 'Departed',
        },
        {
          id: '2',
          title: 'Stop #1: Market Street Station',
          subtitle: 'Boarding & Alighting completed',
          time: '08:14 AM',
          status: 'At Stop (Completed)',
          statusType: 'success',
          completed: true,
          eta: 'Departed',
        },
        {
          id: '3',
          title: 'En Route to Civic Center Plaza',
          subtitle: 'Approaching designated stop',
          time: '08:26 AM',
          status: liveStatus || 'On Route • Next Stop',
          statusType: 'primary',
          active: true,
          eta: '3 mins',
        },
        {
          id: '4',
          title: 'Stop #3: Financial District Crossing',
          subtitle: 'Transit corridor stop',
          time: '08:38 AM',
          status: 'Scheduled Approach',
          statusType: 'warning',
          eta: '12 mins',
        },
        {
          id: '5',
          title: 'Stop #4: Union Square Terminal',
          subtitle: 'Transfer to Metro Blue Line',
          time: '08:52 AM',
          status: 'Estimated Arrival Time',
          statusType: 'muted',
          eta: '22 mins',
        },
        {
          id: '6',
          title: 'Final Destination: Harbor View Transit Center',
          subtitle: 'Trip Concludes',
          time: '09:05 AM',
          status: 'Terminus Arrival',
          statusType: 'muted',
          eta: '35 mins',
        },
      ];

  return (
    <View style={styles.container}>
      <Header
        title="Route Updates & Timeline"
        subtitle={activeRoute?.routeName || 'North-South Metro Corridor'}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={<LiveBadge label="MONITORING" size="sm" />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Route Status Summary Card */}
        <View style={[styles.statusSummaryCard, SHADOWS.sm]}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={styles.routeCodeTag}>{activeRoute?.routeNumber || 'R-101'}</Text>
              <Text style={styles.routeHeaderTitle}>{activeRoute?.routeName || 'North-South Metro Express'}</Text>
            </View>
            <View style={styles.livePulseBox}>
              <View style={styles.livePulseDot} />
              <Text style={styles.livePulseText}>REAL-TIME</Text>
            </View>
          </View>

          <View style={styles.progressStats}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Current Telemetry Status</Text>
              <Text style={styles.statBold} numberOfLines={1}>{liveStatus}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Next Bus Arrival</Text>
              <Text style={[styles.statBold, { color: COLORS.success }]}>~4 mins</Text>
            </View>
          </View>
        </View>

        {/* Section Heading */}
        <Text style={styles.timelineHeading}>Live Vertical Trip Progression</Text>

        {/* Vertical Timeline */}
        <View style={styles.timelineContainer}>
          {timelineEvents.map((event, index) => {
            const isLast = index === timelineEvents.length - 1;
            return (
              <View key={event.id} style={styles.timelineRow}>
                {/* Left Indicator & Connecting Line */}
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineNode,
                      event.completed && styles.nodeCompleted,
                      event.active && styles.nodeActive,
                      event.statusType === 'warning' && styles.nodeWarning,
                    ]}
                  >
                    {event.completed ? (
                      <CheckCircleIcon size={14} color="#FFFFFF" />
                    ) : event.active ? (
                      <BusIcon size={14} color="#FFFFFF" />
                    ) : (
                      <View style={styles.nodeInnerDot} />
                    )}
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineLine,
                        event.completed && styles.lineCompleted,
                      ]}
                    />
                  )}
                </View>

                {/* Right Event Card */}
                <View style={[styles.eventCard, event.active && styles.eventCardActive, SHADOWS.sm]}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTime}>{event.time}</Text>
                    <View
                      style={[
                        styles.eventBadge,
                        event.statusType === 'success' && styles.badgeSuccess,
                        event.statusType === 'primary' && styles.badgePrimary,
                        event.statusType === 'warning' && styles.badgeWarning,
                        event.statusType === 'muted' && styles.badgeMuted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.eventBadgeText,
                          event.statusType === 'success' && styles.badgeTextSuccess,
                          event.statusType === 'primary' && styles.badgeTextPrimary,
                          event.statusType === 'warning' && styles.badgeTextWarning,
                          event.statusType === 'muted' && styles.badgeTextMuted,
                        ]}
                      >
                        {event.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventSubtitle}>{event.subtitle}</Text>

                  {event.eta && (
                    <View style={styles.etaRow}>
                      <ClockIcon size={14} color={COLORS.textSecondary} />
                      <Text style={styles.etaText}>Countdown: {event.eta}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
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
    padding: 20,
    paddingBottom: 40,
  },
  statusSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 22,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  routeCodeTag: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  routeHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  livePulseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  livePulseText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  progressStats: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statBold: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  timelineHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
    marginRight: 12,
  },
  timelineNode: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeCompleted: {
    backgroundColor: COLORS.success,
  },
  nodeActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: '#BFDBFE',
  },
  nodeWarning: {
    backgroundColor: COLORS.warning,
  },
  nodeInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  lineCompleted: {
    backgroundColor: COLORS.success,
  },
  eventCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  eventCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8FAFF',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  eventBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeSuccess: { backgroundColor: '#DCFCE7' },
  badgePrimary: { backgroundColor: '#E8F1FD' },
  badgeWarning: { backgroundColor: '#FEF3C7' },
  badgeMuted: { backgroundColor: '#F1F5F9' },
  eventBadgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextSuccess: { color: '#15803D' },
  badgeTextPrimary: { color: COLORS.primary },
  badgeTextWarning: { color: '#B45309' },
  badgeTextMuted: { color: COLORS.textSecondary },
  eventTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  eventSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
});
