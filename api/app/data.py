"""Seed / fallback data used when Postgres isn't connected yet.

MDC programs were checked on 2026-11-07 against:
- MDC Academic Program Inventory (revised 2025-09-16), for every A.S., B.S. and B.A.S.:
  https://www.mdc.edu/academics/documents/academic-programs-cip.pdf
- A.A. pathway pages, since the inventory lists the A.A. as a single degree:
  Architecture (10200) https://www.mdc.edu/architectureaa/
  Engineering-Mechanical (10911) https://www.mdc.edu/academics/programs/ps/10911.pdf
  Psychology (12001) https://www.mdc.edu/psychology/
Re-check before the demo; MDC revises programs every term.
"""

TRAITS = [
    "creative", "technical", "hands_on", "people", "analytical", "protective",
    "caring", "scientific", "enterprising", "organized", "expressive",
]

# Plain-language meaning of each trait, used in Gemini prompts and embedding text.
TRAIT_DESCRIPTIONS = {
    "creative": "imaginative, enjoys designing and making things look or feel good",
    "technical": "curious about how machines, software and systems work",
    "hands_on": "likes physical, practical work with tools, materials or food",
    "people": "energized by working with, talking to and collaborating with other people",
    "analytical": "enjoys math, logic, puzzles and careful problem solving",
    "protective": "motivated by keeping people, systems and data safe",
    "caring": "wants to help people heal, learn and grow; patient and empathetic",
    "scientific": "fascinated by how living things and nature work; likes experiments",
    "enterprising": "drawn to business, leading, persuading and making deals",
    "organized": "detail-oriented, likes structure, accuracy, schedules and records",
    "expressive": "loves storytelling, presenting, performing or explaining to an audience",
}


def _p(cr, te, ho, pe, an, pr, ca, sc, en, org, ex) -> dict[str, float]:
    """Trait profile in TRAITS order, so the table below stays readable."""
    return dict(zip(TRAITS, (cr, te, ho, pe, an, pr, ca, sc, en, org, ex)))


# Each field has a trait profile (0..1). The quiz scores the student against these.
#                                       cre  tec  hnd  ppl  ana  pro  car  sci  ent  org  exp
FIELDS: dict[str, dict] = {
    "architecture":            {"name": "Architecture",            "profile": _p(1.0, .6, .5, .3, .6, .1, .1, .2, .3, .6, .5)},
    "mechanical-engineering":  {"name": "Mechanical Engineering",  "profile": _p(.5, 1.0, .8, .2, .9, .1, .1, .6, .2, .5, .1)},
    "culinary-arts":           {"name": "Culinary Arts",           "profile": _p(.9, .2, 1.0, .6, .2, .1, .5, .2, .5, .5, .4)},
    "cybersecurity":           {"name": "Cybersecurity",           "profile": _p(.3, 1.0, .3, .2, .9, 1.0, .1, .3, .1, .6, .1)},
    "it-consulting":           {"name": "IT Consulting",           "profile": _p(.3, .8, .3, 1.0, .6, .3, .3, .1, .7, .5, .5)},
    "nursing":                 {"name": "Nursing",                 "profile": _p(.1, .3, .8, .8, .4, .6, 1.0, .8, .1, .6, .2)},
    "business-administration": {"name": "Business Administration", "profile": _p(.3, .2, .1, .9, .5, .1, .2, .1, 1.0, .6, .6)},
    "accounting":              {"name": "Accounting",              "profile": _p(.1, .3, .1, .3, .9, .3, .1, .1, .5, 1.0, .1)},
    "psychology":              {"name": "Psychology",              "profile": _p(.3, .1, .1, .9, .7, .3, .8, .9, .1, .3, .3)},
    "biological-sciences":     {"name": "Biological Sciences",     "profile": _p(.2, .4, .6, .2, .7, .2, .4, 1.0, .1, .6, .1)},
    "criminal-justice":        {"name": "Criminal Justice",        "profile": _p(.1, .2, .6, .6, .5, 1.0, .5, .3, .2, .6, .3)},
    "software-development":    {"name": "Software Development",    "profile": _p(.6, 1.0, .2, .2, .9, .2, .1, .3, .3, .5, .2)},
    "education":               {"name": "Education",               "profile": _p(.5, .1, .3, .9, .2, .3, .9, .1, .1, .6, 1.0)},
    "graphic-design":          {"name": "Graphic Design",          "profile": _p(1.0, .5, .4, .3, .2, .0, .1, .0, .4, .4, .8)},
    "film-tv-production":      {"name": "Film & TV Production",    "profile": _p(.9, .5, .7, .7, .1, .0, .1, .0, .4, .3, 1.0)},
}

MAJORS = [
    {"slug": "architecture", "name": "Architecture", "field": "Design & Construction",
     "mdc_program": "A.A. pathway to Architecture (10200), then transfer to a bachelor's/master's in architecture",
     "mdc_url": "https://www.mdc.edu/architectureaa/",
     "summary": "Design buildings and spaces, from sketches to construction documents."},
    {"slug": "mechanical-engineering", "name": "Mechanical Engineering", "field": "Engineering",
     "mdc_program": "A.A. pathway to Engineering-Mechanical (10911), then transfer (e.g. FIU)",
     "mdc_url": "https://www.mdc.edu/academics/programs/csg/AA_Engineering-Mechanical_csg.pdf",
     "summary": "Design machines, engines, and systems that move and make things."},
    {"slug": "culinary-arts", "name": "Culinary Arts", "field": "Hospitality",
     "mdc_program": "A.S. Culinary Arts Management",
     "mdc_url": "https://www.mdc.edu/culinaryartsmanagement/",
     "summary": "Train as a professional chef and learn to run a kitchen and food business."},
    {"slug": "cybersecurity", "name": "Cybersecurity", "field": "Computer & IT",
     "mdc_program": "A.S. Cybersecurity, then B.S. Cybersecurity at MDC",
     "mdc_url": "https://www.mdc.edu/cybersecuritybs/",
     "summary": "Protect networks, systems and data from attackers."},
    {"slug": "it-consulting", "name": "IT Consulting", "field": "Computer & IT",
     "mdc_program": "A.S. Computer Information Technology, then B.S. Information Systems Technology at MDC",
     "mdc_url": "https://www.mdc.edu/informationsystems/",
     "summary": "Help organizations choose, set up and run the right technology."},
    {"slug": "nursing", "name": "Nursing", "field": "Health Sciences",
     "mdc_program": "A.S. Nursing (R.N.), then B.S. in Nursing (RN to BSN) at MDC",
     "mdc_url": "https://www.mdc.edu/bsn/",
     "summary": "Care for patients as a registered nurse in hospitals, clinics and communities."},
    {"slug": "business-administration", "name": "Business Administration", "field": "Business",
     "mdc_program": "A.S. Business Administration, then B.A.S. Leadership and Management Innovation at MDC",
     "mdc_url": "https://www.mdc.edu/leadershipandmanagementinnovation/",
     "summary": "Lead teams, manage operations and grow organizations or your own company."},
    {"slug": "accounting", "name": "Accounting", "field": "Business",
     "mdc_program": "A.S. Accounting Technology, then B.A.S. Leadership and Management Innovation - Accounting at MDC",
     "mdc_url": "https://www.mdc.edu/leadershipandmanagementinnovation/",
     "summary": "Track, analyze and report the money that keeps businesses running."},
    {"slug": "psychology", "name": "Psychology", "field": "Social & Behavioral Sciences",
     "mdc_program": "A.A. pathway to Psychology (12001), then transfer to a bachelor's in psychology",
     "mdc_url": "https://www.mdc.edu/psychology/",
     "summary": "Study how people think, feel and behave, on the way to counseling, research or HR."},
    {"slug": "biological-sciences", "name": "Biological Sciences", "field": "Science",
     "mdc_program": "B.S. Biological Sciences at MDC (Biotechnology or Biopharmaceutical Sciences concentration)",
     "mdc_url": "https://www.mdc.edu/science/academic-programs/",
     "summary": "Study living systems in the lab, a common route into biotech, research and pre-health."},
    {"slug": "criminal-justice", "name": "Criminal Justice", "field": "Public Safety",
     "mdc_program": "A.S. Criminal Justice Technology, then B.A.S. Public Safety Management - Criminal Justice Option at MDC",
     "mdc_url": "https://www.mdc.edu/justice/programs.aspx",
     "summary": "Work in law enforcement, corrections, investigations or the courts."},
    {"slug": "software-development", "name": "Software Development", "field": "Computer & IT",
     "mdc_program": "A.S. Computer Programming and Analysis, then B.S. Information Systems Technology - Software Engineering at MDC",
     "mdc_url": "https://www.mdc.edu/softwareengineering/",
     "summary": "Write the code behind apps, websites and the systems people use every day."},
    {"slug": "education", "name": "Education", "field": "Education",
     "mdc_program": "B.S. Early Childhood Education at MDC (also offered: Exceptional Student Ed K-12, Secondary Math or Biology Ed)",
     "mdc_url": "https://www.mdc.edu/earlychildhood/",
     "summary": "Teach and support students, from early childhood through high school."},
    {"slug": "graphic-design", "name": "Graphic Design", "field": "Arts & Design",
     "mdc_program": "A.S. Graphic Design Technology",
     "mdc_url": "https://www.mdc.edu/academics/documents/academic-programs-cip.pdf",
     "summary": "Create logos, layouts, ads and digital visuals that communicate ideas."},
    {"slug": "film-tv-production", "name": "Film & TV Production", "field": "Arts & Media",
     "mdc_program": "A.S. Film Production Technology, then B.A.S. Film, Television & Digital Production at MDC",
     "mdc_url": "https://www.mdc.edu/filmtvproduction/",
     "summary": "Shoot, edit and produce films, shows and digital content."},
]

# Each option adds trait weights to the student's profile.
QUESTIONS = [
    {"id": "q_weekend", "text": "Free Saturday. What sounds best?", "options": [
        {"label": "Designing posters or editing photos", "traits": {"creative": 0.9, "technical": 0.2, "expressive": 0.2}},
        {"label": "Taking apart a gadget to see how it works", "traits": {"technical": 0.7, "hands_on": 0.7}},
        {"label": "Cooking a big meal for friends", "traits": {"hands_on": 0.8, "creative": 0.4, "people": 0.4}},
        {"label": "Solving a puzzle or hacking challenge", "traits": {"analytical": 0.8, "protective": 0.4, "technical": 0.3}},
        {"label": "Volunteering to help people in need", "traits": {"caring": 1.0, "people": 0.4}},
    ]},
    {"id": "q_team", "text": "In a group project you usually...", "options": [
        {"label": "Lead the group and pitch the idea", "traits": {"enterprising": 0.8, "people": 0.6, "expressive": 0.3}},
        {"label": "Build the actual thing", "traits": {"hands_on": 0.7, "technical": 0.5}},
        {"label": "Make it look and sound great", "traits": {"creative": 0.8, "expressive": 0.4}},
        {"label": "Keep the schedule, notes and budget on track", "traits": {"organized": 1.0}},
        {"label": "Find the flaws before anyone else does", "traits": {"analytical": 0.6, "protective": 0.6}},
    ]},
    {"id": "q_math", "text": "How do you feel about math?", "options": [
        {"label": "Love it, the harder the better", "traits": {"analytical": 1.0, "technical": 0.4}},
        {"label": "Fine when it's about real money or data", "traits": {"analytical": 0.5, "organized": 0.5, "enterprising": 0.3}},
        {"label": "OK if it helps me build or fix something", "traits": {"technical": 0.5, "hands_on": 0.4}},
        {"label": "I'd rather avoid it", "traits": {"creative": 0.4, "people": 0.4, "expressive": 0.3}},
    ]},
    {"id": "q_elective", "text": "Which elective would you pick first?", "options": [
        {"label": "Biology or chemistry lab", "traits": {"scientific": 1.0, "analytical": 0.3}},
        {"label": "Psychology: why people act the way they do", "traits": {"scientific": 0.5, "people": 0.4, "caring": 0.3, "analytical": 0.3}},
        {"label": "Coding apps or games", "traits": {"technical": 0.8, "creative": 0.4, "analytical": 0.3}},
        {"label": "Art, film or music", "traits": {"creative": 0.7, "expressive": 0.7}},
        {"label": "Personal finance or entrepreneurship", "traits": {"enterprising": 0.8, "organized": 0.4}},
    ]},
    {"id": "q_documentary", "text": "Which documentary would you watch tonight?", "options": [
        {"label": "How skyscrapers and bridges get built", "traits": {"creative": 0.5, "technical": 0.5, "analytical": 0.4, "organized": 0.3}},
        {"label": "Life in the deep ocean", "traits": {"scientific": 1.0, "analytical": 0.2}},
        {"label": "Inside a real criminal investigation", "traits": {"protective": 0.8, "analytical": 0.3, "people": 0.2}},
        {"label": "How a startup became a giant brand", "traits": {"enterprising": 0.8, "creative": 0.2, "organized": 0.2}},
        {"label": "Behind the scenes of a blockbuster movie", "traits": {"expressive": 0.7, "people": 0.4, "hands_on": 0.4, "creative": 0.3}},
    ]},
    {"id": "q_workspace", "text": "Your ideal workspace?", "options": [
        {"label": "A studio with drafting tables and 3D models", "traits": {"creative": 0.8, "technical": 0.4, "organized": 0.3}},
        {"label": "A workshop or engineering lab", "traits": {"hands_on": 0.8, "technical": 0.6}},
        {"label": "A hospital or clinic", "traits": {"caring": 0.9, "scientific": 0.5}},
        {"label": "A busy kitchen or restaurant", "traits": {"hands_on": 0.9, "people": 0.4, "creative": 0.3}},
        {"label": "An office full of clients and meetings", "traits": {"people": 0.7, "enterprising": 0.6, "organized": 0.3}},
    ]},
    {"id": "q_problem", "text": "Something goes wrong. What's your first instinct?", "options": [
        {"label": "Find out who or what caused it", "traits": {"protective": 0.7, "analytical": 0.4}},
        {"label": "Test ideas until I find the cause", "traits": {"scientific": 0.6, "analytical": 0.5}},
        {"label": "Calm everyone down and talk it through", "traits": {"people": 0.7, "caring": 0.6}},
        {"label": "Grab some tools and fix it myself", "traits": {"hands_on": 0.9, "technical": 0.3}},
        {"label": "Make a checklist so it never happens again", "traits": {"organized": 0.9, "enterprising": 0.2}},
    ]},
    {"id": "q_spotlight", "text": "How do you feel about being in front of people?", "options": [
        {"label": "Love it: presenting or performing", "traits": {"expressive": 1.0, "people": 0.3}},
        {"label": "Love teaching or coaching others", "traits": {"caring": 0.6, "expressive": 0.6, "people": 0.5, "organized": 0.2}},
        {"label": "Best one-on-one, helping someone directly", "traits": {"caring": 0.7, "people": 0.5}},
        {"label": "I prefer making things happen behind the scenes", "traits": {"hands_on": 0.4, "technical": 0.4, "organized": 0.3}},
        {"label": "I'd rather work with data or systems", "traits": {"analytical": 0.6, "technical": 0.5}},
    ]},
    {"id": "q_compliment", "text": "Which compliment would mean the most to you?", "options": [
        {"label": "\"Nothing slips past you.\"", "traits": {"organized": 1.0, "protective": 0.2}},
        {"label": "\"You explain things so clearly.\"", "traits": {"expressive": 0.6, "people": 0.5, "caring": 0.3}},
        {"label": "\"That's beautiful. How did you come up with it?\"", "traits": {"creative": 1.0}},
        {"label": "\"You can fix anything.\"", "traits": {"hands_on": 0.8, "technical": 0.5}},
        {"label": "\"You'd make a great boss.\"", "traits": {"enterprising": 0.9, "people": 0.4}},
    ]},
    {"id": "q_impact", "text": "What kind of impact matters most to you?", "options": [
        {"label": "Creating things people see, use or enjoy", "traits": {"creative": 0.8, "expressive": 0.3}},
        {"label": "Building technology that works better", "traits": {"technical": 0.8, "analytical": 0.3}},
        {"label": "Helping people heal, learn or grow", "traits": {"caring": 1.0, "people": 0.3}},
        {"label": "Keeping people and their data safe", "traits": {"protective": 1.0}},
        {"label": "Growing a business or creating jobs", "traits": {"enterprising": 1.0}},
    ]},
    {"id": "q_pressure", "text": "Which high-pressure moment sounds exciting, not scary?", "options": [
        {"label": "Being first on the scene of an emergency", "traits": {"protective": 0.7, "caring": 0.6, "hands_on": 0.4}},
        {"label": "Stopping a cyberattack in real time", "traits": {"protective": 0.8, "technical": 0.7, "analytical": 0.3}},
        {"label": "Dinner rush with 50 orders on the line", "traits": {"hands_on": 0.9, "people": 0.3, "creative": 0.2}},
        {"label": "Closing a big deal with a client", "traits": {"enterprising": 0.9, "people": 0.5}},
        {"label": "A film shoot racing the sunset", "traits": {"expressive": 0.6, "creative": 0.5, "hands_on": 0.4}},
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
