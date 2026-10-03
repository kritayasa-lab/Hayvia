# Sense Enrichment V1

Thai meaning, normalized POS, one example sentence (Chinese, pinyin, Thai),
confidence and review flags for every row of `input/sense_enrichment_queue.csv`
(4,316 rows, BATCH-01 – BATCH-44). Word families and semantic groups are not
created here.

## Layout

| Path | What |
|---|---|
| `TASK_PROMPT.md` | The task specification. |
| `input/sense_enrichment_queue.csv` | Source queue (unchanged). |
| `schema/sense_enrichment_result_schema.json` | Result schema (as supplied). |
| `enrichment/BATCH-NN.txt` | Hand-authored enrichments, one `^`-separated line per sense group. |
| `scripts/build.py` | Merges enrichments into the queue, validates, writes outputs. |
| `output/batches/BATCH-NN.csv` | Validated result per batch. |
| `output/sense_enrichment_results.csv` | All batches combined. |

Rebuild and validate: `python3 scripts/build.py all` (or a single `BATCH-NN`).

## Validation

`build.py` refuses to write a batch unless every row:

- passes the schema (required fields, enums, boolean `review_flag`);
- keeps every source field identical to the queue, in the same order;
- keeps queue-prefilled `part_of_speech_normalized` values;
- has an `example_zh` containing the headword;
- has `review_flag=true` when `review_reason` is set, POS is `other`, or confidence is `low`.

Rows that share a `sense_group_id` (cross-band duplicates) reuse one
enrichment, including across batches; their provenance rows stay separate.

## Conventions

- `pos_basis`: `source_label` (queue label, or a sense-group sibling's label),
  `source_english` (POS read from the English gloss), `lexical_inference`
  (Chinese usage overrides a gloss that reads as another POS), `ambiguous`
  (`other` — prefixes/suffixes, set phrases, A-not-A forms).
- `noun|measure_word` is kept where the queue already had it (7 rows); each
  part is checked against the schema enum.
- `review_reason` is tagged so it can be filtered:
  `polysemy`, `source_gloss`, `source_mismatch`, `variant`, `pos_doubtful`, `example`.
  A row is counted as an **ambiguous sense** when it has a `polysemy`,
  `source_mismatch` or `variant` tag.

## Totals

| | Rows |
|---|---|
| Completed | 4,316 / 4,316 |
| Flagged for review | 1,378 |
| Ambiguous senses | 711 |
| Confidence high / medium / low | 2,995 / 1,230 / 91 |

Reason tags (a row can carry several): polysemy 658, source_gloss 411,
pos_doubtful 355, variant 67, example 28, source_mismatch 5.

## Source issues found (not fixed in the source)

- **Glosses merged across adjacent rows** (one entry's meaning spilled into the
  next): 处理/传, 关系/关注, 推广/推进, 熟人/属, 预习/员, 晒/闪, 不顾/不利,
  过于/害, 加以/夹, 深度/神, 宿舍/酸甜苦辣, 线索/献/乡, 瞧/琴, 上级/上下.
- **Gloss belongs to a different word or reading**: 叫 (gloss is 较),
  难 nán (gloss is nàn), 为 wèi "by", 地方 dìfang "local".
- **Wrong or misleading glosses**: e.g. 贵 "noble", 这 "Here", 亿 "Billion",
  吃力 "Sweaty", 处分 "prescription", 挑战 "Dekaron", 眼泪 "eyedrop".
- **Malformed rows**: 们 and 者 have the meaning inside the pinyin field;
  元旦 pinyin is `uándàn`.
