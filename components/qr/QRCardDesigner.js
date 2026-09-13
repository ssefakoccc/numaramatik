"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, Eye, QrCode, AlertCircle, FileText, Image as ImageIcon } from "lucide-react";
import { formatDisplayPhone } from "@/lib/phone";

/**
 * Pure vector PDF generator for 70 x 110 mm (7 x 11 cm) card.
 */
function buildCardPdfBlob(qrUrl, formattedPhone, showPhone) {
  const qr = QRCode.create(qrUrl, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;

  // 70 mm x 110 mm in points (1 pt = 25.4 / 72 mm = 0.352778 mm)
  const pageW = 198.43;
  const pageH = 311.81;

  const qrSize = showPhone ? 124 : 148;
  const qrX = (pageW - qrSize) / 2;
  const qrY = showPhone ? (pageH - qrSize) / 2 + 10 : (pageH - qrSize) / 2;
  const modSize = qrSize / count;

  let streamContent = "";

  // White Background
  streamContent += `1 1 1 rg 0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} re f\n`;

  // Header Title 'NUMARATIK'
  streamContent += `BT /F1 10 Tf 0.05 0.05 0.05 rg ${(pageW / 2 - 32).toFixed(2)} ${(pageH - 36).toFixed(2)} Td (NUMARATIK) Tj ET\n`;
  streamContent += `BT /F2 6.5 Tf 0.45 0.45 0.45 rg ${(pageW / 2 - 42).toFixed(2)} ${(pageH - 47).toFixed(2)} Td (Guvenli Arac Iletisimi) Tj ET\n`;

  // Draw QR vector modules in solid black
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

  // Footer text
  if (showPhone && formattedPhone) {
    const cleanPhone = formattedPhone.replace(/[^\d+ ]/g, "");
    const phoneWidth = cleanPhone.length * 6;
    const phoneX = Math.max(10, (pageW - phoneWidth) / 2);
    streamContent += `BT /F1 11 Tf 0.05 0.05 0.05 rg ${phoneX.toFixed(2)} ${(qrY - 22).toFixed(2)} Td (${cleanPhone}) Tj ET\n`;
    streamContent += `BT /F2 6 Tf 0.45 0.45 0.45 rg ${(pageW / 2 - 38).toFixed(2)} ${(qrY - 33).toFixed(2)} Td (Kameranizla okutun) Tj ET\n`;
  } else {
    streamContent += `BT /F2 7 Tf 0.4 0.4 0.4 rg ${(pageW / 2 - 38).toFixed(2)} ${(qrY - 24).toFixed(2)} Td (Kameranizla okutun) Tj ET\n`;
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
  onFinish = null,
  finishButtonText = "Yönetim Paneline Git",
}) {
  const [showPhone, setShowPhone] = useState(defaultShowPhone);
  const [publicUrl, setPublicUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

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
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    // Subtle border
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Header Title
    ctx.fillStyle = "#111827";
    ctx.font = "bold 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NUMARATİK", width / 2, 220);

    // Header Subtitle
    ctx.fillStyle = "#6B7280";
    ctx.font = "500 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Güvenli Araç İletişimi", width / 2, 280);

    // Draw QR code onto canvas
    const qrCanvasSize = showPhone ? 920 : 1060;
    const qrY = showPhone ? 380 : 480;

    const tempCanvas = document.createElement("canvas");
    QRCode.toCanvas(tempCanvas, publicUrl, {
      width: qrCanvasSize,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then(() => {
        const qrX = (width - qrCanvasSize) / 2;
        ctx.drawImage(tempCanvas, qrX, qrY, qrCanvasSize, qrCanvasSize);

        // Footer
        if (showPhone && formattedPhone) {
          ctx.fillStyle = "#111827";
          ctx.font = "bold 78px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace";
          ctx.textAlign = "center";
          ctx.fillText(formattedPhone, width / 2, qrY + qrCanvasSize + 140);

          ctx.fillStyle = "#6B7280";
          ctx.font = "500 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText("Kameranızla okutun veya arayın", width / 2, qrY + qrCanvasSize + 210);
        } else {
          ctx.fillStyle = "#6B7280";
          ctx.font = "500 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Kameranızla okutun", width / 2, qrY + qrCanvasSize + 170);
        }
      })
      .catch(() => {});
  }, [publicUrl, showPhone, formattedPhone]);

  // PNG Download
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `numaratik-${slug}-7x11cm.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  // SVG Download (pure vector)
  const handleDownloadSVG = () => {
    if (!publicUrl) return;

    const qr = QRCode.create(publicUrl, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    const viewBoxW = 700;
    const viewBoxH = 1100;

    const qrSize = showPhone ? 460 : 530;
    const qrX = (viewBoxW - qrSize) / 2;
    const qrY = showPhone ? 190 : 240;
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

    const phoneSvgPart =
      showPhone && formattedPhone
        ? `<text x="350" y="${qrY + qrSize + 70}" font-family="monospace" font-size="38" font-weight="bold" fill="#111827" text-anchor="middle">${formattedPhone}</text>
           <text x="350" y="${qrY + qrSize + 105}" font-family="sans-serif" font-size="18" fill="#6B7280" text-anchor="middle">Kameranızla okutun veya arayın</text>`
        : `<text x="350" y="${qrY + qrSize + 80}" font-family="sans-serif" font-size="20" fill="#6B7280" text-anchor="middle">Kameranızla okutun</text>`;

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxW} ${viewBoxH}" width="70mm" height="110mm">
  <rect width="${viewBoxW}" height="${viewBoxH}" fill="#FFFFFF" />
  <rect x="8" y="8" width="${viewBoxW - 16}" height="${viewBoxH - 16}" fill="none" stroke="#E5E7EB" stroke-width="6" rx="24" />
  <text x="350" y="110" font-family="sans-serif" font-size="32" font-weight="bold" fill="#111827" text-anchor="middle">NUMARATİK</text>
  <text x="350" y="140" font-family="sans-serif" font-size="19" fill="#6B7280" text-anchor="middle">Güvenli Araç İletişimi</text>
  <path d="${pathD}" fill="#000000" />
  ${phoneSvgPart}
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numaratik-${slug}-7x11cm.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF Download (pure vector 70 x 110 mm)
  const handleDownloadPDF = () => {
    if (!publicUrl) return;
    const blob = buildCardPdfBlob(publicUrl, formattedPhone, showPhone);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numaratik-${slug}-baski-7x11cm.pdf`;
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

        <div className="relative w-[210px] h-[330px] rounded-[18px] bg-white text-black p-4 shadow-2xl flex flex-col items-center justify-between border border-gray-200 select-none">
          {/* Card Header */}
          <div className="flex flex-col items-center pt-2">
            <span className="text-[13px] font-extrabold tracking-wider text-black">
              NUMARATİK
            </span>
            <span className="text-[9px] text-gray-500 font-medium -mt-0.5">
              Güvenli Araç İletişimi
            </span>
          </div>

          {/* QR Code Container */}
          <div
            className={`flex items-center justify-center p-2 rounded-xl bg-white border border-gray-100 ${
              showPhone ? "w-[150px] h-[150px]" : "w-[174px] h-[174px]"
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

          {/* Card Footer */}
          <div className="flex flex-col items-center pb-2 text-center">
            {showPhone && formattedPhone ? (
              <>
                <span className="text-[13px] font-bold text-gray-900 font-mono tracking-tight">
                  {formattedPhone}
                </span>
                <span className="text-[8px] text-gray-500 mt-0.5">
                  Kameranızla okutun veya arayın
                </span>
              </>
            ) : (
              <span className="text-[9px] text-gray-500 font-medium">
                Kameranızla okutun
              </span>
            )}
          </div>
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
