// OData-V2-Antwortform (Entscheidung 17: SAP ECC, klassisches Gateway).
// Mit `XTS_ODATA=v2` liefert die Mock-API ihre Antworten so, wie SAP Gateway
// OData V2 sie in JSON ausgibt; die Fachlogik in routes.js bleibt unveraendert:
// - Listen `{ d: { results: [...], __count?, __next? } }` mit `$top`, `$skip`,
//   `$inlinecount=allpages` und optionaler Serverseitenung (XTS_ODATA_PAGE_SIZE)
// - Einzelobjekte `{ d: { __metadata, ... } }`
// - `Edm.Decimal` als String mit drei Nachkommastellen (QUAN 13,3)
// - `Edm.DateTime` als `/Date(ms)/`, `Edm.Time` als `PT08H30M00S`
// - Fehler `{ error: { code, message: { lang, value }, innererror } }`
// Feldklassen werden ueber Feldnamen bestimmt (siehe docs/odata-contracts.md).

export const DECIMAL_FIELDS = new Set([
  "hours",
  "totalHours",
  "orderedHours",
  "bookedHours",
  "remainingHours",
  "budgetHours",
  "consumedHours",
  "consumedPercent",
  "plannedHours",
  "purchaseOrderHours",
  "purchaseOrderPrice",
  "recordedHours",
  "approvedHours",
  "goodsReceiptHours",
  "pendingGoodsReceiptHours",
  "invoicedHours",
  "availableHours",
  "plannedTotal",
  "workHours",
  "requested",
  "remaining",
]);

export const DATE_FIELDS = new Set(["date", "validFrom", "validTo"]);

export const DATETIME_FIELDS = new Set([
  "at",
  "changedAt",
  "approvedAt",
  "resetAt",
]);

export const TIME_FIELDS = new Set(["startTime", "endTime"]);

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T/;
const CLOCK = /^(\d{2}):(\d{2})$/;

export function toV2Value(key, value) {
  if (Array.isArray(value)) {
    return value.map((item) => toV2Value(key, item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field,
        toV2Value(field, item),
      ]),
    );
  }
  if (typeof value === "number" && DECIMAL_FIELDS.has(key)) {
    return value.toFixed(3);
  }
  if (typeof value === "string") {
    const day = DATE_FIELDS.has(key) ? ISO_DAY.exec(value) : null;
    if (day) {
      return `/Date(${Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))})/`;
    }
    if (DATETIME_FIELDS.has(key) && ISO_STAMP.test(value)) {
      const ms = Date.parse(value);
      if (Number.isFinite(ms)) return `/Date(${ms})/`;
    }
    const clock = TIME_FIELDS.has(key) ? CLOCK.exec(value) : null;
    if (clock) return `PT${clock[1]}H${clock[2]}M00S`;
  }
  return value;
}

function entitySetOf(url) {
  return url.pathname.replace(/^\/odata\//, "").split("/")[0] || "Entity";
}

export function toV2Entity(entity, entitySet) {
  return {
    __metadata: { type: `xTS.${entitySet}` },
    ...toV2Value("", entity),
  };
}

function readCount(params, name) {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function toV2Collection(items, url, pageSize = 0) {
  const entitySet = entitySetOf(url);
  const skip = readCount(url.searchParams, "$skip") ?? 0;
  const top = readCount(url.searchParams, "$top");
  const limits = [top, pageSize > 0 ? pageSize : null].filter(
    (limit) => limit !== null,
  );
  const window = limits.length > 0 ? Math.min(...limits) : items.length;
  const page = items.slice(skip, skip + window);
  const d = { results: page.map((item) => toV2Entity(item, entitySet)) };
  if (url.searchParams.get("$inlinecount") === "allpages") {
    d.__count = String(items.length);
  }
  const remainingTop = top === null ? null : top - page.length;
  const hasMore =
    skip + page.length < items.length &&
    (remainingTop === null || remainingTop > 0);
  if (hasMore) {
    const next = new URL(url);
    next.searchParams.set("$skip", String(skip + page.length));
    if (remainingTop !== null)
      next.searchParams.set("$top", String(remainingTop));
    d.__next = next.toString();
  }
  return { d };
}

export function toV2Error(payload) {
  const { error, message, ...innererror } = payload;
  const code = typeof error === "string" ? error : "UNKNOWN";
  return {
    error: {
      code,
      message: {
        lang: "de",
        value: typeof message === "string" ? message : code,
      },
      innererror,
    },
  };
}

/**
 * Formt ein Ergebnis von `routeRequest` in die OData-V2-Form um. Pfade
 * ausserhalb `/odata/` (z. B. `/health`) und Nicht-JSON bleiben unveraendert.
 */
export function toODataV2(result, request, options = {}) {
  const host = request.headers?.host ?? "127.0.0.1:4010";
  const url = new URL(request.url ?? "/", `http://${host}`);
  if (!url.pathname.startsWith("/odata/")) return result;
  const contentType = String(result.headers?.["content-type"] ?? "");
  if (!contentType.includes("application/json")) return result;
  let payload;
  try {
    payload = JSON.parse(result.body);
  } catch {
    return result;
  }
  if (!payload || typeof payload !== "object") return result;
  let shaped;
  if (result.status >= 400) {
    shaped = toV2Error(payload);
  } else if (Array.isArray(payload.value)) {
    shaped = toV2Collection(payload.value, url, options.pageSize ?? 0);
  } else {
    shaped = { d: toV2Entity(payload, entitySetOf(url)) };
  }
  return { ...result, body: JSON.stringify(shaped) };
}
