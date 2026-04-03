from fastapi import FastAPI, Depends, Header, HTTPException
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional


# --- 1. DATABASE SETUP (SQLite for testing) ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./pos.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- 2. SQL DATABASE MODELS ---
class MenuItemDB(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, index=True) # For multi-tenancy later!
    name = Column(String, index=True)
    image_url = Column(String, nullable=True)
    emoji = Column(String, nullable=True)
    price = Column(Float)
    cat = Column(String) # Category
    desc = Column(String)
    tag = Column(String, nullable=True)
    spicy = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True) # For soft deletion

# Create the tables in the database
Base.metadata.create_all(bind=engine)

# --- 3. PYDANTIC MODELS (For API Responses) ---
class MenuItem(BaseModel):
    id: int
    restaurant_id: int
    name: str
    image_url: Optional[str] = None
    emoji: Optional[str] = None
    price: float
    cat: str
    desc: str
    tag: Optional[str] = None
    spicy: bool

    class Config:
        from_attributes = True

class MenuItemCreate(BaseModel):
    restaurant_id: int
    name: str
    image_url: Optional[str] = None
    emoji: Optional[str] = None
    price: float
    cat: str
    desc: str
    tag: Optional[str] = None
    spicy: bool = False

# --- 4. FASTAPI APP ---
# --- 4. FASTAPI APP ---
app = FastAPI(title="StreetBite POS API")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # Allows your local HTML file to connect
    allow_credentials=True, # <-- Changed this to False!
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---------------------------------
# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- THE BOUNCER (Security) ---
def verify_admin(x_api_key: str = Header(None)):
    """Checks if the user has the secret password."""
    if x_api_key != "streetbite2026": # <-- Your secret password!
        raise HTTPException(status_code=401, detail="Unauthorized. Wrong Password.")
    
# --- 5. API ENDPOINTS ---

@app.get("/api/menu/{restaurant_id}", response_model=List[MenuItem])
def get_menu(restaurant_id: int, db: Session = Depends(get_db)):
    """Fetch the active menu for the POS."""
    # Notice we added MenuItemDB.is_active == True to the filter!
    items = db.query(MenuItemDB).filter(
        MenuItemDB.restaurant_id == restaurant_id, 
        MenuItemDB.is_active == True
    ).all()
    return items

@app.post("/api/menu/", response_model=MenuItem, dependencies=[Depends(verify_admin)])
def create_menu_item(item: MenuItemCreate, db: Session = Depends(get_db)):
    """Add a new item (Requires Password)"""
    db_item = MenuItemDB(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/api/menu/{item_id}", dependencies=[Depends(verify_admin)])
def delete_menu_item(item_id: int, db: Session = Depends(get_db)):
    """Soft Delete an item (Requires Password)"""
    item = db.query(MenuItemDB).filter(MenuItemDB.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # SOFT DELETE: We just flip the switch!
    item.is_active = False 
    db.commit()
    
    return {"message": "Item securely archived"}

# --- 6. SEED DATA (Runs on startup) ---
@app.on_event("startup")
def seed_database():
    """Automatically adds your menu to the DB if it's empty."""
    db = SessionLocal()
    if db.query(MenuItemDB).count() == 0:
        print("Database is empty. Populating with starter menu...")
        # Your starter data, assigned to restaurant_id 1
        starter_items = [
            MenuItemDB(restaurant_id=1, name="Biryani", image_url="./images/Biryani.jpg", price=199, cat="Burgers", desc="Double smash patty, American cheese...", tag="BESTSELLER", spicy=False),
            MenuItemDB(restaurant_id=1, name="Spicy Crispy Chicken", emoji="🍗", price=10.49, cat="Burgers", desc="Fried thigh, Nashville hot sauce...", tag="SPICY", spicy=True),
            MenuItemDB(restaurant_id=1, name="Street Tacos (x3)", emoji="🌮", price=8.99, cat="Tacos", desc="Braised beef, pico de gallo...", tag="NEW", spicy=False),
            # You can add the rest of the array here!
            #in image_url or emoji we can change the photo
        ]
        db.add_all(starter_items)
        db.commit()
    db.close()