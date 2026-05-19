"""Seed the Altigen Pharma SQLite database with mock data.

Run once before starting the MCP server:
    uv run python scripts/seed.py

Scale (deliberate):
  products         ~ 22  (full mid-cap portfolio)
  clinical_trials  ~ 42  (multi-phase per product)
  kpis             ~ 60  (10 KPIs across ~6 quarters → real trends)
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "pharma.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    product_id    INTEGER PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    indication    TEXT NOT NULL,
    therapy_area  TEXT NOT NULL,
    status        TEXT NOT NULL,
    launch_year   INTEGER
);

CREATE TABLE IF NOT EXISTS clinical_trials (
    trial_id           TEXT PRIMARY KEY,
    product_id         INTEGER NOT NULL REFERENCES products(product_id),
    phase              TEXT NOT NULL,
    status             TEXT NOT NULL,
    enrollment_target  INTEGER,
    enrollment_actual  INTEGER,
    start_date         TEXT,
    primary_endpoint   TEXT
);

CREATE TABLE IF NOT EXISTS kpis (
    kpi_id    INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    function  TEXT NOT NULL,
    period    TEXT NOT NULL,
    value     REAL NOT NULL,
    unit      TEXT NOT NULL,
    target    REAL
);
"""

# ---------------------------------------------------------------------------
# Products — 22 assets across 6 therapy areas
# ---------------------------------------------------------------------------

PRODUCTS = [
    # Cardiology
    (1,  "Zenoxitam",  "Heart failure (HFrEF)",            "Cardiology",  "Marketed",   2022),
    (2,  "CardioMax",  "Hypertension",                     "Cardiology",  "Marketed",   2018),
    (3,  "Lipidra",    "Mixed dyslipidemia",               "Cardiology",  "Marketed",   2015),
    (4,  "Atherosil",  "Atherosclerotic CV disease",       "Cardiology",  "Phase III",  None),
    # Neurology
    (5,  "Neurolin",   "Multiple sclerosis",               "Neurology",   "Marketed",   2020),
    (6,  "Cognivex",   "Early Alzheimer's disease",        "Neurology",   "Phase III",  None),
    (7,  "Migravox",   "Chronic migraine",                 "Neurology",   "Marketed",   2021),
    (8,  "Parkalon",   "Parkinson's disease",              "Neurology",   "Phase II",   None),
    # Oncology
    (9,  "Onkoria",    "Non-small-cell lung cancer",       "Oncology",    "Phase III",  None),
    (10, "Hematix",    "Acute myeloid leukemia",           "Oncology",    "Marketed",   2019),
    (11, "Mammavex",   "HER2+ breast cancer",              "Oncology",    "Marketed",   2017),
    (12, "Renotrex",   "Renal cell carcinoma",             "Oncology",    "Phase II",   None),
    (13, "Glioxen",    "Glioblastoma multiforme",          "Oncology",    "Phase I",    None),
    # Immunology
    (14, "Immunoxa",   "Plaque psoriasis",                 "Immunology",  "Phase II",   None),
    (15, "Rheumatel",  "Rheumatoid arthritis",             "Immunology",  "Marketed",   2014),
    (16, "Crohnasil",  "Crohn's disease",                  "Immunology",  "Marketed",   2020),
    (17, "Lupavex",    "Systemic lupus erythematosus",     "Immunology",  "Phase III",  None),
    # Metabolic
    (18, "Glucotide",  "Type 2 diabetes",                  "Metabolic",   "Marketed",   2016),
    (19, "Adipara",    "Obesity (BMI ≥ 30)",               "Metabolic",   "Marketed",   2024),
    (20, "Thyrolex",   "Hypothyroidism",                   "Metabolic",   "Marketed",   2012),
    # Rare disease
    (21, "Rarivex",    "Pompe disease",                    "Rare disease","Marketed",   2023),
    (22, "Hemophilex", "Hemophilia A (gene therapy)",      "Rare disease","Phase III",  None),
]


# ---------------------------------------------------------------------------
# Clinical trials — 42 across phases I → IV
# ---------------------------------------------------------------------------

TRIALS = [
    # Zenoxitam (1) — pivotal + post-marketing
    ("ALT-ZNX-301", 1, "III", "Completed",  1200, 1187, "2020-04-12", "Reduction in HF hospitalizations at 12 months"),
    ("ALT-ZNX-302", 1, "III", "Completed",   840,  836, "2021-09-08", "All-cause mortality, 24-month follow-up"),
    ("ALT-ZNX-401", 1, "IV",  "Recruiting",  800,  412, "2025-09-01", "Real-world cardiovascular mortality"),
    ("ALT-ZNX-402", 1, "IV",  "Active",      600,  588, "2024-03-14", "Quality of life (KCCQ score) at 6 months"),
    # CardioMax (2)
    ("ALT-CDM-205", 2, "II",  "Completed",   450,  448, "2016-02-20", "Mean change in systolic BP at week 24"),
    ("ALT-CDM-310", 2, "III", "Completed",   980,  962, "2017-07-11", "Composite MACE at 18 months"),
    # Lipidra (3)
    ("ALT-LPD-201", 3, "II",  "Completed",   260,  258, "2013-05-09", "LDL-C reduction at week 12"),
    ("ALT-LPD-302", 3, "III", "Completed",  1100, 1094, "2014-08-03", "MACE composite endpoint"),
    # Atherosil (4)
    ("ALT-ATH-301", 4, "III", "Recruiting",  900,  410, "2025-04-21", "Composite CV death + MI + stroke"),
    # Neurolin (5)
    ("ALT-NRL-302", 5, "III", "Completed",   900,  876, "2018-06-05", "Annualized relapse rate"),
    ("ALT-NRL-401", 5, "IV",  "Active",      500,  493, "2022-11-12", "Long-term safety surveillance"),
    # Cognivex (6)
    ("ALT-COG-201", 6, "II",  "Completed",   320,  318, "2023-01-30", "Change in CDR-SB at 18 months"),
    ("ALT-COG-301", 6, "III", "Recruiting", 1500,  642, "2025-06-14", "Cognitive decline (ADAS-Cog) at 24 months"),
    # Migravox (7)
    ("ALT-MGV-301", 7, "III", "Completed",   780,  775, "2019-03-22", "Monthly migraine days at week 12"),
    # Parkalon (8)
    ("ALT-PRK-101", 8, "I",   "Completed",    96,   94, "2024-02-09", "Safety / pharmacokinetics"),
    ("ALT-PRK-201", 8, "II",  "Active",      280,  201, "2025-08-18", "MDS-UPDRS Part III at 26 weeks"),
    # Onkoria (9) — pivotal
    ("ALT-ONK-201", 9, "II",  "Completed",   190,  188, "2022-07-10", "Objective response rate (RECIST 1.1)"),
    ("ALT-ONK-301", 9, "III", "Recruiting",  720,  301, "2025-01-18", "Progression-free survival (PFS)"),
    # Hematix (10)
    ("ALT-HMT-301", 10,"III", "Completed",   620,  611, "2017-10-05", "Complete remission rate"),
    ("ALT-HMT-402", 10,"IV",  "Active",      400,  392, "2023-04-19", "5-year overall survival"),
    # Mammavex (11)
    ("ALT-MMV-301", 11,"III", "Completed",   880,  873, "2015-11-30", "Disease-free survival at 36 months"),
    ("ALT-MMV-402", 11,"IV",  "Active",      550,  531, "2024-01-22", "Real-world cardiotoxicity rate"),
    # Renotrex (12)
    ("ALT-RNT-201", 12,"II",  "Active",      210,  187, "2025-05-04", "Objective response rate at 24 weeks"),
    # Glioxen (13)
    ("ALT-GLX-101", 13,"I",   "Recruiting",   60,   31, "2025-11-02", "Maximum tolerated dose / safety"),
    # Immunoxa (14)
    ("ALT-IMX-101", 14,"I",   "Completed",   72,   71,  "2023-08-15", "Safety, PK"),
    ("ALT-IMX-203", 14,"II",  "Active",     300,  287,  "2024-11-09", "PASI-75 response at week 16"),
    # Rheumatel (15)
    ("ALT-RHM-302", 15,"III", "Completed",  920,  908,  "2012-09-04", "ACR50 response at week 24"),
    ("ALT-RHM-403", 15,"IV",  "Completed",  1500,1492,  "2018-12-01", "Long-term cardiovascular safety"),
    # Crohnasil (16)
    ("ALT-CRN-301", 16,"III", "Completed",  680,  672,  "2018-02-17", "Clinical remission at week 12"),
    ("ALT-CRN-402", 16,"IV",  "Active",     1200,1184,  "2023-06-03", "Mucosal healing at 52 weeks"),
    # Lupavex (17)
    ("ALT-LPV-301", 17,"III", "Recruiting", 1100, 624,  "2025-02-25", "BICLA response at week 52"),
    # Glucotide (18)
    ("ALT-GLT-301", 18,"III", "Completed",  1400,1391,  "2014-08-11", "HbA1c reduction at 26 weeks"),
    ("ALT-GLT-401", 18,"IV",  "Completed",  2000,1994,  "2019-03-22", "HbA1c reduction at 52 weeks"),
    ("ALT-GLT-402", 18,"IV",  "Active",     2400,2331,  "2023-10-18", "MACE composite, real-world"),
    # Adipara (19)
    ("ALT-ADP-301", 19,"III", "Completed",  1800,1779,  "2022-04-08", "% body-weight change at 68 weeks"),
    ("ALT-ADP-401", 19,"IV",  "Recruiting", 1000, 487,  "2025-07-30", "Cardiometabolic outcomes"),
    # Thyrolex (20)
    ("ALT-THY-301", 20,"III", "Completed",   500, 498,  "2010-05-15", "TSH normalization at week 12"),
    # Rarivex (21)
    ("ALT-RVX-201", 21,"II",  "Completed",    48,  47,  "2021-02-19", "6-minute walk test improvement"),
    ("ALT-RVX-301", 21,"III", "Completed",   140, 138,  "2022-06-30", "Forced vital capacity at 78 weeks"),
    # Hemophilex (22) — gene therapy
    ("ALT-HMX-101", 22,"I",   "Completed",    24,  24,  "2023-03-12", "Factor VIII activity, safety"),
    ("ALT-HMX-201", 22,"II",  "Completed",    62,  62,  "2024-01-10", "Annualized bleed rate"),
    ("ALT-HMX-301", 22,"III", "Recruiting",  220, 113,  "2025-09-22", "Annualized bleed rate at 52 weeks"),
]


# ---------------------------------------------------------------------------
# KPIs — 60 rows: 10 distinct names × ~6 quarters of history
# ---------------------------------------------------------------------------

# (name, function, unit, target, [(period, value), ...])
_KPI_DEFS: list[tuple[str, str, str, float | None, list[tuple[str, float]]]] = [
    ("On-time trial enrollment", "Clinical Operations", "%", 85.0, [
        ("2024-Q4", 64.2), ("2025-Q1", 68.7), ("2025-Q2", 71.0),
        ("2025-Q3", 70.5), ("2025-Q4", 72.1), ("2026-Q1", 78.4),
    ]),
    ("Protocol deviation rate", "Clinical Operations", "%", 3.0, [
        ("2024-Q4", 5.6), ("2025-Q1", 5.1), ("2025-Q2", 4.7),
        ("2025-Q3", 4.4), ("2025-Q4", 4.4), ("2026-Q1", 4.2),
    ]),
    ("Site activation cycle time", "Clinical Operations", "days", 90.0, [
        ("2024-Q4", 142.0), ("2025-Q1", 131.0), ("2025-Q2", 121.0),
        ("2025-Q3", 110.0), ("2025-Q4", 102.0), ("2026-Q1", 96.0),
    ]),
    ("Batch right-first-time", "Manufacturing", "%", 98.0, [
        ("2024-Q4", 93.1), ("2025-Q1", 94.3), ("2025-Q2", 95.0),
        ("2025-Q3", 95.8), ("2025-Q4", 96.2), ("2026-Q1", 96.7),
    ]),
    ("Right-first-time deviation", "Manufacturing", "%", 2.0, [
        ("2024-Q4", 6.9), ("2025-Q1", 5.7), ("2025-Q2", 5.0),
        ("2025-Q3", 4.2), ("2025-Q4", 3.8), ("2026-Q1", 3.3),
    ]),
    ("Adverse-event reporting SLA", "Pharmacovigilance", "%", 95.0, [
        ("2024-Q4", 88.0), ("2025-Q1", 89.7), ("2025-Q2", 90.4),
        ("2025-Q3", 91.2), ("2025-Q4", 92.0), ("2026-Q1", 92.5),
    ]),
    ("Signal detection cycle time", "Pharmacovigilance", "days", 14.0, [
        ("2024-Q4", 22.0), ("2025-Q1", 20.0), ("2025-Q2", 19.0),
        ("2025-Q3", 17.0), ("2025-Q4", 16.0), ("2026-Q1", 15.0),
    ]),
    ("Net product revenue (Zenoxitam)", "Commercial", "USD-M", 450.0, [
        ("2024-Q4", 318.0), ("2025-Q1", 340.6), ("2025-Q2", 358.4),
        ("2025-Q3", 372.1), ("2025-Q4", 388.2), ("2026-Q1", 412.8),
    ]),
    ("Net product revenue (Adipara)", "Commercial", "USD-M", 200.0, [
        ("2024-Q4",  48.4), ("2025-Q1",  72.1), ("2025-Q2", 102.0),
        ("2025-Q3", 134.6), ("2025-Q4", 168.9), ("2026-Q1", 196.4),
    ]),
    ("Time-to-market (avg)", "R&D", "years", 5.0, [
        ("2024-Q4",  6.9), ("2025-Q1",  6.7), ("2025-Q2",  6.5),
        ("2025-Q3",  6.3), ("2025-Q4",  6.2), ("2026-Q1",  6.1),
    ]),
]


def _expand_kpis() -> list[tuple]:
    rows: list[tuple] = []
    kpi_id = 1
    for name, function, unit, target, points in _KPI_DEFS:
        for period, value in points:
            rows.append((kpi_id, name, function, period, value, unit, target))
            kpi_id += 1
    return rows


KPIS = _expand_kpis()


# ---------------------------------------------------------------------------
# RAG corpus (3 mock prescribing docs)
# ---------------------------------------------------------------------------

DOCS = {
    # ---- Marketed product labels ----------------------------------------
    "zenoxitam_label.md": """# Zenoxitam (zenoxitan sodium) — Prescribing Information (Mock)

**Indication.** Zenoxitam is a once-daily neprilysin/AT1 inhibitor indicated for the treatment of symptomatic heart failure with reduced ejection fraction (HFrEF) in adults. May be used as a replacement for an ACE inhibitor or angiotensin-receptor blocker in patients with NYHA class II–IV.

**Dosage.** Starting dose is 50 mg twice daily. Titrate to a target dose of 200 mg twice daily as tolerated, doubling every 2–4 weeks based on blood pressure, renal function, and serum potassium. Reduce starting dose to 25 mg BID in patients with severe renal impairment (eGFR <30 mL/min/1.73 m²) or moderate hepatic impairment.

**Contraindications.** History of angioedema (including angioedema related to prior ACE-inhibitor or ARB therapy). Concomitant use with ACE inhibitors. Concomitant use with aliskiren in patients with diabetes mellitus. Pregnancy.

**Warnings & precautions.** Hypotension is the most frequently reported adverse reaction; monitor blood pressure during titration. Hyperkalemia may occur — measure serum potassium prior to initiation, after 1–2 weeks, then quarterly. Renal impairment may worsen, particularly in patients with bilateral renal artery stenosis. Discontinue immediately if angioedema occurs.

**Adverse reactions.** In the pivotal ALT-ZNX-301 trial (n=1187), the most common adverse reactions (incidence ≥5%) were hypotension (12%), hyperkalemia (8%), cough (7%), and dizziness (6%). Serious adverse reactions occurred in 4.1% of Zenoxitam-treated patients vs. 5.2% in the enalapril arm.

**Clinical efficacy.** ALT-ZNX-301 demonstrated a 23% relative-risk reduction (HR 0.77, 95% CI 0.69–0.86, p<0.001) in the composite endpoint of cardiovascular death or first heart-failure hospitalization vs. enalapril over a median 27-month follow-up. All-cause mortality was reduced by 16%.

**Drug interactions.** Avoid concomitant use with ACE inhibitors (washout ≥36 hours required). NSAIDs may increase risk of renal impairment and hyperkalemia. Lithium levels may increase.

**How supplied.** 50 mg, 100 mg, and 200 mg film-coated tablets in HDPE bottles of 60.
""",

    "cardiomax_label.md": """# CardioMax (lisinotram + amlonidine) — Prescribing Information (Mock)

**Indication.** CardioMax is a fixed-dose calcium-channel blocker / angiotensin-receptor blocker combination indicated for the treatment of essential hypertension in adults whose blood pressure is not adequately controlled on monotherapy.

**Dosage.** One tablet of 5 mg amlonidine / 80 mg lisinotram once daily, in the morning, with or without food. May be increased after 2 weeks to 10 mg / 160 mg if blood pressure response is inadequate. Maximum dose: 10 mg / 320 mg.

**Contraindications.** Hypersensitivity to dihydropyridine calcium-channel blockers or angiotensin-receptor blockers. Severe hepatic impairment (Child-Pugh C). Pregnancy. Use with aliskiren in diabetics.

**Warnings & precautions.** Symptomatic hypotension may occur after initiation, particularly in volume-depleted patients (e.g. those on high-dose diuretics). Correct volume and salt depletion before initiating. Angioedema, including airway involvement, has been reported — discontinue immediately. Hepatic impairment may increase exposure; titrate slowly.

**Adverse reactions.** Most frequent (≥3%): peripheral edema (8%), dry cough (5%), headache (4%), dizziness (3.5%), hypotension (3%). Angioedema occurred in 0.5% of patients in pooled trials.

**Clinical efficacy.** ALT-CDM-205 (n=448) showed a placebo-adjusted reduction of 14.2 mmHg in mean sitting systolic blood pressure and 8.6 mmHg in diastolic at week 24. ALT-CDM-310 (n=962) demonstrated a 17% relative reduction in major adverse cardiovascular events at 18 months.

**Drug interactions.** Strong CYP3A4 inhibitors (e.g. clarithromycin) increase amlonidine exposure. Concomitant ACE inhibitors are not recommended.
""",

    "lipidra_label.md": """# Lipidra (rosuvastin calcium) — Prescribing Information (Mock)

**Indication.** Lipidra is an HMG-CoA reductase inhibitor (statin) indicated as an adjunct to diet to (1) reduce LDL-C, total cholesterol, ApoB, and triglycerides in adults with primary hyperlipidemia or mixed dyslipidemia, (2) slow progression of atherosclerosis, and (3) reduce the risk of major cardiovascular events.

**Dosage.** Starting dose 10 mg once daily. Range 5–40 mg/day. Take at the same time each day, with or without food. The 40 mg dose should only be used in patients who have not achieved their LDL-C goal at 20 mg.

**Contraindications.** Active liver disease (unexplained persistent elevations of hepatic transaminases). Pregnancy and lactation. Concomitant cyclosporine.

**Warnings & precautions.** Skeletal muscle effects ranging from myalgia to rhabdomyolysis have been reported. Risk increases with higher doses, advanced age, hypothyroidism, renal impairment, and concomitant fibrate or niacin therapy. Monitor for unexplained muscle pain. Liver enzyme abnormalities — measure ALT before initiation and as clinically indicated thereafter.

**Adverse reactions.** Most common (≥2%): headache (5.5%), myalgia (5.0%), abdominal pain (3.0%), asthenia (2.5%), nausea (2.4%).

**Clinical efficacy.** ALT-LPD-302 (n=1094) demonstrated a 22% relative reduction in major cardiovascular events vs. placebo over a median 4.6 years of follow-up. Mean LDL-C reduction of 52% from baseline at 12 weeks (20 mg dose).
""",

    "glucotide_label.md": """# Glucotide (semaglide) — Prescribing Information (Mock)

**Indication.** Glucotide is a once-weekly GLP-1 receptor agonist indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus, and to reduce the risk of major adverse cardiovascular events in adults with T2DM and established cardiovascular disease.

**Dosage.** Starting dose 0.25 mg subcutaneously once weekly for 4 weeks (titration only — not effective for glycemic control). Increase to 0.5 mg weekly. May further increase to 1 mg or 2 mg weekly if additional glycemic control is needed, separated by at least 4 weeks.

**Contraindications.** Personal or family history of medullary thyroid carcinoma. Multiple endocrine neoplasia syndrome type 2. Hypersensitivity to semaglide.

**Warnings & precautions.** Boxed warning: Risk of thyroid C-cell tumors observed in rodent studies. Acute pancreatitis — discontinue if pancreatitis is suspected. Hypoglycemia when used with insulin or sulfonylurea (consider reducing those doses). Acute kidney injury, particularly with severe gastrointestinal reactions. Diabetic retinopathy complications in patients with a history of retinopathy.

**Adverse reactions.** Most common (≥5%): nausea (20%), diarrhea (12%), vomiting (9%), constipation (7%), abdominal pain (7%), decreased appetite (6%). Most are dose-dependent and transient.

**Clinical efficacy.** ALT-GLT-401 (n=1994) showed a 1.8% absolute HbA1c reduction at 52 weeks vs. 0.4% for placebo. ALT-GLT-402 demonstrated a 14% relative reduction in 3-point MACE (CV death, non-fatal MI, non-fatal stroke) over 3.5 years.
""",

    "adipara_label.md": """# Adipara (tirzelutide) — Prescribing Information (Mock)

**Indication.** Adipara is a dual GIP/GLP-1 receptor agonist indicated as an adjunct to a reduced-calorie diet and increased physical activity for chronic weight management in adults with obesity (BMI ≥ 30 kg/m²) or overweight (BMI ≥ 27) with at least one weight-related comorbidity.

**Dosage.** Starting dose 2.5 mg subcutaneously once weekly for 4 weeks. Increase by 2.5 mg every 4 weeks as tolerated to a maintenance dose of 5 mg, 10 mg, or 15 mg weekly. Inject in the abdomen, thigh, or upper arm.

**Contraindications.** Personal or family history of medullary thyroid carcinoma. MEN-2. Known severe hypersensitivity to tirzelutide.

**Warnings & precautions.** Boxed warning: Thyroid C-cell tumors. Severe gastrointestinal disease — not recommended in patients with severe gastroparesis. Pancreatitis. Gallbladder disease — cholelithiasis was observed in 1.7% of Adipara-treated patients. Suicidal ideation has been reported with weight-management drugs. Pregnancy: discontinue at least 2 months before a planned pregnancy.

**Adverse reactions.** Most common (≥5%): nausea (28%), diarrhea (19%), vomiting (12%), constipation (10%), dyspepsia (9%), abdominal pain (8%), injection-site reactions (5%).

**Clinical efficacy.** ALT-ADP-301 (n=1779) demonstrated a mean placebo-adjusted body-weight change of −18.7% at 68 weeks (15 mg dose). 86% of patients on the 15 mg dose achieved ≥5% weight loss.

**Commercial note (internal).** Q1 2026 net product revenue is tracking at $196.4M against a target of $200M — within 2% of plan despite supply constraints in the EU. Demand outstrips current commercial supply; capacity expansion at the Cambridge MA fill-finish line is on track for Q3 2026.
""",

    "neurolin_label.md": """# Neurolin (oxabilumab) — Prescribing Information (Mock)

**Indication.** Neurolin is a humanized monoclonal antibody indicated for the treatment of relapsing forms of multiple sclerosis (MS) including clinically isolated syndrome, relapsing-remitting disease, and active secondary progressive disease in adults.

**Dosage.** 300 mg intravenous infusion as the initial dose, followed by a second 300 mg infusion two weeks later. Subsequent doses: 600 mg IV every 6 months. Premedicate with methylprednisolone 100 mg IV (or equivalent) approximately 30 minutes before each infusion plus an antihistamine to mitigate infusion reactions.

**Contraindications.** Active hepatitis B infection. History of life-threatening infusion reaction to oxabilumab.

**Warnings & precautions.** Infusion reactions occurred in 34% of patients in pivotal trials, most commonly during the first infusion. Risk of serious infections, including herpes infections. Hepatitis B virus reactivation has been reported — screen all patients before initiation. Progressive multifocal leukoencephalopathy (PML) has been reported with anti-CD20 therapies. Reduced immunoglobulin levels may occur with long-term treatment.

**Adverse reactions.** Most common (≥10%): infusion reactions (34%), upper respiratory tract infection (15%), nasopharyngitis (12%), headache (12%).

**Clinical efficacy.** ALT-NRL-302 demonstrated a 47% relative reduction in annualized relapse rate vs. interferon beta-1a over 96 weeks (0.16 vs. 0.29; p<0.001). 12-week confirmed disability progression was reduced by 40%.
""",

    # ---- Operational briefs (the secret sauce for the chat demo) --------

    "qsm_deviation_brief_2026q1.md": """# Quality / Manufacturing — Deviation Brief, 2026-Q1 (Internal)

**Headline metric.** Batch right-first-time (RFT): **96.7%** vs. target 98.0% — third consecutive quarter trending up from a 2024-Q4 low of 93.1%, but still 1.3 points below target.

**Material deviations driving the gap.**

1. *Cambridge fill-finish line (Adipara).* Three batches in February required reprocessing due to undersized vial-stopper alignment after a vendor changeover. Root cause: tooling tolerance specification was within historical norms but outside the new stopper supplier's manufacturing variance. CAPA: tightened receiving-spec tolerance, weekly first-piece inspection, supplier audit closed Mar 18.

2. *Singapore packaging line (Glucotide).* Two batches held for visual inspection escapes (foil-seal alignment). Both released after 100% manual inspection and stability comparison; no patient impact. CAPA: vision-system retraining with expanded reject criteria.

3. *Cork API plant (Zenoxitam intermediate).* One batch out-of-spec for residual solvent (acetone). Investigation identified an intermittent dryer thermocouple drift; thermocouple replaced and verified across all dryer skids.

**Forward look.** Q2 RFT forecast: 97.4% (mid-point). Achieving the 98% target this calendar year requires the Cambridge stopper-tooling project to land on schedule (planned May 12) and zero new vendor-introduced variance events. Capacity ramp for Adipara remains the single largest operational risk.

**Right-first-time deviation rate (inverse metric):** 3.3% in Q1 vs. 2.0% target — same drivers as above. Trending toward target by Q3.
""",

    "commercial_brief_2026q1.md": """# Commercial — Performance Brief, 2026-Q1 (Internal)

**Net product revenue (Zenoxitam): $412.8M** vs. target $450M. Tracking 8% below plan but +6.3% Q/Q growth and +30% Y/Y. Drivers: continued formulary uptake in the US Medicare Advantage segment, payer wins in Germany and Japan post-EMA expansion, and the pivotal ALT-ZNX-302 OS data presentation at ESC 2025 (Aug). Headwinds: increased competitive pressure from generic sacubitril/valsartan in Eastern Europe, slower-than-expected uptake in primary care vs. cardiology specialty.

**Net product revenue (Adipara): $196.4M** vs. target $200M. Effectively at plan despite EU supply constraints. Adipara is now the fastest-growing asset in the portfolio with five consecutive quarters of >25% Q/Q growth. Capacity expansion at Cambridge MA fill-finish (Q3 2026) will unlock the EU and ANZ markets fully.

**Top 5 by Q1 net product revenue.**
1. Zenoxitam — $412.8M
2. Adipara — $196.4M
3. Glucotide — $148.0M (mature, low single-digit Y/Y growth)
4. Mammavex — $94.3M (mature, biosimilar erosion in Europe)
5. Rheumatel — $76.8M (mature, declining post-loss-of-exclusivity in 2024)

**Sales-force productivity.** Cardiology field (Zenoxitam, CardioMax, Lipidra) productivity index 1.12 (calls/rep/day vs. cohort average) — strongest in three years. Endocrinology field (Glucotide, Adipara) running at 1.28 with capacity stretched; field-force expansion of 22 territories planned for July.

**Forward look.** FY2026 Zenoxitam revenue guidance: $1.85–1.95B (raised from $1.75–1.85B at Q4 earnings). Adipara guidance: $850–950M, capacity-constrained at the upper end.
""",

    "clinops_brief_2026q1.md": """# Clinical Operations — Performance Brief, 2026-Q1 (Internal)

**On-time trial enrollment: 78.4%** vs. target 85%. Recovering from a 2024-Q4 low of 64.2% — five consecutive quarters of improvement. Closing the remaining 6.6-point gap by Q3 is the team's primary OKR.

**Site activation cycle time: 96 days** vs. target 90 days. Down from 142 days a year ago. Driver of improvement: standardized contracting templates, central IRB pre-negotiation, and the new site-readiness scorecard rolled out in 2025-Q2.

**Trials below enrollment plan.**
1. *ALT-ONK-301 (Onkoria, NSCLC).* 301 / 720 enrolled (42%). Site activations in Japan (n=18 sites planned, 11 active) and Brazil (n=12 planned, 4 active) running 8–10 weeks behind. Mitigation: dedicated regional CRO partnership signed Mar 2026, recovery plan targets 85% target by Dec.
2. *ALT-COG-301 (Cognivex, Alzheimer's).* 642 / 1500 enrolled (43%). Recruitment is challenging by design — biomarker-confirmed early AD with strict cognitive-screening criteria. Slower than plan but on the new realistic timeline approved at PRC Feb 2026.
3. *ALT-LPV-301 (Lupavex, SLE).* 624 / 1100 enrolled (57%). On track.
4. *ALT-HMX-301 (Hemophilex, gene therapy).* 113 / 220 enrolled (51%). On track for ultra-rare population.

**Protocol deviation rate: 4.2%** vs. target 3.0%. The persistent miss is concentrated in two trials — ALT-ONK-301 (informed-consent re-versioning errors at high-turnover sites) and ALT-COG-301 (cognitive-screening test timing windows). CAPA in flight for both.
""",

    "pv_safety_bulletin_2026q1.md": """# Pharmacovigilance — Safety Bulletin, 2026-Q1 (Internal)

**Adverse-event reporting SLA: 92.5%** vs. target 95.0%. Steady five-quarter improvement from 88.0% but still below the 15-day reporting compliance bar set by ICH E2D. Operational gap is concentrated in literature-screening intake — 73% SLA — vs. 99% for spontaneous reports.

**Signal detection cycle time: 15 days** vs. target 14 days. Within statistical tolerance. The new automated disproportionality analysis pipeline (rolled out in 2025-Q4) cut average detection cycle from 22 days to 15.

**Active signal investigations.**

1. *Zenoxitam — angioedema in patients with prior ARB exposure.* 14 cases reported globally in Q1, 9 of whom had documented prior ARB exposure (vs. expected ~5 based on label baseline). Investigation status: confirmed signal, label-update committee convened Mar 28. Likely outcome: strengthened warning language for prior-ARB-exposed patients. Not a contraindication change at this time.

2. *Onkoria — pneumonitis (Grade ≥3) in real-world setting.* Real-world rate (4.6%) trending higher than pivotal-trial rate (4.0%). Further investigation underway with the ALT-ONK-301 sponsor team. Pulmonary monitoring schedule already in label.

3. *Adipara — gallbladder events.* Cholelithiasis cases consistent with class effect; rate (1.9%) is within the labeled 1.7%–2.5% range. No signal change; routine monitoring continues.

**No serious signals affecting Glucotide, CardioMax, Lipidra, Neurolin, Migravox, Hematix, Mammavex, Rheumatel, Crohnasil, or Thyrolex this quarter.**
""",

    # ---- Strategic / external --------------------------------------------

    "competitive_landscape_2026.md": """# Competitive Landscape — Mock Brief, 2026

**Cardiology — heart failure (HFrEF).** Zenoxitam (Altigen) is the second-to-market neprilysin/AT1 in its class. Sacubitril/valsartan (originator) lost composition-of-matter exclusivity in late 2024 and authorized generics are now in 14 markets. Zenoxitam's competitive positioning rests on the ALT-ZNX-302 long-term mortality data (16% all-cause mortality reduction vs. enalapril) and a once-daily option for the 200 mg dose. Watch: an emerging oral cardiac myosin activator (competitor pipeline, Phase III readout expected 2027).

**Cardiology — hypertension.** CardioMax sits in a crowded fixed-dose-combination space. Differentiator: the only CCB/ARB combo with full Asian-population PK data and a renal-impairment dosing guide. Mature product; growth flat.

**Oncology — NSCLC.** Onkoria (Phase III) is a third-wave checkpoint inhibitor entering a market dominated by pembrolizumab and nivolumab. Differentiation hinges on the ALT-ONK-301 PFS readout (expected H2 2027) and a planned biomarker-stratified efficacy story for PD-L1 ≥50%.

**Endocrinology — obesity.** Adipara (dual GIP/GLP-1) competes head-on with tirzepatide and semaglutide-2.4mg. The 18.7% mean weight loss observed in ALT-ADP-301 is competitive with class leaders. Capacity, not efficacy, is the binding constraint for the next 12 months.

**Endocrinology — T2DM.** Glucotide is mature; growth is single-digit. The strategic question is the cardio-renal positioning vs. SGLT2i combinations.

**Immunology — psoriasis (pipeline).** Immunoxa (Phase II) entering a saturated IL-17 / IL-23 market. Differentiation will need to come from durability of response or oral formulation; current data is competitive but not differentiated.

**Rare disease — hemophilia A (gene therapy).** Hemophilex (Phase III) is a one-time gene therapy. Two competitor gene therapies are already approved in the EU and US; commercial success depends on durability of factor-VIII expression beyond 5 years and pricing/access strategy.
""",

    # ---- Trial protocol summary (kept from original demo) ---------------

    "trial_protocol_onkoria.md": """# ALT-ONK-301 — Phase III Protocol Summary (Mock)

**Title.** A randomized, double-blind, placebo-controlled trial of Onkoria plus standard of care vs. placebo plus standard of care in patients with previously untreated stage IV non-small-cell lung cancer (NSCLC) with PD-L1 ≥1%.

**Sponsor.** Altigen Pharma, Cambridge, MA.

**Design.** 1:1 randomization, stratified by PD-L1 expression (1–49% vs. ≥50%) and ECOG performance status (0 vs. 1).

**Enrollment.** Target 720 patients across 142 sites in North America, Europe, and Asia–Pacific. As of 2026-Q1, 301 patients are enrolled (42% of target). Recruitment is currently behind plan due to delayed site activations in Japan and Brazil.

**Primary endpoint.** Progression-free survival (PFS) per RECIST v1.1 by blinded independent central review.

**Key secondary endpoints.** Overall survival (OS), objective response rate (ORR), duration of response (DoR), and safety/tolerability per CTCAE v5.0.

**Notable risks.** Pneumonitis (Grade ≥3) has been observed in 4% of Onkoria-treated patients in earlier studies; routine pulmonary monitoring is required at weeks 4, 8, and every 8 weeks thereafter.
""",
}


def reset(db_path: Path) -> None:
    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)


def seed_db(db_path: Path) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.executescript(SCHEMA)
        conn.executemany("INSERT INTO products VALUES (?,?,?,?,?,?)", PRODUCTS)
        conn.executemany("INSERT INTO clinical_trials VALUES (?,?,?,?,?,?,?,?)", TRIALS)
        conn.executemany("INSERT INTO kpis VALUES (?,?,?,?,?,?,?)", KPIS)
        conn.commit()


def seed_docs(docs_dir: Path) -> None:
    docs_dir.mkdir(parents=True, exist_ok=True)
    for name, body in DOCS.items():
        (docs_dir / name).write_text(body, encoding="utf-8")


def main() -> None:
    reset(DB_PATH)
    seed_db(DB_PATH)
    seed_docs(DB_PATH.parent / "docs")
    print(f"Seeded {DB_PATH}")
    print(f"  products        : {len(PRODUCTS)}")
    print(f"  clinical_trials : {len(TRIALS)}")
    print(f"  kpis            : {len(KPIS)}")
    print(f"  RAG docs        : {len(DOCS)} → {DB_PATH.parent / 'docs'}")


if __name__ == "__main__":
    main()
