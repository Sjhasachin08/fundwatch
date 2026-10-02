import { createSlice } from "@reduxjs/toolkit";

const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem("mf_user")); } catch { return null; }
})();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: savedUser || null,
    token: localStorage.getItem("mf_token") || null,
  },
  reducers: {
    setCredentials(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem("mf_token", action.payload.token);
      localStorage.setItem("mf_user", JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem("mf_token");
      localStorage.removeItem("mf_user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

export function can(user, module, action) {
  if (!user) return false;
  if (user.role === "SuperAdmin") return true;
  const allowed = user.permissions?.[module];
  return Array.isArray(allowed) && allowed.includes(action);
}
