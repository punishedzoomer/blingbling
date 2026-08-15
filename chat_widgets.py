from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QTextBrowser, QPushButton, QLabel, QFrame, QTextEdit
)

class AutoResizingTextEdit(QTextEdit):
    returnPressed = Signal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.textChanged.connect(self.adjust_height)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setFixedHeight(36)
        self.setAcceptRichText(False)
        self.document().setDocumentMargin(4)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Return or event.key() == Qt.Key.Key_Enter:
            if not (event.modifiers() & Qt.KeyboardModifier.ShiftModifier):
                self.returnPressed.emit()
                return
        super().keyPressEvent(event)

    def adjust_height(self):
        doc_height = self.document().documentLayout().documentSize().height()
        new_height = max(36, min(int(doc_height) + 10, 120))
        
        if new_height >= 120:
            self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        else:
            self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
            
        self.setFixedHeight(new_height)


import markdown
import re
from PySide6.QtCore import QTimer

CUSTOM_CSS = """
<style>
body { color: #ECECEC; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; }
table { border-collapse: collapse; margin-bottom: 10px; width: 100%; }
th, td { border: 1px solid #555; padding: 4px 8px; }
th { background-color: #333; }
code { background-color: #2b2b2b; padding: 2px 4px; border-radius: 4px; font-family: Menlo, Monaco, Consolas, monospace; }
pre { background-color: #272822; padding: 10px; border-radius: 6px; }
pre code { background-color: transparent; padding: 0; }
</style>
"""

def preprocess_math(text):
    # Convert common LaTeX math to unicode for readable rendering
    replacements = {
        r"\\times": "×",
        r"\\cdot": "·",
        r"\\le": "≤",
        r"\\ge": "≥",
        r"\\ne": "≠",
        r"\\approx": "≈",
        r"\\pi": "π",
        r"\\alpha": "α",
        r"\\beta": "β",
        r"\\gamma": "γ",
        r"\\Delta": "Δ",
        r"\\delta": "δ",
        r"\\theta": "θ",
        r"\\infty": "∞",
        r"\\rightarrow": "→",
        r"\\leftarrow": "←",
        r"\\Rightarrow": "⇒",
        r"\\Leftarrow": "⇐",
        r"\\pm": "±",
        r"\\sqrt": "√",
        r"\^2": "²",
        r"\^3": "³",
    }
    
    # Strip basic math block wrappers so they render inline
    text = re.sub(r"\\\((.*?)\\\)", r"\1", text)
    text = re.sub(r"\\\[(.*?)\\\]", r"\n\1\n", text)
    
    for k, v in replacements.items():
        text = re.sub(k, v, text)
        
    return text

def render_markdown_html(text):
    text = preprocess_math(text)
    html = markdown.markdown(
        text, 
        extensions=['fenced_code', 'codehilite', 'tables'],
        extension_configs={
            'codehilite': {
                'noclasses': True,
                'style': 'monokai'
            }
        }
    )
    return CUSTOM_CSS + html


class MessageWidget(QFrame):
    def __init__(self, role, content="", reasoning=""):
        super().__init__()
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 10)
        self.layout.setSpacing(5)
        
        self.role = role
        
        # Header (Role indicator)
        self.header_label = QLabel()
        self.header_label.setStyleSheet("font-weight: bold; color: white;")
        if self.role == "user":
            self.header_label.setText("You")
        else:
            self.header_label.setText("")
        self.layout.addWidget(self.header_label)
        
        # Reasoning Section
        self.reasoning_container = QWidget()
        self.reasoning_layout = QVBoxLayout(self.reasoning_container)
        self.reasoning_layout.setContentsMargins(0, 0, 0, 0)
        self.reasoning_layout.setSpacing(2)
        
        self.reasoning_btn = QPushButton("💭 Show Reasoning")
        self.reasoning_btn.setObjectName("ReasoningBtn")
        self.reasoning_btn.setCheckable(True)
        self.reasoning_btn.toggled.connect(self.toggle_reasoning)
        self.reasoning_btn.setVisible(False)
        self.reasoning_layout.addWidget(self.reasoning_btn, 0, Qt.AlignmentFlag.AlignLeft)
        
        self.reasoning_text = QTextBrowser()
        self.reasoning_text.setObjectName("ReasoningText")
        self.reasoning_text.setOpenExternalLinks(True)
        self.reasoning_text.setLineWrapMode(QTextBrowser.LineWrapMode.WidgetWidth)
        self.reasoning_text.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.reasoning_text.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.reasoning_text.setVisible(False)
        self.reasoning_text.document().documentLayout().documentSizeChanged.connect(
            lambda _: self.adjust_height(self.reasoning_text)
        )
        self.reasoning_layout.addWidget(self.reasoning_text)
        
        self.layout.addWidget(self.reasoning_container)
        
        # Main Content
        self.main_text = QTextBrowser()
        self.main_text.setObjectName("MainMessageText")
        self.main_text.setOpenExternalLinks(True)
        self.main_text.setLineWrapMode(QTextBrowser.LineWrapMode.WidgetWidth)
        self.main_text.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.main_text.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.main_text.document().documentLayout().documentSizeChanged.connect(
            lambda _: self.adjust_height(self.main_text)
        )
        self.layout.addWidget(self.main_text)
        
        # Setup render buffering
        self._render_timer = QTimer(self)
        self._render_timer.setInterval(150) # Update UI at most ~6 times a second
        self._render_timer.timeout.connect(self._do_render)
        self._needs_render = False
        
        # Set initial content
        self.reasoning_markdown = ""
        self.content_markdown = ""
        if reasoning:
            self.append_reasoning(reasoning)
        if content:
            self.append_content(content)
            
    def toggle_reasoning(self, checked):
        self.reasoning_text.setVisible(checked)
        self.reasoning_btn.setText("💭 Hide Reasoning" if checked else "💭 Show Reasoning")
        
    def adjust_height(self, widget):
        # Dynamically resize the QTextBrowser to fit its content exactly
        doc_height = widget.document().size().height()
        widget.setFixedHeight(int(doc_height) + 10) # 10px padding for safety
        
    def _do_render(self):
        if not self._needs_render:
            self._render_timer.stop()
            return
            
        self._needs_render = False
        
        if self.reasoning_markdown:
            self.reasoning_text.setHtml(render_markdown_html(self.reasoning_markdown))
            
        if self.content_markdown:
            self.main_text.setHtml(render_markdown_html(self.content_markdown))
            
    def append_reasoning(self, text):
        self.reasoning_markdown += text
        self._needs_render = True
        
        if not self.reasoning_btn.isVisible():
            self.reasoning_btn.setVisible(True)
            
        if not self._render_timer.isActive():
            self._render_timer.start()
            
    def append_content(self, text):
        self.content_markdown += text
        self._needs_render = True
        
        if not self._render_timer.isActive():
            self._render_timer.start()
