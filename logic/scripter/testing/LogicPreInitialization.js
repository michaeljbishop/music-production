var Trace = console.log;
var ControlChange = function() {
  return {
    send: function() {
      globalThis.Trace("sending event", this);
    }
  }
};
var UpdatePluginParameters = function() {
  console.log("PluginParameters:", PluginParameters);
}
var ParameterValues = {};
var GetParameter = function(name) {
  return ParameterValues[name]
}
var SetParameter = function(name, value) {
  ParameterValues[name] = value;
  const index = (PluginParameters || []).findIndex(p => p.name == name);
  if (index != -1) {
    (ParameterChanged || (() => {}))(index, value);
  }
}

var MIDI = {
  normalizeData: function(data) {
      return Math.max(0, Math.min(127, Math.trunc(data)))
  }
};
