import sys
import signal
from PySide6.QtWidgets import QApplication
from app_window import AssistantOverlay
from mac_utils import mac_force_spaces_and_level, mac_make_accessory

def main():
    # Allow exiting with Ctrl+C in terminal
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    
    app = QApplication(sys.argv)
    
    # Make the app run as an accessory (removes dock icon, helps with spaces)
    # Must be called AFTER QApplication creates the NSApp instance
    mac_make_accessory()
    
    # Optional: set a high-DPI scaling policy if needed
    app.setStyle("Fusion")
    
    overlay = AssistantOverlay()
    
    # 1. Force PySide6 to create the native macOS window handle
    win_id = overlay.winId()
    
    # 2. Inject macOS properties BEFORE the window is shown on the screen
    mac_force_spaces_and_level(win_id)
    
    # 3. Now show the window natively with the correct configurations
    overlay.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
