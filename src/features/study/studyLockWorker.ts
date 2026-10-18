// One worker per origin: all contenders pass through this single event loop.
// Never expire a hidden tab on a heartbeat timeout: it may still be studying.
type Request = { type: string; id: number; name: string; ifAvailable?: boolean; controlResource?: string };
type Contender = Request & { port: MessagePort };
const held = new Map<string, Contender>();
const queues = new Map<string, Contender[]>();
const connections = new Set<MessagePort>();
function grant(request: Contender) {
  if (!connections.has(request.port)) return;
  if (request.controlResource && held.get("bej-study-v2:control:" + request.controlResource)?.port !== request.port) {
    request.port.postMessage({ id: request.id, available: false }); return;
  }
  held.set(request.name, request);
  request.port.postMessage({ id: request.id, available: true });
}
function next(name: string) {
  const queue = queues.get(name);
  while (!held.has(name) && queue?.length) grant(queue.shift()!);
  if (!queue?.length) queues.delete(name);
}
function disconnect(port: MessagePort) {
  connections.delete(port);
  for (const [name, queue] of queues) {
    queues.set(name, queue.filter(request => request.port !== port));
  }
  for (const [name, request] of held) if (request.port === port) {
    held.delete(name); next(name);
  }
}
const workerScope = globalThis as unknown as { onconnect: (event: MessageEvent) => void };
workerScope.onconnect = event => {
  const port = event.ports[0];
  connections.add(port);
  port.onmessage = (event: MessageEvent<Request>) => {
    const request = { ...event.data, port };
    if (request.type === "disconnect") { disconnect(port); return; }
    if (!connections.has(port)) return;
    if (request.type === "release") {
      const owner = held.get(request.name);
      if (owner?.port === port && owner.id === request.id) {
        held.delete(request.name); next(request.name);
      }
      port.postMessage({ id: request.id, type: "released" });
    } else if (request.type === "request") {
      if (!held.has(request.name)) grant(request);
      else if (request.ifAvailable) port.postMessage({ id: request.id, available: false });
      else {
        const queue = queues.get(request.name) ?? [];
        queue.push(request); queues.set(request.name, queue);
      }
    }
  };
  // Engines that report an abruptly closed port can release it immediately.
  // Other engines keep the reservation conservatively until all tabs close.
  port.addEventListener("close", () => disconnect(port));
  port.start();
};
export {};
