import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api", // Kiểm tra đúng port của bạn
});

// Tự động đính kèm Token vào Header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;