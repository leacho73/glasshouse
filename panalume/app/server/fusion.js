// Read the ha-fusion add-on's dashboard so it can be converted. In the add-on we
// ask the Supervisor where ha-fusion lives and fetch its page data directly; in
// dev we go through HA ingress using the long-lived token.
import { WebSocket } from 'ws';

// SvelteKit __data.json uses devalue's flat encoding.
function unflatten(values) {
  const hydrate = (i) => {
    if (i < 0) return undefined;
    const v = values[i];
    if (Array.isArray(v)) return typeof v[0] === 'string' && ['Date', 'Set', 'Map'].includes(v[0]) ? null : v.map(hydrate);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, hydrate(x)]));
    return v;
  };
  return hydrate(0);
}

async function viaSupervisor(sup) {
  const api = (p) => fetch('http://supervisor' + p, { headers: { Authorization: `Bearer ${sup}` } }).then((r) => r.json());
  const list = await api('/addons');
  const addon = list.data.addons.find((a) => /fusion/i.test(a.slug + a.name));
  if (!addon) throw new Error('ha-fusion add-on not found');
  const info = (await api(`/addons/${addon.slug}/info`)).data;
  return fetch(`http://${info.ip_address}:${info.ingress_port}/__data.json`).then((r) => r.json());
}

function viaIngress(haUrl, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(haUrl.replace(/^http/, 'ws') + '/api/websocket');
    let id = 1;
    const pending = {};
    const call = (m) => new Promise((ok) => { const i = id++; pending[i] = ok; ws.send(JSON.stringify({ ...m, id: i })); });
    const sup = async (endpoint, method = 'get') => {
      const r = await call({ type: 'supervisor/api', endpoint, method });
      if (!r.success) throw new Error(r.error?.message || 'supervisor api failed');
      return r.result;
    };
    ws.on('error', reject);
    ws.on('message', async (d) => {
      const m = JSON.parse(d);
      if (m.type === 'auth_required') return ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      if (m.id && pending[m.id]) return pending[m.id](m);
      if (m.type !== 'auth_ok') return;
      try {
        const addon = (await sup('/addons')).addons.find((a) => /fusion/i.test(a.slug + a.name));
        if (!addon) throw new Error('ha-fusion add-on not found');
        const info = await sup(`/addons/${addon.slug}/info`);
        const { session } = await sup('/ingress/session', 'post');
        const r = await fetch(`${haUrl}${info.ingress_entry}/__data.json`, { headers: { Cookie: `ingress_session=${session}` } });
        resolve(await r.json());
      } catch (e) {
        reject(e);
      } finally {
        ws.close();
      }
    });
  });
}

export async function fusionDashboard({ sup, haUrl, token }) {
  const data = sup ? await viaSupervisor(sup) : await viaIngress(haUrl, token);
  const node = data.nodes.find((n) => n?.type === 'data' && n.data);
  const root = unflatten(node.data);
  if (!root?.dashboard) throw new Error('No dashboard in ha-fusion data');
  return root.dashboard;
}
