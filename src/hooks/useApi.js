/**
 * useApi Hook
 * Standardized hook for API calls with loading, error, and data states
 * Integrates with Toast for user feedback
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { parseApiError, isRetryableError, requiresReauth } from '../utils/errors/index';
import { useAuth } from '../contexts/AuthContext';

/**
 * API call states
 */
export const ApiState = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};

/**
 * Hook for making API calls with standardized states
 * @param {Object} options - Configuration options
 * @param {boolean} options.showErrorToast - Show toast on error (default: true)
 * @param {boolean} options.showSuccessToast - Show toast on success (default: false)
 * @param {string} options.successMessage - Custom success message
 * @param {number} options.retryCount - Number of retries for retryable errors (default: 0)
 */
export function useApi(options = {}) {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage = 'Operação realizada com sucesso!',
    retryCount = 0,
  } = options;

  const [state, setState] = useState(ApiState.IDLE);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  const toast = useToast();
  const { logout } = useAuth();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Reset state to idle
   */
  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setState(ApiState.IDLE);
      setData(null);
      setError(null);
    }
  }, []);

  /**
   * Execute an API call with standardized handling
   * @param {Function} apiCall - Async function that makes the API call
   * @param {Object} callOptions - Options for this specific call
   */
  const execute = useCallback(async (apiCall, callOptions = {}) => {
    const {
      onSuccess,
      onError,
      showError = showErrorToast,
      showSuccess = showSuccessToast,
      customSuccessMessage = successMessage,
      customErrorMessage,
    } = callOptions;

    if (!isMountedRef.current) return { success: false, data: null, error: null };

    setState(ApiState.LOADING);
    setError(null);

    let attempts = 0;
    const maxAttempts = retryCount + 1;

    while (attempts < maxAttempts) {
      try {
        const result = await apiCall();
        
        if (!isMountedRef.current) return { success: true, data: result, error: null };

        setState(ApiState.SUCCESS);
        setData(result);

        if (showSuccess && toast) {
          toast.success(customSuccessMessage);
        }

        if (onSuccess) {
          onSuccess(result);
        }

        return { success: true, data: result, error: null };
      } catch (err) {
        attempts++;
        
        const parsedError = parseApiError(err);
        
        // Check if we should retry
        const shouldRetry = attempts < maxAttempts && isRetryableError(parsedError);
        
        if (shouldRetry) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          continue;
        }

        if (!isMountedRef.current) return { success: false, data: null, error: parsedError };

        setState(ApiState.ERROR);
        setError(parsedError);

        // Handle auth errors
        if (requiresReauth(parsedError)) {
          toast?.error('Sessão expirada. Faça login novamente.');
          logout();
          return { success: false, data: null, error: parsedError };
        }

        // Show error toast
        if (showError && toast) {
          const message = customErrorMessage || parsedError.message || 'Ocorreu um erro';
          toast.error(message);
        }

        if (onError) {
          onError(parsedError);
        }

        return { success: false, data: null, error: parsedError };
      }
    }

    return { success: false, data: null, error: null };
  }, [showErrorToast, showSuccessToast, successMessage, retryCount, toast, logout]);

  /**
   * Execute without changing loading state (for background refreshes)
   */
  const executeQuietly = useCallback(async (apiCall, callOptions = {}) => {
    try {
      const result = await apiCall();
      
      if (isMountedRef.current) {
        setData(result);
      }
      
      return { success: true, data: result, error: null };
    } catch (err) {
      const parsedError = parseApiError(err);
      
      if (isMountedRef.current) {
        setError(parsedError);
      }
      
      return { success: false, data: null, error: parsedError };
    }
  }, []);

  return {
    // States
    state,
    data,
    error,
    
    // Derived states
    isIdle: state === ApiState.IDLE,
    isLoading: state === ApiState.LOADING,
    isSuccess: state === ApiState.SUCCESS,
    isError: state === ApiState.ERROR,
    
    // Actions
    execute,
    executeQuietly,
    reset,
    setData,
  };
}

/**
 * Hook for fetching data on mount with automatic loading state
 * @param {Function} fetchFn - Function that fetches data
 * @param {Array} deps - Dependencies for refetching
 * @param {Object} options - Configuration options
 */
export function useFetch(fetchFn, deps = [], options = {}) {
  const {
    enabled = true,
    onSuccess,
    onError,
    ...apiOptions
  } = options;

  const api = useApi(apiOptions);
  const hasLoadedRef = useRef(false);

  const depsArray = Array.isArray(deps) ? deps : [];

  useEffect(() => {
    if (!enabled) return;

    const load = async () => {
      await api.execute(fetchFn, { onSuccess, onError });
      hasLoadedRef.current = true;
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...depsArray]);

  return {
    ...api,
    refetch: () => api.execute(fetchFn, { onSuccess, onError }),
    hasLoaded: hasLoadedRef.current,
  };
}

/**
 * Hook for mutations (POST, PUT, DELETE)
 * @param {Function} mutationFn - Function that performs the mutation
 * @param {Object} options - Configuration options
 */
export function useMutation(mutationFn, options = {}) {
  const {
    onSuccess,
    onError,
    successMessage,
    ...apiOptions
  } = options;

  const api = useApi({
    showSuccessToast: !!successMessage,
    successMessage,
    ...apiOptions,
  });

  const mutate = useCallback(async (variables) => {
    return api.execute(
      () => mutationFn(variables),
      { onSuccess, onError }
    );
  }, [api, mutationFn, onSuccess, onError]);

  return {
    ...api,
    mutate,
  };
}

export default useApi;
