import os
import ctypes

def mac_make_accessory():
    try:
        lib_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mac_overlay.dylib')
        if os.path.exists(lib_path):
            overlay = ctypes.cdll.LoadLibrary(lib_path)
            overlay.mac_make_accessory()
    except Exception as e:
        print(f"mac_make_accessory failed: {e}")

def mac_force_spaces_and_level(win_id):
    try:
        lib_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mac_overlay.dylib')
        if os.path.exists(lib_path):
            overlay = ctypes.cdll.LoadLibrary(lib_path)
            overlay.mac_force_overlay.argtypes = [ctypes.c_long]
            overlay.mac_force_overlay.restype = None
            overlay.mac_force_overlay(int(win_id))
    except Exception as e:
        print(f"mac_force_spaces_and_level failed: {e}")
