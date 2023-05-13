"use strict";

// Script for using a single input to generate multiple outputs, scaled along a
// custom-defined curve.
//
// This can be useful in many virtual instruments in which CC 11 controls the
// "Expression", which is a simple volume control and CC 1 controls "Dynamics"
// which controls the timbre (brightness) of the instrument. Typically these
// are controlled together with two fingers on sliders but this script allows
// you to configure how you want them to move, given a single CC input value.
//
// To add outputs, add items to the "key" variable below. Each key is used to give a
// unique name to every parameter. They can be full words or letters, but they
// must be unique.
//
// INSTRUCTIONS: https://github.com/michaeljbishop/music-production/logic/scripter/CCRider/README.md
// LICENSE: https://github.com/michaeljbishop/music-production/README.md

const keys = ["e", "d"]; // e -> expression, d -> dynamics

const kSliderResolution = 128 // How many notches in each slider. 128 is good.
const kMaxControlParameterCount = 9; // The maximum number of sliders per group
const kDefaultControlParameterCount = 3; // The default number of sliders per group

function main() {

  const kMidiInputTypes = {
    off: 0,
    learn: 1,
    note: 2,
    velocity: 3,
    pitchbend: 4,
    pressure: 5,
    CC: 6,
  };

  const kInputMenuItems = [
    "(Off)",
    "- Learn MIDI -",
    "Note",
    "Velocity",
    "Pitchbend",
    "Channel Pressure",
    ...(MBLogic.ccNames.map((name, index) => `${index} - ${name}`))
  ];

  const riders = keys.map((key) => new CCRider(key, kDefaultControlParameterCount));

  const inputParameter = new MBLogic.Parameter({
    name: "Input",
    minValue: 0,
    maxValue: 127,
    numberOfSteps: 127,
    type: "menu",
    valueStrings: kInputMenuItems,
    defaultValue: kMidiInputTypes.CC + 1,
    valueChanged: function(value) {
      isLearningMIDI = (value == kMidiInputTypes.learn);
    },
  });

  const curveResolutionParameter = new MBLogic.Parameter({
    name: "Curve Resolution",
    defaultValue: kDefaultControlParameterCount,
    minValue: 2,
    maxValue: Math.max(kMaxControlParameterCount, 2),
    numberOfSteps: kMaxControlParameterCount - 2,
    type: "lin",
    valueChanged: function(value) {
      riders.forEach(r => (r.curveResolution = value))
    },
  });

  MBLogic.parameters = [inputParameter, curveResolutionParameter, riders.map(r => r.parameters)].flat(2);

  // LOGIC FUNCTIONS

  var isLearningMIDI = false;

  globalThis.HandleMIDI = function(event) {
    if (isLearningMIDI) {
      var learnedInputType;

      if (event instanceof ControlChange) {
        learnedInputType = kMidiInputTypes.CC + event.number
      } else if (event instanceof ChannelPressure) {
        learnedInputType = kMidiInputTypes.pressure
      } else if (event instanceof NoteOn) {
        learnedInputType = kMidiInputTypes.velocity
      } else if (event instanceof PitchBend) {
        learnedInputType = kMidiInputTypes.pitchbend
      }

      if (learnedInputType != undefined) {
        inputParameter.value = learnedInputType;
        return;
      }

      event.send();
    }

    var inputValue;
    const inputType = inputParameter.value;

    // These are ordered by how likely they are to be used
    if (inputType == (kMidiInputTypes.CC + event.number) && event instanceof ControlChange) {
      inputValue = event.value / 127;
    } else if (inputType == kMidiInputTypes.pressure && event instanceof ChannelPressure) {
      inputValue = event.pitch / 127;
    } else if (inputType == kMidiInputTypes.pitchbend && event instanceof PitchBend) {
      const kPitchBendMin = -8192;
      const kPitchBendMax = 8191;
      inputValue = (event.value - kPitchBendMin) / (kPitchBendMax - kPitchBendMin);
    } else if (inputType == kMidiInputTypes.velocity && event instanceof NoteOn) {
      inputValue = event.velocity / 127;
    } else if (inputType == kMidiInputTypes.note && event instanceof NoteOn) {
      inputValue = event.pitch / 127;
    }

    if (inputValue != undefined) {
      riders.forEach(rider => {
        rider.value = inputValue;
      });
    } else {
      event.send();
    }
  }
}

// =================== MBMath ===================

var MBMath = {
  approximatelyEqual: function(a, b) {
    return Math.abs(a - b) < 0.001;
  },
  clamp: function(value, min, max) {
    return Math.max(Math.min(max, value), min)
  }
}

// =================== MBLogic ===================
//
// Utility code to make dealing with Logic's API a little easier

var MBLogic = function() {
  const kMaxTraceQueueLength = 100;
  var _eventQueue = [];
  var _traceQueue = [];

  var API = {

    onNextLoop: function(func) {
      _eventQueue.push(func);
    },

    trace: function(item) {
      if (_traceQueue.length > kMaxTraceQueueLength) {
        _traceQueue = ["--- Thinning Trace ---"].concat(_traceQueue.slice(kMaxTraceQueueLength - 1));
      }
      _traceQueue.push(item);
    },

    // Utility to send a CC Event with a value
    sendTargetEvent: function(parameterName, value) {
      var event = new TargetEvent();
      event.target = parameterName;
      event.value = value;
      event.send();
    },

    ccNames: function() {
      var result = [];
      for (var i = 0; i < 128; i++) {
        result.push(MIDI.ccName(i));
      }
      return result;
    }(),

    // Constructs a Parameter object
    // ---
    // This takes the same object you would specify
    // to the PluginParameters variable, but if you
    // use this, your parameter will have a
    // 'value' property to read/write the value.
    Parameter: function(param) {
      Object.assign(this, param);
    },

    // Sets the parameters for the plugin and asks
    // Logic to update the plugin UI.
    // ---
    // Your parameters can have an extra
    // valueChanged() function property which will
    // be called back if the value changes.
    // If you parameter was made from new MBLogic.Parameter()
    // then it will have a 'value' property that you can
    // read/write.
    //
    set parameters(params) {
      PluginParameters = params;
      globalThis.UpdatePluginParameters();
    },

    get parameters() {
      return PluginParameters;
    },

    updatePluginParameters: function() {
      globalThis.UpdatePluginParameters();
    },

    // This function is what the Logic linear parameters use when you give them a value to
    // truncate it to the steps
    step: function(v, min, max, steps) {
      const range = max - min;
      const normalizedInput = (v - min) / range;
      const normalizedStepValue = Math.round(normalizedInput * steps) / steps;
      const returnValue = (normalizedStepValue * range) + min;
      return returnValue;
    }
  };

  API.Parameter.prototype._valueChanged = function(value) {
    this._lastValue = value;

    if (this.valueChanged)
      this.valueChanged(value)
  };

  Object.defineProperty(API.Parameter.prototype, "value", {
    get() {
      if (this._lastValue == undefined)
        this._lastValue = GetParameter(this.name);

      return this._lastValue;
    },
    set(value) {
      this._lastValue = MBLogic.step(value, this.minValue || 0, this.maxValue || 100, this.numberOfSteps || 100);
      SetParameter(this.name, value);
    }
  });

  globalThis.Idle = function() {
    // Batch trace output so it doesn't
    // get suppressed by the console
    for (var i = 0; i < 3; i++) {
      const msg = _traceQueue.shift();
      if (msg == undefined)
        break;

      globalThis.Trace(msg);
    }

    const f = _eventQueue.shift();
    if (f != undefined)
      f();
  }

  globalThis.PluginParameters = [];

  // Register with Logic so when a parameter changes,
  // we call the parameter's valueChanged() method
  globalThis.ParameterChanged = function(index, value) {
    const param = PluginParameters[index];
    if (param && param._valueChanged) {
      param._valueChanged(value);
    }
  }

  return API;
}();


// =================== CCRider ===================

function CCRider(key, defaultParameterCount) {
  defaultParameterCount = defaultParameterCount || 3;

  const kSliderMax = 100
  const rider = this;
  var _curveResolution = 0; // The number of control points that are visible.
  var _curve;
  var _savedCurve;
  var _points = [];
  var _controlParameters = [];
  var _value; // The most recent value we were set to

  var _outputParameter = new MBLogic.Parameter({
    name: "Output " + key,
    type: "target",
    valueChanged: flush.bind(rider)
  });

  for (var i = 0; i < kMaxControlParameterCount; i++) {
    const index = i;
    var indexName = (i + 1).toString();
    const defaultValue = Math.min((i / (defaultParameterCount - 1) * kSliderMax), kSliderMax)

    _controlParameters.push(new MBLogic.Parameter({
      name: indexName + " " + key,
      defaultValue: MBMath.clamp(defaultValue, 0, kSliderMax),
      minValue: 0,
      maxValue: kSliderMax,
      numberOfSteps: kSliderResolution,
      type: "lin",
      unit: "%",
      hidden: i >= defaultParameterCount,
      valueChanged: function(value) {
        const lastValue = MBLogic.step(_points[index] * kSliderMax, 0, kSliderMax, kSliderResolution);

        if (MBMath.approximatelyEqual(value, lastValue))
          return;

        // If this value is different than the point then, we should:
        // - Update the point.
        _points[index] = value / kSliderMax;

        if (index < _curveResolution) {
          // - invalidate the curve and the savedCurve
          _curve = undefined;
          _savedCurve = undefined

          // - flush to reflect the new points
          flush();
        }
      }
    }));
  };

  Object.defineProperty(this, "parameters", {
    get() {
      return [_outputParameter].concat(_controlParameters.toReversed());
    }
  });

  // value is from 0.0 to 1.0
  Object.defineProperty(this, "value", {
    get() {
      return _value;
    },
    set(c) {
      // If this value is different than the internal value then we should:
      // - Update the current value.
      // - Flush
      if (MBMath.approximatelyEqual(c, _value))
        return;

      _value = MBMath.clamp(c, 0.0, 1.0)
      flush();
    }
  });

  Object.defineProperty(this, "curveResolution", {
    get() {
      return _curveResolution;
    },

    set(value) {
      if (value == _curveResolution)
        return;

      const shouldSetToDefaults = (_curveResolution == undefined)

      // If this value is different than the internal value then we should:
      // - SAVE the curve if there isn't already a saved curve
      _savedCurve = _savedCurve || curve();

      _curveResolution = value;

      // - Hide the unused controls
      _controlParameters.forEach((p, index) => {
        p.hidden = index >= _curveResolution;
      });

      // Update the points based on the saved curve
      if (_savedCurve && _points.length > 1) {
        for (var i = 0; i < _curveResolution; i++) {
          const newPoint = _savedCurve(i / (_curveResolution - 1));
          _points[i] = newPoint;
          _controlParameters[i].value = (newPoint * kSliderMax);
        }
      }

      // - Update the UI to reflect the new points
      MBLogic.updatePluginParameters()

      // remove the current curve so it will be
      // regenerated when we flush, which will reflect
      // the new control points
      _curve = undefined;
      flush()
    }
  });


  function curve() {
    if (_curve == undefined) {
      const pts = _points.slice(0, rider.curveResolution);
      var allDefined = true;
      for (var i = 0; i < pts.length; i++) {
        allDefined = allDefined && (pts[i] != undefined)
      }

      if (!pts || (pts.length < 2) || !allDefined)
        return undefined;

      // 127 is the most common MIDI value range so we use 128 points
      // in the bezierCurve lookup table
      _curve = bezierCurve(pts, 128);
    }
    return _curve;
  }

  function flush() {
    var c = curve();
    if (c == undefined) {
      return;
    }
    const value = rider.value;
    if (value == undefined) {
      return;
    }
    MBLogic.sendTargetEvent(_outputParameter.name, c(value));
  }
}

// =================== bezierCurve ===================

var bezierCurve = function(points, resolution) {
  if (resolution == undefined)
    resolution = 100;

  var _lookupTable = new Array(resolution);

  // Returns the index of a slice and
  // t scaled to the slice range
  function sliced(t, pointCount) {
    if (pointCount == 1)
      return [0, t];

    const sliceCount = pointCount - 1;
    const index = Math.floor(t * sliceCount)
    const remainder = (t - (index / sliceCount)) * sliceCount;
    return [index, remainder];
  }

  function interpolate(t, _points) {
    if (_points == undefined) return t;

    // Shortcut to fast formula for cubics
    if (_points.length == 4) {
      var result = (((1 - t) ** 3) * _points[0]) +
        (3 * t * ((1 - t) ** 2) * _points[1]) +
        (3 * (t ** 2) * (1 - t) * _points[2]) +
        (t ** 3) * _points[3];

      // We can get some precision problems here if all the points
      // are equal to 1 and the result is slightly larger than 1
      result = MBMath.clamp(result, 0.0, 1.0);
      return result;
    }

    // fallback to De Casteljau's algorithm
    if (_points.length < 2) return t;
    if (_points.length == 2) return (_points[1] - _points[0]) * t + _points[0];

    var otherPoints = [];
    for (var i = 0; i < (_points.length - 1); i++) {
      otherPoints.push(interpolate(t, [_points[i], _points[i + 1]]));
    }
    return interpolate(t, otherPoints);
  }

  function at(t, curves) {
    if (t >= 1.0) {
      return points[points.length - 1];
    }
    if (t <= 0) {
      return points[0];
    }

    // We have curves.length + 1 total points being represented
    var [index, scaledRemainder] = sliced(t, curves.length + 1)
    var result = interpolate(scaledRemainder, curves[index]);
    return result;
  }

  // Input must be from 0 -> 1
  function memoizedAt(t, curves) {

    function lookupValue(index) {
      const lookupValue = _lookupTable[index];

      if (lookupValue != undefined) {
        return lookupValue;
      }

      const t = index * (1 / (resolution - 1));
      return _lookupTable[index] = at(t, curves)
    }

    var [index, scaledRemainder] = sliced(t, resolution);
    const value = lookupValue(index);

    // If the lookup is the last value, there's no value
    // to interpolate to after that
    if (index == _lookupTable.length - 1)
      return value;

    const valueB = lookupValue(index + 1);
    return interpolate(scaledRemainder, [value, valueB])
  }

  function generateCurves(curvePoints) {
    function xor(a, b) {
      return (a && b) || !(a || b)
    }

    var curves = [];

    curvePoints.forEach((point, index) => {
      var curve = [];
      const offsetConst = 3;

      // start point
      if (index == 0) {
        const offset = point + (curvePoints[1] - point) / 3;
        curves[0] = [point, offset];
        return;
      }

      // last point. Append the point to the last curve
      if (index == curvePoints.length - 1) {
        const offset = curvePoints[index - 1] + (point - curvePoints[index - 1]) / 3;
        curves[index - 1].push(offset);
        curves[index - 1].push(point);
        return;
      }
      // what is the slope of the previous line:
      const prevslope = point - curvePoints[index - 1];
      const nextSlope = curvePoints[index + 1] - point;
      const averageSlope = (prevslope + nextSlope) / 2;
      const isLocalMaxMin = !xor(prevslope > 0, nextSlope > 0)
      var offset = Math.min(Math.abs(prevslope), Math.abs(nextSlope), Math.abs(averageSlope / offsetConst)) * Math.sign(averageSlope)

      curves[index - 1].push(point - (isLocalMaxMin ? 0 : offset));
      curves[index - 1].push(point);

      curve.push(point);
      curve.push(point + (isLocalMaxMin ? 0 : offset));

      curves.push(curve);
    });

    return curves;
  }

  const curves = generateCurves(points);

  return function(t) {
    return memoizedAt(t, curves);
  }
}

main()
