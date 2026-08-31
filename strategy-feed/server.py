"""
TCP listener for strategist / algo / external-system data feeds - two-way.

Inbound (TCP, port 9100 by default): newline-delimited JSON. Each connected
client sends one JSON object per line, e.g.:

    {"source": "AlgoBot-1", "symbol": "NIFTY 24500 CE", "event": "SIGNAL", "data": {"side": "BUY", "score": 0.82}}

There is no fixed schema beyond "valid JSON" - whatever object a client sends
is stamped with a receive timestamp and the sender's address, printed to the
console immediately, and forwarded to the iwmQT backend so it shows up live
in the trading terminal UI (see server/src/routes/strategyFeed.routes.js).

Outbound (HTTP control port, 9101 by default): the iwmQT backend calls
POST /command here (e.g. when a trader clicks Deploy/Stop on the Strategy
panel) and this process writes that command as a JSON line down to the
connected TCP client(s), so the external strategist/algo system receives it.
Body: {"target": "all" | "<peer address>", "command": {...}}.

Usage:
    python3 server.py [--host 0.0.0.0] [--port 9100] [--control-port 9101]
                       [--backend-url http://localhost:3000/api/strategy-feed/ingest]

Config can also come from environment variables (STRATEGY_FEED_HOST,
STRATEGY_FEED_PORT, STRATEGY_FEED_CONTROL_PORT, STRATEGY_FEED_BACKEND_URL,
STRATEGY_FEED_SECRET) - CLI flags take priority. These are loaded from a
`.env` file in this directory if present (see `.env.example`), so the secret
never has to be typed on the command line or land in shell history.
STRATEGY_FEED_SECRET must match the backend's env var of the same name; both
directions reject requests without it.

Neither port has per-connection auth of its own beyond that shared secret on
the control port - this is meant to sit behind a firewall/VPN restricting who
can reach it, not to be exposed on the open internet.
"""
import argparse
import asyncio
import json
import os
from datetime import datetime, timezone

import aiohttp
from aiohttp import web
from dotenv import load_dotenv

load_dotenv()

DEFAULT_HOST = os.environ.get('STRATEGY_FEED_HOST', '0.0.0.0')
DEFAULT_PORT = int(os.environ.get('STRATEGY_FEED_PORT', '9100'))
DEFAULT_CONTROL_PORT = int(os.environ.get('STRATEGY_FEED_CONTROL_PORT', '9101'))
DEFAULT_BACKEND_URL = os.environ.get('STRATEGY_FEED_BACKEND_URL', 'http://localhost:3000/api/strategy-feed/ingest')
DEFAULT_SECRET = os.environ.get('STRATEGY_FEED_SECRET', '')

# peer address ("host:port") -> StreamWriter, for the /command control endpoint to write
# outbound messages back down to. Populated/cleared in handle_client.
connected_clients = {}


async def forward_to_backend(session, backend_url, secret, envelope):
    try:
        async with session.post(
            backend_url,
            json=envelope,
            headers={'X-Internal-Secret': secret},
            timeout=aiohttp.ClientTimeout(total=3),
        ) as resp:
            if resp.status >= 300:
                print(f"[WARN] backend rejected update ({resp.status}): {await resp.text()}")
    except Exception as exc:
        # A slow/unreachable backend must never take down the TCP listener itself -
        # the console print above already happened, so the update isn't silently lost.
        print(f"[WARN] failed to forward update to backend: {exc}")


async def handle_client(reader, writer, session, backend_url, secret):
    peer = writer.get_extra_info('peername')
    peer_label = f"{peer[0]}:{peer[1]}" if peer else 'unknown'
    print(f"[CONNECT] {peer_label}")
    connected_clients[peer_label] = writer

    try:
        while True:
            line = await reader.readline()
            if not line:
                break
            raw = line.decode('utf-8', errors='replace').strip()
            if not raw:
                continue

            try:
                data = json.loads(raw)
            except json.JSONDecodeError as exc:
                print(f"[WARN] {peer_label} sent malformed JSON, skipping: {exc}")
                continue

            envelope = {
                'source_address': peer_label,
                'received_at': datetime.now(timezone.utc).isoformat(),
                'payload': data,
            }
            print(f"[UPDATE] {envelope['received_at']} from {peer_label}: {json.dumps(data)}")

            asyncio.create_task(forward_to_backend(session, backend_url, secret, envelope))
    except (ConnectionResetError, asyncio.IncompleteReadError):
        pass
    finally:
        print(f"[DISCONNECT] {peer_label}")
        connected_clients.pop(peer_label, None)
        writer.close()


async def send_command(writer, command):
    line = (json.dumps(command) + '\n').encode('utf-8')
    writer.write(line)
    await writer.drain()


def make_command_app(secret):
    app = web.Application()

    async def handle_command(request):
        if not secret or request.headers.get('X-Internal-Secret') != secret:
            return web.json_response({'error': 'Unauthorized'}, status=401)

        try:
            body = await request.json()
        except json.JSONDecodeError:
            return web.json_response({'error': 'Invalid JSON body'}, status=400)

        target = body.get('target', 'all')
        command = body.get('command')
        if command is None:
            return web.json_response({'error': '"command" is required'}, status=400)

        if target == 'all':
            targets = list(connected_clients.items())
        else:
            writer = connected_clients.get(target)
            targets = [(target, writer)] if writer else []

        if not targets:
            print(f"[COMMAND] no connected client matches target={target!r}, dropped: {json.dumps(command)}")
            return web.json_response({'delivered_to': [], 'warning': 'no matching connected client'}, status=200)

        delivered = []
        for peer_label, writer in targets:
            try:
                await send_command(writer, command)
                delivered.append(peer_label)
            except Exception as exc:
                print(f"[WARN] failed to send command to {peer_label}: {exc}")

        print(f"[COMMAND] delivered to {delivered}: {json.dumps(command)}")
        return web.json_response({'delivered_to': delivered})

    app.router.add_post('/command', handle_command)
    return app


async def main():
    parser = argparse.ArgumentParser(description='TCP listener for strategist/algo data feeds')
    parser.add_argument('--host', default=DEFAULT_HOST)
    parser.add_argument('--port', type=int, default=DEFAULT_PORT)
    parser.add_argument('--control-port', type=int, default=DEFAULT_CONTROL_PORT)
    parser.add_argument('--backend-url', default=DEFAULT_BACKEND_URL)
    parser.add_argument('--secret', default=DEFAULT_SECRET)
    args = parser.parse_args()

    if not args.secret:
        print("[WARN] no STRATEGY_FEED_SECRET set - the backend will reject every forwarded update, "
              "and /command will reject every request. Console output for inbound data still works.")

    async with aiohttp.ClientSession() as session:
        server = await asyncio.start_server(
            lambda r, w: handle_client(r, w, session, args.backend_url, args.secret),
            args.host,
            args.port,
        )
        addr = ', '.join(str(sock.getsockname()) for sock in server.sockets)
        print(f"Strategy feed TCP server listening on {addr}")
        print(f"Forwarding updates to {args.backend_url}")

        command_app = make_command_app(args.secret)
        runner = web.AppRunner(command_app)
        await runner.setup()
        site = web.TCPSite(runner, args.host, args.control_port)
        await site.start()
        print(f"Command control endpoint listening on http://{args.host}:{args.control_port}/command")

        async with server:
            await server.serve_forever()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down.")
