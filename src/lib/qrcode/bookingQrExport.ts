export interface BookingQrUrlOptions {
  slug: string;
  baseUrl?: string;
  staffId?: string | null;
}

export interface CounterPlacardPrintOptions {
  shopName: string;
  bookingUrl: string;
  svgMarkup: string;
  barberName?: string | null;
  primaryColor?: string;
  slogan?: string | null;
  address?: string | null;
}

export function resolvePublicBookingBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl && explicitBaseUrl.trim()) {
    return explicitBaseUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${window.location.pathname || ''}`.replace(/\/+$/, '');
  }
  return 'https://barber.soumanager.com';
}

export function buildTenantPublicBookingUrl(options: BookingQrUrlOptions): string {
  const cleanSlug = (options.slug || 'sua-barbearia').trim().replace(/^\/+|\/+$/g, '');
  const base = resolvePublicBookingBaseUrl(options.baseUrl);
  const cleanStaffId = options.staffId?.trim();

  if (cleanStaffId && cleanStaffId !== 'all' && cleanStaffId !== 'any') {
    return `${base}/#/agendar/${encodeURIComponent(cleanSlug)}?staff=${encodeURIComponent(cleanStaffId)}`;
  }

  return `${base}/#/agendar/${encodeURIComponent(cleanSlug)}`;
}

export function serializeSvgElement(svgElement: SVGSVGElement): string {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  return new XMLSerializer().serializeToString(clone);
}

export async function downloadQrSvgAsPng(
  svgElement: SVGSVGElement,
  filename: string,
  sizePx = 1024,
  paddingPx = 96,
): Promise<void> {
  const svgMarkup = serializeSvgElement(svgElement);
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Falha ao converter QR Code para PNG.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexto 2D indisponível para exportar PNG.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sizePx, sizePx);

    const qrDrawSize = sizePx - paddingPx * 2;
    ctx.drawImage(img, paddingPx, paddingPx, qrDrawSize, qrDrawSize);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCounterPlacardHtml(options: CounterPlacardPrintOptions): string {
  const shopName = escapeHtml(options.shopName.trim() || 'Barbearia');
  const bookingUrl = escapeHtml(options.bookingUrl.trim());
  const barberName = options.barberName?.trim() ? escapeHtml(options.barberName.trim()) : null;
  const slogan = options.slogan?.trim() ? escapeHtml(options.slogan.trim()) : null;
  const address = options.address?.trim() ? escapeHtml(options.address.trim()) : null;
  const accent = /^#[0-9A-Fa-f]{6}$/.test(options.primaryColor || '')
    ? (options.primaryColor as string)
    : '#B88A44';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Placa de Agendamento Online — ${shopName}</title>
  <style>
    @page {
      size: A5 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0a0a0a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .placard {
      width: 100%;
      max-width: 460px;
      background: #111111;
      border: 2px solid ${accent};
      border-radius: 28px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(184, 138, 68, 0.16);
      border: 1px solid ${accent};
      color: ${accent};
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .shop-name {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #ffffff;
      line-height: 1.15;
    }
    .slogan {
      font-size: 13px;
      color: #a3a3a3;
      margin-top: 6px;
    }
    .barber-pill {
      display: inline-block;
      margin-top: 12px;
      padding: 6px 16px;
      border-radius: 12px;
      background: #1c1c1c;
      border: 1px solid #333333;
      color: #f5f5f5;
      font-size: 13px;
      font-weight: 700;
    }
    .barber-pill strong {
      color: ${accent};
    }
    .qr-box {
      background: #ffffff;
      padding: 22px;
      border-radius: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 24px auto;
      border: 4px solid ${accent};
    }
    .qr-box svg {
      width: 220px !important;
      height: 220px !important;
      display: block;
    }
    .cta-title {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .cta-sub {
      font-size: 13px;
      color: #d4d4d4;
      line-height: 1.4;
      max-width: 320px;
      margin: 0 auto 18px;
    }
    .url-chip {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      color: ${accent};
      background: #171717;
      border: 1px solid #262626;
      padding: 8px 12px;
      border-radius: 10px;
      word-break: break-all;
    }
    .address {
      font-size: 11px;
      color: #8a8a8a;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="placard">
    <div class="badge">Agendamento Online</div>
    <h1 class="shop-name">${shopName}</h1>
    ${slogan ? `<p class="slogan">${slogan}</p>` : ''}
    ${
      barberName
        ? `<div class="barber-pill">Profissional: <strong>${barberName}</strong></div>`
        : ''
    }
    <div class="qr-box">
      ${options.svgMarkup}
    </div>
    <p class="cta-title">Aponte a câmera do celular</p>
    <p class="cta-sub">Escolha seu serviço e horário em segundos, direto pelo WhatsApp, sem precisar de senha.</p>
    <div class="url-chip">${bookingUrl}</div>
    ${address ? `<p class="address">${address}</p>` : ''}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;
}

export function printCounterPlacard(options: CounterPlacardPrintOptions): boolean {
  if (typeof window === 'undefined') return false;
  const popup = window.open('', '_blank', 'width=640,height=860,noopener,noreferrer');
  if (!popup) {
    return false;
  }
  const html = buildCounterPlacardHtml(options);
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
}
