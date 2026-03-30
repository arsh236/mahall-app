/**
 * Mahall Management API Handler (FETCH wrapper)
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxvfZX-FH_-sPWtW9bz3BPLN28K3IzAlkdS7z3SkZu177ViKHYMz38_KEFMXfHEezNZzg/exec';

const api = {
  /**
   * Generic GET request
   * @param {string} action 
   * @param {object} params 
   */
  async get(action, params = {}) {
    const org_id = localStorage.getItem('org_id');
    const query = new URLSearchParams({ action, org_id, ...params }).toString();

    try {
      const response = await fetch(`${API_URL}?${query}`);
      if (!response.ok) throw new Error('API Error');
      return await response.json();
    } catch (err) {
      console.error('Fetch error:', err);
      throw err;
    }
  },

  /**
   * Generic POST request
   * @param {string} action 
   * @param {object} data 
   */
  async post(action, data = {}) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        // Important: Apps Script POST needs 'text/plain' or no content-type to handle as JSON via postData
        // because setting application/json triggers CORS OPTIONS preflight which Apps Script handles poorly
        body: JSON.stringify({ action, data }),
        redirect: 'follow'
      });

      if (!response.ok) throw new Error('API Error');
      return await response.json();
    } catch (err) {
      console.error('Fetch error:', err);
      throw err;
    }
  }
};
