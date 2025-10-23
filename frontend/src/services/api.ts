import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/auth/refresh`,
            { refreshToken }
          );

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Show error message
    if (error.response?.data?.error) {
      toast.error(error.response.data.error);
    } else if (error.message) {
      toast.error(error.message);
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: { token: string; newPassword: string }) => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },
};

// Products API
export const productsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    type?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await api.get('/products', { params });
    return response.data.products || response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data.product || response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/products', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  uploadImage: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`/products/${id}/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getCategories: async (includeInactive = false) => {
    const params = includeInactive ? { include_inactive: 'true' } : {};
    const response = await api.get('/products/categories/all', { params });
    return response.data.categories || response.data;
  },

  createCategory: async (data: any) => {
    const response = await api.post('/products/categories', data);
    return response.data;
  },

  updateCategory: async (id: string, data: any) => {
    const response = await api.put(`/products/categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id: string) => {
    const response = await api.delete(`/products/categories/${id}`);
    return response.data;
  },

  getMaterials: async () => {
    const response = await api.get('/products/materials/all');
    return response.data.materials || response.data;
  },

  createMaterial: async (data: any) => {
    const response = await api.post('/products/materials', data);
    return response.data;
  },

  updateMaterial: async (id: string, data: any) => {
    const response = await api.put(`/products/materials/${id}`, data);
    return response.data;
  },

  deleteMaterial: async (id: string) => {
    const response = await api.delete(`/products/materials/${id}`);
    return response.data;
  },

  getFinishes: async () => {
    const response = await api.get('/products/finishes/all');
    return response.data.finishes || response.data;
  },

  createFinish: async (data: any) => {
    const response = await api.post('/products/finishes', data);
    return response.data;
  },

  updateFinish: async (id: string, data: any) => {
    const response = await api.put(`/products/finishes/${id}`, data);
    return response.data;
  },

  deleteFinish: async (id: string) => {
    const response = await api.delete(`/products/finishes/${id}`);
    return response.data;
  },
};

// Contacts API
export const contactsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await api.get('/contacts', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/contacts/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/contacts', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/contacts/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/contacts/${id}`);
    return response.data;
  },

  getAddresses: async (contactId: string) => {
    const response = await api.get(`/contacts/${contactId}/addresses`);
    return response.data;
  },

  createAddress: async (contactId: string, data: any) => {
    const response = await api.post(`/contacts/${contactId}/addresses`, data);
    return response.data;
  },

  updateAddress: async (contactId: string, addressId: string, data: any) => {
    const response = await api.put(`/contacts/${contactId}/addresses/${addressId}`, data);
    return response.data;
  },

  deleteAddress: async (contactId: string, addressId: string) => {
    const response = await api.delete(`/contacts/${contactId}/addresses/${addressId}`);
    return response.data;
  },
};

// Quotations API
export const quotationsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    contact_id?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await api.get('/quotations', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/quotations/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/quotations', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/quotations/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/quotations/${id}`);
    return response.data;
  },

  updateStatus: async (id: string, status: string) => {
    const response = await api.patch(`/quotations/${id}/status`, { status });
    return response.data;
  },

  convertToOrder: async (id: string) => {
    const response = await api.post(`/quotations/${id}/convert-to-order`);
    return response.data;
  },

  sendEmail: async (id: string, email: string) => {
    const response = await api.post(`/quotations/${id}/send-email`, { email });
    return response.data;
  },

  generatePdf: async (id: string) => {
    const response = await api.get(`/quotations/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default api;