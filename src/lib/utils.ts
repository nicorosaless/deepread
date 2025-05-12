import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Determinar la URL base según el entorno
const isDevelopment = import.meta.env.DEV;
const BASE_URL = isDevelopment ? "http://localhost:8000" : "";

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
