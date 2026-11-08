# Local Qwen OCR Frontend

Run these commands in your command line to start the app:

```bash
cd /Users/qing/PycharmProjects/web_apps/gemini_ocr

pip install flask python-dotenv openai

# Optional: defaults to http://100.84.104.59:8000/v1
export VLLM_BASE_URL=http://100.84.104.59:8000/v1

python app.py
```

The app will be served on `127.0.0.1:1111`

The default connection uses `VLLM_BASE_URL` and `VLLM_API_KEY`. In the web
interface, choose **Manage connections** to add other OpenAI-compatible API
endpoints and keys. The app can discover model IDs from the endpoint's
`/models` API; you can also add a model ID manually. The selected endpoint and
model are used for OCR.

Connection details, including API keys, are saved in the browser's
`localStorage`. They are not encrypted there, so use this only in a trusted
browser profile. The OCR server receives the selected endpoint and key for
each request and uses the OpenAI-compatible Chat Completions API.

## App

<img width="1335" alt="image" src="https://github.com/user-attachments/assets/a8e05d41-a562-410b-86e3-03d0169157f9" />
