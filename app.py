from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI
import base64
import os
import re

# --- Initialization ---
load_dotenv()
VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://100.84.104.59:8000/v1")
VLLM_API_KEY = os.environ.get("VLLM_API_KEY", "not-needed")
app = Flask(__name__)

DEFAULT_MODEL = "Qwen/Qwen3.8-27B-FP8"
OCR_PROMPT = "OCR the image to markdown."#"OCR the image to markdown. Return only the markdown surrounded by triple backtick fences, with no language label. Make sure to catch all the bold/italics/code fenced text! It's subtle but make sure to catch those. For tables use markdown tables!! If the image contains a question or problem, do NOT solve it or attempt to solve it. Simply OCR the problem statement to markdown."

FENCE_RE = re.compile(
    r"^\s*(?P<fence>`+)(?:[ \t]*(?:markdown|md|latex|text)\b)?[ \t]*\n?"
    r"(?P<content>.*?)(?:\n)?(?P=fence)[ \t]*\s*$",
    re.DOTALL | re.IGNORECASE,
)

def parse_data_url(image_data_url):
    if not image_data_url.startswith("data:"):
        raise ValueError("Invalid data URL.")
    header, b64_data = image_data_url.split(",", 1)
    if ";base64" not in header:
        raise ValueError("Data URL is not base64-encoded.")
    mime_type = header[5:].split(";")[0] or "application/octet-stream"
    image_bytes = base64.b64decode(b64_data)
    return mime_type, image_bytes

def strip_backtick_fences(text):
    if not text:
        return ""
    match = FENCE_RE.match(text)
    if match:
        return match.group("content").strip()
    return text.strip()

# --- Routes ---
@app.route('/')
def index():
    return render_template(
        'index.html',
        default_endpoint=VLLM_BASE_URL,
        default_model=DEFAULT_MODEL,
    )


def make_client(base_url, api_key):
    endpoint = (base_url or VLLM_BASE_URL).strip()
    if not endpoint.startswith(("http://", "https://")):
        raise ValueError("Endpoint URL must start with http:// or https://")
    return OpenAI(base_url=endpoint.rstrip("/"), api_key=api_key or VLLM_API_KEY)


@app.route('/models', methods=['POST'])
def list_models():
    data = request.get_json(silent=True) or {}
    try:
        client = make_client(data.get("endpoint"), data.get("api_key"))
        models = client.models.list()
        return jsonify({"models": sorted(model.id for model in models.data)})
    except Exception as e:
        app.logger.error(f"Model listing error: {e}")
        return jsonify({'error': str(e)}), 502

@app.route('/ocr', methods=['POST'])
def ocr_image():
    data = request.get_json()
    if not data or 'image_data_url' not in data:
        return jsonify({'error': 'No image data received'}), 400

    image_data_url = data['image_data_url'] # e.g., "data:image/jpeg;base64,..."
    selected_model = (data.get("model") or DEFAULT_MODEL).strip()
    if not selected_model:
        return jsonify({'error': 'Choose a model'}), 400

    try:
        # Validate the image before passing its original data URL to vLLM.
        parse_data_url(image_data_url)
        client = make_client(data.get("endpoint"), data.get("api_key"))
        response = client.chat.completions.create(
            model=selected_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                        {"type": "text", "text": OCR_PROMPT},
                    ],
                }
            ],
            max_tokens=32768,
        )

        extracted_text = strip_backtick_fences(response.choices[0].message.content or "")

        return jsonify({'text': extracted_text})

    except Exception as e:
        app.logger.error(f"OCR Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=1111,debug=True,host="0.0.0.0")
