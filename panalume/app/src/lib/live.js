// Live updates from the add-on: reload the layout when another screen saves it,
// and reload the page when the add-on has been updated to a new build.
export const clientId = Math.random().toString(36).slice(2);

export function connectLive({ onConfig, canReload }) {
  let build = null;
  let backoff = 1000;
  let first = true;
  const url = () => {
    const base = location.pathname.replace(/[^/]*$/, '');
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${base}api/live`;
  };
  const open = () => {
    const ws = new WebSocket(url());
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'hello') {
        backoff = 1000;
        if (build && msg.build !== build && canReload()) return location.reload();
        build = msg.build;
        // After a reconnect we may have missed a save.
        if (!first) onConfig();
        first = false;
      } else if (msg.type === 'config' && msg.from !== clientId) onConfig();
    };
    ws.onclose = () => {
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 30000);
    };
  };
  open();
}
