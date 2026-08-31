// Web-specific storage implementation using localStorage
// This file is automatically used by webpack when building for web

// Web platform storage using localStorage
const webStorage = {
  getItem: async (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  },
  removeItem: async (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Error removing from localStorage:', e);
    }
  },
};

export const Storage = {
  async getItem(key) {
    try {
      const value = await webStorage.getItem(key);
      // Handle null, undefined, or "undefined" string
      if (!value || value === 'undefined' || value === 'null') {
        return null;
      }
      return JSON.parse(value);
    } catch (e) {
      console.error('Error reading from storage:', e);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      // Don't store undefined or null values
      if (value === undefined || value === null) {
        await webStorage.removeItem(key);
        return;
      }
      await webStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  },

  async removeItem(key) {
    try {
      await webStorage.removeItem(key);
    } catch (e) {
      console.error('Error removing from storage:', e);
    }
  },
};

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER: 'user',
  REMEMBERED_EMAIL: 'remembered_email',
};
