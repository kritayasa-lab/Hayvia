# Sense Enrichment V1 — Claude Code Task

Input: `sense_enrichment_queue.csv`
Output: `sense_enrichment_results.csv`

Process the file in deterministic batches of 100 rows. The batch_id field is already assigned. Do not reorder rows inside a batch.

## Immutable source fields
Never alter: source_id, sense_group_id, band, source_number, canonical_word, variants, pinyin, meaning_english, source_pos_label, cross_band_status, same_written_form_cross_band_flag, sense_group_size, priority.

## Fill only
thai_meaning, part_of_speech_normalized, pos_basis, pos_confidence, example_zh, example_pinyin, example_thai, enrichment_confidence, review_flag, review_reason.

## Sense rules
1. Treat source pinyin + source English meaning + source POS label as the evidence for the sense.
2. Never merge homographs just because Chinese characters are identical.
3. Same sense across multiple bands may reuse the same enrichment, but provenance rows must remain separate.
4. Variants marked by ｜ are aliases/variants, not automatically separate senses.
5. Do not invent a missing sense from outside context when the source does not support it. Mark review_flag=true when uncertain.

## Thai meaning
Give a concise natural Thai gloss matching the source sense. Avoid adding meanings not present in meaning_english.

## POS
Normalize to one of: noun, verb, adjective, adverb, pronoun, preposition, conjunction, particle, auxiliary, numeral, measure_word, classifier, interjection, complement, other.
Use source_pos_label first. If absent, infer only when the English meaning strongly supports it; otherwise use other + low confidence + review_flag=true.

## Examples
One short, natural Chinese sentence appropriate for the vocabulary level. It must clearly demonstrate the target sense. Then provide accurate pinyin and Thai translation. Avoid creating a sentence that accidentally demonstrates a different sense.

## QA
Set review_flag=true for polysemy, doubtful POS, awkward source meaning, variant ambiguity, or example ambiguity. Do not silently fix the source.

Validate every output row against `sense_enrichment_result_schema.json`.
