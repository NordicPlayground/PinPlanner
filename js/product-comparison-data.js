// --- nRF54L PRODUCT COMPARISON REFERENCE DATA ---
//
// Only facts that cannot be derived from the package JSON files live here
// (memory sizes, supply range, radio protocols, coprocessor/NPU presence).
// Everything that IS in the package data - GPIO count, serial instances, ADC
// channels, package size, NFC/USB/audio availability - is derived at runtime in
// product-comparison.js so this table stays small and cannot drift from the pin
// data the rest of the app uses.
//
// Sources: Nordic product pages for each part and the nRF54L Series overview in
// the Nordic Developer Academy. Always confirm against the datasheet before
// committing to a part; each entry carries its product page URL.

// Most capable first; the comparison table renders the parts in this order.
export const NRF54L_PARTS = [
  {
    id: "nrf54lm20b",
    name: "nRF54LM20B",
    mcuId: "nrf54lm20a",
    nvmKb: 2036,
    ramKb: 512,
    vddMinV: 1.7,
    vddMaxV: 3.6,
    maxTxDbm: 8,
    npu: true,
    riscvCoprocessor: true,
    trustZone: true,
    ieee802154: true,
    matter: true,
    channelSounding: true,
    hibernation: false,
    protocols:
      "Bluetooth LE, Channel Sounding, Bluetooth Mesh, Matter, Thread, Zigbee, Aliro, 2.4 GHz proprietary",
    summary:
      "nRF54LM20A plus a 128 MHz Axon NPU - the only nRF54L part with dedicated Edge AI acceleration (up to 15x faster than the same inference on the CPU).",
    caveats: [
      "The planner models the nRF54LM20A and nRF54LM20B together - they share a pinout.",
    ],
    url: "https://www.nordicsemi.com/Products/nRF54LM20B",
  },
  {
    id: "nrf54lm20a",
    name: "nRF54LM20A",
    mcuId: "nrf54lm20a",
    nvmKb: 2036,
    ramKb: 512,
    vddMinV: 1.7,
    vddMaxV: 3.6,
    maxTxDbm: 8,
    npu: false,
    riscvCoprocessor: true,
    trustZone: true,
    ieee802154: true,
    matter: true,
    channelSounding: true,
    hibernation: false,
    protocols:
      "Bluetooth LE, Channel Sounding, Bluetooth Mesh, Matter, Thread, Zigbee, Aliro, 2.4 GHz proprietary",
    summary:
      "Largest memory in the series, seven serial instances and high-speed USB.",
    caveats: [
      "The planner models the nRF54LM20A and nRF54LM20B together - they share a pinout.",
    ],
    url: "https://www.nordicsemi.com/Products/nRF54LM20A",
  },
  {
    id: "nrf54l15",
    name: "nRF54L15",
    mcuId: "nrf54l15",
    nvmKb: 1524,
    ramKb: 256,
    vddMinV: 1.7,
    vddMaxV: 3.6,
    maxTxDbm: 8,
    npu: false,
    riscvCoprocessor: true,
    trustZone: true,
    ieee802154: true,
    matter: true,
    channelSounding: true,
    hibernation: false,
    protocols:
      "Bluetooth LE, Channel Sounding, Bluetooth Mesh, Matter, Thread, Zigbee, Amazon Sidewalk, Aliro, 2.4 GHz proprietary",
    summary:
      "The general-purpose workhorse of the series, and the part most samples and modules target.",
    caveats: [],
    url: "https://www.nordicsemi.com/Products/nRF54L15",
  },
  {
    id: "nrf54l10",
    name: "nRF54L10",
    mcuId: "nrf54l10",
    nvmKb: 1012,
    ramKb: 192,
    vddMinV: 1.7,
    vddMaxV: 3.6,
    maxTxDbm: 7,
    npu: false,
    riscvCoprocessor: true,
    trustZone: true,
    ieee802154: true,
    matter: true,
    channelSounding: true,
    hibernation: false,
    protocols:
      "Bluetooth LE, Channel Sounding, Bluetooth Mesh, Matter, Thread, Zigbee, Amazon Sidewalk, 2.4 GHz proprietary",
    summary:
      "Mid-range part, pin compatible with the nRF54L05 and nRF54L15 for easy scaling.",
    caveats: [],
    url: "https://www.nordicsemi.com/Products/nRF54L10",
  },
  {
    id: "nrf54l05",
    name: "nRF54L05",
    mcuId: "nrf54l05",
    nvmKb: 500,
    ramKb: 96,
    vddMinV: 1.7,
    vddMaxV: 3.6,
    maxTxDbm: 7,
    npu: false,
    riscvCoprocessor: true,
    trustZone: true,
    ieee802154: true,
    matter: false,
    channelSounding: true,
    hibernation: false,
    protocols:
      "Bluetooth LE, Channel Sounding, Bluetooth Mesh, Thread, Zigbee, 2.4 GHz proprietary",
    summary:
      "Smallest memory in the full-feature nRF54L line, pin compatible with the L10 and L15.",
    caveats: [
      "Matter is not listed for this part - Nordic lists it from the nRF54L10 up.",
      "The pin planner does not generate a non-secure (TrustZone) build target for this part.",
    ],
    url: "https://www.nordicsemi.com/Products/nRF54L05",
  },
  {
    id: "nrf54lv10a",
    name: "nRF54LV10A",
    mcuId: "nrf54lv10a",
    nvmKb: 1012,
    ramKb: 192,
    vddMinV: 1.2,
    vddMaxV: 1.7,
    maxTxDbm: 4,
    npu: false,
    riscvCoprocessor: true,
    trustZone: true,
    ieee802154: false,
    matter: false,
    channelSounding: true,
    hibernation: true,
    protocols:
      "Bluetooth LE, Channel Sounding, 2.4 GHz proprietary (no IEEE 802.15.4)",
    summary:
      "Low-voltage part for silver-oxide and single-cell designs, with a sub-50 nA hibernation mode and a 1.9 x 2.3 mm CSP.",
    caveats: [
      "Supply and GPIO voltage is 1.2-1.7 V, so it will not run from a 3 V coin cell directly.",
      "No IEEE 802.15.4, so no Thread, Zigbee or Matter.",
    ],
    url: "https://www.nordicsemi.com/Products/nRF54LV10A",
  },
  {
    id: "nrf54ls05b",
    name: "nRF54LS05B",
    mcuId: "nrf54ls05b",
    nvmKb: 508,
    ramKb: 96,
    vddMinV: 1.7,
    vddMaxV: 3.6,
    maxTxDbm: 4,
    npu: false,
    riscvCoprocessor: false,
    trustZone: false,
    ieee802154: false,
    matter: false,
    channelSounding: false,
    hibernation: false,
    protocols: "Bluetooth LE, 2.4 GHz proprietary",
    summary:
      "Same entry-level part as the nRF54LS05A with 96 KB RAM instead of 64 KB.",
    caveats: [
      "No RISC-V coprocessor, TrustZone or cryptographic accelerator.",
      "No IEEE 802.15.4, NFC, USB or digital audio interfaces.",
    ],
    url: "https://www.nordicsemi.com/Products/nRF54LS05B",
  },
  {
    id: "nrf54ls05a",
    name: "nRF54LS05A",
    mcuId: "nrf54ls05a",
    nvmKb: 508,
    ramKb: 64,
    vddMinV: 1.7,
    vddMaxV: 3.6,
    maxTxDbm: 4,
    npu: false,
    riscvCoprocessor: false,
    trustZone: false,
    ieee802154: false,
    matter: false,
    channelSounding: false,
    hibernation: false,
    protocols: "Bluetooth LE, 2.4 GHz proprietary",
    summary:
      "Entry-level Bluetooth LE part for cost-sensitive sensors, tags, beacons and remotes.",
    caveats: [
      "No RISC-V coprocessor, TrustZone or cryptographic accelerator.",
      "No IEEE 802.15.4, NFC, USB or digital audio interfaces.",
    ],
    url: "https://www.nordicsemi.com/Products/nRF54LS05A",
  },
];
