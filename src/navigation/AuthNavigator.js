import React from 'react';
import {Platform} from 'react-native';
import Login from '../screens/Auth/Login';
import CriarConta from '../screens/Auth/CriarConta';
import RecuperarSenha from '../screens/Auth/RecuperarSenha';
import RedefinirSenha from '../screens/Auth/RedefinirSenha';
import ConsentimentoResponsavel from '../screens/Auth/ConsentimentoResponsavel';
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
    // Se não conseguir carregar, usa navegação simples
    console.log('React Navigation não disponível, usando navegação simples');
  }
}

// The web build has no URL routing; the reset e-mail link is the only path that opens a screen other than Login.
const getWebInitialRoute = () => {
  if (window.location.pathname === '/redefinir-senha') {
    return 'RedefinirSenha';
  }
  return 'Login';
};

const AuthNavigator = () => {
  // Se estiver na web ou React Navigation não estiver disponível, usa navegação simples
  if (isWeb || !createNativeStackNavigator) {
    return (
      <NavigationProvider initialRoute={isWeb ? getWebInitialRoute() : 'Login'}>
        <Navigator>
          <Screen name="Login" component={Login} />
          <Screen name="CriarConta" component={CriarConta} />
          <Screen name="RecuperarSenha" component={RecuperarSenha} />
          <Screen name="RedefinirSenha" component={RedefinirSenha} />
          <Screen name="ConsentimentoResponsavel" component={ConsentimentoResponsavel} />
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
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="CriarConta" component={CriarConta} />
      <Stack.Screen name="RecuperarSenha" component={RecuperarSenha} />
      <Stack.Screen name="RedefinirSenha" component={RedefinirSenha} />
      <Stack.Screen name="ConsentimentoResponsavel" component={ConsentimentoResponsavel} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;

