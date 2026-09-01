import {Alert, Platform} from 'react-native';

/**
 * Alert.alert do react-native-web é um stub vazio (`static alert() {}`),
 * então qualquer ação que dependa do onPress de um botão de confirmação
 * (ex.: logout) simplesmente nunca acontecia na web.
 *
 * Este helper usa window.confirm na web e Alert.alert no nativo.
 */
export const confirmAction = ({
  title,
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const ok =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(text)
        : true;
    if (ok) {
      onConfirm?.();
    } else {
      onCancel?.();
    }
    return;
  }

  Alert.alert(title, message, [
    {text: cancelText, style: 'cancel', onPress: () => onCancel?.()},
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: () => onConfirm?.(),
    },
  ]);
};

export default confirmAction;
