if (globalThis.PluginParameters != undefined) {
  PluginParameters.forEach((p) => {
    SetParameter(p.name, p.defaultValue || 0);
  })
}

var runProcessMIDI = function() {
  if (globalThis.ProcessMIDI)
    globalThis.ProcessMIDI();
  window.setTimeout(runProcessMIDI, 100)
};
runProcessMIDI();

var runIdle = function() {
  if (globalThis.Idle)
    globalThis.Idle();
  window.setTimeout(runIdle, 250)
};
runIdle();
