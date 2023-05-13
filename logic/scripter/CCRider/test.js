var c = document.getElementById("myCanvas");
var ctx = c.getContext("2d");

const width = c;
const margin = 12;

function scaled(x, y) {
  return [
    x * (c.width - (margin * 2)) + margin,
    (1 - y) * (c.height - (margin * 2)) + margin,
  ];
}

function drawPoint(x, y, diameter) {
  ctx.beginPath();
  ctx.arc(x, y, diameter, 0, 2 * Math.PI, true);
  ctx.fill();
}

const points = [
  0.43,
  0.67,
  0.43,
  0.67,
  0.0,
  0.43,
  0.67,
  0.0,
  1.0,
  0.2,
  0.3,
  0.60,
];
// const points = [
// 0.0,
// 1.0,
// 0.0,
// 1.0,
// 0.0,
// 1.0,
// 0.0,
// 1.0,
// 0.0,
// 1.0,
// 0.0,
// 1.0,
// ];

console.log("TEST")

var bezier = Bezier(points, 128);
//   var point = bezier(0.99);
//   drawPoint(...scaled(point, 0.99), 1);

// for (var i = 0.0; i <= 1.0; i += (1 / (points.length))) {
// for (var i = 0.0; i <= 1.0; i += 0.99) {
const drawDetail =
true;
// false;
if (drawDetail) {
for (var i = 0.0; i <= 1.0; i += 0.001) {
  var point = bezier(i);
  drawPoint(...scaled(point, i), 1);
}
}
// drawPoint(...scaled(bezier(1.0), 1), 1);

// Draw points at curve connections
points.forEach((point, index) => {
  drawPoint(...scaled(point, index / (points.length - 1)), 4);
});
// 
// console.log("---TEST---")
// riders.forEach(rider => {
//   rider.controlPointCount = 2;
//   rider.value = 64;
// });
// 
// const rider = riders[0];
// rider.controlPointCount = 5;
// rider.controlPointCount = 4;
