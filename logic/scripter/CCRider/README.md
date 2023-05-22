# Overview

CCRider is a Logic script for using a single input to generate multiple outputs, scaled along a custom-defined curve.

This can be useful in many virtual instruments in which CC 11 controls the "Expression", which is a simple volume control and CC 1 controls "Dynamics" which controls the timbre (brightness) of the instrument. Typically these are controlled together with two fingers on sliders but this script allows you to configure, per-instrument how you want each attribute to change, given a single CC input value.

With this in place, there is a single fader to move and a single lane of CC data to edit.

# How to install CCRider:

1. Add a "Scripter" midi insert to your instrument. It should show you the control panel.
2. Press the "Open Script in Editor" button if the "Script Editor" is not showing.
3. Copy and paste all of [this source code](./CCRider.js) into the editor and press "Run Script"
4. The Scripter plugin interface should now show a number of controls.

# Explanation video

See this video for a 11-minute tutorial.

[An alternate way to control multiple plugin parameters in Logic Pro (using CCRider)](https://youtu.be/cnaiPunGN8k)
