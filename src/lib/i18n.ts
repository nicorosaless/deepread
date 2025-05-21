
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "welcome": "Welcome to DeepRead",
      "register": "Register",
      "login": "Login",
      "search": "Search",
      "error": "Error",
      "success": "Success",
      "logout": "Logout",
      "chat": "Chat",
      "arxiv": "ArXiv",
      "papers": "Papers",
      "categories": "Categories",
      "timeframe": "Timeframe",
      "all_categories": "All Categories",
      "all_timeframes": "All Timeframes",
      "last_week": "Last Week",
      "last_month": "Last Month",
      "last_year": "Last Year",
      "upload_pdf": "Upload a PDF of an arXiv paper or go to the ArXiv Search page",
      "summary": "Summary",
      "implementation": "Implementation",
      "chatbot": "Chatbot",
      "paper_summary": "Paper Summary",
      "implementation_projects": "Implementation Projects",
      "chatbot_assistant": "Chatbot Assistant",
      "coming_soon": "This feature will be available soon. You'll be able to ask specific questions about the paper and get answers."
    }
  },
  es: {
    translation: {
      "welcome": "Bienvenido a DeepRead",
      "register": "Registrarse",
      "login": "Iniciar sesión",
      "search": "Buscar",
      "error": "Error",
      "success": "Éxito",
      "logout": "Cerrar sesión",
      "chat": "Chat",
      "arxiv": "ArXiv",
      "papers": "Artículos",
      "categories": "Categorías",
      "timeframe": "Periodo de tiempo",
      "all_categories": "Todas las categorías",
      "all_timeframes": "Todos los periodos",
      "last_week": "Última semana",
      "last_month": "Último mes",
      "last_year": "Último año",
      "upload_pdf": "Sube un PDF de un paper de ArXiv o ve a la página de Búsqueda de ArXiv",
      "summary": "Resumen",
      "implementation": "Implementación",
      "chatbot": "Chatbot",
      "paper_summary": "Resumen del Paper",
      "implementation_projects": "Proyectos de Implementación",
      "chatbot_assistant": "Chatbot Asistente",
      "coming_soon": "Esta función estará disponible pronto. Podrás hacer preguntas específicas sobre el paper y recibir respuestas."
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es', // Cambiado a español como idioma predeterminado
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

export default i18n;
