import re
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config import settings

DATABASE_URL = settings.database_url

# Render does not support IPv6 outbound. If a direct Supabase host is passed,
# automatically rewrite to Supabase IPv4 Pooler (Session mode on port 5432)
# so the application connects cleanly over IPv4 without "Network is unreachable".
supabase_direct_pattern = r"@db\.([a-zA-Z0-9]+)\.supabase\.co(?::5432)?"
match = re.search(supabase_direct_pattern, DATABASE_URL)
if match:
    project_ref = match.group(1)
    region = "eu-west-1" if project_ref == "yutenmwnirotmdjhhtdr" else "ap-south-1"
    DATABASE_URL = re.sub(
        r"://([^:]+):",
        lambda m: f"://{m.group(1)}.{project_ref}:" if not m.group(1).endswith(f".{project_ref}") else f"://{m.group(1)}:",
        DATABASE_URL,
        count=1,
    )
    DATABASE_URL = re.sub(
        supabase_direct_pattern,
        f"@aws-0-{region}.pooler.supabase.com:5432",
        DATABASE_URL,
    )

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
