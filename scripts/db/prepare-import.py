#!/usr/bin/env python3
"""Parse the BDGest-style CSV export and produce a clean JSON list of albums
to import, applying the mapping validated with the user:
  - Only real "ALBUM" rows (the file also contains REVUE and a third
    para-BD section, each with their own inline header row).
  - Wishlist=1 rows excluded (not actually owned).
  - isbn is optional; other fields map directly; assorted human-readable
    extras (shelf location, price, dedication, read status...) are folded
    into `comment` since the app has no dedicated fields for them yet.
"""
import csv
import json
import re
import sys

if len(sys.argv) < 2:
    sys.exit("Usage: prepare-import.py <source.csv> [out.json]")
SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/import_rows.json"


def clean(s):
    s = (s or "").strip()
    return s if s else None


def normalize_isbn(raw):
    raw = clean(raw)
    if not raw:
        return None
    digits = re.sub(r"[^0-9Xx]", "", raw)
    return digits or None


def parse_date(raw):
    raw = clean(raw)
    if not raw:
        return None
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", raw)
    if not m:
        return None
    dd, mm, yyyy = m.groups()
    return f"{yyyy}-{mm}-{dd}"


def build_comment(row):
    parts = []
    if clean(row["Commentaire"]):
        parts.append(row["Commentaire"].strip())
    if clean(row["Cote"]):
        parts.append(f"Cote : {row['Cote'].strip()}")
    if clean(row["Collection"]):
        parts.append(f"Collection : {row['Collection'].strip()}")
    if clean(row["NumA"]):
        parts.append(f"Réf. complémentaire : {row['NumA'].strip()}")
    prix = clean(row["PrixAchat"])
    if prix:
        parts.append(f"Prix d'achat : {prix} €")
    # Perso1-4 dropped: turns out to hold family first names / an unclear
    # "oui" flag rather than fictional characters (Perso4 is always "0") —
    # meaning too ambiguous to carry over without mislabeling it.
    if row["Dedicace"].strip() == "1":
        date_ded = parse_date(row["DateDedicace"])
        parts.append("Dédicacé" + (f" le {date_ded}" if date_ded else ""))
    if row["Lu"].strip() == "1":
        date_lu = parse_date(row["DateLu"])
        parts.append("Lu" + (f" le {date_lu}" if date_lu else ""))
    if row["AVendre"].strip() == "1":
        parts.append("À vendre")
    return "\n".join(parts) if parts else None


def main():
    with open(SRC, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = [r for r in reader if r.get("Table") == "ALBUM"]

    excluded_wishlist = 0
    out = []
    for r in rows:
        if r["Wishlist"].strip() == "1":
            excluded_wishlist += 1
            continue

        series_name = clean(r["Serie"])
        if series_name and series_name.startswith("(AUT)"):
            series_name = None

        issue_number = None
        num = clean(r["Num"])
        if num and num.isdigit():
            issue_number = int(num)

        out.append({
            "source_id": r["IdAlbum"],
            "isbn": normalize_isbn(r["ISBN"]),
            "title": clean(r["Titre"]) or clean(r["Serie"]) or "(Sans titre)",
            "series_name": series_name,
            "issue_number": issue_number,
            "publisher": clean(r["Editeur"]),
            "writer": clean(r["Scenariste"]),
            "illustrator": clean(r["Dessinateur"]),
            "legal_deposit": clean(r["DL"]),
            "purchase_date": parse_date(r["DateAchat"]),
            "comment": build_comment(r),
        })

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    no_isbn = sum(1 for a in out if not a["isbn"])
    print(f"ALBUM rows: {len(rows)}")
    print(f"Excluded (wishlist): {excluded_wishlist}")
    print(f"To import: {len(out)}")
    print(f"  of which without ISBN: {no_isbn}")
    print(f"Written to: {OUT}")


if __name__ == "__main__":
    main()
