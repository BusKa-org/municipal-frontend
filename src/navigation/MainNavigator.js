import React, { useEffect, useState } from 'react';
import {Platform, View, ActivityIndicator, StyleSheet} from 'react-native';
import AlunoNavigator from './AlunoNavigator';
import MotoristaNavigator from './MotoristaNavigator';
import GestorNavigator from './GestorNavigator';
import AuthNavigator from './AuthNavigator';
import { useAuth } from '../contexts/AuthContext';
import {
  NavigationProvider,
  Navigator,
  Screen,
} from './SimpleNavigator';

// Detecta se está na web
const isWeb = Platform.OS === 'web';

// Para mobile, tenta usar React Navigation
let NativeStackNavigator = null;
let createNativeStackNavigator = null;

if (!isWeb) {
  try {
    const ReactNavigation = require('@react-navigation/native-stack');
    createNativeStackNavigator = ReactNavigation.createNativeStackNavigator;
  } catch (e) {
    // React Navigation not available, using simple navigation
  }
}

// Get the correct navigator based on user role
const getInitialRoute = (role) => {
  const normalizedRole = role?.toUpperCase?.() || '';
  switch (normalizedRole) {
    case 'ALUNO':
      return 'AlunoNavigator';
    case 'MOTORISTA':
      return 'MotoristaNavigator';
    case 'GESTOR':
      return 'GestorNavigator';
    default:
      return 'SelecaoFluxo';
  }
};

const MainNavigator = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const [webPath, setWebPath] = useState(isWeb ? window.location.pathname : '');

  // RedefinirSenha fires popstate when it clears the reset link from the URL.
  useEffect(() => {
    if (!isWeb) {
      return undefined;
    }
    const onPathChange = () => setWebPath(window.location.pathname);
    window.addEventListener('popstate', onPathChange);
    return () => window.removeEventListener('popstate', onPathChange);
  }, []);

  // Show loading screen while checking auth status
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  // Auth screens when logged out, and also for the reset e-mail link even when logged in
  if (!isAuthenticated || webPath === '/redefinir-senha') {
    return <AuthNavigator />;
  }

  const initialRoute = getInitialRoute(user?.role);

  // If authenticated, show role-based navigator
  if (isWeb || !createNativeStackNavigator) {
    return (
      <NavigationProvider initialRoute={initialRoute}>
        <Navigator>
          <Screen name="AlunoNavigator" component={AlunoNavigator} />
          <Screen name="MotoristaNavigator" component={MotoristaNavigator} />
          <Screen name="GestorNavigator" component={GestorNavigator} />
        </Navigator>
      </NavigationProvider>
    );
  }

  // Para mobile, usa React Navigation
  if (!NativeStackNavigator && createNativeStackNavigator) {
    NativeStackNavigator = createNativeStackNavigator();
  }

  const Stack = NativeStackNavigator;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="AlunoNavigator" component={AlunoNavigator} />
      <Stack.Screen name="MotoristaNavigator" component={MotoristaNavigator} />
      <Stack.Screen name="GestorNavigator" component={GestorNavigator} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default MainNavigator;


