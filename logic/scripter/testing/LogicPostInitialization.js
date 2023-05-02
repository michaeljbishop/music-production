
PluginParameters.forEach((p) => {
  SetParameter(p.name, p.defaultValue || 0);
})
