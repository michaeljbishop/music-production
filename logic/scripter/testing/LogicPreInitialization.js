var Trace = console.log;
var ControlChange = function() {
  return {
    trace: function() {
      globalThis.Trace("sending ControlChange", this);
    },
    send: function() {
      globalThis.Trace("ControlChange", this);
    }
  }
};
var TargetEvent = function() {
  return {
    trace: function() {
      globalThis.Trace("sending ControlChange", this);
    },send: function() {
      globalThis.Trace("sending TargetEvent", this);
    }
  }
};
var UpdatePluginParameters = function() {
//   console.log("PluginParameters:", PluginParameters);
  if (globalThis.PluginParameters != undefined) {
    PluginParameters.forEach((p) => {
      SetParameter(p.name, p.defaultValue || 0);
    })
  }
}
var ParameterValues = {};
var GetParameter = function(name) {
//   Trace("GetParameter(" + name + ")");
  return ParameterValues[name] || 0;
}
var SetParameter = function(name, value) {
//   console.log(`SetParameter(${name}, ${value})`);
  ParameterValues[name] = value;
  const index = (PluginParameters || []).findIndex(p => p.name == name);
  if (index != -1) {
    (ParameterChanged || (() => {}))(index, value);
  }
}

var MIDI = {
  normalizeData: function(data) {
    return Math.max(0, Math.min(127, Math.trunc(data)))
  },
  ccName: function(index)
  {
    return this._ccNames[index];
  },
  _ccNames: [
    "Bank MSB",
    "Modulation",
    "Breath",
    "Ctrl 3",
    "Foot Control",
    "Portamento",
    "Data MSB",
    "Volume",
    "Balance",
    "Ctrl 9",
    "Pan",
    "Expression",
    "Effect #1 MSB",
    "Effect #2 MSB",
    "Ctrl 14",
    "Ctrl 15",
    "General #1",
    "General #2",
    "General #3",
    "General #4",
    "Ctrl 20",
    "Ctrl 21",
    "Ctrl 22",
    "Ctrl 23",
    "Ctrl 24",
    "Ctrl 25",
    "Ctrl 26",
    "Ctrl 27",
    "Ctrl 28",
    "Ctrl 29",
    "Ctrl 30",
    "Ctrl 31",
    "Bank LSB",
    "#01 LSB",
    "#02 LSB",
    "#03 LSB",
    "#04 LSB",
    "#05 LSB",
    "#06 LSB",
    "#07 LSB",
    "#08 LSB",
    "#09 LSB",
    "#10 LSB",
    "#11 LSB",
    "Effect #1 LSB",
    "Effect #2 LSB",
    "#14 LSB",
    "#15 LSB",
    "#16 LSB",
    "#17 LSB",
    "#18 LSB",
    "#19 LSB",
    "#20 LSB",
    "#21 LSB",
    "#22 LSB",
    "#23 LSB",
    "#24 LSB",
    "#25 LSB",
    "#26 LSB",
    "#27 LSB",
    "#28 LSB",
    "#29 LSB",
    "#30 LSB",
    "#31 LSB",
    "Sustain",
    "Portamento",
    "Sostenuto",
    "Soft Pedal",
    "Legato",
    "Hold2",
    "Sound Var",
    "Resonance",
    "Release Time",
    "Attack Time",
    "Brightness",
    "Decay Time",
    "Vibrato Rate",
    "Vibrato Depth",
    "Vibrato Delay",
    "Ctrl 79",
    "Decay",
    "HPF Frequ",
    "General #7",
    "General #8",
    "Portamento Ctl",
    "Ctrl 85",
    "Ctrl 86",
    "Ctrl 87",
    "Ctrl 88",
    "Ctrl 89",
    "Ctrl 90",
    "Reverb",
    "Tremolo",
    "Chorus Depth",
    "Detune/Var.",
    "Phaser",
    "Data increm.",
    "Data decrem.",
    "Non-Reg. LSB",
    "Non-Reg. MSB",
    "Reg.Par. LSB",
    "Reg.Par. MSB",
    "Ctrl 102",
    "Ctrl 103",
    "Ctrl 104",
    "Ctrl 105",
    "Ctrl 106",
    "Ctrl 107",
    "Ctrl 108",
    "Ctrl 109",
    "Ctrl 110",
    "Ctrl 111",
    "Ctrl 112",
    "Ctrl 113",
    "Ctrl 114",
    "Ctrl 115",
    "Ctrl 116",
    "Ctrl 117",
    "Ctrl 118",
    "Ctrl 119",
    "All Sound Off",
    "Reset Ctrls.",
    "Local Control",
    "All Notes Off",
    "Omni Mode Off",
    "Omni Mode  On",
    "Mono Mode On",
    "Poly Mode On",
  ]
};
