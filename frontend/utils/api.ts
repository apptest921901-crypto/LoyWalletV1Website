import axios from 'axios';
import { supabase } from '../config/supabase';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include auth token
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface Card {
  card_id?: string;
  merchant_id: string;
  merchant_name?: string;
  card_name: string;
  barcode: string;
  notes?: string;
  image_base64?: string;
  is_favorite: boolean;
  merchant_logo_url?: string;
  merchant_category?: string;
  created_at?: string;
}

export interface Merchant {
  merchant_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  category?: string;
  website?: string;
}

export interface MerchantGroup {
  merchant_name: string;
  merchant_id: string;
  merchant_logo_url?: string;
  card_count: number;
  cards: Card[];
}

export interface Stats {
  total_cards: number;
  favorite_cards: number;
  total_merchants: number;
}

export const cardAPI = {
  // Create a new card
  createCard: async (card: Omit<Card, 'id' | 'created_at'>) => {
    const response = await api.post<Card>('/cards', card);
    return response.data;
  },

  // Get all cards with optional filters
  getCards: async (search?: string, favoritesOnly?: boolean) => {
    const response = await api.get<Card[]>('/cards', {
      params: { search, favorites_only: favoritesOnly },
    });
    return response.data;
  },

  // Get a specific card
  getCard: async (cardId: string) => {
    const response = await api.get<Card>(`/cards/${cardId}`);
    return response.data;
  },

  // Update a card
  updateCard: async (cardId: string, updates: Partial<Card>) => {
    const response = await api.put<Card>(`/cards/${cardId}`, updates);
    return response.data;
  },

  // Delete a card
  deleteCard: async (cardId: string) => {
    const response = await api.delete(`/cards/${cardId}`);
    return response.data;
  },

  // Toggle favorite status
  toggleFavorite: async (cardId: string, isFavorite: boolean) => {
    const response = await api.put(`/cards/${cardId}/favorite`, null, {
      params: { is_favorite: isFavorite },
    });
    return response.data;
  },

  // Get merchants grouped
  getMerchantsGrouped: async (search?: string, favoritesOnly?: boolean) => {
    const response = await api.get<MerchantGroup[]>('/merchants-grouped', {
      params: { search, favorites_only: favoritesOnly },
    });
    return response.data;
  },

  // Get merchants list
  getMerchants: async (search?: string) => {
    const response = await api.get<Merchant[]>('/merchants', {
      params: { search },
    });
    return response.data;
  },

  // Get statistics
  getStats: async () => {
    const response = await api.get<Stats>('/stats');
    return response.data;
  },
};

export default api;
