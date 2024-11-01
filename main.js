/*
 * Copyright (c) Flowmap.gl contributors
 * SPDX-License-Identifier: MIT
 */

import {Deck} from "@deck.gl/core";
import {FlowmapLayer, PickingType} from '@flowmap.gl/layers';
import {getViewStateForLocations} from "@flowmap.gl/data";
import {csv} from "d3-fetch";
import atlas from "azure-maps-control";
import "azure-maps-control/dist/atlas.min.css";

const key = import.meta.env.VITE_AZURE_MAPS_KEY;

// BIXI rides
const DATA_PATH = `https://gist.githubusercontent.com/ilyabo/68d3dba61d86164b940ffe60e9d36931/raw/a72938b5d51b6df9fa7bba9aa1fb7df00cd0f06a`;

let deck, locations, flows;
let map;

function onload () {
  async function fetchData() {
    return await Promise.all([
      csv(`${DATA_PATH}/locations.csv`, (row, i) => ({
        id: row.id,
        name: row.name,
        lat: Number(row.lat),
        lon: Number(row.lon),
      })),
      csv(`${DATA_PATH}/flows.csv`, (row) => ({
        origin: row.origin,
        dest: row.dest,
        count: Number(row.count),
      })),
    ]).then(([locations, flows]) => ({locations, flows}));
  }

  fetchData().then((data) => {
    ({locations, flows} = data);
    const [width, height] = [globalThis.innerWidth, globalThis.innerHeight];
    const initialViewState = getViewStateForLocations(
      locations,
      (loc) => [loc.lon, loc.lat],
      [width, height],
      {pad: 0.3}
    );

    map = new atlas.Map("myMap", {
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: key,
      },
      style: 'grayscale_dark',
      // Note: deck.gl will be in charge of interaction and event handling
      interactive: false,
      center: [initialViewState.longitude, initialViewState.latitude],
      zoom: initialViewState.zoom,
      bearing: initialViewState.bearing,
      pitch: initialViewState.pitch,
    });

    map.events.add("ready", () => {
      map.controls.add(new atlas.control.StyleControl({
        mapStyles: ['road', 'grayscale_light', 'grayscale_dark', 'night', 'satellite'],
      }), {
        position: "top-right",
      });
    });

    deck = new Deck({
      canvas: "deck-canvas",
      width: "100%",
      height: "100%",
      initialViewState: initialViewState,
      controller: true,
      map: true,
      onViewStateChange: ({viewState}) => {
        map.setCamera({
          center: [viewState.longitude, viewState.latitude],
          zoom: viewState.zoom,
          bearing: viewState.bearing,
          pitch: viewState.pitch,
        });
      },
      layers: [],
    });

    addLayer();

    document.querySelectorAll(".control").forEach((control) => {
      control.onchange = addLayer;
    });
    document.getElementById("darkMode").onchange = onDarkModeChange;

    const flowmap = document.getElementById("deck-canvas");
    const mapContainer = document.getElementById("myMap");
    mapContainer.insertBefore(flowmap, mapContainer.querySelector(".atlas-control-container"));

  });
}
function addLayer() {
  deck.setProps({
    layers: [
      new FlowmapLayer({
        id: "my-flowmap-layer",
        data: {locations, flows},
        pickable: true,
        darkMode: getIsChecked("darkMode"),
        colorScheme: getSelectValue("colorScheme"),
        clusteringEnabled: getIsChecked("clusteringEnabled"),
        getLocationId: (loc) => loc.id,
        getLocationLat: (loc) => loc.lat,
        getLocationLon: (loc) => loc.lon,
        getFlowOriginId: (flow) => flow.origin,
        getFlowDestId: (flow) => flow.dest,
        getFlowMagnitude: (flow) => flow.count,
        getLocationName: (loc) => loc.name,
        onHover: (info) => updateTooltip(getTooltipState(info)),
      }),
    ],
  });
}

function onDarkModeChange() {
  map.setStyle({style: getIsChecked("darkMode") ? "grayscale_dark" : "grayscale_light"});
  document.getElementById("deck-canvas").style.mixBlendMode = getIsChecked("darkMode") ? "screen" : "darken";
  document.getElementById("container").style.backgroundColor = getIsChecked("darkMode") ? "#000" : "#fff";
  addLayer();
}

function updateTooltip(state) {
  const tooltip = document.getElementById("tooltip");
  if (!state) {
    tooltip.style.display = "none";
    return;
  }
    tooltip.style.left = `${state.position.left}px`;
    tooltip.style.top = `${state.position.top}px`  
    tooltip.innerHTML = state.content;
    tooltip.style.display = "block";
}

function getTooltipState(info) {
  if (!info) return undefined;

  const {x, y, object} = info;
  const position = {left: x, top: y};
  switch (object?.type) {
    case PickingType.LOCATION:
      const nameElm = document.createElement("b");
      nameElm.innerText = object.name.replaceAll("\"", "");
      const incomingElm = document.createElement("li");
      incomingElm.innerText = `Incoming trips: ${object.totals.incomingCount}`;
      const outgoingElm = document.createElement("li");
      outgoingElm.innerText = `Outgoing trips: ${object.totals.outgoingCount}`;
      const internalElm = document.createElement("li");
      internalElm.innerText = `Internal or round trips: ${object.totals.internalCount}`;
      return {
        position,
        content: [nameElm, incomingElm, outgoingElm, internalElm].map((elm) => elm.outerHTML).join(""),
      };
    case PickingType.FLOW:
      const titleElm = document.createElement("b");
      titleElm.innerText = "Route Info";
      const routeElm = document.createElement("li");
      routeElm.innerText = `Bike Station: ${object.origin.id.slice(2, -2)} → ${object.dest.id.slice(2, -2)}`;
      const countElm = document.createElement("li");
      countElm.innerText = `Trips Count: ${object.count}`;
      return {
        position,
        content: [titleElm, routeElm, countElm].map((elm) => elm.outerHTML).join(""),
      };
  }
  return undefined;
}

function getSelectValue(id) {
  var elm = document.getElementById(id);
  return elm.options[elm.selectedIndex].value;
}
function getIsChecked(id) {
  return document.getElementById(id).checked;
}

document.body.onload = onload;
