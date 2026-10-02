import { createSlice } from "@reduxjs/toolkit";

const savedTheme = localStorage.getItem("mf_theme") || "dark";

const uiSlice = createSlice({
  name: "ui",
  initialState: { theme: savedTheme },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("mf_theme", state.theme);
    },
    setTheme(state, action) {
      state.theme = action.payload;
      localStorage.setItem("mf_theme", action.payload);
    },
  },
});

export const { toggleTheme, setTheme } = uiSlice.actions;
export default uiSlice.reducer;