import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/agent/agent_workspace.dart';
import 'package:zoro_flutter/core/agent/credential_vault.dart';
import 'package:zoro_flutter/core/agent/hermes_home_paths.dart';
import 'package:zoro_flutter/core/agent/hermes_home_writer.dart';
import 'package:zoro_flutter/core/agent/mcp/zoro_mcp_host.dart';
import 'package:zoro_flutter/core/agent/mcp/zoro_mcp_tools.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  FlutterSecureStorage.setMockInitialValues({});

  late Directory dir;
  late AgentWorkspace workspace;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('zoro-mcp-');
    workspace = AgentWorkspace(home: dir, vault: CredentialVault());
    await workspace.prepare();
  });

  tearDown(() async {
    if (await dir.exists()) await dir.delete(recursive: true);
  });

  test('commit_doc requires human confirm', () async {
    final tools = ZoroMcpTools(workspace: workspace);
    final denied = await tools.call('commit_doc', {
      'id': HermesHomePaths.retirementDocId,
      'markdown': 'secret plan',
    });
    expect((denied as Map)['needsConfirm'], isTrue);
    expect(
      await workspace.documents!.readHead(HermesHomePaths.retirementDocId),
      isNull,
    );

    final ok = await tools.call('commit_doc', {
      'id': HermesHomePaths.retirementDocId,
      'markdown': 'secret plan',
      'confirmed': true,
      'reason': 'test',
    });
    expect((ok as Map)['ok'], isTrue);
    expect(
      await workspace.documents!.readHead(HermesHomePaths.retirementDocId),
      'secret plan',
    );
  });

  test('JSON-RPC tools/list includes MCP tools', () async {
    final host = ZoroMcpHost(
      tools: ZoroMcpTools(workspace: workspace),
      token: 't',
    );
    final listed = await host.dispatch({
      'jsonrpc': '2.0',
      'id': 1,
      'method': 'tools/list',
    });
    final tools = (((listed['result'] as Map)['tools']) as List);
    expect(tools.length, ZoroMcpTools.toolNames.length);
  });

  test('AGENTS.md is not overwritten', () async {
    final f = File('${dir.path}/${HermesHomePaths.agentsFile}');
    await f.writeAsString('user edited');
    await HermesHomeWriter.ensureIdentityFiles(dir);
    expect(await f.readAsString(), 'user edited');
  });
}
