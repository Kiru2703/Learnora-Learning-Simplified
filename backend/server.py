"""
server.py — Local Bedrock proxy server for Learnora
Run this on your machine and it connects directly to AWS Bedrock
using your local AWS credentials (same ones your boto3 script uses).

Usage:
    pip install flask flask-cors boto3
    python server.py

Then open index.html and it will connect automatically.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import base64
import boto3
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)  # Allow all origins (for local dev)

# ── Configuration ─────────────────────────────────────────────
REGION   = "ap-southeast-2"
MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

bedrock = boto3.client("bedrock-runtime", region_name=REGION)


def build_converse_content(content):
    """Convert message content to Bedrock Converse format."""
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
    max_tokens  = min(int(body.get("max_tokens", 1024)), 4096)
    temperature = float(body.get("temperature", 0.7))
    model_id    = body.get("model_id", MODEL_ID)

    if not messages:
        return jsonify({"error": "messages array is required"}), 400

    # Build Converse API messages
    converse_messages = []
    for m in messages:
        converse_messages.append({
            "role":    m["role"],
            "content": build_converse_content(m["content"]),
        })

    try:
        kwargs = {
            "modelId":         model_id,
            "messages":        converse_messages,
            "inferenceConfig": {
                "maxTokens":   max_tokens,
                "temperature": temperature,
            },
        }
        if system_text:
            kwargs["system"] = [{"text": system_text}]

        response = bedrock.converse(**kwargs)

        # Extract text
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])

        content = ""
        for block in content_blocks:
            if "text" in block:
                content += block["text"]

        return jsonify({"content": content})

    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg  = e.response["Error"]["Message"]
        print(f"Bedrock error: {code} — {msg}")
        return jsonify({"error": f"{code}: {msg}"}), 500

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("  Learnora Bedrock Server")
    print(f"  Model:  {MODEL_ID}")
    print(f"  Region: {REGION}")
    print("  URL:    http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
