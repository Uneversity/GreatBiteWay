"""Official Miami Dade College facts for the roadmap side panel, each with its mdc.edu source.

Checked on 2026-11-08 against mdc.edu:
- Tuition & fees: https://www.mdc.edu/student-financial-services/tuition-fees/
  (MDC labels it "the current academic year"; amounts are per credit hour, tuition + fees.)
- Steps to apply: https://www.mdc.edu/admissions-info/
- FAFSA school codes: https://www.mdc.edu/financialaid/contact.aspx
- Program credits / codes / effective terms: MDC course sequence guides
  (mdc.edu/academics/programs/csg/...) and program sheets (mdc.edu/academics/programs/ps/<code>.pdf)
- Admission requirements: each program's admission-requirements page on mdc.edu

MDC revises tuition every academic year and programs every term. Re-check before a demo
and update CHECKED_ON. Nothing here is generated: every value is copied from the page cited
next to it, and the tuition estimates are simple arithmetic on MDC's published rates.
"""

import re
from dataclasses import dataclass, field

from app.schemas import RoadmapStep, StepFact

CHECKED_ON = "2026-11-08"

TUITION_URL = "https://www.mdc.edu/student-financial-services/tuition-fees/"
APPLY_URL = "https://www.mdc.edu/admissions-info/"
FAFSA_CODES_URL = "https://www.mdc.edu/financialaid/contact.aspx"
FINANCIAL_AID_URL = "https://www.mdc.edu/financialaid/"
ORIENTATION_URL = "https://faq.mdc.edu/knowledgebase/do-i-need-to-attend-orientation"

# Per credit hour, tuition + fees, Florida residents / non-residents.
LOWER_DIVISION = {"resident": 118.22, "nonresident": 402.51}  # associate (A.A., A.S.) and certificates
UPPER_DIVISION = {"resident": 129.89, "nonresident": 535.97}  # bachelor's (B.S., B.A.S., BSN) courses
APPLICATION_FEE = 30

FAFSA_CODES = {
    "Hialeah": "E01296", "Homestead": "E00611", "Kendall": "004536", "Medical": "014632",
    "North": "010223", "Padrón": "E00994", "West": "E40469", "Wolfson": "014631",
}


@dataclass(frozen=True)
class Program:
    award: str  # "A.A.", "A.S.", "B.S.", "B.A.S."
    name: str
    code: str
    credits: int
    effective_term: str
    source_url: str
    # For a bachelor's: how many credits are upper-division courses, billed at the bachelor's
    # rate (the rest come from the associate degree, at the associate rate).
    upper_credits: int = 60
    admission: tuple[str, ...] = ()
    admission_url: str | None = None
    notes: tuple[str, ...] = ()
    notes_url: str | None = None

    @property
    def is_bachelors(self) -> bool:
        return self.award.startswith("B")


CSG = "https://www.mdc.edu/academics/programs/csg/"
PS = "https://www.mdc.edu/academics/programs/ps/"

_AA_GUARANTEE = "Earning an A.A. at MDC guarantees admission into one of Florida's public universities."


@dataclass(frozen=True)
class MajorInfo:
    programs: tuple[Program, ...]
    notes: tuple[str, ...] = field(default=())
    notes_url: str | None = None

    @property
    def associate(self) -> Program | None:
        return next((p for p in self.programs if not p.is_bachelors), None)

    @property
    def bachelors(self) -> Program | None:
        return next((p for p in self.programs if p.is_bachelors), None)


MAJORS: dict[str, MajorInfo] = {
    "architecture": MajorInfo(
        programs=(Program("A.A.", "Associate in Arts, Architecture pathway", "10200", 60, "Fall 2025",
                          CSG + "2025/AA_Architecture_csg.pdf"),),
        notes=(_AA_GUARANTEE, "Credits can transfer to a Florida state or out-of-state university."),
        notes_url="https://www.mdc.edu/architectureaa/",
    ),
    "mechanical-engineering": MajorInfo(
        programs=(Program("A.A.", "Associate in Arts, Engineering-Mechanical pathway", "10911", 60, "Fall 2024",
                          CSG + "AA_Engineering-Mechanical_csg.pdf",
                          notes=("MDC's guide notes FIU grants upper-division credit for COP 2270 and EGN 2312 "
                                 "for Mechanical Engineering majors.",),
                          notes_url=CSG + "AA_Engineering-Mechanical_csg.pdf"),),
        notes=(_AA_GUARANTEE,),
        notes_url="https://www.mdc.edu/architectureaa/",
    ),
    "culinary-arts": MajorInfo(
        programs=(Program("A.S.", "Culinary Arts Management", "22031", 60, "Fall 2024",
                          CSG + "AS_CulinaryArtsManagement_csg.pdf",
                          notes=("Taught at Miami Culinary Institute on MDC's Wolfson Campus, downtown Miami.",
                                 "Additional lab fees of approximately $18,644 cover the culinary program's costs.",
                                 "Graduates become a Certified Culinarian.",
                                 "Courses lead to College Credit Certificates in Chef Apprentice and Culinary Arts "
                                 "Management Operations along the way."),
                          notes_url="https://www.mdc.edu/culinaryartsmanagement/"),
                  # MDC lists the Culinary A.S. as a pathway to this B.A.S. (Hospitality Management concentration).
                  Program("B.A.S.", "Leadership and Management Innovation (Hospitality Management concentration)",
                          "P9200", 120, "Fall 2024", CSG + "BAS_LeadershipandManagementInnovation_csg.pdf",
                          admission=("An A.A., A.S. or A.A.S., or at least 60 college credits including general "
                                     "education.",
                                     "Minimum 2.0 cumulative GPA.",
                                     "The MDC application plus the B.A.S. program application."),
                          admission_url="https://www.mdc.edu/leadershipandmanagementinnovation/admission-requirements.aspx",
                          notes=("Courses are offered in person, online, or blended.",),
                          notes_url="https://www.mdc.edu/leadershipandmanagementinnovation/")),
    ),
    "cybersecurity": MajorInfo(
        programs=(
            Program("A.S.", "Cybersecurity", "25079", 60, "Spring 2025", CSG + "AS_Cybersecurity_csg.pdf",
                    notes=("Courses prepare you for industry certifications including CompTIA CySA+ and "
                           "Certified Network Defender; some exam costs may be eligible for reimbursement.",),
                    notes_url=CSG + "AS_Cybersecurity_csg.pdf"),
            Program("B.S.", "Cybersecurity", "S9515", 120, "Spring 2025", PS + "S9515.pdf",
                    
                    admission=("An A.A., an A.S., or at least 60 college credits including general education.",
                               "Minimum 2.5 cumulative GPA in college coursework.",
                               "C or higher in CTS 1120, CTS 1134, CTS 1111, and one of CIS 1531, COP 1334 or COP 1047C."),
                    admission_url="https://www.mdc.edu/cybersecuritybs/admission-requirements.aspx",
                    notes=("The curriculum prepares you for Certified Ethical Hacker, Certified Information "
                           "Security Manager, Certified Incident Handler and Computer Hacking Forensics Investigator.",),
                    notes_url="https://www.mdc.edu/cybersecuritybs/"),
        ),
    ),
    "it-consulting": MajorInfo(
        programs=(
            Program("A.S.", "Computer Information Technology", "25055", 60, "Fall 2024",
                    CSG + "AS_ComputerInformationTechnology_csg.pdf",
                    notes=("Courses lead to College Credit Certificates in Help Desk Support Technician and "
                           "Information Technology Support, and to CompTIA and Microsoft Modern Desktop "
                           "Administrator Associate certifications.",),
                    notes_url=CSG + "AS_ComputerInformationTechnology_csg.pdf"),
            Program("B.S.", "Information Systems Technology - Networking Concentration", "S9500", 120, "Fall 2025",
                    PS + "S9500.pdf", 
                    admission=("An A.A. or A.S., or at least 60 credits with a minimum 2.5 cumulative GPA.",
                               "Completion of MAC 1105, STA 2023, ECO 2013, CGS 1060C, CGS 1540C, COP 1334, "
                               "and CTS 1134 or CTS 1650."),
                    admission_url="https://www.mdc.edu/informationsystems/",
                    notes=("MDC has master's agreements with FIU, FAU and Northeastern University.",),
                    notes_url="https://www.mdc.edu/informationsystems/"),
        ),
    ),
    "nursing": MajorInfo(
        programs=(
            Program("A.S.", "Nursing - R.N. (Generic Full-Time)", "23028", 72, "Spring 2022",
                    PS + "23028.pdf",
                    admission=("All nursing options are competitive admission; meeting the minimums does not "
                               "guarantee selection.",
                               "Minimum 2.5 cumulative GPA and 2.0 natural science GPA.",
                               "Composite score above 60% on the ATI TEAS, taken through MDC Testing.",
                               "HSC 0003/L, BSC 2085/L and BSC 2086/L (within 10 years), and CGS 1060C or the "
                               "Computer Skills Placement exam.",
                               "A $25 milestone review fee per nursing option.",
                               "Target deadlines: May 1 for fall selection, September 1 for spring selection."),
                    admission_url="https://www.mdc.edu/nursingrn/admission-requirements.aspx",
                    notes=("Generic full-time takes 4 semesters (part-time 7); Transition 3 full-time or 5 "
                           "part-time; Accelerated 3.",
                           "Held at the Medical Campus; final admission requires a cleared Level II background check.",
                           "2024 outcomes: 80% NCLEX pass rate, 93% job placement, 70% on-time completion."),
                    notes_url="https://www.mdc.edu/nursing/nursing_programs.aspx"),
            Program("B.S.", "Bachelor of Science in Nursing (RN to BSN)", "N9100", 125, "Spring 2026",
                    CSG + "BS_Nursing_csg.pdf", upper_credits=42,
                    admission=("For Florida-licensed RNs who have an A.S. in Nursing.",
                               "19 credits of common prerequisites before admission; admission is competitive."),
                    admission_url="https://www.mdc.edu/bsn/",
                    notes=("Can be finished in 3 semesters, full-time or part-time.",
                           "Fully online except for two clinical courses."),
                    notes_url="https://www.mdc.edu/bsn/"),
        ),
    ),
    "business-administration": MajorInfo(
        programs=(
            Program("A.S.", "Business Administration", "25051", 60, "Spring 2026",
                    CSG + "AS_BusinessAdministration_csg.pdf",
                    notes=("Courses lead to several College Credit Certificates in business operations and "
                           "business specialist tracks along the way.",),
                    notes_url=CSG + "AS_BusinessAdministration_csg.pdf"),
            Program("B.A.S.", "Leadership and Management Innovation", "P9200", 120, "Fall 2024",
                    CSG + "BAS_LeadershipandManagementInnovation_csg.pdf", 
                    admission=("An A.A., A.S. or A.A.S., or at least 60 college credits including general education.",
                               "Minimum 2.0 cumulative GPA.",
                               "The MDC application plus the B.A.S. program application."),
                    admission_url="https://www.mdc.edu/leadershipandmanagementinnovation/admission-requirements.aspx",
                    notes=("Courses are offered in person, online, or blended.",
                           "Concentrations: Accounting, Human Resources Management, Hospitality Management, "
                           "Digital Marketing."),
                    notes_url="https://www.mdc.edu/leadershipandmanagementinnovation/"),
        ),
    ),
    "accounting": MajorInfo(
        programs=(
            Program("A.S.", "Accounting Technology", "25022", 60, "Fall 2024", CSG + "AS_AccountingTechnology_csg.pdf",
                    notes=("Courses lead to College Credit Certificates in Accounting and Budgeting, Accounting "
                           "Technology Management, and Tax Specialist.",),
                    notes_url=CSG + "AS_AccountingTechnology_csg.pdf"),
            Program("B.A.S.", "Leadership and Management Innovation - Accounting", "P9203", 120, "Fall 2024",
                    PS + "P9203.pdf", 
                    admission=("An A.A., A.S. or A.A.S., or at least 60 college credits including general education.",
                               "Minimum 2.0 cumulative GPA.",
                               "The MDC application plus the B.A.S. program application."),
                    admission_url="https://www.mdc.edu/leadershipandmanagementinnovation/admission-requirements.aspx",
                    notes=("Courses are offered in person, online, or blended.",),
                    notes_url="https://www.mdc.edu/leadershipandmanagementinnovation/"),
        ),
    ),
    "psychology": MajorInfo(
        programs=(Program("A.A.", "Associate in Arts, Psychology pathway", "12001", 60, "Fall 2025",
                          CSG + "2025/AA_Psychology_csg.pdf",
                          notes=("An accelerated option lets you earn the A.A. in one year.",),
                          notes_url="https://www.mdc.edu/psychology/"),),
        notes=(_AA_GUARANTEE,
               "Professional psychologists typically need a master's or doctorate after the bachelor's."),
        notes_url="https://www.mdc.edu/psychology/",
    ),
    "biological-sciences": MajorInfo(
        programs=(Program("B.S.", "Biological Sciences - Biotechnology Concentration", "S9120", 120, "Fall 2024",
                          PS + "S9120.pdf", 
                          admission=("An A.S. in Biotechnology or an A.A., or at least 60 semester hours with 16 "
                                     "hours of common prerequisites, ENC 1101 and MAC 1105 or higher.",
                                     "Minimum 2.0 cumulative GPA and 2.0 in natural science courses.",
                                     "Prerequisites: majors biology I-II and chemistry I-II with labs, organic "
                                     "chemistry I-II with labs, calculus, and statistics or Calculus II.",
                                     "Common prerequisites should be earned within 10 years of admission."),
                          admission_url="https://www.mdc.edu/biotechnology/admission-requirements.aspx"),),
    ),
    "criminal-justice": MajorInfo(
        programs=(
            Program("A.S.", "Criminal Justice Technology", "27012", 60, "Fall 2024",
                    CSG + "AS_CriminalJusticeTechnology_csg.pdf",
                    notes=("Courses lead to a College Credit Certificate in Homeland Security.",),
                    notes_url=CSG + "AS_CriminalJusticeTechnology_csg.pdf"),
            Program("B.A.S.", "Public Safety Management - Criminal Justice Option", "P9110", 120, "Fall 2026",
                    PS + "P9110.pdf", 
                    admission=("An A.A. or A.S., or at least 60 college credits including general education.",
                               "Minimum 2.0 cumulative GPA.",
                               "Applicants with an A.S. in an unrelated field should see a School of Justice advisor."),
                    admission_url="https://www.mdc.edu/criminaljusticebas/admission-requirements.aspx"),
        ),
    ),
    "software-development": MajorInfo(
        programs=(
            Program("A.S.", "Computer Programming and Analysis - Business Application Programming", "25065", 60,
                    "Spring 2025", PS + "25065.pdf"),
            Program("B.S.", "Information Systems Technology - Software Engineering Concentration", "S9501", 120,
                    "Fall 2025", PS + "S9501.pdf", 
                    admission=("An A.A., an A.S., or at least 60 college credits including general education.",
                               "Minimum 2.5 cumulative GPA in college coursework.",
                               "C or higher in CGS 1060C, CGS 1540C, CTS 1134 or CTS 1650, COP 1334, ECO 2013 or "
                               "ECO 2023, MAC 1105, SPC 1017 or SPC 2608, and STA 2023.",
                               "COP 2800 (Java) and discrete math before or during the first semester."),
                    admission_url="https://www.mdc.edu/softwareengineering/admission-requirements.aspx",
                    notes=("MDC has master's agreements with FIU, FAU and Northeastern University.",),
                    notes_url="https://www.mdc.edu/softwareengineering/"),
        ),
    ),
    "education": MajorInfo(
        programs=(
            Program("A.S.", "Early Childhood Education", "27014", 60, "Fall 2024",
                    CSG + "AS_EarlyChildhoodEducation_csg.pdf"),
            Program("B.S.", "Early Childhood Education", "S9270", 120, "Fall 2025",
                    CSG + "BS_EarlyChildhoodEducation_csg.pdf", 
                    admission=("An A.A. degree including all general education requirements.",
                               "Minimum 2.5 GPA, required by Florida Statute 1004.04.",
                               "C or better in EDF 1005, EDF 2144, EME 2040 and EEC 1000 (outstanding ones can be "
                               "finished in your first two semesters)."),
                    admission_url="https://www.mdc.edu/earlychildhood/admission-requirements.aspx"),
        ),
    ),
    "graphic-design": MajorInfo(
        programs=(Program("A.S.", "Graphic Design Technology", "26031", 64, "Fall 2024",
                          CSG + "AS_GraphicDesignTechnology_csg.pdf",
                          notes=("A pathway to MDC's B.A.S. in Supervision and Management.",
                                 "Courses lead to a College Credit Certificate in Graphic Design Support."),
                          notes_url=CSG + "AS_GraphicDesignTechnology_csg.pdf"),),
    ),
    "film-tv-production": MajorInfo(
        programs=(
            Program("A.S.", "Film Production Technology", "26044", 64, "Fall 2024",
                    CSG + "AS_FilmProductionTechnology_csg.pdf",
                    notes=("Courses lead to a College Credit Certificate in Film Production Fundamentals.",),
                    notes_url=CSG + "AS_FilmProductionTechnology_csg.pdf"),
            Program("B.A.S.", "Film, Television and Digital Production", "P9220", 120, "Fall 2024",
                    PS + "P9220.pdf", 
                    admission=("An A.S. or A.A., or at least 60 credits with a minimum 2.0 cumulative GPA.",
                               "Prerequisites: FIL 1030 History of Film and FIL 1100 Screenwriting 1."),
                    admission_url="https://www.mdc.edu/filmtvproduction/admission-requirements.aspx"),
        ),
    ),
}


# ---- choosing facts for one step ------------------------------------------------

def _money(x: float) -> str:
    return f"${x:,.2f}" if x != int(x) else f"${int(x):,}"


def _tuition_facts(p: Program) -> list[StepFact]:
    """MDC's published per-credit rate for this level, and simple arithmetic on it."""
    rate, kind = (UPPER_DIVISION, "Bachelor's courses") if p.is_bachelors else (LOWER_DIVISION, "Associate courses")
    # A bachelor's step covers only the upper-division half; the associate half is billed (and shown) earlier.
    credits = p.upper_credits if p.is_bachelors else p.credits
    span = f"the {credits} upper-division credits" if p.is_bachelors else f"all {credits} credits"
    return [
        StepFact(label="Tuition + fees",
                 value=(f"{kind} cost {_money(rate['resident'])} per credit for Florida residents and "
                        f"{_money(rate['nonresident'])} for non-residents; about "
                        f"{_money(round(rate['resident'] * 12, 2))} for a 12-credit term in-state."),
                 source_url=TUITION_URL),
        StepFact(label="Estimated cost",
                 value=(f"About {_money(round(credits * rate['resident']))} in-state for {span}, before "
                        "financial aid. Books, lab and course fees are extra."),
                 source_url=TUITION_URL),
    ]


def _program_fact(p: Program) -> StepFact:
    return StepFact(label="MDC program",
                    value=f"{p.award} {p.name} (code {p.code}), {p.credits} credits, effective {p.effective_term}.",
                    source_url=p.source_url)


def _note_facts(notes: tuple[str, ...], url: str | None, label: str = "From MDC") -> list[StepFact]:
    return [StepFact(label=label, value=n, source_url=url) for n in notes] if url else []


def _admission_facts(p: Program) -> list[StepFact]:
    return [StepFact(label="Admission", value=a, source_url=p.admission_url or p.source_url) for a in p.admission]


def _enroll_facts() -> list[StepFact]:
    codes = ", ".join(f"{c} {k}" for c, k in FAFSA_CODES.items())
    return [
        StepFact(label="Apply", value=f"Online MDC application with a ${APPLICATION_FEE} non-refundable fee "
                                      "(returning students don't pay it).", source_url=APPLY_URL),
        StepFact(label="Steps after applying",
                 value="Create your MyMDC account, submit proof of Florida residency for in-state tuition (12+ "
                       "months as a resident), send test scores and official transcripts, apply for financial "
                       "aid, then attend New Student Orientation, where you meet your advisor and get your schedule.",
                 source_url=APPLY_URL),
        StepFact(label="Orientation", value="Required for students coming straight from high school.",
                 source_url=ORIENTATION_URL),
        StepFact(label="FAFSA", value=f"Use one MDC campus code on the FAFSA: {codes}.", source_url=FAFSA_CODES_URL),
    ]


def _mentions_mdc(step: RoadmapStep) -> bool:
    text = f"{step.title} {step.detail}".lower()
    return "miami dade" in text or "mdc" in text


# Which program notes belong on certification and career cards.
_CERT_NOTE = re.compile(r"(?i)certif|exam|nclex|culinarian|credential")
_CAREER_NOTE = re.compile(r"(?i)outcome|placement|salary|job|career|master's|doctorate|psychologist")


def _topic_notes(info: MajorInfo, pattern: re.Pattern[str]) -> list[StepFact]:
    out: list[StepFact] = []
    for p in info.programs:
        out += _note_facts(tuple(n for n in p.notes if pattern.search(n)), p.notes_url)
    return out + _note_facts(tuple(n for n in info.notes if pattern.search(n)), info.notes_url)


def facts_for_step(slug: str | None, step: RoadmapStep) -> list[StepFact]:
    """The official MDC facts that belong on this step's card, most relevant first."""
    info = MAJORS.get(slug or "")
    if step.id == "enroll" or step.title.lower().startswith("enroll"):
        out = _enroll_facts()
        if info and info.associate:
            out = [_program_fact(info.associate), *_admission_facts(info.associate), *out]
        elif info and info.bachelors:
            out = [_program_fact(info.bachelors), *out]
        return out

    if not info:
        return []

    if step.stage == "mdc":
        p = info.associate or info.bachelors
        if not p:
            return []
        out = [_program_fact(p), *_tuition_facts(p), *_note_facts(p.notes, p.notes_url)]
        return out + _note_facts(info.notes, info.notes_url)

    if step.stage == "transfer":
        b = info.bachelors
        if b and (_mentions_mdc(step) or not info.associate):
            return [_program_fact(b), *_admission_facts(b), *_tuition_facts(b), *_note_facts(b.notes, b.notes_url)]
        # Transferring out: the A.A. admission guarantee only applies to A.A. students.
        if info.associate and info.associate.award == "A.A.":
            return _note_facts(info.notes, info.notes_url)
        return []

    if step.stage == "certification":
        return _topic_notes(info, _CERT_NOTE)
    if step.stage == "career":
        return _topic_notes(info, _CAREER_NOTE)
    return []


def facts_as_prompt(facts: list[StepFact]) -> str:
    lines = [f"- {f.label}: {f.value} (source: {f.source_url})" for f in facts]
    return f"Official MDC facts (copied from mdc.edu, checked {CHECKED_ON}):\n" + "\n".join(lines)
