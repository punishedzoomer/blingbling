let isCaptureMode = false;
let overlay = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "trigger_capture") {
    enterCaptureMode();

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

async function handleClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  cleanupUI();
  overlay.style.display = 'none';
  const element = document.elementFromPoint(e.clientX, e.clientY);
  
  if (!element) return;

  // Wait a moment for highlight box to disappear
  await new Promise(r => setTimeout(r, 100));

  const initialRect = element.getBoundingClientRect();
  const startX = window.scrollX + initialRect.left;
  const startY = window.scrollY + initialRect.top;
  const fullWidth = initialRect.width;
  const fullHeight = initialRect.height;
  const endX = startX + fullWidth;
  const endY = startY + fullHeight;

  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = fullWidth * dpr;
  canvas.height = fullHeight * dpr;
  const ctx = canvas.getContext('2d');

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Save original scroll position
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;

  // Hide scrollbars temporarily
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  for (let y = startY; y < endY; y += viewportHeight) {
    for (let x = startX; x < endX; x += viewportWidth) {
      window.scrollTo(x, y);
      await new Promise(r => setTimeout(r, 150)); // Wait for paint

      const dataUrl = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "capture_visible_tab" }, resolve);
      });

      if (!dataUrl) continue;

      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => img.onload = r);

      const rectNow = element.getBoundingClientRect();
      const intersectLeft = Math.max(0, rectNow.left);
      const intersectTop = Math.max(0, rectNow.top);
      const intersectRight = Math.min(viewportWidth, rectNow.right);
      const intersectBottom = Math.min(viewportHeight, rectNow.bottom);

      const cropX = intersectLeft * dpr;
      const cropY = intersectTop * dpr;
      const cropW = (intersectRight - intersectLeft) * dpr;
      const cropH = (intersectBottom - intersectTop) * dpr;

      if (cropW > 0 && cropH > 0) {
        const drawX = (window.scrollX + intersectLeft - startX) * dpr;
        const drawY = (window.scrollY + intersectTop - startY) * dpr;
        ctx.drawImage(img, cropX, cropY, cropW, cropH, drawX, drawY, cropW, cropH);
      }
    }
  }

  // Restore everything
  document.body.style.overflow = originalOverflow;
  window.scrollTo(originalScrollX, originalScrollY);

  // Send stitched image heavily compressed to avoid Firefox storage quota limits
  const finalImage = canvas.toDataURL("image/jpeg", 0.7);
  chrome.runtime.sendMessage({
    action: "send_snip",
    data: finalImage
  }, (response) => {
    // Firefox requires a callback here or it throws an unhandled message error
    console.log("Bling Bling - Background response:", response);
  });
}
