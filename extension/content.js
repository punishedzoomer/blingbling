let isCaptureMode = false;
let harvestedImages = [];
let globalStyle = null;
let targetElement = null;

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
              text: contextText,
              extraImages: request.extraImages || []
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

  globalStyle = document.createElement('style');
  globalStyle.textContent = '* { cursor: crosshair !important; }';
  document.head.appendChild(globalStyle);

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('contextmenu', handleRightClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
}

function handleRightClick(e) {
  if (isCaptureMode) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function cleanupUI() {
  if (globalStyle && document.head.contains(globalStyle)) {
    document.head.removeChild(globalStyle);
  }
  if (highlightBox && document.body.contains(highlightBox)) {
    document.body.removeChild(highlightBox);
  }
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('contextmenu', handleRightClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  isCaptureMode = false;
  targetElement = null;
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

let highlightBox = document.createElement('div');
highlightBox.style.position = 'absolute';
highlightBox.style.border = '2px solid rgba(120, 120, 120, 0.4)';
highlightBox.style.backgroundColor = 'rgba(120, 120, 120, 0.1)';
highlightBox.style.pointerEvents = 'none';
highlightBox.style.zIndex = '2147483646';

function handleMouseOver(e) {
  if (!isCaptureMode) return;
  const element = e.target;
  targetElement = element;

  if (element && element !== highlightBox) {
    const rect = element.getBoundingClientRect();
    highlightBox.style.top = `${window.scrollY + rect.top}px`;
    highlightBox.style.left = `${window.scrollX + rect.left}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
    
    if (!document.body.contains(highlightBox)) {
      document.body.appendChild(highlightBox);
    }
  }
}

function handleClick(e) {
  if (!isCaptureMode) return;
  e.preventDefault();
  e.stopPropagation();
  
  const element = targetElement || e.target;
  cleanupUI();
  
  if (element) {
    
    // Add a slight delay to allow the highlight box to disappear fully
    setTimeout(() => {
        const rect = element.getBoundingClientRect();
        
        harvestedImages = []; // reset
        const contextText = extractTextWithImages(element).trim();
        
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
            contextText: contextText,
            harvestedImages: harvestedImages
        });
    }, 100);
  }
}

function extractTextWithImages(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
    }
    
    // Ignore non-visible or irrelevant tags
    const tagName = node.tagName.toUpperCase();
    if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT') {
        return "";
    }

    if (tagName === 'IMG') {
        let src = node.src || node.getAttribute('src');
        let alt = node.alt || node.getAttribute('alt') || "image";
        
        // Skip tiny UI icons
        if (node.width > 0 && node.width < 30 && node.height > 0 && node.height < 30) {
            return "";
        }
        
        if (src && src.startsWith('data:')) {
            harvestedImages.push(src);
            return `\n[Image extracted as attachment]\n`;
        }
        
        if (src) {
            try {
                src = new URL(src, window.location.href).href;
                harvestedImages.push(src);
            } catch (e) {
                // Ignore invalid URLs
            }
        }
        return `\n![${alt}](${src})\n`;
    }

    if (tagName === 'SVG') {
        return `\n\`\`\`xml\n${node.outerHTML}\n\`\`\`\n`;
    }

    if (tagName === 'SUP') {
        let text = "";
        for (let child of node.childNodes) {
            text += extractTextWithImages(child);
        }
        return `^${text}`;
    }

    if (tagName === 'SUB') {
        let text = "";
        for (let child of node.childNodes) {
            text += extractTextWithImages(child);
        }
        return `_${text}`;
    }

    let text = "";
    for (let child of node.childNodes) {
        text += extractTextWithImages(child);
    }
    
    // Add newlines for block elements
    const blockTags = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BR', 'LI', 'TR', 'PRE', 'TABLE'];
    if (blockTags.includes(tagName)) {
        text += "\n";
    }
    
    return text;
}
