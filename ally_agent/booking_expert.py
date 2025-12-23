import uuid


def check_availability(date_str):
    """
    Return available time slots for a given date.
    """
    return ["10:00", "11:00", "14:30"]


def book_appointment(patient_id, date, time):
    """
    Simulate booking an appointment slot.
    """
    booking_id = f"bk_{uuid.uuid4().hex[:12]}"
    return {
        "status": "confirmed",
        "booking_id": booking_id,
        "patient_id": patient_id,
        "date": date,
        "time": time,
    }


def generate_patient_email(patient_name, summary_text, exercises_list):
    """
    Build a professional, empathetic email draft in Danish.
    """
    exercises = "\n".join(f"- {item}" for item in exercises_list) if exercises_list else "- (ingen)"
    subject = f"Opfoelgning efter din session, {patient_name}"
    body = (
        f"Hej {patient_name},\n\n"
        "Tak for en god session i dag. Her er en kort opsummering af det vi arbejdede med:\n"
        f"{summary_text}\n\n"
        "Anbefalede oevelser til den kommende periode:\n"
        f"{exercises}\n\n"
        "Hvis du har spoergsmaal eller behov for justeringer, er du altid velkommen til at skrive.\n"
        "Jeg er her for at stoette dig videre.\n\n"
        "Venlig hilsen\n"
        "Ally"
    )
    return {"subject": subject, "body": body}
