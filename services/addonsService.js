export const USE_MOCK_DATA = true;
const STORAGE_KEY = 'admin_addons';
const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 250));

function readAddons() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(normalizeAddon) : [];
  } catch { return []; }
}
function normalizeAddon(addon) {
  return {
    ...addon,
    appliesTo: ['product', 'side', 'canvas'].includes(addon?.appliesTo) ? addon.appliesTo : 'product',
    perSide: Boolean(addon?.perSide),
    applicableProducts: Array.isArray(addon?.applicableProducts) ? addon.applicableProducts : [],
  };
}
function writeAddons(addons) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addons)); }
  catch (error) { console.error('No se pudieron guardar los extras en LocalStorage:', error); throw error; }
}

export async function getAddons() {
  if (USE_MOCK_DATA) return delay(readAddons());
  // return (await fetch('/api/admin/addons')).json();
  throw new Error('Configura el cliente de API para administrar extras.');
}
export async function getAddonsByProduct(productId, availableAddonIds) {
  const addons = await getAddons();
  const hasProductConfiguration = Array.isArray(availableAddonIds);
  const enabledIds = new Set(hasProductConfiguration ? availableAddonIds : []);
  return addons.filter((addon) => addon.isActive && (hasProductConfiguration ? enabledIds.has(addon.id) : addon.applicableProducts.includes(productId)));
}

/** Pure per-order pricing calculation shared by the editor and cart. */
export function calculateTotalPrice(product, selectedVariant, canvasState, selectedAddons, quantity) {
  const pricingSchema = product?.pricingSchema || {};
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const basePrice = Math.max(0, Number(product?.basePrice ?? product?.price) || 0);
  const variantIds = selectedVariant?.variantIds || [selectedVariant?.variantId ?? selectedVariant?.id].filter(Boolean);
  const configuredVariants = (pricingSchema.variantModifiers || []).filter((item) => variantIds.includes(item.variantId));
  const configuredVariantDelta = configuredVariants.reduce((sum, item) => sum + (Number(item.priceDelta) || 0), 0);
  const variantDelta = configuredVariants.length
    ? configuredVariantDelta
    : Number(selectedVariant?.priceDelta ?? selectedVariant?.priceModifier) || 0;
  const unitBasePrice = Math.max(0, basePrice + variantDelta);
  const designedSideCount = Math.max(0, Math.floor(Number(
    canvasState?.designedSideCount ?? canvasState?.usedViewIds?.length ?? (canvasState?.isDoubleSidedUsed ? 2 : canvasState?.hasDesign ? 1 : 0),
  ) || 0));
  const coveragePercentage = Math.max(0, Number(canvasState?.coveragePercentage) || 0);
  const fullWrapUsed = Boolean(canvasState?.backgroundCoversArea || canvasState?.isFullWrap) || coveragePercentage >= 75;
  const legacyRules = product?.pricingRules;
  const sidesPricing = pricingSchema.sidesPricing || (legacyRules?.hasMultipleSides ? {
    mode: 'per_side',
    pricePerAdditionalSide: legacyRules.extraSidePrice,
    wrapPrice: legacyRules.fullWrapPrice,
  } : undefined);
  const sidesEnabled = typeof legacyRules?.hasMultipleSides === 'boolean' ? legacyRules.hasMultipleSides : Boolean(sidesPricing);
  const sidesCost = sidesEnabled && sidesPricing
    ? fullWrapUsed
      ? Math.max(0, Number(sidesPricing.wrapPrice) || 0)
      : Math.max(0, designedSideCount - 1) * Math.max(0, Number(sidesPricing.pricePerAdditionalSide) || 0)
    : 0;
  const printingRule = fullWrapUsed && sidesCost > 0
    ? 'full-wrap'
    : designedSideCount > 1 && sidesCost > 0 ? 'double-sided' : 'single-sided';
  const addonsCost = (selectedAddons || []).reduce((total, addon) => {
    const faceMultiplier = addon?.perSide ? designedSideCount : 1;
    return total + Math.max(0, Number(addon?.price) || 0) * faceMultiplier;
  }, 0);
  const unitSubtotal = unitBasePrice + sidesCost + addonsCost;
  const discount = (pricingSchema.volumeDiscounts || [])
    .filter((tier) => safeQuantity >= Number(tier.minQty) && Number(tier.discountPercentage) > 0)
    .sort((a, b) => Number(b.minQty) - Number(a.minQty))[0];
  const discountPercentage = Math.min(100, Math.max(0, Number(discount?.discountPercentage) || 0));
  const discountPerUnit = unitSubtotal * (discountPercentage / 100);
  const discountedUnitPrice = unitSubtotal - discountPerUnit;
  const setupFee = Math.max(0, Number(pricingSchema.setupFee) || 0);
  const grandTotal = discountedUnitPrice * safeQuantity + setupFee;

  return {
    quantity: safeQuantity,
    unitBasePrice,
    variantDelta,
    designedSideCount,
    coveragePercentage,
    fullWrapUsed,
    printingRule,
    sidesCost,
    addonsCost,
    unitSubtotal,
    discountPercentage,
    discountPerUnit,
    discountedUnitPrice,
    setupFee,
    grandTotal,
  };
}

export async function createAddon(input) {
  if (USE_MOCK_DATA) {
    const addons = readAddons();
    const addon = normalizeAddon({ ...input, id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() });
    writeAddons([...addons, addon]);
    return delay(addon);
  }
  // return (await fetch('/api/admin/addons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).json();
  throw new Error('Configura el cliente de API para administrar extras.');
}
export async function updateAddon(id, input) {
  if (USE_MOCK_DATA) {
    const addons = readAddons();
    const index = addons.findIndex((addon) => addon.id === id);
    if (index < 0) throw new Error('No se encontró el extra.');
    const updated = normalizeAddon({ ...addons[index], ...input, id, createdAt: addons[index].createdAt });
    addons[index] = updated;
    writeAddons(addons);
    return delay(updated);
  }
  // return (await fetch(`/api/admin/addons/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).json();
  throw new Error('Configura el cliente de API para administrar extras.');
}
export async function deleteAddon(id) {
  if (USE_MOCK_DATA) { writeAddons(readAddons().filter((addon) => addon.id !== id)); return delay(true); }
  // return fetch(`/api/admin/addons/${id}`, { method: 'DELETE' });
  throw new Error('Configura el cliente de API para administrar extras.');
}
export async function toggleAddonStatus(id) {
  if (USE_MOCK_DATA) {
    const addons = readAddons();
    const index = addons.findIndex((addon) => addon.id === id);
    if (index < 0) throw new Error('No se encontró el extra.');
    addons[index] = { ...addons[index], isActive: !addons[index].isActive };
    writeAddons(addons);
    return delay(addons[index]);
  }
  // return (await fetch(`/api/admin/addons/${id}/status`, { method: 'PATCH' })).json();
  throw new Error('Configura el cliente de API para administrar extras.');
}
