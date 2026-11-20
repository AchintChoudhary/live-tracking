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

export const PassengerLoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = 'Email address is required';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await login(email.trim(), password, 'passenger');
      if (!res.success) {
        Alert.alert('Login Failed', res.message || 'Invalid passenger credentials');
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
        <View style={styles.logoCircle}>
          <BusIcon size={38} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Passenger Sign In</Text>
        <Text style={styles.subtitle}>Track live city buses, routes & timetables in real-time</Text>

        <View style={[styles.card, SHADOWS.md]}>
          <CustomInput
            label="Email Address"
            placeholder="name@example.com"
            value={email}
            onChangeText={(txt) => {
              setEmail(txt);
              if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
            }}
            icon={<UserIcon size={20} color={COLORS.textSecondary} />}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <CustomInput
            label="Password"
            placeholder="Enter password"
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
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.submitBtn}
          />

        </View>

        <TouchableOpacity
          style={styles.registerLinkBox}
          onPress={() => navigation.navigate('PassengerRegister')}
        >
          <Text style={styles.registerPrompt}>{"Don't have an account? "}<Text style={styles.registerLink}>Sign Up</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.driverLinkBox}
          onPress={() => navigation.navigate('DriverLogin')}
        >
          <Text style={styles.driverPrompt}>Are you a driver? <Text style={styles.driverLink}>Driver Sign In</Text></Text>
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
    paddingTop: 50,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#E8F1FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 26,
    maxWidth: 290,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  submitBtn: {
    marginTop: 8,
  },
  registerLinkBox: {
    marginTop: 24,
    paddingVertical: 6,
  },
  registerPrompt: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  registerLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  driverLinkBox: {
    marginTop: 12,
    paddingVertical: 6,
  },
  driverPrompt: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  driverLink: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
});
