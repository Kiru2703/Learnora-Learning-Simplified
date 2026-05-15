"""
lambda_handler.py — Learnora Bedrock proxy
Local dev: run with `python lambda_handler.py`
Lambda: entry point is handler(event, context)
"""

import json
import base64
import boto3
from botocore.exceptions import ClientError

# Flask is only used for local development — not available in Lambda runtime
try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    app = Flask(__name__)
    CORS(app)
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False

# ── Configuration ─────────────────────────────────────────────
REGION   = "ap-southeast-5"   # Bedrock is supported here
MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
MAX_TOKENS = 2048

bedrock = None  # initialized after credentials are set


def build_converse_content(content):
    """Convert message content to Bedrock Converse API format."""
    if isinstance(content, str):
        return [{"text": content}]

    if isinstance(content, list):
        blocks = []
        for item in content:
            if isinstance(item, str):
                blocks.append({"text": item})
            elif isinstance(item, dict):
                if item.get("type") == "text":
                    blocks.append({"text": item["text"]})
                elif item.get("type") == "image":
                    img_bytes = base64.b64decode(item["data"])
                    fmt = item.get("media_type", "image/jpeg").split("/")[-1]
                    fmt_map = {"jpg": "jpeg", "svg+xml": "png"}
                    fmt = fmt_map.get(fmt, fmt)
                    blocks.append({
                        "image": {
                            "format": fmt,
                            "source": {"bytes": img_bytes}
                        }
                    })
                elif "text" in item:
                    blocks.append({"text": item["text"]})
        return blocks if blocks else [{"text": ""}]

    return [{"text": str(content)}]


# ── Flask routes (local dev) ──────────────────────────────────
if HAS_FLASK:
    @app.route("/", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "model": MODEL_ID, "region": REGION})


    @app.route("/chat", methods=["POST", "OPTIONS"])
    def chat():
        if request.method == "OPTIONS":
            return jsonify({"message": "ok"})

        body = request.get_json(force=True)

        messages    = body.get("messages", [])
        system_text = body.get("system", "You are a helpful AI tutor.")
        max_tokens  = min(int(body.get("max_tokens", 1024)), MAX_TOKENS)
        temperature = float(body.get("temperature", 0.7))
        model_id    = body.get("model_id", MODEL_ID)

        if not messages:
            return jsonify({"error": "messages array is required"}), 400

        converse_messages = [
            {"role": m["role"], "content": build_converse_content(m["content"])}
            for m in messages
        ]

        try:
            kwargs = {
                "modelId": model_id,
                "messages": converse_messages,
                "inferenceConfig": {
                    "maxTokens": max_tokens,
                    "temperature": temperature,
                },
            }
            if system_text:
                kwargs["system"] = [{"text": system_text}]

            response = bedrock.converse(**kwargs)

            output = response.get("output", {})
            message = output.get("message", {})
            content_blocks = message.get("content", [])

            content = "".join(block.get("text", "") for block in content_blocks)

            return jsonify({"content": content})

        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg  = e.response["Error"]["Message"]
            print(f"Bedrock error: {code} — {msg}")
            return jsonify({"error": f"{code}: {msg}"}), 500

        except Exception as e:
            print(f"Error: {e}")
            return jsonify({"error": str(e)}), 500


# ── Lambda entry point ───────────────────────────────────────
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}


def handler(event, context):
    global bedrock
    if bedrock is None:
        bedrock = boto3.client("bedrock-runtime", region_name=REGION)

    # Handle OPTIONS preflight explicitly
    http_method = event.get("httpMethod", "")
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "ok"})
        }

    try:
        body = json.loads(event.get("body", "{}"))
        messages = body.get("messages", [])
        system_text = body.get("system", "You are a helpful AI tutor.")
        max_tokens = min(int(body.get("max_tokens", 1024)), MAX_TOKENS)
        temperature = float(body.get("temperature", 0.7))
        model_id = body.get("model_id", MODEL_ID)

        if not messages:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "messages array is required"})
            }

        converse_messages = [
            {"role": m["role"], "content": build_converse_content(m["content"])}
            for m in messages
        ]

        kwargs = {
            "modelId": model_id,
            "messages": converse_messages,
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system_text:
            kwargs["system"] = [{"text": system_text}]

        response = bedrock.converse(**kwargs)
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])

        content = "".join(block.get("text", "") for block in content_blocks)

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"content": content})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)})
        }


# ══════════════════════════════════════════════════════════════
#  LOCAL DEV — Paste your AWS credentials below, then run:
#  python lambda_handler.py
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import os

    os.environ["AWS_ACCESS_KEY_ID"]     = ""  # ← paste here
    os.environ["AWS_SECRET_ACCESS_KEY"] = ""  # ← paste here

    # Create client AFTER credentials are set
    bedrock = boto3.client("bedrock-runtime", region_name=REGION)

    print("=" * 50)
    print("  Learnora Bedrock Server")
    print(f"  Model:  {MODEL_ID}")
    print(f"  Region: {REGION}")
    print("  URL:    http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
