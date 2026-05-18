import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';
import '../../shared/guided_mcq/guided_mcq_page.dart';
import 'goal_widgets.dart';
import 'goals_apply_updates.dart';
import 'goals_retirement_corpus_config.dart';

Future<void> openRetirementCorpusGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  final res = await Navigator.of(context).push<GuidedMcqResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => GuidedMcqPage(
        model: model,
        config: GoalsRetirementCorpusConfig.forRetirement(model),
      ),
    ),
  );
  if (!context.mounted || res == null) return;
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (ctx) => GoalsRetirementCorpusReviewPage(model: model, result: res),
    ),
  );
}

class GoalsRetirementCorpusReviewPage extends StatelessWidget {
  const GoalsRetirementCorpusReviewPage({
    super.key,
    required this.model,
    required this.result,
  });

  final AppModel model;
  final GuidedMcqResult result;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final s = result.structured;
    final swr = s['safeWithdrawalRatePct'];
    final buf = s['corpusBufferPct'];
    final corpus = s['targetAmount'];
    final summary = s['summary']?.toString().trim() ?? result.contextMarkdown.trim();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review corpus', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (summary.isNotEmpty)
            Text(summary, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
          const SizedBox(height: 16),
          if (swr is num)
            Text('Safe withdrawal: ${swr.toDouble().round()}%', style: const TextStyle(fontWeight: FontWeight.w800)),
          if (buf is num)
            Text('Buffer: ${buf.toDouble().round()}%', style: const TextStyle(fontWeight: FontWeight.w800)),
          if (corpus is num) ...[
            const SizedBox(height: 8),
            Text(
              'Target corpus: ${goalMoney(model, corpus.toDouble())}',
              style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () {
              applyRetirementCorpusStructured(model, result.structured, contextMarkdown: result.contextMarkdown);
              model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementCorpus, result.structured);
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Retirement corpus updated'), behavior: SnackBarBehavior.floating),
              );
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }
}
