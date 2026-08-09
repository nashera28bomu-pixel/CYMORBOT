import pdfplumber, json, re

SRC = '/mnt/user-data/uploads/DEGREE_CUTOFFS_14-07-2025.pdf'
OUT = '/home/claude/cymor-kuccps-advisor/backend/src/data/cutoffs_raw.json'

records = []
current_category = None
warnings = []

def clean_num(v):
    if v is None:
        return None
    v = v.strip()
    if v in ('', '-', '—', 'N/A', 'n/a'):
        return None
    v = v.replace(',', '')
    try:
        return float(v)
    except ValueError:
        return None

with pdfplumber.open(SRC) as pdf:
    for pageno, page in enumerate(pdf.pages, start=1):
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if not row:
                    continue
                # Normalize row length
                row = [c.strip() if isinstance(c, str) else c for c in row]
                # Header row
                if row[0] == '#' or (row[0] and 'PROG CODE' in (row[1] or '')):
                    continue
                # Category header row: only first cell populated, rest None/empty
                non_empty = [c for c in row if c]
                if len(non_empty) == 1 and row[0] and not row[0].isdigit():
                    current_category = row[0].strip()
                    continue
                # Data row: expects at least # , PROG CODE, INSTITUTION, PROGRAMME + 7 years
                if not row[0] or not re.match(r'^\d+$', row[0]):
                    continue
                if len(row) < 11:
                    # pad
                    row = row + [None] * (11 - len(row))
                _, prog_code, institution, programme, y18, y19, y20, y21, y22, y23, y24 = row[:11]
                if not prog_code or not institution or not programme:
                    warnings.append(f"page {pageno}: incomplete row {row}")
                    continue
                cutoff_history = []
                for year, val in zip([2018,2019,2020,2021,2022,2023,2024], [y18,y19,y20,y21,y22,y23,y24]):
                    n = clean_num(val)
                    if n is not None:
                        cutoff_history.append({"year": year, "score": n})
                latest = None
                if cutoff_history:
                    latest = sorted(cutoff_history, key=lambda x: x['year'], reverse=True)[0]
                records.append({
                    "programmeCode": prog_code.strip(),
                    "institutionName": institution.strip(),
                    "programmeName": programme.strip(),
                    "category": current_category,
                    "cutoffHistory": cutoff_history,
                    "latestCutoff": latest,
                    "sourcePage": pageno
                })

print(f"Extracted {len(records)} programme records, {len(warnings)} warnings")
with open(OUT, 'w') as f:
    json.dump({"generatedFrom": "DEGREE_CUTOFFS_14-07-2025.pdf", "count": len(records), "records": records, "warnings": warnings[:50]}, f, indent=2)
print("Saved to", OUT)
