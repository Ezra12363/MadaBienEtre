// src/redux/slices/themeSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isDark: false,
  mode: 'system',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.isDark = action.payload.isDark;
      state.mode = action.payload.mode || 'manual';
    },
    toggleTheme: (state) => {
      state.isDark = !state.isDark;
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;

export default themeSlice.reducer;