# OpenLabels User Guide

Welcome to the **OpenLabels User Guide**. This document walks you through designing, configuring, and printing professional industrial and commercial labels.

---

## 1. Getting Started

### Launching OpenLabels
After installing OpenLabels, launch the application from your desktop or start menu. You will be greeted with the main WYSIWYG label editor canvas, the left component toolbox, the top toolbar, and the right properties inspector.

### Creating a New Label
1. Click **File > New** or press `Ctrl+N`.
2. Configure label physical dimensions:
   - **Units:** Millimeters (`mm`) or Inches (`in`).
   - **Width & Height:** Physical dimensions of the label stock (e.g., 100mm × 50mm).
   - **Printer DPI:** 203 DPI (standard thermal), 300 DPI (high-resolution), or 600 DPI (ultra-dense micro-labels).
   - **Orientation:** Portrait or Landscape.

---

## 2. Canvas Elements & Design

### Text Elements
- Select the **Text** tool from the toolbar and click on the canvas.
- Configure properties in the inspector:
  - Font family, size, line spacing, alignment (left, center, right).
  - Rotation (0°, 90°, 180°, 270°).
  - Color and border stroke.
  - Dynamic expression bindings (e.g. `{{serial_number}}`).

### Geometric Shapes
- **Lines & Rectangles:** Draw dividing lines, bounding boxes, or borders with customizable line thickness and corner radius.

---

## 3. Barcodes (1D & 2D)

OpenLabels renders vector barcodes on screen and translates them directly into printer commands (such as ZPL `^BC` or `^BQ`):
- **Code 128:** High-density alphanumeric 1D barcode used in logistics and shipping.
- **EAN-13:** Standard retail product barcode with automatic check-digit calculation.
- **QR Code:** 2D matrix barcode with configurable error correction level (L, M, Q, H).
- **Data Matrix:** Compact 2D barcode widely used in electronics and healthcare.

---

## 4. Saving & Opening Documents (`.label`)

- **Save:** Press `Ctrl+S` or click **File > Save**.
- **Open:** Press `Ctrl+O` to open existing `.label` documents.
- OpenLabels uses atomic write persistence (`.tmp` write followed by validation and atomic rename) to protect your files against system interruptions.
- If an unexpected shutdown occurs, OpenLabels automatically prompts you to restore unsaved snapshots from the recovery cache.

---

## 5. Dynamic Variables & Counters

Labels frequently require dynamic content:
- **System Date & Time:** Insert expressions like `{{date:YYYY-MM-DD}}` or `{{time:HH:mm:ss}}`.
- **Serial Counters:** Configure sequential alphanumeric counters with custom start values, step increments, and leading-zero padding (e.g., `SN-0001`, `SN-0002`).

---

## 6. External Data Sources (CSV, Excel, SQL, REST)

Connect external data to print customized labels in bulk:
- **CSV:** Import comma- or semicolon-separated files with headers.
- **Excel (.xlsx):** Connect Excel spreadsheets and select the target worksheet.
- **Microsoft SQL Server:** Connect directly via secure TDS protocol to query inventory or orders table.
- **REST API:** Fetch JSON datasets from corporate web services with custom request headers.

> **Security Note:** All database passwords and API tokens are securely encrypted in your local OS credential vault and are never embedded into label files.

---

## 7. Printing & Transports

OpenLabels supports dual printing workflows:
1. **Zebra Thermal Printers (ZPL II):**
   - Direct TCP RAW connection (typically Port 9100) across your local network.
   - Outputs native thermal microcode for maximum print speed and razor-sharp thermal rendering.
2. **Standard Office Printers (PDF):**
   - High-resolution vector PDF generation dispatched through the Windows print spooler.

---

## 8. Batch Production & Queue Management

When printing hundreds or thousands of labels:
1. Open the **Production** dialog.
2. Review the **Preflight** check to ensure data sources are connected and all variables are resolved.
3. Configure start index and record limits.
4. Monitor real-time batch progress with bounded concurrency (preventing printer spooler overflow).
5. Pause, resume, or retry individual failed print jobs with complete audit logging.

---

## 9. Troubleshooting

- **Printer Not Responding (TCP RAW):** Verify that the printer's IP address is reachable and that port 9100 is not blocked by local network firewalls.
- **Barcode Scan Failure:** Ensure the X-dimension (narrow bar width) is configured to an integer number of hardware dots for your printer's DPI.
- **Export Diagnostics:** If you encounter an unexpected issue, go to **Settings > Advanced** and click **Export Diagnostics** to generate a sanitized diagnostic report for technical support.
