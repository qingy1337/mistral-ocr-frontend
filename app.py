from flask import Flask, render_template, request, jsonify
from mistralai import Mistral
from dotenv import load_dotenv
import os
import base64
import mimetypes # For guessing mime type if needed, though frontend usually sends it

# --- Initialization ---
load_dotenv()
api_key = os.environ.get("MISTRAL_API_KEY")
if not api_key:
    raise ValueError("MISTRAL_API_KEY not found in environment variables.")

client = Mistral(api_key=api_key)
app = Flask(__name__)

# --- Helper Function (from blog, slightly adapted) ---
# We don't strictly need load_image if the frontend sends a full data URL
# but it's good to have if we were to accept file paths directly.
# For this app, the frontend will send a base64 data URI directly.

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

    try:
        ocr_response = client.ocr.process(
            model="mistral-ocr-latest",
            document={
                "type": "image_url",
                "image_url": image_data_url, # Pass the data URL directly
            },
        )

        extracted_text = ""
        if ocr_response.pages:
            # For an image, there's usually one page
            for page in ocr_response.pages:
                extracted_text += page.markdown + "\n\n" # Add newlines between "pages" if any

        return jsonify({'text': extracted_text.strip()})

    except Exception as e:
        app.logger.error(f"OCR Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=1111,debug=True,host="0.0.0.0")
