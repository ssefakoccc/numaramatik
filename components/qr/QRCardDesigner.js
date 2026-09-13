"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, QrCode, AlertCircle, FileText, Image as ImageIcon } from "lucide-react";
import { formatDisplayPhone } from "@/lib/phone";

/**
 * Design Themes for QR Card matching the official Numaratik visual template.
 */
export const CARD_THEMES = [
  {
    id: "dark",
    name: "Numaratik Gece",
    desc: "Orijinal Tasarım",
    cardBg: "#080E1A",
    borderColor: "#162544",
    accentBar: "#3B82F6",
    dotOuter: "#1D4ED8",
    dotInner: "#38BDF8",
    brandColor: "#FFFFFF",
    line1Color: "#FFFFFF",
    headerColor: "#38BDF8",
    subColor: "#94A3B8",
    pillBg: "#0A1322",
    pillBorder: "#162544",
    textColor: "#FFFFFF",
    accentDot: "bg-[#38BDF8] ring-2 ring-blue-500/40",
    pdfBg: [0.03, 0.05, 0.10],
    pdfBorder: [0.09, 0.15, 0.27],
    pdfBar: [0.23, 0.51, 0.96],
    pdfLine1: [1.0, 1.0, 1.0],
    pdfLine2: [0.22, 0.74, 0.97],
    pdfSub: [0.58, 0.64, 0.72],
    pdfPillBg: [0.04, 0.07, 0.13],
    pdfPillBorder: [0.09, 0.15, 0.27],
    pdfPhone: [1.0, 1.0, 1.0],
  },
  {
    id: "classic",
    name: "Klasik Beyaz",
    desc: "Baskı dostu",
    cardBg: "#FFFFFF",
    borderColor: "#E5E7EB",
    accentBar: "#111827",
    dotOuter: "#9CA3AF",
    dotInner: "#111827",
    brandColor: "#111827",
    line1Color: "#111827",
    headerColor: "#2563EB",
    subColor: "#6B7280",
    pillBg: "#F3F4F6",
    pillBorder: "#E5E7EB",
    textColor: "#111827",
    accentDot: "bg-gray-100 border border-gray-400",
    pdfBg: [1, 1, 1],
    pdfBorder: [0.90, 0.91, 0.92],
    pdfBar: [0.07, 0.09, 0.15],
    pdfLine1: [0.07, 0.09, 0.15],
    pdfLine2: [0.15, 0.39, 0.92],
    pdfSub: [0.42, 0.45, 0.50],
    pdfPillBg: [0.95, 0.96, 0.96],
    pdfPillBorder: [0.90, 0.91, 0.92],
    pdfPhone: [0.07, 0.09, 0.15],
  },
  {
    id: "blue",
    name: "Safir Mavisi",
    desc: "Derin okyanus",
    cardBg: "#0B1528",
    borderColor: "#1E3A5F",
    accentBar: "#38BDF8",
    dotOuter: "#0284C7",
    dotInner: "#38BDF8",
    brandColor: "#FFFFFF",
    line1Color: "#FFFFFF",
    headerColor: "#38BDF8",
    subColor: "#93C5FD",
    pillBg: "#0E1E38",
    pillBorder: "#1E3A5F",
    textColor: "#F0F9FF",
    accentDot: "bg-[#38BDF8] ring-2 ring-cyan-400/40",
    pdfBg: [0.04, 0.08, 0.16],
    pdfBorder: [0.12, 0.23, 0.37],
    pdfBar: [0.22, 0.74, 0.97],
    pdfLine1: [1.0, 1.0, 1.0],
    pdfLine2: [0.22, 0.74, 0.97],
    pdfSub: [0.58, 0.77, 0.99],
    pdfPillBg: [0.05, 0.12, 0.22],
    pdfPillBorder: [0.12, 0.23, 0.37],
    pdfPhone: [0.94, 0.98, 1.0],
  },
  {
    id: "gold",
    name: "Lüks Altın",
    desc: "Asil amber",
    cardBg: "#141416",
    borderColor: "#3F2812",
    accentBar: "#F59E0B",
    dotOuter: "#B45309",
    dotInner: "#F59E0B",
    brandColor: "#FEF3C7",
    line1Color: "#FEF3C7",
    headerColor: "#F59E0B",
    subColor: "#D97706",
    pillBg: "#1C1A17",
    pillBorder: "#3F2812",
    textColor: "#FEF3C7",
    accentDot: "bg-[#F59E0B] ring-2 ring-amber-400/40",
    pdfBg: [0.08, 0.08, 0.09],
    pdfBorder: [0.25, 0.16, 0.07],
    pdfBar: [0.96, 0.62, 0.04],
    pdfLine1: [1.0, 0.95, 0.78],
    pdfLine2: [0.96, 0.62, 0.04],
    pdfSub: [0.85, 0.47, 0.02],
    pdfPillBg: [0.11, 0.10, 0.09],
    pdfPillBorder: [0.25, 0.16, 0.07],
    pdfPhone: [1.0, 0.95, 0.78],
  },
];

/**
 * Pure vector PDF generator for 70 x 110 mm card matching official template.
 */
function buildCardPdfBlob(qrUrl, formattedPhone, showPhone, theme = CARD_THEMES[0]) {
  const qr = QRCode.create(qrUrl, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;

  // 70 mm x 110 mm in points (1 pt = 25.4 / 72 mm = 0.352778 mm)
  const pageW = 198.43;
  const pageH = 311.81;

  const qrSize = showPhone ? 116 : 138;
  const qrX = (pageW - qrSize) / 2;
  const qrY = showPhone ? 46 : (pageH - 74 - qrSize) / 2;
  const modSize = qrSize / count;

  let streamContent = "";

  // Card Background
  const [bgR, bgG, bgB] = theme.pdfBg;
  streamContent += `${bgR} ${bgG} ${bgB} rg 0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} re f\n`;

  // Border
  const [brR, brG, brB] = theme.pdfBorder;
  streamContent += `${brR} ${brG} ${brB} RG 1.5 w 4 4 ${(pageW - 8).toFixed(2)} ${(pageH - 8).toFixed(2)} re S\n`;

  // Top Accent Bar
  const [barR, barG, barB] = theme.pdfBar;
  streamContent += `${barR} ${barG} ${barB} rg 14 ${(pageH - 12).toFixed(2)} 16 1.8 re f\n`;

  // Brand Row Dot
  streamContent += `0.11 0.31 0.85 rg 14 ${(pageH - 24).toFixed(2)} 4 4 re f\n`;
  streamContent += `0.22 0.74 0.97 rg 15 ${(pageH - 23).toFixed(2)} 2 2 re f\n`;

  // Brand Row Text
  const [l1R, l1G, l1B] = theme.pdfLine1;
  streamContent += `BT /F1 7 Tf ${l1R} ${l1G} ${l1B} rg 21 ${(pageH - 23.5).toFixed(2)} Td (NUMARATIK) Tj ET\n`;

  // Headline Line 1: 'ARAC SAHIBINE'
  streamContent += `BT /F1 11.5 Tf ${l1R} ${l1G} ${l1B} rg 14 ${(pageH - 39).toFixed(2)} Td (ARAC SAHIBINE) Tj ET\n`;

  // Headline Line 2: 'ULASIN'
  const [l2R, l2G, l2B] = theme.pdfLine2;
  streamContent += `BT /F1 11.5 Tf ${l2R} ${l2G} ${l2B} rg 14 ${(pageH - 51).toFixed(2)} Td (ULASIN) Tj ET\n`;

  // Subtitle: 'QR kodu okutun ve iletisim kurun.'
  const [sR, sG, sB] = theme.pdfSub;
  streamContent += `BT /F2 5.5 Tf ${sR} ${sG} ${sB} rg 14 ${(pageH - 60).toFixed(2)} Td (QR kodu okutun ve iletisim kurun.) Tj ET\n`;

  // White squircle badge for QR
  const pad = 10;
  streamContent += `1 1 1 rg ${(qrX - pad).toFixed(2)} ${(qrY - pad).toFixed(2)} ${(qrSize + pad * 2).toFixed(2)} ${(qrSize + pad * 2).toFixed(2)} re f\n`;

  // QR Vector Modules in Black
  streamContent += "0 0 0 rg\n";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c)) {
        const x = qrX + c * modSize;
        const y = qrY + (count - 1 - r) * modSize;
        streamContent += `${x.toFixed(2)} ${y.toFixed(2)} ${modSize.toFixed(2)} ${modSize.toFixed(2)} re f\n`;
      }
    }
  }

  // Bottom Phone Pill
  if (showPhone && formattedPhone) {
    const pillW = pageW - 28;
    const pillH = 20;
    const pillX = 14;
    const pillY = 16;

    const [pBgR, pBgG, pBgB] = theme.pdfPillBg;
    const [pBrR, pBrG, pBrB] = theme.pdfPillBorder;
    streamContent += `${pBgR} ${pBgG} ${pBgB} rg ${pillX.toFixed(2)} ${pillY.toFixed(2)} ${pillW.toFixed(2)} ${pillH.toFixed(2)} re f\n`;
    streamContent += `${pBrR} ${pBrG} ${pBrB} RG 1 w ${pillX.toFixed(2)} ${pillY.toFixed(2)} ${pillW.toFixed(2)} ${pillH.toFixed(2)} re S\n`;

    const [phR, phG, phB] = theme.pdfPhone;
    const cleanPhone = formattedPhone.replace(/[^\d+ ]/g, "");
    const phoneWidth = cleanPhone.length * 5.2;
    const phoneX = Math.max(16, (pageW - phoneWidth) / 2);
    streamContent += `BT /F1 9 Tf ${phR} ${phG} ${phB} rg ${phoneX.toFixed(2)} ${(pillY + 6.5).toFixed(2)} Td (${cleanPhone}) Tj ET\n`;
  }

  const streamLen = new TextEncoder().encode(streamContent).length;

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  function addObj(str) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += str;
  }

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  addObj(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`);
  addObj(`4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}endstream\nendobj\n`);
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");
  addObj("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export default function QRCardDesigner({
  slug = "arac",
  phone = null,
  displayName = "Araç",
  defaultShowPhone = true,
  defaultTheme = "dark",
  onFinish = null,
  finishButtonText = "Yönetim Paneline Git",
}) {
  const [showPhone, setShowPhone] = useState(defaultShowPhone);
  const [selectedThemeId, setSelectedThemeId] = useState(defaultTheme);
  const [publicUrl, setPublicUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  const activeTheme = CARD_THEMES.find((t) => t.id === selectedThemeId) || CARD_THEMES[0];
  const formattedPhone = phone ? formatDisplayPhone(phone) : "";

  // Derive static public URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const url = slug === "arac" ? `${origin}/` : `${origin}/c/${slug}`;

      // Generate raw SVG
      QRCode.toString(url, {
        type: "svg",
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })
        .then((svgString) => {
          setPublicUrl(url);
          setQrSvg(svgString);
        })
        .catch(() => {});
    }
  }, [slug]);

  // Render high-res canvas (1400 x 2200 px at 300 DPI for 70 x 110 mm)
  useEffect(() => {
    if (!publicUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 1400;
    const height = 2200;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = activeTheme.cardBg;
    ctx.fillRect(0, 0, width, height);

    // Subtle border
    ctx.strokeStyle = activeTheme.borderColor;
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Top Accent Bar
    ctx.fillStyle = activeTheme.accentBar;
    ctx.beginPath();
    ctx.roundRect(90, 80, 110, 12, 6);
    ctx.fill();

    // Brand Row Dot
    ctx.fillStyle = activeTheme.dotOuter;
    ctx.beginPath();
    ctx.arc(104, 140, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeTheme.dotInner;
    ctx.beginPath();
    ctx.arc(104, 140, 7, 0, Math.PI * 2);
    ctx.fill();

    // Brand Text 'NUMARATİK'
    ctx.fillStyle = activeTheme.brandColor;
    ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("NUMARATİK", 136, 152);

    // Headline Line 1: 'ARAÇ SAHİBİNE'
    ctx.fillStyle = activeTheme.line1Color;
    ctx.font = "900 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("ARAÇ SAHİBİNE", 90, 245);

    // Headline Line 2: 'ULAŞIN'
    ctx.fillStyle = activeTheme.headerColor;
    ctx.fillText("ULAŞIN", 90, 325);

    // Subtitle: 'QR kodu okutun ve iletişim kurun.'
    ctx.fillStyle = activeTheme.subColor;
    ctx.font = "500 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("QR kodu okutun ve iletişim kurun.", 90, 385);

    // Draw White Squircle Badge for QR
    const squircleSize = showPhone ? 980 : 1100;
    const squircleX = (width - squircleSize) / 2;
    const squircleY = showPhone ? 440 : 510;

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(squircleX, squircleY, squircleSize, squircleSize, 70);
    ctx.fill();

    // Draw QR code onto canvas inside squircle
    const qrInnerPadding = 70;
    const qrSize = squircleSize - qrInnerPadding * 2;
    const qrX = squircleX + qrInnerPadding;
    const qrY = squircleY + qrInnerPadding;

    const tempCanvas = document.createElement("canvas");
    QRCode.toCanvas(tempCanvas, publicUrl, {
      width: qrSize,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then(() => {
        ctx.drawImage(tempCanvas, qrX, qrY, qrSize, qrSize);

        // Bottom Phone Pill
        if (showPhone && formattedPhone) {
          const pillW = 1220;
          const pillH = 140;
          const pillX = (width - pillW) / 2;
          const pillY = squircleY + squircleSize + 75;

          // Pill Background
          ctx.fillStyle = activeTheme.pillBg;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, 70);
          ctx.fill();

          // Pill Border
          ctx.strokeStyle = activeTheme.pillBorder;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, 70);
          ctx.stroke();

          // Phone Text
          ctx.fillStyle = activeTheme.textColor;
          ctx.font = "bold 60px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace";
          ctx.textAlign = "center";
          ctx.fillText(formattedPhone, width / 2, pillY + 92);
        }
      })
      .catch(() => {});
  }, [publicUrl, showPhone, formattedPhone, activeTheme]);

  // PNG Download
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `numaratik-${slug}-${activeTheme.id}-7x11cm.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  // SVG Download (pure vector with exact layout)
  const handleDownloadSVG = () => {
    if (!publicUrl) return;

    const qr = QRCode.create(publicUrl, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    const viewBoxW = 700;
    const viewBoxH = 1100;

    const sqSize = showPhone ? 490 : 550;
    const sqX = (viewBoxW - sqSize) / 2;
    const sqY = showPhone ? 220 : 255;

    const qrPadding = 35;
    const qrSize = sqSize - qrPadding * 2;
    const qrX = sqX + qrPadding;
    const qrY = sqY + qrPadding;
    const modSize = qrSize / count;

    let pathD = "";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          const x = (qrX + c * modSize).toFixed(1);
          const y = (qrY + r * modSize).toFixed(1);
          const s = modSize.toFixed(1);
          pathD += `M${x},${y}h${s}v${s}h-${s}z `;
        }
      }
    }

    const pillSvgPart =
      showPhone && formattedPhone
        ? `<rect x="45" y="${sqY + sqSize + 38}" width="610" height="70" rx="35" fill="${activeTheme.pillBg}" stroke="${activeTheme.pillBorder}" stroke-width="3" />
           <text x="350" y="${sqY + sqSize + 83}" font-family="monospace, sans-serif" font-size="30" font-weight="bold" fill="${activeTheme.textColor}" text-anchor="middle" letter-spacing="1">${formattedPhone}</text>`
        : "";

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxW} ${viewBoxH}" width="70mm" height="110mm">
  <!-- Card Background -->
  <rect width="${viewBoxW}" height="${viewBoxH}" fill="${activeTheme.cardBg}" />
  <rect x="8" y="8" width="${viewBoxW - 16}" height="${viewBoxH - 16}" fill="none" stroke="${activeTheme.borderColor}" stroke-width="6" rx="24" />

  <!-- Top Accent Bar -->
  <rect x="45" y="40" width="55" height="6" rx="3" fill="${activeTheme.accentBar}" />

  <!-- Brand Row -->
  <circle cx="53" cy="70" r="8" fill="${activeTheme.dotOuter}" />
  <circle cx="53" cy="70" r="4" fill="${activeTheme.dotInner}" />
  <text x="70" y="76" font-family="sans-serif" font-size="17" font-weight="bold" fill="${activeTheme.brandColor}" letter-spacing="1.5">NUMARATİK</text>

  <!-- Headline -->
  <text x="45" y="122" font-family="sans-serif" font-size="31" font-weight="900" fill="${activeTheme.line1Color}">ARAÇ SAHİBİNE</text>
  <text x="45" y="160" font-family="sans-serif" font-size="31" font-weight="900" fill="${activeTheme.headerColor}">ULAŞIN</text>
  <text x="45" y="188" font-family="sans-serif" font-size="15" font-weight="500" fill="${activeTheme.subColor}">QR kodu okutun ve iletişim kurun.</text>

  <!-- White Squircle Badge -->
  <rect x="${sqX}" y="${sqY}" width="${sqSize}" height="${sqSize}" rx="36" fill="#FFFFFF" />

  <!-- QR Modules -->
  <path d="${pathD}" fill="#000000" />

  <!-- Bottom Phone Pill -->
  ${pillSvgPart}
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numaratik-${slug}-${activeTheme.id}-7x11cm.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF Download (pure vector 70 x 110 mm with theme)
  const handleDownloadPDF = () => {
    if (!publicUrl) return;
    const blob = buildCardPdfBlob(publicUrl, formattedPhone, showPhone, activeTheme);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numaratik-${slug}-${activeTheme.id}-baski-7x11cm.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Hidden high-res canvas for PNG generation */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Interactive Card Preview (7 x 11 cm Aspect Ratio) */}
      <div className="flex flex-col items-center">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#98A2B3] mb-2">
          Baskı Önizlemesi (7 × 11 cm)
        </div>

        {/* The Card Box matching user's template */}
        <div
          className="relative w-[220px] h-[345px] rounded-[22px] p-3.5 shadow-2xl flex flex-col justify-between select-none transition-colors duration-200 overflow-hidden text-left"
          style={{
            backgroundColor: activeTheme.cardBg,
            borderColor: activeTheme.borderColor,
            borderWidth: 1.5,
            borderStyle: "solid",
          }}
        >
          {/* Top Header Section */}
          <div className="flex flex-col items-start w-full">
            {/* Top Accent Bar */}
            <div
              className="w-10 h-1 rounded-full mb-2"
              style={{ backgroundColor: activeTheme.accentBar }}
            />

            {/* Brand Row */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
                  style={{ backgroundColor: activeTheme.dotInner }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2 ring-2"
                  style={{
                    backgroundColor: activeTheme.dotInner,
                    borderColor: activeTheme.dotOuter,
                  }}
                />
              </span>
              <span
                className="text-[10px] font-extrabold tracking-widest uppercase"
                style={{ color: activeTheme.brandColor }}
              >
                NUMARATİK
              </span>
            </div>

            {/* Headline (Two Lines) */}
            <div className="leading-[1.15] mb-1">
              <span
                className="block text-[14px] font-black tracking-tight"
                style={{ color: activeTheme.line1Color }}
              >
                ARAÇ SAHİBİNE
              </span>
              <span
                className="block text-[14px] font-black tracking-tight"
                style={{ color: activeTheme.headerColor }}
              >
                ULAŞIN
              </span>
            </div>

            {/* Subtitle */}
            <span
              className="text-[8px] font-medium leading-tight"
              style={{ color: activeTheme.subColor }}
            >
              QR kodu okutun ve iletişim kurun.
            </span>
          </div>

          {/* QR Code Container (White Squircle) */}
          <div className="w-full flex items-center justify-center my-auto py-1">
            <div
              className={`flex items-center justify-center p-2.5 rounded-[18px] bg-white shadow-xl ${
                showPhone ? "w-[145px] h-[145px]" : "w-[160px] h-[160px]"
              }`}
            >
              {qrSvg ? (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-lg animate-pulse" />
              )}
            </div>
          </div>

          {/* Card Footer (Phone Pill or Scan message) */}
          {showPhone && formattedPhone ? (
            <div
              className="w-full py-2 px-3 rounded-xl flex items-center justify-center text-center shadow-inner"
              style={{
                backgroundColor: activeTheme.pillBg,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: activeTheme.pillBorder,
              }}
            >
              <span
                className="text-[11.5px] font-bold font-mono tracking-wider"
                style={{ color: activeTheme.textColor }}
              >
                {formattedPhone}
              </span>
            </div>
          ) : (
            <div className="w-full text-center pb-0.5">
              <span
                className="text-[8.5px] font-medium"
                style={{ color: activeTheme.subColor }}
              >
                Kameranızla okutun
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Theme Selector Pills */}
      <div className="w-full max-w-[340px] flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-[#98A2B3] px-1">
          Kart Rengi & Tasarımı
        </span>
        <div className="grid grid-cols-2 gap-2">
          {CARD_THEMES.map((t) => {
            const isSelected = t.id === selectedThemeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedThemeId(t.id)}
                className={`py-2 px-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  isSelected
                    ? "bg-white/[0.08] border-[#3B82F6] text-[#F7F9FC] shadow-sm ring-1 ring-[#3B82F6]/50"
                    : "bg-[#0E131C] border-white/[0.06] text-[#98A2B3] hover:text-[#F7F9FC] hover:border-white/[0.12]"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${t.accentDot}`} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate">{t.name}</span>
                  <span className="text-[10px] text-[#98A2B3]/70 truncate">{t.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle Option */}
      <div className="w-full max-w-[340px] p-3.5 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex flex-col gap-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-medium text-[#F7F9FC]">
            Telefon numaram QR kodun altında görünsün
          </span>
          <input
            type="checkbox"
            checked={showPhone}
            onChange={(e) => setShowPhone(e.target.checked)}
            className="w-4 h-4 rounded accent-[#3B82F6] cursor-pointer"
          />
        </label>

        {showPhone && (
          <div className="flex items-start gap-2 pt-2 border-t border-white/[0.05] text-[10px] text-[#98A2B3] leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Telefon numaranızı daha sonra değiştirdiğinizde QR kodunuz çalışmaya devam eder.
              Ancak basılı kartta yazan telefon numarası değişmeyeceği için yeni çıktı almanız gerekir.
            </span>
          </div>
        )}
      </div>

      {/* Download Action Buttons */}
      <div className="w-full max-w-[340px] flex flex-col gap-2">
        <button
          type="button"
          onClick={handleDownloadPDF}
          className="w-full py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          <FileText className="w-4 h-4" />
          <span>7 × 11 cm Baskı PDF’i İndir</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownloadPNG}
            className="py-2.5 px-3 rounded-xl bg-[#0E131C] border border-white/[0.08] hover:bg-white/[0.05] text-xs font-medium text-[#F7F9FC] flex items-center justify-center gap-1.5 transition-all"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>PNG İndir</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSVG}
            className="py-2.5 px-3 rounded-xl bg-[#0E131C] border border-white/[0.08] hover:bg-white/[0.05] text-xs font-medium text-[#F7F9FC] flex items-center justify-center gap-1.5 transition-all"
          >
            <QrCode className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>Vektörel SVG</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full py-2 px-3 rounded-xl bg-transparent border border-white/[0.05] hover:bg-white/[0.03] text-[11px] text-[#98A2B3] hover:text-[#F7F9FC] flex items-center justify-center gap-1.5 transition-all mt-1"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Adres Kopyalandı!" : "QR Hedef Bağlantısını Kopyala"}</span>
        </button>
      </div>

      {/* Completion Button (if supplied) */}
      {onFinish && (
        <div className="w-full max-w-[340px] pt-2">
          <button
            type="button"
            onClick={onFinish}
            className="w-full py-3 px-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-[#F7F9FC] text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2"
          >
            <span>{finishButtonText}</span>
          </button>
        </div>
      )}
    </div>
  );
}
