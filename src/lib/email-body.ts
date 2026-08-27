import { parse, NodeType, type HTMLElement, type Node } from "node-html-parser";

/**
 * Turning an email into something readable: a marketing email is nested layout
 * tables written for a 2003 renderer, so we keep only what carries meaning —
 * headings, paragraphs, lists, links, quoted replies — as {@link Block}s in the
 * app's own typography. Layout is dropped on purpose; the original is one tap
 * away in Gmail.
 */

/** A stretch of text, optionally a link. */
export type Run = { text: string; href?: string };

export type Block = {
  kind: "paragraph" | "heading" | "listItem" | "rule" | "image" | "code";
  /** Text kinds only. May contain newlines, which the page preserves. */
  runs?: Run[];
  /** `code` only — kept verbatim. */
  text?: string;
  /** `heading` only, 1–3. */
  level?: number;
  /** `listItem` only: "•" or "3.". */
  marker?: string;
  /** `image` only. */
  src?: string;
  alt?: string;
  /** Inside a blockquote or a Gmail reply chain, so the page can fold it away. */
  quoted?: boolean;
};

export type ReadableBody = {
  blocks: Block[];
  /** True when the email was longer than {@link MAX_BLOCKS}. */
  truncated: boolean;
  /** Which part we ended up reading. */
  source: "html" | "text" | "none";
};

const MAX_BLOCKS = 160;

/** Never carries reader-facing text. */
const IGNORED = new Set([
  "script", "style", "head", "title", "meta", "link", "noscript", "iframe",
  "object", "embed", "svg", "canvas", "video", "audio", "map", "area",
  "template", "input", "select", "textarea", "col", "colgroup",
]);

/** Ends the current block on the way in and on the way out. */
const BLOCK_LEVEL = new Set([
  "p", "div", "table", "tr", "tbody", "thead", "tfoot", "ul", "ol", "dl", "dt",
  "dd", "section", "article", "header", "footer", "main", "aside", "nav",
  "figure", "figcaption", "form", "center", "address", "fieldset", "hgroup",
]);

const HEADINGS: Record<string, number> = {
  h1: 1, h2: 1, h3: 2, h4: 2, h5: 3, h6: 3,
};

/** Invisible characters email uses to pad preheaders out to the right length. */
const INVISIBLE = /[\u200B-\u200F\u2028\u2029\u2060\u00AD\uFEFF]/g;

/** A block of only punctuation or box-drawing filler is decoration, not text. */
const DECORATIVE = /^[\s\p{P}\p{S}]*$/u;

function blockText(block: Block) {
  return (block.runs ?? []).map((run) => run.text).join("");
}

/** Only schemes that make sense to open from a mail reader. */
function safeHref(value: string | undefined) {
  if (!value) return undefined;
  const href = value.trim().replace(INVISIBLE, "");
  if (!/^(https?:|mailto:|tel:)/i.test(href)) return undefined;
  return href;
}

/**
 * Assembles blocks from a stream of text and breaks. Inline runs accumulate
 * until something block-level flushes them.
 */
class BlockBuilder {
  blocks: Block[] = [];
  private runs: Run[] = [];
  private href: string | undefined;
  private quoteDepth = 0;

  get quoted() {
    return this.quoteDepth > 0;
  }

  enterQuote() {
    this.flush();
    this.quoteDepth++;
  }

  exitQuote() {
    this.flush();
    this.quoteDepth--;
  }

  link<T>(href: string | undefined, body: () => T) {
    const previous = this.href;
    this.href = href ?? previous;
    body();
    this.href = previous;
  }

  /**
   * Text as HTML means it: every run of whitespace, source newlines included,
   * is one space. Only `<br>` puts a line break in.
   */
  text(value: string) {
    const cleaned = value
      .replace(INVISIBLE, "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ");
    if (cleaned) this.append(cleaned);
  }

  /** `<br>` — a break inside the block, not a new one. */
  lineBreak() {
    if (this.runs.length) this.append("\n");
  }

  space() {
    if (this.runs.length) this.append(" ");
  }

  private append(text: string) {
    const last = this.runs.at(-1);
    if (last && last.href === this.href) last.text += text;
    else this.runs.push({ text, href: this.href });
  }

  push(block: Omit<Block, "quoted">) {
    if (this.blocks.length >= MAX_BLOCKS) return;
    this.blocks.push(this.quoted ? { ...block, quoted: true } : block);
  }

  /** Close the open block, dropping it when nothing readable landed in it. */
  flush(kind: Block["kind"] = "paragraph", extra: Partial<Block> = {}) {
    const runs = this.runs;
    this.runs = [];
    if (!runs.length) return;

    // Trim the edges of the block without losing the spacing inside it.
    if (runs[0]) runs[0].text = runs[0].text.replace(/^\s+/, "");
    const last = runs.at(-1);
    if (last) last.text = last.text.replace(/\s+$/, "");

    const kept = runs.filter((run) => run.text.length > 0);
    if (!kept.length) return;

    // Three blank lines in a row is spacing, not structure.
    for (const run of kept) run.text = run.text.replace(/\n{3,}/g, "\n\n");

    const text = kept.map((run) => run.text).join("");
    // Keep a bare link even when its text is a bullet or an arrow.
    if (DECORATIVE.test(text) && !kept.some((run) => run.href)) return;

    const previous = this.blocks.at(-1);
    // Emails repeat themselves — the same CTA as text and again as an image
    // caption, "view in browser" twice over. Consecutive twins add nothing.
    if (previous?.kind === kind && blockText(previous) === text) return;

    this.push({ kind, runs: kept, ...extra });
  }
}

function styleOf(element: HTMLElement) {
  return (element.getAttribute("style") ?? "").replace(/\s+/g, "").toLowerCase();
}

/**
 * Preheader text — the line a client shows next to the subject — is hidden in
 * the body with any of a dozen tricks. All of them mean "not for the reader".
 */
function isHidden(element: HTMLElement) {
  if (element.getAttribute("hidden") !== undefined) return true;
  if (element.getAttribute("aria-hidden") === "true") return true;

  // Whitespace is already gone, so `;` and the ends of the string are the
  // property boundaries. Anchoring on them is what keeps `line-height:0` — a
  // spacing trick on perfectly visible content — from reading as hidden.
  const style = styleOf(element);
  if (
    /(^|;)display:none/.test(style) ||
    /(^|;)visibility:hidden/.test(style) ||
    /(^|;)opacity:0(?![.\d])/.test(style) ||
    /(^|;)(max-)?height:0(px|em|%)?(;|$)/.test(style) ||
    /(^|;)font-size:0(px|em|%)?(;|$)/.test(style) ||
    /(^|;)mso-hide:all/.test(style)
  ) {
    return true;
  }

  return /(^|[\s-])(preheader|preview-text|hidden)([\s-]|$)/.test(
    element.getAttribute("class") ?? "",
  );
}

/** Gmail wraps the message you replied to in one of these. */
function isQuote(element: HTMLElement, tag: string) {
  if (tag === "blockquote") return true;
  const attrs = `${element.getAttribute("class") ?? ""} ${element.getAttribute("id") ?? ""}`;
  return /gmail_quote|yahoo_quoted|moz-cite-prefix|OLK_SRC_BODY_SECTION/i.test(attrs);
}

function pixels(element: HTMLElement, attribute: "width" | "height") {
  const raw = element.getAttribute(attribute);
  if (raw && /^\d+(px)?$/i.test(raw.trim())) return Number.parseInt(raw, 10);
  // Anchored, so `max-width` and `line-height` aren't read as width/height.
  const match = styleOf(element).match(new RegExp(`(^|;)${attribute}:(\\d+)px`));
  return match ? Number.parseInt(match[2], 10) : null;
}

/**
 * Spacer gifs and open-tracking beacons look like images and carry nothing.
 * Anything explicitly tiny goes, as does a sizeless image whose URL admits
 * what it is for.
 */
function isDecorativeImage(element: HTMLElement, src: string) {
  const width = pixels(element, "width");
  const height = pixels(element, "height");
  if ((width !== null && width <= 4) || (height !== null && height <= 4)) return true;
  return /(^|[\W_])(spacer|shim|pixel|beacon|1x1|open\.(gif|png)|track(ing)?)([\W_]|$)/i.test(src);
}

/** The index of `item` among its `li` siblings, for an ordered list's number. */
function listPosition(item: HTMLElement) {
  const siblings = (item.parentNode?.childNodes ?? []).filter(
    (node) =>
      node.nodeType === NodeType.ELEMENT_NODE &&
      (node as HTMLElement).rawTagName?.toLowerCase() === "li",
  );
  return Math.max(1, siblings.indexOf(item) + 1);
}

function walk(node: Node, builder: BlockBuilder) {
  if (node.nodeType === NodeType.TEXT_NODE) {
    builder.text(node.text);
    return;
  }
  if (node.nodeType !== NodeType.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tag = element.rawTagName?.toLowerCase() ?? "";
  if (IGNORED.has(tag) || isHidden(element)) return;

  const children = () => {
    for (const child of element.childNodes) walk(child, builder);
  };

  // The parse root, and any fragment wrapper, carries no tag of its own.
  if (!tag) return children();

  if (tag === "br") return builder.lineBreak();

  if (tag === "hr") {
    builder.flush();
    return builder.push({ kind: "rule" });
  }

  if (tag === "img") {
    const src = element.getAttribute("src")?.trim() ?? "";
    // `cid:` points at an attachment we never fetched, `data:` is usually a
    // sliced-up layout. Neither survives on its own in the page.
    if (!/^https?:\/\//i.test(src) || isDecorativeImage(element, src)) return;
    builder.flush();
    return builder.push({
      kind: "image",
      src,
      alt: element.getAttribute("alt")?.trim() || "",
    });
  }

  if (tag === "a") {
    return builder.link(safeHref(element.getAttribute("href")), children);
  }

  if (tag === "pre") {
    builder.flush();
    const text = element.text.replace(INVISIBLE, "").trimEnd();
    if (text.trim()) builder.push({ kind: "code", text });
    return;
  }

  if (isQuote(element, tag)) {
    builder.enterQuote();
    children();
    builder.exitQuote();
    return;
  }

  const level = HEADINGS[tag];
  if (level) {
    builder.flush();
    children();
    return builder.flush("heading", { level });
  }

  if (tag === "li") {
    builder.flush();
    children();
    const ordered = element.parentNode?.rawTagName?.toLowerCase() === "ol";
    return builder.flush("listItem", {
      marker: ordered ? `${listPosition(element)}.` : "•",
    });
  }

  // A layout table's *rows* stack vertically, so a row ends a block; its cells
  // sit side by side on that row, so they only need a space between them.
  // Getting this pair right is what stops a nested-table email from coming out
  // as one word per line.
  if (tag === "td" || tag === "th") {
    children();
    return builder.space();
  }

  if (BLOCK_LEVEL.has(tag)) {
    builder.flush();
    children();
    builder.flush();
    return;
  }

  children(); // span, strong, em, font, small, label, u, b, i…
}

export function blocksFromHtml(html: string): Block[] {
  // The doctype is not markup the parser recognises, so it would otherwise
  // arrive as the email's first line of text.
  const root = parse(html.replace(/<!doctype[^>]*>/gi, ""), {
    // Drop the *contents* of these outright: CSS text read as prose is the
    // single worst thing a naive tag-stripper does to an email.
    blockTextElements: { script: false, style: false, noscript: false, pre: true },
  });

  const builder = new BlockBuilder();
  walk(root, builder);
  builder.flush();
  return builder.blocks;
}

const URL_PATTERN = /\b(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[^\s<>()@]+@[^\s<>()@]+\.[a-z]{2,})/gi;

/** Text kept as text, with bare URLs and addresses made tappable. */
function linkify(text: string): Run[] {
  const runs: Run[] = [];
  let index = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > index) runs.push({ text: text.slice(index, start) });

    // Trailing punctuation belongs to the sentence, not the URL.
    const raw = match[0].replace(/[.,;:!?)\]]+$/, "");
    const href = raw.includes("@") && !raw.includes("/")
      ? `mailto:${raw}`
      : raw.startsWith("www.")
        ? `https://${raw}`
        : raw;

    runs.push({ text: raw, href });
    index = start + raw.length;
  }

  if (index < text.length) runs.push({ text: text.slice(index) });
  return runs.length ? runs : [{ text }];
}

const TEXT_BULLET = /^\s{0,4}([-*•·]|\d{1,2}[.)])\s+/;
const TEXT_RULE = /^\s*([-_=*~]\s?){3,}$/;
/** Plain text wraps at ~72 columns, so a long line was wrapped, not ended. */
const WRAPPED_AT = 65;

/**
 * The text/plain alternative, which is only "plain" in the MIME sense: it
 * still has quote markers, hand-drawn bullets and hard wrapping to undo.
 */
export function blocksFromText(text: string): Block[] {
  const blocks: Block[] = [];
  let open: { lines: string[]; quoted: boolean; marker?: string } | null = null;

  // Kept explicit rather than clever: close the open block, keep it if it says
  // anything, and start fresh.
  const close = (current: typeof open) => {
    if (!current) return;
    const body = current.lines.join("\n").trim();
    if (!body || DECORATIVE.test(body)) return;
    if (blocks.length >= MAX_BLOCKS) return;
    blocks.push({
      kind: current.marker ? "listItem" : "paragraph",
      runs: linkify(body),
      ...(current.marker ? { marker: current.marker } : {}),
      ...(current.quoted ? { quoted: true } : {}),
    });
  };

  for (const raw of text.replace(/\r\n?/g, "\n").replace(INVISIBLE, "").split("\n")) {
    const quoted = /^\s*>+/.test(raw);
    const line = raw.replace(/^\s*>+\s?/, "").replace(/\u00a0/g, " ").trimEnd();

    if (!line.trim()) {
      close(open);
      open = null;
      continue;
    }

    if (TEXT_RULE.test(line)) {
      close(open);
      open = null;
      if (blocks.length < MAX_BLOCKS) blocks.push({ kind: "rule", ...(quoted ? { quoted: true } : {}) });
      continue;
    }

    const bullet = line.match(TEXT_BULLET);
    if (bullet || (open && open.quoted !== quoted)) {
      close(open);
      open = {
        lines: [bullet ? line.slice(bullet[0].length) : line],
        quoted,
        marker: bullet ? (/^\d/.test(bullet[1]) ? bullet[1] : "•") : undefined,
      };
      continue;
    }

    if (!open) {
      open = { lines: [line], quoted };
      continue;
    }

    // Unwrap: a full-width previous line means the sender's editor broke it,
    // so join with a space. A short one was a deliberate break — keep it.
    const previous = open.lines.at(-1) ?? "";
    if (previous.length >= WRAPPED_AT) open.lines[open.lines.length - 1] = `${previous} ${line}`;
    else open.lines.push(line);
  }

  close(open);
  return blocks;
}

/**
 * Every block as one plain string — what Claude reads, and nothing more.
 * Quoted blocks keep a `>` marker so the reply and the message it answers
 * don't read as one continuous email.
 */
export function plainText(blocks: Block[]) {
  return blocks
    .map((block) => {
      const body =
        block.kind === "rule"
          ? "---"
          : block.kind === "image"
            ? block.alt && `[image: ${block.alt}]`
            : block.kind === "code"
              ? block.text
              : block.kind === "listItem"
                ? `${block.marker ?? "-"} ${blockText(block)}`
                : blockText(block);

      if (!body) return "";
      return block.quoted ? body.replace(/^/gm, "> ") : body;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Is this a message someone typed, rather than a page someone designed? A real
 * exchange is worth showing under the summary; a newsletter is not, since what
 * made it readable is exactly what we threw away — the tells being pictures,
 * headings, length and a thicket of links.
 */
export function isConversational(body: ReadableBody) {
  const { blocks } = body;
  if (blocks.length === 0 || blocks.length > 30) return false;
  if (blocks.some((block) => block.kind === "image" || block.kind === "heading")) {
    return false;
  }

  const links = blocks.reduce(
    (count, block) => count + (block.runs ?? []).filter((run) => run.href).length,
    0,
  );
  if (links > 6) return false;

  return plainText(blocks).length <= 6000;
}

/** Prefer the HTML part: it carries the links and the structure. */
export function readableBody(html: string, text: string): ReadableBody {
  const fromHtml = html ? blocksFromHtml(html) : [];
  if (fromHtml.length) {
    return {
      blocks: fromHtml,
      truncated: fromHtml.length >= MAX_BLOCKS,
      source: "html",
    };
  }

  const fromText = text ? blocksFromText(text) : [];
  return {
    blocks: fromText,
    truncated: fromText.length >= MAX_BLOCKS,
    source: fromText.length ? "text" : "none",
  };
}
