import 'dart:convert';
import 'dart:io';

import 'zoro_mcp_tools.dart';

/// Loopback JSON-RPC MCP host. Hermes calls tools here; Zoro never embeds Hermes.
class ZoroMcpHost {
  ZoroMcpHost({required this.tools, required this.token});

  final ZoroMcpTools tools;
  final String token;

  HttpServer? _server;
  int port = 0;

  bool get isRunning => _server != null;

  Future<int> start({int bindPort = 0}) async {
    await stop();
    final server = await HttpServer.bind(
      InternetAddress.loopbackIPv4,
      bindPort,
    );
    _server = server;
    port = server.port;
    server.listen(_handle);
    return port;
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
    port = 0;
  }

  Future<void> _handle(HttpRequest req) async {
    if (req.method != 'POST' || req.uri.path != '/mcp') {
      req.response.statusCode = HttpStatus.notFound;
      await req.response.close();
      return;
    }
    final auth = req.headers.value(HttpHeaders.authorizationHeader) ?? '';
    if (auth != 'Bearer $token') {
      req.response.statusCode = HttpStatus.unauthorized;
      await req.response.close();
      return;
    }
    final body = await utf8.decoder.bind(req).join();
    Object? rpc;
    try {
      rpc = jsonDecode(body);
    } catch (_) {
      req.response.statusCode = HttpStatus.badRequest;
      await req.response.close();
      return;
    }
    final result = await dispatch(rpc);
    req.response.headers.contentType = ContentType.json;
    req.response.write(jsonEncode(result));
    await req.response.close();
  }

  /// JSON-RPC 2.0 subset: initialize, tools/list, tools/call.
  Future<Map<String, dynamic>> dispatch(Object? rpc) async {
    if (rpc is! Map) {
      return _error(null, -32600, 'Invalid Request');
    }
    final id = rpc['id'];
    final method = rpc['method']?.toString() ?? '';
    final params = rpc['params'] is Map
        ? Map<String, dynamic>.from(rpc['params'] as Map)
        : <String, dynamic>{};
    try {
      switch (method) {
        case 'initialize':
          return _ok(id, {
            'protocolVersion': '2024-11-05',
            'serverInfo': {'name': 'zoro', 'version': '1'},
            'capabilities': {
              'tools': {'listChanged': false},
            },
          });
        case 'tools/list':
          return _ok(id, {
            'tools': [
              for (final name in ZoroMcpTools.toolNames)
                {
                  'name': name,
                  'description': name,
                  'inputSchema': {
                    'type': 'object',
                    'additionalProperties': true,
                  },
                },
            ],
          });
        case 'tools/call':
          final name = params['name']?.toString() ?? '';
          final args = params['arguments'] is Map
              ? Map<String, dynamic>.from(params['arguments'] as Map)
              : <String, dynamic>{};
          final data = await tools.call(name, args);
          return _ok(id, {
            'content': [
              {'type': 'text', 'text': jsonEncode(data)},
            ],
          });
        default:
          return _error(id, -32601, 'Method not found');
      }
    } catch (e) {
      return _error(id, -32000, e.toString());
    }
  }

  Map<String, dynamic> _ok(Object? id, Object result) => {
    'jsonrpc': '2.0',
    'id': id,
    'result': result,
  };

  Map<String, dynamic> _error(Object? id, int code, String message) => {
    'jsonrpc': '2.0',
    'id': id,
    'error': {'code': code, 'message': message},
  };
}
