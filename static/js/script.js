document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  const imagePreview = document.getElementById("imagePreview");
  const textOutput = document.getElementById("textOutput");
  const processingIndicator = document.getElementById("processingIndicator");
  const resultArea = document.getElementById("resultArea");
  const resetButton = document.getElementById("resetButton");
  const copyButton = document.getElementById("copyButton"); // New
  const toastNotification = document.getElementById("toastNotification"); // New
  const body = document.body;

  let toastTimeout; // To clear existing timeout if any

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
        body: JSON.stringify({ image_data_url: imageDataUrl }),
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
  showView("dropZone");
});
