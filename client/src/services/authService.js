import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('ayon_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const loginUser    = (data) => API.post('/auth/login',    data);
export const registerUser = (data) => API.post('/auth/register', data);
export const getProfile   = ()     => API.get('/auth/profile');

export default API;