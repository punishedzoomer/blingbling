from PySide6.QtWidgets import QWidget, QApplication
from PySide6.QtCore import Qt, QRect, QPoint, Signal
from PySide6.QtGui import QPainter, QColor, QPen, QPixmap

class SnippingWidget(QWidget):
    snip_completed = Signal(bytes) # Emits the jpeg bytes of the cropped region
    snip_cancelled = Signal()

    def __init__(self, full_screen_pixmap):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setCursor(Qt.CursorShape.CrossCursor)
        
        self.full_screen_pixmap = full_screen_pixmap
        self.begin = QPoint()
        self.end = QPoint()
        self.is_drawing = False

    def paintEvent(self, event):
        painter = QPainter(self)
        
        # 1. Draw the full screen screenshot
        painter.drawPixmap(self.rect(), self.full_screen_pixmap)
        
        # 2. Draw a semi-transparent dark overlay over everything
        painter.fillRect(self.rect(), QColor(0, 0, 0, 150))
        
        # 3. If drawing, clear the dark overlay in the selected rect and draw a border
        if self.is_drawing and not self.begin.isNull() and not self.end.isNull():
            rect = QRect(self.begin, self.end).normalized()
            
            # Draw the original bright pixmap in the selection
            painter.drawPixmap(rect, self.full_screen_pixmap, rect)
            
            # Draw border
            painter.setPen(QPen(QColor(0, 150, 255), 2))
            painter.drawRect(rect)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.begin = event.globalPosition().toPoint()
            self.end = self.begin
            self.is_drawing = True
            self.update()

    def mouseMoveEvent(self, event):
        if self.is_drawing:
            self.end = event.globalPosition().toPoint()
            self.update()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.is_drawing = False
            rect = QRect(self.begin, self.end).normalized()
            
            # Ensure the rect has some size
            if rect.width() > 10 and rect.height() > 10:
                cropped_pixmap = self.full_screen_pixmap.copy(rect)
                
                # Convert QPixmap to jpeg bytes
                from PySide6.QtCore import QByteArray, QBuffer, QIODevice
                byte_array = QByteArray()
                buffer = QBuffer(byte_array)
                buffer.open(QIODevice.OpenModeFlag.WriteOnly)
                cropped_pixmap.save(buffer, "JPEG", 85)
                
                self.snip_completed.emit(byte_array.data())
            else:
                self.snip_cancelled.emit()
            
            self.close()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape:
            self.snip_cancelled.emit()
            self.close()
