import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Determinar la URL base según el entorno y el dominio actual
function determineBaseUrl() {
  const isDevelopment = import.meta.env.DEV;
  if (isDevelopment) {
    return "http://localhost:8000";
  }

  const currentDomain = window.location.hostname;

  // Cambiar para usar una variable de entorno en lugar de una URL fija
  return import.meta.env.VITE_API_BASE_URL || "https://deepreadbackend.vercel.app";
}

const BASE_URL = determineBaseUrl();

export async function apiFetch(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export default BASE_URL;
