import touch
import bluetooth
import display
import gc

# Define the touch callback function which is triggered upon a touch event
def fn(arg):
    if arg == touch.A:
        bluetooth.send('A')
    if arg == touch.B:
        bluetooth.send('B')

touch.callback(touch.BOTH, fn) # Attaches the callback to the both buttons