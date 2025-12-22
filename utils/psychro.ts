/**
 * Restoration AI - Psychrometric Calculation Utility
 * Handles automatic GPP calculations and drying progress logic.
 */

export const calculateGPP = (tempF: number, rh: number): number => {
  if (!tempF || !rh) return 0;

  // Constants for Saturation Vapor Pressure calculation
  const T = (tempF - 32) * (5 / 9) + 273.15; // Convert F to Kelvin
  
  // Simple approximation of Saturation Vapor Pressure (Pws) in hPa
  // Using the Magnus-Tetens approximation
  const tc = (tempF - 32) * (5/9);
  const pws = 6.112 * Math.exp((17.67 * tc) / (tc + 243.5));
  
  // Actual Vapor Pressure (Pw)
  const pw = (rh / 100) * pws;
  
  // Conversion to Grains Per Pound (GPP)
  // Standard atmospheric pressure is ~1013.25 hPa
  const patm = 1013.25;
  const humidityRatio = 0.62198 * (pw / (patm - pw));
  
  // Grains per pound (7000 grains in a pound)
  return Math.round(humidityRatio * 7000);
};

export const getDryingStatus = (gpp: number): { label: string; color: string } => {
  if (gpp <= 0) return { label: 'Pending', color: 'text-slate-400' };
  if (gpp < 40) return { label: 'Dry', color: 'text-emerald-500' };
  if (gpp < 60) return { label: 'Drying', color: 'text-blue-500' };
  return { label: 'Wet', color: 'text-red-500' };
};