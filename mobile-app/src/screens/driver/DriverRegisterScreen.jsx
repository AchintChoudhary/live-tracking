import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CustomButton } from '../../components/CustomButton';
import { CustomInput } from '../../components/CustomInput';
import { LockIcon, UserIcon } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOWS } from '../../utils/theme';

export const DriverRegisterScreen = ({ navigation }) => {
  const { registerDriver } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const nextErrors = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!/^\+?[0-9][0-9\s().-]{5,19}$/.test(phone.trim())) {
      nextErrors.phone = 'Enter a valid phone number';
    }
    if (
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      nextErrors.password = 'Use 8+ characters with uppercase, lowercase, a number, and a symbol';
    }
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    const result = await registerDriver({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
    });
    setLoading(false);
    if (!result.success) {
      Alert.alert('Driver Registration Failed', result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Create Driver Account</Text>
        <Text style={styles.subtitle}>Register with your own driver details to add your bus and route.</Text>

        <View style={[styles.card, SHADOWS.md]}>
          <CustomInput
            label="Full Name"
            placeholder="Your full name"
            value={name}
            onChangeText={(value) => setName(value)}
            icon={<UserIcon size={20} color={COLORS.textSecondary} />}
            error={errors.name}
          />
          <CustomInput
            label="Email"
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <CustomInput
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            error={errors.phone}
          />
          <CustomInput
            label="Password"
            placeholder="8+ characters, including a symbol"
            value={password}
            onChangeText={setPassword}
            icon={<LockIcon size={20} color={COLORS.textSecondary} />}
            secureTextEntry
            error={errors.password}
          />
          <CustomInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            icon={<LockIcon size={20} color={COLORS.textSecondary} />}
            secureTextEntry
            error={errors.confirmPassword}
          />
          <CustomButton
            title="Create Driver Account"
            onPress={handleRegister}
            loading={loading}
          />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('DriverLogin')} style={styles.link}>
          <Text style={styles.linkText}>Already registered? <Text style={styles.linkStrong}>Sign in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingTop: 44, paddingBottom: 36, alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900' },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  link: { marginTop: 22, padding: 8 },
  linkText: { color: COLORS.textSecondary, fontSize: 14 },
  linkStrong: { color: COLORS.primary, fontWeight: '800' },
});
