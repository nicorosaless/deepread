\
from bson import ObjectId
from fastapi import HTTPException
from pymongo.database import Database as MongoDatabase
from datetime import datetime
from app.core.config import settings

async def deduct_user_credits(
    user_id: ObjectId,
    amount: int,
    reason: str,
    db: MongoDatabase
):
    """
    Deducts credits from a user and logs the transaction.
    Raises HTTPException if user not found or insufficient credits.
    """
    user_data = db[settings.USERS_COLLECTION].find_one({"_id": user_id})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found for credit deduction")
    
    current_credits = user_data.get("credits", 0)
    if current_credits < amount:
        raise HTTPException(status_code=402, detail=f"Insufficient credits. Required: {amount}, Available: {current_credits}")
    
    db[settings.USERS_COLLECTION].update_one(
        {"_id": user_id},
        {"$inc": {"credits": -amount}}
    )
    
    log_entry = {
        "user_id": user_id,
        "amount_deducted": amount,
        "reason": reason,
        "timestamp": datetime.utcnow()
    }
    
    # Ensure CREDIT_LOGS_COLLECTION is configured and exists before attempting to insert
    # This basic check assumes settings.CREDIT_LOGS_COLLECTION is the name of the collection.
    # A more robust check might involve db.list_collection_names() but can be slow.
    if settings.CREDIT_LOGS_COLLECTION:
        try:
            db[settings.CREDIT_LOGS_COLLECTION].insert_one(log_entry)
        except Exception as e:
            print(f"Failed to log credit deduction to {settings.CREDIT_LOGS_COLLECTION}: {e}")
            # Decide if this failure should be critical or just logged
    else:
        print("Credit log collection name not configured in settings. Skipping log.")

    print(f"Deducted {amount} credits from user {user_id}. Reason: {reason}. New balance estimate: {current_credits - amount}")
    # Note: current_credits - amount is an estimate; for exact new balance, a re-fetch or update_one result would be needed.
