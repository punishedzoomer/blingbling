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
        self.reasoning_text.setVisible(False)
        self.reasoning_layout.addWidget(self.reasoning_text)
        
        self.layout.addWidget(self.reasoning_container)
        
        # Main Content
        self.main_text = QTextBrowser()
        self.main_text.setObjectName("MainMessageText")
        self.main_text.setOpenExternalLinks(True)
        self.main_text.setLineWrapMode(QTextBrowser.LineWrapMode.WidgetWidth)
        self.layout.addWidget(self.main_text)
        
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
        
    def append_reasoning(self, text):
        self.reasoning_markdown += text
        self.reasoning_text.setMarkdown(self.reasoning_markdown)
        if not self.reasoning_btn.isVisible():
            self.reasoning_btn.setVisible(True)
            
    def append_content(self, text):
        self.content_markdown += text
        self.main_text.setMarkdown(self.content_markdown)
