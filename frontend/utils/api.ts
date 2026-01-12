import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api/`, 
  timeout: 15000, 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Expert Fix: Remove the async Supabase call from the interceptor to prevent deadlocks.
// We will now inject the token from AuthContext directly into the axios defaults.
export const setApiToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Response Interceptor: Handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized request detected');
    }
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
  logo_url?: string;
  category?: string;
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
  createCard: async (card: Omit<Card, 'id' | 'created_at'>) => {
    const response = await api.post<Card>('cards', card);
    return response.data;
  },
  getCards: async () => {
    const response = await api.get<Card[]>('cards');
    return response.data;
  },
  // Added missing getCard function
  getCard: async (cardId: string) => {
    const response = await api.get<Card>(`cards/${cardId}`);
    return response.data;
  },
  // Added missing updateCard function
  updateCard: async (cardId: string, updates: Partial<Card>) => {
    const response = await api.put<{status: string}>(`cards/${cardId}`, updates);
    return response.data;
  },
  // Added missing deleteCard function
  deleteCard: async (cardId: string) => {
    const response = await api.delete<{status: string}>(`cards/${cardId}`);
    return response.data;
  },
  getMerchantsGrouped: async (search?: string, favoritesOnly?: boolean) => {
    const response = await api.get<MerchantGroup[]>('merchants-grouped', {
      params: { search, favorites_only: favoritesOnly },
    });
    return response.data;
  },
  getMerchants: async () => {
    const response = await api.get<Merchant[]>('merchants');
    return response.data;
  },
  getStats: async () => {
    const response = await api.get<Stats>('stats');
    return response.data;
  },
  toggleFavorite: async (cardId: string, isFavorite: boolean) => {
    const response = await api.put(`cards/${cardId}/favorite`, null, {
      params: { is_favorite: isFavorite },
    });
    return response.data;
  }
};

export default api;
