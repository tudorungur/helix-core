// Must be the very first import — amazon-cognito-identity-js needs crypto.getRandomValues,
// which isn't available in the React Native runtime without this polyfill.
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
