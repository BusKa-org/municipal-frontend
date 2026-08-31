// Storage implementation for React Native (mobile)
// For web, webpack will automatically use storage.web.js instead
import AsyncStorageModule from '@react-native-async-storage/async-storage';

const AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;

export const Storage = {
  async getItem(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error('Error reading from storage:', e);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
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

