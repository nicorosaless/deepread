# vite_react_shadcn_ts

Este proyecto es una aplicación web construida con Vite, React, TypeScript y Shadcn UI.

## Requisitos Previos

Asegúrate de tener Node.js y npm (o yarn/pnpm) instalados en tu sistema.

## Instalación

1.  Clona el repositorio:
    ```bash
    git clone <repository-url>
    cd paper-to-practice-path
    ```
2.  Instala las dependencias del frontend:
    ```bash
    npm install
    # o
    # yarn install
    # o
    # pnpm install
    ```
3.  Navega al directorio del backend e instala las dependencias de Python:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```
4.  Crea un archivo `.env` en el directorio `backend` y configura las variables de entorno necesarias (consulta `backend/main.py` para ver las variables requeridas como `MONGODB_URI`, `GROQ_API_KEY`, `JWT_SECRET`).

## Ejecución del Proyecto

### Frontend

Para iniciar el servidor de desarrollo del frontend:

```bash
npm run dev
```

Esto iniciará la aplicación en `http://localhost:8080` (o el puerto que hayas configurado en `vite.config.ts`).

### Backend

Para iniciar el servidor del backend (FastAPI):

```bash
cd backend
uvicorn main:app --reload
```

Esto iniciará el servidor de API en `http://localhost:8000`.

## Scripts Disponibles

En el directorio raíz del proyecto (frontend), puedes ejecutar los siguientes scripts:

*   `npm run dev`: Inicia el servidor de desarrollo de Vite.
*   `npm run build`: Compila la aplicación para producción.
*   `npm run build:dev`: Compila la aplicación en modo de desarrollo.
*   `npm run lint`: Ejecuta ESLint para analizar el código.
*   `npm run preview`: Sirve la compilación de producción localmente.
*   `npm run start`: Alias para `npm run preview`.

## Estructura del Proyecto

```
paper-to-practice-path/
├── backend/         # Lógica del servidor FastAPI (Python)
│   ├── main.py
│   └── requirements.txt
├── public/          # Archivos estáticos
├── src/             # Código fuente del frontend (React, TypeScript)
│   ├── components/  # Componentes de la UI
│   ├── context/     # Contexto de React
│   ├── hooks/       # Hooks personalizados
│   ├── lib/         # Funciones de utilidad, API, etc.
│   ├── pages/       # Componentes de página
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json     # Dependencias y scripts del frontend
├── vite.config.ts   # Configuración de Vite
├── tsconfig.json    # Configuración de TypeScript
└── README.md        # Este archivo
```

## Contribuir

Si deseas contribuir al proyecto, por favor sigue estos pasos:

1.  Haz un fork del repositorio.
2.  Crea una nueva rama (`git checkout -b feature/nueva-funcionalidad`).
3.  Realiza tus cambios y haz commit (`git commit -am 'Añade nueva funcionalidad'`).
4.  Empuja la rama (`git push origin feature/nueva-funcionalidad`).
5.  Abre un Pull Request.
