import React, { createContext, useContext } from 'react';

// Provides stylist UI preferences (theme and misc settings) to pages like Settings.
// Extend later with more stylist-specific preferences (e.g. calendar density, auto-complete toggle).
export const StylistUIContext = createContext({
  darkMode: false,
  setDarkMode: () => {},
  preferences: {},
  savePreferences: async () => {},
});

export const useStylistUI = () => useContext(StylistUIContext);

export const StylistUIProvider = ({ children, value }) => (
  <StylistUIContext.Provider value={value}>{children}</StylistUIContext.Provider>
);
