document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  const imagePreview = document.getElementById("imagePreview");
  const textOutput = document.getElementById("textOutput");
  const processingIndicator = document.getElementById("processingIndicator");
  const resultArea = document.getElementById("resultArea");
  const resetButton = document.getElementById("resetButton");
  const copyButton = document.getElementById("copyButton"); // New
  const toastNotification = document.getElementById("toastNotification"); // New
  const modelSelect = document.getElementById("modelSelect");
  const endpointSelect = document.getElementById("endpointSelect");
  const settingsPanel = document.getElementById("settingsPanel");
  const settingsStatus = document.getElementById("settingsStatus");
  const STORAGE_KEY = "image-to-text.connections.v1";
  const defaultConnection = { ...window.DEFAULT_CONNECTION, id: "default", apiKey: "" };
  let connections = loadConnections();
  const body = document.body;

  let toastTimeout; // To clear existing timeout if any

  function loadConnections() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return [defaultConnection, ...saved.filter((item) => item && item.id && item.endpoint)];
    } catch (error) {
      console.warn("Could not read saved connections", error);
      return [defaultConnection];
    }
  }

  function saveConnections() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections.filter((item) => item.id !== "default")));
      return true;
    } catch (error) {
      settingsStatus.textContent = "Could not save settings in local storage.";
      return false;
    }
  }

  function selectedConnection() {
    return connections.find((item) => item.id === endpointSelect.value) || connections[0];
  }

  function renderConnections(selectedId) {
    endpointSelect.replaceChildren();
    connections.forEach((connection) => {
      const option = document.createElement("option");
      option.value = connection.id;
      option.textContent = connection.name;
      endpointSelect.append(option);
    });
    endpointSelect.value = connections.some((item) => item.id === selectedId) ? selectedId : connections[0].id;
    const current = selectedConnection();
    document.getElementById("connectionName").value = current.id === "default" ? "" : current.name;
    document.getElementById("connectionEndpoint").value = current.id === "default" ? "" : current.endpoint;
    document.getElementById("connectionApiKey").value = current.id === "default" ? "" : current.apiKey;
    document.getElementById("deleteConnectionButton").disabled = current.id === "default";
    renderModels(current);
  }

  function renderModels(connection) {
    const models = [...new Set(connection.models || [])];
    modelSelect.replaceChildren();
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      modelSelect.append(option);
    });
    if (!models.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No models loaded — refresh or add a model";
      modelSelect.append(option);
    }
    modelSelect.value = models.includes(connection.model) ? connection.model : (models[0] || "");
  }

  async function refreshModels() {
    const connection = selectedConnection();
    settingsStatus.textContent = "Loading models…";
    try {
      const response = await fetch("/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: connection.endpoint, api_key: connection.apiKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load models");
      connection.models = [...new Set([...(connection.models || []), ...data.models])];
      if (selectedConnection().id === connection.id) renderModels(connection);
      saveConnections();
      settingsStatus.textContent = `${data.models.length} model(s) loaded.`;
    } catch (error) {
      settingsStatus.textContent = `Model discovery failed: ${error.message}. You can add a model ID manually.`;
    }
  }

  endpointSelect.addEventListener("change", () => {
    settingsStatus.textContent = "";
    renderConnections(endpointSelect.value);
    refreshModels();
  });
  modelSelect.addEventListener("change", () => {
    const connection = selectedConnection();
    connection.model = modelSelect.value;
    saveConnections();
  });
  document.getElementById("refreshModelsButton").addEventListener("click", refreshModels);
  document.getElementById("toggleSettingsButton").addEventListener("click", (event) => {
    settingsPanel.hidden = !settingsPanel.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!settingsPanel.hidden));
  });
  document.getElementById("connectionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const current = selectedConnection();
    const name = document.getElementById("connectionName").value.trim();
    const endpoint = document.getElementById("connectionEndpoint").value.trim().replace(/\/$/, "");
    const apiKey = document.getElementById("connectionApiKey").value.trim();
    const connection = current.id === "default"
      ? { id: crypto.randomUUID(), models: [], model: "" }
      : current;
    Object.assign(connection, { name, endpoint, apiKey });
    if (!connections.includes(connection)) connections.push(connection);
    if (!saveConnections()) return;
    renderConnections(connection.id);
    settingsStatus.textContent = "Connection saved in this browser.";
    refreshModels();
  });
  document.getElementById("addModelButton").addEventListener("click", () => {
    const connection = selectedConnection();
    const model = document.getElementById("customModel").value.trim();
    if (!model) return;
    connection.models = [...new Set([...(connection.models || []), model])];
    connection.model = model;
    document.getElementById("customModel").value = "";
    renderModels(connection);
    saveConnections();
    settingsStatus.textContent = "Model added to the dropdown.";
  });
  document.getElementById("deleteConnectionButton").addEventListener("click", () => {
    const connection = selectedConnection();
    if (connection.id === "default") return;
    connections = connections.filter((item) => item.id !== connection.id);
    saveConnections();
    renderConnections("default");
    settingsStatus.textContent = "Connection removed.";
  });

  function showView(view) {
    dropZone.style.display = "none";
    processingIndicator.style.display = "none";
    resultArea.style.display = "none";
    resetButton.style.display = "none";
    copyButton.style.display = "none"; // Hide copy button by default

    if (view === "dropZone") {
      dropZone.style.display = "block";
    } else if (view === "processing") {
      processingIndicator.style.display = "flex";
    } else if (view === "result") {
      resultArea.style.display = "flex";
      resetButton.style.display = "block";
      if (
        textOutput.textContent.trim() !== "" &&
        textOutput.textContent !== "No text extracted." &&
        !textOutput.textContent.startsWith("Error processing image:")
      ) {
        copyButton.style.display = "flex"; // Show copy button only if there's text
      }
    }
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please drop or paste an image file (JPEG, PNG, GIF, WEBP).");
      showView("dropZone");
      return;
    }
    showView("processing");

    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      sendImageToBackend(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function sendImageToBackend(imageDataUrl) {
    try {
      const response = await fetch("/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_data_url: imageDataUrl,
          model: modelSelect.value,
          endpoint: selectedConnection().endpoint,
          api_key: selectedConnection().apiKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      textOutput.textContent = data.text || "No text extracted.";
      showView("result"); // This will now also handle showing/hiding copyButton
    } catch (error) {
      console.error("Error:", error);
      textOutput.textContent = `Error processing image: ${error.message}`;
      showView("result");
      imagePreview.src = "#";
    }
  }

  // --- Drag and Drop ---
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    if (event.dataTransfer.files.length) {
      handleFile(event.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      if (e.target.files.length) {
        handleFile(e.target.files[0]);
      }
    };
    input.click();
  });

  // --- Paste Functionality ---
  document.addEventListener("paste", (event) => {
    if (
      dropZone.style.display !== "none" ||
      resultArea.style.display === "none"
    ) {
      const items = (event.clipboardData || event.originalEvent.clipboardData)
        .items;
      for (let item of items) {
        if (item.type.indexOf("image") !== -1) {
          event.preventDefault();
          const blob = item.getAsFile();
          handleFile(blob);
          break;
        }
      }
    }
  });

  // --- Reset Button ---
  resetButton.addEventListener("click", () => {
    imagePreview.src = "#";
    textOutput.textContent = "";
    showView("dropZone");
  });

  // --- Copy Button ---
  copyButton.addEventListener("click", () => {
    const textToCopy = textOutput.textContent;
    if (navigator.clipboard && textToCopy) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          showToast("Text copied to clipboard!");
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          showToast("Failed to copy text.");
        });
    } else if (textToCopy) {
      // Fallback for older browsers (less secure, more complex)
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed"; // Prevent scrolling to bottom
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        showToast("Text copied to clipboard!");
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
        showToast("Failed to copy text.");
      }
      document.body.removeChild(textArea);
    }
  });

  // --- Toast Notification Function ---
  function showToast(message) {
    toastNotification.textContent = message;
    toastNotification.classList.add("show");
    clearTimeout(toastTimeout); // Clear any existing timeout
    toastTimeout = setTimeout(() => {
      toastNotification.classList.remove("show");
    }, 3000); // Hide after 3 seconds
  }

  // --- Initial State ---
  renderConnections(localStorage.getItem("image-to-text.last-connection") || "default");
  endpointSelect.addEventListener("change", () => localStorage.setItem("image-to-text.last-connection", endpointSelect.value));
  if (selectedConnection().models.length === 0) refreshModels();
  showView("dropZone");
});
