import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mf_token");
  // Note: localStorage works fine in a real deployed app (this runs in a normal
  // browser, not the Claude.ai artifact sandbox where it's unavailable).
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.endsWith("/auth/login");
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("mf_token");
      localStorage.removeItem("mf_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
