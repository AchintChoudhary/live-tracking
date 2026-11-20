import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { CustomInput } from '../../components/CustomInput';
import { CustomButton } from '../../components/CustomButton';
import { BusIcon, UserIcon, LockIcon } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';

export const DriverLoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [driverId, setDriverId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!driverId.trim()) errs.driverId = 'Driver ID or email is required';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await login(driverId.trim(), password, 'driver');
      if (!res.success) {
        Alert.alert('Login Failed', res.message || 'Invalid driver credentials');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Branding */}
        <View style={styles.brandingBox}>
          <View style={styles.logoCircle}>
            <BusIcon size={42} color={COLORS.primary} />
          </View>
          <Text style={styles.appTitle}>TRANSIT TRACK LIVE</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>DRIVER PORTAL</Text>
          </View>
          <Text style={styles.subHeading}>Sign in to manage your active trips & live route telemetry</Text>
        </View>

        {/* Card Form */}
        <View style={[styles.card, SHADOWS.md]}>
          <Text style={styles.formTitle}>Driver Login</Text>
          <Text style={styles.formSubtitle}>Enter your official driver credentials below</Text>

          <CustomInput
            label="Driver ID / Official Email"
            placeholder="name@example.com"
            value={driverId}
            onChangeText={(txt) => {
              setDriverId(txt);
              if (errors.driverId) setErrors((prev) => ({ ...prev, driverId: null }));
            }}
            icon={<UserIcon size={20} color={COLORS.textSecondary} />}
            error={errors.driverId}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <CustomInput
            label="Password"
            placeholder="Enter secure password"
            value={password}
            onChangeText={(txt) => {
              setPassword(txt);
              if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
            }}
            icon={<LockIcon size={20} color={COLORS.textSecondary} />}
            error={errors.password}
            secureTextEntry
          />

          <CustomButton
            title="Driver Login"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('DriverRegister')}
          >
            <Text style={styles.registerText}>New driver? <Text style={styles.registerTextStrong}>Create an account</Text></Text>
          </TouchableOpacity>
        </View>

        {/* Switch to Passenger Application */}
        <TouchableOpacity
          style={styles.switchRoleBtn}
          onPress={() => navigation.navigate('PassengerWelcome')}
        >
          <Text style={styles.switchRoleText}>Are you a passenger? <Text style={styles.switchRoleLink}>Switch to Passenger App</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: 'center',
  },
  brandingBox: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#E8F1FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  roleBadge: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subHeading: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  formTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  formSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 20,
  },
  loginBtn: {
    width: '100%',
  },
  registerLink: {
    marginTop: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  registerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  registerTextStrong: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  switchRoleBtn: {
    marginTop: 24,
    paddingVertical: 10,
  },
  switchRoleText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  switchRoleLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
