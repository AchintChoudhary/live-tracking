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
import { UserIcon, LockIcon } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';

export const PassengerRegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!email.trim()) errs.email = 'Valid email is required';
    if (!password || password.length < 6) errs.password = 'Password must be at least 6 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: 'passenger',
      });
      if (res.success) {
        Alert.alert('Account Created', 'Welcome to Transit Track Live!');
      } else {
        Alert.alert('Registration Failed', res.message || 'Unable to register');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Server connection error');
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
        <Text style={styles.title}>Create Passenger Account</Text>
        <Text style={styles.subtitle}>Sign up to save favorite routes and track real-time buses</Text>

        <View style={[styles.card, SHADOWS.md]}>
          <CustomInput
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={(txt) => {
              setName(txt);
              if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
            }}
            icon={<UserIcon size={20} color={COLORS.textSecondary} />}
            error={errors.name}
          />

          <CustomInput
            label="Email Address"
            placeholder="johndoe@example.com"
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
            label="Phone Number (Optional)"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <CustomInput
            label="Password"
            placeholder="At least 6 characters"
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
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>

        <TouchableOpacity
          style={styles.loginLinkBox}
          onPress={() => navigation.navigate('PassengerLogin')}
        >
          <Text style={styles.loginPrompt}>Already have an account? <Text style={styles.loginLink}>Sign In</Text></Text>
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
    paddingBottom: 40,
    alignItems: 'center',
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
    marginBottom: 24,
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
  loginLinkBox: {
    marginTop: 24,
    paddingVertical: 6,
  },
  loginPrompt: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  loginLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
