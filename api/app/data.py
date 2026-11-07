"""Seed / fallback data used when Postgres isn't connected yet.

NOTE: MDC program names are placeholders. Verify against the MDC catalog
before the demo and move this into the database (see db/schema.sql).
"""

TRAITS = ["creative", "technical", "hands_on", "people", "analytical", "protective"]

# Plain-language meaning of each trait, used in Gemini prompts and embedding text.
TRAIT_DESCRIPTIONS = {
    "creative": "imaginative, enjoys designing and making things look or feel good",
    "technical": "curious about how machines, software and systems work",
    "hands_on": "likes physical, practical work with tools, materials or food",
    "people": "energized by working with, helping or leading other people",
    "analytical": "enjoys math, logic, puzzles and careful problem solving",
    "protective": "motivated by keeping people, systems and data safe",
}

# Each field has a trait profile (0..1). The quiz scores the student against these.
FIELDS: dict[str, dict] = {
    "architecture": {
        "name": "Architecture",
        "profile": {"creative": 1.0, "technical": 0.6, "hands_on": 0.4, "people": 0.3, "analytical": 0.6, "protective": 0.1},
    },
    "mechanical-engineering": {
        "name": "Mechanical Engineering",
        "profile": {"creative": 0.5, "technical": 1.0, "hands_on": 0.8, "people": 0.2, "analytical": 0.9, "protective": 0.1},
    },
    "culinary-arts": {
        "name": "Culinary Arts",
        "profile": {"creative": 0.9, "technical": 0.2, "hands_on": 1.0, "people": 0.7, "analytical": 0.2, "protective": 0.1},
    },
    "cybersecurity": {
        "name": "Cybersecurity",
        "profile": {"creative": 0.3, "technical": 1.0, "hands_on": 0.3, "people": 0.2, "analytical": 0.9, "protective": 1.0},
    },
    "it-consulting": {
        "name": "IT Consulting",
        "profile": {"creative": 0.4, "technical": 0.8, "hands_on": 0.2, "people": 1.0, "analytical": 0.7, "protective": 0.3},
    },
}

MAJORS = [
    {"slug": "architecture", "name": "Architecture", "field": "Design & Construction",
     "mdc_program": "A.A. Architecture (transfer track)",
     "summary": "Design buildings and spaces, from sketches to construction documents."},
    {"slug": "mechanical-engineering", "name": "Mechanical Engineering", "field": "Engineering",
     "mdc_program": "A.A. Engineering (transfer track)",
     "summary": "Design machines, engines, and systems that move and make things."},
    {"slug": "culinary-arts", "name": "Culinary Arts", "field": "Hospitality",
     "mdc_program": "A.S. Culinary Arts Management",
     "summary": "Train as a professional chef and learn kitchen operations."},
    {"slug": "cybersecurity", "name": "Cybersecurity", "field": "Computer & IT",
     "mdc_program": "A.S. / B.A.S. Cybersecurity",
     "summary": "Protect networks and data from attackers."},
    {"slug": "it-consulting", "name": "IT Consulting", "field": "Computer & IT",
     "mdc_program": "A.S. Computer Information Technology",
     "summary": "Help organizations choose and run the right technology."},
]

# Each option adds trait weights to the student's profile.
QUESTIONS = [
    {"id": "q_weekend", "text": "Free Saturday. What sounds best?", "options": [
        {"label": "Sketching or designing something", "traits": {"creative": 1.0}},
        {"label": "Taking apart a gadget to see how it works", "traits": {"technical": 0.7, "hands_on": 0.8}},
        {"label": "Cooking for friends", "traits": {"hands_on": 0.8, "people": 0.6, "creative": 0.4}},
        {"label": "Solving a puzzle or CTF challenge", "traits": {"analytical": 0.8, "protective": 0.5}},
    ]},
    {"id": "q_team", "text": "In a group project you usually...", "options": [
        {"label": "Lead and present", "traits": {"people": 1.0}},
        {"label": "Build the actual thing", "traits": {"hands_on": 0.8, "technical": 0.4}},
        {"label": "Make it look good", "traits": {"creative": 0.9}},
        {"label": "Find the flaws before anyone else does", "traits": {"analytical": 0.7, "protective": 0.7}},
    ]},
    {"id": "q_math", "text": "How do you feel about math and physics?", "options": [
        {"label": "Love it", "traits": {"analytical": 1.0, "technical": 0.6}},
        {"label": "Fine if it's applied to something real", "traits": {"technical": 0.5, "hands_on": 0.3}},
        {"label": "I'd rather avoid it", "traits": {"creative": 0.4, "people": 0.4}},
    ]},
    {"id": "q_workspace", "text": "Your ideal workspace?", "options": [
        {"label": "A studio with drafting tables", "traits": {"creative": 0.8, "technical": 0.3}},
        {"label": "A workshop or lab", "traits": {"hands_on": 0.9, "technical": 0.6}},
        {"label": "A busy kitchen", "traits": {"hands_on": 1.0, "people": 0.5}},
        {"label": "Client offices, different every week", "traits": {"people": 1.0, "technical": 0.3}},
        {"label": "A security operations center", "traits": {"protective": 1.0, "technical": 0.5}},
    ]},
    {"id": "q_impact", "text": "What kind of impact matters most to you?", "options": [
        {"label": "Creating places people love", "traits": {"creative": 0.8}},
        {"label": "Building things that work better", "traits": {"technical": 0.8, "analytical": 0.4}},
        {"label": "Making people happy directly", "traits": {"people": 0.9}},
        {"label": "Keeping people and data safe", "traits": {"protective": 1.0}},
    ]},
]

# Static fallback roadmap used when Swarms/Gemini keys aren't configured.
def fallback_roadmap(slug: str, career: str, mdc_program: str) -> dict:
    return {
        "career": career,
        "summary": f"A sample pathway to {career}, starting at Miami Dade College. (Static fallback data.)",
        "generated_by": "fallback (no SWARMS_API_KEY)",
        "steps": [
            {"id": "s1", "stage": "mdc", "title": "Enroll at MDC", "detail": mdc_program, "duration": "Semester 1", "depends_on": []},
            {"id": "s2", "stage": "mdc", "title": "Core + gateway courses", "detail": "Gen-ed and intro major courses", "duration": "Semesters 1-2", "depends_on": ["s1"]},
            {"id": "s3", "stage": "mdc", "title": "Finish associate degree", "detail": "Complete program requirements", "duration": "Semesters 3-4", "depends_on": ["s2"]},
            {"id": "s4", "stage": "certification", "title": "Industry certification / internship", "detail": "Build experience", "duration": "Summer", "depends_on": ["s2"]},
            {"id": "s5", "stage": "transfer", "title": "Transfer or bachelor's", "detail": "Bachelor's at MDC or a 2+2 partner (e.g. FIU)", "duration": "2 years", "depends_on": ["s3"]},
            {"id": "s6", "stage": "career", "title": f"Entry-level {career} role", "detail": "First job in the field", "duration": "After graduation", "depends_on": ["s4", "s5"]},
        ],
    }
