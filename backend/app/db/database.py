
from pymongo import MongoClient
from pymongo.database import Database as MongoDatabase # Renamed to avoid conflict if we name a var 'Database'
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from typing import Optional
import sys

from app.core.config import settings

# Global client and db variables, to be managed by connect/close functions
client: Optional[MongoClient] = None
db: Optional[MongoDatabase] = None

def connect_to_mongo():
    global client, db
    if db is not None: # Already connected
        print("MongoDB connection already established.")
        return

    print(f"Attempting to connect to MongoDB: {settings.MONGO_URI}")
    retries = settings.MAX_DB_CONNECT_RETRIES
    for attempt in range(retries):
        try:
            current_client = MongoClient(
                settings.MONGO_URI,
                serverSelectionTimeoutMS=settings.DB_CONNECT_TIMEOUT_MS,
                socketTimeoutMS=settings.DB_SOCKET_TIMEOUT_MS,
                connectTimeoutMS=settings.DB_CONNECT_TIMEOUT_MS
            )
            # The ismaster command is cheap and does not require auth.
            current_client.admin.command('ismaster') # Check connection
            current_db = current_client[settings.DATABASE_NAME]
            
            client = current_client
            db = current_db
            print(f"Successfully connected to MongoDB database: {settings.DATABASE_NAME}")
            return
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"MongoDB connection attempt {attempt + 1} of {retries} failed: {e}")
            if attempt == retries - 1:
                client = None
                db = None
                print("Failed to connect to MongoDB after multiple retries. Database operations will fail.")
                # Depending on application requirements, you might want to exit or raise an exception here
                # For example: sys.exit("Critical error: Failed to connect to MongoDB.")
                return # Exit after all retries

def close_mongo_connection():
    global client, db
    if client:
        client.close()
        client = None
        db = None # Clear db reference as well
        print("MongoDB connection closed.")

def get_db() -> MongoDatabase:
    """
    Returns the database instance.
    Raises a RuntimeError if the database is not connected.
    This function relies on `connect_to_mongo` being called at application startup.
    """
    global db
    if db is None:
        # Attempt to reconnect if db is None, or handle as critical error
        # For simplicity, we'll assume connect_to_mongo was responsible for the initial connection.
        # If called when db is None, it indicates a problem (e.g., initial connection failed).
        print("Database not initialized. Attempting to connect...")
        connect_to_mongo() # Try to establish connection
        if db is None: # Still None after trying
             raise RuntimeError("Database connection is not available. Check MongoDB server and connection settings.")
    return db

# Optional: A dependency for FastAPI routes to get DB
# async def get_database_dependency() -> MongoDatabase:
#     return get_db()
