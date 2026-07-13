# test_imports.py
print("🔍 Test des imports...")

try:
    print("1. Import de sqlalchemy...")
    import sqlalchemy
    print(f"   ✅ SQLAlchemy {sqlalchemy.__version__}")
except ImportError as e:
    print(f"   ❌ {e}")

try:
    print("2. Import de geoalchemy2...")
    import geoalchemy2
    print(f"   ✅ GeoAlchemy2 {geoalchemy2.__version__}")
except ImportError as e:
    print(f"   ❌ {e}")

try:
    print("3. Import de psycopg2...")
    import psycopg2
    print(f"   ✅ psycopg2 {psycopg2.__version__}")
except ImportError as e:
    print(f"   ❌ {e}")

try:
    print("4. Import de app.core.database...")
    from app.core.database import Base, engine, metadata
    print(f"   ✅ Database OK - Tables: {len(Base.metadata.tables)}")
except ImportError as e:
    print(f"   ❌ {e}")

try:
    print("5. Import des modèles...")
    from app.models import User, Booking, MassageType
    print("   ✅ Modèles importés")
except ImportError as e:
    print(f"   ❌ {e}")

print("✅ Test terminé")