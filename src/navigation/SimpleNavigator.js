import React, {useState, createContext, useContext, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

const NavigationContext = createContext();

const formatTitle = (routeName) => `BusKá - ${routeName}`;

/**
 * No app nativo os botões navegam para nomes de ABAS (bottom tabs), que não
 * existem neste navegador simplificado usado na web. Sem esse mapa, navigate()
 * apontava para uma rota inexistente e o <Navigator> não renderizava nada,
 * resultando em tela branca silenciosa (sem erro no console).
 */
const ROUTE_ALIASES = {
  InicioTab: 'DashboardGestor',
  ViagensTab: 'ViagensList',
  RotasTab: 'RotaMotorista',
  EquipeTab: 'EquipeGestor',
  FrotaTab: 'FrotaGestor',
  PerfilTab: 'ConfigNotificacoesGestor',
};

export const resolveRoute = (routeName) => ROUTE_ALIASES[routeName] || routeName;

export const NavigationProvider = ({children, initialRoute = 'Login'}) => {
  // Os navegadores de papel aninham providers (App > MainNavigator > Gestor...).
  // Guardar a profundidade permite identificar o provider mais interno, que é o
  // dono das telas visíveis.
  const parentContext = useContext(NavigationContext);
  const depth = (parentContext?.depth ?? -1) + 1;
  const [currentRoute, setCurrentRoute] = useState(initialRoute);
  const [routeParams, setRouteParams] = useState({});
  const [history, setHistory] = useState([{route: initialRoute, params: {}}]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = formatTitle(currentRoute);
    }
  }, [currentRoute]);

  const navigate = (routeName, params = {}) => {
    const target = resolveRoute(routeName);
    setCurrentRoute(target);
    setRouteParams(params);
    setHistory((prev) => [...prev, {route: target, params}]);
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const previous = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setCurrentRoute(previous.route);
      setRouteParams(previous.params || {});
    }
  };

  /**
   * Ponte de automação (somente desenvolvimento): expõe navigate/goBack no
   * window para que o smoke test consiga visitar todas as telas de forma
   * determinística, sem depender de clicar em botões. Como os navegadores de
   * papel aninham um NavigationProvider dentro do outro, registramos uma pilha
   * em ordem de montagem — o último item é o provider mais interno, que é o
   * dono das telas do papel logado. Nunca é ativada em builds de produção.
   */
  const bridgeRef = React.useRef({});
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    if (typeof window === 'undefined') return undefined;
    const bridge = bridgeRef.current;
    window.__buskaNavs = window.__buskaNavs || [];
    window.__buskaNavs.push(bridge);
    return () => {
      window.__buskaNavs = window.__buskaNavs.filter((b) => b !== bridge);
    };
  }, []);
  useEffect(() => {
    Object.assign(bridgeRef.current, {navigate, goBack, currentRoute, initialRoute, depth});
  });

  const value = {
    currentRoute,
    routeParams,
    navigate,
    goBack,
    canGoBack: history.length > 1,
    depth,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

export const Navigator = ({children, initialRoute}) => {
  const {currentRoute, routeParams, goBack, canGoBack} = useNavigation();

  const available = [];
  const matched = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || !child.props?.name) {
      return;
    }
    available.push(child.props.name);
    if (child.props.name === currentRoute) {
      matched.push(React.cloneElement(child, {routeParams, key: child.props.name}));
    }
  });

  // Antes, uma rota não registrada renderizava null => tela totalmente branca,
  // sem exceção e sem log. Agora avisamos e mostramos uma tela de recuperação.
  if (matched.length === 0) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[SimpleNavigator] Rota "${currentRoute}" não registrada. ` +
          `Rotas disponíveis: ${available.join(', ')}`,
      );
    }
    return (
      <RouteNotFound
        routeName={currentRoute}
        available={available}
        onBack={canGoBack ? goBack : null}
      />
    );
  }

  return <>{matched}</>;
};

const RouteNotFound = ({routeName, available, onBack}) => (
  <View style={notFoundStyles.container}>
    <Text style={notFoundStyles.title}>Tela indisponível na versão web</Text>
    <Text style={notFoundStyles.subtitle}>
      A rota "{routeName}" não está registrada no navegador web.
    </Text>
    {onBack ? (
      <TouchableOpacity style={notFoundStyles.button} onPress={onBack}>
        <Text style={notFoundStyles.buttonText}>Voltar</Text>
      </TouchableOpacity>
    ) : null}
    <Text style={notFoundStyles.hint}>
      Disponíveis: {available.join(', ')}
    </Text>
  </View>
);

const notFoundStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f6f8',
  },
  title: {fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 8},
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {color: '#fff', fontWeight: '600'},
  hint: {marginTop: 16, fontSize: 11, color: '#9ca3af', textAlign: 'center'},
});

export const Screen = ({name, component: Component, routeParams: screenParams}) => {
  const {navigate, goBack, canGoBack, routeParams} = useNavigation();
  
  // Usa os params do screen se disponíveis, senão usa os do contexto
  const params = screenParams !== undefined ? screenParams : routeParams;
  
  // Cria objeto navigation compatível com React Navigation
  const navigation = {
    navigate: (routeName, navParams) => navigate(routeName, navParams || {}),
    goBack: () => goBack(),
    canGoBack: () => canGoBack,
    // Métodos adicionais que podem ser usados
    reset: (state) => {
      // Implementação básica de reset
      if (state?.routes && state.routes.length > 0) {
        navigate(state.routes[state.index || 0].name);
      }
    },
  };

  // Cria objeto route compatível com React Navigation
  const route = {
    params: params || {},
    name: name,
  };

  return <Component navigation={navigation} route={route} />;
};

