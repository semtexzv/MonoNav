import touch
import bluetooth
import display
import gc

def fn(arg):
    if arg == touch.A:
        bluetooth.send('A')
    if arg == touch.B:
        bluetooth.send('B')

touch.callback(touch.BOTH, fn)

gc.collect()