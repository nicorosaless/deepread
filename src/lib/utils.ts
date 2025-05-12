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
  // Usar el constructor URL para unir BASE_URL y endpoint de forma segura
  const finalUrl = new URL(endpoint, BASE_URL).href;
  const response = await fetch(finalUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    // Intenta parsear el cuerpo del error si es JSON
    let errorBody = '';
    try {
      errorBody = await response.text(); // Leer como texto primero
      const jsonError = JSON.parse(errorBody); // Intentar parsear como JSON
      if (jsonError && jsonError.detail) {
        throw new Error(`API fetch failed: ${response.status} ${response.statusText} - ${jsonError.detail}`);
      }
    } catch (e) {
      // Si no es JSON o falla el parseo, usa el texto del cuerpo si existe, o solo statusText
      const message = errorBody ? `${response.statusText} - ${errorBody}` : response.statusText;
      throw new Error(`API fetch failed: ${response.status} ${message}`);
    }
    // Fallback si no se pudo obtener más detalle
    throw new Error(`API fetch failed: ${response.status} ${response.statusText}`);
  }

  // Manejar respuestas vacías o no JSON
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    // Si no es JSON, puedes devolver el texto o manejarlo como prefieras
    // Por ahora, si no es JSON pero la respuesta es ok, devolvemos null o un objeto vacío
    // o podrías lanzar un error si siempre esperas JSON.
    // Si la respuesta puede ser vacía (ej. 204 No Content), esto es importante.
    if (response.status === 204) return null;
    return response.text().then(text => {
        // Si el texto está vacío, devuelve null o un objeto vacío.
        // Si no, podrías lanzar un error o devolver el texto.
        return text ? { data: text } : null;
    });
  }
}

export default BASE_URL;
