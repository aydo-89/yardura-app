#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Dog Poop Evaluator — class-aware thresholds + optional 2nd-stage "worm check"

Examples:
  python3 dog_poop_eval_suite.py \
    --models gpt-4o,gpt-4o-mini \
    --sample 200 \
    --outdir eval_out \
    --conf 0.5 \
    --conf_per_class '{"Worms":0.2}' \
    --worm_second_stage \
    --fewshot fewshot.json \
    --debug
"""

import os, json, argparse, random, time, csv, sys, re
from pathlib import Path
from typing import Optional, List, Dict, Tuple
import requests

# ==== Config ====
CLASSES = ["Blood","Diarrhoea","Lack Of Water","Mucus","Normal","Soft","Worms"]

DEFAULT_MODELS = [
    # These worked in your runs; keep it simple/reliable
    "gpt-4o", "gpt-4o-mini"
]

DEFAULT_SAMPLE = 100
DEFAULT_DATASET_DIR = "dog_pooproject"
DEFAULT_OUTDIR = "eval_out"
TIMEOUT = 120

SESS = requests.Session()

# ==== Data Loading ====

def load_annotations(base_dir: Path):
    """
    Expects Roboflow-style JSONL files that contain messages[] with an image_url and an
    assistant message containing the ground truth labels as text.

    Returns: list of {image_url, ground:[labels]}
    """
    files = sorted(base_dir.glob("_annotations.*.jsonl"))
    if not files:
        raise RuntimeError(f"No annotation files found in {base_dir}")
    items = []
    for fp in files:
        with fp.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                obj = json.loads(line)
                msgs = obj.get("messages", [])
                if not msgs:
                    continue
                image_url = None
                for m in msgs:
                    if m.get("role") == "user" and isinstance(m.get("content"), list):
                        for part in m["content"]:
                            if part.get("type") == "image_url":
                                iu = part.get("image_url", {})
                                image_url = iu.get("url")
                if not image_url:
                    continue
                # Extract ground truth from the last assistant text that mentions classes
                gt = set()
                for m in reversed(msgs):
                    if m.get("role") == "assistant":
                        text = (m.get("content") or "").lower()
                        for cat in CLASSES:
                            if cat.lower() in text:
                                gt.add(cat)
                        if gt:
                            break
                if not gt:
                    continue
                items.append({"image_url": image_url, "ground": sorted(gt)})
    return items

def load_fewshot(path: Optional[Path]):
    """
    Few-shot JSON:
    [
      {"image_url":"https://…/a.jpg","labels":["Normal"]},
      {"image_url":"https://…/b.jpg","labels":["Diarrhoea","Soft"]},
      {"image_url":"https://…/worms_clear.jpg","labels":["Worms"]}
    ]
    """
    if not path:
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    fs = []
    for ex in data:
        url = ex.get("image_url")
        labs = [l for l in ex.get("labels", []) if l in CLASSES]
        if url and labs:
            fs.append({"image_url": url, "labels": labs})
    return fs

# ==== Prompting / Calls ====

def build_prompt_text(classes=CLASSES):
    # Strong nudge for rare class "Worms"
    return (
        "Classify the dog waste photo. Allowed tags (zero or more): "
        + "; ".join(classes)
        + ". Return ONLY valid JSON with this schema:\n"
        + '{ "tags": ["<subset of allowed tags>"], '
        + '"confidence": {"Blood":0-1,"Diarrhoea":0-1,"Lack Of Water":0-1,'
        + '"Mucus":0-1,"Normal":0-1,"Soft":0-1,"Worms":0-1} }\n'
        + "Important: Carefully check for WORM INFESTATION (label 'Worms'). "
          "If worms are visible, include 'Worms' even if other tags also apply."
    )

def build_messages_chat(image_url: str, fewshot: list, classes=CLASSES):
    system = {
        "role": "system",
        "content": "You are a precise image tagger. Only output JSON that matches the schema."
    }
    shots = []
    for ex in fewshot:
        shots.append({
            "role": "user",
            "content": [
                {"type": "text", "text": "Classify the dog waste photo. Allowed tags: " + "; ".join(classes)},
                {"type": "image_url", "image_url": {"url": ex["image_url"]}}
            ]
        })
        shots.append({
            "role":"assistant",
            "content": json.dumps({
                "tags": ex["labels"],
                "confidence": {k: (1.0 if k in ex["labels"] else 0.0) for k in classes}
            })
        })
    user = {
        "role": "user",
        "content": [
            {"type":"text","text": build_prompt_text(classes)},
            {"type":"image_url","image_url":{"url": image_url}}
        ]
    }
    return [system] + shots + [user]

def build_worm_check_messages(image_url: str):
    """
    Second-stage binary check focused only on worms to boost recall.
    """
    return [
        {"role": "system", "content": "Answer strictly with JSON."},
        {"role": "user", "content": [
            {"type":"text","text":
             ("Binary check ONLY for worms. "
              "Question: 'Are worms visible in this image?' "
              'Return ONLY JSON: {"worms_visible": true|false, "confidence": 0-1}')},
            {"type":"image_url","image_url":{"url": image_url}}
        ]}
    ]

def post_chat(api_key: str, payload: dict) -> dict:
    url = "https://api.openai.com/v1/chat/completions"
    hdrs = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    r = SESS.post(url, headers=hdrs, json=payload, timeout=TIMEOUT)
    if r.status_code != 200:
        raise requests.HTTPError(f"{r.status_code} {r.reason}: {r.text}", response=r)
    return r.json()

def call_multilabel(api_key: str, model: str, image_url: str, fewshot: list, debug: bool=False) -> str:
    """
    Use Chat Completions (works reliably with gpt-4o family).
    We do NOT force response_format here; we parse whatever comes back.
    """
    messages = build_messages_chat(image_url, fewshot)
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 250,
        "temperature": 0.0
    }
    resp = post_chat(api_key, payload)
    raw = resp["choices"][0]["message"]["content"]
    if debug:
        print("\n--- RAW MODEL CONTENT (debug) ---")
        print((raw or "").strip()[:1200])
        print("--- END ---\n")
    return raw or ""

def call_worm_check(api_key: str, model: str, image_url: str, debug: bool=False) -> Tuple[bool, float]:
    """
    Second-stage binary head. Returns (worms_visible:boolean, confidence:float)
    """
    messages = build_worm_check_messages(image_url)
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 80,
        "temperature": 0.0
    }
    resp = post_chat(api_key, payload)
    raw = resp["choices"][0]["message"]["content"] or ""

    if debug:
        print("\n--- WORM CHECK RAW (debug) ---")
        print(raw.strip()[:800])
        print("--- END ---\n")

    # Parse JSON (handles fenced code blocks too)
    text = extract_json_object(raw)
    try:
        data = json.loads(text) if text else {}
        return bool(data.get("worms_visible", False)), float(data.get("confidence", 0.0))
    except Exception:
        return False, 0.0

# ==== Parsing Helpers ====

FENCED_RE = re.compile(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", re.IGNORECASE)

def extract_json_object(s: str) -> str:
    """
    Return the first JSON object we can decode from the string.
    Handles fenced code blocks and plain JSON.
    """
    if not s:
        return ""
    # If it's plain JSON already
    try:
        json.loads(s)
        return s
    except Exception:
        pass
    # If it's in a fenced code block
    m = FENCED_RE.search(s)
    if m:
        block = m.group(1)
        try:
            json.loads(block)
            return block
        except Exception:
            pass
    # Otherwise, scan for the first {...} that contains "tags" or looks like a JSON object
    depth = 0
    start = -1
    for i, ch in enumerate(s):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start != -1:
                candidate = s[start:i+1]
                # prefer ones with "tags" key
                if '"tags"' in candidate or '"confidence"' in candidate or '"worms_visible"' in candidate:
                    try:
                        json.loads(candidate)
                        return candidate
                    except Exception:
                        pass
    return ""

def parse_multilabel(text: str) -> Tuple[set, Dict[str, float]]:
    """
    text -> (tags, confidence_map)
    """
    obj = extract_json_object(text)
    if not obj:
        return set(), {k:0.0 for k in CLASSES}
    try:
        data = json.loads(obj)
        tags = data.get("tags", [])
        conf = data.get("confidence", {})
        if not isinstance(tags, list):
            tags = []
        tags = [t for t in tags if t in CLASSES]
        conf2 = {k: float(conf.get(k, 0.0)) for k in CLASSES}
        return set(tags), conf2
    except Exception:
        return set(), {k:0.0 for k in CLASSES}

# ==== Metrics ====

def metrics_micro(truth: set, pred: set):
    tp = len(truth & pred)
    fp = len(pred - truth)
    fn = len(truth - pred)
    return tp, fp, fn

def metrics_per_class(all_truth, all_pred):
    per = {}
    for c in CLASSES:
        tp = sum(1 for t,p in zip(all_truth, all_pred) if (c in t and c in p))
        fp = sum(1 for t,p in zip(all_truth, all_pred) if (c not in t and c in p))
        fn = sum(1 for t,p in zip(all_truth, all_pred) if (c in t and c not in p))
        prec = tp / (tp+fp) if (tp+fp) else 0.0
        rec  = tp / (tp+fn) if (tp+fn) else 0.0
        f1   = 2*prec*rec/(prec+rec) if (prec+rec) else 0.0
        per[c] = {"precision":prec,"recall":rec,"f1":f1,"tp":tp,"fp":fp,"fn":fn}
    return per

# ==== Evaluation ====

def evaluate_model(items, api_key, model, fewshot, conf_default: Optional[float],
                   conf_overrides: Dict[str, float], worm_second_stage: bool,
                   worm_second_stage_threshold: float, debug: bool, delay_s=0.03):
    truth_sets, pred_sets, rows = [], [], []
    errors = 0
    worm_misses = []  # (idx, image_url, gt, model_text, conf_map)

    for i, it in enumerate(items, 1):
        try:
            raw_text = call_multilabel(api_key, model, it["image_url"], fewshot, debug=debug)
            tags, conf = parse_multilabel(raw_text)
            err = None
        except Exception as e:
            tags, conf, err = set(), {k:0.0 for k in CLASSES}, str(e)
            raw_text = ""
            errors += 1

        # Apply thresholds (default + per-class overrides)
        def passes(cls: str) -> bool:
            thr = conf_overrides.get(cls, conf_default if conf_default is not None else 0.0)
            return conf.get(cls, 0.0) >= (thr if thr is not None else 0.0)

        filtered = {t for t in tags if passes(t)}

        # Optional second stage: boost recall for Worms
        if worm_second_stage and "Worms" not in filtered:
            worms_visible, worms_conf = call_worm_check(api_key, model, it["image_url"], debug=debug)
            if worms_visible and worms_conf >= worm_second_stage_threshold:
                filtered.add("Worms")
                conf["Worms"] = max(conf.get("Worms", 0.0), worms_conf)

        g = set(it["ground"])
        # Track worm misses for review
        if ("Worms" in g) and ("Worms" not in filtered):
            worm_misses.append({
                "idx": i,
                "image_url": it["image_url"],
                "ground": sorted(g),
                "predicted": sorted(filtered),
                "confidence": conf,
                "raw": raw_text
            })

        truth_sets.append(g)
        pred_sets.append(filtered)
        rows.append({
            "idx": i,
            "image_url": it["image_url"],
            "ground": sorted(g),
            "predicted": sorted(filtered),
            "confidence": conf,
            "error": err
        })
        print(f"[{i}/{len(items)}] {model}  ground={g}  pred={filtered}" + (f"  ERR={err[:140]}" if err else ""))
        time.sleep(delay_s)

    # Micro metrics
    TP=FP=FN=0
    for t,p in zip(truth_sets, pred_sets):
        tp,fp,fn = metrics_micro(t,p); TP+=tp; FP+=fp; FN+=fn
    precision = TP/(TP+FP) if (TP+FP) else 0.0
    recall    = TP/(TP+FN) if (TP+FN) else 0.0
    f1        = 2*precision*recall/(precision+recall) if (precision+recall) else 0.0
    per_class = metrics_per_class(truth_sets, pred_sets)

    # Pretty print per-class
    print("\nPer-class metrics:")
    for c, m in per_class.items():
        print(f"  {c:14s}  P={m['precision']:.3f}  R={m['recall']:.3f}  F1={m['f1']:.3f}  (tp={m['tp']} fp={m['fp']} fn={m['fn']})")

    return {
        "precision":precision, "recall":recall, "f1":f1,
        "per_class": per_class, "rows": rows, "errors": errors,
        "worm_misses": worm_misses
    }

# ==== CLI ====

def parse_conf_overrides(s: Optional[str]) -> Dict[str, float]:
    if not s:
        return {}
    try:
        obj = json.loads(s)
        out = {}
        for k, v in obj.items():
            if k in CLASSES:
                out[k] = float(v)
        return out
    except Exception:
        print("Warning: --conf_per_class is not valid JSON; ignoring.")
        return {}

def main():
    ap = argparse.ArgumentParser(description="Evaluate multiple models on Dog Poop Health ID.")
    ap.add_argument("--dataset", default=DEFAULT_DATASET_DIR, help="Path to Roboflow export")
    ap.add_argument("--sample", type=int, default=DEFAULT_SAMPLE, help="Sample size (<=0 = all)")
    ap.add_argument("--models", default=",".join(DEFAULT_MODELS),
        help="Comma-separated models, e.g. gpt-4o,gpt-4o-mini")
    ap.add_argument("--outdir", default=DEFAULT_OUTDIR, help="Output directory")
    ap.add_argument("--conf", type=float, default=0.5, help="Default confidence threshold (0-1) for all classes")
    ap.add_argument("--conf_per_class", type=str, default=None,
                    help='JSON map of per-class thresholds, e.g. \'{"Worms":0.2,"Blood":0.5}\'')
    ap.add_argument("--target_f1", type=float, default=None, help="Stop early if micro-F1 >= target")
    ap.add_argument("--fewshot", default=None, help="Path to few-shot JSON file")
    ap.add_argument("--worm_second_stage", action="store_true",
                    help="Enable second-stage binary 'worm check' to boost recall")
    ap.add_argument("--worm_second_stage_threshold", type=float, default=0.4,
                    help="Confidence threshold for second-stage worm detection")
    ap.add_argument("--debug", action="store_true", help="Print raw model outputs")
    args = ap.parse_args()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set.")

    base = Path(args.dataset).expanduser().resolve()
    items = load_annotations(base)
    random.seed(42)
    if 0 < args.sample < len(items):
        items = random.sample(items, args.sample)

    fewshot = load_fewshot(Path(args.fewshot).expanduser().resolve() if args.fewshot else None)

    outdir = Path(args.outdir).expanduser().resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    req_models = [m.strip() for m in args.models.split(",") if m.strip()]
    conf_overrides = parse_conf_overrides(args.conf_per_class)

    best = None
    for model in req_models:
        print(f"\n=== Evaluating {model} on {len(items)} images ===")
        res = evaluate_model(
            items, api_key, model, fewshot,
            conf_default=args.conf,
            conf_overrides=conf_overrides,
            worm_second_stage=args.worm_second_stage,
            worm_second_stage_threshold=args.worm_second_stage_threshold,
            debug=args.debug
        )
        stamp = model.replace(":","_").replace("/","_")
        json_path = outdir / f"results_{stamp}.json"
        csv_path  = outdir / f"results_{stamp}.csv"
        worms_path = outdir / f"worm_misses_{stamp}.jsonl"

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump({"model": model, "sample": len(items),
                       "metrics": {"precision": res["precision"],
                                   "recall": res["recall"],
                                   "f1": res["f1"],
                                   "per_class": res["per_class"],
                                   "errors": res["errors"]},
                       "rows": res["rows"]}, f, indent=2)

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["idx","model","image_url","ground","predicted","errors"])
            for row in res["rows"]:
                w.writerow([row["idx"], model, row["image_url"],
                            "|".join(row["ground"]), "|".join(row["predicted"]),
                            row["error"] or ""])

        # Dump worm misses for quick audit
        if res["worm_misses"]:
            with open(worms_path, "w", encoding="utf-8") as f:
                for miss in res["worm_misses"]:
                    f.write(json.dumps(miss) + "\n")
            print(f"Worm misses saved to: {worms_path}  (count={len(res['worm_misses'])})")

        print(f"-> {model}  P={res['precision']:.3f} R={res['recall']:.3f} F1={res['f1']:.3f}")
        if (best is None) or (res["f1"] > best["f1"]):
            best = {"model": model, "f1": res["f1"]}
        if args.target_f1 is not None and res["f1"] >= args.target_f1:
            print(f"Target F1 {args.target_f1} reached by {model}. Stopping early.")
            break

    if best:
        print(f"\nBest so far: {best['model']}  F1={best['f1']:.3f}")
    print(f"Outputs in: {outdir}")

if __name__ == "__main__":
    main()
