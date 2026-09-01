// src/components/mapa/hooks/useLocationPermission.ts
import { PermissionsAndroid, Platform } from 'react-native';

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  // No Android 12 em diante o diálogo oferece "Precisa" e "Aproximada". Quem
  // escolhe aproximada concede apenas COARSE, e pedir só FINE daria negado.
  const resultado = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  return Object.values(resultado).includes(PermissionsAndroid.RESULTS.GRANTED);
}