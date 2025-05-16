# backend/app/core/logging.py
from pymongo.database import Database as MongoDatabase
from app.core.config import settings
from app.db.database import get_db # To get a DB instance

def log_error_to_db(error_log: dict, db: MongoDatabase = None):
    """
    Logs an error dictionary to the specified MongoDB collection.
    If db is not provided, it will attempt to get a new database instance.
    """
    db_instance = db
    if db_instance is None:
        try:
            db_instance = get_db()
        except RuntimeError as e:
            print(f"Failed to get DB for logging (RuntimeError): {e}")
            # Fallback to just printing the error if DB connection fails
            print(f"Error to log (DB unavailable): {error_log}")
            return
        except Exception as e:
            print(f"Failed to get DB for logging (Exception): {e}")
            print(f"Error to log (DB unavailable): {error_log}")
            return

    try:
        if db_instance is not None and settings.ERRORS_LOG_COLLECTION:
            if settings.ERRORS_LOG_COLLECTION in db_instance.list_collection_names():
                db_instance[settings.ERRORS_LOG_COLLECTION].insert_one(error_log)
            else:
                # Collection doesn't exist, try to create it or log warning
                # For simplicity, we'll assume it should exist or log a warning
                print(f"Warning: Errors log collection '{settings.ERRORS_LOG_COLLECTION}' not found. Attempting to log anyway.")
                # Depending on MongoDB setup, insert_one might create the collection.
                db_instance[settings.ERRORS_LOG_COLLECTION].insert_one(error_log)
        elif not settings.ERRORS_LOG_COLLECTION:
            print("Error logging to DB skipped: ERRORS_LOG_COLLECTION not configured in settings.")
            print(f"Error details: {error_log}")
        else: # db_instance is None even after trying get_db()
            print(f"Database not available for error logging. Error details: {error_log}")

    except Exception as e:
        print(f"Failed to log error to DB: {e}")
        # Fallback to printing the original error if logging fails
        print(f"Original error details: {error_log}")

