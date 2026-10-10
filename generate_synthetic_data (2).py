"""
Generates synthetic data for the medication tracking schema (see db_setup.py)
and writes it out to CSV files — one per table, with column names matching
the database schema exactly, so they can be loaded straight into Postgres
with COPY, or read with asyncpg/pandas and inserted using the helper
functions from db_setup.py.

Uses only the Python standard library — no pip install needed.
"""

import csv
import random
from datetime import datetime, timedelta, date
from pathlib import Path

random.seed(42)      # remove/change this if you want different data each run

OUTPUT_DIR = Path("synthetic_data")
OUTPUT_DIR.mkdir(exist_ok=True)

# --- Small built-in name pools (stand-in for what Faker would generate) ----

FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
    "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Amara", "Minh", "Kwame", "Priya", "Marcus",
    "Yuki", "Fatima", "Diego", "Aisha", "Noah", "Olivia", "Liam", "Emma", "Sofia", "Mateo",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Patel", "Nguyen", "Osei", "Reed",
    "Shah", "Kim", "Chen", "Khan", "Ibrahim", "Rossi", "Müller", "Dubois",
]

EMAIL_DOMAINS = ["example.com", "mail.com", "sample.org", "test-mail.com"]

AREA_CODES = ["202", "315", "404", "512", "617", "714", "919"]

# --- Config: how much data to generate --------------------------------

NUM_PATIENTS = 25
NUM_DOCTORS = 6
NUM_MEDICATIONS = 15
DAYS_OF_HISTORY = 60          # how far back daily logs / symptoms go
LOGS_PER_PATIENT_PER_DAY_PROB = 0.7   # chance a patient has a log entry on a given day
SYMPTOMS_PER_PATIENT = (0, 6)          # random range of symptom entries per patient
APPOINTMENTS_PER_PATIENT = (1, 4)      # random range of appointments per patient

MEDICATION_CATALOG = [
    ("Lisinopril", "ACE inhibitor", "Blood pressure medication"),
    ("Metformin", "Biguanide", "Type 2 diabetes medication"),
    ("Atorvastatin", "Statin", "Cholesterol-lowering medication"),
    ("Levothyroxine", "Thyroid hormone", "Hypothyroidism treatment"),
    ("Amlodipine", "Calcium channel blocker", "Blood pressure medication"),
    ("Metoprolol", "Beta blocker", "Blood pressure / heart rate medication"),
    ("Albuterol", "Bronchodilator", "Asthma / COPD rescue inhaler"),
    ("Omeprazole", "Proton pump inhibitor", "Acid reflux medication"),
    ("Sertraline", "SSRI", "Antidepressant"),
    ("Gabapentin", "Anticonvulsant", "Nerve pain / seizure medication"),
    ("Hydrochlorothiazide", "Diuretic", "Blood pressure medication"),
    ("Losartan", "ARB", "Blood pressure medication"),
    ("Insulin Glargine", "Long-acting insulin", "Diabetes medication"),
    ("Montelukast", "Leukotriene modifier", "Asthma / allergy medication"),
    ("Escitalopram", "SSRI", "Antidepressant / anxiety medication"),
]

SPECIALTIES = [
    "Family Medicine", "Internal Medicine", "Cardiology", "Endocrinology",
    "Psychiatry", "Pulmonology",
]

SYMPTOM_DESCRIPTIONS = [
    "Mild headache", "Nausea after taking medication", "Dizziness in the morning",
    "Fatigue throughout the day", "Dry cough", "Joint pain", "Trouble sleeping",
    "Upset stomach", "Mild rash on arm", "Shortness of breath after exercise",
    "Muscle cramps", "Loss of appetite",
]


_used_emails = set()


def random_name():
    return random.choice(FIRST_NAMES), random.choice(LAST_NAMES)


def random_email(first_name, last_name):
    base = f"{first_name.lower()}.{last_name.lower()}"
    email = f"{base}@{random.choice(EMAIL_DOMAINS)}"
    suffix = 1
    while email in _used_emails:
        suffix += 1
        email = f"{base}{suffix}@{random.choice(EMAIL_DOMAINS)}"
    _used_emails.add(email)
    return email


def random_phone():
    return f"{random.choice(AREA_CODES)}-{random.randint(100,999):03d}-{random.randint(0,9999):04d}"


def random_date_of_birth(min_age=18, max_age=90):
    today = date.today()
    age = random.randint(min_age, max_age)
    birth_year = today.year - age
    # keep it simple and avoid Feb 29 edge cases
    birth_month = random.randint(1, 12)
    birth_day = random.randint(1, 28)
    return date(birth_year, birth_month, birth_day)


def write_csv(filename, fieldnames, rows):
    path = OUTPUT_DIR / filename
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {path}")


def generate_patients(n):
    rows = []
    for i in range(1, n + 1):
        first, last = random_name()
        rows.append({
            "patient_id": i,
            "first_name": first,
            "last_name": last,
            "date_of_birth": random_date_of_birth(18, 90).isoformat(),
            "contact_email": random_email(first, last),
            "contact_phone": random_phone(),
        })
    return rows


def generate_doctors(n):
    rows = []
    for i in range(1, n + 1):
        first, last = random_name()
        rows.append({
            "doctor_id": i,
            "first_name": first,
            "last_name": last,
            "specialty": random.choice(SPECIALTIES),
        })
    return rows


def generate_medications():
    rows = []
    for i, (name, med_type, desc) in enumerate(MEDICATION_CATALOG, start=1):
        rows.append({
            "medication_id": i,
            "name": name,
            "medication_type": med_type,
            "description": desc,
        })
    return rows


def generate_daily_logs(patients, medications, doctors, days):
    rows = []
    log_id = 1
    today = date.today()
    for patient in patients:
        # each patient is "assigned" 1-3 medications they take regularly
        assigned_meds = random.sample(medications, k=random.randint(1, 3))
        assigned_doctor = random.choice(doctors)
        for day_offset in range(days):
            log_date = today - timedelta(days=day_offset)
            for med in assigned_meds:
                if random.random() > LOGS_PER_PATIENT_PER_DAY_PROB:
                    continue
                taken_at = datetime.combine(
                    log_date,
                    datetime.min.time()
                ) + timedelta(hours=random.randint(6, 22), minutes=random.randint(0, 59))
                rows.append({
                    "id": log_id,
                    "patient_id": patient["patient_id"],
                    "medication_id": med["medication_id"],
                    "doctor_id": assigned_doctor["doctor_id"],
                    "log_date": log_date.isoformat(),
                    "taken_at": taken_at.isoformat(sep=" "),
                    "dosage_mg": random.choice([5, 10, 20, 25, 50, 100]),
                    "feeling_rating": random.randint(1, 5),
                })
                log_id += 1
    return rows


def generate_appointments(patients, doctors):
    rows = []
    appt_id = 1
    today = date.today()
    for patient in patients:
        num_appts = random.randint(*APPOINTMENTS_PER_PATIENT)
        for _ in range(num_appts):
            days_offset = random.randint(-DAYS_OF_HISTORY, 30)  # some past, some upcoming
            appt_time = datetime.combine(
                today + timedelta(days=days_offset),
                datetime.min.time()
            ) + timedelta(hours=random.randint(8, 17))
            rows.append({
                "id": appt_id,
                "patient_id": patient["patient_id"],
                "doctor_id": random.choice(doctors)["doctor_id"],
                "appointment_time": appt_time.isoformat(sep=" "),
                "feeling_rating": random.randint(1, 5),
                "appointment_rating": random.randint(1, 5) if days_offset <= 0 else "",
            })
            appt_id += 1
    return rows


def generate_symptoms(patients, days):
    rows = []
    symptom_id = 1
    today = date.today()
    for patient in patients:
        num_symptoms = random.randint(*SYMPTOMS_PER_PATIENT)
        for _ in range(num_symptoms):
            reported_at = datetime.combine(
                today - timedelta(days=random.randint(0, days)),
                datetime.min.time()
            ) + timedelta(hours=random.randint(6, 22))
            rows.append({
                "id": symptom_id,
                "patient_id": patient["patient_id"],
                "reported_at": reported_at.isoformat(sep=" "),
                "discomfort_level": random.randint(1, 10),
                "description": random.choice(SYMPTOM_DESCRIPTIONS),
            })
            symptom_id += 1
    return rows


def main():
    patients = generate_patients(NUM_PATIENTS)
    doctors = generate_doctors(NUM_DOCTORS)
    medications = generate_medications()
    daily_logs = generate_daily_logs(patients, medications, doctors, DAYS_OF_HISTORY)
    appointments = generate_appointments(patients, doctors)
    symptoms = generate_symptoms(patients, DAYS_OF_HISTORY)

    write_csv("patient.csv",
              ["patient_id", "first_name", "last_name", "date_of_birth", "contact_email", "contact_phone"],
              patients)
    write_csv("doctor.csv",
              ["doctor_id", "first_name", "last_name", "specialty"],
              doctors)
    write_csv("medication.csv",
              ["medication_id", "name", "medication_type", "description"],
              medications)
    write_csv("daily_log.csv",
              ["id", "patient_id", "medication_id", "doctor_id", "log_date", "taken_at", "dosage_mg", "feeling_rating"],
              daily_logs)
    write_csv("appointment.csv",
              ["id", "patient_id", "doctor_id", "appointment_time", "feeling_rating", "appointment_rating"],
              appointments)
    write_csv("symptom.csv",
              ["id", "patient_id", "reported_at", "discomfort_level", "description"],
              symptoms)

    print("\nDone. CSVs are in the 'synthetic_data' folder, ready to load with COPY or asyncpg.")


if __name__ == "__main__":
    main()
