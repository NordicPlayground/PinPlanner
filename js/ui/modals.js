// --- PIN SELECTION MODAL, GPIO MODAL ---

import state from "../state.js";
import { saveStateToLocalStorage } from "../state.js";
import { updatePinDisplay } from "../pin-layout.js";
import { updateSelectedPeripheralsList } from "./selected-list.js";
import {
  organizePeripherals,
  removePeripheral,
  editPeripheral,
} from "../peripherals.js";
import { updateConsoleConfig } from "../console-config.js";
import { enableScrollWheelSelectionForElement } from "../utils.js";

// --- PIN SELECTION MODAL ---

let tempSpiCsGpios = [];

export function openPinSelectionModal(
  peripheral,
  existingPins = {},
  existingLabels = {},
  existingConfig = {},
) {
  state.currentPeripheral = peripheral;
  state.tempSelectedPins = { ...existingPins };
  state.labels = { ...existingLabels };

  document.getElementById("modalTitle").textContent =
    `Select Pins for ${peripheral.id}`;
  populatePinSelectionTable(peripheral);

  const uartConfigSection = document.getElementById("uartConfigSection");
  const uartDisableRxCheckbox = document.getElementById("uartDisableRx");
  if (peripheral.type === "UART") {
    uartConfigSection.style.display = "block";
    uartDisableRxCheckbox.checked = existingConfig.disableRx || false;
    uartDisableRxCheckbox.onchange = updateRxdRequiredStatus;
    updateRxdRequiredStatus();
  } else {
    uartConfigSection.style.display = "none";
    uartDisableRxCheckbox.checked = false;
    uartDisableRxCheckbox.onchange = null;
  }

  const spiConfigSection = document.getElementById("spiConfigSection");
  if (peripheral.type === "SPI") {
    spiConfigSection.style.display = "block";
    initSpiCsGpioList(existingConfig.extraCsGpios || []);
  } else {
    spiConfigSection.style.display = "none";
  }

  const noteSection = document.getElementById("peripheralNoteSection");
  const noteInput = document.getElementById("peripheralNote");
  if (["SPI", "TWI", "UART"].includes(peripheral.type)) {
    noteSection.style.display = "block";
    noteInput.value = existingConfig.note || "";
  } else {
    noteSection.style.display = "none";
    noteInput.value = "";
  }

  document.getElementById("pinSelectionModal").style.display = "block";
}

export function closePinSelectionModal() {
  document.getElementById("pinSelectionModal").style.display = "none";
  state.currentPeripheral = null;
  state.tempSelectedPins = {};
  state.labels = {};
}

function updateRxdRequiredStatus() {
  const disableRxChecked = document.getElementById("uartDisableRx").checked;
  const tableBody = document.getElementById("pinSelectionTableBody");
  const rows = tableBody.querySelectorAll("tr");

  rows.forEach((row) => {
    const functionCell = row.querySelector("td:first-child");
    const requiredCell = row.querySelector("td:nth-child(2)");
    if (functionCell && requiredCell && functionCell.textContent === "RXD") {
      requiredCell.textContent = disableRxChecked ? "No" : "Yes";
    }
  });
}

// --- SPI CS GPIO ---

function initSpiCsGpioList(existingCsGpios) {
  tempSpiCsGpios = [...existingCsGpios];
  renderSpiCsGpioList();
}

function renderSpiCsGpioList() {
  const container = document.getElementById("spiCsGpioList");
  container.innerHTML = "";

  tempSpiCsGpios.forEach((gpio, index) => {
    const otherCsGpios = tempSpiCsGpios.filter((g, i) => i !== index && g);

    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; align-items: center; gap: 10px; margin-bottom: 8px;";
    row.innerHTML = `
      <select data-cs-index="${index}" style="flex: 1;">
        ${getGpioPinOptions(gpio, true, otherCsGpios)}
      </select>
      <button type="button" class="remove-cs-btn" data-cs-index="${index}" style="padding: 4px 8px;">Remove</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.csIndex);
      tempSpiCsGpios[idx] = e.target.value;
      renderSpiCsGpioList();
    });
    enableScrollWheelSelectionForElement(select);
  });

  container.querySelectorAll(".remove-cs-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.csIndex);
      tempSpiCsGpios.splice(idx, 1);
      renderSpiCsGpioList();
    });
  });
}

function getGpioPinOptions(selectedPin, filterUsed = false, excludePins = []) {
  if (!state.mcuData.pins) return '<option value="">-- Select GPIO --</option>';

  const gpioPins = state.mcuData.pins
    .filter(
      (pin) =>
        Array.isArray(pin.functions) && pin.functions.includes("Digital I/O"),
    )
    .sort((a, b) => {
      const aMatch = a.name.match(/P(\d+)\.(\d+)/);
      const bMatch = b.name.match(/P(\d+)\.(\d+)/);
      if (!aMatch || !bMatch) return a.name.localeCompare(b.name);
      const aPort = parseInt(aMatch[1]);
      const bPort = parseInt(bMatch[1]);
      const aPin = parseInt(aMatch[2]);
      const bPin = parseInt(bMatch[2]);
      if (aPort !== bPort) return aPort - bPort;
      return aPin - bPin;
    });

  let options = '<option value="">-- Select GPIO --</option>';
  gpioPins.forEach((pin) => {
    const isSelected = pin.name === selectedPin;

    let isDisabled = false;
    if (filterUsed && !isSelected) {
      if (state.usedPins[pin.name]) {
        isDisabled = true;
      }
      if (state.tempSelectedPins[pin.name]) {
        isDisabled = true;
      }
      if (excludePins.includes(pin.name)) {
        isDisabled = true;
      }
    }

    options += `<option value="${pin.name}" ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}>${pin.name}${isDisabled ? " (in use)" : ""}</option>`;
  });
  return options;
}

export function addSpiCsGpio() {
  tempSpiCsGpios.push("");
  renderSpiCsGpioList();
}

// --- PIN SELECTION TABLE ---

function populatePinSelectionTable(peripheral) {
  const tableBody = document.getElementById("pinSelectionTableBody");
  tableBody.innerHTML = "";

  peripheral.signals.forEach((signal) => {
    const row = document.createElement("tr");
    const allPossiblePins = getPinsForSignal(signal);

    let selectionHtml;
    if (allPossiblePins.length === 1 && signal.allowedGpio.length === 1) {
      const pin = allPossiblePins[0];
      selectionHtml = `<label><input type="checkbox" data-signal="${signal.name}" data-pin="${pin.name}"> ${pin.name}</label>`;
    } else {
      let optionsHtml = '<option value="">-- Select Pin --</option>';
      allPossiblePins.forEach((pin) => {
        const isSelected = state.tempSelectedPins[pin.name] === signal.name;
        const label = `${pin.name}${pin.isClockCapable ? " (Clock)" : ""}`;
        optionsHtml += `<option value="${pin.name}" data-label="${label}" ${isSelected ? "selected" : ""}>${label}</option>`;
      });
      selectionHtml = `<select data-signal="${signal.name}" ${signal.isMandatory ? "required" : ""}>${optionsHtml}</select>`;
    }

    row.innerHTML = `
            <td>${signal.name}</td>
            <td>${signal.isMandatory ? "Yes" : "No"}</td>
            <td>${selectionHtml}</td>
            <td>
              <input type="text"
              value="${state.labels[signal.name] ? state.labels[signal.name] : ""}"
              placeholder="e.g., spi0, i2c0"
              pattern="[a-z0-9_]+"
              data-field="${signal.name}"
              maxlength="20">
            </td>
        `;
    tableBody.appendChild(row);
  });

  tableBody
    .querySelectorAll('select, input[type="checkbox"]')
    .forEach((input) => {
      input.addEventListener("change", handlePinSelectionChange);
    });

  tableBody.querySelectorAll('input[type="text"]').forEach((input) => {
    input.addEventListener("change", handleLabelModificationChange);
  });

  tableBody.querySelectorAll("select").forEach((select) => {
    enableScrollWheelSelectionForElement(select);
  });

  updateModalPinAvailability();
}

function handleLabelModificationChange(event) {
  const input = event.target;
  const signalName = input.dataset.field;

  Object.keys(state.labels).forEach((pin) => {
    if (state.labels[pin] === signalName) {
      delete state.labels[pin];
    }
  });

  if (input.value) {
    state.labels[signalName] = input.value;
  }
}

function handlePinSelectionChange(event) {
  const input = event.target;
  const signalName = input.dataset.signal;

  Object.keys(state.tempSelectedPins).forEach((pin) => {
    if (state.tempSelectedPins[pin] === signalName) {
      delete state.tempSelectedPins[pin];
    }
  });

  if (input.type === "checkbox") {
    if (input.checked) {
      state.tempSelectedPins[input.dataset.pin] = signalName;
    }
  } else {
    if (input.value) {
      state.tempSelectedPins[input.value] = signalName;
    }
  }

  updateModalPinAvailability();
}

function updateModalPinAvailability() {
  const selects = document.querySelectorAll("#pinSelectionTableBody select");
  const checkboxes = document.querySelectorAll(
    '#pinSelectionTableBody input[type="checkbox"]',
  );

  const pinsSelectedInModal = Object.keys(state.tempSelectedPins);
  const portRestriction = getPortRestriction(state.currentPeripheral);

  selects.forEach((select) => {
    const signalForThisSelect = select.dataset.signal;
    for (const option of select.options) {
      const pinName = option.value;
      if (!pinName) continue;

      const isUsedByOtherPeripheral =
        state.usedPins[pinName] &&
        state.usedPins[pinName].peripheral !== state.currentPeripheral.id;
      const isUsedInThisModal =
        pinsSelectedInModal.includes(pinName) &&
        state.tempSelectedPins[pinName] !== signalForThisSelect;
      const isWrongPort = isPinPortBlocked(pinName, portRestriction);

      option.disabled =
        isUsedByOtherPeripheral || isUsedInThisModal || isWrongPort;
      option.textContent = `${option.dataset.label || pinName}${
        isWrongPort ? portBlockedSuffix(portRestriction) : ""
      }`;
    }
  });

  checkboxes.forEach((checkbox) => {
    const pinName = checkbox.dataset.pin;
    const signalForThisCheckbox = checkbox.dataset.signal;

    const isUsedByOtherPeripheral =
      state.usedPins[pinName] &&
      state.usedPins[pinName].peripheral !== state.currentPeripheral.id;
    const isUsedInThisModal =
      pinsSelectedInModal.includes(pinName) &&
      state.tempSelectedPins[pinName] !== signalForThisCheckbox;

    checkbox.disabled =
      isUsedByOtherPeripheral ||
      isUsedInThisModal ||
      isPinPortBlocked(pinName, portRestriction);
  });
}

// --- GPIO PORT CONSTRAINT ---
//
// nRF54L GPIO port capabilities: a peripheral instance cannot mix pins from
// different GPIO ports - every pin it uses must sit on the same port. Several
// peripherals are reachable from more than one port (UARTE20 on the nRF54LM20A
// can use Port 1 or Port 3), and that choice is what has to stay consistent.
//
// Out-of-port options are disabled and labelled with the port they are locked
// out by, so the rule explains itself where the user is looking.
//
// The constraint only applies where there is a choice to keep. Signals whose
// pins carry no port at all (high-speed USB D+/D-) are exempt, and peripherals
// whose signals are each hard-wired to a different port - GRTC drives its
// 32 kHz output from Port 0 and its fast clock output from Port 1 - have no
// common port to lock onto and are left alone.

function getPortsForSignal(signal) {
  return new Set(
    getPinsForSignal(signal)
      .map((pin) => pin.port)
      .filter(Boolean),
  );
}

function getPortForPin(pinName) {
  return state.mcuData.pins?.find((pin) => pin.name === pinName)?.port || null;
}

// Ports that could host the whole peripheral: every mandatory signal has to be
// reachable from the port, so the candidates are the intersection of their
// allowed ports. Two or more candidates means the user has a choice to lock.
function getPeripheralPortLock(peripheral) {
  const signalPorts = (peripheral?.signals || [])
    .map((signal) => ({ signal, ports: getPortsForSignal(signal) }))
    .filter((entry) => entry.ports.size > 0);

  const mandatory = signalPorts.filter((entry) => entry.signal.isMandatory);
  const pool = mandatory.length > 0 ? mandatory : signalPorts;
  if (pool.length === 0) return { locked: false, ports: new Set() };

  const candidates = pool.reduce(
    (shared, entry) =>
      new Set([...shared].filter((port) => entry.ports.has(port))),
    new Set(pool[0].ports),
  );

  return { locked: candidates.size > 1, ports: candidates };
}

// The port the user has already committed to, if any.
function getActivePort() {
  for (const pinName of Object.keys(state.tempSelectedPins)) {
    const port = getPortForPin(pinName);
    if (port) return port;
  }
  return null;
}

function getPortRestriction(peripheral) {
  const lock = getPeripheralPortLock(peripheral);
  if (!lock.locked) return null;

  const activePort = getActivePort();
  return {
    activePort,
    allowedPorts: activePort ? new Set([activePort]) : lock.ports,
  };
}

function isPinPortBlocked(pinName, restriction) {
  if (!restriction) return false;

  const port = getPortForPin(pinName);
  // A pin with no port of its own (USB D+/D-) is never part of the constraint.
  if (!port) return false;
  return !restriction.allowedPorts.has(port);
}

function portBlockedSuffix(restriction) {
  return restriction?.activePort
    ? ` (locked to ${restriction.activePort})`
    : " (port not usable)";
}

function getPinsForSignal(signal) {
  if (!state.mcuData.pins) return [];
  const pins = state.mcuData.pins.filter((pin) => {
    if (!Array.isArray(pin.functions) || !pin.functions.includes("Digital I/O"))
      return false;
    if (signal.requiresClockCapablePin && !pin.isClockCapable) return false;
    return signal.allowedGpio.some((allowed) =>
      allowed.endsWith("*")
        ? pin.port === allowed.slice(0, -1)
        : pin.name === allowed,
    );
  });

  return pins.sort((a, b) => {
    const aMatch = a.name.match(/P(\d+)\.(\d+)/);
    const bMatch = b.name.match(/P(\d+)\.(\d+)/);

    if (!aMatch || !bMatch) return a.name.localeCompare(b.name);

    const aPort = parseInt(aMatch[1]);
    const bPort = parseInt(bMatch[1]);
    const aPin = parseInt(aMatch[2]);
    const bPin = parseInt(bMatch[2]);

    if (aPort !== bPort) return aPort - bPort;
    return aPin - bPin;
  });
}

export function confirmPinSelection() {
  const disableRxChecked =
    state.currentPeripheral.type === "UART" &&
    document.getElementById("uartDisableRx").checked;

  const missingSignals = state.currentPeripheral.signals.filter((s) => {
    if (disableRxChecked && s.name === "RXD") return false;
    return (
      s.isMandatory && !Object.values(state.tempSelectedPins).includes(s.name)
    );
  });

  if (missingSignals.length > 0) {
    alert(
      `Please select pins for mandatory functions: ${missingSignals.map((s) => s.name).join(", ")}`,
    );
    return;
  }

  for (const pinName in state.tempSelectedPins) {
    if (
      state.usedPins[pinName] &&
      state.usedPins[pinName].peripheral !== state.currentPeripheral.id
    ) {
      alert(
        `Pin ${pinName} is already used by ${state.usedPins[pinName].peripheral}.`,
      );
      return;
    }
  }

  // Backstop for the option filtering above: editing a peripheral that was
  // saved before this rule existed opens the modal with mixed pins already in
  // place, and nothing forces the user to touch them before confirming.
  const portLock = getPeripheralPortLock(state.currentPeripheral);
  if (portLock.locked) {
    const portsInUse = new Set(
      Object.keys(state.tempSelectedPins)
        .map((pinName) => getPortForPin(pinName))
        .filter(Boolean),
    );
    if (portsInUse.size > 1) {
      alert(
        `${state.currentPeripheral.id} cannot mix GPIO ports. ` +
          `All of its pins must be on the same port, but ${[...portsInUse]
            .sort()
            .join(" and ")} are both selected.`,
      );
      return;
    }
  }

  const existingIndex = state.selectedPeripherals.findIndex(
    (p) => p.id === state.currentPeripheral.id,
  );
  if (existingIndex !== -1) {
    const oldPeripheral = state.selectedPeripherals[existingIndex];
    for (const pinName in oldPeripheral.pinFunctions) {
      delete state.usedPins[pinName];
    }
    state.selectedPeripherals.splice(existingIndex, 1);
  }

  const peripheralEntry = {
    id: state.currentPeripheral.id,
    peripheral: state.currentPeripheral,
    pinFunctions: { ...state.tempSelectedPins },
    label: { ...state.labels },
  };

  if (state.currentPeripheral.type === "UART") {
    const disableRx = document.getElementById("uartDisableRx").checked;
    if (disableRx) {
      peripheralEntry.config = { disableRx: true };
    }
  }

  if (state.currentPeripheral.type === "SPI") {
    const validCsGpios = tempSpiCsGpios.filter(
      (gpio) => gpio && gpio.trim() !== "",
    );
    if (validCsGpios.length > 0) {
      peripheralEntry.config = peripheralEntry.config || {};
      peripheralEntry.config.extraCsGpios = validCsGpios;
    }
  }

  if (["SPI", "I2C", "UART"].includes(state.currentPeripheral.type)) {
    const note = document.getElementById("peripheralNote").value.trim();
    if (note) {
      peripheralEntry.config = peripheralEntry.config || {};
      peripheralEntry.config.note = note;
    }
  }

  state.selectedPeripherals.push(peripheralEntry);

  for (const pinName in state.tempSelectedPins) {
    state.usedPins[pinName] = {
      peripheral: state.currentPeripheral.id,
      function: state.tempSelectedPins[pinName],
      required: state.currentPeripheral.signals.find(
        (s) => s.name === state.tempSelectedPins[pinName],
      ).isMandatory,
    };
  }
  if (state.currentPeripheral.baseAddress) {
    state.usedAddresses[state.currentPeripheral.baseAddress] =
      state.currentPeripheral.id;
  }

  updateSelectedPeripheralsList();
  updatePinDisplay();
  updateConsoleConfig();
  closePinSelectionModal();
  saveStateToLocalStorage();
}

// --- GPIO PIN ALLOCATION MODAL ---

let gpioTableRows = [];
let nextGpioRowId = 1;

export function openGpioModal() {
  initializeGpioTable();

  const errorEl = document.getElementById("gpioError");
  errorEl.style.display = "none";

  document.getElementById("gpioModal").style.display = "block";
}

function initializeGpioTable() {
  gpioTableRows = [];
  nextGpioRowId = 1;

  state.selectedPeripherals
    .filter((p) => p.type === "GPIO")
    .forEach((gpio) => {
      addGpioTableRow(gpio.label, gpio.pin, gpio.activeState, gpio.id);
    });

  if (gpioTableRows.length === 0) {
    addGpioTableRow();
  }

  renderGpioTable();
}

function addGpioTableRow(
  label = "",
  pin = "",
  activeState = "active-high",
  existingId = null,
) {
  const rowId = `gpio_row_${nextGpioRowId++}`;
  gpioTableRows.push({
    id: rowId,
    label: label,
    pin: pin,
    activeState: activeState,
    existingId: existingId,
    isValid: true,
  });
  renderGpioTable();
}

// Expose for onclick handler
window._removeGpioTableRow = function (rowId) {
  const index = gpioTableRows.findIndex((row) => row.id === rowId);
  if (index !== -1) {
    gpioTableRows.splice(index, 1);
    renderGpioTable();
  }
};

function renderGpioTable() {
  const tableBody = document.getElementById("gpioTableBody");

  if (gpioTableRows.length === 0) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">No GPIO pins configured. Click "Add GPIO Pin" to add one.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = "";

  gpioTableRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="text"
               value="${row.label}"
               placeholder="e.g., led0, button0"
               pattern="[a-z0-9_]+"
               data-row-id="${row.id}"
               data-field="label"
               class="${!row.isValid ? "validation-error" : ""}"
               maxlength="20">
      </td>
      <td>
        <select data-row-id="${row.id}" data-field="pin">
          <option value="">-- Select Pin --</option>
          ${getGpioPinOptionsForTable(row.pin, row.existingId)}
        </select>
      </td>
      <td>
        <select data-row-id="${row.id}" data-field="activeState">
          <option value="active-high" ${row.activeState === "active-high" ? "selected" : ""}>Active High</option>
          <option value="active-low" ${row.activeState === "active-low" ? "selected" : ""}>Active Low</option>
        </select>
      </td>
      <td>
        <button type="button"
                class="gpio-remove-btn"
                onclick="window._removeGpioTableRow('${row.id}')"
                title="Remove this GPIO pin">
          Remove
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  attachGpioTableEventListeners();
}

function attachGpioTableEventListeners() {
  document
    .querySelectorAll("#gpioTable input, #gpioTable select")
    .forEach((element) => {
      element.addEventListener("input", handleGpioTableInputChange);
      element.addEventListener("change", handleGpioTableInputChange);

      if (
        element.type === "text" &&
        element.getAttribute("data-field") === "label"
      ) {
        element.addEventListener("blur", (event) => {
          const value = event.target.value.toLowerCase();
          if (event.target.value !== value) {
            event.target.value = value;
            handleGpioTableInputChange(event);
          }
        });
      }
    });
}

function handleGpioTableInputChange(event) {
  const rowId = event.target.getAttribute("data-row-id");
  const field = event.target.getAttribute("data-field");
  const value = event.target.value;

  const row = gpioTableRows.find((r) => r.id === rowId);
  if (row) {
    row[field] = value;
    validateGpioRow(row);

    if (field === "pin") {
      renderGpioTable();
    } else {
      updateInputValidation(event.target, row);
    }
  }
}

function updateInputValidation(inputElement, row) {
  if (row.isValid) {
    inputElement.classList.remove("validation-error");
  } else {
    inputElement.classList.add("validation-error");
  }
}

function validateGpioRow(row) {
  row.isValid = true;

  if (!row.label || !/^[a-z0-9_]+$/.test(row.label)) {
    row.isValid = false;
    return;
  }

  const duplicateLabel = gpioTableRows.find(
    (r) => r.id !== row.id && r.label === row.label && r.label !== "",
  );
  if (duplicateLabel) {
    row.isValid = false;
    return;
  }

  if (!row.pin) {
    row.isValid = false;
    return;
  }

  const duplicatePin = gpioTableRows.find(
    (r) => r.id !== row.id && r.pin === row.pin && r.pin !== "",
  );
  if (duplicatePin) {
    row.isValid = false;
    return;
  }
}

function getGpioPinOptionsForTable(selectedPin, existingGpioId) {
  let options = "";

  if (!state.mcuData.pins) return options;

  const gpioPins = state.mcuData.pins.filter(
    (pin) => pin.functions && pin.functions.includes("Digital I/O"),
  );

  gpioPins.sort((a, b) => {
    const aMatch = a.name.match(/P(\d+)\.(\d+)/);
    const bMatch = b.name.match(/P(\d+)\.(\d+)/);

    if (aMatch && bMatch) {
      const aPort = parseInt(aMatch[1]);
      const bPort = parseInt(bMatch[1]);
      const aPin = parseInt(aMatch[2]);
      const bPin = parseInt(bMatch[2]);

      if (aPort !== bPort) {
        return aPort - bPort;
      }
      return aPin - bPin;
    }

    return a.name.localeCompare(b.name);
  });

  gpioPins.forEach((pin) => {
    const isSelected = pin.name === selectedPin;
    let isDisabled = false;

    if (
      state.usedPins[pin.name] &&
      !state.usedPins[pin.name].peripheral.startsWith("GPIO_")
    ) {
      isDisabled = true;
    }

    const gpioUsingPin = state.selectedPeripherals.find(
      (p) => p.type === "GPIO" && p.pin === pin.name && p.id !== existingGpioId,
    );
    if (gpioUsingPin && !isSelected) {
      isDisabled = true;
    }

    options += `<option value="${pin.name}" ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}>${pin.name}${isDisabled ? " (in use)" : ""}</option>`;
  });

  return options;
}

export function closeGpioModal() {
  document.getElementById("gpioModal").style.display = "none";
  gpioTableRows = [];
}

export function confirmGpioModal() {
  const errorEl = document.getElementById("gpioError");

  let hasErrors = false;
  const validRows = [];
  const errorMessages = [];

  gpioTableRows.forEach((row) => {
    validateGpioRow(row);
    if (!row.isValid && row.label && row.pin) {
      hasErrors = true;
      if (!/^[a-z0-9_]+$/.test(row.label)) {
        errorMessages.push(
          `"${row.label}": Label must be lowercase letters, numbers, and underscores only`,
        );
      } else if (
        gpioTableRows.find(
          (r) => r.id !== row.id && r.label === row.label && r.label !== "",
        )
      ) {
        errorMessages.push(`"${row.label}": Duplicate label`);
      } else if (
        gpioTableRows.find(
          (r) => r.id !== row.id && r.pin === row.pin && r.pin !== "",
        )
      ) {
        errorMessages.push(`${row.pin}: Pin used multiple times`);
      }
    } else if (row.label && row.pin && row.isValid) {
      validRows.push(row);
    }
  });

  if (hasErrors) {
    const uniqueMessages = [...new Set(errorMessages)];
    errorEl.textContent = "Validation errors: " + uniqueMessages.join("; ");
    errorEl.style.display = "block";
    renderGpioTable();
    return;
  }

  if (validRows.length === 0) {
    errorEl.textContent = "Please add at least one GPIO pin or cancel";
    errorEl.style.display = "block";
    return;
  }

  state.selectedPeripherals
    .filter((p) => p.type === "GPIO")
    .forEach((gpio) => {
      delete state.usedPins[gpio.pin];
    });
  state.selectedPeripherals = state.selectedPeripherals.filter(
    (p) => p.type !== "GPIO",
  );

  validRows.forEach((row) => {
    const gpioId = `GPIO_${row.label.toUpperCase()}`;

    state.selectedPeripherals.push({
      id: gpioId,
      type: "GPIO",
      label: row.label,
      pin: row.pin,
      activeState: row.activeState,
    });

    state.usedPins[row.pin] = {
      peripheral: gpioId,
      function: "GPIO",
      required: true,
    };
  });

  updateSelectedPeripheralsList();
  updatePinDisplay();
  closeGpioModal();
  saveStateToLocalStorage();
}

// Expose addGpioTableRow for the button
export function addGpioTableRowPublic() {
  addGpioTableRow();
}
