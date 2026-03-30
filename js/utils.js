/**
 * Mahall Management Utils
 */

const utils = {
  /**
   * SHA-256 password hashing (Web Crypto API)
   * @param {string} password 
   */
  async hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  /**
   * Local session state management
   */
  setSession(user) {
    localStorage.setItem('user_id', user.id);
    localStorage.setItem('user_name', user.name);
    localStorage.setItem('phone', user.phone);
    localStorage.setItem('role', user.role);
    localStorage.setItem('org_id', user.org_id);
    localStorage.setItem('plan_expiry', user.plan_expiry);
    localStorage.setItem('is_expired', user.isExpired ? 'true' : 'false');
    localStorage.setItem('is_super_admin', user.isSuperAdmin ? 'true' : 'false');
  },

  getSession() {
    const id = localStorage.getItem('user_id');
    if (!id) return null;
    return {
      id,
      name: localStorage.getItem('user_name'),
      phone: localStorage.getItem('phone'),
      role: localStorage.getItem('role'),
      org_id: localStorage.getItem('org_id'),
      plan_expiry: localStorage.getItem('plan_expiry'),
      isExpired: localStorage.getItem('is_expired') === 'true',
      isSuperAdmin: localStorage.getItem('is_super_admin') === 'true'
    };
  },

  logout() {
    localStorage.clear();
    window.location.href = '../';
  },

  /**
   * UI Helpers
   */
  showToast(message, type = 'success') {
    // Basic toast-like alert for simplicity as Bootstrap Toast requires extra setup
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    toast.style.zIndex = '9999';
    toast.innerHTML = message;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    // If it's already in dd-mm-yyyy format, return as is
    if (typeof dateStr === 'string' && /^\d{2}-\d{2}-\d{4}/.test(dateStr)) return dateStr;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }
};
