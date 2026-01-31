from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types
import base64
import os

# --- Initialization ---
load_dotenv()
api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY not found in environment variables.")

client = genai.Client(api_key=api_key)
app = Flask(__name__)

DEFAULT_MODEL = "gemini-3-flash-preview"
ALLOWED_MODELS = {
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
}
OCR_PROMPT = "OCR the image to markdown. Return only the markdown, surrounded by backtick fences."

def parse_data_url(image_data_url):
    if not image_data_url.startswith("data:"):
        raise ValueError("Invalid data URL.")
    header, b64_data = image_data_url.split(",", 1)
    if ";base64" not in header:
        raise ValueError("Data URL is not base64-encoded.")
    mime_type = header[5:].split(";")[0] or "application/octet-stream"
    image_bytes = base64.b64decode(b64_data)
    return mime_type, image_bytes

# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ocr', methods=['POST'])
def ocr_image():
    data = request.get_json()
    if not data or 'image_data_url' not in data:
        return jsonify({'error': 'No image data received'}), 400

    image_data_url = data['image_data_url'] # e.g., "data:image/jpeg;base64,..."
    selected_model = data.get("model") or DEFAULT_MODEL
    if selected_model not in ALLOWED_MODELS:
        return jsonify({'error': 'Invalid model selection'}), 400

    try:
        mime_type, image_bytes = parse_data_url(image_data_url)
        response = client.models.generate_content(
            model=selected_model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                OCR_PROMPT,
            ],
        )

        extracted_text = (response.text or "").strip()

        return jsonify({'text': extracted_text})

    except Exception as e:
        app.logger.error(f"OCR Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=1111,debug=True,host="0.0.0.0")
