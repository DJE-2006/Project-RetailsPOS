// ─── Formatting Helpers ─────────────────────────────────────

export const formatCurrency = (amount = 0) => {
  return `₱${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (timestamp) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (timestamp) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

const STATUS_COLOR = {
  completed: '#10B981',
  pending:   '#F59E0B',
  cancelled: '#EF4444',
  refunded:  '#7C3AED',
};
export const getStatusColor = (status) => STATUS_COLOR[status] || '#94A3B8';

export const getStatusLabel = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', cashier: 'Cashier' };
export const getRoleLabel = (role) => ROLE_LABEL[role] || role;

const ROLE_COLOR = { admin: '#0F766E', manager: '#7C3AED', cashier: '#10B981' };
export const getRoleColor = (role) => ROLE_COLOR[role] || '#94A3B8';

export const truncate = (str, len = 30) =>
  str && str.length > len ? str.substring(0, len) + '…' : str || '';
