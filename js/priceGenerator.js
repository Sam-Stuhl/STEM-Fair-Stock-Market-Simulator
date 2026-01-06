"use strict";
// Price generation logic
// Handles random price fluctuations and market events
let momentum = 1; // Either -1 or 1. Determining the direction of stock movement
const MIN_PERCENT_CHANGE = 0.5;
const MAX_PERCENT_CHANGE = 1.5;
