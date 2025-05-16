"""
Script simplificado para iniciar el servidor FastAPI sin dependencias de Google AI.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Importación de routers
from app.api.auth_router import router as auth_router
from app.api.paper_router import router as paper_router
from app.api.chat_router import router as chat_router

from app.core.config import settings
from app.db.database import connect_to_mongo, close_mongo_connection
from app.core.logging import log_error_to_db

# Lifespan manager para iniciar y cerrar conexiones
@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # Startup: Connect to MongoDB
    await connect_to_mongo()
    print("MongoDB connection established")
    
    # No configuramos el cliente de Google AI para evitar ese error
    yield
    
    # Shutdown: Close MongoDB connection
    await close_mongo_connection()
    print("MongoDB connection closed")

app = FastAPI(title="DeepRead API", lifespan=lifespan)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluye los routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(paper_router, prefix="/api/papers", tags=["Paper Processing"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Asegúrate de que estamos en el directorio correcto para encontrar los módulos
    import sys
    project_root = os.path.abspath(os.path.dirname(__file__))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    
    # Inicia el servidor
    uvicorn.run("start:app", host="0.0.0.0", port=8080, reload=True)
