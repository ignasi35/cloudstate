/*
 * Copyright 2019 Lightbend Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const debug = require("debug")("cloudstate-crdt");
const util = require("util");
const AnySupport = require("../protobuf-any");

/**
 * @classdesc A Grow-only Set CRDT.
 *
 * A grow only set can have elements added to it, but not removed.
 *
 * @constructor module:cloudstate.crdt.GSet
 * @implements module:cloudstate.crdt.CrdtState
 */
function GSet() {
  // Map of a comparable form (that compares correctly using ===) of the elements to the elements
  let currentValue = new Map();
  let delta = new Set();

  /**
   * Does this set contain the given element?
   *
   * @function module:cloudstate.crdt.GSet#has
   * @param {module:cloudstate.Serializable} element The element to check.
   * @returns {boolean} True if the set contains the element.
   */
  this.has = function (element) {
    return currentValue.has(AnySupport.toComparable(element));
  };

  /**
   * The size of this set.
   *
   * @name module:cloudstate.crdt.GSet#size
   * @type {number}
   * @readonly
   */
  Object.defineProperty(this, "size", {
    get: function () {
      return currentValue.size;
    }
  });

  /**
   * Callback for handling elements iterated through by {@link module:cloudstate.crdt.GSet#forEach}.
   *
   * @callback module:cloudstate.crdt.GSet~forEachCallback
   * @param {module:cloudstate.Serializable} element The element.
   */

  /**
   * Execute the given callback for each element.
   *
   * @function module:cloudstate.crdt.GSet#forEach
   * @param {module:cloudstate.crdt.GSet~forEachCallback} callback The callback to handle each element.
   */
  this.forEach = function (callback) {
    currentValue.forEach((value, key) => callback(value));
  };

  /**
   * Create an iterator for this set.
   *
   * @function module:cloudstate.crdt.GSet#@@iterator
   * @returns {iterator<module:cloudstate.Serializable>}
   */
  this[Symbol.iterator] = function () {
    return currentValue.values();
  };

  /**
   * Add an element to this set.
   *
   * @function module:cloudstate.crdt.GSet#add
   * @param {module:cloudstate.Serializable} element The element to add.
   * @return {module:cloudstate.crdt.GSet} This set.
   */
  this.add = function (element) {
    const comparable = AnySupport.toComparable(element);
    const serializedElement = AnySupport.serialize(element, true, true);

    if (!currentValue.has(comparable)) {
      currentValue.set(comparable, element);
      delta.add(serializedElement);
    }
    return this;
  };

  this.getAndResetDelta = function () {
    if (delta.size > 0) {
      const crdtDelta = {
        gset: {
          added: Array.from(delta)
        }
      };
      delta.clear();
      return crdtDelta;
    } else {
      return null;
    }
  };

  this.applyDelta = function (delta, anySupport) {
    if (!delta.gset) {
      throw new Error(util.format("Cannot apply delta %o to GSet", delta));
    }
    if (delta.gset.added !== undefined) {
      delta.gset.added.forEach(element => {
        const value = anySupport.deserialize(element);
        const comparable = AnySupport.toComparable(value);
        currentValue.set(comparable, value);
      });
    } else {
      debug("GSet delta with no items to add?");
    }
  };

  this.getStateAndResetDelta = function () {
    delta.clear();
    const items = [];
    currentValue.forEach((value, key) => {
      const serialized = AnySupport.serialize(value, true, true);
      items.push(serialized);
    });
    return {
      gset: {
        items: items
      }
    };
  };

  this.applyState = function (state, anySupport) {
    if (!state.gset) {
      throw new Error(util.format("Cannot apply state %o to GSet", state));
    }
    currentValue.clear();
    if (state.gset.items !== undefined) {
      state.gset.items.forEach(element => {
        const value = anySupport.deserialize(element);
        const comparable = AnySupport.toComparable(value);
        currentValue.set(comparable, value);
      });
    }
  };

  this.toString = function () {
    return "GSet(" + Array.from(currentValue.keys()).join(",") + ")";
  };
}

module.exports = GSet;