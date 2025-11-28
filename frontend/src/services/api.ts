import axios from 'axios';
import { toast } from 'react-hot-toast';

// API base URL (without /api suffix for direct file downloads)
const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000';

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

    // Don't show automatic error toast here - let individual mutations handle their own errors
    // This prevents duplicate error messages

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

  // Product Customization API
  getProductComponents: async (productId: string) => {
    const response = await api.get(`/products/${productId}/components`);
    return response.data;
  },

  calculateCustomPrice: async (payload: {
    product_id: string;
    base_price: number;
    custom_components: Array<{
      component_name: string;
      material_id?: string;
      finish_id?: string;
    }>;
  }) => {
    const response = await api.post('/products/calculate-custom-price', payload);
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

  getStats: async () => {
    const response = await api.get('/contacts/stats/overview');
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
    sales_rep_id?: string;
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

  duplicate: async (id: string) => {
    const response = await api.post(`/quotations/${id}/duplicate`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/quotations/stats/overview');
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  getCompany: async () => {
    const response = await api.get('/settings/company');
    return response.data;
  },

  updateCompany: async (data: any) => {
    const response = await api.put('/settings/company', data);
    return response.data;
  },
};

// Inventory API
export const inventoryApi = {
  getStock: async (params?: {
    search?: string;
    category?: string;
    status?: string;
  }) => {
    const response = await api.get('/inventory/stock', { params });
    return response.data;
  },

  getMovements: async (limit?: number) => {
    const response = await api.get('/inventory/movements', { params: { limit } });
    return response.data;
  },

  createMovement: async (data: {
    item_id: string;
    item_type: 'product' | 'material';
    adjustment_type: 'add' | 'remove' | 'set';
    quantity: number;
    reason: string;
    notes?: string;
  }) => {
    const response = await api.post('/inventory/movements', data);
    return response.data;
  },

  getAlerts: async () => {
    const response = await api.get('/inventory/alerts');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/inventory/stats');
    return response.data;
  },
};

// Sales Orders API
export const salesOrdersApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    contact_id?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const response = await api.get('/sales-orders', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/sales-orders/${id}`);
    return response.data;
  },

  create: async (data: {
    quotation_id: string;
    expected_delivery_date?: string;
    delivery_address?: string;
    notes?: string;
  }) => {
    const response = await api.post('/sales-orders', data);
    return response.data;
  },

  updateStatus: async (id: string, data: {
    status: 'en_cours' | 'en_preparation' | 'expedie' | 'livre' | 'termine' | 'annule';
    shipped_date?: string;
    delivered_date?: string;
    tracking_number?: string;
  }) => {
    const response = await api.patch(`/sales-orders/${id}/status`, data);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await api.post(`/sales-orders/${id}/cancel`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/sales-orders/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/sales-orders/stats/overview');
    return response.data;
  },

  // Payment management
  addPayment: async (orderId: string, data: {
    amount: number;
    method: 'especes' | 'carte' | 'virement' | 'cheque';
    date?: string;
    notes?: string;
  }) => {
    const response = await api.post(`/sales-orders/${orderId}/payments`, data);
    return response.data;
  },

  updatePayment: async (orderId: string, paymentId: string, data: {
    amount?: number;
    method?: 'especes' | 'carte' | 'virement' | 'cheque';
    date?: string;
    notes?: string;
  }) => {
    const response = await api.put(`/sales-orders/${orderId}/payments/${paymentId}`, data);
    return response.data;
  },

  deletePayment: async (orderId: string, paymentId: string) => {
    const response = await api.delete(`/sales-orders/${orderId}/payments/${paymentId}`);
    return response.data;
  },

  // Document management
  uploadDocument: async (orderId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/sales-orders/${orderId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getDocuments: async (orderId: string) => {
    const response = await api.get(`/sales-orders/${orderId}/documents`);
    return response.data;
  },

  downloadDocument: async (orderId: string, docId: string) => {
    const response = await api.get(`/sales-orders/${orderId}/documents/${docId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteDocument: async (orderId: string, docId: string) => {
    const response = await api.delete(`/sales-orders/${orderId}/documents/${docId}`);
    return response.data;
  },
};

// Invoices API
export const invoicesApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    contact_id?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const response = await api.get('/invoices', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  create: async (data: {
    sales_order_id: string;
    due_date?: string;
    payment_terms?: string;
    notes?: string;
  }) => {
    const response = await api.post('/invoices', data);
    return response.data;
  },

  updateStatus: async (id: string, status: 'brouillon' | 'envoyee' | 'payee' | 'en_retard' | 'annulee') => {
    const response = await api.patch(`/invoices/${id}/status`, { status });
    return response.data;
  },

  recordPayment: async (id: string, data: {
    amount_paid: number;
    payment_method?: 'virement' | 'cheque' | 'carte' | 'especes';
    payment_reference?: string;
    payment_date?: string;
  }) => {
    const response = await api.patch(`/invoices/${id}/payment`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/invoices/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/invoices/stats/overview');
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async (params?: { search?: string; role?: string; status?: string }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    first_name: string;
    last_name: string;
    role: 'admin' | 'sales' | 'inventory_manager';
    phone?: string;
    generate_password?: boolean;
    password?: string;
  }) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  update: async (id: string, data: {
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: 'admin' | 'sales' | 'inventory_manager';
    phone?: string;
  }) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  suspend: async (id: string) => {
    const response = await api.post(`/users/${id}/suspend`);
    return response.data;
  },

  unsuspend: async (id: string) => {
    const response = await api.post(`/users/${id}/unsuspend`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  resetPassword: async (id: string, data?: { generate_password?: boolean; password?: string }) => {
    const response = await api.post(`/users/${id}/reset-password`, data);
    return response.data;
  },

  getRoles: async () => {
    const response = await api.get('/users/meta/roles');
    return response.data;
  },
};

// Notifications API
export const notificationsApi = {
  getAll: async (params?: { limit?: number; unread_only?: boolean }) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.post('/notifications/mark-all-read');
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
};

// Backup API
export const backupApi = {
  create: async () => {
    const response = await api.post('/backup/create');
    return response.data;
  },

  list: async () => {
    const response = await api.get('/backup/list');
    return response.data;
  },

  restore: async (filename: string) => {
    const response = await api.post('/backup/restore', { filename });
    return response.data;
  },

  delete: async (filename: string) => {
    const response = await api.delete(`/backup/${filename}`);
    return response.data;
  },

  exportContacts: async () => {
    const response = await api.get('/backup/export/contacts', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `contacts_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  exportProducts: async () => {
    const response = await api.get('/backup/export/products', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `products_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  exportQuotations: async () => {
    const response = await api.get('/backup/export/quotations', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `quotations_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  exportSalesOrders: async () => {
    const response = await api.get('/backup/export/sales-orders', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_orders_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  exportInvoices: async () => {
    const response = await api.get('/backup/export/invoices', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoices_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export default api;