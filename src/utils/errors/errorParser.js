/**
 * Error Parser
 * Parses API errors and converts them to AppError instances
 */

import {
  AppError,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ServerError,
  ErrorCode,
  ErrorCategory,
} from './errorTypes';
import {
  getErrorMessage,
  getHttpStatusMessage,
} from './errorMessages';

/**
 * Known backend error messages mapping
 * Maps backend error strings to { code, field, message }
 */
const backendErrorPatterns = [
  // Email errors
  { pattern: /e-?mail.*(já|already|existe|exists|cadastrado|registered)/i, code: ErrorCode.EMAIL_ALREADY_EXISTS, field: 'email', message: 'Este e-mail já está cadastrado.' },
  { pattern: /e-?mail.*(inválido|invalid|incorreto)/i, code: ErrorCode.INVALID_EMAIL, field: 'email', message: 'E-mail inválido.' },
  { pattern: /(invalid|inválido).*e-?mail/i, code: ErrorCode.INVALID_EMAIL, field: 'email', message: 'E-mail inválido.' },
  
  // CPF errors
  { pattern: /cpf.*(já|already|existe|exists|cadastrado|registered)/i, code: ErrorCode.CPF_ALREADY_EXISTS, field: 'cpf', message: 'Este CPF já está cadastrado.' },
  { pattern: /cpf.*(inválido|invalid)/i, code: ErrorCode.INVALID_CPF, field: 'cpf', message: 'CPF inválido.' },
  { pattern: /(invalid|inválido).*cpf/i, code: ErrorCode.INVALID_CPF, field: 'cpf', message: 'CPF inválido.' },
  
  // Password errors
  { pattern: /senha.*(incorreta|errada|wrong|invalid|inválida)/i, code: ErrorCode.INVALID_PASSWORD, field: 'password', message: 'Senha incorreta.' },
  { pattern: /senha.*(fraca|weak|curta|short)/i, code: ErrorCode.PASSWORD_TOO_WEAK, field: 'password', message: 'Senha muito fraca. Use pelo menos 8 caracteres.' },
  { pattern: /password.*(incorrect|wrong|invalid)/i, code: ErrorCode.INVALID_PASSWORD, field: 'password', message: 'Senha incorreta.' },
  
  // Auth errors
  { pattern: /credenciais?.*(inválid|invalid|incorrect)/i, code: ErrorCode.INVALID_CREDENTIALS, field: null, message: 'E-mail ou senha incorretos.' },
  { pattern: /(invalid|incorrect).*credentials/i, code: ErrorCode.INVALID_CREDENTIALS, field: null, message: 'E-mail ou senha incorretos.' },
  { pattern: /email.*ou.*senha.*incorre/i, code: ErrorCode.INVALID_CREDENTIALS, field: null, message: 'E-mail ou senha incorretos.' },
  { pattern: /^unauthorized$/i, code: ErrorCode.INVALID_CREDENTIALS, field: null, message: 'E-mail ou senha incorretos.' },
  
  // Token errors
  { pattern: /token.*(expirado|expired)/i, code: ErrorCode.TOKEN_EXPIRED, field: null, message: 'Sua sessão expirou. Faça login novamente.' },
  { pattern: /token.*(inválido|invalid)/i, code: ErrorCode.TOKEN_INVALID, field: null, message: 'Sessão inválida. Faça login novamente.' },
  { pattern: /sessão.*(expirad|invalid)/i, code: ErrorCode.SESSION_EXPIRED, field: null, message: 'Sua sessão expirou. Faça login novamente.' },
  
  // Authorization
  { pattern: /(acesso|access).*(negado|denied)/i, code: ErrorCode.FORBIDDEN, field: null, message: 'Você não tem permissão para esta ação.' },
  { pattern: /permissão.*(negad|denied)/i, code: ErrorCode.FORBIDDEN, field: null, message: 'Você não tem permissão para esta ação.' },
  
  // Resource conflicts
  { pattern: /já.*(inscrito|subscribed|cadastrado)/i, code: ErrorCode.ALREADY_SUBSCRIBED, field: null, message: 'Você já está inscrito.' },
  { pattern: /already.*(subscribed|registered)/i, code: ErrorCode.ALREADY_SUBSCRIBED, field: null, message: 'Você já está inscrito.' },
  
  // Not found
  { pattern: /usuário.*(não|not).*(encontrado|found)/i, code: ErrorCode.USER_NOT_FOUND, field: null, message: 'Usuário não encontrado.' },
  { pattern: /user.*(not|não).*(found|encontrado)/i, code: ErrorCode.USER_NOT_FOUND, field: null, message: 'Usuário não encontrado.' },
  { pattern: /rota.*(não|not).*(encontrad|found)/i, code: ErrorCode.ROUTE_NOT_FOUND, field: null, message: 'Rota não encontrada.' },
  { pattern: /viagem.*(não|not).*(encontrad|found)/i, code: ErrorCode.TRIP_NOT_FOUND, field: null, message: 'Viagem não encontrada.' },
  
  // Required fields
  { pattern: /nome.*(obrigatório|required|vazio|empty)/i, code: ErrorCode.REQUIRED_FIELD, field: 'nome', message: 'Nome é obrigatório.' },
  { pattern: /e-?mail.*(obrigatório|required|vazio|empty)/i, code: ErrorCode.REQUIRED_FIELD, field: 'email', message: 'E-mail é obrigatório.' },
  { pattern: /cpf.*(obrigatório|required|vazio|empty)/i, code: ErrorCode.REQUIRED_FIELD, field: 'cpf', message: 'CPF é obrigatório.' },
  { pattern: /matrícula.*(obrigatório|required|vazio|empty)/i, code: ErrorCode.REQUIRED_FIELD, field: 'matricula', message: 'Matrícula é obrigatória.' },
  { pattern: /senha.*(obrigatório|required|vazio|empty)/i, code: ErrorCode.REQUIRED_FIELD, field: 'password', message: 'Senha é obrigatória.' },
  { pattern: /instituição.*(obrigatório|required)/i, code: ErrorCode.REQUIRED_FIELD, field: 'instituicao_id', message: 'Instituição é obrigatória.' },
];

/**
 * Parse backend error message using regex patterns
 */
function parseBackendMessage(message) {
  if (!message || typeof message !== 'string') return null;
  
  for (const { pattern, code, field, message: friendlyMessage } of backendErrorPatterns) {
    if (pattern.test(message)) {
      return { code, field, message: friendlyMessage };
    }
  }
  
  return null;
}

/**
 * Extract field from error based on known field names in message
 */
function extractFieldFromMessage(message) {
  if (!message || typeof message !== 'string') return null;
  
  const lowerMessage = message.toLowerCase();
  
  const fieldPatterns = [
    { fields: ['email', 'e-mail'], name: 'email' },
    { fields: ['cpf'], name: 'cpf' },
    { fields: ['senha', 'password'], name: 'password' },
    { fields: ['nome', 'name'], name: 'nome' },
    { fields: ['matrícula', 'matricula'], name: 'matricula' },
    { fields: ['telefone', 'phone'], name: 'telefone' },
    { fields: ['instituição', 'instituicao'], name: 'instituicao_id' },
  ];
  
  for (const { fields, name } of fieldPatterns) {
    if (fields.some(f => lowerMessage.includes(f))) {
      return name;
    }
  }
  
  return null;
}

/**
 * Extract error details from various API response formats
 * Handles Flask-RESTX, Marshmallow, and custom error formats
 */
function extractErrorDetails(responseData) {
  if (!responseData) return { message: null, field: null, details: null, fieldErrors: {} };
  
  let message = null;
  let field = null;
  let details = null;
  let fieldErrors = {};
  
  // Handle string response
  if (typeof responseData === 'string') {
    message = responseData;
    field = extractFieldFromMessage(message);
    return { message, field, details, fieldErrors };
  }
  
  // Handle BusKá backend envelope: { "error": { "code", "message", "field?", "details", "request_id" } }
  if (responseData.error && typeof responseData.error === 'object') {
    const envelope = responseData.error;
    message = envelope.message || null;
    field = envelope.field || null;
    const envelopeDetails = envelope.details;
    if (envelopeDetails && typeof envelopeDetails === 'object') {
      details = envelopeDetails;
      for (const [k, v] of Object.entries(envelopeDetails)) {
        fieldErrors[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }
    return { message, field, details, fieldErrors };
  }

  // Extract main message
  message = responseData.message || responseData.error || responseData.msg || responseData.detail;
  
  // Extract explicit field
  field = responseData.field || responseData.loc?.[0] || responseData.location;
  
  // Handle BusKá backend format: { "error": "Erro de validação", "details": { "field": "message" } }
  // Also handles Flask-RESTX: { "errors": { "field": "message" } }
  const errorsObj = responseData.details || responseData.errors;
  if (errorsObj && typeof errorsObj === 'object') {
    details = errorsObj;
    
    // Helper to extract error message from various formats
    const extractErrorMessage = (errorValue) => {
      if (typeof errorValue === 'string') {
        return errorValue;
      }
      if (Array.isArray(errorValue) && errorValue.length > 0) {
        return typeof errorValue[0] === 'string' ? errorValue[0] : 'Campo inválido';
      }
      if (typeof errorValue === 'object' && errorValue !== null) {
        // Nested object - extract first error from nested fields
        if (errorValue.message) return errorValue.message;
        // Marshmallow nested: { "rua": ["Required"], "cidade": ["Required"] }
        const nestedErrors = Object.values(errorValue);
        if (nestedErrors.length > 0) {
          return extractErrorMessage(nestedErrors[0]);
        }
      }
      return 'Campo inválido';
    };
    
    // Convert errors object to fieldErrors map
    for (const [fieldName, errorMsg] of Object.entries(errorsObj)) {
      fieldErrors[fieldName] = extractErrorMessage(errorMsg);
    }
    
    // If there's only one field error, use it as the main message
    const fieldKeys = Object.keys(fieldErrors);
    if (fieldKeys.length === 1) {
      field = fieldKeys[0];
      // Override generic "Erro de validação" with specific field message
      message = fieldErrors[field];
    } else if (fieldKeys.length > 1) {
      // Multiple field errors - show count
      message = `Corrija os ${fieldKeys.length} campos destacados.`;
    }
  }
  
  // Handle Marshmallow errors: { "email": ["Invalid email"] }
  if (!details && !message) {
    const possibleFields = ['email', 'cpf', 'nome', 'password', 'senha', 'matricula', 'telefone'];
    for (const fieldName of possibleFields) {
      if (responseData[fieldName]) {
        const errorVal = responseData[fieldName];
        if (typeof errorVal === 'string') {
          fieldErrors[fieldName] = errorVal;
        } else if (Array.isArray(errorVal) && errorVal.length > 0) {
          fieldErrors[fieldName] = errorVal[0];
        }
      }
    }
    
    if (Object.keys(fieldErrors).length > 0) {
      details = fieldErrors;
      const firstField = Object.keys(fieldErrors)[0];
      field = firstField;
      message = fieldErrors[firstField];
    }
  }
  
  // Handle validation_errors array
  if (responseData.validation_errors && Array.isArray(responseData.validation_errors)) {
    details = responseData.validation_errors;
    for (const err of responseData.validation_errors) {
      if (err.field && err.message) {
        fieldErrors[err.field] = err.message;
      } else if (err.loc && err.msg) {
        fieldErrors[err.loc[0] || err.loc] = err.msg;
      }
    }
  }
  
  // Try to extract field from message if not found
  if (!field && message) {
    field = extractFieldFromMessage(message);
  }
  
  return { message, field, details, fieldErrors };
}

/**
 * Determine error category from HTTP status code
 */
function getCategoryFromStatus(status) {
  if (status === 401) return ErrorCategory.AUTHENTICATION;
  if (status === 403) return ErrorCategory.AUTHORIZATION;
  if (status === 404) return ErrorCategory.NOT_FOUND;
  if (status === 409) return ErrorCategory.CONFLICT;
  if (status === 400 || status === 422) return ErrorCategory.VALIDATION;
  if (status >= 500) return ErrorCategory.SERVER;
  if (status >= 400) return ErrorCategory.CLIENT;
  return ErrorCategory.UNKNOWN;
}

/**
 * Parse Axios error into AppError
 */
export function parseApiError(error) {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }
  
  // Network error (no response)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new NetworkError('A requisição demorou muito. Tente novamente.');
    }
    if (error.message?.includes('Network Error') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return new NetworkError('Sem conexão com a internet. Verifique sua rede.');
    }
    return new NetworkError('Não foi possível conectar ao servidor.');
  }
  
  const { status, data } = error.response;
  const { message: backendMessage, field, details, fieldErrors } = extractErrorDetails(data);
  
  // Try to match backend message to known error patterns
  const matchedPattern = parseBackendMessage(backendMessage);
  
  // Use matched pattern if found
  const errorCode = matchedPattern?.code;
  const errorField = matchedPattern?.field || field;
  const errorMessage = matchedPattern?.message || backendMessage;
  
  // Authentication errors (401)
  if (status === 401) {
    const code = errorCode || ErrorCode.UNAUTHORIZED;
    const message = matchedPattern?.message || getErrorMessage(code);
    return new AuthenticationError(message, code);
  }
  
  // Authorization errors (403)
  if (status === 403) {
    return new AuthorizationError(
      errorMessage || 'Você não tem permissão para esta ação.'
    );
  }
  
  // Not found (404)
  if (status === 404) {
    return new NotFoundError(errorMessage || 'Recurso');
  }
  
  // Conflict (409) - usually duplicate entries
  if (status === 409) {
    const code = errorCode || ErrorCode.DUPLICATE_ENTRY;
    const message = errorMessage || 'Este registro já existe.';
    const conflictError = new ConflictError(message, code);
    conflictError.field = errorField;
    return conflictError;
  }
  
  // Validation errors (400, 422)
  if (status === 400 || status === 422) {
    const code = errorCode || ErrorCode.VALIDATION_ERROR;
    const message = errorMessage || 'Dados inválidos. Verifique as informações.';
    const validationError = new ValidationError(message, errorField, details);
    validationError.fieldErrors = fieldErrors;
    // Keep the backend text: the friendly rewrite above can hide what the backend meant.
    validationError.backendMessage = backendMessage;
    return validationError;
  }
  
  // Server errors (5xx)
  if (status >= 500) {
    return new ServerError(
      'O servidor está com problemas. Tente novamente em alguns minutos.',
      error
    );
  }
  
  // Generic client error
  const code = errorCode || ErrorCode.UNKNOWN_ERROR;
  const finalMessage = errorMessage || getHttpStatusMessage(status);
  
  return new AppError({
    message: finalMessage,
    code,
    category: getCategoryFromStatus(status),
    statusCode: status,
    field: errorField,
    details,
    originalError: error,
  });
}

/**
 * Parse any error into a user-friendly message
 */
export function getErrorMessageFromError(error) {
  if (error instanceof AppError) {
    return error.message;
  }
  
  const parsed = parseApiError(error);
  return parsed.message;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
  if (error instanceof AppError) {
    return error.isRetryable;
  }
  
  // Network errors are retryable
  if (!error.response) {
    return true;
  }
  
  // Server errors are retryable
  if (error.response?.status >= 500) {
    return true;
  }
  
  // Rate limiting
  if (error.response?.status === 429) {
    return true;
  }
  
  return false;
}

/**
 * Check if error requires re-authentication
 */
export function requiresReauth(error) {
  if (error instanceof AuthenticationError) {
    return true;
  }
  
  if (error instanceof AppError) {
    return error.code === ErrorCode.TOKEN_EXPIRED ||
           error.code === ErrorCode.TOKEN_INVALID ||
           error.code === ErrorCode.SESSION_EXPIRED;
  }
  
  return error.response?.status === 401;
}
