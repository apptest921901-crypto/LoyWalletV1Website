import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Card {
  id?: string;
  merchant_name: string;
  card_name: string;
  barcode: string;
  notes?: string;
  image_base64?: string;
  is_favorite: boolean;
  created_at?: string;
}

export interface MerchantGroup {
  merchant_name: string;
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
  getMerchants: async (search?: string, favoritesOnly?: boolean) => {
    const response = await api.get<MerchantGroup[]>('/merchants', {
      params: { search, favorites_only: favoritesOnly },
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
