"use strict";

// Script for using a single input to generate multiple outputs, scaled along a curve.
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
// To add outputs, add items to the "key" variable below. Each key is used to give a
// unique name to every parameter. They can be full words or letters, but they
// must be unique.
//
// INSTRUCTIONS: https://github.com/michaeljbishop/music-production/logic/scripter/CCRider/README.md
// LICENSE: https://github.com/michaeljbishop/music-production/README.md

const keys = ["e", "d", "b"];

const kSliderResolution = 128 // How many notches in each slider. 128 is good.
const kMaxControlParameterCount = 9; // The maximum number of sliders per group
const kDefaultControlParameterCount = 3; // The maximum number of sliders per group


function main() {

  var inputMenuItems = [
    "(Off)",
    "- Learn MIDI -",
    "Note",
    "Velocity",
    "Pitchbend",
    "Channel Pressure",
    ...(MJBLogic.ccNames.map((name, index) => `${index} - ${name}`))
  ];

  const MIDI_TYPES = {
    off: 0,
    learn: 1,
    note: 2,
    velocity: 3,
    pitchbend: 4,
    pressure: 5,
    CC: 6,
  };

  var isLearningMIDI = false;

  var menuKeyToIndex = function() {
    var result = {}
    inputMenuItems.forEach(function(item, index) {
      result[item] = index;
    });
    return result;
  }();
  const kPitchBendMin = -8192;
  const kPitchBendMax = 8191;

  const riders = keys.map((key) => new CCRider(key, kDefaultControlParameterCount));

  const inputParameter = new MJBLogic.Parameter({
    name: "Input",
    minValue: 0,
    maxValue: 127,
    numberOfSteps: 127,
    type: "menu",
    valueStrings: inputMenuItems,
    defaultValue: MIDI_TYPES.CC + 1,
    valueChanged: function(value) {
      isLearningMIDI = (value == MIDI_TYPES.learn);
    },
  });

  const curvePointCountParameter = new MJBLogic.Parameter({
    name: "Curve Point Count",
    defaultValue: kDefaultControlParameterCount,
    minValue: 2,
    maxValue: Math.max(kMaxControlParameterCount, 2),
    numberOfSteps: kMaxControlParameterCount - 2,
    type: "lin",
    valueChanged: function(value) {
      riders.forEach(r => (r.controlPointCount = value))
    },
  });

  MJBLogic.parameters = [inputParameter, curvePointCountParameter, riders.map(r => r.parameters)].flat(2);

  // LOGIC FUNCTIONS

  globalThis.HandleMIDI = function(event) {
    if (isLearningMIDI) {
      if (event instanceof NoteOn) {
        inputParameter.value = MIDI_TYPES.velocity
      } else if (event instanceof ChannelPressure) {
        inputParameter.value = MIDI_TYPES.pressure
      } else if (event instanceof PitchBend) {
        inputParameter.value = MIDI_TYPES.pitchbend
      } else if (event instanceof ControlChange) {
        inputParameter.value = MIDI_TYPES.CC + event.number
      } else {
        event.send();
      }
      return;
    }

    var inputValue;

    if (event instanceof NoteOn && inputParameter.value == MIDI_TYPES.note) {
      inputValue = event.pitch / 127;
    } else if (event instanceof NoteOn && inputParameter.value == MIDI_TYPES.velocity) {
      inputValue = event.velocity / 127;
    } else if (event instanceof ChannelPressure && inputParameter.value == MIDI_TYPES.pressure) {
      inputValue = event.pitch / 127;
    } else if (event instanceof PitchBend && inputParameter.value == MIDI_TYPES.pitchbend) {
      inputValue = (event.value - kPitchBendMin) / (kPitchBendMax - kPitchBendMin);
    } else if (event instanceof ControlChange && inputParameter.value == (MIDI_TYPES.CC + event.number)) {
      inputValue = event.value / 127;
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

// --------------------------

// Utility code to make dealing with Logic's API a little easier
var MJBLogic = function() {
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
      //       event.trace();
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
      //       MJBLogic.trace("set parameters - BEGIN" + params.map(p => p.name));
      PluginParameters = params;
      globalThis.UpdatePluginParameters();
    },

    get parameters() {
      return PluginParameters;
    },

    updatePluginParameters: function() {
      globalThis.UpdatePluginParameters();
    },
  };

  API.Parameter.prototype._valueChanged = function(value) {

    //     if (!approximatelyEqual(value, this._lastValue))
    //       MJBLogic.trace(this.name + " - _valueChanged(" + value + "), _lastValue: " + this._lastValue + ", diff: " + Math.abs(value - this._lastValue));

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
      this._lastValue = step(value, this.minValue || 0, this.maxValue || 100, this.numberOfSteps || 100);
      //       MJBLogic.trace(this.name + " - value set(" + value + "), _lastValue: " + this._lastValue + ", diff: " + Math.abs(value - this._lastValue));
      SetParameter(this.name, value);
    }
  });

  globalThis.Idle = function() {
    // Batch output
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
    //     Trace("ParameterChanged: " + "index: " + index + ", value: " + value);
    const param = PluginParameters[index];
    //     Trace("ParameterChanged: " + "param.name: " + param.name + ", value: " + value);
    if (param && param._valueChanged) {
      //       MJBLogic.trace("ParameterChanged: " + "param.name: " + param.name + ", value: " + value);
      param._valueChanged(value);
    }
  }

  return API;
}();

// ---- CCRIDER

function CCRider(key, defaultParameterCount) {
  defaultParameterCount = defaultParameterCount || 3;

  const kSliderMax = 100
  const rider = this;
  var _controlPointCount = 0; // The number of control points that are visible.
  var _curve;
  var _backupCurve;
  var _points = [];
  var _controlParameters = [];
  var _value; // The most recent value we were set to

  var _targetParameter = new MJBLogic.Parameter({
    name: "Target " + key,
    type: "target",
    valueChanged: flush.bind(rider)
  });

  for (var i = 0; i < kMaxControlParameterCount; i++) {
    const index = i;
    //     var indexName = (i + 1).toString();
    var indexName = (i).toString();
    const defaultValue = Math.min((i / (defaultParameterCount - 1) * kSliderMax), kSliderMax)
    _controlParameters.push(new MJBLogic.Parameter({
      name: indexName + " " + key,
      defaultValue: constrain(defaultValue, 0, kSliderMax),
      minValue: 0,
      maxValue: kSliderMax,
      numberOfSteps: kSliderResolution,
      type: "lin",
      unit: "%",
      hidden: i >= defaultParameterCount,
      valueChanged: function(value) {

        const lastValue = step(_points[index] * kSliderMax, 0, kSliderMax, kSliderResolution);

        //         const point = _points[index];
        //         const value = _value / kSliderMax;
        //         const steppedPoint = step(point, 0, kSliderMax, kSliderResolution)

        //         MJBLogic.trace(_controlParameters[index].name + " - valueChanged(" + value + "), steppedPoint: " + steppedPoint + ", diff: " + Math.abs(value - steppedPoint) + ", point: " + point);

        if (approximatelyEqual(value, lastValue))
          return;

        //         MJBLogic.trace("UPDATING: " + _controlParameters[index].name + " - valueChanged to: " + value + ". lastValue: " + lastValue);


        // TODO:
        // If this value is different than the point then, we should:
        // - Update the point.
        _points[index] = value / kSliderMax;
        //                   MJBLogic.trace(`point(${index}) = ${_points[index]}`);

        if (index < _controlPointCount) {
          //           MJBLogic.trace("INVALIDATING CURVE")
          // - Invalidate the curve.
          _curve = undefined;
          _backupCurve = undefined
          //         MJBLogic.trace("curve() - " + _curve);
          // - Flush
          flush();
        }
      }
    }));
  };

  Object.defineProperty(this, "parameters", {
    get() {
      return [_targetParameter].concat(_controlParameters.toReversed());
    }
  });

  // value is from 0.0 to 1.0
  Object.defineProperty(this, "value", {
    get() {
      //         MJBLogic.trace(key + " - get value():" + _value);
      return _value;
    },
    set(c) {
      // TODO:
      // If this value is different than the internal value then we should:
      // - Update the current value.
      // - Flush
      //         MJBLogic.trace("set value() - c:" + c);
      if (approximatelyEqual(c, _value))
        return;

      _value = constrain(c, 0.0, 1.0)
      //       MJBLogic.trace(key + " - set value: " + _value);
      flush();
    }
  });

  Object.defineProperty(this, "controlPointCount", {
    get() {
      return _controlPointCount;
    },

    set(value) {
      //         Trace("setting _controlPointCount of " + name + " to " + value)
      if (value == _controlPointCount)
        return;

      const shouldSetToDefaults = (_controlPointCount == undefined)

      // If this value is different than the internal value then we should:
      // - KEEP the curve but update the points
      _backupCurve = _backupCurve || curve();

      _controlPointCount = value;

      // - Hide the unused controls
      _controlParameters.forEach((p, index) => {
        p.hidden = index >= _controlPointCount;
      });


      if (_backupCurve && _points.length > 1) {
        for (var i = 0; i < _controlPointCount; i++) {
          const newPoint = _backupCurve(i / (_controlPointCount - 1));
          //           MJBLogic.trace("controlPointCount - update points and params - point[" + i + "] = " + newPoint + ", _controlParameters[" + i + "].value = " + newPoint * kSliderMax);
          //           MJBLogic.trace(`point(${i}) = ${newPoint}`);

          _points[i] = newPoint;

          // - Update the new controls based on the current curve
          _controlParameters[i].value = (newPoint * kSliderMax);
        }
      }

      // - Update the UI to reflect the new points
      MJBLogic.updatePluginParameters()

      _curve = undefined;
      flush()

      // - DO NOT FLUSH
      // It will generate a new curve
    }
  });


  // CURVE

  function curve() {
    //     MJBLogic.trace("curve() - " + _curve);
    if (_curve == undefined) {
      const pts = _points.slice(0, rider.controlPointCount);
      var allDefined = true;
      for (var i = 0; i < pts.length; i++) {
        allDefined = allDefined && (pts[i] != undefined)
      }
      if (!pts || (pts.length < 2) || !allDefined) {
        //         MJBLogic.trace(key + " - curve() - some points are undefined");
        return undefined;
      }

      //       MJBLogic.trace(key + " - curve() - building from " + pts.join(","));
      // 127 is the most common MIDI value range so we use 128 points
      // in the Bezier lookup table
      //       MJBLogic.trace("NEW CURVE - " + pts);
      _curve = new Bezier(pts, 128);
    }
    return _curve;
  }

  function flush() {
    //     MJBLogic.trace(key + " - flush()");
    var c = curve();
    if (c == undefined) {
      //       MJBLogic.trace(key + " - flush() - curve() is undefined");
      return;
    }

    const value = rider.value;
    if (value == undefined) {
      //       MJBLogic.trace(key + " - flush() - value is undefined");
      return;
    }
    //     MJBLogic.trace(key + " - flush() - MJBLogic.sendTargetEvent(" + _targetParameter.name + ", " + c(value) + ")");
    MJBLogic.sendTargetEvent(_targetParameter.name, c(value));
  }
}

// ---- MAIN


function Bezier(points, lookupEntryCount) {
  if (lookupEntryCount == undefined)
    lookupEntryCount = 100;

  var _lookupTable = new Array(lookupEntryCount);
  const _lookupTableSteps = lookupEntryCount - 1;

  function sliced(t, pointCount) {
    if (pointCount == 1)
      return [0, t];
    const slices = pointCount - 1;
    const adjustedValue = t * slices;
    const index = Math.floor(adjustedValue)
    const remainder = (t - (index / slices)) * slices;
    return [index, remainder];
  }

  function interpolate(t, _points) {
    if (_points == undefined) return t;

    // Shortcut to fast formula
    if (_points.length == 4) {
      return (((1 - t) ** 3) * _points[0]) +
        (3 * t * ((1 - t) ** 2) * _points[1]) +
        (3 * (t ** 2) * (1 - t) * _points[2]) +
        (t ** 3) * _points[3];
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

  function oldAt(t, curves) {
    if (t >= 1.0) {
      return points[points.length - 1];
    }
    if (t <= 0) {
      return points[0];
    }

    // We have curves.length + 1 total points being represented
    var [index, scaledRemainder] = sliced(t, curves.length + 1)
    return interpolate(scaledRemainder, curves[index]);
  }

  function lookupValue(index) {
    const lookupValue = _lookupTable[index];

    if (lookupValue != undefined) {
      return lookupValue;
    }

    const t = index * (1 / _lookupTableSteps);
    return _lookupTable[index] = oldAt(t, curves)
  }

  // Input must be from 0 -> 1
  function at(t, curves) {
    if (t >= 1.0) {
      return points[points.length - 1];
    }
    if (t <= 0) {
      return points[0];
    }

    var [index, scaledRemainder] = sliced(t, lookupEntryCount);
    const value = lookupValue(index);

    if (index == _lookupTable.length - 1)
      return value;

    const valueB = lookupValue(index + 1);

    const point = interpolate(scaledRemainder, [value, valueB])
    return point
  }

  function generateCurves(curvePoints) {
    function xor(a, b) {
      return (a && b) || !(a || b)
    }

    var curves = [];
    const offset = 0.1;

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
      const nextlope = curvePoints[index + 1] - point;
      const averageSlope = (prevslope + nextlope) / 2;
      const topOfCurve = !xor(prevslope > 0, nextlope > 0)
      var offset = Math.min(Math.abs(prevslope), Math.abs(nextlope), Math.abs(averageSlope / offsetConst))
      if (averageSlope < 0)
        offset = offset * -1;
      const slopeDifference = prevslope - nextlope;

      curves[index - 1].push(point - (topOfCurve ? 0 : offset));
      curves[index - 1].push(point);

      curve.push(point);
      curve.push(point + (topOfCurve ? 0 : offset));

      curves.push(curve);
    });
    return curves;
  }

  const curves = generateCurves(points);

  return function(t) {
    return at(t, curves);
  }
}

function constrain(value, min, max) {
  return Math.max(Math.min(max, value), min)
}

// This function is what the sliders use when you give them a value
function step(v, min, max, steps) {
  const range = max - min;
  const normalizedInput = (v - min) / range;
  const normalizedStepValue = Math.round(normalizedInput * steps) / steps;
  const returnValue = (normalizedStepValue * range) + min;
  return returnValue;
}

function approximatelyEqual(a, b) {
  return Math.abs(a - b) < 0.01;
}

main()
