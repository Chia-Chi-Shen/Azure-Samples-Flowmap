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

    const map = new atlas.Map("myMap", {
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
        colorScheme: getSelectValue("colorScheme"),
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

function getSelectValue(id) {
  var elm = document.getElementById(id);
  return elm.options[elm.selectedIndex].value;
}

function updateTooltip(state) {
  const tooltip = document.getElementById("tooltip");
  if (!state) {
    tooltip.style.display = "none";
    return;
  }
    tooltip.style.left = state.position.left;
    tooltip.style.top = state.position.top;
    tooltip.innerHTML = state.content;
    tooltip.style.display = "block";
}

function getTooltipState(info) {
  if (!info) return undefined;

  const {x, y, object} = info;
  const position = {left: x, top: y};
  switch (object?.type) {
    case PickingType.LOCATION:
      const nameElm = document.createElement("div");
      nameElm.innerText = object.name;
      const incomingElm = document.createElement("div");
      incomingElm.innerText = `Incoming trips: ${object.totals.incomingCount}`;
      const outgoingElm = document.createElement("div");
      outgoingElm.innerText = `Outgoing trips: ${object.totals.outgoingCount}`;
      const internalElm = document.createElement("div");
      internalElm.innerText = `Internal or round trips: ${object.totals.internalCount}`;
      return {
        position,
        content: [nameElm, incomingElm, outgoingElm, internalElm].map((elm) => elm.outerHTML).join(""),
      };
    case PickingType.FLOW:
      const routeElm = document.createElement("div");
      routeElm.innerText = `${object.origin.id} → ${object.dest.id}`;
      const countElm = document.createElement("div");
      countElm.innerText = `Count: ${object.count}`;
      return {
        position,
        content: [routeElm, countElm].map((elm) => elm.outerHTML).join(""),
      };
  }
  return undefined;
}

document.body.onload = onload;
