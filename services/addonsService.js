export const USE_MOCK_DATA = true;
const STORAGE_KEY = 'admin_addons';
const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 250));

function readAddons() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
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
export async function getAddonsByProduct(productId) {
  const addons = await getAddons();
  return addons.filter((addon) => addon.isActive && addon.applicableProducts.includes(productId));
}
export async function createAddon(input) {
  if (USE_MOCK_DATA) {
    const addons = readAddons();
    const addon = { ...input, id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() };
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
    const updated = { ...addons[index], ...input, id, createdAt: addons[index].createdAt };
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
