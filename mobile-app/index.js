import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// and ensures proper environment configuration across Expo Go and bare native builds.
registerRootComponent(App);

// Also register the native component name for React Native Android MainActivity
AppRegistry.registerComponent('publictransporttracking', () => App);

