import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { COLORS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { BusIcon, RouteIcon, UserIcon, RadioTowerIcon, HistoryIcon } from '../components/Icons';

// Driver Screens
import { DriverLoginScreen } from '../screens/driver/DriverLoginScreen';
import { DriverDashboard } from '../screens/driver/DriverDashboard';
import { StartTripScreen } from '../screens/driver/StartTripScreen';
import { TripTrackingScreen } from '../screens/driver/TripTrackingScreen';
import { EndTripScreen } from '../screens/driver/EndTripScreen';
import { DriverHistoryScreen } from '../screens/driver/DriverHistoryScreen';

// Passenger Screens
import { PassengerWelcomeScreen } from '../screens/passenger/PassengerWelcomeScreen';
import { PassengerLoginScreen } from '../screens/passenger/PassengerLoginScreen';
import { PassengerRegisterScreen } from '../screens/passenger/PassengerRegisterScreen';
import { PassengerDashboard } from '../screens/passenger/PassengerDashboard';
import { RoutesScreen } from '../screens/passenger/RoutesScreen';
import { LiveTrackingScreen } from '../screens/passenger/LiveTrackingScreen';
import { RouteUpdatesScreen } from '../screens/passenger/RouteUpdatesScreen';
import { PassengerProfileScreen } from '../screens/passenger/PassengerProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigation for Passenger
function PassengerBottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={PassengerDashboard}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <BusIcon size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="MapTab"
        component={LiveTrackingScreen}
        options={{
          tabBarLabel: 'Map Radar',
          tabBarIcon: ({ color, size }) => <RadioTowerIcon size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="UpdatesTab"
        component={RouteUpdatesScreen}
        options={{
          tabBarLabel: 'Updates',
          tabBarIcon: ({ color, size }) => <HistoryIcon size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={PassengerProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <UserIcon size={size || 22} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Passenger Stack Navigator
function PassengerStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} />
      <Stack.Screen name="Routes" component={RoutesScreen} />
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
      <Stack.Screen name="RouteUpdates" component={RouteUpdatesScreen} />
      <Stack.Screen name="PassengerProfile" component={PassengerProfileScreen} />
    </Stack.Navigator>
  );
}

// Driver Stack Navigator
function DriverStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="DriverDashboard" component={DriverDashboard} />
      <Stack.Screen name="StartTrip" component={StartTripScreen} />
      <Stack.Screen name="TripTracking" component={TripTrackingScreen} />
      <Stack.Screen name="EndTrip" component={EndTripScreen} />
      <Stack.Screen name="DriverHistory" component={DriverHistoryScreen} />
    </Stack.Navigator>
  );
}

// Unauthenticated Auth Navigator
function AuthStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PassengerWelcome"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="PassengerWelcome" component={PassengerWelcomeScreen} />
      <Stack.Screen name="PassengerLogin" component={PassengerLoginScreen} />
      <Stack.Screen name="PassengerRegister" component={PassengerRegisterScreen} />
      <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
    </Stack.Navigator>
  );
}

export const AppNavigator = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStackNavigator />
      ) : role === 'driver' ? (
        <DriverStackNavigator />
      ) : (
        <PassengerStackNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
