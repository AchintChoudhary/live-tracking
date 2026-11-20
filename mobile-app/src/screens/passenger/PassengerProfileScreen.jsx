import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { CustomButton } from '../../components/CustomButton';
import {
  UserIcon,
  HeartIcon,
  HistoryIcon,
  ChevronRightIcon,
  LogoutIcon,
  PinIcon,
} from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';

export const PassengerProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from your passenger account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title="Passenger Profile" subtitle="Account & Travel Preferences" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar & Info Card */}
        <View style={[styles.profileCard, SHADOWS.sm]}>
          <View style={styles.avatarBox}>
            <UserIcon size={36} color={COLORS.primary} />
          </View>
          <View style={styles.profileText}>
            <Text style={styles.userName}>{user?.name || 'Passenger User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'passenger1@transit.com'}</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>COMMUTER ACCOUNT</Text>
            </View>
          </View>
        </View>

        {/* Personal Details Box */}
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <View style={[styles.infoCard, SHADOWS.sm]}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoVal}>{user?.name || 'Alice Johnson'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoVal}>{user?.email || 'passenger1@transit.com'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoVal}>{user?.phone || '+1 (555) 234-5678'}</Text>
          </View>
        </View>

        {/* Travel Preferences & Actions */}
        <Text style={styles.sectionTitle}>Transit Shortcuts</Text>
        <TouchableOpacity
          style={[styles.menuItem, SHADOWS.sm]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Routes', { filter: 'favorites' })}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}>
            <HeartIcon size={20} color={COLORS.danger} filled />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuTitle}>Favorite Routes</Text>
            <Text style={styles.menuDesc}>2 saved express transit corridors</Text>
          </View>
          <ChevronRightIcon size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, SHADOWS.sm]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('RouteUpdates')}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#E8F1FD' }]}>
            <HistoryIcon size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuTitle}>Recent Travel History</Text>
            <Text style={styles.menuDesc}>Review tracked routes & arrival logs</Text>
          </View>
          <ChevronRightIcon size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* App Settings & Dispatch Link */}
        <TouchableOpacity
          style={[styles.menuItem, SHADOWS.sm]}
          activeOpacity={0.8}
          onPress={() =>
            Alert.alert(
              'App Version & Telemetry',
              'Transit Track Live v1.0.0 (Android Production Build)\nBackend: Node/Express + MongoDB\nTelemetry: Socket.IO Engine v4'
            )
          }
        >
          <View style={[styles.menuIcon, { backgroundColor: '#DCFCE7' }]}>
            <PinIcon size={20} color={COLORS.success} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuTitle}>App Version & Settings</Text>
            <Text style={styles.menuDesc}>v1.0.0 • Production Build</Text>
          </View>
          <ChevronRightIcon size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogoutIcon size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Sign Out from Account</Text>
        </TouchableOpacity>
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#E8F1FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    marginRight: 16,
  },
  profileText: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 10,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  menuDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
    marginTop: 18,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
});
