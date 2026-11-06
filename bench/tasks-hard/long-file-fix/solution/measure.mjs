// measure.mjs - unit conversion and statistics helpers.
//
// The conversion functions in the first part of this file are generated from
// the unit tables below; edit the tables in tools/units.json and regenerate
// instead of editing them by hand. The statistics and formatting helpers at
// the end are maintained by hand.

// ---- length (base unit: metres) ----

export const LENGTH_FACTORS = Object.freeze({
  m: 1,
  km: 1000,
  cm: 0.01,
  mm: 0.001,
  mi: 1609.344,
  yd: 0.9144,
  ft: 0.3048,
  in: 0.0254,
});

/**
 * Converts meters (m) to kilometers (km).
 * @param {number} value amount in m
 * @returns {number} amount in km
 */
export function convertMetersToKilometers(value) {
  return (value * 1) / 1000;
}

/**
 * Converts meters (m) to centimeters (cm).
 * @param {number} value amount in m
 * @returns {number} amount in cm
 */
export function convertMetersToCentimeters(value) {
  return (value * 1) / 0.01;
}

/**
 * Converts meters (m) to millimeters (mm).
 * @param {number} value amount in m
 * @returns {number} amount in mm
 */
export function convertMetersToMillimeters(value) {
  return (value * 1) / 0.001;
}

/**
 * Converts meters (m) to miles (mi).
 * @param {number} value amount in m
 * @returns {number} amount in mi
 */
export function convertMetersToMiles(value) {
  return (value * 1) / 1609.344;
}

/**
 * Converts meters (m) to yards (yd).
 * @param {number} value amount in m
 * @returns {number} amount in yd
 */
export function convertMetersToYards(value) {
  return (value * 1) / 0.9144;
}

/**
 * Converts meters (m) to feet (ft).
 * @param {number} value amount in m
 * @returns {number} amount in ft
 */
export function convertMetersToFeet(value) {
  return (value * 1) / 0.3048;
}

/**
 * Converts meters (m) to inches (in).
 * @param {number} value amount in m
 * @returns {number} amount in in
 */
export function convertMetersToInches(value) {
  return (value * 1) / 0.0254;
}

/**
 * Converts kilometers (km) to meters (m).
 * @param {number} value amount in km
 * @returns {number} amount in m
 */
export function convertKilometersToMeters(value) {
  return (value * 1000) / 1;
}

/**
 * Converts kilometers (km) to centimeters (cm).
 * @param {number} value amount in km
 * @returns {number} amount in cm
 */
export function convertKilometersToCentimeters(value) {
  return (value * 1000) / 0.01;
}

/**
 * Converts kilometers (km) to millimeters (mm).
 * @param {number} value amount in km
 * @returns {number} amount in mm
 */
export function convertKilometersToMillimeters(value) {
  return (value * 1000) / 0.001;
}

/**
 * Converts kilometers (km) to miles (mi).
 * @param {number} value amount in km
 * @returns {number} amount in mi
 */
export function convertKilometersToMiles(value) {
  return (value * 1000) / 1609.344;
}

/**
 * Converts kilometers (km) to yards (yd).
 * @param {number} value amount in km
 * @returns {number} amount in yd
 */
export function convertKilometersToYards(value) {
  return (value * 1000) / 0.9144;
}

/**
 * Converts kilometers (km) to feet (ft).
 * @param {number} value amount in km
 * @returns {number} amount in ft
 */
export function convertKilometersToFeet(value) {
  return (value * 1000) / 0.3048;
}

/**
 * Converts kilometers (km) to inches (in).
 * @param {number} value amount in km
 * @returns {number} amount in in
 */
export function convertKilometersToInches(value) {
  return (value * 1000) / 0.0254;
}

/**
 * Converts centimeters (cm) to meters (m).
 * @param {number} value amount in cm
 * @returns {number} amount in m
 */
export function convertCentimetersToMeters(value) {
  return (value * 0.01) / 1;
}

/**
 * Converts centimeters (cm) to kilometers (km).
 * @param {number} value amount in cm
 * @returns {number} amount in km
 */
export function convertCentimetersToKilometers(value) {
  return (value * 0.01) / 1000;
}

/**
 * Converts centimeters (cm) to millimeters (mm).
 * @param {number} value amount in cm
 * @returns {number} amount in mm
 */
export function convertCentimetersToMillimeters(value) {
  return (value * 0.01) / 0.001;
}

/**
 * Converts centimeters (cm) to miles (mi).
 * @param {number} value amount in cm
 * @returns {number} amount in mi
 */
export function convertCentimetersToMiles(value) {
  return (value * 0.01) / 1609.344;
}

/**
 * Converts centimeters (cm) to yards (yd).
 * @param {number} value amount in cm
 * @returns {number} amount in yd
 */
export function convertCentimetersToYards(value) {
  return (value * 0.01) / 0.9144;
}

/**
 * Converts centimeters (cm) to feet (ft).
 * @param {number} value amount in cm
 * @returns {number} amount in ft
 */
export function convertCentimetersToFeet(value) {
  return (value * 0.01) / 0.3048;
}

/**
 * Converts centimeters (cm) to inches (in).
 * @param {number} value amount in cm
 * @returns {number} amount in in
 */
export function convertCentimetersToInches(value) {
  return (value * 0.01) / 0.0254;
}

/**
 * Converts millimeters (mm) to meters (m).
 * @param {number} value amount in mm
 * @returns {number} amount in m
 */
export function convertMillimetersToMeters(value) {
  return (value * 0.001) / 1;
}

/**
 * Converts millimeters (mm) to kilometers (km).
 * @param {number} value amount in mm
 * @returns {number} amount in km
 */
export function convertMillimetersToKilometers(value) {
  return (value * 0.001) / 1000;
}

/**
 * Converts millimeters (mm) to centimeters (cm).
 * @param {number} value amount in mm
 * @returns {number} amount in cm
 */
export function convertMillimetersToCentimeters(value) {
  return (value * 0.001) / 0.01;
}

/**
 * Converts millimeters (mm) to miles (mi).
 * @param {number} value amount in mm
 * @returns {number} amount in mi
 */
export function convertMillimetersToMiles(value) {
  return (value * 0.001) / 1609.344;
}

/**
 * Converts millimeters (mm) to yards (yd).
 * @param {number} value amount in mm
 * @returns {number} amount in yd
 */
export function convertMillimetersToYards(value) {
  return (value * 0.001) / 0.9144;
}

/**
 * Converts millimeters (mm) to feet (ft).
 * @param {number} value amount in mm
 * @returns {number} amount in ft
 */
export function convertMillimetersToFeet(value) {
  return (value * 0.001) / 0.3048;
}

/**
 * Converts millimeters (mm) to inches (in).
 * @param {number} value amount in mm
 * @returns {number} amount in in
 */
export function convertMillimetersToInches(value) {
  return (value * 0.001) / 0.0254;
}

/**
 * Converts miles (mi) to meters (m).
 * @param {number} value amount in mi
 * @returns {number} amount in m
 */
export function convertMilesToMeters(value) {
  return (value * 1609.344) / 1;
}

/**
 * Converts miles (mi) to kilometers (km).
 * @param {number} value amount in mi
 * @returns {number} amount in km
 */
export function convertMilesToKilometers(value) {
  return (value * 1609.344) / 1000;
}

/**
 * Converts miles (mi) to centimeters (cm).
 * @param {number} value amount in mi
 * @returns {number} amount in cm
 */
export function convertMilesToCentimeters(value) {
  return (value * 1609.344) / 0.01;
}

/**
 * Converts miles (mi) to millimeters (mm).
 * @param {number} value amount in mi
 * @returns {number} amount in mm
 */
export function convertMilesToMillimeters(value) {
  return (value * 1609.344) / 0.001;
}

/**
 * Converts miles (mi) to yards (yd).
 * @param {number} value amount in mi
 * @returns {number} amount in yd
 */
export function convertMilesToYards(value) {
  return (value * 1609.344) / 0.9144;
}

/**
 * Converts miles (mi) to feet (ft).
 * @param {number} value amount in mi
 * @returns {number} amount in ft
 */
export function convertMilesToFeet(value) {
  return (value * 1609.344) / 0.3048;
}

/**
 * Converts miles (mi) to inches (in).
 * @param {number} value amount in mi
 * @returns {number} amount in in
 */
export function convertMilesToInches(value) {
  return (value * 1609.344) / 0.0254;
}

/**
 * Converts yards (yd) to meters (m).
 * @param {number} value amount in yd
 * @returns {number} amount in m
 */
export function convertYardsToMeters(value) {
  return (value * 0.9144) / 1;
}

/**
 * Converts yards (yd) to kilometers (km).
 * @param {number} value amount in yd
 * @returns {number} amount in km
 */
export function convertYardsToKilometers(value) {
  return (value * 0.9144) / 1000;
}

/**
 * Converts yards (yd) to centimeters (cm).
 * @param {number} value amount in yd
 * @returns {number} amount in cm
 */
export function convertYardsToCentimeters(value) {
  return (value * 0.9144) / 0.01;
}

/**
 * Converts yards (yd) to millimeters (mm).
 * @param {number} value amount in yd
 * @returns {number} amount in mm
 */
export function convertYardsToMillimeters(value) {
  return (value * 0.9144) / 0.001;
}

/**
 * Converts yards (yd) to miles (mi).
 * @param {number} value amount in yd
 * @returns {number} amount in mi
 */
export function convertYardsToMiles(value) {
  return (value * 0.9144) / 1609.344;
}

/**
 * Converts yards (yd) to feet (ft).
 * @param {number} value amount in yd
 * @returns {number} amount in ft
 */
export function convertYardsToFeet(value) {
  return (value * 0.9144) / 0.3048;
}

/**
 * Converts yards (yd) to inches (in).
 * @param {number} value amount in yd
 * @returns {number} amount in in
 */
export function convertYardsToInches(value) {
  return (value * 0.9144) / 0.0254;
}

/**
 * Converts feet (ft) to meters (m).
 * @param {number} value amount in ft
 * @returns {number} amount in m
 */
export function convertFeetToMeters(value) {
  return (value * 0.3048) / 1;
}

/**
 * Converts feet (ft) to kilometers (km).
 * @param {number} value amount in ft
 * @returns {number} amount in km
 */
export function convertFeetToKilometers(value) {
  return (value * 0.3048) / 1000;
}

/**
 * Converts feet (ft) to centimeters (cm).
 * @param {number} value amount in ft
 * @returns {number} amount in cm
 */
export function convertFeetToCentimeters(value) {
  return (value * 0.3048) / 0.01;
}

/**
 * Converts feet (ft) to millimeters (mm).
 * @param {number} value amount in ft
 * @returns {number} amount in mm
 */
export function convertFeetToMillimeters(value) {
  return (value * 0.3048) / 0.001;
}

/**
 * Converts feet (ft) to miles (mi).
 * @param {number} value amount in ft
 * @returns {number} amount in mi
 */
export function convertFeetToMiles(value) {
  return (value * 0.3048) / 1609.344;
}

/**
 * Converts feet (ft) to yards (yd).
 * @param {number} value amount in ft
 * @returns {number} amount in yd
 */
export function convertFeetToYards(value) {
  return (value * 0.3048) / 0.9144;
}

/**
 * Converts feet (ft) to inches (in).
 * @param {number} value amount in ft
 * @returns {number} amount in in
 */
export function convertFeetToInches(value) {
  return (value * 0.3048) / 0.0254;
}

/**
 * Converts inches (in) to meters (m).
 * @param {number} value amount in in
 * @returns {number} amount in m
 */
export function convertInchesToMeters(value) {
  return (value * 0.0254) / 1;
}

/**
 * Converts inches (in) to kilometers (km).
 * @param {number} value amount in in
 * @returns {number} amount in km
 */
export function convertInchesToKilometers(value) {
  return (value * 0.0254) / 1000;
}

/**
 * Converts inches (in) to centimeters (cm).
 * @param {number} value amount in in
 * @returns {number} amount in cm
 */
export function convertInchesToCentimeters(value) {
  return (value * 0.0254) / 0.01;
}

/**
 * Converts inches (in) to millimeters (mm).
 * @param {number} value amount in in
 * @returns {number} amount in mm
 */
export function convertInchesToMillimeters(value) {
  return (value * 0.0254) / 0.001;
}

/**
 * Converts inches (in) to miles (mi).
 * @param {number} value amount in in
 * @returns {number} amount in mi
 */
export function convertInchesToMiles(value) {
  return (value * 0.0254) / 1609.344;
}

/**
 * Converts inches (in) to yards (yd).
 * @param {number} value amount in in
 * @returns {number} amount in yd
 */
export function convertInchesToYards(value) {
  return (value * 0.0254) / 0.9144;
}

/**
 * Converts inches (in) to feet (ft).
 * @param {number} value amount in in
 * @returns {number} amount in ft
 */
export function convertInchesToFeet(value) {
  return (value * 0.0254) / 0.3048;
}

// ---- mass (base unit: kilograms) ----

export const MASS_FACTORS = Object.freeze({
  kg: 1,
  g: 0.001,
  mg: 1e-06,
  lb: 0.45359237,
  oz: 0.028349523125,
  st: 6.35029318,
});

/**
 * Converts kilograms (kg) to grams (g).
 * @param {number} value amount in kg
 * @returns {number} amount in g
 */
export function convertKilogramsToGrams(value) {
  return (value * 1) / 0.001;
}

/**
 * Converts kilograms (kg) to milligrams (mg).
 * @param {number} value amount in kg
 * @returns {number} amount in mg
 */
export function convertKilogramsToMilligrams(value) {
  return (value * 1) / 1e-06;
}

/**
 * Converts kilograms (kg) to pounds (lb).
 * @param {number} value amount in kg
 * @returns {number} amount in lb
 */
export function convertKilogramsToPounds(value) {
  return (value * 1) / 0.45359237;
}

/**
 * Converts kilograms (kg) to ounces (oz).
 * @param {number} value amount in kg
 * @returns {number} amount in oz
 */
export function convertKilogramsToOunces(value) {
  return (value * 1) / 0.028349523125;
}

/**
 * Converts kilograms (kg) to stones (st).
 * @param {number} value amount in kg
 * @returns {number} amount in st
 */
export function convertKilogramsToStones(value) {
  return (value * 1) / 6.35029318;
}

/**
 * Converts grams (g) to kilograms (kg).
 * @param {number} value amount in g
 * @returns {number} amount in kg
 */
export function convertGramsToKilograms(value) {
  return (value * 0.001) / 1;
}

/**
 * Converts grams (g) to milligrams (mg).
 * @param {number} value amount in g
 * @returns {number} amount in mg
 */
export function convertGramsToMilligrams(value) {
  return (value * 0.001) / 1e-06;
}

/**
 * Converts grams (g) to pounds (lb).
 * @param {number} value amount in g
 * @returns {number} amount in lb
 */
export function convertGramsToPounds(value) {
  return (value * 0.001) / 0.45359237;
}

/**
 * Converts grams (g) to ounces (oz).
 * @param {number} value amount in g
 * @returns {number} amount in oz
 */
export function convertGramsToOunces(value) {
  return (value * 0.001) / 0.028349523125;
}

/**
 * Converts grams (g) to stones (st).
 * @param {number} value amount in g
 * @returns {number} amount in st
 */
export function convertGramsToStones(value) {
  return (value * 0.001) / 6.35029318;
}

/**
 * Converts milligrams (mg) to kilograms (kg).
 * @param {number} value amount in mg
 * @returns {number} amount in kg
 */
export function convertMilligramsToKilograms(value) {
  return (value * 1e-06) / 1;
}

/**
 * Converts milligrams (mg) to grams (g).
 * @param {number} value amount in mg
 * @returns {number} amount in g
 */
export function convertMilligramsToGrams(value) {
  return (value * 1e-06) / 0.001;
}

/**
 * Converts milligrams (mg) to pounds (lb).
 * @param {number} value amount in mg
 * @returns {number} amount in lb
 */
export function convertMilligramsToPounds(value) {
  return (value * 1e-06) / 0.45359237;
}

/**
 * Converts milligrams (mg) to ounces (oz).
 * @param {number} value amount in mg
 * @returns {number} amount in oz
 */
export function convertMilligramsToOunces(value) {
  return (value * 1e-06) / 0.028349523125;
}

/**
 * Converts milligrams (mg) to stones (st).
 * @param {number} value amount in mg
 * @returns {number} amount in st
 */
export function convertMilligramsToStones(value) {
  return (value * 1e-06) / 6.35029318;
}

/**
 * Converts pounds (lb) to kilograms (kg).
 * @param {number} value amount in lb
 * @returns {number} amount in kg
 */
export function convertPoundsToKilograms(value) {
  return (value * 0.45359237) / 1;
}

/**
 * Converts pounds (lb) to grams (g).
 * @param {number} value amount in lb
 * @returns {number} amount in g
 */
export function convertPoundsToGrams(value) {
  return (value * 0.45359237) / 0.001;
}

/**
 * Converts pounds (lb) to milligrams (mg).
 * @param {number} value amount in lb
 * @returns {number} amount in mg
 */
export function convertPoundsToMilligrams(value) {
  return (value * 0.45359237) / 1e-06;
}

/**
 * Converts pounds (lb) to ounces (oz).
 * @param {number} value amount in lb
 * @returns {number} amount in oz
 */
export function convertPoundsToOunces(value) {
  return (value * 0.45359237) / 0.028349523125;
}

/**
 * Converts pounds (lb) to stones (st).
 * @param {number} value amount in lb
 * @returns {number} amount in st
 */
export function convertPoundsToStones(value) {
  return (value * 0.45359237) / 6.35029318;
}

/**
 * Converts ounces (oz) to kilograms (kg).
 * @param {number} value amount in oz
 * @returns {number} amount in kg
 */
export function convertOuncesToKilograms(value) {
  return (value * 0.028349523125) / 1;
}

/**
 * Converts ounces (oz) to grams (g).
 * @param {number} value amount in oz
 * @returns {number} amount in g
 */
export function convertOuncesToGrams(value) {
  return (value * 0.028349523125) / 0.001;
}

/**
 * Converts ounces (oz) to milligrams (mg).
 * @param {number} value amount in oz
 * @returns {number} amount in mg
 */
export function convertOuncesToMilligrams(value) {
  return (value * 0.028349523125) / 1e-06;
}

/**
 * Converts ounces (oz) to pounds (lb).
 * @param {number} value amount in oz
 * @returns {number} amount in lb
 */
export function convertOuncesToPounds(value) {
  return (value * 0.028349523125) / 0.45359237;
}

/**
 * Converts ounces (oz) to stones (st).
 * @param {number} value amount in oz
 * @returns {number} amount in st
 */
export function convertOuncesToStones(value) {
  return (value * 0.028349523125) / 6.35029318;
}

/**
 * Converts stones (st) to kilograms (kg).
 * @param {number} value amount in st
 * @returns {number} amount in kg
 */
export function convertStonesToKilograms(value) {
  return (value * 6.35029318) / 1;
}

/**
 * Converts stones (st) to grams (g).
 * @param {number} value amount in st
 * @returns {number} amount in g
 */
export function convertStonesToGrams(value) {
  return (value * 6.35029318) / 0.001;
}

/**
 * Converts stones (st) to milligrams (mg).
 * @param {number} value amount in st
 * @returns {number} amount in mg
 */
export function convertStonesToMilligrams(value) {
  return (value * 6.35029318) / 1e-06;
}

/**
 * Converts stones (st) to pounds (lb).
 * @param {number} value amount in st
 * @returns {number} amount in lb
 */
export function convertStonesToPounds(value) {
  return (value * 6.35029318) / 0.45359237;
}

/**
 * Converts stones (st) to ounces (oz).
 * @param {number} value amount in st
 * @returns {number} amount in oz
 */
export function convertStonesToOunces(value) {
  return (value * 6.35029318) / 0.028349523125;
}

// ---- volume (base unit: litres) ----

export const VOLUME_FACTORS = Object.freeze({
  l: 1,
  ml: 0.001,
  gal: 3.785411784,
  qt: 0.946352946,
  pt: 0.473176473,
  cup: 0.2365882365,
  floz: 0.0295735295625,
});

/**
 * Converts liters (l) to milliliters (ml).
 * @param {number} value amount in l
 * @returns {number} amount in ml
 */
export function convertLitersToMilliliters(value) {
  return (value * 1) / 0.001;
}

/**
 * Converts liters (l) to gallons (gal).
 * @param {number} value amount in l
 * @returns {number} amount in gal
 */
export function convertLitersToGallons(value) {
  return (value * 1) / 3.785411784;
}

/**
 * Converts liters (l) to quarts (qt).
 * @param {number} value amount in l
 * @returns {number} amount in qt
 */
export function convertLitersToQuarts(value) {
  return (value * 1) / 0.946352946;
}

/**
 * Converts liters (l) to pints (pt).
 * @param {number} value amount in l
 * @returns {number} amount in pt
 */
export function convertLitersToPints(value) {
  return (value * 1) / 0.473176473;
}

/**
 * Converts liters (l) to cups (cup).
 * @param {number} value amount in l
 * @returns {number} amount in cup
 */
export function convertLitersToCups(value) {
  return (value * 1) / 0.2365882365;
}

/**
 * Converts liters (l) to fluid ounces (floz).
 * @param {number} value amount in l
 * @returns {number} amount in floz
 */
export function convertLitersToFluidOunces(value) {
  return (value * 1) / 0.0295735295625;
}

/**
 * Converts milliliters (ml) to liters (l).
 * @param {number} value amount in ml
 * @returns {number} amount in l
 */
export function convertMillilitersToLiters(value) {
  return (value * 0.001) / 1;
}

/**
 * Converts milliliters (ml) to gallons (gal).
 * @param {number} value amount in ml
 * @returns {number} amount in gal
 */
export function convertMillilitersToGallons(value) {
  return (value * 0.001) / 3.785411784;
}

/**
 * Converts milliliters (ml) to quarts (qt).
 * @param {number} value amount in ml
 * @returns {number} amount in qt
 */
export function convertMillilitersToQuarts(value) {
  return (value * 0.001) / 0.946352946;
}

/**
 * Converts milliliters (ml) to pints (pt).
 * @param {number} value amount in ml
 * @returns {number} amount in pt
 */
export function convertMillilitersToPints(value) {
  return (value * 0.001) / 0.473176473;
}

/**
 * Converts milliliters (ml) to cups (cup).
 * @param {number} value amount in ml
 * @returns {number} amount in cup
 */
export function convertMillilitersToCups(value) {
  return (value * 0.001) / 0.2365882365;
}

/**
 * Converts milliliters (ml) to fluid ounces (floz).
 * @param {number} value amount in ml
 * @returns {number} amount in floz
 */
export function convertMillilitersToFluidOunces(value) {
  return (value * 0.001) / 0.0295735295625;
}

/**
 * Converts gallons (gal) to liters (l).
 * @param {number} value amount in gal
 * @returns {number} amount in l
 */
export function convertGallonsToLiters(value) {
  return (value * 3.785411784) / 1;
}

/**
 * Converts gallons (gal) to milliliters (ml).
 * @param {number} value amount in gal
 * @returns {number} amount in ml
 */
export function convertGallonsToMilliliters(value) {
  return (value * 3.785411784) / 0.001;
}

/**
 * Converts gallons (gal) to quarts (qt).
 * @param {number} value amount in gal
 * @returns {number} amount in qt
 */
export function convertGallonsToQuarts(value) {
  return (value * 3.785411784) / 0.946352946;
}

/**
 * Converts gallons (gal) to pints (pt).
 * @param {number} value amount in gal
 * @returns {number} amount in pt
 */
export function convertGallonsToPints(value) {
  return (value * 3.785411784) / 0.473176473;
}

/**
 * Converts gallons (gal) to cups (cup).
 * @param {number} value amount in gal
 * @returns {number} amount in cup
 */
export function convertGallonsToCups(value) {
  return (value * 3.785411784) / 0.2365882365;
}

/**
 * Converts gallons (gal) to fluid ounces (floz).
 * @param {number} value amount in gal
 * @returns {number} amount in floz
 */
export function convertGallonsToFluidOunces(value) {
  return (value * 3.785411784) / 0.0295735295625;
}

/**
 * Converts quarts (qt) to liters (l).
 * @param {number} value amount in qt
 * @returns {number} amount in l
 */
export function convertQuartsToLiters(value) {
  return (value * 0.946352946) / 1;
}

/**
 * Converts quarts (qt) to milliliters (ml).
 * @param {number} value amount in qt
 * @returns {number} amount in ml
 */
export function convertQuartsToMilliliters(value) {
  return (value * 0.946352946) / 0.001;
}

/**
 * Converts quarts (qt) to gallons (gal).
 * @param {number} value amount in qt
 * @returns {number} amount in gal
 */
export function convertQuartsToGallons(value) {
  return (value * 0.946352946) / 3.785411784;
}

/**
 * Converts quarts (qt) to pints (pt).
 * @param {number} value amount in qt
 * @returns {number} amount in pt
 */
export function convertQuartsToPints(value) {
  return (value * 0.946352946) / 0.473176473;
}

/**
 * Converts quarts (qt) to cups (cup).
 * @param {number} value amount in qt
 * @returns {number} amount in cup
 */
export function convertQuartsToCups(value) {
  return (value * 0.946352946) / 0.2365882365;
}

/**
 * Converts quarts (qt) to fluid ounces (floz).
 * @param {number} value amount in qt
 * @returns {number} amount in floz
 */
export function convertQuartsToFluidOunces(value) {
  return (value * 0.946352946) / 0.0295735295625;
}

/**
 * Converts pints (pt) to liters (l).
 * @param {number} value amount in pt
 * @returns {number} amount in l
 */
export function convertPintsToLiters(value) {
  return (value * 0.473176473) / 1;
}

/**
 * Converts pints (pt) to milliliters (ml).
 * @param {number} value amount in pt
 * @returns {number} amount in ml
 */
export function convertPintsToMilliliters(value) {
  return (value * 0.473176473) / 0.001;
}

/**
 * Converts pints (pt) to gallons (gal).
 * @param {number} value amount in pt
 * @returns {number} amount in gal
 */
export function convertPintsToGallons(value) {
  return (value * 0.473176473) / 3.785411784;
}

/**
 * Converts pints (pt) to quarts (qt).
 * @param {number} value amount in pt
 * @returns {number} amount in qt
 */
export function convertPintsToQuarts(value) {
  return (value * 0.473176473) / 0.946352946;
}

/**
 * Converts pints (pt) to cups (cup).
 * @param {number} value amount in pt
 * @returns {number} amount in cup
 */
export function convertPintsToCups(value) {
  return (value * 0.473176473) / 0.2365882365;
}

/**
 * Converts pints (pt) to fluid ounces (floz).
 * @param {number} value amount in pt
 * @returns {number} amount in floz
 */
export function convertPintsToFluidOunces(value) {
  return (value * 0.473176473) / 0.0295735295625;
}

/**
 * Converts cups (cup) to liters (l).
 * @param {number} value amount in cup
 * @returns {number} amount in l
 */
export function convertCupsToLiters(value) {
  return (value * 0.2365882365) / 1;
}

/**
 * Converts cups (cup) to milliliters (ml).
 * @param {number} value amount in cup
 * @returns {number} amount in ml
 */
export function convertCupsToMilliliters(value) {
  return (value * 0.2365882365) / 0.001;
}

/**
 * Converts cups (cup) to gallons (gal).
 * @param {number} value amount in cup
 * @returns {number} amount in gal
 */
export function convertCupsToGallons(value) {
  return (value * 0.2365882365) / 3.785411784;
}

/**
 * Converts cups (cup) to quarts (qt).
 * @param {number} value amount in cup
 * @returns {number} amount in qt
 */
export function convertCupsToQuarts(value) {
  return (value * 0.2365882365) / 0.946352946;
}

/**
 * Converts cups (cup) to pints (pt).
 * @param {number} value amount in cup
 * @returns {number} amount in pt
 */
export function convertCupsToPints(value) {
  return (value * 0.2365882365) / 0.473176473;
}

/**
 * Converts cups (cup) to fluid ounces (floz).
 * @param {number} value amount in cup
 * @returns {number} amount in floz
 */
export function convertCupsToFluidOunces(value) {
  return (value * 0.2365882365) / 0.0295735295625;
}

/**
 * Converts fluid ounces (floz) to liters (l).
 * @param {number} value amount in floz
 * @returns {number} amount in l
 */
export function convertFluidOuncesToLiters(value) {
  return (value * 0.0295735295625) / 1;
}

/**
 * Converts fluid ounces (floz) to milliliters (ml).
 * @param {number} value amount in floz
 * @returns {number} amount in ml
 */
export function convertFluidOuncesToMilliliters(value) {
  return (value * 0.0295735295625) / 0.001;
}

/**
 * Converts fluid ounces (floz) to gallons (gal).
 * @param {number} value amount in floz
 * @returns {number} amount in gal
 */
export function convertFluidOuncesToGallons(value) {
  return (value * 0.0295735295625) / 3.785411784;
}

/**
 * Converts fluid ounces (floz) to quarts (qt).
 * @param {number} value amount in floz
 * @returns {number} amount in qt
 */
export function convertFluidOuncesToQuarts(value) {
  return (value * 0.0295735295625) / 0.946352946;
}

/**
 * Converts fluid ounces (floz) to pints (pt).
 * @param {number} value amount in floz
 * @returns {number} amount in pt
 */
export function convertFluidOuncesToPints(value) {
  return (value * 0.0295735295625) / 0.473176473;
}

/**
 * Converts fluid ounces (floz) to cups (cup).
 * @param {number} value amount in floz
 * @returns {number} amount in cup
 */
export function convertFluidOuncesToCups(value) {
  return (value * 0.0295735295625) / 0.2365882365;
}

// ---- data (base unit: bytes) ----

export const DATA_FACTORS = Object.freeze({
  B: 1,
  kB: 1000.0,
  MB: 1000000.0,
  GB: 1000000000.0,
  TB: 1000000000000.0,
  KiB: 1024,
  MiB: 1048576,
  GiB: 1073741824,
});

/**
 * Converts bytes (B) to kilobytes (kB).
 * @param {number} value amount in B
 * @returns {number} amount in kB
 */
export function convertBytesToKilobytes(value) {
  return (value * 1) / 1000.0;
}

/**
 * Converts bytes (B) to megabytes (MB).
 * @param {number} value amount in B
 * @returns {number} amount in MB
 */
export function convertBytesToMegabytes(value) {
  return (value * 1) / 1000000.0;
}

/**
 * Converts bytes (B) to gigabytes (GB).
 * @param {number} value amount in B
 * @returns {number} amount in GB
 */
export function convertBytesToGigabytes(value) {
  return (value * 1) / 1000000000.0;
}

/**
 * Converts bytes (B) to terabytes (TB).
 * @param {number} value amount in B
 * @returns {number} amount in TB
 */
export function convertBytesToTerabytes(value) {
  return (value * 1) / 1000000000000.0;
}

/**
 * Converts bytes (B) to kibibytes (KiB).
 * @param {number} value amount in B
 * @returns {number} amount in KiB
 */
export function convertBytesToKibibytes(value) {
  return (value * 1) / 1024;
}

/**
 * Converts bytes (B) to mebibytes (MiB).
 * @param {number} value amount in B
 * @returns {number} amount in MiB
 */
export function convertBytesToMebibytes(value) {
  return (value * 1) / 1048576;
}

/**
 * Converts bytes (B) to gibibytes (GiB).
 * @param {number} value amount in B
 * @returns {number} amount in GiB
 */
export function convertBytesToGibibytes(value) {
  return (value * 1) / 1073741824;
}

/**
 * Converts kilobytes (kB) to bytes (B).
 * @param {number} value amount in kB
 * @returns {number} amount in B
 */
export function convertKilobytesToBytes(value) {
  return (value * 1000.0) / 1;
}

/**
 * Converts kilobytes (kB) to megabytes (MB).
 * @param {number} value amount in kB
 * @returns {number} amount in MB
 */
export function convertKilobytesToMegabytes(value) {
  return (value * 1000.0) / 1000000.0;
}

/**
 * Converts kilobytes (kB) to gigabytes (GB).
 * @param {number} value amount in kB
 * @returns {number} amount in GB
 */
export function convertKilobytesToGigabytes(value) {
  return (value * 1000.0) / 1000000000.0;
}

/**
 * Converts kilobytes (kB) to terabytes (TB).
 * @param {number} value amount in kB
 * @returns {number} amount in TB
 */
export function convertKilobytesToTerabytes(value) {
  return (value * 1000.0) / 1000000000000.0;
}

/**
 * Converts kilobytes (kB) to kibibytes (KiB).
 * @param {number} value amount in kB
 * @returns {number} amount in KiB
 */
export function convertKilobytesToKibibytes(value) {
  return (value * 1000.0) / 1024;
}

/**
 * Converts kilobytes (kB) to mebibytes (MiB).
 * @param {number} value amount in kB
 * @returns {number} amount in MiB
 */
export function convertKilobytesToMebibytes(value) {
  return (value * 1000.0) / 1048576;
}

/**
 * Converts kilobytes (kB) to gibibytes (GiB).
 * @param {number} value amount in kB
 * @returns {number} amount in GiB
 */
export function convertKilobytesToGibibytes(value) {
  return (value * 1000.0) / 1073741824;
}

/**
 * Converts megabytes (MB) to bytes (B).
 * @param {number} value amount in MB
 * @returns {number} amount in B
 */
export function convertMegabytesToBytes(value) {
  return (value * 1000000.0) / 1;
}

/**
 * Converts megabytes (MB) to kilobytes (kB).
 * @param {number} value amount in MB
 * @returns {number} amount in kB
 */
export function convertMegabytesToKilobytes(value) {
  return (value * 1000000.0) / 1000.0;
}

/**
 * Converts megabytes (MB) to gigabytes (GB).
 * @param {number} value amount in MB
 * @returns {number} amount in GB
 */
export function convertMegabytesToGigabytes(value) {
  return (value * 1000000.0) / 1000000000.0;
}

/**
 * Converts megabytes (MB) to terabytes (TB).
 * @param {number} value amount in MB
 * @returns {number} amount in TB
 */
export function convertMegabytesToTerabytes(value) {
  return (value * 1000000.0) / 1000000000000.0;
}

/**
 * Converts megabytes (MB) to kibibytes (KiB).
 * @param {number} value amount in MB
 * @returns {number} amount in KiB
 */
export function convertMegabytesToKibibytes(value) {
  return (value * 1000000.0) / 1024;
}

/**
 * Converts megabytes (MB) to mebibytes (MiB).
 * @param {number} value amount in MB
 * @returns {number} amount in MiB
 */
export function convertMegabytesToMebibytes(value) {
  return (value * 1000000.0) / 1048576;
}

/**
 * Converts megabytes (MB) to gibibytes (GiB).
 * @param {number} value amount in MB
 * @returns {number} amount in GiB
 */
export function convertMegabytesToGibibytes(value) {
  return (value * 1000000.0) / 1073741824;
}

/**
 * Converts gigabytes (GB) to bytes (B).
 * @param {number} value amount in GB
 * @returns {number} amount in B
 */
export function convertGigabytesToBytes(value) {
  return (value * 1000000000.0) / 1;
}

/**
 * Converts gigabytes (GB) to kilobytes (kB).
 * @param {number} value amount in GB
 * @returns {number} amount in kB
 */
export function convertGigabytesToKilobytes(value) {
  return (value * 1000000000.0) / 1000.0;
}

/**
 * Converts gigabytes (GB) to megabytes (MB).
 * @param {number} value amount in GB
 * @returns {number} amount in MB
 */
export function convertGigabytesToMegabytes(value) {
  return (value * 1000000000.0) / 1000000.0;
}

/**
 * Converts gigabytes (GB) to terabytes (TB).
 * @param {number} value amount in GB
 * @returns {number} amount in TB
 */
export function convertGigabytesToTerabytes(value) {
  return (value * 1000000000.0) / 1000000000000.0;
}

/**
 * Converts gigabytes (GB) to kibibytes (KiB).
 * @param {number} value amount in GB
 * @returns {number} amount in KiB
 */
export function convertGigabytesToKibibytes(value) {
  return (value * 1000000000.0) / 1024;
}

/**
 * Converts gigabytes (GB) to mebibytes (MiB).
 * @param {number} value amount in GB
 * @returns {number} amount in MiB
 */
export function convertGigabytesToMebibytes(value) {
  return (value * 1000000000.0) / 1048576;
}

/**
 * Converts gigabytes (GB) to gibibytes (GiB).
 * @param {number} value amount in GB
 * @returns {number} amount in GiB
 */
export function convertGigabytesToGibibytes(value) {
  return (value * 1000000000.0) / 1073741824;
}

/**
 * Converts terabytes (TB) to bytes (B).
 * @param {number} value amount in TB
 * @returns {number} amount in B
 */
export function convertTerabytesToBytes(value) {
  return (value * 1000000000000.0) / 1;
}

/**
 * Converts terabytes (TB) to kilobytes (kB).
 * @param {number} value amount in TB
 * @returns {number} amount in kB
 */
export function convertTerabytesToKilobytes(value) {
  return (value * 1000000000000.0) / 1000.0;
}

/**
 * Converts terabytes (TB) to megabytes (MB).
 * @param {number} value amount in TB
 * @returns {number} amount in MB
 */
export function convertTerabytesToMegabytes(value) {
  return (value * 1000000000000.0) / 1000000.0;
}

/**
 * Converts terabytes (TB) to gigabytes (GB).
 * @param {number} value amount in TB
 * @returns {number} amount in GB
 */
export function convertTerabytesToGigabytes(value) {
  return (value * 1000000000000.0) / 1000000000.0;
}

/**
 * Converts terabytes (TB) to kibibytes (KiB).
 * @param {number} value amount in TB
 * @returns {number} amount in KiB
 */
export function convertTerabytesToKibibytes(value) {
  return (value * 1000000000000.0) / 1024;
}

/**
 * Converts terabytes (TB) to mebibytes (MiB).
 * @param {number} value amount in TB
 * @returns {number} amount in MiB
 */
export function convertTerabytesToMebibytes(value) {
  return (value * 1000000000000.0) / 1048576;
}

/**
 * Converts terabytes (TB) to gibibytes (GiB).
 * @param {number} value amount in TB
 * @returns {number} amount in GiB
 */
export function convertTerabytesToGibibytes(value) {
  return (value * 1000000000000.0) / 1073741824;
}

/**
 * Converts kibibytes (KiB) to bytes (B).
 * @param {number} value amount in KiB
 * @returns {number} amount in B
 */
export function convertKibibytesToBytes(value) {
  return (value * 1024) / 1;
}

/**
 * Converts kibibytes (KiB) to kilobytes (kB).
 * @param {number} value amount in KiB
 * @returns {number} amount in kB
 */
export function convertKibibytesToKilobytes(value) {
  return (value * 1024) / 1000.0;
}

/**
 * Converts kibibytes (KiB) to megabytes (MB).
 * @param {number} value amount in KiB
 * @returns {number} amount in MB
 */
export function convertKibibytesToMegabytes(value) {
  return (value * 1024) / 1000000.0;
}

/**
 * Converts kibibytes (KiB) to gigabytes (GB).
 * @param {number} value amount in KiB
 * @returns {number} amount in GB
 */
export function convertKibibytesToGigabytes(value) {
  return (value * 1024) / 1000000000.0;
}

/**
 * Converts kibibytes (KiB) to terabytes (TB).
 * @param {number} value amount in KiB
 * @returns {number} amount in TB
 */
export function convertKibibytesToTerabytes(value) {
  return (value * 1024) / 1000000000000.0;
}

/**
 * Converts kibibytes (KiB) to mebibytes (MiB).
 * @param {number} value amount in KiB
 * @returns {number} amount in MiB
 */
export function convertKibibytesToMebibytes(value) {
  return (value * 1024) / 1048576;
}

/**
 * Converts kibibytes (KiB) to gibibytes (GiB).
 * @param {number} value amount in KiB
 * @returns {number} amount in GiB
 */
export function convertKibibytesToGibibytes(value) {
  return (value * 1024) / 1073741824;
}

/**
 * Converts mebibytes (MiB) to bytes (B).
 * @param {number} value amount in MiB
 * @returns {number} amount in B
 */
export function convertMebibytesToBytes(value) {
  return (value * 1048576) / 1;
}

/**
 * Converts mebibytes (MiB) to kilobytes (kB).
 * @param {number} value amount in MiB
 * @returns {number} amount in kB
 */
export function convertMebibytesToKilobytes(value) {
  return (value * 1048576) / 1000.0;
}

/**
 * Converts mebibytes (MiB) to megabytes (MB).
 * @param {number} value amount in MiB
 * @returns {number} amount in MB
 */
export function convertMebibytesToMegabytes(value) {
  return (value * 1048576) / 1000000.0;
}

/**
 * Converts mebibytes (MiB) to gigabytes (GB).
 * @param {number} value amount in MiB
 * @returns {number} amount in GB
 */
export function convertMebibytesToGigabytes(value) {
  return (value * 1048576) / 1000000000.0;
}

/**
 * Converts mebibytes (MiB) to terabytes (TB).
 * @param {number} value amount in MiB
 * @returns {number} amount in TB
 */
export function convertMebibytesToTerabytes(value) {
  return (value * 1048576) / 1000000000000.0;
}

/**
 * Converts mebibytes (MiB) to kibibytes (KiB).
 * @param {number} value amount in MiB
 * @returns {number} amount in KiB
 */
export function convertMebibytesToKibibytes(value) {
  return (value * 1048576) / 1024;
}

/**
 * Converts mebibytes (MiB) to gibibytes (GiB).
 * @param {number} value amount in MiB
 * @returns {number} amount in GiB
 */
export function convertMebibytesToGibibytes(value) {
  return (value * 1048576) / 1073741824;
}

/**
 * Converts gibibytes (GiB) to bytes (B).
 * @param {number} value amount in GiB
 * @returns {number} amount in B
 */
export function convertGibibytesToBytes(value) {
  return (value * 1073741824) / 1;
}

/**
 * Converts gibibytes (GiB) to kilobytes (kB).
 * @param {number} value amount in GiB
 * @returns {number} amount in kB
 */
export function convertGibibytesToKilobytes(value) {
  return (value * 1073741824) / 1000.0;
}

/**
 * Converts gibibytes (GiB) to megabytes (MB).
 * @param {number} value amount in GiB
 * @returns {number} amount in MB
 */
export function convertGibibytesToMegabytes(value) {
  return (value * 1073741824) / 1000000.0;
}

/**
 * Converts gibibytes (GiB) to gigabytes (GB).
 * @param {number} value amount in GiB
 * @returns {number} amount in GB
 */
export function convertGibibytesToGigabytes(value) {
  return (value * 1073741824) / 1000000000.0;
}

/**
 * Converts gibibytes (GiB) to terabytes (TB).
 * @param {number} value amount in GiB
 * @returns {number} amount in TB
 */
export function convertGibibytesToTerabytes(value) {
  return (value * 1073741824) / 1000000000000.0;
}

/**
 * Converts gibibytes (GiB) to kibibytes (KiB).
 * @param {number} value amount in GiB
 * @returns {number} amount in KiB
 */
export function convertGibibytesToKibibytes(value) {
  return (value * 1073741824) / 1024;
}

/**
 * Converts gibibytes (GiB) to mebibytes (MiB).
 * @param {number} value amount in GiB
 * @returns {number} amount in MiB
 */
export function convertGibibytesToMebibytes(value) {
  return (value * 1073741824) / 1048576;
}

// ---- statistics (hand-written) ----

function assertNumbers(values, name) {
  if (!Array.isArray(values)) throw new TypeError(`${name} expects an array`);
  for (const v of values) {
    if (typeof v !== "number" || Number.isNaN(v)) throw new TypeError(`${name} expects numbers`);
  }
}

function sortedCopy(values) {
  return [...values].sort((a, b) => a - b);
}

/**
 * Sum of the values, using Kahan summation to limit rounding error.
 * @param {number[]} values
 */
export function sum(values) {
  assertNumbers(values, "sum");
  let total = 0;
  let carry = 0;
  for (const v of values) {
    const y = v - carry;
    const t = total + y;
    carry = t - total - y;
    total = t;
  }
  return total;
}

/**
 * Arithmetic mean. Returns NaN for an empty array.
 * @param {number[]} values
 */
export function mean(values) {
  assertNumbers(values, "mean");
  if (values.length === 0) return NaN;
  return sum(values) / values.length;
}

/**
 * Median: the middle value, or the mean of the two middle values.
 * @param {number[]} values
 */
export function median(values) {
  assertNumbers(values, "median");
  if (values.length === 0) return NaN;
  const sorted = sortedCopy(values);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Most frequent values, in ascending order.
 * @param {number[]} values
 */
export function modes(values) {
  assertNumbers(values, "modes");
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  for (const c of counts.values()) best = Math.max(best, c);
  return [...counts].filter(([, c]) => c === best).map(([v]) => v).sort((a, b) => a - b);
}

/**
 * Variance. Pass `{ sample: true }` for the sample (n - 1) variance.
 * @param {number[]} values
 * @param {{ sample?: boolean }} [options]
 */
export function variance(values, { sample = false } = {}) {
  assertNumbers(values, "variance");
  const n = values.length;
  if (n === 0 || (sample && n === 1)) return NaN;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return acc / (sample ? n - 1 : n);
}

/**
 * Standard deviation, see variance().
 * @param {number[]} values
 * @param {{ sample?: boolean }} [options]
 */
export function stddev(values, options) {
  return Math.sqrt(variance(values, options));
}

/**
 * Geometric mean of positive values.
 * @param {number[]} values
 */
export function geometricMean(values) {
  assertNumbers(values, "geometricMean");
  if (values.length === 0) return NaN;
  let logSum = 0;
  for (const v of values) {
    if (v <= 0) throw new RangeError("geometricMean expects positive numbers");
    logSum += Math.log(v);
  }
  return Math.exp(logSum / values.length);
}

/**
 * Harmonic mean of positive values.
 * @param {number[]} values
 */
export function harmonicMean(values) {
  assertNumbers(values, "harmonicMean");
  if (values.length === 0) return NaN;
  let acc = 0;
  for (const v of values) {
    if (v <= 0) throw new RangeError("harmonicMean expects positive numbers");
    acc += 1 / v;
  }
  return values.length / acc;
}

/**
 * Weighted mean; `weights` must have the same length as `values`.
 * @param {number[]} values
 * @param {number[]} weights
 */
export function weightedMean(values, weights) {
  assertNumbers(values, "weightedMean");
  assertNumbers(weights, "weightedMean");
  if (values.length !== weights.length) throw new RangeError("values and weights must have the same length");
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    num += values[i] * weights[i];
    den += weights[i];
  }
  return den === 0 ? NaN : num / den;
}

/**
 * Mean absolute deviation around the mean.
 * @param {number[]} values
 */
export function meanAbsoluteDeviation(values) {
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += Math.abs(v - m);
  return acc / values.length;
}

/**
 * Standard scores of each value (population standard deviation).
 * @param {number[]} values
 */
export function zScores(values) {
  const m = mean(values);
  const sd = stddev(values);
  return values.map((v) => (sd === 0 ? 0 : (v - m) / sd));
}

/**
 * Percentile with linear interpolation between closest ranks (the method
 * used by Excel's PERCENTILE.INC and NumPy's default). `p` is in [0, 100].
 * @param {number[]} values
 * @param {number} p
 */
export function percentile(values, p) {
  assertNumbers(values, "percentile");
  if (p < 0 || p > 100) throw new RangeError("p must be between 0 and 100");
  if (values.length === 0) return NaN;
  const sorted = sortedCopy(values);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

/**
 * Interquartile range from the 25th to the 75th percentile.
 * @param {number[]} values
 */
export function interquartileRange(values) {
  return percentile(values, 75) - percentile(values, 25);
}

/**
 * Minimum and maximum in one pass.
 * @param {number[]} values
 * @returns {{ min: number, max: number }}
 */
export function extent(values) {
  assertNumbers(values, "extent");
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/**
 * Buckets values into `bins` equal-width bins between the minimum and maximum.
 * @param {number[]} values
 * @param {number} bins
 */
export function histogram(values, bins) {
  assertNumbers(values, "histogram");
  if (!Number.isInteger(bins) || bins < 1) throw new RangeError("bins must be a positive integer");
  const counts = new Array(bins).fill(0);
  if (values.length === 0) return counts;
  const { min, max } = extent(values);
  const width = (max - min) / bins || 1;
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - min) / width))]++;
  return counts;
}

/**
 * Clamps a number into [min, max].
 */
export function clamp(value, min, max) {
  if (min > max) throw new RangeError("min must not exceed max");
  return Math.min(max, Math.max(min, value));
}

/**
 * Linear interpolation between a and b.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Rounds to a number of decimal places, rounding halves away from zero.
 */
export function roundTo(value, places = 0) {
  const factor = 10 ** places;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}

/**
 * Pearson correlation coefficient of two equal-length series.
 */
export function correlation(xs, ys) {
  assertNumbers(xs, "correlation");
  assertNumbers(ys, "correlation");
  if (xs.length !== ys.length) throw new RangeError("series must have the same length");
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

/**
 * Moving average over a window; the result has length values.length - window + 1.
 */
export function movingAverage(values, window) {
  assertNumbers(values, "movingAverage");
  if (!Number.isInteger(window) || window < 1) throw new RangeError("window must be a positive integer");
  const result = [];
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc += values[i];
    if (i >= window) acc -= values[i - window];
    if (i >= window - 1) result.push(acc / window);
  }
  return result;
}

// ---- area (base unit: square metres) ----

export const AREA_FACTORS = Object.freeze({
  m2: 1,
  km2: 1000000.0,
  ha: 10000.0,
  ac: 4046.8564224,
  ft2: 0.09290304,
  mi2: 2589988.110336,
});

/**
 * Converts squareMeters (m2) to squareKilometers (km2).
 * @param {number} value amount in m2
 * @returns {number} amount in km2
 */
export function convertSquareMetersToSquareKilometers(value) {
  return (value * 1) / 1000000.0;
}

/**
 * Converts squareMeters (m2) to hectares (ha).
 * @param {number} value amount in m2
 * @returns {number} amount in ha
 */
export function convertSquareMetersToHectares(value) {
  return (value * 1) / 10000.0;
}

/**
 * Converts squareMeters (m2) to acres (ac).
 * @param {number} value amount in m2
 * @returns {number} amount in ac
 */
export function convertSquareMetersToAcres(value) {
  return (value * 1) / 4046.8564224;
}

/**
 * Converts squareMeters (m2) to squareFeet (ft2).
 * @param {number} value amount in m2
 * @returns {number} amount in ft2
 */
export function convertSquareMetersToSquareFeet(value) {
  return (value * 1) / 0.09290304;
}

/**
 * Converts squareMeters (m2) to squareMiles (mi2).
 * @param {number} value amount in m2
 * @returns {number} amount in mi2
 */
export function convertSquareMetersToSquareMiles(value) {
  return (value * 1) / 2589988.110336;
}

/**
 * Converts squareKilometers (km2) to squareMeters (m2).
 * @param {number} value amount in km2
 * @returns {number} amount in m2
 */
export function convertSquareKilometersToSquareMeters(value) {
  return (value * 1000000.0) / 1;
}

/**
 * Converts squareKilometers (km2) to hectares (ha).
 * @param {number} value amount in km2
 * @returns {number} amount in ha
 */
export function convertSquareKilometersToHectares(value) {
  return (value * 1000000.0) / 10000.0;
}

/**
 * Converts squareKilometers (km2) to acres (ac).
 * @param {number} value amount in km2
 * @returns {number} amount in ac
 */
export function convertSquareKilometersToAcres(value) {
  return (value * 1000000.0) / 4046.8564224;
}

/**
 * Converts squareKilometers (km2) to squareFeet (ft2).
 * @param {number} value amount in km2
 * @returns {number} amount in ft2
 */
export function convertSquareKilometersToSquareFeet(value) {
  return (value * 1000000.0) / 0.09290304;
}

/**
 * Converts squareKilometers (km2) to squareMiles (mi2).
 * @param {number} value amount in km2
 * @returns {number} amount in mi2
 */
export function convertSquareKilometersToSquareMiles(value) {
  return (value * 1000000.0) / 2589988.110336;
}

/**
 * Converts hectares (ha) to squareMeters (m2).
 * @param {number} value amount in ha
 * @returns {number} amount in m2
 */
export function convertHectaresToSquareMeters(value) {
  return (value * 10000.0) / 1;
}

/**
 * Converts hectares (ha) to squareKilometers (km2).
 * @param {number} value amount in ha
 * @returns {number} amount in km2
 */
export function convertHectaresToSquareKilometers(value) {
  return (value * 10000.0) / 1000000.0;
}

/**
 * Converts hectares (ha) to acres (ac).
 * @param {number} value amount in ha
 * @returns {number} amount in ac
 */
export function convertHectaresToAcres(value) {
  return (value * 10000.0) / 4046.8564224;
}

/**
 * Converts hectares (ha) to squareFeet (ft2).
 * @param {number} value amount in ha
 * @returns {number} amount in ft2
 */
export function convertHectaresToSquareFeet(value) {
  return (value * 10000.0) / 0.09290304;
}

/**
 * Converts hectares (ha) to squareMiles (mi2).
 * @param {number} value amount in ha
 * @returns {number} amount in mi2
 */
export function convertHectaresToSquareMiles(value) {
  return (value * 10000.0) / 2589988.110336;
}

/**
 * Converts acres (ac) to squareMeters (m2).
 * @param {number} value amount in ac
 * @returns {number} amount in m2
 */
export function convertAcresToSquareMeters(value) {
  return (value * 4046.8564224) / 1;
}

/**
 * Converts acres (ac) to squareKilometers (km2).
 * @param {number} value amount in ac
 * @returns {number} amount in km2
 */
export function convertAcresToSquareKilometers(value) {
  return (value * 4046.8564224) / 1000000.0;
}

/**
 * Converts acres (ac) to hectares (ha).
 * @param {number} value amount in ac
 * @returns {number} amount in ha
 */
export function convertAcresToHectares(value) {
  return (value * 4046.8564224) / 10000.0;
}

/**
 * Converts acres (ac) to squareFeet (ft2).
 * @param {number} value amount in ac
 * @returns {number} amount in ft2
 */
export function convertAcresToSquareFeet(value) {
  return (value * 4046.8564224) / 0.09290304;
}

/**
 * Converts acres (ac) to squareMiles (mi2).
 * @param {number} value amount in ac
 * @returns {number} amount in mi2
 */
export function convertAcresToSquareMiles(value) {
  return (value * 4046.8564224) / 2589988.110336;
}

/**
 * Converts squareFeet (ft2) to squareMeters (m2).
 * @param {number} value amount in ft2
 * @returns {number} amount in m2
 */
export function convertSquareFeetToSquareMeters(value) {
  return (value * 0.09290304) / 1;
}

/**
 * Converts squareFeet (ft2) to squareKilometers (km2).
 * @param {number} value amount in ft2
 * @returns {number} amount in km2
 */
export function convertSquareFeetToSquareKilometers(value) {
  return (value * 0.09290304) / 1000000.0;
}

/**
 * Converts squareFeet (ft2) to hectares (ha).
 * @param {number} value amount in ft2
 * @returns {number} amount in ha
 */
export function convertSquareFeetToHectares(value) {
  return (value * 0.09290304) / 10000.0;
}

/**
 * Converts squareFeet (ft2) to acres (ac).
 * @param {number} value amount in ft2
 * @returns {number} amount in ac
 */
export function convertSquareFeetToAcres(value) {
  return (value * 0.09290304) / 4046.8564224;
}

/**
 * Converts squareFeet (ft2) to squareMiles (mi2).
 * @param {number} value amount in ft2
 * @returns {number} amount in mi2
 */
export function convertSquareFeetToSquareMiles(value) {
  return (value * 0.09290304) / 2589988.110336;
}

/**
 * Converts squareMiles (mi2) to squareMeters (m2).
 * @param {number} value amount in mi2
 * @returns {number} amount in m2
 */
export function convertSquareMilesToSquareMeters(value) {
  return (value * 2589988.110336) / 1;
}

/**
 * Converts squareMiles (mi2) to squareKilometers (km2).
 * @param {number} value amount in mi2
 * @returns {number} amount in km2
 */
export function convertSquareMilesToSquareKilometers(value) {
  return (value * 2589988.110336) / 1000000.0;
}

/**
 * Converts squareMiles (mi2) to hectares (ha).
 * @param {number} value amount in mi2
 * @returns {number} amount in ha
 */
export function convertSquareMilesToHectares(value) {
  return (value * 2589988.110336) / 10000.0;
}

/**
 * Converts squareMiles (mi2) to acres (ac).
 * @param {number} value amount in mi2
 * @returns {number} amount in ac
 */
export function convertSquareMilesToAcres(value) {
  return (value * 2589988.110336) / 4046.8564224;
}

/**
 * Converts squareMiles (mi2) to squareFeet (ft2).
 * @param {number} value amount in mi2
 * @returns {number} amount in ft2
 */
export function convertSquareMilesToSquareFeet(value) {
  return (value * 2589988.110336) / 0.09290304;
}

// ---- time (base unit: seconds) ----

export const TIME_FACTORS = Object.freeze({
  s: 1,
  ms: 0.001,
  min: 60,
  h: 3600,
  d: 86400,
  wk: 604800,
});

/**
 * Converts seconds (s) to milliseconds (ms).
 * @param {number} value amount in s
 * @returns {number} amount in ms
 */
export function convertSecondsToMilliseconds(value) {
  return (value * 1) / 0.001;
}

/**
 * Converts seconds (s) to minutes (min).
 * @param {number} value amount in s
 * @returns {number} amount in min
 */
export function convertSecondsToMinutes(value) {
  return (value * 1) / 60;
}

/**
 * Converts seconds (s) to hours (h).
 * @param {number} value amount in s
 * @returns {number} amount in h
 */
export function convertSecondsToHours(value) {
  return (value * 1) / 3600;
}

/**
 * Converts seconds (s) to days (d).
 * @param {number} value amount in s
 * @returns {number} amount in d
 */
export function convertSecondsToDays(value) {
  return (value * 1) / 86400;
}

/**
 * Converts seconds (s) to weeks (wk).
 * @param {number} value amount in s
 * @returns {number} amount in wk
 */
export function convertSecondsToWeeks(value) {
  return (value * 1) / 604800;
}

/**
 * Converts milliseconds (ms) to seconds (s).
 * @param {number} value amount in ms
 * @returns {number} amount in s
 */
export function convertMillisecondsToSeconds(value) {
  return (value * 0.001) / 1;
}

/**
 * Converts milliseconds (ms) to minutes (min).
 * @param {number} value amount in ms
 * @returns {number} amount in min
 */
export function convertMillisecondsToMinutes(value) {
  return (value * 0.001) / 60;
}

/**
 * Converts milliseconds (ms) to hours (h).
 * @param {number} value amount in ms
 * @returns {number} amount in h
 */
export function convertMillisecondsToHours(value) {
  return (value * 0.001) / 3600;
}

/**
 * Converts milliseconds (ms) to days (d).
 * @param {number} value amount in ms
 * @returns {number} amount in d
 */
export function convertMillisecondsToDays(value) {
  return (value * 0.001) / 86400;
}

/**
 * Converts milliseconds (ms) to weeks (wk).
 * @param {number} value amount in ms
 * @returns {number} amount in wk
 */
export function convertMillisecondsToWeeks(value) {
  return (value * 0.001) / 604800;
}

/**
 * Converts minutes (min) to seconds (s).
 * @param {number} value amount in min
 * @returns {number} amount in s
 */
export function convertMinutesToSeconds(value) {
  return (value * 60) / 1;
}

/**
 * Converts minutes (min) to milliseconds (ms).
 * @param {number} value amount in min
 * @returns {number} amount in ms
 */
export function convertMinutesToMilliseconds(value) {
  return (value * 60) / 0.001;
}

/**
 * Converts minutes (min) to hours (h).
 * @param {number} value amount in min
 * @returns {number} amount in h
 */
export function convertMinutesToHours(value) {
  return (value * 60) / 3600;
}

/**
 * Converts minutes (min) to days (d).
 * @param {number} value amount in min
 * @returns {number} amount in d
 */
export function convertMinutesToDays(value) {
  return (value * 60) / 86400;
}

/**
 * Converts minutes (min) to weeks (wk).
 * @param {number} value amount in min
 * @returns {number} amount in wk
 */
export function convertMinutesToWeeks(value) {
  return (value * 60) / 604800;
}

/**
 * Converts hours (h) to seconds (s).
 * @param {number} value amount in h
 * @returns {number} amount in s
 */
export function convertHoursToSeconds(value) {
  return (value * 3600) / 1;
}

/**
 * Converts hours (h) to milliseconds (ms).
 * @param {number} value amount in h
 * @returns {number} amount in ms
 */
export function convertHoursToMilliseconds(value) {
  return (value * 3600) / 0.001;
}

/**
 * Converts hours (h) to minutes (min).
 * @param {number} value amount in h
 * @returns {number} amount in min
 */
export function convertHoursToMinutes(value) {
  return (value * 3600) / 60;
}

/**
 * Converts hours (h) to days (d).
 * @param {number} value amount in h
 * @returns {number} amount in d
 */
export function convertHoursToDays(value) {
  return (value * 3600) / 86400;
}

/**
 * Converts hours (h) to weeks (wk).
 * @param {number} value amount in h
 * @returns {number} amount in wk
 */
export function convertHoursToWeeks(value) {
  return (value * 3600) / 604800;
}

/**
 * Converts days (d) to seconds (s).
 * @param {number} value amount in d
 * @returns {number} amount in s
 */
export function convertDaysToSeconds(value) {
  return (value * 86400) / 1;
}

/**
 * Converts days (d) to milliseconds (ms).
 * @param {number} value amount in d
 * @returns {number} amount in ms
 */
export function convertDaysToMilliseconds(value) {
  return (value * 86400) / 0.001;
}

/**
 * Converts days (d) to minutes (min).
 * @param {number} value amount in d
 * @returns {number} amount in min
 */
export function convertDaysToMinutes(value) {
  return (value * 86400) / 60;
}

/**
 * Converts days (d) to hours (h).
 * @param {number} value amount in d
 * @returns {number} amount in h
 */
export function convertDaysToHours(value) {
  return (value * 86400) / 3600;
}

/**
 * Converts days (d) to weeks (wk).
 * @param {number} value amount in d
 * @returns {number} amount in wk
 */
export function convertDaysToWeeks(value) {
  return (value * 86400) / 604800;
}

/**
 * Converts weeks (wk) to seconds (s).
 * @param {number} value amount in wk
 * @returns {number} amount in s
 */
export function convertWeeksToSeconds(value) {
  return (value * 604800) / 1;
}

/**
 * Converts weeks (wk) to milliseconds (ms).
 * @param {number} value amount in wk
 * @returns {number} amount in ms
 */
export function convertWeeksToMilliseconds(value) {
  return (value * 604800) / 0.001;
}

/**
 * Converts weeks (wk) to minutes (min).
 * @param {number} value amount in wk
 * @returns {number} amount in min
 */
export function convertWeeksToMinutes(value) {
  return (value * 604800) / 60;
}

/**
 * Converts weeks (wk) to hours (h).
 * @param {number} value amount in wk
 * @returns {number} amount in h
 */
export function convertWeeksToHours(value) {
  return (value * 604800) / 3600;
}

/**
 * Converts weeks (wk) to days (d).
 * @param {number} value amount in wk
 * @returns {number} amount in d
 */
export function convertWeeksToDays(value) {
  return (value * 604800) / 86400;
}

// ---- formatting (hand-written) ----

const SI_PREFIXES = ["", "k", "M", "G", "T", "P"];

/**
 * Formats a number with an SI prefix, e.g. 1530 -> "1.53 k".
 */
export function formatSI(value, unit = "", digits = 3) {
  let i = 0;
  let v = Math.abs(value);
  while (v >= 1000 && i < SI_PREFIXES.length - 1) {
    v /= 1000;
    i++;
  }
  const text = Number((Math.sign(value) * v).toPrecision(digits)).toString();
  return `${text} ${SI_PREFIXES[i]}${unit}`.trim();
}

/**
 * Formats a duration in seconds as "1h 02m 03s".
 */
export function formatDuration(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/**
 * Formats a ratio as a percentage string.
 */
export function formatPercent(ratio, places = 1) {
  return `${roundTo(ratio * 100, places).toFixed(places)}%`;
}
