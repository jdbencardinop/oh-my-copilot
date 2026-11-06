import { eq, fail, functionText, load, read, readBefore, taskDir, throws } from "../_lib/check.mjs";

const dir = taskDir(import.meta.url);
const m = await load("measure.mjs");
const near = (a, b, what) => {
  if (!(Math.abs(a - b) < 1e-9)) fail(`${what}: expected ${b}, got ${a}`);
};

near(m.percentile([10, 20, 30, 40], 50), 25, "percentile 50");
near(m.percentile([10, 20, 30, 40], 100), 40, "percentile 100");
near(m.percentile([10, 20, 30, 40], 0), 10, "percentile 0");
near(m.percentile([40, 10, 30, 20], 25), 17.5, "percentile 25 (unsorted input)");
near(m.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9.1, "percentile 90");
near(m.percentile([7], 63), 7, "percentile of one value");
eq(m.percentile([], 50), NaN, "percentile of empty");
throws(() => m.percentile([1, 2], 101), "percentile out of range");
near(m.interquartileRange([1, 2, 3, 4, 5, 6, 7, 8, 9]), 4, "interquartileRange");

near(m.median([5, 1, 4, 2]), 3, "median");
near(m.mean([1, 2, 3, 4]), 2.5, "mean");
near(m.stddev([2, 4, 4, 4, 5, 5, 7, 9]), 2, "stddev");
eq(m.modes([1, 2, 2, 3, 3]), [2, 3], "modes");
eq(m.histogram([1, 2, 3, 4, 10], 3), [3, 1, 1], "histogram");
near(m.convertMilesToKilometers(1), 1.609344, "convertMilesToKilometers");
near(m.convertGibibytesToMegabytes(1), 1073.741824, "convertGibibytesToMegabytes");
near(m.convertHoursToMinutes(2.5), 150, "convertHoursToMinutes");
eq(m.formatDuration(3723), "1h 02m 03s", "formatDuration");
eq(m.formatPercent(0.1234), "12.3%", "formatPercent");

const before = readBefore(dir, "measure.mjs");
const after = read("measure.mjs");
const fn = functionText(after, "percentile");
if (!fn) fail("percentile function not found");
if (after.replace(fn, "") !== before.replace(functionText(before, "percentile"), "")) fail("code outside percentile changed");
console.log("ok");
