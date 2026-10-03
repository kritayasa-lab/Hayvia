#!/usr/bin/env python3
"""Merge hand-authored sense enrichments into the queue, validate, and save.

Usage: python3 build.py BATCH-01 [BATCH-02 ...]   (or: python3 build.py all)

Enrichment files live in ../enrichment/<BATCH>.txt, one record per line,
fields separated by "^", columns:
  source_id ^ pos ^ pos_confidence ^ thai_meaning ^ example_zh ^
  example_pinyin ^ example_thai ^ enrichment_confidence ^ review_reason

- One line per sense group is enough: rows sharing a sense_group_id reuse it,
  including groups first enriched in an earlier batch.
- `pos` blank keeps the queue's part_of_speech_normalized (or a sense-group
  sibling's source-labelled POS). Otherwise `pos` is a POS value with an
  optional basis suffix: "@E" source_english (default), "@L" lexical_inference.
  "other" always gets pos_basis=ambiguous.
- A non-empty review_reason sets review_flag=true. Reasons are tagged
  ("polysemy: ...; source_gloss: ..."); AMBIGUOUS_TAGS mark the sense itself
  as ambiguous for reporting.
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE = os.path.join(ROOT, "input", "sense_enrichment_queue.csv")
SCHEMA = os.path.join(ROOT, "schema", "sense_enrichment_result_schema.json")
ENRICH_DIR = os.path.join(ROOT, "enrichment")
OUT_DIR = os.path.join(ROOT, "output")
BATCH_DIR = os.path.join(OUT_DIR, "batches")

# Every queue column is a source field and is copied through untouched,
# except part_of_speech_normalized, which the schema lets us fill.
SOURCE_FIELDS = [
    "batch_id", "source_id", "sense_group_id", "band", "source_number",
    "canonical_word", "variants", "pinyin", "meaning_english",
    "source_pos_label", "cross_band_status",
    "same_written_form_cross_band_flag", "sense_group_size", "priority",
]
OUT_COLUMNS = [
    "batch_id", "source_id", "sense_group_id", "band", "source_number",
    "canonical_word", "variants", "pinyin", "meaning_english", "source_pos_label",
    "part_of_speech_normalized", "pos_basis", "pos_confidence",
    "cross_band_status", "same_written_form_cross_band_flag", "sense_group_size",
    "priority", "thai_meaning", "example_zh", "example_pinyin", "example_thai",
    "enrichment_confidence", "review_flag", "review_reason",
]
ENRICH_COLUMNS = [
    "source_id", "pos", "pos_confidence", "thai_meaning", "example_zh",
    "example_pinyin", "example_thai", "enrichment_confidence", "review_reason",
]
BASIS_SUFFIX = {"E": "source_english", "L": "lexical_inference"}
REASON_TAGS = {
    "polysemy", "pos_doubtful", "source_gloss", "source_mismatch",
    "variant", "example",
}
AMBIGUOUS_TAGS = {"polysemy", "source_mismatch", "variant"}


def load_schema():
    schema = json.load(open(SCHEMA, encoding="utf-8"))
    enums = {}
    for field, spec in schema["fields"].items():
        if spec.startswith("enum:"):
            enums[field] = {v.strip() for v in spec[5:].split(",")}
    return schema, enums


def validate(row, schema, enums):
    """Validate one output row against the field-spec schema."""
    errs = []
    for field in schema["required"]:
        if field not in row:
            errs.append(f"missing required {field}")
        elif field != "review_flag" and not str(row[field]).strip():
            errs.append(f"empty required {field}")
    for field, spec in schema["fields"].items():
        v = row.get(field)
        if field in enums:
            # Multi-POS values carried over from the queue ("noun|measure_word")
            # are checked part by part.
            parts = v.split("|") if field == "part_of_speech_normalized" else [v]
            bad = [p for p in parts if p not in enums[field]]
            if bad:
                errs.append(f"{field}={v!r} not in enum")
        elif spec == "boolean":
            if v not in ("true", "false"):
                errs.append(f"{field}={v!r} not boolean")
    if row["review_flag"] == "true" and not row["review_reason"]:
        errs.append("review_flag=true without review_reason")
    if row["review_flag"] == "false" and row["review_reason"]:
        errs.append("review_reason set but review_flag=false")
    if row["part_of_speech_normalized"] == "other" and row["review_flag"] != "true":
        errs.append("POS other must be flagged")
    if row["enrichment_confidence"] == "low" and row["review_flag"] != "true":
        errs.append("low confidence must be flagged")
    return errs


def load_queue():
    with open(QUEUE, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_enrichment(batch):
    path = os.path.join(ENRICH_DIR, f"{batch}.txt")
    data = {}
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.split("^")
            if len(parts) != len(ENRICH_COLUMNS):
                sys.exit(f"{path}:{n}: expected {len(ENRICH_COLUMNS)} fields, got {len(parts)}")
            rec = dict(zip(ENRICH_COLUMNS, (p.strip() for p in parts)))
            if rec["source_id"] in data:
                sys.exit(f"{path}:{n}: duplicate source_id {rec['source_id']}")
            data[rec["source_id"]] = rec
    return data


def reason_tags(reason):
    return {m.group(1) for m in re.finditer(r"(?:^|;\s*)([a-z_]+):", reason)}


def headword(word):
    """Strip homograph superscripts and pattern ellipses (e.g. "…极了 …")."""
    return re.sub(r"[¹²³⁴⁵⁶⁷⁸⁹⁰…\s]", "", word)


def resolve_pos(r, e, sibling_pos):
    if r["source_pos_label"]:
        return r["part_of_speech_normalized"] or e["pos"], "source_label"
    if not e["pos"]:
        if sibling_pos.get(r["sense_group_id"]):
            return sibling_pos[r["sense_group_id"]], "source_label"
        return r["part_of_speech_normalized"], "source_english"
    pos, _, suffix = e["pos"].partition("@")
    if pos == "other":
        return pos, "ambiguous"
    return pos, BASIS_SUFFIX[suffix or "E"]


def earlier_groups(batch, queue):
    """Sense-group enrichments authored in batches before this one."""
    sid_group = {r["source_id"]: r["sense_group_id"] for r in queue}
    groups = {}
    for b in sorted({r["batch_id"] for r in queue}):
        if b >= batch or not os.path.exists(os.path.join(ENRICH_DIR, f"{b}.txt")):
            continue
        for sid, rec in load_enrichment(b).items():
            groups.setdefault(sid_group[sid], rec)
    return groups


def build_batch(batch, queue, sibling_pos, schema, enums):
    rows = [r for r in queue if r["batch_id"] == batch]
    if not rows:
        sys.exit(f"no rows for {batch}")
    enrich = load_enrichment(batch)
    by_group = earlier_groups(batch, queue)
    for r in rows:
        if r["source_id"] in enrich and r["sense_group_id"] not in by_group:
            by_group.setdefault(r["sense_group_id"], enrich[r["source_id"]])
    unknown = set(enrich) - {r["source_id"] for r in rows}
    if unknown:
        sys.exit(f"{batch}: enrichment for source_ids not in batch: {sorted(unknown)}")

    out, errors = [], []
    for r in rows:
        e = enrich.get(r["source_id"]) or by_group.get(r["sense_group_id"])
        if e is None:
            errors.append(f"{r['source_id']}: no enrichment")
            continue
        o = {k: r[k] for k in SOURCE_FIELDS}
        pos, basis = resolve_pos(r, e, sibling_pos)
        o["part_of_speech_normalized"] = pos
        o["pos_basis"] = basis
        o["pos_confidence"] = e["pos_confidence"]
        for k in ["thai_meaning", "example_zh", "example_pinyin", "example_thai",
                  "enrichment_confidence", "review_reason"]:
            o[k] = e[k]
        o["review_flag"] = "true" if e["review_reason"] else "false"
        out.append(o)

        sid = r["source_id"]
        errors += [f"{sid}: schema: {m}" for m in validate(o, schema, enums)]
        for k in SOURCE_FIELDS:
            if o[k] != r[k]:
                errors.append(f"{sid}: source field {k} changed")
        if r["source_pos_label"] and e["pos"]:
            errors.append(f"{sid}: POS given for a source-labelled row")
        if headword(r["canonical_word"]) not in o["example_zh"]:
            errors.append(f"{sid}: example_zh does not contain the headword")
        tags = reason_tags(o["review_reason"])
        if tags - REASON_TAGS:
            errors.append(f"{sid}: unknown review tags {tags - REASON_TAGS}")
        if o["review_reason"] and not tags:
            errors.append(f"{sid}: review_reason lacks a tag")
    if [o["source_id"] for o in out] != [r["source_id"] for r in rows]:
        errors.append("row order or count differs from queue")
    return out, errors


def write_csv(path, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_COLUMNS)
        w.writeheader()
        w.writerows(rows)


def stats(rows):
    flagged = [r for r in rows if r["review_flag"] == "true"]
    ambiguous = [r for r in flagged if reason_tags(r["review_reason"]) & AMBIGUOUS_TAGS]
    return len(rows), len(flagged), len(ambiguous)


def main(argv):
    schema, enums = load_schema()
    queue = load_queue()
    sibling_pos = {}
    for r in queue:
        if r["source_pos_label"] and r["part_of_speech_normalized"]:
            sibling_pos.setdefault(r["sense_group_id"], r["part_of_speech_normalized"])
    batches = sorted({r["batch_id"] for r in queue})
    targets = batches if argv == ["all"] else argv
    os.makedirs(BATCH_DIR, exist_ok=True)
    failed = False
    for batch in targets:
        out, errors = build_batch(batch, queue, sibling_pos, schema, enums)
        if errors:
            failed = True
            print(f"{batch}: FAILED validation ({len(errors)} issues)")
            for e in errors:
                print("  ", e)
            continue
        write_csv(os.path.join(BATCH_DIR, f"{batch}.csv"), out)
        done, flagged, amb = stats(out)
        print(f"{batch}: valid  completed={done} flagged={flagged} ambiguous={amb}")

    all_rows = []
    for batch in batches:
        p = os.path.join(BATCH_DIR, f"{batch}.csv")
        if os.path.exists(p):
            with open(p, encoding="utf-8", newline="") as f:
                all_rows.extend(csv.DictReader(f))
    write_csv(os.path.join(OUT_DIR, "sense_enrichment_results.csv"), all_rows)
    done, flagged, amb = stats(all_rows)
    print(f"TOTAL saved: completed={done}/{len(queue)} flagged={flagged} ambiguous={amb}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
