import os
import time
from PySide6.QtCore import Qt, QPoint, QSettings
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QPushButton, QHBoxLayout, QLabel, QFrame, 
    QComboBox, QSizeGrip, QStyledItemDelegate, QListWidget, 
    QListWidgetItem, QStackedWidget, QScrollArea, QSlider, QApplication
)
from PySide6.QtGui import QIcon, QPixmap

import config
import session_manager
from backend import LLMWorker, capture_screen_bytes
from snipping_tool import SnippingWidget
from chat_widgets import AutoResizingTextEdit, MessageWidget


class AssistantOverlay(QWidget):
    def __init__(self):
        super().__init__()
        
        # Load settings
        self.settings = QSettings("BlingBling", "Assistant")
        
        # Make window frameless, always on top, and translucent
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # Prevent the window from activating and yanking the workspace on launch
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        
        # Set initial size and apply opacity from settings or config
        self.resize(450, 500)
        saved_opacity = self.settings.value("window_opacity", config.WINDOW_OPACITY, type=float)
        self.setWindowOpacity(saved_opacity)
        
        # For dragging the frameless window
        self._drag_pos = QPoint()
        self.setMouseTracking(True)

        self.init_ui()

    def init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)

        # Main Container (acts as the visible window with rounded corners)
        self.container = QFrame(self)
        self.container.setObjectName("MainContainer")
        
        # Load external stylesheet
        style_path = os.path.join(os.path.dirname(__file__), 'style.qss')
        if os.path.exists(style_path):
            with open(style_path, 'r', encoding='utf-8') as f:
                self.setStyleSheet(f.read())

        wrapper_layout = QHBoxLayout(self.container)
        wrapper_layout.setContentsMargins(0, 0, 0, 0)
        wrapper_layout.setSpacing(0)
        
        # Sidebar
        self.sidebar = QFrame()
        self.sidebar.setObjectName("Sidebar")
        self.sidebar.setFixedWidth(200)
        sidebar_layout = QVBoxLayout(self.sidebar)
        sidebar_layout.setContentsMargins(10, 10, 10, 10)
        
        self.sidebar_stack = QStackedWidget()
        sidebar_layout.addWidget(self.sidebar_stack)
        
        # History Page
        self.history_page = QWidget()
        history_layout = QVBoxLayout(self.history_page)
        history_layout.setContentsMargins(0, 0, 0, 0)
        
        history_title = QLabel("History")
        history_title.setStyleSheet("font-size: 14px; font-weight: bold; color: white;")
        self.history_list = QListWidget()
        self.history_list.setObjectName("HistoryList")
        self.history_list.itemClicked.connect(self.on_history_item_clicked)
        
        history_layout.addWidget(history_title)
        history_layout.addWidget(self.history_list)
        
        # Settings Page
        self.settings_page = QWidget()
        settings_layout = QVBoxLayout(self.settings_page)
        settings_layout.setContentsMargins(0, 0, 0, 0)
        
        settings_title = QLabel("Settings")
        settings_title.setStyleSheet("font-size: 14px; font-weight: bold; color: white;")
        
        def format_model_name(raw_name):
            parts = raw_name.split('/')[-1]
            return parts.replace('-', ' ').replace('instruct', '').replace('preview', '').strip().title()
            
        ocr_label = QLabel("OCR Model:")
        self.ocr_combo = QComboBox()
        self.ocr_combo.setItemDelegate(QStyledItemDelegate())
        for m in config.OCR_MODELS:
            self.ocr_combo.addItem(format_model_name(m), m)
        
        reasoning_label = QLabel("Reasoning Model:")
        self.reasoning_combo = QComboBox()
        self.reasoning_combo.setItemDelegate(QStyledItemDelegate())
        for m in config.REASONING_MODELS:
            self.reasoning_combo.addItem(format_model_name(m), m)
        
        settings_layout.addWidget(settings_title)
        settings_layout.addSpacing(10)
        settings_layout.addWidget(ocr_label)
        settings_layout.addWidget(self.ocr_combo)
        settings_layout.addSpacing(10)
        settings_layout.addWidget(reasoning_label)
        settings_layout.addWidget(self.reasoning_combo)
        settings_layout.addSpacing(10)
        
        opacity_label = QLabel("Window Opacity:")
        self.opacity_slider = QSlider(Qt.Orientation.Horizontal)
        self.opacity_slider.setMinimum(20)
        self.opacity_slider.setMaximum(100)
        saved_opacity = self.settings.value("window_opacity", config.WINDOW_OPACITY, type=float)
        self.opacity_slider.setValue(int(saved_opacity * 100))
        self.opacity_slider.setSingleStep(5)
        
        self.opacity_slider.valueChanged.connect(self.on_opacity_changed)
        
        settings_layout.addWidget(opacity_label)
        settings_layout.addWidget(self.opacity_slider)
        settings_layout.addStretch()
        
        self.sidebar_stack.addWidget(self.history_page)
        self.sidebar_stack.addWidget(self.settings_page)
        
        self.sidebar.setVisible(False) # Hidden by default
        
        # Main Content Area
        self.main_content = QFrame()
        self.main_content.setObjectName("MainContent")
        container_layout = QVBoxLayout(self.main_content)
        container_layout.setContentsMargins(16, 12, 16, 16)
        container_layout.setSpacing(12)
        
        wrapper_layout.addWidget(self.sidebar)
        wrapper_layout.addWidget(self.main_content)

        # Header bar
        header_layout = QHBoxLayout()
        header_layout.setContentsMargins(0, 0, 0, 0)
        
        self.title_label = QLabel("Herve's notes")
        
        self.history_btn = QPushButton()
        self.history_btn.setIcon(QIcon(os.path.join(os.path.dirname(__file__), 'icons/library.svg')))
        self.history_btn.setObjectName("HistoryBtn")
        self.history_btn.setFixedSize(28, 28)
        self.history_btn.clicked.connect(lambda: self.toggle_sidebar(0))
        
        self.settings_btn = QPushButton()
        self.settings_btn.setIcon(QIcon(os.path.join(os.path.dirname(__file__), 'icons/settings.svg')))
        self.settings_btn.setObjectName("HistoryBtn") # Reuse style
        self.settings_btn.setFixedSize(28, 28)
        self.settings_btn.clicked.connect(lambda: self.toggle_sidebar(1))
        
        self.new_session_btn = QPushButton()
        self.new_session_btn.setIcon(QIcon(os.path.join(os.path.dirname(__file__), 'icons/plus.svg')))
        self.new_session_btn.setObjectName("NewSessionBtn")
        self.new_session_btn.setFixedSize(24, 24)
        self.new_session_btn.clicked.connect(self.start_new_session)
        
        self.close_btn = QPushButton()
        self.close_btn.setIcon(QIcon(os.path.join(os.path.dirname(__file__), 'icons/close.svg')))
        self.close_btn.setObjectName("CloseBtn")
        self.close_btn.setFixedSize(28, 28)
        self.close_btn.clicked.connect(self.hide_window)
        
        header_layout.addWidget(self.title_label)
        header_layout.addStretch()
        header_layout.addWidget(self.history_btn)
        header_layout.addWidget(self.settings_btn)
        header_layout.addWidget(self.new_session_btn)
        header_layout.addWidget(self.close_btn)
        
        container_layout.addLayout(header_layout)

        # Separator line
        line = QFrame()
        line.setFrameShape(QFrame.Shape.HLine)
        line.setFrameShadow(QFrame.Shadow.Sunken)
        line.setStyleSheet("background-color: rgba(255, 255, 255, 20);")
        line.setFixedHeight(1)
        container_layout.addWidget(line)

        # Chat Scroll Area
        self.chat_scroll = QScrollArea()
        self.chat_scroll.setWidgetResizable(True)
        self.chat_scroll.setObjectName("ChatScroll")
        self.chat_scroll.setStyleSheet("QScrollArea { border: none; background-color: transparent; }")
        
        self.chat_container = QWidget()
        self.chat_container.setObjectName("ChatContainer")
        self.chat_container.setStyleSheet("background-color: transparent;")
        self.chat_layout = QVBoxLayout(self.chat_container)
        self.chat_layout.setContentsMargins(0, 0, 0, 0)
        self.chat_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        
        self.chat_scroll.setWidget(self.chat_container)
        container_layout.addWidget(self.chat_scroll)
        container_layout.setStretch(container_layout.indexOf(self.chat_scroll), 1)
        
        # Footer Area
        footer_area = QVBoxLayout()
        footer_area.setSpacing(8)
        footer_area.setAlignment(Qt.AlignmentFlag.AlignBottom)
        
        # Prompt Input Row
        self.prompt_input = AutoResizingTextEdit()
        self.prompt_input.setPlaceholderText("Ask a question about the screen (optional)...")
        self.prompt_input.setObjectName("PromptInput")
        self.prompt_input.returnPressed.connect(self.trigger_capture)
        footer_area.addWidget(self.prompt_input)
        
        # Action Row
        action_layout = QHBoxLayout()
        self.snip_count_label = QLabel("0 Snips")
        self.snip_count_label.setStyleSheet("color: #606070; font-size: 11px;")
        
        self.add_snip_btn = QPushButton(" Add Snip")
        self.add_snip_btn.setIcon(QIcon(os.path.join(os.path.dirname(__file__), 'icons/plus.svg')))
        self.add_snip_btn.setObjectName("ActionBtn")
        self.add_snip_btn.clicked.connect(self.add_snip_clicked)
        
        self.undo_snip_btn = QPushButton(" Undo")
        self.undo_snip_btn.setIcon(QIcon(os.path.join(os.path.dirname(__file__), 'icons/undo.svg')))
        self.undo_snip_btn.setObjectName("ActionBtn")
        self.undo_snip_btn.clicked.connect(self.undo_snip_clicked)
        self.undo_snip_btn.setVisible(False)
        
        self.send_btn = QPushButton(" Send")
        self.send_btn.setIcon(QIcon(os.path.join(os.path.dirname(__file__), 'icons/send.svg')))
        self.send_btn.setObjectName("SendBtn")
        self.send_btn.clicked.connect(self.trigger_capture)
        
        # Add a size grip to allow resizing of the frameless window
        self.size_grip = QSizeGrip(self)
        self.size_grip.setStyleSheet("width: 12px; height: 12px; margin-left: 5px;")
        
        action_layout.addWidget(self.snip_count_label)
        action_layout.addStretch()
        action_layout.addWidget(self.undo_snip_btn)
        action_layout.addWidget(self.add_snip_btn)
        action_layout.addWidget(self.send_btn)
        action_layout.addWidget(self.size_grip, 0, Qt.AlignmentFlag.AlignBottom | Qt.AlignmentFlag.AlignRight)
        
        footer_area.addLayout(action_layout)
        
        container_layout.addLayout(footer_area)
        
        main_layout.addWidget(self.container)
        
        # State
        self.worker = None
        self.snipped_images = []
        self.conversation_history = []
        self.current_session_id = session_manager.create_session_id()
        self.sessions_list = []
        self.current_assistant_widget = None
        
        self.refresh_session_list()

    def on_opacity_changed(self, value):
        opacity = value / 100.0
        self.setWindowOpacity(opacity)
        self.settings.setValue("window_opacity", opacity)

    def hide_window(self):
        # Close the application completely for this prototype
        QApplication.quit()

    def toggle_sidebar(self, page_index):
        if self.sidebar.isVisible() and self.sidebar_stack.currentIndex() == page_index:
            self.sidebar.setVisible(False)
        else:
            self.sidebar_stack.setCurrentIndex(page_index)
            self.sidebar.setVisible(True)

    def refresh_session_list(self):
        self.history_list.clear()
        self.sessions_list = session_manager.get_all_sessions()
        
        if not self.sessions_list:
            item = QListWidgetItem("No past sessions")
            item.setFlags(Qt.ItemFlag.NoItemFlags)
            self.history_list.addItem(item)
            return

        for s in self.sessions_list:
            title = s["title"]
            if s["id"] == self.current_session_id:
                title += " (Current)"
            item = QListWidgetItem(title)
            item.setData(Qt.ItemDataRole.UserRole, s["id"])
            self.history_list.addItem(item)
            if s["id"] == self.current_session_id:
                self.history_list.setCurrentItem(item)

    def on_history_item_clicked(self, item):
        session_id = item.data(Qt.ItemDataRole.UserRole)
        if session_id:
            self.on_session_selected_by_id(session_id)

    def start_new_session(self):
        self.current_session_id = session_manager.create_session_id()
        self.conversation_history = []
        self.clear_chat()
        self.refresh_session_list()

    def clear_chat(self):
        while self.chat_layout.count():
            item = self.chat_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()
        self.current_assistant_widget = None

    def on_session_selected_by_id(self, session_id):
        if session_id == self.current_session_id: return
        
        self.current_session_id = session_id
        session_data = session_manager.load_session(session_id)
        if session_data:
            self.conversation_history = session_data.get("history", [])
            self.rebuild_markdown_from_history()

    def rebuild_markdown_from_history(self):
        self.clear_chat()
        
        for msg in self.conversation_history:
            if msg["role"] == "user":
                content = msg["content"]
                text_content = ""
                if isinstance(content, str):
                    text_content = content
                elif isinstance(content, list):
                    for item in content:
                        if item.get("type") == "text":
                            text_content += item.get("text", "") + "\n"
                
                # Clean up the backend injected string for display
                if "Here is the context extracted from screen captures:" in text_content:
                    parts = text_content.split("User Question/Instruction: ")
                    if len(parts) > 1:
                        text_content = parts[1]
                    else:
                        text_content = "[Image query]"
                        
                widget = MessageWidget("user", content=text_content.strip())
                self.chat_layout.addWidget(widget)
                
            elif msg["role"] == "assistant":
                widget = MessageWidget("assistant", content=msg.get("content", ""), reasoning=msg.get("reasoning", ""))
                self.chat_layout.addWidget(widget)
                
        # Scroll to bottom
        QApplication.processEvents()
        scrollbar = self.chat_scroll.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def add_snip_clicked(self):
        self.hide()
        QApplication.processEvents()
        time.sleep(0.1)
        
        # Grab full screen as background
        img_bytes = capture_screen_bytes()
        pixmap = QPixmap()
        pixmap.loadFromData(img_bytes)
        
        self.snipper = SnippingWidget(pixmap)
        
        # Span all screens
        app = QApplication.instance()
        rect = app.primaryScreen().geometry()
        for s in app.screens():
            rect = rect.united(s.geometry())
        self.snipper.setGeometry(rect)
        
        self.snipper.snip_completed.connect(self.on_snip_completed)
        self.snipper.snip_cancelled.connect(self.show)
        self.snipper.show()

    def on_snip_completed(self, image_bytes):
        self.snipped_images.append(image_bytes)
        self.snip_count_label.setText(f"{len(self.snipped_images)} Snips added")
        self.undo_snip_btn.setVisible(True)
        self.show()

    def undo_snip_clicked(self):
        if self.snipped_images:
            self.snipped_images.pop()
            self.snip_count_label.setText(f"{len(self.snipped_images)} Snips added" if self.snipped_images else "0 Snips")
            if not self.snipped_images:
                self.undo_snip_btn.setVisible(False)

    def trigger_capture(self):
        user_prompt = self.prompt_input.toPlainText()
        if not self.snipped_images and not user_prompt.strip():
            return # Nothing to do

        self.snip_count_label.setText("Analyzing...")
        self.add_snip_btn.setEnabled(False)
        self.send_btn.setEnabled(False)
        
        # Append user text locally to UI
        if user_prompt:
            user_widget = MessageWidget("user", content=user_prompt)
            self.chat_layout.addWidget(user_widget)
            self.prompt_input.clear()
            self.scroll_to_bottom()
            
        # Create assistant widget early so streaming updates it
        self.current_assistant_widget = MessageWidget("assistant")
        self.chat_layout.addWidget(self.current_assistant_widget)
            
        try:
            ocr_model = self.ocr_combo.currentData()
            reasoning_model = self.reasoning_combo.currentData()
            
            # Pass everything to backend (we will update LLMWorker next)
            self.worker = LLMWorker(
                self.snipped_images.copy(), 
                ocr_model, 
                reasoning_model, 
                user_prompt,
                self.conversation_history
            )
            self.worker.chunk_received.connect(self.append_text)
            self.worker.reasoning_chunk.connect(self.append_reasoning)
            self.worker.history_updated.connect(self.update_history)
            self.worker.error_occurred.connect(self.append_text)
            self.worker.finished.connect(self.on_finished)
            self.worker.start()
            
            # Clear snips for next message
            self.snipped_images.clear()
            self.snip_count_label.setText("0 Snips")
            self.undo_snip_btn.setVisible(False)
            
        except Exception as e:
            self.append_text(f"**Error starting worker:** {str(e)}")
            self.on_finished()

    def update_history(self, new_history):
        self.conversation_history = new_history
        session_manager.save_session(self.current_session_id, self.conversation_history)
        self.refresh_session_list()

    def append_text(self, text):
        if self.current_assistant_widget:
            self.current_assistant_widget.append_content(text)
            self.scroll_to_bottom()
            
    def append_reasoning(self, text):
        if self.current_assistant_widget:
            self.current_assistant_widget.append_reasoning(text)
            self.scroll_to_bottom()

    def scroll_to_bottom(self):
        scrollbar = self.chat_scroll.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def on_finished(self):
        self.snip_count_label.setText(f"{len(self.snipped_images)} Snips added")
        self.add_snip_btn.setEnabled(True)
        self.send_btn.setEnabled(True)

    # -------------------------------------------------------------
    # Frameless Window Dragging Logic
    # -------------------------------------------------------------
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            # Only drag from header area
            if event.position().y() < 60:
                self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
                event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton and not self._drag_pos.isNull():
            self.move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()

    def mouseReleaseEvent(self, event):
        self._drag_pos = QPoint()
