"""
Database setup and insert helpers for the medication tracking app.
Uses asyncpg to connect to your Tiger Data (TimescaleDB) instance.

Table layout
------------
Regular tables (reference data, small, rarely change):
    patient, doctor, medication

Hypertables (time-series data, grow every day, queried by time range):
    daily_log    partitioned by taken_at
    symptom      partitioned by reported_at
    appointment  partitioned by appointment_time

Your connection string is read from the TIGER_DATA_URL environment
variable (put it in a local .env file, which should never be committed).
"""

import asyncio
import csv
import os
from datetime import date, datetime, timedelta
from pathlib import Path

import asyncpg

try:
    from dotenv import load_dotenv  # pip install python-dotenv
    load_dotenv()
except ImportError:
    pass  # fine if you set TIGER_DATA_URL another way

# --- Connection ---------------------------------------------------------

CONNECTION = os.environ.get(
    "TIGER_DATA_URL",
    "postgres://tsdbadmin:<password>@<host>:<port>/tsdb?sslmode=require",
)

# Set to True ONCE if you already created the old (non-hypertable) versions
# of these tables. It drops all six tables and their data, then rebuilds
# them. Set it back to False afterwards.
RESET_TABLES = False

# How much time each hypertable chunk covers. A month is a sensible size
# for an app with modest data volume; shrink it if you get very busy.
CHUNK_INTERVAL = "1 month"


# --- Schema ---------------------------------------------------------------
# Hypertable rule: any primary key or unique constraint must include the
# time column. That's why the time-series tables use PRIMARY KEY (id, <time>)
# instead of just PRIMARY KEY (id). The id is still unique on its own in
# practice, because SERIAL hands out a new number every time.

CREATE_TABLES_SQL = f"""
-- Regular tables ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS patient (
    patient_id      SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    date_of_birth   DATE,
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS doctor (
    doctor_id       SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    specialty       VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS medication (
    medication_id   SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    medication_type VARCHAR(100),
    description     TEXT
);

-- Time-series tables (converted to hypertables below) -------------------

CREATE TABLE IF NOT EXISTS daily_log (
    id              SERIAL,
    patient_id      INTEGER NOT NULL REFERENCES patient(patient_id),
    medication_id   INTEGER NOT NULL REFERENCES medication(medication_id),
    doctor_id       INTEGER REFERENCES doctor(doctor_id),
    log_date        DATE NOT NULL,
    taken_at        TIMESTAMP NOT NULL,
    dosage_mg       NUMERIC NOT NULL,
    feeling_rating  INTEGER CHECK (feeling_rating BETWEEN 1 AND 5),
    PRIMARY KEY (id, taken_at)
);

CREATE TABLE IF NOT EXISTS appointment (
    id                  SERIAL,
    patient_id          INTEGER NOT NULL REFERENCES patient(patient_id),
    doctor_id           INTEGER REFERENCES doctor(doctor_id),
    appointment_time    TIMESTAMP NOT NULL,
    feeling_rating      INTEGER CHECK (feeling_rating BETWEEN 1 AND 5),
    appointment_rating  INTEGER CHECK (appointment_rating BETWEEN 1 AND 5),
    PRIMARY KEY (id, appointment_time)
);

CREATE TABLE IF NOT EXISTS symptom (
    id                SERIAL,
    patient_id        INTEGER NOT NULL REFERENCES patient(patient_id),
    reported_at       TIMESTAMP NOT NULL DEFAULT now(),
    discomfort_level  INTEGER CHECK (discomfort_level BETWEEN 1 AND 10),
    description       TEXT,
    PRIMARY KEY (id, reported_at)
);
"""

# (table, time column) for every hypertable
HYPERTABLES = [
    ("daily_log", "taken_at"),
    ("symptom", "reported_at"),
    ("appointment", "appointment_time"),
]

# Indexes for the app's main question: "show me this patient's records
# over a time range". Hypertables already index the time column itself.
CREATE_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS daily_log_patient_time_idx   ON daily_log   (patient_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS symptom_patient_time_idx     ON symptom     (patient_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS appointment_patient_time_idx ON appointment (patient_id, appointment_time DESC);
"""


async def reset_tables(conn: asyncpg.Connection) -> None:
    """Drops every table (and all its data). Only for development."""
    await conn.execute("""
        DROP TABLE IF EXISTS symptom, appointment, daily_log,
                             medication, doctor, patient CASCADE;
    """)
    print("Dropped existing tables.")


async def create_tables(conn: asyncpg.Connection) -> None:
    await conn.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
    await conn.execute(CREATE_TABLES_SQL)

    for table, time_col in HYPERTABLES:
        await conn.execute(
            f"SELECT create_hypertable('{table}', "
            f"by_range('{time_col}', INTERVAL '{CHUNK_INTERVAL}'), "
            f"if_not_exists => TRUE);"
        )

    await conn.execute(CREATE_INDEXES_SQL)
    print("Tables created (or already existed); hypertables set up.")


# --- Insert helpers -------------------------------------------------------

async def add_patient(
    conn: asyncpg.Connection,
    first_name: str,
    last_name: str,
    date_of_birth: date | None = None,
    contact_email: str | None = None,
    contact_phone: str | None = None,
) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO patient (first_name, last_name, date_of_birth, contact_email, contact_phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING patient_id
        """,
        first_name, last_name, date_of_birth, contact_email, contact_phone,
    )
    return row["patient_id"]


async def add_doctor(
    conn: asyncpg.Connection,
    first_name: str,
    last_name: str,
    specialty: str | None = None,
) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO doctor (first_name, last_name, specialty)
        VALUES ($1, $2, $3)
        RETURNING doctor_id
        """,
        first_name, last_name, specialty,
    )
    return row["doctor_id"]


async def add_medication(
    conn: asyncpg.Connection,
    name: str,
    medication_type: str | None = None,
    description: str | None = None,
) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO medication (name, medication_type, description)
        VALUES ($1, $2, $3)
        RETURNING medication_id
        """,
        name, medication_type, description,
    )
    return row["medication_id"]


async def add_daily_log(
    conn: asyncpg.Connection,
    patient_id: int,
    medication_id: int,
    taken_at: datetime,
    dosage_mg: float,
    feeling_rating: int | None = None,
    doctor_id: int | None = None,
) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO daily_log (patient_id, medication_id, doctor_id, log_date, taken_at, dosage_mg, feeling_rating)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        """,
        patient_id, medication_id, doctor_id, taken_at.date(), taken_at, dosage_mg, feeling_rating,
    )
    return row["id"]


async def add_appointment(
    conn: asyncpg.Connection,
    patient_id: int,
    appointment_time: datetime,
    doctor_id: int | None = None,
    feeling_rating: int | None = None,
    appointment_rating: int | None = None,
) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO appointment (patient_id, doctor_id, appointment_time, feeling_rating, appointment_rating)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
        patient_id, doctor_id, appointment_time, feeling_rating, appointment_rating,
    )
    return row["id"]


async def add_symptom(
    conn: asyncpg.Connection,
    patient_id: int,
    discomfort_level: int,
    description: str,
    reported_at: datetime | None = None,
) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO symptom (patient_id, reported_at, discomfort_level, description)
        VALUES ($1, COALESCE($2, now()), $3, $4)
        RETURNING id
        """,
        patient_id, reported_at, discomfort_level, description,
    )
    return row["id"]


# --- Bulk load from CSV -----------------------------------------------
# Reads the CSVs produced by generate_synthetic_data.py. Loaded in
# dependency order: patient/doctor/medication first, then the hypertables
# that reference them.

CSV_DIR = Path("synthetic_data")


def _read_csv(filename: str):
    with open(CSV_DIR / filename, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _int_or_none(value):
    return int(value) if value not in (None, "") else None


def _date_or_none(value):
    # asyncpg needs real date objects, not "2026-10-10" strings
    return date.fromisoformat(value) if value else None


def _datetime_or_none(value):
    return datetime.fromisoformat(value) if value else None


async def load_patients_from_csv(conn: asyncpg.Connection) -> int:
    records = [
        (int(r["patient_id"]), r["first_name"], r["last_name"],
         _date_or_none(r["date_of_birth"]), r["contact_email"] or None, r["contact_phone"] or None)
        for r in _read_csv("patient.csv")
    ]
    await conn.executemany(
        """
        INSERT INTO patient (patient_id, first_name, last_name, date_of_birth, contact_email, contact_phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (patient_id) DO NOTHING
        """,
        records,
    )
    return len(records)


async def load_doctors_from_csv(conn: asyncpg.Connection) -> int:
    records = [
        (int(r["doctor_id"]), r["first_name"], r["last_name"], r["specialty"] or None)
        for r in _read_csv("doctor.csv")
    ]
    await conn.executemany(
        """
        INSERT INTO doctor (doctor_id, first_name, last_name, specialty)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (doctor_id) DO NOTHING
        """,
        records,
    )
    return len(records)


async def load_medications_from_csv(conn: asyncpg.Connection) -> int:
    records = [
        (int(r["medication_id"]), r["name"], r["medication_type"] or None, r["description"] or None)
        for r in _read_csv("medication.csv")
    ]
    await conn.executemany(
        """
        INSERT INTO medication (medication_id, name, medication_type, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (medication_id) DO NOTHING
        """,
        records,
    )
    return len(records)


async def load_daily_logs_from_csv(conn: asyncpg.Connection) -> int:
    records = [
        (int(r["id"]), int(r["patient_id"]), int(r["medication_id"]),
         _int_or_none(r["doctor_id"]), _date_or_none(r["log_date"]),
         _datetime_or_none(r["taken_at"]), float(r["dosage_mg"]),
         _int_or_none(r["feeling_rating"]))
        for r in _read_csv("daily_log.csv")
    ]
    await conn.executemany(
        """
        INSERT INTO daily_log (id, patient_id, medication_id, doctor_id, log_date, taken_at, dosage_mg, feeling_rating)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id, taken_at) DO NOTHING
        """,
        records,
    )
    return len(records)


async def load_appointments_from_csv(conn: asyncpg.Connection) -> int:
    records = [
        (int(r["id"]), int(r["patient_id"]), _int_or_none(r["doctor_id"]),
         _datetime_or_none(r["appointment_time"]), _int_or_none(r["feeling_rating"]),
         _int_or_none(r["appointment_rating"]))
        for r in _read_csv("appointment.csv")
    ]
    await conn.executemany(
        """
        INSERT INTO appointment (id, patient_id, doctor_id, appointment_time, feeling_rating, appointment_rating)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id, appointment_time) DO NOTHING
        """,
        records,
    )
    return len(records)


async def load_symptoms_from_csv(conn: asyncpg.Connection) -> int:
    records = [
        (int(r["id"]), int(r["patient_id"]), _datetime_or_none(r["reported_at"]),
         _int_or_none(r["discomfort_level"]), r["description"] or None)
        for r in _read_csv("symptom.csv")
    ]
    await conn.executemany(
        """
        INSERT INTO symptom (id, patient_id, reported_at, discomfort_level, description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id, reported_at) DO NOTHING
        """,
        records,
    )
    return len(records)


async def load_all_csv_data(conn: asyncpg.Connection) -> None:
    """Loads all six CSVs in dependency order."""
    print(f"Loaded {await load_patients_from_csv(conn)} patients.")
    print(f"Loaded {await load_doctors_from_csv(conn)} doctors.")
    print(f"Loaded {await load_medications_from_csv(conn)} medications.")
    print(f"Loaded {await load_daily_logs_from_csv(conn)} daily log entries.")
    print(f"Loaded {await load_appointments_from_csv(conn)} appointments.")
    print(f"Loaded {await load_symptoms_from_csv(conn)} symptoms.")

    # The CSV rows came with their own ids, so move each SERIAL counter
    # past the highest id. Otherwise the next add_*() call would reuse one.
    for table, id_col in [
        ("patient", "patient_id"), ("doctor", "doctor_id"), ("medication", "medication_id"),
        ("daily_log", "id"), ("appointment", "id"), ("symptom", "id"),
    ]:
        await conn.execute(
            f"SELECT setval(pg_get_serial_sequence('{table}', '{id_col}'), "
            f"COALESCE((SELECT MAX({id_col}) FROM {table}), 1))"
        )


# --- Checks -----------------------------------------------------------------

async def verify_setup(conn: asyncpg.Connection) -> None:
    """Prints row counts and confirms which tables are hypertables."""
    print("\nRow counts:")
    for table in ["patient", "doctor", "medication", "daily_log", "appointment", "symptom"]:
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
        print(f"  {table}: {count}")

    rows = await conn.fetch(
        "SELECT hypertable_name, num_chunks FROM timescaledb_information.hypertables "
        "ORDER BY hypertable_name"
    )
    print("\nHypertables:")
    for r in rows:
        print(f"  {r['hypertable_name']} ({r['num_chunks']} chunks)")


# --- Main ---------------------------------------------------------------------

async def main():
    conn = await asyncpg.connect(CONNECTION)
    try:
        if RESET_TABLES:
            await reset_tables(conn)

        await create_tables(conn)

        # Option A: bulk-load the synthetic CSVs
        # (run generate_synthetic_data.py first so 'synthetic_data/' exists)
        # await load_all_csv_data(conn)

        # Option B: hand-written sample data ---------------------------------
        dr_patel = await add_doctor(conn, "Amara", "Patel", "Family Medicine")
        dr_nguyen = await add_doctor(conn, "Minh", "Nguyen", "Cardiology")
        dr_osei = await add_doctor(conn, "Kwame", "Osei", "Endocrinology")

        lisinopril = await add_medication(conn, "Lisinopril", "ACE inhibitor", "Blood pressure medication")
        metformin = await add_medication(conn, "Metformin", "Biguanide", "Type 2 diabetes medication")
        atorvastatin = await add_medication(conn, "Atorvastatin", "Statin", "Cholesterol-lowering medication")
        sertraline = await add_medication(conn, "Sertraline", "SSRI", "Antidepressant")

        jane = await add_patient(conn, "Jane", "Doe", date(1998, 4, 12),
                                 "jane.doe@example.com", "555-010-1234")
        marcus = await add_patient(conn, "Marcus", "Reed", date(1975, 11, 2),
                                   "marcus.reed@example.com", "555-010-5678")
        priya = await add_patient(conn, "Priya", "Shah", date(1990, 7, 19),
                                  "priya.shah@example.com", "555-010-9012")

        now = datetime.now()

        await add_daily_log(conn, jane, lisinopril, now - timedelta(days=2, hours=1), 10, 4, dr_patel)
        await add_daily_log(conn, jane, lisinopril, now - timedelta(days=1, hours=1), 10, 4, dr_patel)
        await add_daily_log(conn, jane, lisinopril, now, 10, 5, dr_patel)
        await add_daily_log(conn, marcus, metformin, now - timedelta(days=1, hours=3), 500, 3, dr_osei)
        await add_daily_log(conn, marcus, atorvastatin, now - timedelta(hours=5), 20, 4, dr_nguyen)
        await add_daily_log(conn, priya, sertraline, now - timedelta(days=3, hours=2), 50, 4, dr_patel)
        await add_daily_log(conn, priya, sertraline, now, 50, 5, dr_patel)

        await add_appointment(conn, jane, now - timedelta(days=14), dr_patel, 4, 5)
        await add_appointment(conn, marcus, now - timedelta(days=7), dr_osei, 3, 4)
        await add_appointment(conn, priya, now + timedelta(days=5), dr_patel)  # upcoming, no ratings yet

        await add_symptom(conn, jane, 2, "Mild headache in the afternoon")
        await add_symptom(conn, marcus, 5, "Nausea about an hour after taking metformin")
        await add_symptom(conn, priya, 3, "Trouble sleeping for the past few nights")

        print("Sample data inserted.")
        await verify_setup(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
