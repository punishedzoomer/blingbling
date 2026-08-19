let isCaptureMode = false;
let overlay = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "trigger_capture") {
    enterCaptureMode();
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
  
  cleanupUI();
  overlay.style.display = 'none';
  const element = document.elementFromPoint(e.clientX, e.clientY);
  
  if (!element) return;

  setTimeout(() => {
      if (typeof html2canvas !== 'undefined') {
          html2canvas(element, { 
              useCORS: true, 
              allowTaint: false, 
              backgroundColor: null,
              scale: window.devicePixelRatio || 1
          }).then(canvas => {
              // Use PNG to prevent transparent areas from turning black
              const dataUrl = canvas.toDataURL("image/png");
              
              chrome.runtime.sendMessage({
                  action: "send_snip",
                  data: dataUrl
              }, (response) => {
                  console.log("Bling Bling - Background response:", response);
              });
          }).catch(err => {
              console.error("Bling Bling - html2canvas error:", err);
          });
      } else {
          console.error("Bling Bling - html2canvas is not loaded.");
      }
  }, 100);
}
