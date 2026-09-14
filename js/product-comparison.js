// --- nRF54L PRODUCT COMPARISON ---
//
// A sheet peeking above the bottom edge of the window opens a side-by-side
// table of every nRF54L part and package, with a button per row that loads that
// combination into the planner.
//
// Part-level facts come from product-comparison-data.js. Package-level facts
// (GPIO count, serial instances, ADC channels, package size, NFC/USB/audio/QSPI
// availability) are derived from the same package JSON the pin diagram renders,
// so the table can never disagree with the pin data.

import state from "./state.js";
import { handleMcuChange, resolvePackageDataFor } from "./mcu-loader.js";
import { getMcuManifestEntry } from "./mcu-manifest.js";
import { showToast } from "./ui/notifications.js";
import { NRF54L_PARTS } from "./product-comparison-data.js";

const SERIAL_ID_PATTERN = /^(?:SPIM|SPIS|TWIM|TWIS|UARTE)/;

let rowsPromise = null;
let rows = null;

// --- PACKAGE METRICS ---

function countAnalogInputs(peripherals) {
  const saadc = peripherals.find(
    (peripheral) => peripheral.type === "SAADC" || peripheral.id === "SAADC",
  );
  if (!saadc || !Array.isArray(saadc.signals)) return 0;

  return saadc.signals.filter((signal) => /^AIN\d+$/.test(signal.name)).length;
}

// On the nRF54L Series one serial instance can be SPI, TWI or UART but only one
// at a time, so the instance count is what limits concurrent buses.
function countSerialInstances(peripherals) {
  const instances = new Set();
  peripherals.forEach((peripheral) => {
    if (!SERIAL_ID_PATTERN.test(peripheral.id)) return;
    const instance = peripheral.id.match(/(\d+)$/);
    if (instance) instances.add(instance[1]);
  });
  return instances.size;
}

function hasPeripheralType(peripherals, types) {
  return peripherals.some(
    (peripheral) =>
      types.includes(peripheral.type) ||
      types.some((type) => peripheral.id.toUpperCase().includes(type)),
  );
}

function derivePackageMetrics(packageData) {
  const pins = Array.isArray(packageData.pins) ? packageData.pins : [];
  const peripherals = Array.isArray(packageData.socPeripherals)
    ? packageData.socPeripherals
    : [];
  const chipBody = packageData.renderConfig?.chipBody || {};
  const widthMm = Number(chipBody.width) || 0;
  const heightMm = Number(chipBody.height) || 0;

  return {
    gpioCount: pins.filter((pin) =>
      Array.isArray(pin.functions)
        ? pin.functions.includes("Digital I/O")
        : false,
    ).length,
    serialInterfaces: countSerialInstances(peripherals),
    adcChannels: countAnalogInputs(peripherals),
    hasNfc: hasPeripheralType(peripherals, ["NFCT"]),
    hasUsbHighSpeed: hasPeripheralType(peripherals, ["USB"]),
    hasDigitalAudio: hasPeripheralType(peripherals, ["I2S", "PDM", "TDM"]),
    hasQspi: hasPeripheralType(peripherals, ["QSPI"]),
    packageType: packageData.partInfo?.packageType || "",
    widthMm,
    heightMm,
  };
}

async function buildRows() {
  const manifest = state.mcuManifest;
  const metricsByKey = new Map();

  // Kick every fetch off first: the LM20A/LM20B pair shares a manifest entry, so
  // several parts resolve to the same package files.
  NRF54L_PARTS.forEach((part) => {
    const entry = getMcuManifestEntry(manifest, part.mcuId);
    (entry?.packages || [])
      .filter((pkg) => !pkg.isLocal)
      .forEach((pkg) => {
        const key = `${part.mcuId}/${pkg.file}`;
        if (metricsByKey.has(key)) return;
        metricsByKey.set(
          key,
          resolvePackageDataFor(part.mcuId, pkg.file)
            .then(derivePackageMetrics)
            .catch((error) => {
              console.error(`Comparison could not read ${key}:`, error);
              return null;
            }),
        );
      });
  });

  await Promise.all(metricsByKey.values());

  const built = [];
  for (const part of NRF54L_PARTS) {
    const entry = getMcuManifestEntry(manifest, part.mcuId);
    const packages = [];
    for (const pkg of (entry?.packages || []).filter((pkg) => !pkg.isLocal)) {
      const metrics = await metricsByKey.get(`${part.mcuId}/${pkg.file}`);
      if (metrics) packages.push({ pkg, metrics });
    }
    // Smallest pin count first, which is also cheapest first.
    packages.sort((a, b) => a.metrics.gpioCount - b.metrics.gpioCount);
    if (packages.length) built.push({ part, packages });
  }
  return built;
}

function getRows() {
  if (!rowsPromise) {
    rowsPromise = buildRows().then((built) => {
      rows = built;
      return built;
    });
  }
  return rowsPromise;
}

// --- RENDERING ---

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function yesNo(value) {
  return value
    ? `<span class="comparison-yes" aria-label="yes">&#10003;</span>`
    : `<span class="comparison-no" aria-label="no">&ndash;</span>`;
}

function packageSize(metrics) {
  if (!metrics.widthMm) return "";
  return `${metrics.widthMm.toFixed(2)} &times; ${metrics.heightMm.toFixed(2)} mm`;
}

function isLoaded(part, pkg) {
  return (
    document.getElementById("mcuSelector")?.value === part.mcuId &&
    document.getElementById("packageSelector")?.value === pkg.file
  );
}

function partRowsMarkup({ part, packages }) {
  return packages
    .map(({ pkg, metrics }, index) => {
      // Part-level facts span the part's packages; the rest vary per package.
      const partCells =
        index === 0
          ? `
        <th scope="rowgroup" rowspan="${packages.length}" class="comparison-part">
          <a href="${escapeHtml(part.url)}" target="_blank" rel="noreferrer"
            >${escapeHtml(part.name)}</a
          >
        </th>
        <td rowspan="${packages.length}">${part.nvmKb} KB</td>
        <td rowspan="${packages.length}">${part.ramKb} KB</td>
        <td rowspan="${packages.length}">${part.vddMinV}&ndash;${part.vddMaxV} V</td>
        <td rowspan="${packages.length}">+${part.maxTxDbm} dBm</td>
        <td rowspan="${packages.length}">${yesNo(part.npu)}</td>
        <td rowspan="${packages.length}">${yesNo(part.ieee802154)}</td>
        <td rowspan="${packages.length}">${yesNo(part.matter)}</td>`
          : "";

      return `
      <tr class="${index === 0 ? "comparison-group-start" : ""}${isLoaded(part, pkg) ? " is-loaded" : ""}">
        ${partCells}
        <td class="comparison-package">
          ${escapeHtml(pkg.name)}
          <span class="comparison-package-size">${packageSize(metrics)}</span>
        </td>
        <td>${metrics.gpioCount}</td>
        <td>${metrics.serialInterfaces}</td>
        <td>${metrics.adcChannels}</td>
        <td>${yesNo(metrics.hasNfc)}</td>
        <td>${yesNo(metrics.hasUsbHighSpeed)}</td>
        <td>${yesNo(metrics.hasDigitalAudio)}</td>
        <td>${yesNo(metrics.hasQspi)}</td>
        <td>
          <button
            type="button"
            class="comparison-load-btn secondary-btn"
            data-load="${escapeHtml(part.id)}|${escapeHtml(pkg.file)}"
          >
            Load
          </button>
        </td>
      </tr>`;
    })
    .join("");
}

function tableMarkup() {
  return `
    <div class="comparison-scroll">
      <table class="comparison-table">
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">NVM</th>
            <th scope="col">RAM</th>
            <th scope="col">Supply</th>
            <th scope="col" title="Maximum radio output power">TX</th>
            <th scope="col" title="Axon NPU for on-device AI">NPU</th>
            <th scope="col" title="IEEE 802.15.4: Thread and Zigbee">15.4</th>
            <th scope="col">Matter</th>
            <th scope="col">Package</th>
            <th scope="col">GPIO</th>
            <th scope="col" title="Serial instances, each usable as SPI, TWI or UART">Serial</th>
            <th scope="col" title="ADC channels">ADC</th>
            <th scope="col" title="NFC tag (NFCT)">NFC</th>
            <th scope="col" title="High-speed USB">USB</th>
            <th scope="col" title="Digital audio: I2S, PDM or TDM">Audio</th>
            <th scope="col" title="QSPI for external flash">QSPI</th>
            <th scope="col"><span class="visually-hidden">Load</span></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(partRowsMarkup).join("")}
        </tbody>
      </table>
    </div>`;
}

function render() {
  const body = document.getElementById("productComparisonBody");
  body.innerHTML = tableMarkup();

  body.querySelectorAll("[data-load]").forEach((button) => {
    button.addEventListener("click", () => {
      const [partId, packageFile] = button.dataset.load.split("|");
      loadIntoPlanner(partId, packageFile);
    });
  });
}

// --- ACTIONS ---

async function loadIntoPlanner(partId, packageFile) {
  const part = NRF54L_PARTS.find((entry) => entry.id === partId);
  if (!part) return;

  const mcuSelector = document.getElementById("mcuSelector");
  const hasMcu = Array.from(mcuSelector.options).some(
    (option) => option.value === part.mcuId,
  );
  if (!hasMcu) {
    showToast(`${part.name} is not available in this planner build.`, "error");
    return;
  }

  mcuSelector.value = part.mcuId;
  const loaded = await handleMcuChange({ packageToSelect: packageFile });
  closeProductComparison();

  if (loaded === false) {
    showToast(`Could not load ${part.name}.`, "error");
    return;
  }
  showToast(`${part.name} loaded - start assigning peripherals.`, "success");
}

// --- LAUNCHER ---

export function initProductComparison() {
  const openBtn = document.getElementById("productComparisonOpenBtn");
  if (!openBtn) return;

  openBtn.addEventListener("click", openProductComparison);
  document
    .getElementById("closeProductComparisonModal")
    .addEventListener("click", closeProductComparison);
  document
    .getElementById("productComparisonModal")
    .addEventListener("click", (event) => {
      if (event.target.id === "productComparisonModal") {
        closeProductComparison();
      }
    });
  document
    .getElementById("productComparisonDoneBtn")
    .addEventListener("click", closeProductComparison);
}

export async function openProductComparison() {
  const modal = document.getElementById("productComparisonModal");
  modal.style.display = "flex";

  const body = document.getElementById("productComparisonBody");
  if (!rows) {
    body.innerHTML = `<p class="comparison-loading">Reading package data&hellip;</p>`;
    try {
      await getRows();
    } catch (error) {
      console.error("Comparison failed to load package data:", error);
      rowsPromise = null;
      body.innerHTML = `<div class="inline-warning"><strong>Could not read the package data.</strong> Reload the page and try again.</div>`;
      return;
    }
  }

  render();
}

export function closeProductComparison() {
  document.getElementById("productComparisonModal").style.display = "none";
}
