// Client-side composer for Instagram-Story-sized shareable images with baked-in watermark.

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function drawCoverCropped(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > dr) {
    sw = img.height * dr; sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dr; sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export interface StoryComposeOpts {
  imageUrl: string;
  artistName: string;
  title: string;
  vibeLabel: string;
  score?: number | null;
}

/** Compose an Instagram-Story 1080x1920 PNG. Returns a Blob. */
export async function composeStoryImage(opts: StoryComposeOpts): Promise<Blob> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Backdrop gradient (dark navy → charcoal)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#050810");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Hero image area
  const pad = 48;
  const imgX = pad, imgY = 220, imgW = W - pad * 2, imgH = 1280;

  const img = await loadImage(opts.imageUrl);

  // Rounded rect clip
  const r = 32;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(imgX + r, imgY);
  ctx.arcTo(imgX + imgW, imgY, imgX + imgW, imgY + imgH, r);
  ctx.arcTo(imgX + imgW, imgY + imgH, imgX, imgY + imgH, r);
  ctx.arcTo(imgX, imgY + imgH, imgX, imgY, r);
  ctx.arcTo(imgX, imgY, imgX + imgW, imgY, r);
  ctx.closePath();
  ctx.clip();
  drawCoverCropped(ctx, img, imgX, imgY, imgW, imgH);
  ctx.restore();

  // Top eyebrow
  ctx.fillStyle = "#c9a86a";
  ctx.font = "600 28px 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`CURATED BY ARIA  ·  ${opts.vibeLabel.toUpperCase()}`, W / 2, 130);

  // Title / artist
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 64px 'Sora', 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "center";
  const titleLines = wrapText(ctx, opts.title || "New work", W - pad * 2);
  let ty = imgY + imgH + 110;
  for (const line of titleLines.slice(0, 2)) { ctx.fillText(line, W / 2, ty); ty += 76; }

  ctx.fillStyle = "#c9a86a";
  ctx.font = "italic 36px 'Sora', 'Space Grotesk', system-ui, serif";
  ctx.fillText(opts.artistName || "The Artist", W / 2, ty + 12);

  // Score chip
  if (typeof opts.score === "number") {
    const chipW = 420, chipH = 88;
    const chipX = (W - chipW) / 2, chipY = ty + 60;
    ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
    ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, chipH, 44);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#a7f3d0";
    ctx.font = "600 32px 'Space Grotesk', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Collector-Ready Score  ${opts.score}/100`, W / 2, chipY + chipH / 2 + 2);
    ctx.textBaseline = "alphabetic";
  }

  // Watermark bottom bar
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 30px 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Made with Art Identity AI", W / 2, H - 90);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "400 24px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillText("artidentityai.com  ·  Free Magic Makeover", W / 2, H - 50);

  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 0.95)!);
}

/** Compose a 1:1 watermarked share image (for feed / general sharing). */
export async function composeSquareShare(opts: StoryComposeOpts): Promise<Blob> {
  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(opts.imageUrl);
  drawCoverCropped(ctx, img, 0, 0, W, H);

  // Bottom gradient scrim for legibility
  const grad = ctx.createLinearGradient(0, H - 260, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - 260, W, 260);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px 'Sora', 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText((opts.title || "New work").slice(0, 40), 48, H - 130);
  ctx.fillStyle = "#c9a86a";
  ctx.font = "italic 30px 'Sora', system-ui, serif";
  ctx.fillText(opts.artistName || "The Artist", 48, H - 90);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 24px 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Made with Art Identity AI · artidentityai.com", W - 48, H - 50);

  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 0.95)!);
}

/** Share a blob via Web Share API (with files) if supported; otherwise trigger download. */
export async function shareOrDownload(blob: Blob, filename: string, text?: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "My Magic Makeover", text: text ?? "" });
      return "shared";
    } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
