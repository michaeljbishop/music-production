// Script for using a single CC input to generate multiple CC outputs.
//
// This can be useful in many virtual instruments in which CC 11 controls the
// "Expression", which is a simple volume control and CC 11 controls "Dynamics"
// which controls the timbre (brightness) of the instrument. Typically these
// are controlled together with two fingers on sliders but this script allows
// you to configure how you want them to move, given a single CC input value.
//
// This allows you to control the overall volume and tone of an instrument
// given a single slider moving.
//
// To use this you pass a list of parameters you want to control into the main()
// function. Each object has these properties:
//
// name: <String>. This will show up in the sliders in the plugin panel.
// cc: <number> - This is the value of the CC control number. For example, 11 typically controls "Dynamics"
// controlCount: <number> - This is the number of plugin parameters that will control the curve.
//                          By default, it's 3, but you can have up to 5.
//                          You can also make a "passthrough" CC value by using just 2 with
//                          where the bottom slider is 0.0 and the top slider is 1.0.
//
//
// INSTRUCTIONS: https://github.com/michaeljbishop/music-production/logic/scripter/CCRider/README.md
// LICENSE: https://github.com/michaeljbishop/music-production/README.md

const controls = [{name: "Expression", cc: 11}, {name: "Dynamics", cc: 1}];

main(controls);

// --------------------------

function main(riderParams) {

  // Utility code to make dealing with Logic's API a little easier
  var MJBLogic = function() {

    // Register with Logic so when a parameter changes,
    // we call the parameter's valueChanged() method
    ParameterChanged = function(index, value) {
      const param = PluginParameters[index];
      if (param && param.valueChanged) {
        param.valueChanged(value);
      }
    }

    var API = {
      // Utility to send a CC Event with a value
      sendCCEvent: function(number, value) {
        var ccEvent = new ControlChange();
        ccEvent.number = number;
        ccEvent.value = value;
        ccEvent.send();
      },

      // Constructs a Parameter object
      // ---
      // This takes the same object you would specify
      // to the PluginParameters variable, but if you
      // use this, your parameter will have a
      // 'value' property to read/write the value
      // and a `reset()` function to reset
      // the value to the default
      Parameter: function(param) {
        Object.assign(this, param);
      },

      // Sets the parameters for the plugin and asks
      // Logic to update the plugin UI.
      // ---
      // Your parameters can have an extra
      // valueChanged() function property which will
      // be called back if the value changes.
      // If you parameter was made from new MJBLogic.Parameter()
      // then it will have a 'value' property that you can
      // read/write.
      //
      set parameters(params) {
        PluginParameters = params;
        UpdatePluginParameters();
      },

      get parameters() {
        return PluginParameters;
      },

      resetAllParameters: function() {
        this.parameters.forEach((p) => {
          if (p.reset)
            p.reset();
        });
      }
    };

    API.Parameter.prototype.reset = function() {
      this.value = this.defaultValue;
    }

    Object.defineProperty(API.Parameter.prototype, "value", {
      get() {
        return GetParameter(this.name);
      },
      set(value) {
        SetParameter(this.name, value);
      }
    });

    return API;
  }();

  // ---- CCRIDER

  function CCRider(args) {

    // Process the arguments
    var {
      name,
      cc: defaultCC,
      controlCount = 3
    } = args;

    // Cap the number of points to 6 for performance
    // Only a minimum of 2 makes any sense for interpolation.
    controlCount = Math.max(Math.min(controlCount, 5), 2);

    // Utility function to generate a static
    // lookup table of all the values, given the range of inputs from 0-127.
    // It generates a 1-dimensional bezier curve from the control points.
    function generateLookupTable(points) {
      function interpolate(t, _points) {
        if (_points.length < 2) return t;
        if (_points.length == 2) return (_points[1] - _points[0]) * t + _points[0];

        var otherPoints = [];
        for (var i = 0; i < (_points.length - 1); i++) {
          otherPoints.push(interpolate(t, [_points[i], _points[i + 1]]));
        }
        return interpolate(t, otherPoints);
      }

      var table = [];

      for (var i = 0; i <= 127; i++) {
        const p = interpolate(i / 127, points);
        table.push(MIDI.normalizeData(p * 127));
      }
      return table;
    }

    var inputValue = 0;
    var showingConfigurationParameters = false;
    var lookupTable = [];
    var controlParameters = [];
    var ccParameter = new MJBLogic.Parameter({
      text: name,
      name: name + " (CC)",
      defaultValue: defaultCC,
      minValue: 0,
      maxValue: 127,
      numberOfSteps: 127,
      type: "lin",
      hidden: !showingConfigurationParameters,
      valueChanged: function() {
        flush();
      }
    });

    // define controlParameters
    for (var i = 0; i < controlCount; i++) {
      var indexName = (i == controlCount - 1) ? "N" : i.toString();
      const defaultValue = i / (controlCount - 1)

      const isBookend = i == 0 || i == controlCount - 1;

      // control controls the range of the the non-bookend parameters
      // If it's more than 1.0, then the effect of that control point will be stronger.
      // On the other hand, it can make for some weird curves that double-back on
      // themselves.
      const controlRange = 1.1;
      var min = isBookend ? 0 : ((-defaultValue * controlRange) + defaultValue);
      var max = isBookend ? 1 : (((1 - defaultValue) * controlRange) + defaultValue);

      controlParameters.push(new MJBLogic.Parameter({
        name: name + " " + indexName,
        defaultValue: defaultValue,
        minValue: min,
        maxValue: max,
        numberOfSteps: 100,
        type: "lin",
        valueChanged: function() {
          lookupTable = generateLookupTable(controlParameters.map(p => p.value));
          flush();
        }
      }));
    }

    function flush() {
      if (!lookupTable) {
        lookupTable = generateLookupTable(controlParameters.map(p => p.value));
      }
      MJBLogic.sendCCEvent(ccParameter.value, lookupTable[inputValue]);
    }

    Object.defineProperty(this, "parameters", {
      get() {
        return [ccParameter].concat(controlParameters.toReversed());
      }
    });

    Object.defineProperty(this, "value", {
      set(value) {
        inputValue = value;
        flush();
      },
      get() {
        return inputValue;
      }
    });
    
    Object.defineProperty(this, "showingConfigurationParameters", {
      set(value) {
        if (showingConfigurationParameters == value)
          return;
        showingConfigurationParameters = value;
        ccParameter.hidden = !showingConfigurationParameters;
      },
      get() {
        return showingConfigurationParameters;
      }
    });
  }

  // ---- MAIN

  const riders = riderParams.map(rider => new CCRider(rider));

  var isConfiguring = false

  function updateParameters() {
    MJBLogic.parameters = [configurationParameter, inputParameter, riders.map(r => r.parameters), resetParameter].flat(2);
  }

  const configurationParameter = new MJBLogic.Parameter({
    name: "Toggle Configuration",
    type: "momentary",
    defaultValue: 0,
    valueChanged: function(value) {
      if (value != 1)
        return;

      isConfiguring = !isConfiguring;
      inputParameter.hidden = !isConfiguring;
      resetParameter.hidden = !isConfiguring;
      riders.forEach(rider => {
        rider.showingConfigurationParameters = isConfiguring;
      });

      updateParameters();
    }
  });

  const inputParameter = new MJBLogic.Parameter({
    name: "Input (CC)",
    defaultValue: 11,
    minValue: 0,
    maxValue: 127,
    numberOfSteps: 127,
    type: "lin",
    hidden: !isConfiguring
  });

  const resetParameter = new MJBLogic.Parameter({
    name: "Reset All Values",
    type: "momentary",
    defaultValue: 0,
    valueChanged: function(value) {
      if (value != 1)
        return;
      MJBLogic.resetAllParameters();
    },
    hidden: !isConfiguring
  });

  updateParameters();

  // LOGIC FUNCTIONS

  HandleMIDI = function(event) {
    if (event instanceof ControlChange && event.number == inputParameter.value) {
      riders.forEach(rider => {
        rider.value = event.value;
      });
    } else {
      event.send();
    }
  }
};


// Trace("safeParameters: " + PluginParameters);
