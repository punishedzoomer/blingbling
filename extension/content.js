let isCaptureMode = false;
let overlay = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "trigger_capture") {
    enterCaptureMode();
  } else if (request.action === "crop_and_send") {
    // We received the raw full-tab screenshot from the background script.
    // Now we crop it to the exact dimensions of the element the user highlighted.
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const rect = request.rect;
      const dpr = rect.dpr;
      const contextText = request.contextText || "";
      
      const cropX = Math.max(0, rect.x * dpr);
      const cropY = Math.max(0, rect.y * dpr);
      const cropW = Math.min(rect.w * dpr, img.width - cropX);
      const cropH = Math.min(rect.h * dpr, img.height - cropY);

      canvas.width = cropW;
      canvas.height = cropH;

      if (cropW > 0 && cropH > 0) {
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const croppedBase64 = canvas.toDataURL("image/png");
          
          chrome.runtime.sendMessage({
            action: "send_snip",
            data: JSON.stringify({
              image: croppedBase64,
              text: contextText
            })
          }, (response) => {
            // Silently handle response
          });
      }
    };
    img.src = request.dataUrl;
  }
});

function enterCaptureMode() {
  if (isCaptureMode) return;
  isCaptureMode = true;

  // Create an invisible overlay to intercept clicks
  overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '2147483647';
  overlay.style.cursor = 'crosshair';
  
  document.body.appendChild(overlay);

  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('click', handleClick);
  overlay.addEventListener('contextmenu', handleRightClick);
  document.addEventListener('keydown', handleKeyDown);
}

function handleRightClick(e) {
  if (isCaptureMode) {
    e.preventDefault();
  }
}

function cleanupUI() {
  if (overlay && document.body.contains(overlay)) {
    document.body.removeChild(overlay);
  }
  if (highlightBox && document.body.contains(highlightBox)) {
    document.body.removeChild(highlightBox);
  }
  document.removeEventListener('keydown', handleKeyDown);
  isCaptureMode = false;
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && isCaptureMode) {
    cleanupUI();
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd' && isCaptureMode) {
    e.preventDefault();
    cleanupUI();
  }
}

// Visual highlight box
let highlightBox = document.createElement('div');
highlightBox.style.position = 'absolute';
highlightBox.style.border = '2px solid rgba(120, 120, 120, 0.4)';
highlightBox.style.backgroundColor = 'rgba(120, 120, 120, 0.1)';
highlightBox.style.pointerEvents = 'none';
highlightBox.style.zIndex = '2147483646';

function handleMouseMove(e) {
  // Hide overlay temporarily to find the element underneath
  overlay.style.display = 'none';
  const element = document.elementFromPoint(e.clientX, e.clientY);
  overlay.style.display = 'block';

  if (element) {
    const rect = element.getBoundingClientRect();
    highlightBox.style.top = `${window.scrollY + rect.top}px`;
    highlightBox.style.left = `${window.scrollX + rect.left}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
    
    if (!document.body.contains(highlightBox)) {
      document.body.appendChild(highlightBox);
    }
    
    overlay.dataset.targetElement = element;
  }
}

function handleClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Clean up UI
  cleanupUI();

  // Hide overlay temporarily to find the element underneath again
  overlay.style.display = 'none';
  const element = document.elementFromPoint(e.clientX, e.clientY);
  
  if (element) {
    
    // Add a slight delay to allow the highlight box to disappear fully
    setTimeout(() => {
        const rect = element.getBoundingClientRect();
        
        // Tell the background script to take a native screenshot of the active tab
        chrome.runtime.sendMessage({
            action: "capture_area",
            rect: { 
                x: rect.left, 
                y: rect.top, 
                w: rect.width, 
                h: rect.height, 
                dpr: window.devicePixelRatio 
            },
            contextText: element.innerText || ""
        });
    }, 100);
  }
}
